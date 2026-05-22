import fs from 'node:fs'
import path from 'node:path'

import { Pool } from 'pg'

const postgresUrl = process.env.POSTGRES_URL
if (!postgresUrl) {
  console.error('POSTGRES_URL is required')
  process.exit(1)
}

const pool = new Pool({ connectionString: postgresUrl })

function readJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

async function main() {
  const root = process.cwd()
  const actionLog = readJson(path.join(root, 'server/data/action-log.json'), [])
  const usageLog = readJson(path.join(root, 'server/data/usage-limits.json'), { userEvents: {}, ipEvents: {} })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    for (const action of Array.isArray(actionLog) ? actionLog : []) {
      const userId = String(action.userId || 'legacy|unknown')
      const response = {
        action,
        source: 'legacy_action_log'
      }
      const request = {
        title: action.payload?.title,
        start: action.payload?.start,
        end: action.payload?.end
      }

      await client.query(
        `INSERT INTO schedule_runs (user_id, request, response, route, latency_ms, created_at)
         VALUES ($1,$2::jsonb,$3::jsonb,$4,$5,$6)
         ON CONFLICT DO NOTHING`,
        [
          userId,
          JSON.stringify(request),
          JSON.stringify(response),
          'legacy_import',
          0,
          action.createdAt || new Date().toISOString()
        ]
      )
    }

    for (const [userId, events] of Object.entries(usageLog?.userEvents || {})) {
      for (const entry of Array.isArray(events) ? events : []) {
        const createdAt = Number(entry?.at || Date.now())
        const tokens = Number(entry?.tokens || 0)
        await client.query(
          `INSERT INTO estimate_events (user_id, task_id, predicted, observed_hours, created_at)
           VALUES ($1,$2,$3::jsonb,$4,$5)`,
          [
            String(userId),
            null,
            JSON.stringify({ source: 'legacy_usage', tokens }),
            null,
            new Date(createdAt).toISOString()
          ]
        )
      }
    }

    await client.query('COMMIT')
    console.log('Legacy import complete')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  await pool.end()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
