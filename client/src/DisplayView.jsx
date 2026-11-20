import React, { useEffect, useRef, useState } from 'react';
import CelebrationCanvas from './CelebrationCanvas';
import { buildJoinInviteUrl } from './config';
import { getRoundCardColor, getAnswerImageUrl, getAnswerFallbackSvg } from './cardTheme';

const LETTERS = ['A', 'B', 'C', 'D'];

function playStageCue(type) {
  if (type !== 'fanfare') return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    const context = new AudioContextClass();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((frequency, index) => {
      const start = context.currentTime + index * 0.11;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.18, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.65);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.65);
    });
    window.setTimeout(() => context.close().catch(() => {}), 1200);
  } catch {
    // Visual celebrations remain available if audio is unavailable.
  }
}

export default function DisplayView({ useGameSocket }) {
  const code = new URLSearchParams(window.location.search).get('code')?.toUpperCase() || '';
  const { state, connected, clockOffsetMs } = useGameSocket({ gameCode: code, role: 'DISPLAY' });
  const [nowMs, setNowMs] = useState(Date.now());
  const previousStatus = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const status = state?.game?.status;
    if (status === 'FINISHED' && previousStatus.current !== 'FINISHED') {
      playStageCue('fanfare');
    }
    previousStatus.current = status;
  }, [state?.game?.status]);

  if (!code) {
    return (
      <main className="editorial-stage">
        <div className="editorial-card" style={{ '--card-bg': '#E8AE58' }}>
          <p className="editorial-kicker">MINI PUZZLE</p>
          <h1 className="editorial-title">Trivia</h1>
          <p className="editorial-prompt">
            Add your room code to the URL to launch the TV display, e.g. <code>/display?code=ABCDE</code>.
          </p>
        </div>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="editorial-stage">
        <div className="editorial-card" style={{ '--card-bg': '#E8AE58' }}>
          <p className="editorial-kicker">ROOM {code}</p>
          <h1 className="editorial-title">Trivia</h1>
          <p className="editorial-prompt">{connected ? 'Loading live room…' : 'Connecting to stage…'}</p>
        </div>
      </main>
    );
  }

  const { game, teams = [], questions = [] } = state;
  const roundNum = game.currentRound || 1;
  const cardBg = getRoundCardColor(roundNum);
  const finished = game.status === 'FINISHED';
  const winner = teams[0];

  const remainingSeconds =
    game.timerPausedRemainingMs != null
      ? Math.ceil(game.timerPausedRemainingMs / 1000)
      : !game.timerEndsAt
      ? 120
      : Math.max(0, Math.ceil((game.timerEndsAt - (nowMs + clockOffsetMs)) / 1000));

  const qIdx = Math.min(game.currentQuestionIndex ?? 0, Math.max(0, questions.length - 1));
  const activeQuestion = questions[qIdx];
  const joinUrl = buildJoinInviteUrl(game.code);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(joinUrl)}`;

  return (
    <main className="editorial-stage">
      <CelebrationCanvas active={finished && teams.length > 0} />

      <div className="editorial-topbar">
        <span className="editorial-pill-badge">
          ROUND {roundNum} · ROOM {game.code}
        </span>
        {game.status === 'QUESTION_SET' && (
          <span className="editorial-timer-badge">
            ⏱ {Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, '0')}
          </span>
        )}
        <span className="editorial-pill-badge">{teams.length} TEAMS</span>
      </div>

      {/* LOBBY / ROUND INTRO */}
      {(game.status === 'LOBBY' || game.status === 'ROUND_INTRO') && (
        <section className="editorial-card" style={{ '--card-bg': cardBg }}>
          <p className="editorial-kicker">
            {game.status === 'ROUND_INTRO'
              ? `ROUND ${roundNum} · ${game.selectedCategories?.[roundNum - 1] || 'MINI PUZZLE'}`
              : 'SCAN TO JOIN'}
          </p>
          <h1 className="editorial-title">Trivia</h1>
          <p className="editorial-q-label">
            {game.status === 'ROUND_INTRO' ? `Up Next: Round ${roundNum}` : `Room Code: ${game.code}`}
          </p>
          <p className="editorial-prompt">
            {game.status === 'ROUND_INTRO'
              ? `Category: ${game.selectedCategories?.[roundNum - 1] || 'General Knowledge'} · 2:00 per question`
              : 'Point your phone camera at the QR code below to join with one tap.'}
          </p>

          <div className="editorial-qr-box">
            <img src={qrUrl} alt="Scan QR to join game" width="180" height="180" />
            <strong style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>{joinUrl}</strong>
          </div>

          {teams.length > 0 && (
            <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.45rem', justifyContent: 'center' }}>
              {teams.map((t) => (
                <span key={t.id} className="editorial-pill-badge">
                  {t.avatar} {t.name}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ONE QUESTION AT A TIME */}
      {game.status === 'QUESTION_SET' && activeQuestion && (
        <section className="editorial-card" style={{ '--card-bg': cardBg }} key={activeQuestion.id}>
          <p className="editorial-kicker">
            {activeQuestion.category || 'MINI PUZZLE'} · {qIdx + 1} OF {questions.length}
          </p>
          <h1 className="editorial-title">Trivia</h1>
          <p className="editorial-q-label">Question {qIdx + 1}:</p>
          <p className="editorial-prompt">{activeQuestion.prompt}</p>

          <div className="editorial-choices">
            {(activeQuestion.choices || []).map((choice, idx) => {
              const letter = LETTERS[idx] || String(idx + 1);
              return (
                <div className="editorial-choice-btn" key={choice}>
                  <img
                    className="editorial-choice-thumb"
                    src={getAnswerImageUrl(choice, activeQuestion.category)}
                    alt={choice}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = getAnswerFallbackSvg(letter, choice);
                    }}
                  />
                  <span className="editorial-choice-text">
                    <span className="editorial-choice-letter">{letter}.</span> {choice}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ANSWER REVEAL */}
      {game.status === 'REVEAL' && (
        <section className="editorial-card wide" style={{ '--card-bg': cardBg }}>
          <p className="editorial-kicker">ROUND {roundNum} ANSWERS</p>
          <h1 className="editorial-title">Trivia</h1>
          <div className="editorial-choices">
            {questions.map((q, idx) => (
              <div className="editorial-choice-btn correct" key={q.id}>
                <img
                  className="editorial-choice-thumb"
                  src={getAnswerImageUrl(q.correctAnswer, q.category)}
                  alt={q.correctAnswer}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = getAnswerFallbackSvg(`Q${idx + 1}`, q.correctAnswer);
                  }}
                />
                <div className="editorial-choice-text" style={{ textTransform: 'none' }}>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    Q{idx + 1}: {q.prompt}
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 900, marginTop: '0.2rem' }}>
                    ✓ {q.correctAnswer}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* LEADERBOARD / FINAL WINNER */}
      {(game.status === 'LEADERBOARD' || finished) && (
        <section className="editorial-card wide" style={{ '--card-bg': cardBg }}>
          <p className="editorial-kicker">
            {finished ? '🏆 GRAND CHAMPION 🏆' : `STANDINGS · ROUND ${roundNum}`}
          </p>
          <h1 className="editorial-title">{finished && winner ? winner.name : 'Leaderboard'}</h1>
          {finished && winner && (
            <p className="editorial-prompt">
              <strong>{Number(winner.score || 0).toLocaleString()} PTS</strong>
            </p>
          )}
          <div>
            {teams.map((team, index) => (
              <div className="editorial-rank-row" key={team.id}>
                <span>
                  #{index + 1} · {team.avatar} {team.name}
                </span>
                <strong>{Number(team.score || 0).toLocaleString()} PTS</strong>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
