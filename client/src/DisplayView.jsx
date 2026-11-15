import React, { useEffect, useRef } from 'react';
import CelebrationCanvas from './CelebrationCanvas';

function playStageCue(type = 'buzzer') {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();

  if (type === 'fanfare') {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((frequency, index) => {
      const startAt = ctx.currentTime + index * 0.11;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(frequency, startAt);
      gain.gain.setValueAtTime(0.18, startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.65);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + 0.65);
    });
    window.setTimeout(() => {
      void ctx.close();
    }, 1200);
  }
}

export default function DisplayView({ useGameSocket }) {
  const code = new URLSearchParams(window.location.search).get('code')?.toUpperCase() || '';
  const { state, connected } = useGameSocket({ gameCode: code, role: 'DISPLAY' });
  const previousStatus = useRef('');

  useEffect(() => {
    const status = state?.game?.status || '';
    if (status === 'FINISHED' && previousStatus.current !== 'FINISHED') {
      playStageCue('fanfare');
    }
    previousStatus.current = status;
  }, [state?.game?.status]);

  if (!code) return <main className="panel"><h1>Trivia Happy Hour</h1><p>Add a room code to the URL, e.g. <code>/display?code=ABCDE</code>.</p></main>;
  if (!state) return <main className="panel"><h1>Room {code}</h1><p>{connected ? 'Loading game…' : 'Connecting…'}</p></main>;
  const { game } = state;
  const teams = state.teams || [];
  const champion = teams[0];
  return <div className="relative"><CelebrationCanvas active={game.status === 'FINISHED' && teams.length > 0} />
    <main className="panel wide display relative"><p className="eyebrow">TRIVIA HAPPY HOUR · ROOM {game.code}</p>
    <h1>{game.status === 'LOBBY' ? 'Get ready to play!' : game.status.replaceAll('_', ' ')}</h1>
    {game.status === 'QUESTION_SET' && <><p className="status">Round {game.currentRound} · Set {game.currentSet}</p>
      {state.questions.map((q) => <article className="question" key={q.id}><p className="eyebrow">{q.category} · {q.type}</p><h2>{q.prompt}</h2>
        {q.choices?.map((choice) => <span className="choice" key={choice}>{choice}</span>)}</article>)}</>}
    {['REVEAL', 'LEADERBOARD', 'FINISHED'].includes(game.status) && state.questions.map((q) => <article className="question" key={q.id}><p>{q.prompt}</p><strong>Answer: {q.correctAnswer}</strong>{q.explanation && <p>{q.explanation}</p>}</article>)}
    <section>
      {game.status === 'FINISHED' && champion && <div className="champion-banner" style={{ borderColor: champion.color }}>
        <p className="eyebrow">GRAND CHAMPIONS</p>
        <h2><span style={{ color: champion.color }}>{champion.avatar}</span> {champion.name}</h2>
        <strong>{champion.score} pts</strong>
      </div>}
      <h2>Leaderboard</h2>{teams.map((team, i) => <p className="rank" key={team.id}><b>#{i + 1}</b> {team.avatar} {team.name}<strong>{team.score}</strong></p>)}
    </section>
    </main>
  </div>;
}
