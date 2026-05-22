CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  task_type TEXT NOT NULL,
  course_id TEXT NOT NULL,
  deadline TIMESTAMPTZ NULL,
  weight DOUBLE PRECISION NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS prereq_edges (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  from_task_id TEXT NOT NULL,
  to_task_id TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS schedule_runs (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  request JSONB NOT NULL,
  response JSONB NOT NULL,
  route TEXT NOT NULL,
  latency_ms DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS slot_assignments (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT REFERENCES schedule_runs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  slot_id TEXT NOT NULL,
  start_at TIMESTAMPTZ NULL,
  end_at TIMESTAMPTZ NULL,
  minutes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS estimate_events (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  task_id TEXT NULL,
  predicted JSONB NOT NULL,
  observed_hours DOUBLE PRECISION NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS actual_work_events (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  slot_id TEXT NULL,
  actual_hours DOUBLE PRECISION NOT NULL,
  estimated_hours DOUBLE PRECISION NULL,
  completion_status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hazard_events (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  task_id TEXT NULL,
  start_probability DOUBLE PRECISION NOT NULL,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bandit_events (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  arm TEXT NOT NULL,
  reward INTEGER NOT NULL,
  posterior JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS router_decisions (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  route TEXT NOT NULL,
  complexity DOUBLE PRECISION NOT NULL,
  latency_budget_ms INTEGER NOT NULL,
  token_cost_cents DOUBLE PRECISION NOT NULL,
  clarified BOOLEAN NOT NULL DEFAULT FALSE,
  outcome JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT create_hypertable('actual_work_events', 'created_at', if_not_exists => TRUE, migrate_data => TRUE);
SELECT create_hypertable('hazard_events', 'created_at', if_not_exists => TRUE, migrate_data => TRUE);
SELECT create_hypertable('bandit_events', 'created_at', if_not_exists => TRUE, migrate_data => TRUE);
SELECT create_hypertable('router_decisions', 'created_at', if_not_exists => TRUE, migrate_data => TRUE);
