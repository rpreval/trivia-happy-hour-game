CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS games (
  code VARCHAR(8) PRIMARY KEY,
  host_name VARCHAR(64) NOT NULL,
  host_secret VARCHAR(64) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'LOBBY',
  current_round INT NOT NULL DEFAULT 1,
  current_set CHAR(1) NOT NULL DEFAULT 'A',
  difficulty VARCHAR(16) NOT NULL DEFAULT 'MEDIUM',
  selected_categories JSONB NOT NULL,
  timer_ends_at BIGINT,
  timer_paused_remaining_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_code VARCHAR(8) NOT NULL REFERENCES games(code) ON DELETE CASCADE,
  name VARCHAR(40) NOT NULL,
  color VARCHAR(16) NOT NULL,
  avatar VARCHAR(16) NOT NULL,
  session_token VARCHAR(64) NOT NULL UNIQUE,
  score INT NOT NULL DEFAULT 0,
  connected BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_team_name_per_game UNIQUE (game_code, name)
);

CREATE TABLE IF NOT EXISTS game_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_code VARCHAR(8) NOT NULL REFERENCES games(code) ON DELETE CASCADE,
  round_num INT NOT NULL,
  set_code CHAR(1) NOT NULL,
  question_index INT NOT NULL,
  q_type VARCHAR(16) NOT NULL,
  category VARCHAR(64) NOT NULL,
  prompt TEXT NOT NULL,
  choices JSONB,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  difficulty VARCHAR(16) NOT NULL,
  CONSTRAINT unique_question_slot UNIQUE (game_code, round_num, set_code, question_index)
);

CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_code VARCHAR(8) NOT NULL REFERENCES games(code) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  round_num INT NOT NULL,
  set_code CHAR(1) NOT NULL,
  answers JSONB NOT NULL,
  wager INT DEFAULT 0,
  submitted_at BIGINT NOT NULL,
  remaining_ms INT NOT NULL DEFAULT 0,
  points_awarded INT NOT NULL DEFAULT 0,
  overridden_by_host BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT unique_team_set_submission UNIQUE (game_code, team_id, round_num, set_code)
);

CREATE INDEX IF NOT EXISTS idx_teams_game ON teams(game_code);
CREATE INDEX IF NOT EXISTS idx_questions_game_round ON game_questions(game_code, round_num, set_code);
