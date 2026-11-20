import React, { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from './config';
import CelebrationCanvas from './CelebrationCanvas';
import { getRoundCardColor, getAnswerImageUrl, getAnswerFallbackSvg } from './cardTheme';

const AVATARS = ['⚡', '🔥', '🚀', '🦊', '🐯', '🦉', '👑', '🎯', '🎸', '🧠', '🏆', '💎'];
const COLORS = ['#E8AE58', '#9BB88F', '#E38B6F', '#8AB6D6', '#B8A4D6', '#F0C35B', '#89C7B9', '#E49AB0'];
const LETTERS = ['A', 'B', 'C', 'D'];
const TEAM_STORAGE_KEY = 'thh_team_session_v1';

function playTone(frequencies, duration = 0.6) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  try {
    const context = new AudioContextClass();
    frequencies.forEach((frequency, index) => {
      const start = context.currentTime + index * 0.11;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.18, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + duration);
    });
    window.setTimeout(() => context.close().catch(() => {}), 1500);
  } catch {
    // Audio optional
  }
}

export default function JoinView({ useGameSocket }) {
  const initialCode = new URLSearchParams(window.location.search).get('code')?.toUpperCase().slice(0, 8) || '';
  const [session, setSession] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(TEAM_STORAGE_KEY) || 'null');
      return saved && (!initialCode || saved.gameCode === initialCode) ? saved : null;
    } catch {
      return null;
    }
  });

  const [code, setCode] = useState(initialCode || session?.gameCode || '');
  const [teamName, setTeamName] = useState('');
  const [avatar, setAvatar] = useState(() => AVATARS[Math.floor(Math.random() * AVATARS.length)]);
  const [color, setColor] = useState(() => COLORS[Math.floor(Math.random() * COLORS.length)]);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState(['', '', '']);
  const [wager, setWager] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());
  const reconnected = useRef(false);
  const celebrated = useRef(false);

  const { state, connected, authError, clockOffsetMs, send } = useGameSocket({
    gameCode: session?.gameCode,
    role: 'TEAM',
    sessionToken: session?.sessionToken,
  });

  useEffect(() => {
    if (!session || reconnected.current) return undefined;
    reconnected.current = true;
    let cancelled = false;
    fetch(`${API_BASE_URL}/api/games/${encodeURIComponent(session.gameCode)}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken: session.sessionToken }),
    })
      .then((response) => {
        if (!response.ok && !cancelled) {
          localStorage.removeItem(TEAM_STORAGE_KEY);
          setSession(null);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    setAnswers(['', '', '']);
    setWager(0);
  }, [state?.game?.currentRound, state?.game?.currentSet]);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  const game = state?.game;
  const teams = state?.teams || [];
  const myTeam = teams.find((team) => team.id === session?.teamId);
  const myRank = session ? teams.findIndex((team) => team.id === session.teamId) + 1 : 0;
  const winner = game?.status === 'FINISHED' && myRank === 1 && teams.length > 0;

  const remainingSeconds = !game
    ? 120
    : game.timerPausedRemainingMs != null
    ? Math.ceil(game.timerPausedRemainingMs / 1000)
    : !game.timerEndsAt
    ? 120
    : Math.max(0, Math.ceil((game.timerEndsAt - (nowMs + clockOffsetMs)) / 1000));

  useEffect(() => {
    if (winner && !celebrated.current) {
      celebrated.current = true;
      playTone([523.25, 659.25, 783.99, 1046.5], 0.55);
      if (navigator.vibrate) navigator.vibrate([120, 60, 120, 60, 240]);
    } else if (game?.status !== 'FINISHED') {
      celebrated.current = false;
    }
  }, [winner, game?.status]);

  async function join(event) {
    event.preventDefault();
    setJoining(true);
    setError('');
    try {
      const cleanCode = code.trim().toUpperCase();
      const response = await fetch(`${API_BASE_URL}/api/games/${encodeURIComponent(cleanCode)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamName: teamName.trim(), avatar, color }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not join game.');
      const next = { gameCode: cleanCode, teamId: data.team.id, sessionToken: data.sessionToken };
      localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(next));
      setSession(next);
    } catch (joinError) {
      setError(joinError.message);
    } finally {
      setJoining(false);
    }
  }

  function leave() {
    localStorage.removeItem(TEAM_STORAGE_KEY);
    setSession(null);
    reconnected.current = false;
  }

  // 1-STEP EASY LOGIN SCREEN
  if (!session) {
    return (
      <main className="editorial-stage">
        <div className="editorial-card" style={{ '--card-bg': '#E8AE58' }}>
          <p className="editorial-kicker">
            {initialCode ? `ROOM ${initialCode} READY` : 'QUICK PLAYER LOGIN'}
          </p>
          <h1 className="editorial-title">Trivia</h1>
          <p className="editorial-prompt">Enter your team name to jump straight in.</p>

          <form onSubmit={join} style={{ display: 'grid', gap: '0.85rem', textAlign: 'left' }}>
            {!initialCode && (
              <div>
                <label style={{ fontWeight: 800, fontSize: '0.8rem', letterSpacing: '0.08em' }}>
                  ROOM CODE
                </label>
                <input
                  className="editorial-input"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. PZYA9"
                  required
                  maxLength={8}
                />
              </div>
            )}

            <div>
              <label style={{ fontWeight: 800, fontSize: '0.8rem', letterSpacing: '0.08em' }}>
                TEAM OR PLAYER NAME
              </label>
              <input
                className="editorial-input"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Type your name…"
                autoFocus
                required
                maxLength={40}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Icon: {avatar}</span>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {AVATARS.slice(0, 6).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setAvatar(item)}
                    style={{
                      padding: '0.3rem 0.5rem',
                      borderRadius: '10px',
                      border: '2px solid #23170e',
                      background: avatar === item ? '#23170e' : '#faf5ea',
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" className="editorial-submit-btn" disabled={joining || !teamName.trim()}>
              {joining ? 'Joining Room…' : 'Enter Game →'}
            </button>
          </form>

          {error && <p className="editorial-error">{error}</p>}
        </div>
      </main>
    );
  }

  const questions = state?.questions || [];
  const roundNum = game?.currentRound || 1;
  const cardBg = getRoundCardColor(roundNum);
  const qIdx = Math.min(game?.currentQuestionIndex ?? 0, Math.max(0, questions.length - 1));
  const activeQuestion = questions[qIdx];
  const score = Number(myTeam?.score ?? 0);
  const currentChoice = answers[qIdx] || '';

  function selectAnswer(value) {
    const nextAnswers = [...answers];
    nextAnswers[qIdx] = value;
    setAnswers(nextAnswers);
    playTone([523.25, 783.99], 0.2);
    send({ type: 'SUBMIT_ANSWERS', answers: nextAnswers, wager });
  }

  return (
    <main className="editorial-stage">
      <CelebrationCanvas active={Boolean(winner)} />

      <div className="editorial-topbar">
        <span className="editorial-pill-badge">
          {myTeam?.avatar || avatar} {myTeam?.name || 'TEAM'} · #{myRank || '—'}
        </span>
        {game?.status === 'QUESTION_SET' && (
          <span className="editorial-timer-badge">
            ⏱ {Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, '0')}
          </span>
        )}
        <span className="editorial-pill-badge">{score.toLocaleString()} PTS</span>
      </div>

      {authError && (
        <div className="editorial-error" style={{ marginBottom: '1rem' }}>
          {authError}{' '}
          <button type="button" onClick={leave} style={{ textDecoration: 'underline', marginLeft: '0.5rem' }}>
            Rejoin
          </button>
        </div>
      )}

      {!game || game.status === 'LOBBY' || game.status === 'ROUND_INTRO' ? (
        <section className="editorial-card" style={{ '--card-bg': cardBg }}>
          <p className="editorial-kicker">
            {connected ? `ROOM ${session.gameCode}` : 'RECONNECTING…'}
          </p>
          <h1 className="editorial-title">Trivia</h1>
          <p className="editorial-q-label">You’re In!</p>
          <p className="editorial-prompt">
            Watch the main screen. Question 1 will appear right here as soon as the host starts.
          </p>
        </section>
      ) : game.status === 'QUESTION_SET' && activeQuestion ? (
        <section className="editorial-card" style={{ '--card-bg': cardBg }} key={activeQuestion.id}>
          <p className="editorial-kicker">
            ROUND {roundNum} · QUESTION {qIdx + 1} OF {questions.length}
          </p>
          <h1 className="editorial-title">Trivia</h1>
          <p className="editorial-q-label">Question {qIdx + 1}:</p>
          <p className="editorial-prompt">{activeQuestion.prompt}</p>

          {game.currentRound === 9 && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontWeight: 800, fontSize: '0.8rem' }}>
                FINAL WAGER (MAX {score})
              </label>
              <input
                type="number"
                className="editorial-input"
                min="0"
                max={score}
                value={wager}
                onChange={(e) => setWager(Number(e.target.value) || 0)}
              />
            </div>
          )}

          {activeQuestion.type === 'MCQ' ? (
            <div className="editorial-choices">
              {(activeQuestion.choices || []).map((choice, idx) => {
                const letter = LETTERS[idx] || String(idx + 1);
                const isSelected = currentChoice === choice;
                return (
                  <button
                    key={choice}
                    type="button"
                    className={`editorial-choice-btn ${isSelected ? 'selected' : ''}`}
                    onClick={() => selectAnswer(choice)}
                  >
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
                  </button>
                );
              })}
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                selectAnswer(currentChoice);
              }}
            >
              <div className="editorial-choices" style={{ marginBottom: '0.85rem' }}>
                {(activeQuestion.choices || []).map((clue, idx) => (
                  <div className="editorial-choice-btn" key={clue}>
                    <img
                      className="editorial-choice-thumb"
                      src={getAnswerImageUrl(clue, activeQuestion.category)}
                      alt={clue}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = getAnswerFallbackSvg(LETTERS[idx] || '•', clue);
                      }}
                    />
                    <span className="editorial-choice-text">CLUE {idx + 1}: {clue}</span>
                  </div>
                ))}
              </div>
              <input
                className="editorial-input"
                value={currentChoice}
                onChange={(e) => {
                  const next = [...answers];
                  next[qIdx] = e.target.value;
                  setAnswers(next);
                }}
                placeholder="Type the 1-word connection…"
                required
              />
              <button type="submit" className="editorial-submit-btn">
                Lock In Answer ✓
              </button>
            </form>
          )}

          {currentChoice && (
            <p style={{ marginTop: '0.85rem', fontWeight: 800, fontSize: '0.85rem' }}>
              ✓ Locked in: {currentChoice} (you can tap another choice before time runs out)
            </p>
          )}
        </section>
      ) : (
        <section className="editorial-card" style={{ '--card-bg': cardBg }}>
          <p className="editorial-kicker">
            {winner ? '🎉 1ST PLACE CHAMPIONS 🎉' : `RANK #${myRank || '—'}`}
          </p>
          <h1 className="editorial-title">
            {game.status === 'FINISHED' ? (winner ? 'You Won!' : 'Game Over') : 'Standings'}
          </h1>
          <p className="editorial-prompt">
            Score: <strong>{score.toLocaleString()} points</strong>
          </p>
          <div>
            {teams.map((team, index) => (
              <div className="editorial-rank-row" key={team.id}>
                <span>
                  #{index + 1} · {team.avatar} {team.name}
                </span>
                <strong>{Number(team.score || 0).toLocaleString()}</strong>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
