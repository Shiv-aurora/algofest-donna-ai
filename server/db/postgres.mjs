import { Pool } from 'pg'

let pool = null
let initialized = false

const TABLE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS tasks (
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
  )`,
  `CREATE TABLE IF NOT EXISTS prereq_edges (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    from_task_id TEXT NOT NULL,
    to_task_id TEXT NOT NULL,
    confidence DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS schedule_runs (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    request JSONB NOT NULL,
    response JSONB NOT NULL,
    route TEXT NOT NULL,
    latency_ms DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS slot_assignments (
    id BIGSERIAL PRIMARY KEY,
    run_id BIGINT REFERENCES schedule_runs(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    slot_id TEXT NOT NULL,
    start_at TIMESTAMPTZ NULL,
    end_at TIMESTAMPTZ NULL,
    minutes INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS estimate_events (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    task_id TEXT NULL,
    predicted JSONB NOT NULL,
    observed_hours DOUBLE PRECISION NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS actual_work_events (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    slot_id TEXT NULL,
    actual_hours DOUBLE PRECISION NOT NULL,
    estimated_hours DOUBLE PRECISION NULL,
    completion_status TEXT NOT NULL DEFAULT 'completed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS hazard_events (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    task_id TEXT NULL,
    start_probability DOUBLE PRECISION NOT NULL,
    features JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS bandit_events (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    arm TEXT NOT NULL,
    reward INTEGER NOT NULL,
    posterior JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS router_decisions (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    route TEXT NOT NULL,
    complexity DOUBLE PRECISION NOT NULL,
    latency_budget_ms INTEGER NOT NULL,
    token_cost_cents DOUBLE PRECISION NOT NULL,
    clarified BOOLEAN NOT NULL DEFAULT FALSE,
    outcome JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS legacy_actions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    result JSONB NULL,
    error TEXT NULL,
    history JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ NULL,
    executed_at TIMESTAMPTZ NULL
  )`,
  `CREATE INDEX IF NOT EXISTS legacy_actions_user_updated_idx ON legacy_actions (user_id, updated_at DESC)`,
  `CREATE TABLE IF NOT EXISTS usage_events (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    ip_hash TEXT NOT NULL,
    tokens INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS usage_events_user_created_idx ON usage_events (user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS usage_events_ip_created_idx ON usage_events (ip_hash, created_at DESC)`
]

function shouldEnableDb(config) {
  return Boolean(String(config.postgres?.url || '').trim())
}

export async function createPostgresStore(config, observability) {
  if (!shouldEnableDb(config)) {
    return {
      enabled: false,
      async init() {},
      async query() {
        return null
      },
      async withClient(callback) {
        return callback(null)
      }
    }
  }

  if (!pool) {
    pool = new Pool({
      connectionString: config.postgres.url,
      max: 8
    })
    pool.on('error', (error) => {
      console.error('[postgres.error]', error?.message || error)
    })
  }

  async function init() {
    if (initialized) return
    const client = await pool.connect()
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS timescaledb')
    } catch {
      // Extension may be unavailable in plain postgres; continue with base tables.
    }

    for (const statement of TABLE_STATEMENTS) {
      await client.query(statement)
    }

    const hypertables = [
      'actual_work_events',
      'hazard_events',
      'bandit_events',
      'router_decisions',
      'usage_events'
    ]

    for (const table of hypertables) {
      try {
        await client.query(
          `SELECT create_hypertable($1, 'created_at', if_not_exists => TRUE, migrate_data => TRUE)`,
          [table]
        )
      } catch {
        // Fallback for non-timescale setup.
      }
    }

    initialized = true
    observability?.logEvent?.('postgres.initialized', null, { enabled: true })
    client.release()
  }

  async function query(text, values = []) {
    await init()
    return pool.query(text, values)
  }

  async function withClient(callback) {
    await init()
    const client = await pool.connect()
    try {
      return await callback(client)
    } finally {
      client.release()
    }
  }

  return {
    enabled: true,
    init,
    query,
    withClient
  }
}
