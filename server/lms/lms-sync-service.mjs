import crypto from 'node:crypto'
import http from 'node:http'
import https from 'node:https'

const ASSIGNMENT_KEYWORDS = ['essay', 'quiz', 'exam', 'midterm', 'final', 'project', 'discussion', 'assignment', 'homework']
const EVENT_KEYWORDS = ['lecture', 'lab', 'seminar', 'office hour', 'meeting', 'class']

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeSourceUrl(raw) {
  const value = String(raw || '').trim()
  if (!value) throw new Error('sourceUrl is required')
  const normalized = value.replace(/^webcal:\/\//i, 'https://')
  const url = new URL(normalized)
  if (url.hostname.toLowerCase() === 'localhost') {
    url.hostname = '127.0.0.1'
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only http/https or webcal links are supported.')
  }
  return url.toString()
}

function validateProviderSource(provider, sourceUrl) {
  const url = new URL(sourceUrl)
  const host = url.hostname.toLowerCase()
  if (host === 'localhost' || host === '127.0.0.1') return
  if (provider === 'canvas') {
    const ok = host.includes('instructure.com') || host.includes('canvas')
    if (!ok) throw new Error('Canvas link must come from a Canvas domain.')
  }
  if (provider === 'blackboard') {
    const ok = host.includes('blackboard') || host.includes('bbcollab') || host.includes('edu')
    if (!ok) throw new Error('Blackboard link must come from an institution Blackboard domain.')
  }
}

async function fetchIcsWithRetry(sourceUrl, { etag, lastModified } = {}) {
  const headers = { Accept: 'text/calendar,text/plain;q=0.9,*/*;q=0.8' }
  if (etag) headers['If-None-Match'] = etag
  if (lastModified) headers['If-Modified-Since'] = lastModified

  let lastError = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const textResponse = await new Promise((resolve, reject) => {
        const client = sourceUrl.startsWith('https://') ? https : http
        const req = client.request(sourceUrl, { method: 'GET', headers }, (res) => {
          const chunks = []
          res.on('data', (chunk) => chunks.push(chunk))
          res.on('end', () => {
            const status = Number(res.statusCode || 0)
            const text = Buffer.concat(chunks).toString('utf8')
            resolve({
              status,
              text,
              etag: String(res.headers.etag || ''),
              lastModified: String(res.headers['last-modified'] || '')
            })
          })
        })
        req.on('error', reject)
        req.setTimeout(8000, () => req.destroy(new Error('fetch_timeout')))
        req.end()
      })
      if (textResponse.status === 304) {
        return { notModified: true, etag: etag || '', lastModified: lastModified || '', text: '' }
      }
      if (textResponse.status < 200 || textResponse.status >= 300) {
        const error = new Error(`LMS fetch failed with status ${textResponse.status}`)
        error.code =
          textResponse.status === 401 || textResponse.status === 403 ? 'auth_or_permission_error' : 'fetch_failed'
        throw error
      }
      return {
        notModified: false,
        text: textResponse.text,
        etag: textResponse.etag,
        lastModified: textResponse.lastModified
      }
    } catch (error) {
      lastError = error
      if (attempt < 2) await delay(250 * (attempt + 1))
    }
  }
  throw lastError || new Error('Unable to fetch LMS feed.')
}

function unfoldLines(input) {
  const rawLines = String(input || '').replace(/\r\n/g, '\n').split('\n')
  const lines = []
  for (const line of rawLines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1)
    } else {
      lines.push(line)
    }
  }
  return lines
}

