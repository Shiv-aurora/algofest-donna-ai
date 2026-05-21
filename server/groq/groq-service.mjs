import { fetchJson, HttpError } from '../lib/http.mjs'

const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions'

function safeParse(value, fallback = null) {
  if (!value) return fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function extractJson(content) {
  if (!content) return null
  const trimmed = String(content).trim()
  if (!trimmed) return null

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return safeParse(trimmed, null)
  }

  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) {
    return safeParse(trimmed.slice(start, end + 1), null)
  }

  return null
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function createGroqService(config) {
  function isConfigured() {
    return Boolean(config.groq?.apiKey)
  }

  async function plan({ apiKeyOverride = '', request, route = 'small', source = 'chat' }) {
    const effectiveKey = String(apiKeyOverride || '').trim() || config.groq.apiKey
    if (!effectiveKey) {
      throw new HttpError('Cloud planner key is missing. Add your API key to continue.', 400, {
        reasonCode: 'byok_required'
      })
    }

    const model = route === 'strong' ? config.groq.strongModel : config.groq.model
    const systemPrompt =
      'You are Donna AI planner. Return JSON only with keys: assistantMessage, confidence (0..1), suggestion, priorityOrder (array of priority titles), timelineUpdates (array of {time,title,detail,status}), reason.'

    const response = await fetchJson(GROQ_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${effectiveKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Planning source: ${source}\n${JSON.stringify(request)}` }
        ]
      })
    })

    const content = response?.choices?.[0]?.message?.content ?? ''
    const parsed = extractJson(content)
    if (!parsed) {
      throw new HttpError('Planner response was not valid JSON.', 502, { reasonCode: 'provider_error' })
    }

    return {
      route,
      assistantMessage: parsed.assistantMessage || 'I optimized the plan and updated your dashboard.',
      confidence:
        typeof parsed.confidence === 'number' ? parsed.confidence : route === 'strong' ? 0.82 : 0.7,
      suggestion: parsed.suggestion,
      priorityOrder: parsed.priorityOrder,
      timelineUpdates: parsed.timelineUpdates,
      reason: parsed.reason || `Groq ${model} planner`,
      usage: {
        promptTokens: toNumber(response?.usage?.prompt_tokens, 0),
        completionTokens: toNumber(response?.usage?.completion_tokens, 0),
        totalTokens: toNumber(response?.usage?.total_tokens, 0)
      }
    }
  }

  return {
    isConfigured,
    plan
  }
}
