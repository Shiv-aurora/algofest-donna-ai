import { fetchJson, HttpError } from '../lib/http.mjs'

function toIso(value, fieldName) {
  const timestamp = new Date(value)
  if (Number.isNaN(timestamp.getTime())) {
    throw new HttpError(`Invalid ${fieldName}. Expected ISO datetime string.`, 400)
  }
  return timestamp.toISOString()
}

function normalizeEvent(event = {}) {
  return {
    id: event.id,
    summary: event.summary || '',
    description: event.description || '',
    htmlLink: event.htmlLink || '',
    status: event.status || '',
    created: event.created || null,
    updated: event.updated || null,
    start: event.start || null,
    end: event.end || null
  }
}

export function createGoogleCalendarService() {
  async function listUpcomingEvents(accessToken, { timeMin, maxResults = 25 } = {}) {
    const params = new URLSearchParams({
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: String(Math.max(1, Math.min(100, Number(maxResults || 25))))
    })

    if (timeMin) {
      params.set('timeMin', toIso(timeMin, 'timeMin'))
    }

    const payload = await fetchJson(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    )

    const items = Array.isArray(payload?.items) ? payload.items : []
    return items.map((item) => normalizeEvent(item))
  }

  async function createEvent(accessToken, data) {
    const title = String(data?.title || '').trim()
    if (!title) {
      throw new HttpError('Missing event title.', 400)
    }

    const start = toIso(data?.start, 'start')
    const end = toIso(data?.end, 'end')

    const payload = {
      summary: title,
      description: String(data?.description || ''),
      start: {
        dateTime: start
      },
      end: {
        dateTime: end
      },
      extendedProperties: {
        private: {
          donna_source: String(data?.source || 'donna'),
          donna_action_id: String(data?.actionId || '')
        }
      }
    }

    const response = await fetchJson('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    return normalizeEvent(response)
  }

  return {
    listUpcomingEvents,
    createEvent
  }
}