function parseIcsDate(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  if (/^\d{8}T\d{6}Z$/.test(raw)) {
    const yyyy = raw.slice(0, 4)
    const mm = raw.slice(4, 6)
    const dd = raw.slice(6, 8)
    const hh = raw.slice(9, 11)
    const min = raw.slice(11, 13)
    const ss = raw.slice(13, 15)
    return new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}Z`).toISOString()
  }
  if (/^\d{8}T\d{6}$/.test(raw)) {
    const yyyy = raw.slice(0, 4)
    const mm = raw.slice(4, 6)
    const dd = raw.slice(6, 8)
    const hh = raw.slice(9, 11)
    const min = raw.slice(11, 13)
    const ss = raw.slice(13, 15)
    return new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`).toISOString()
  }
  if (/^\d{8}$/.test(raw)) {
    const yyyy = raw.slice(0, 4)
    const mm = raw.slice(4, 6)
    const dd = raw.slice(6, 8)
    return new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`).toISOString()
  }
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

function parseIcsEvents(icsText) {
  const lines = unfoldLines(icsText)
  const events = []
  let current = null

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {}
      continue
    }
    if (line === 'END:VEVENT') {
      if (current) events.push(current)
      current = null
      continue
    }
    if (!current) continue

    const sep = line.indexOf(':')
    if (sep < 0) continue
    const rawKey = line.slice(0, sep)
    const value = line.slice(sep + 1)
    const key = rawKey.split(';')[0].toUpperCase()

    if (key === 'UID') current.uid = value
    if (key === 'SUMMARY') current.summary = value
    if (key === 'DESCRIPTION') current.description = value
    if (key === 'DTSTART') current.startAt = parseIcsDate(value)
    if (key === 'DTEND') current.endAt = parseIcsDate(value)
    if (key === 'DUE') current.dueAt = parseIcsDate(value)
  }

  return events.filter((event) => event.summary && (event.dueAt || event.startAt))
}

function classifySubtype(summary, description) {
  const text = `${summary || ''} ${description || ''}`.toLowerCase()
  const assignment = ASSIGNMENT_KEYWORDS.find((keyword) => text.includes(keyword))
  if (assignment) return { category: 'task', subtype: assignment }
  const event = EVENT_KEYWORDS.find((keyword) => text.includes(keyword))
  if (event) return { category: 'event', subtype: event }
  return { category: 'event', subtype: 'general' }
}

function normalizeTitle(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function buildFingerprint(item) {
  const payload = [
    item.provider,
    item.course || '',
    normalizeTitle(item.title),
    item.dueAt || item.startAt || '',
    item.category,
    item.subtype
  ].join('|')
  return crypto.createHash('sha1').update(payload).digest('hex')
}

function toCanonicalItems(provider, events, courseHint = '') {
  return events.map((event) => {
    const cls = classifySubtype(event.summary, event.description)
    const item = {
      externalId: String(event.uid || crypto.randomUUID()),
      provider,
      category: cls.category,
      subtype: cls.subtype,
      title: String(event.summary || '(untitled)').trim(),
      dueAt: cls.category === 'task' ? event.dueAt || event.startAt || null : null,
      startAt: cls.category === 'event' ? event.startAt || event.dueAt || null : null,
      endAt: cls.category === 'event' ? event.endAt || null : null,
      course: String(courseHint || '').trim(),
      weight: null,
      confidence: 0.85,
      sourceOfTruth: 'lms'
    }
    item.fingerprint = buildFingerprint(item)
    return item
  })
}

function toTask(item) {
  const priority = ['exam', 'final', 'midterm', 'project'].includes(item.subtype) ? 'High' : 'Medium'
  return {
    id: `lms-${item.fingerprint.slice(0, 12)}`,
    title: item.title,
    course: item.course || 'LMS Course',
    dueAt: item.dueAt || item.startAt || new Date().toISOString(),
    estimatedHours: ['exam', 'project', 'final'].includes(item.subtype) ? 3 : 1.5,
    priority,
    source: item.provider,
    source_of_truth: 'lms',
    subtype: item.subtype,
    fingerprint: item.fingerprint
  }
}

function toCalendarEvent(item) {
  const start = new Date(item.startAt || item.dueAt || Date.now())
  const end = item.endAt ? new Date(item.endAt) : new Date(start.getTime() + 60 * 60 * 1000)
  return {
    id: `lms-ev-${item.fingerprint.slice(0, 12)}`,
    title: item.title,
    date: start.toISOString().slice(0, 10),
    startTime: start.toISOString().slice(11, 16),
    endTime: end.toISOString().slice(11, 16),
    kind: 'class',
    source: item.provider,
    source_of_truth: 'lms',
    subtype: item.subtype,
    fingerprint: item.fingerprint
  }
}

export function createLmsSyncService({ observability } = {}) {
  const connectionStore = new Map()

  function ensureUserStore(userId) {
    if (!connectionStore.has(userId)) connectionStore.set(userId, {})
    return connectionStore.get(userId)
  }

  function getStatus(userId) {
    const store = ensureUserStore(userId)
    const status = {}
    for (const provider of ['canvas', 'blackboard']) {
      const entry = store[provider]
      status[provider] = {
        connected: Boolean(entry?.connected),
        provider,
        mode: entry?.mode || 'ics_link',
        sourceUrl: entry?.sourceUrl || '',
        courseHint: entry?.courseHint || '',
        lastSyncAt: entry?.lastSyncAt || null,
        syncStatus: entry?.syncStatus || 'idle',
        importedTasks: Number(entry?.importedTasks || 0),
        importedEvents: Number(entry?.importedEvents || 0),
        lastError: entry?.lastError || ''
      }
    }
    return status
  }

  async function connect({ userId, provider, mode = 'ics_link', sourceUrl, courseHint = '', testOnly = false }) {
    const normalizedUrl = normalizeSourceUrl(sourceUrl)
    validateProviderSource(provider, normalizedUrl)
    if (mode !== 'ics_link' && !(provider === 'canvas' && mode === 'api_token')) {
      throw new Error('Unsupported mode for provider.')
    }

    const store = ensureUserStore(userId)
    const existing = store[provider] || {}
    const next = {
      ...existing,
      connected: true,
      provider,
      mode,
      sourceUrl: normalizedUrl,
      courseHint: String(courseHint || ''),
      syncStatus: 'idle',
      lastError: ''
    }
    if (!testOnly) store[provider] = next
    return { provider: next }
  }

  async function sync({ userId, provider, force = false }) {
    const store = ensureUserStore(userId)
    const entry = store[provider]
    if (!entry?.connected || !entry?.sourceUrl) {
      const error = new Error('Provider is not connected')
      error.code = 'connect_provider_required'
      throw error
    }

    entry.syncStatus = 'syncing'
    entry.lastError = ''

    try {
      const fetched = await fetchIcsWithRetry(entry.sourceUrl, {
        etag: force ? '' : entry.etag,
        lastModified: force ? '' : entry.lastModified
      })

      if (fetched.notModified) {
        entry.syncStatus = 'idle'
        entry.lastSyncAt = new Date().toISOString()
        return {
          ok: true,
          imported: 0,
          updated: 0,
          removed: 0,
          skipped: 0,
          warnings: ['No feed changes since last sync.'],
          tasks: (entry.items || []).filter((item) => item.category === 'task' && !item.archived).map(toTask),
          events: (entry.items || []).filter((item) => item.category === 'event' && !item.archived).map(toCalendarEvent),
          conflicts: []
        }
      }

      const parsed = parseIcsEvents(fetched.text)
      const incoming = toCanonicalItems(provider, parsed, entry.courseHint)

      const previousByFp = new Map((entry.items || []).map((item) => [item.fingerprint, item]))
      const nextItems = []
      let imported = 0
      let updated = 0
      const conflicts = []

      for (const item of incoming) {
        const prev = previousByFp.get(item.fingerprint)
        if (!prev) {
          imported += 1
          nextItems.push({ ...item, archived: false, staleCount: 0 })
          continue
        }
        const changed = prev.dueAt !== item.dueAt || prev.startAt !== item.startAt || prev.title !== item.title
        if (changed) {
          updated += 1
          if ((prev.dueAt || prev.startAt) !== (item.dueAt || item.startAt)) {
            conflicts.push({
              fingerprint: item.fingerprint,
              title: item.title,
              previous: prev.dueAt || prev.startAt,
              incoming: item.dueAt || item.startAt,
              sourceOfTruth: 'lms'
            })
          }
        }
        nextItems.push({ ...prev, ...item, archived: false, staleCount: 0 })
        previousByFp.delete(item.fingerprint)
      }

      let removed = 0
      for (const stale of previousByFp.values()) {
        const staleCount = Number(stale.staleCount || 0) + 1
        const archived = staleCount >= 2
        if (archived && !stale.archived) removed += 1
        nextItems.push({ ...stale, staleCount, archived })
      }

      entry.items = nextItems
      entry.etag = fetched.etag
      entry.lastModified = fetched.lastModified
      entry.lastHash = crypto.createHash('sha1').update(fetched.text).digest('hex')
      entry.lastSyncAt = new Date().toISOString()
      entry.syncStatus = 'idle'
      entry.lastError = ''

      const activeTasks = nextItems.filter((item) => item.category === 'task' && !item.archived).map(toTask)
      const activeEvents = nextItems.filter((item) => item.category === 'event' && !item.archived).map(toCalendarEvent)
      entry.importedTasks = activeTasks.length
      entry.importedEvents = activeEvents.length

      return {
        ok: true,
        imported,
        updated,
        removed,
        skipped: 0,
        warnings: [],
        tasks: activeTasks,
        events: activeEvents,
        conflicts
      }
    } catch (error) {
      entry.syncStatus = 'error'
      entry.lastError = String(error?.code || error?.message || 'sync_failed')
      if (observability) {
        observability.incrementCounter('lms_sync_failed_total', { provider, reasonCode: entry.lastError })
      }
      throw error
    }
  }

  function disconnect({ userId, provider }) {
    const store = ensureUserStore(userId)
    if (!store[provider]) return { provider: { connected: false, provider, mode: 'ics_link' } }
    store[provider] = {
      provider,
      connected: false,
      mode: 'ics_link',
      sourceUrl: '',
      courseHint: '',
      lastSyncAt: null,
      syncStatus: 'idle',
      lastError: '',
      importedTasks: 0,
      importedEvents: 0,
      items: []
    }
    return { provider: store[provider] }
  }

  function listConnected() {
    const rows = []
    for (const [userId, providers] of connectionStore.entries()) {
      for (const provider of ['canvas', 'blackboard']) {
        if (providers[provider]?.connected) rows.push({ userId, provider })
      }
    }
    return rows
  }

  return {
    connect,
    sync,
    disconnect,
    getStatus,
    listConnected
  }
}
