import { fetchJson } from '../lib/http.mjs'

const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim()
const apiBase = String(process.env.TELEGRAM_API_BASE || 'https://api.telegram.org').trim()
const algoBase = String(process.env.ALGO_SERVICE_BASE_URL || 'http://localhost:8090').trim()

if (!token) {
  console.error('[telegram] TELEGRAM_BOT_TOKEN is required')
  process.exit(1)
}

let offset = 0

async function callTelegram(method, payload = {}) {
  return fetchJson(`${apiBase}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
}

function buildDefaultSolveRequest() {
  const now = new Date()
  const slots = []
  for (let i = 0; i < 18; i += 1) {
    const start = new Date(now.getTime() + i * 60 * 60 * 1000)
    start.setMinutes(0, 0, 0)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    slots.push({ id: `slot-${i}`, start: start.toISOString(), end: end.toISOString(), blocked: false })
  }

  return {
    tasks: [
      {
        id: 'tg-reading',
        title: 'Reading sprint',
        task_type: 'reading',
        course_id: 'general',
        deadline: new Date(now.getTime() + 24 * 3600 * 1000).toISOString(),
        p75_hours: 1.5,
        urgency: 1.1,
        energy_profile: 'reading',
        prereq_ids: []
      }
    ],
    slots,
    blocked_slot_ids: [],
    latency_budget_ms: 500,
    preferences: { no_saturday_work: false, grace_hours: 1 }
  }
}

async function replyPlan(chatId, text) {
  let message = 'Donna could not compute a plan right now.'

  try {
    const result = await fetchJson(`${algoBase}/v1/schedule/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildDefaultSolveRequest())
    })
    const first = result?.assignments?.[0]
    if (first) {
      message = `Donna scheduled ${result.assignments.length} blocks. First block starts at ${new Date(first.start).toLocaleString()}.`
    }
  } catch {
    message = 'Planner unavailable; try again in a minute.'
  }

  await callTelegram('sendMessage', {
    chat_id: chatId,
    text: `${text}\n\n${message}`
  })
}

async function pollLoop() {
  for (;;) {
    try {
      const updates = await callTelegram('getUpdates', {
        timeout: 30,
        offset,
        allowed_updates: ['message']
      })
      for (const update of updates.result || []) {
        offset = Number(update.update_id || offset) + 1
        const msg = update?.message
        const chatId = msg?.chat?.id
        if (!chatId) continue
        const text = String(msg.text || 'Plan update request')
        await replyPlan(chatId, `Request: ${text}`)
      }
    } catch (error) {
      console.error('[telegram.poll.error]', error?.message || error)
      await new Promise((resolve) => setTimeout(resolve, 1500))
    }
  }
}

pollLoop().catch((error) => {
  console.error('[telegram.fatal]', error)
  process.exit(1)
})
