import express from 'express';
import http from 'http';
import crypto from 'crypto';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { pool, initDb } from './db.js';
import { generateQuestionSet } from './gemini.js';

const app = express();
const server = http.createServer(app);

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

function isOriginAllowed(origin) {
  if (!origin) return process.env.NODE_ENV !== 'production';
  const normalized = origin.replace(/\/+$/, '');
  if (allowedOrigins.includes(normalized)) return true;
  if (process.env.NODE_ENV !== 'production' && /^http:\/\/localhost:\d+$/.test(normalized)) {
    return true;
  }
  return false;
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || isOriginAllowed(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());

const wss = new WebSocketServer({
  server,
  path: '/ws',
  verifyClient: ({ origin }, done) => {
    if (isOriginAllowed(origin)) {
      return done(true);
    }
    console.warn(`Rejected unauthorized WebSocket origin: ${origin}`);
    return done(false, 403, 'Forbidden Origin');
  },
});

const MAX_TEAMS = 24;
const QUESTION_DURATION_MS = 120_000; // 2 minutes (2:00) per question
const ROUND_BASE_MCQ = [0, 100, 150, 200, 250, 300, 350, 400, 500, 0];
const ROUND_BASE_WA = [0, 200, 300, 400, 500, 600, 700, 800, 1000, 0];

const activeTimers = new Map();
const questionIndexByGame = new Map(); // Tracks 0, 1, or 2 for 1-by-1 question display

function getQuestionIndex(gameCode) {
  return questionIndexByGame.get(gameCode) ?? 0;
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 5 }, () => chars[crypto.randomInt(chars.length)]).join('');
}

