import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL, buildJoinInviteUrl } from './config';
import { useGameSocket } from './App';

const ALL_CATEGORIES = [
  'Florida History',
  'World History',
  'American History',
  'Sports',
  'Music',
  'Music Albums',
  'Movies',
  'Pop Culture',
  'Art and Famous Artists',
  'Geography',
  'Science and Technology',
  'Television',
  'Famous People',
  'Food and Culture',
  'Random Fun Facts',
  'Mystery Categories',
];

const HOST_STORAGE_KEY = 'thh_host_session_v1';

export default function HostView() {
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(HOST_STORAGE_KEY) || 'null');
    } catch {
      return null;
    }
  });

  const [hostName, setHostName] = useState('');
  const [difficulty, setDifficulty] = useState('MEDIUM');
  const [selectedCategories, setSelectedCategories] = useState(ALL_CATEGORIES.slice(0, 8));
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const [targetRound, setTargetRound] = useState(1);
  const [targetSet, setTargetSet] = useState('A');
  const [generatingSet, setGeneratingSet] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());

  const { state, connected, clockOffsetMs, send } = useGameSocket({
    gameCode: session?.gameCode,
    role: 'HOST',
    hostSecret: session?.hostSecret,
  });

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (state?.game) {
      setTargetRound(state.game.currentRound);
      setTargetSet(state.game.currentSet);
    }
  }, [state?.game?.currentRound, state?.game?.currentSet]);

  const remainingSeconds = useMemo(() => {
    if (!state?.game) return 120;
    if (state.game.timerPausedRemainingMs != null) {
      return Math.ceil(state.game.timerPausedRemainingMs / 1000);
    }
    if (!state.game.timerEndsAt) return 120;
    const syncedNow = nowMs + clockOffsetMs;
    return Math.max(0, Math.ceil((state.game.timerEndsAt - syncedNow) / 1000));
  }, [state?.game, nowMs, clockOffsetMs]);

  function toggleCategory(cat) {
    setSelectedCategories((prev) => {
      if (prev.includes(cat)) return prev.filter((c) => c !== cat);
      if (prev.length >= 8) return prev;
      return [...prev, cat];
    });
  }

  async function handleCreateGame(e) {
    e.preventDefault();
    if (!hostName.trim() || selectedCategories.length !== 8) {
      setError('Enter your host name and select exactly 8 categories.');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/games`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostName: hostName.trim(),
          difficulty,
          categories: selectedCategories,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create game room.');

      const nextSession = { gameCode: data.code, hostSecret: data.hostSecret };
      localStorage.setItem(HOST_STORAGE_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleGenerateQuestions(roundNum, setCode) {
    if (!session) return;
    setGeneratingSet(true);
    setError('');

    try {
      const cats = state?.game?.selectedCategories || selectedCategories;
      const category =
        roundNum === 9
          ? 'Championship Final Wager Mix'
          : cats[(roundNum - 1) % cats.length] || 'Random Fun Facts';

      const res = await fetch(`${API_BASE_URL}/api/games/${session.gameCode}/generate-set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostSecret: session.hostSecret,
          roundNum,
          setCode,
          category,
          difficulty: state?.game?.difficulty || difficulty,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Question generation failed.');
    } catch (err) {
      setError(err.message);
    } finally {
      setGeneratingSet(false);
    }
  }

  function handleResetSession() {
    localStorage.removeItem(HOST_STORAGE_KEY);
    setSession(null);
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
        <div className="max-w-4xl mx-auto space-y-6">
          <header className="border-b border-slate-800 pb-4">
            <p className="text-xs uppercase tracking-widest text-amber-400 font-semibold">
              Host Control Center
            </p>
            <h1 className="text-3xl font-extrabold tracking-tight mt-1">
              Trivia Happy Hour — Create Live Show
            </h1>
          </header>

          {error && (
            <div className="bg-rose-950/70 border border-rose-500/50 text-rose-200 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleCreateGame} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Host Name (Shown on TV Display)
                </label>
                <input
                  type="text"
                  maxLength={64}
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  placeholder="e.g., Alex Morgan"
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-4 py-2.5 text-white focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Base Game Difficulty
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-4 py-2.5 text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="EASY">Easy (Casual Happy Hour)</option>
                  <option value="MEDIUM">Medium (Standard Broadcast)</option>
                  <option value="HARD">Hard (Tournament Edition)</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-300">
                  Select 8 Round Categories ({selectedCategories.length}/8 selected)
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedCategories(
                      [...ALL_CATEGORIES].sort(() => Math.random() - 0.5).slice(0, 8)
                    )
                  }
                  className="text-xs text-amber-400 hover:underline"
                >
                  Randomize 8
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {ALL_CATEGORIES.map((cat) => {
                  const idx = selectedCategories.indexOf(cat);
                  const active = idx !== -1;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={`text-left px-3 py-2.5 rounded-lg border text-xs font-semibold transition ${
                        active
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {active ? `R${idx + 1}: ` : ''}
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={creating || selectedCategories.length !== 8 || !hostName.trim()}
              className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-extrabold text-base tracking-wide transition"
            >
              {creating ? 'Creating Live Room...' : 'Launch Broadcast Room'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const game = state?.game;
  const teams = state?.teams || [];
  const questions = state?.questions || [];
  const submissions = state?.submissions || [];
  const submittedSet = new Set(state?.submittedTeamIds || []);
  const inviteUrl = buildJoinInviteUrl(session.gameCode);
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(inviteUrl)}`;

  const activeCategory =
    targetRound === 9
      ? 'Round 9 — Final Championship Wager'
      : game?.selectedCategories?.[targetRound - 1] || `Round ${targetRound}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
                {connected ? 'Live WebSocket Connected' : 'Reconnecting...'}
              </span>
            </div>
            <h1 className="text-2xl font-black mt-1">
              Room Code: <span className="text-amber-400 font-mono">{session.gameCode}</span>
              <span className="ml-3 text-sm font-normal text-slate-400">
                Host: {game?.hostName || hostName}
              </span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/display?code=${session.gameCode}`}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold"
            >
              Open TV Display (/display)
            </a>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(inviteUrl);
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2000);
              }}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold"
            >
              {copiedLink ? 'Copied Join URL!' : 'Copy Team Join URL'}
            </button>
            <button
              type="button"
              onClick={handleResetSession}
              className="px-3 py-2 rounded-lg bg-rose-950/60 hover:bg-rose-900/70 text-rose-300 text-xs font-semibold"
            >
              End Session
            </button>
          </div>
        </header>

        {error && (
          <div className="bg-rose-950/70 border border-rose-500/50 text-rose-200 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm uppercase tracking-wider text-slate-400 font-bold">
                Stage & 2:00 Timer Control
              </h2>
              <span className="px-2.5 py-1 rounded-md bg-slate-800 text-amber-300 font-mono text-xs font-bold">
                {game?.status || 'LOBBY'}
              </span>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-center">
              <div className="text-xs text-slate-400 uppercase tracking-widest">
                Synchronized Question Clock
              </div>
              <div className="text-4xl font-mono font-black text-amber-400 mt-1">
                {Math.floor(remainingSeconds / 60)}:
                {String(remainingSeconds % 60).padStart(2, '0')}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {submittedSet.size} of {teams.length} teams locked in
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Round (1–9)</label>
                <select
                  value={targetRound}
                  onChange={(e) => {
                    const r = Number(e.target.value);
                    setTargetRound(r);
                    if (r === 9) setTargetSet('F');
                    else if (targetSet === 'F') setTargetSet('A');
                  }}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((r) => (
                    <option key={r} value={r}>
                      Round {r} — {game?.selectedCategories?.[r - 1] || ''}
                    </option>
                  ))}
                  <option value={9}>Round 9 — Final Wager</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Question Set</label>
                <select
                  value={targetSet}
                  onChange={(e) => setTargetSet(e.target.value)}
                  disabled={targetRound === 9}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm disabled:opacity-50"
                >
                  {targetRound === 9 ? (
                    <option value="F">Final Wager Question</option>
                  ) : (
                    <>
                      <option value="A">Set A (Q1–Q3)</option>
                      <option value="B">Set B (Q4–Q6)</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
              Active Category: <strong>{activeCategory}</strong>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                disabled={generatingSet}
                onClick={() => handleGenerateQuestions(targetRound, targetSet)}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-bold text-sm"
              >
                {generatingSet
                  ? 'Generating Questions...'
                  : `Generate / Refresh Set ${targetSet} Questions`}
              </button>

              <button
                type="button"
                onClick={() => send({ type: 'SET_STATUS', status: 'ROUND_INTRO' })}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold text-sm"
              >
                Show Round Intro Card on TV
              </button>

              <button
                type="button"
                disabled={questions.length === 0}
                onClick={() => send({ type: 'START_SET', roundNum: targetRound, setCode: targetSet })}
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black text-sm"
              >
                Launch Set {targetSet} & Start 2:00 Timer
              </button>

              <button
                type="button"
                disabled={game?.status !== 'QUESTION_SET'}
                onClick={() => send({ type: 'NEXT_QUESTION' })}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-sm"
              >
                Next Question (Q{(game?.currentQuestionIndex ?? 0) + 1} of {questions.length || 3} →)
              </button>

              <div className="grid grid-cols-2 gap-2">
                {game?.timerPausedRemainingMs != null ? (
                  <button
                    type="button"
                    onClick={() => send({ type: 'RESUME_TIMER' })}
                    className="py-2 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs"
                  >
                    Resume Timer
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={game?.status !== 'QUESTION_SET'}
                    onClick={() => send({ type: 'PAUSE_TIMER' })}
                    className="py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 font-semibold text-xs"
                  >
                    Pause Timer
                  </button>
                )}

                <button
                  type="button"
                  disabled={game?.status !== 'QUESTION_SET'}
                  onClick={() => send({ type: 'FORCE_REVEAL' })}
                  className="py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 font-bold text-xs"
                >
                  Lock & Reveal Answers
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => send({ type: 'SET_STATUS', status: 'LEADERBOARD' })}
                  className="py-2 rounded-lg bg-slate-800 hover:bg-slate-700 font-semibold text-xs"
                >
                  Show Leaderboard
                </button>
                <button
                  type="button"
                  onClick={() => send({ type: 'SET_STATUS', status: 'FINISHED' })}
                  className="py-2 rounded-lg bg-amber-600/30 border border-amber-500/40 hover:bg-amber-600/40 text-amber-200 font-semibold text-xs"
                >
                  Crown Final Winner
                </button>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-4 flex items-center gap-4">
              <img
                src={qrImageUrl}
                alt="Scan to join game"
                className="w-20 h-20 rounded-lg bg-white p-1 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-300">Mobile Join QR</p>
                <p className="text-[11px] text-slate-400 break-all mt-1">{inviteUrl}</p>
              </div>
            </div>
          </section>

          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm uppercase tracking-wider text-slate-400 font-bold">
              Host Answer Key & Live Submissions
            </h2>

            {questions.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">
                No questions loaded for Round {targetRound} Set {targetSet} yet. Click{' '}
                <strong>Generate / Refresh Set</strong> to populate questions.
              </p>
            ) : (
              <div className="space-y-3">
                {questions.map((q, idx) => (
                  <div
                    key={q.id || idx}
                    className={`bg-slate-950 border rounded-xl p-3.5 space-y-1.5 ${
                      game?.status === 'QUESTION_SET' && (game?.currentQuestionIndex ?? 0) === idx
                        ? 'border-amber-400'
                        : 'border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-bold text-amber-400">
                        Q{idx + 1} · {q.type === 'WORD_ASSOC' ? 'Word Association' : 'Multiple Choice'}
                      </span>
                      <span>{q.category}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-100">{q.prompt}</p>
                    {Array.isArray(q.choices) && (
                      <p className="text-xs text-slate-400">
                        {q.type === 'WORD_ASSOC' ? 'Clues: ' : 'Options: '}
                        {q.choices.join(' • ')}
                      </p>
                    )}
                    <p className="text-xs font-bold text-emerald-400">
                      Answer: {q.correctAnswer}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {submissions.length > 0 && (
              <div className="border-t border-slate-800 pt-4 space-y-2">
                <h3 className="text-xs uppercase tracking-wider text-slate-400 font-bold">
                  Submitted Responses ({submissions.length})
                </h3>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {submissions.map((sub) => {
                    const team = teams.find((t) => t.id === sub.team_id);
                    return (
                      <div
                        key={sub.id}
                        className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs"
                      >
                        <div className="flex justify-between font-bold">
                          <span>{team?.name || 'Team'}</span>
                          <span className="text-emerald-400">+{sub.points_awarded} pts</span>
                        </div>
                        <div className="text-slate-400 mt-1">
                          Answers: {(sub.answers || []).join(' | ')}
                          {sub.wager > 0 ? ` (Wager: ${sub.wager})` : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm uppercase tracking-wider text-slate-400 font-bold">
                Teams ({teams.length}/24)
              </h2>
              <span className="text-xs text-slate-500">Live Scoreboard & Overrides</span>
            </div>

            {teams.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">
                Waiting for teams to scan the QR code or join at <code>/join</code>...
              </p>
            ) : (
              <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
                {teams.map((team, rank) => {
                  const lockedIn = submittedSet.has(team.id);
                  return (
                    <div
                      key={team.id}
                      className="flex items-center justify-between gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xs font-mono text-slate-500 w-5">#{rank + 1}</span>
                        <span
                          className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0"
                          style={{ backgroundColor: team.color }}
                        >
                          {team.avatar}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-sm truncate">{team.name}</span>
                            <span
                              title={team.connected ? 'Online' : 'Disconnected'}
                              className={`h-2 w-2 rounded-full shrink-0 ${
                                team.connected ? 'bg-emerald-400' : 'bg-slate-600'
                              }`}
                            />
                            {lockedIn && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                                BUZZED
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-mono text-amber-400 font-bold">
                            {team.score.toLocaleString()} pts
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => send({ type: 'ADJUST_SCORE', teamId: team.id, delta: -100 })}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-rose-900/60 text-xs font-mono"
                          title="Subtract 100 pts"
                        >
                          -100
                        </button>
                        <button
                          type="button"
                          onClick={() => send({ type: 'ADJUST_SCORE', teamId: team.id, delta: 100 })}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-emerald-900/60 text-xs font-mono"
                          title="Award 100 pts"
                        >
                          +100
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
