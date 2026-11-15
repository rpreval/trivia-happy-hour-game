import React, { useEffect, useRef, useState } from 'react';
import CelebrationCanvas from './CelebrationCanvas';

function playWinnerFanfare() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
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

export default function JoinView({ useGameSocket }) {
  const params = new URLSearchParams(window.location.search);
  const [code, setCode] = useState((params.get('code') || '').toUpperCase());
  const [name, setName] = useState('');
  const [team, setTeam] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [wager, setWager] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const sessionToken = localStorage.getItem(`trivia-team-token-${code}`);
  const { state, connected, send } = useGameSocket({ gameCode: team ? code : '', role: 'TEAM', teamId: team?.id });
  const previousWinner = useRef(false);

  useEffect(() => {
    if (!code || !sessionToken || team) return;
    fetch(`/api/games/${code}/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken }) }).then(async (r) => {
        const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Could not reconnect'); setTeam(data.team);
      }).catch(() => localStorage.removeItem(`trivia-team-token-${code}`));
  }, [code]);

  async function join(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch(`/api/games/${code}/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamName: name }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not join game');
      localStorage.setItem(`trivia-team-token-${code}`, data.sessionToken); setTeam(data.team);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  function updateAnswer(index, value) { setAnswers((current) => { const next = [...current]; next[index] = value; return next; }); }

  const game = state?.game;
  const teams = state?.teams || [];
  const myRank = teams.findIndex((entry) => entry.id === team?.id) + 1;
  const isFirstPlaceWinner = game?.status === 'FINISHED' && myRank === 1 && teams.length > 0;

  useEffect(() => {
    if (isFirstPlaceWinner && !previousWinner.current) {
      playWinnerFanfare();
      if (typeof navigator.vibrate === 'function') {
        navigator.vibrate([120, 60, 120, 60, 240]);
      }
    }
    previousWinner.current = isFirstPlaceWinner;
  }, [isFirstPlaceWinner]);

  if (!team) return <main className="panel"><p className="eyebrow">TRIVIA HAPPY HOUR</p><h1>Join a game</h1>
    <form onSubmit={join}><label>Room code<input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required maxLength="8" /></label>
      <label>Team name<input value={name} onChange={(e) => setName(e.target.value)} required maxLength="40" /></label>
      <button disabled={busy}>{busy ? 'Joining…' : 'Join room'}</button></form>{error && <p className="error">{error}</p>}</main>;

  const submitted = state?.submittedTeamIds?.includes(team.id);
  return <div className="relative"><CelebrationCanvas active={isFirstPlaceWinner} />
    <main className={`panel wide${isFirstPlaceWinner ? ' winner-panel' : ''}`}><p className="eyebrow">TEAM · {connected ? 'CONNECTED' : 'RECONNECTING'}</p><h1>{team.avatar} {team.name}</h1>
    {!game ? <p>Connecting to room {code}…</p> : <><p className="status">Room {code} · {game.status.replaceAll('_', ' ')} · Score {state.teams.find((t) => t.id === team.id)?.score ?? team.score}</p>
      {isFirstPlaceWinner && <section className="champion-banner winner-banner">
        <p className="eyebrow">GRAND CHAMPION</p>
        <h2><span aria-hidden="true">{team.avatar}</span> {team.name}</h2>
        <strong>{teams[0].score} pts</strong>
      </section>}
      {game.status === 'QUESTION_SET' && (submitted ? <p>Your answers are in. Good luck!</p> : <form onSubmit={(e) => { e.preventDefault(); send({ type: 'SUBMIT_ANSWERS', answers, wager }); }}>
        {state.questions.map((q) => <label className="answer" key={q.id}><span>{q.prompt}</span>{q.type === 'MCQ' ? <select required value={answers[q.index] || ''} onChange={(e) => updateAnswer(q.index, e.target.value)}><option value="">Choose an answer</option>{q.choices?.map((choice) => <option key={choice}>{choice}</option>)}</select> : <><p className="clues">Clues: {q.choices?.join(' · ')}</p><input required value={answers[q.index] || ''} onChange={(e) => updateAnswer(q.index, e.target.value)} placeholder="Your answer" /></>}</label>)}
        {game.currentRound === 9 && <label>Wager (up to {state.teams.find((t) => t.id === team.id)?.score || 0})<input type="number" min="0" max={state.teams.find((t) => t.id === team.id)?.score || 0} value={wager} onChange={(e) => setWager(Number(e.target.value))} /></label>}
        <button>Submit answers</button></form>)}
      {['REVEAL', 'LEADERBOARD', 'FINISHED'].includes(game.status) && state.questions.map((q) => <article className="question" key={q.id}><p>{q.prompt}</p><strong>Answer: {q.correctAnswer}</strong></article>)}
    </>}{error && <p className="error">{error}</p>}</main>
  </div>;
}
