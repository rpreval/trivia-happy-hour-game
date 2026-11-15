import React, { useEffect, useRef } from 'react';
import CelebrationCanvas from './CelebrationCanvas';

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
    // Visual celebrations remain available if audio is unavailable or blocked.
  }
}

export default function DisplayView({ useGameSocket }) {
  const code = new URLSearchParams(window.location.search).get('code')?.toUpperCase() || '';
  const { state, connected } = useGameSocket({ gameCode: code, role: 'DISPLAY' });
  const previousStatus = useRef(null);

  useEffect(() => {
    const status = state?.game?.status;
    if (status === 'FINISHED' && previousStatus.current !== 'FINISHED') {
      playStageCue('fanfare');
    }
    previousStatus.current = status;
  }, [state?.game?.status]);

  if (!code) {
    return <main className="panel"><h1>Trivia Happy Hour</h1><p>Add a room code to the URL, e.g. <code>/display?code=ABCDE</code>.</p></main>;
  }
  if (!state) {
    return <main className="panel"><h1>Room {code}</h1><p>{connected ? 'Loading game…' : 'Connecting…'}</p></main>;
  }

  const { game, teams = [], questions = [] } = state;
  const finished = game.status === 'FINISHED';
  const winner = teams[0];

  return (
    <main className="panel wide display display-stage">
      <CelebrationCanvas active={finished && teams.length > 0} />
      <p className="eyebrow">TRIVIA HAPPY HOUR · ROOM {game.code}</p>
      <h1>{game.status === 'LOBBY' ? 'Get ready to play!' : game.status.replaceAll('_', ' ')}</h1>

      {game.status === 'QUESTION_SET' && <>
        <p className="status">Round {game.currentRound} · Set {game.currentSet}</p>
        {questions.map((question) => (
          <article className="question" key={question.id}>
            <p className="eyebrow">{question.category} · {question.type}</p>
            <h2>{question.prompt}</h2>
            {question.choices?.map((choice) => <span className="choice" key={choice}>{choice}</span>)}
          </article>
        ))}
      </>}

      {['REVEAL', 'LEADERBOARD', 'FINISHED'].includes(game.status) && questions.map((question) => (
        <article className="question" key={question.id}>
          <p>{question.prompt}</p>
          <strong>Answer: {question.correctAnswer}</strong>
          {question.explanation && <p>{question.explanation}</p>}
        </article>
      ))}

      {(game.status === 'LEADERBOARD' || finished) && (
        <section className="leaderboard-stage" aria-label="Game standings">
          {finished && winner ? (
            <div className="champion-banner" aria-live="polite">
              <p className="champion-kicker">🏆 Trivia Happy Hour Grand Champion 🏆</p>
              <div className="champion-identity">
                <span className="champion-avatar" style={{ backgroundColor: winner.color || '#fbbf24' }}>
                  {winner.avatar || '🏆'}
                </span>
                <h2>{winner.name}</h2>
              </div>
              <p className="champion-score">{Number(winner.score || 0).toLocaleString()} PTS</p>
            </div>
          ) : (
            <header className="leaderboard-heading">
              <p className="eyebrow">Standings After Round {game.currentRound}</p>
              <h2>Live Leaderboard</h2>
            </header>
          )}
          <h2 className="visually-hidden">Leaderboard</h2>
          {teams.map((team, index) => (
            <p className="rank" key={team.id}>
              <b>#{index + 1}</b> {team.avatar} {team.name}
              <strong>{Number(team.score || 0).toLocaleString()}</strong>
            </p>
          ))}
        </section>
      )}
    </main>
  );
}