function normalizeAnswer(str) {
  return String(str || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function calculateSetScore({ roundNum, questions, answers, remainingMs, wager, currentScore }) {
  if (roundNum === 9) {
    const safeWager = Math.max(0, Math.min(Number(wager) || 0, Math.max(0, currentScore)));
    const isCorrect = normalizeAnswer(answers[0]) === normalizeAnswer(questions[0]?.correct_answer);
    return isCorrect ? safeWager : -safeWager;
  }

  let base = 0;
  questions.forEach((q, idx) => {
    if (normalizeAnswer(answers[idx]) === normalizeAnswer(q.correct_answer)) {
      base += q.q_type === 'WORD_ASSOC' ? ROUND_BASE_WA[roundNum] : ROUND_BASE_MCQ[roundNum];
    }
  });
  if (base === 0) return 0;

  const speedRatio = Math.max(0, Math.min(1, remainingMs / QUESTION_DURATION_MS));
  const speedBonus = Math.round(base * 0.15 * speedRatio);
  return base + speedBonus;
}

async function buildSanitizedState(gameCode, role) {
  const { rows: games } = await pool.query('SELECT * FROM games WHERE code = $1', [gameCode]);
  if (!games.length) return null;
  const game = games[0];

  const { rows: teams } = await pool.query(
    'SELECT id, name, color, avatar, score, connected, joined_at FROM teams WHERE game_code = $1 ORDER BY score DESC, joined_at ASC',
    [gameCode]
  );

  const { rows: questions } = await pool.query(
    'SELECT * FROM game_questions WHERE game_code = $1 AND round_num = $2 AND set_code = $3 ORDER BY question_index ASC',
    [gameCode, game.current_round, game.current_set]
  );

  const { rows: submissions } = await pool.query(
    'SELECT * FROM submissions WHERE game_code = $1 AND round_num = $2 AND set_code = $3',
    [gameCode, game.current_round, game.current_set]
  );

  const revealAnswers = role === 'HOST' || ['REVEAL', 'LEADERBOARD', 'FINISHED'].includes(game.status);
  const currentQuestionIndex = Math.min(getQuestionIndex(gameCode), Math.max(0, questions.length - 1));

  return {
    game: {
      code: game.code,
      hostName: game.host_name,
      status: game.status,
      currentRound: game.current_round,
      currentSet: game.current_set,
      currentQuestionIndex,
      difficulty: game.difficulty,
      selectedCategories: game.selected_categories,
      timerEndsAt: game.timer_ends_at ? Number(game.timer_ends_at) : null,
      timerPausedRemainingMs: game.timer_paused_remaining_ms,
      serverNow: Date.now(),
    },
    teams,
    questions: questions.map((q) => ({
      id: q.id,
      index: q.question_index,
      type: q.q_type,
      category: q.category,
      prompt: q.prompt,
      choices: q.choices,
      ...(revealAnswers ? { correctAnswer: q.correct_answer, explanation: q.explanation } : {}),
    })),
    submittedTeamIds: submissions.map((s) => s.team_id),
    submissions: revealAnswers ? submissions : [],
  };
}

async function broadcastGame(gameCode) {
  for (const client of wss.clients) {
    if (client.readyState === 1 && client.gameCode === gameCode) {
      const payload = await buildSanitizedState(gameCode, client.role);
      if (payload) {
        client.send(JSON.stringify({ type: 'STATE_UPDATE', payload }));
      }
    }
  }
}

function scheduleQuestionExpiration(gameCode, delayMs) {
  if (activeTimers.has(gameCode)) {
    clearTimeout(activeTimers.get(gameCode));
  }
  const handle = setTimeout(async () => {
    activeTimers.delete(gameCode);
    await advanceOrRevealQuestion(gameCode);
  }, Math.max(0, delayMs));
  activeTimers.set(gameCode, handle);
}

async function advanceOrRevealQuestion(gameCode) {
  const { rows: games } = await pool.query('SELECT * FROM games WHERE code = $1', [gameCode]);
  if (!games.length || games[0].status !== 'QUESTION_SET') return;
  const game = games[0];

  const { rows: questions } = await pool.query(
    'SELECT id FROM game_questions WHERE game_code = $1 AND round_num = $2 AND set_code = $3 ORDER BY question_index ASC',
    [gameCode, game.current_round, game.current_set]
  );

  const curIdx = getQuestionIndex(gameCode);
  if (curIdx + 1 < questions.length) {
    const nextIdx = curIdx + 1;
    questionIndexByGame.set(gameCode, nextIdx);
    const endsAt = Date.now() + QUESTION_DURATION_MS;
    await pool.query(
      'UPDATE games SET timer_ends_at = $2, timer_paused_remaining_ms = NULL, updated_at = NOW() WHERE code = $1',
      [gameCode, endsAt]
    );
    scheduleQuestionExpiration(gameCode, QUESTION_DURATION_MS);
    await broadcastGame(gameCode);
  } else {
    await lockAndScoreSet(gameCode);
  }
}

async function lockAndScoreSet(gameCode) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: games } = await client.query('SELECT * FROM games WHERE code = $1 FOR UPDATE', [gameCode]);
    if (!games.length || games[0].status !== 'QUESTION_SET') {
      await client.query('ROLLBACK');
      return;
    }
    const game = games[0];
    const { rows: questions } = await client.query(
      'SELECT * FROM game_questions WHERE game_code = $1 AND round_num = $2 AND set_code = $3 ORDER BY question_index ASC',
      [gameCode, game.current_round, game.current_set]
    );
    const { rows: teams } = await client.query('SELECT * FROM teams WHERE game_code = $1', [gameCode]);
    const { rows: subs } = await client.query(
      'SELECT * FROM submissions WHERE game_code = $1 AND round_num = $2 AND set_code = $3',
      [gameCode, game.current_round, game.current_set]
    );

    const subByTeam = new Map(subs.map((s) => [s.team_id, s]));
    for (const team of teams) {
      const sub = subByTeam.get(team.id);
      if (!sub) continue;
      const pts = calculateSetScore({
        roundNum: game.current_round,
        questions,
        answers: sub.answers,
        remainingMs: sub.remaining_ms,
        wager: sub.wager,
        currentScore: team.score,
      });
      await client.query('UPDATE submissions SET points_awarded = $1 WHERE id = $2', [pts, sub.id]);
      await client.query('UPDATE teams SET score = GREATEST(0, score + $1) WHERE id = $2', [pts, team.id]);
    }

    await client.query(
      "UPDATE games SET status = 'REVEAL', timer_ends_at = NULL, timer_paused_remaining_ms = NULL, updated_at = NOW() WHERE code = $1",
      [gameCode]
    );
    await client.query('COMMIT');
    await broadcastGame(gameCode);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('lockAndScoreSet error:', err);
  } finally {
    client.release();
  }
}

app.get('/healthz', (_req, res) => res.status(200).json({ ok: true }));

