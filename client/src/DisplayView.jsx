import React from 'react';

export default function DisplayView({ useGameSocket }) {
  const code = new URLSearchParams(window.location.search).get('code')?.toUpperCase() || '';
  const { state, connected } = useGameSocket({ gameCode: code, role: 'DISPLAY' });
  if (!code) return <main className="panel"><h1>Trivia Happy Hour</h1><p>Add a room code to the URL, e.g. <code>/display?code=ABCDE</code>.</p></main>;
  if (!state) return <main className="panel"><h1>Room {code}</h1><p>{connected ? 'Loading game…' : 'Connecting…'}</p></main>;
  const { game } = state;
  return <main className="panel wide display"><p className="eyebrow">TRIVIA HAPPY HOUR · ROOM {game.code}</p>
    <h1>{game.status === 'LOBBY' ? 'Get ready to play!' : game.status.replaceAll('_', ' ')}</h1>
    {game.status === 'QUESTION_SET' && <><p className="status">Round {game.currentRound} · Set {game.currentSet}</p>
      {state.questions.map((q) => <article className="question" key={q.id}><p className="eyebrow">{q.category} · {q.type}</p><h2>{q.prompt}</h2>
        {q.choices?.map((choice) => <span className="choice" key={choice}>{choice}</span>)}</article>)}</>}
    {['REVEAL', 'LEADERBOARD', 'FINISHED'].includes(game.status) && state.questions.map((q) => <article className="question" key={q.id}><p>{q.prompt}</p><strong>Answer: {q.correctAnswer}</strong>{q.explanation && <p>{q.explanation}</p>}</article>)}
    <section><h2>Leaderboard</h2>{state.teams.map((team, i) => <p className="rank" key={team.id}><b>#{i + 1}</b> {team.avatar} {team.name}<strong>{team.score}</strong></p>)}</section>
  </main>;
}
