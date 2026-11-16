import React, { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from './config';
import CelebrationCanvas from './CelebrationCanvas';

const AVATARS = ['⚡', '🔥', '🚀', '🦊', '🐯', '🦉', '👑', '🎯', '🎸', '🧠', '🏆', '💎'];
const COLORS = ['#38bdf8', '#f59e0b', '#10b981', '#f43f5e', '#a855f7', '#ec4899', '#14b8a6', '#eab308'];
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
    // Browser audio may be unavailable or blocked until a user gesture.
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
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [color, setColor] = useState(COLORS[0]);
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
    }).then((response) => {
      if (!response.ok && !cancelled) {
        localStorage.removeItem(TEAM_STORAGE_KEY);
        setSession(null);
      }
    }).catch(() => {
      // WebSocket reconnect logic can recover when the backend is temporarily offline.
    });
    return () => { cancelled = true; };
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
  const remainingSeconds = !game ? 105 : game.timerPausedRemainingMs != null
    ? Math.ceil(game.timerPausedRemainingMs / 1000)
    : !game.timerEndsAt ? 105 : Math.max(0, Math.ceil((game.timerEndsAt - (nowMs + clockOffsetMs)) / 1000));

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

  if (!session) {
    return (
      <main className="panel">
        <p className="eyebrow">TRIVIA HAPPY HOUR</p><h1>Join a game</h1>
        <form onSubmit={join}>
          <label>Room code<input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} required maxLength="8" /></label>
          <label>Team name<input value={teamName} onChange={(event) => setTeamName(event.target.value)} required maxLength="40" /></label>
          <p>Choose an avatar</p><div className="avatar-picker">{AVATARS.map((item) => <button key={item} type="button" className={avatar === item ? 'avatar selected' : 'avatar'} onClick={() => setAvatar(item)}>{item}</button>)}</div>
          <p>Team color</p><div className="color-picker">{COLORS.map((item) => <button key={item} type="button" aria-label={`Select ${item}`} className={color === item ? 'color-swatch selected' : 'color-swatch'} style={{ backgroundColor: item }} onClick={() => setColor(item)} />)}</div>
          <button disabled={joining}>{joining ? 'Joining…' : 'Join room'}</button>
        </form>
        {error && <p className="error">{error}</p>}
      </main>
    );
  }

  const questions = state?.questions || [];
  const submitted = (state?.submittedTeamIds || []).includes(session.teamId);
  const score = Number(myTeam?.score ?? 0);

  return (
    <main className="panel wide team-view">
      <CelebrationCanvas active={Boolean(winner)} />
      <header className="team-header"><div><p className="eyebrow">TEAM · {connected ? 'CONNECTED' : 'RECONNECTING'}</p><h1>{myTeam?.avatar || avatar} {myTeam?.name || 'Your team'}</h1><p>Room {session.gameCode} · Rank #{myRank || '—'}</p></div><div className="team-score">{score.toLocaleString()}<small>POINTS</small></div></header>
      {authError && <p className="error">{authError} <button type="button" onClick={leave}>Rejoin</button></p>}
      {!game ? <p>Connecting to room {session.gameCode}…</p> : <>
        {game.status === 'LOBBY' && <section className="question"><h2>You’re on the Big Screen!</h2><p>Watch the main display. The host will launch the game shortly.</p></section>}
        {game.status === 'QUESTION_SET' && <section className="team-questions"><div className="team-timer">{Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, '0')}</div>
          {submitted ? <p className="question">Answers locked in! Waiting for the reveal.</p> : <form onSubmit={(event) => { event.preventDefault(); playTone([523.25, 783.99], 0.25); send({ type: 'SUBMIT_ANSWERS', answers, wager }); }}>
            {game.currentRound === 9 && <label>Championship wager (max {score})<input type="number" min="0" max={score} value={wager} onChange={(event) => setWager(Number(event.target.value) || 0)} /></label>}
            {questions.map((question, index) => <label className="answer" key={question.id}><span>{question.prompt}</span>{question.type === 'MCQ' ? <select required value={answers[question.index] || ''} onChange={(event) => setAnswers((current) => { const next = [...current]; next[question.index] = event.target.value; return next; })}><option value="">Select an answer</option>{(question.choices || []).map((choice) => <option key={choice} value={choice}>{choice}</option>)}</select> : <><div className="clues">{(question.choices || []).map((clue) => <span key={clue}>{clue}</span>)}</div><input required value={answers[question.index] || ''} onChange={(event) => setAnswers((current) => { const next = [...current]; next[question.index] = event.target.value; return next; })} placeholder="Type your answer" /></>}</label>)}
            <button type="submit">Buzz in &amp; lock answers</button>
          </form>}
        </section>}
        {game.status === 'FINISHED' && <section className={winner ? 'victory-card' : 'question'}><p className="eyebrow">{winner ? '🎉 1ST PLACE CHAMPIONS 🎉' : `FINAL RANK: #${myRank || '—'}`}</p>{winner && <span className="champion-avatar" style={{ backgroundColor: myTeam?.color || color }}>{myTeam?.avatar || avatar}</span>}<h2>{winner ? `${myTeam?.name || teamName} Win It All!` : 'Game finished'}</h2><p>Final score: {score.toLocaleString()} points</p></section>}
        {['REVEAL', 'LEADERBOARD'].includes(game.status) && <section className="question"><h2>{game.status === 'LEADERBOARD' ? 'Live leaderboard' : 'Answers revealed'}</h2>{teams.map((team, index) => <p className="rank" key={team.id}><b>#{index + 1}</b> {team.avatar} {team.name}<strong>{Number(team.score || 0).toLocaleString()}</strong></p>)}</section>}
      </>}
      {error && <p className="error">{error}</p>}
    </main>
  );
}