app.post('/api/games', async (req, res) => {
  try {
    const { hostName, difficulty = 'MEDIUM', categories } = req.body;
    if (!hostName || !Array.isArray(categories) || categories.length < 8) {
      return res.status(400).json({ error: 'Host name and 8 categories are required.' });
    }
    const code = generateCode();
    const hostSecret = crypto.randomBytes(24).toString('hex');
    await pool.query(
      `INSERT INTO games (code, host_name, host_secret, difficulty, selected_categories)
       VALUES ($1, $2, $3, $4, $5)`,
      [code, hostName.trim().slice(0, 64), hostSecret, difficulty, JSON.stringify(categories)]
    );
    questionIndexByGame.set(code, 0);
    res.status(201).json({ code, hostSecret });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/games/:code/generate-set', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const { hostSecret, roundNum, setCode, category, difficulty } = req.body;
    const { rows: games } = await pool.query('SELECT * FROM games WHERE code = $1', [code]);
    if (!games.length || games[0].host_secret !== hostSecret) {
      return res.status(403).json({ error: 'Unauthorized host credentials.' });
    }
    const { rows: existing } = await pool.query('SELECT prompt FROM game_questions WHERE game_code = $1', [code]);
    const generated = await generateQuestionSet({
      category,
      difficulty: difficulty || games[0].difficulty,
      roundNum,
      setCode,
      usedPrompts: existing.map((r) => r.prompt),
    });

    for (let i = 0; i < generated.length; i++) {
      const q = generated[i];
      await pool.query(
        `INSERT INTO game_questions (game_code, round_num, set_code, question_index, q_type, category, prompt, choices, correct_answer, explanation, difficulty)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (game_code, round_num, set_code, question_index)
         DO UPDATE SET q_type=$5, category=$6, prompt=$7, choices=$8, correct_answer=$9, explanation=$10, difficulty=$11`,
        [code, roundNum, setCode, i, q.q_type, q.category, q.prompt, JSON.stringify(q.choices), q.correct_answer, q.explanation, q.difficulty]
      );
    }
    questionIndexByGame.set(code, 0);
    await broadcastGame(code);
    res.json({ ok: true, questions: generated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/games/:code/join', async (req, res) => {
  const client = await pool.connect();
  try {
    const code = req.params.code.toUpperCase();
    const { teamName, color, avatar, sessionToken } = req.body;
    await client.query('BEGIN');

    const { rows: games } = await client.query('SELECT * FROM games WHERE code = $1 FOR UPDATE', [code]);
    if (!games.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Game room not found.' });
    }

    if (sessionToken) {
      const { rows: existing } = await client.query(
        'SELECT id, game_code, name, color, avatar, score, connected FROM teams WHERE game_code = $1 AND session_token = $2',
        [code, sessionToken]
      );
      if (existing.length) {
        await client.query('UPDATE teams SET connected = TRUE WHERE id = $1', [existing[0].id]);
        await client.query('COMMIT');
        await broadcastGame(code);
        return res.json({ team: existing[0], sessionToken });
      }
    }

    const cleanName = String(teamName || '').trim().slice(0, 40);
    if (!cleanName) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Team name is required.' });
    }

    const { rows: currentTeams } = await client.query('SELECT id, name FROM teams WHERE game_code = $1', [code]);
    if (currentTeams.length >= MAX_TEAMS) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Game room is full (24-team maximum reached).' });
    }
    if (currentTeams.some((t) => t.name.toLowerCase() === cleanName.toLowerCase())) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'That team name is already taken in this game.' });
    }

    const newToken = crypto.randomBytes(24).toString('hex');
    const { rows: inserted } = await client.query(
      `INSERT INTO teams (game_code, name, color, avatar, session_token)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, game_code, name, color, avatar, score, connected`,
      [code, cleanName, color || '#E8AE58', avatar || '⚡', newToken]
    );

    await client.query('COMMIT');
    await broadcastGame(code);
    res.status(201).json({ team: inserted[0], sessionToken: newToken });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.role = 'DISPLAY';
  ws.teamId = null;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      const code = String(msg.gameCode || '').toUpperCase();

      if (msg.type === 'SUBSCRIBE') {
        ws.gameCode = code;
        ws.role = 'DISPLAY';
        ws.teamId = null;

        if (msg.role === 'HOST' && msg.hostSecret) {
          const { rows } = await pool.query('SELECT host_secret FROM games WHERE code = $1', [code]);
          if (rows.length && rows[0].host_secret === msg.hostSecret) {
            ws.role = 'HOST';
          }
        } else if (msg.role === 'TEAM' && msg.sessionToken) {
          const { rows } = await pool.query(
            'SELECT id FROM teams WHERE game_code = $1 AND session_token = $2',
            [code, msg.sessionToken]
          );
          if (rows.length) {
            ws.role = 'TEAM';
            ws.teamId = rows[0].id;
            await pool.query('UPDATE teams SET connected = TRUE WHERE id = $1', [ws.teamId]);
            await broadcastGame(code);
          } else {
            ws.send(JSON.stringify({ type: 'AUTH_ERROR', error: 'Invalid or expired team session token.' }));
          }
        }

        const initial = await buildSanitizedState(code, ws.role);
        if (initial) ws.send(JSON.stringify({ type: 'STATE_UPDATE', payload: initial }));
        return;
      }

      if (msg.type === 'TEAM_RENAME' && ws.role === 'TEAM' && ws.teamId) {
        const clean = String(msg.name || '').trim().slice(0, 40);
        if (clean) {
          await pool.query(
            `UPDATE teams SET name = $1 WHERE id = $2 AND game_code = $3
             AND EXISTS (SELECT 1 FROM games WHERE code = $3 AND status = 'LOBBY')`,
            [clean, ws.teamId, code]
          );
          await broadcastGame(code);
        }
        return;
      }

      if (msg.type === 'SUBMIT_ANSWERS' && ws.role === 'TEAM' && ws.teamId) {
        const { rows: games } = await pool.query('SELECT * FROM games WHERE code = $1', [code]);
        if (!games.length || games[0].status !== 'QUESTION_SET') return;
        const game = games[0];
        const now = Date.now();
        if (game.timer_ends_at && now > Number(game.timer_ends_at)) return;

        const remainingMs = game.timer_ends_at ? Math.max(0, Number(game.timer_ends_at) - now) : 0;
        await pool.query(
          `INSERT INTO submissions (game_code, team_id, round_num, set_code, answers, wager, submitted_at, remaining_ms)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (game_code, team_id, round_num, set_code)
           DO UPDATE SET answers = $5, wager = $6, submitted_at = $7, remaining_ms = $8`,
          [code, ws.teamId, game.current_round, game.current_set, JSON.stringify(msg.answers || []), Number(msg.wager) || 0, now, remainingMs]
        );

        await broadcastGame(code);
        return;
      }

      if (ws.role === 'HOST') {
        if (msg.type === 'START_SET') {
          questionIndexByGame.set(code, 0);
          const endsAt = Date.now() + QUESTION_DURATION_MS;
          await pool.query(
            `UPDATE games SET status = 'QUESTION_SET', current_round = $2, current_set = $3,
             timer_ends_at = $4, timer_paused_remaining_ms = NULL, updated_at = NOW() WHERE code = $1`,
            [code, msg.roundNum, msg.setCode, endsAt]
          );
          scheduleQuestionExpiration(code, QUESTION_DURATION_MS);
          await broadcastGame(code);
        } else if (msg.type === 'NEXT_QUESTION') {
          if (activeTimers.has(code)) clearTimeout(activeTimers.get(code));
          await advanceOrRevealQuestion(code);
        } else if (msg.type === 'PAUSE_TIMER') {
          const { rows } = await pool.query('SELECT timer_ends_at FROM games WHERE code = $1', [code]);
          if (rows[0]?.timer_ends_at) {
            if (activeTimers.has(code)) clearTimeout(activeTimers.get(code));
            const rem = Math.max(0, Number(rows[0].timer_ends_at) - Date.now());
            await pool.query(
              'UPDATE games SET timer_ends_at = NULL, timer_paused_remaining_ms = $2 WHERE code = $1',
              [code, rem]
            );
            await broadcastGame(code);
          }
        } else if (msg.type === 'RESUME_TIMER') {
          const { rows } = await pool.query('SELECT timer_paused_remaining_ms FROM games WHERE code = $1', [code]);
          const rem = rows[0]?.timer_paused_remaining_ms;
          if (rem != null) {
            const endsAt = Date.now() + Number(rem);
            await pool.query(
              'UPDATE games SET timer_ends_at = $2, timer_paused_remaining_ms = NULL WHERE code = $1',
              [code, endsAt]
            );
            scheduleQuestionExpiration(code, Number(rem));
            await broadcastGame(code);
          }
        } else if (msg.type === 'FORCE_REVEAL') {
          if (activeTimers.has(code)) clearTimeout(activeTimers.get(code));
          await lockAndScoreSet(code);
        } else if (msg.type === 'SET_STATUS') {
          await pool.query('UPDATE games SET status = $2, updated_at = NOW() WHERE code = $1', [code, msg.status]);
          await broadcastGame(code);
        } else if (msg.type === 'ADJUST_SCORE') {
          await pool.query(
            'UPDATE teams SET score = GREATEST(0, score + $1) WHERE id = $2 AND game_code = $3',
            [Number(msg.delta) || 0, msg.teamId, code]
          );
          await broadcastGame(code);
        }
      }
    } catch (err) {
      console.error('WS message error:', err);
    }
  });

  ws.on('close', async () => {
    if (ws.role === 'TEAM' && ws.teamId && ws.gameCode) {
      await pool.query('UPDATE teams SET connected = FALSE WHERE id = $1', [ws.teamId]);
      await broadcastGame(ws
