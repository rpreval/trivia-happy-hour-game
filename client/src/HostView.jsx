import React, { useState } from 'react';

const DEFAULT_CATEGORIES = ['General Knowledge', 'Science', 'History', 'Geography', 'Movies', 'Music', 'Sports', 'Food'];

export default function HostView({ useGameSocket }) {
  const params = new URLSearchParams(window.location.search);
  const [code, setCode] = useState(params.get('code')?.toUpperCase() || localStorage.getItem('trivia-host-code') || '');
  const [secret, setSecret] = useState(localStorage.getItem('trivia-host-secret') || '');
  const [hostName, setHostName] = useState('Host');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { state, connected, send } = useGameSocket({ gameCode: code, role: 'HOST', hostSecret: secret });

  async function createGame(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/games', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostName, categories: DEFAULT_CATEGORIES }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not create game');
      setCode(data.code); setSecret(data.hostSecret);
      localStorage.setItem('trivia-host-code', data.code);
      localStorage.setItem('trivia-host-secret', data.hostSecret);
      history.replaceState(null, '', `/host?code=${data.code}`);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function startSet() {
    if (!state || !secret) return;
    setBusy(true); setError('');
    try {
      const roundNum = state.game.currentRound || 1;
      const setCode = state.game.currentSet || 'A';
      const category = state.game.selectedCategories?.[(roundNum - 1) % state.game.selectedCategories.length] || DEFAULT_CATEGORIES[0];
      const response = await fetch(`/api/games/${code}/generate-set`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostSecret: secret, roundNum, setCode, category }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not generate questions');
      send({ type: 'START_SET', roundNum, setCode });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  if (!code || !secret) return <main className="panel"><p className="eyebrow">TRIVIA HAPPY HOUR</p><h1>Host a game</h1>
    <form onSubmit={createGame}><label>Your name<input value={hostName} onChange={(e) => setHostName(e.target.value)} required maxLength="64" /></label>
      <button disabled={busy}>{busy ? 'Creating…' : 'Create game room'}</button></form>{error && <p className="error">{error}</p>}</main>;

  const joinUrl = `${window.location.origin}/join?code=${code}`;
  return <main className="panel wide"><p className="eyebrow">HOST CONSOLE · {connected ? 'CONNECTED' : 'CONNECTING'}</p><h1>Room {code}</h1>
    <p>Share this link with players: <a href={joinUrl}>{joinUrl}</a></p>
    <p>Display screen: <a href={`/display?code=${code}`} target="_blank" rel="noreferrer">Open display</a></p>
    {state && <><p className="status">{state.game.status.replaceAll('_', ' ')} · Round {state.game.currentRound} · Set {state.game.currentSet}</p>
      <section><h2>Teams ({state.teams.length})</h2>{state.teams.map((team) => <p key={team.id}>{team.avatar} {team.name} — {team.score} pts {team.connected ? '●' : '○'}</p>)}</section>
      <div className="actions"><button onClick={startSet} disabled={busy || state.game.status === 'QUESTION_SET'}>Generate &amp; start set</button>
        <button className="secondary" onClick={() => send({ type: state.game.timerPausedRemainingMs != null ? 'RESUME_TIMER' : 'PAUSE_TIMER' })}>Pause / resume timer</button>
        <button className="secondary" onClick={() => send({ type: 'FORCE_REVEAL' })}>Reveal &amp; score</button>
        <button className="secondary" onClick={() => send({ type: 'SET_STATUS', status: 'LEADERBOARD' })}>Leaderboard</button></div>
    </>}{error && <p className="error">{error}</p>}</main>;
}
