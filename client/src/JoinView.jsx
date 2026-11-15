import React, { useEffect, useState } from 'react';

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
  if (!team) return <main className="panel"><p className="eyebrow">TRIVIA HAPPY HOUR</p><h1>Join a game</h1>
    <form onSubmit={join}><label>Room code<input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required maxLength="8" /></label>
      <label>Team name<input value={name} onChange={(e) => setName(e.target.value)} required maxLength="40" /></label>
      <button disabled={busy}>{busy ? 'Joining…' : 'Join room'}</button></form>{error && <p className="error">{error}</p>}</main>;

  const game = state?.game;
  const submitted = state?.submittedTeamIds?.includes(team.id);
  return <main className="panel wide"><p className="eyebrow">TEAM · {connected ? 'CONNECTED' : 'RECONNECTING'}</p><h1>{team.avatar} {team.name}</h1>
    {!game ? <p>Connecting to room {code}…</p> : <><p className="status">Room {code} · {game.status.replaceAll('_', ' ')} · Score {state.teams.find((t) => t.id === team.id)?.score ?? team.score}</p>
      {game.status === 'QUESTION_SET' && (submitted ? <p>Your answers are in. Good luck!</p> : <form onSubmit={(e) => { e.preventDefault(); send({ type: 'SUBMIT_ANSWERS', answers, wager }); }}>
        {state.questions.map((q) => <label className="answer" key={q.id}><span>{q.prompt}</span>{q.type === 'MCQ' ? <select required value={answers[q.index] || ''} onChange={(e) => updateAnswer(q.index, e.target.value)}><option value="">Choose an answer</option>{q.choices?.map((choice) => <option key={choice}>{choice}</option>)}</select> : <><p className="clues">Clues: {q.choices?.join(' · ')}</p><input required value={answers[q.index] || ''} onChange={(e) => updateAnswer(q.index, e.target.value)} placeholder="Your answer" /></>}</label>)}
        {game.currentRound === 9 && <label>Wager (up to {state.teams.find((t) => t.id === team.id)?.score || 0})<input type="number" min="0" max={state.teams.find((t) => t.id === team.id)?.score || 0} value={wager} onChange={(e) => setWager(Number(e.target.value))} /></label>}
        <button>Submit answers</button></form>)}
      {['REVEAL', 'LEADERBOARD', 'FINISHED'].includes(game.status) && state.questions.map((q) => <article className="question" key={q.id}><p>{q.prompt}</p><strong>Answer: {q.correctAnswer}</strong></article>)}
    </>}{error && <p className="error">{error}</p>}</main>;
}
