import { PROMPTS } from '../algo/prompts.mjs'
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

  async function callJson({ apiKeyOverride = '', modelRoute = 'small', systemPrompt, userPayload }) {
    const effectiveKey = String(apiKeyOverride || '').trim() || config.groq.apiKey
    if (!effectiveKey) {
      throw new HttpError('Cloud planner key is missing. Add your API key to continue.', 400, {
        reasonCode: 'byok_required'
      })
    }

    const model = modelRoute === 'strong' ? config.groq.strongModel : config.groq.model

    const response = await fetchJson(GROQ_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${effectiveKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(userPayload) }
        ]
      })
    })

    const content = response?.choices?.[0]?.message?.content ?? ''
    const parsed = extractJson(content)
    if (!parsed) {
      throw new HttpError('LLM response was not valid JSON.', 502, { reasonCode: 'provider_error' })
    }

    return {
      data: parsed,
      model,
      usage: {
        promptTokens: toNumber(response?.usage?.prompt_tokens, 0),
        completionTokens: toNumber(response?.usage?.completion_tokens, 0),
        totalTokens: toNumber(response?.usage?.total_tokens, 0)
      }
    }
  }

  async function plan({ apiKeyOverride = '', request, route = 'small', source = 'chat' }) {
    const result = await callJson({
      apiKeyOverride,
      modelRoute: route,
      systemPrompt:
        'You are Donna AI planner. Return JSON only with keys: assistantMessage, confidence (0..1), suggestion, priorityOrder (array of priority titles), timelineUpdates (array of {time,title,detail,status}), reason.',
      userPayload: {
        source,
        request
      }
    })

    const parsed = result.data
    return {
      route,
      assistantMessage: parsed.assistantMessage || 'I optimized the plan and updated your dashboard.',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : route === 'strong' ? 0.82 : 0.7,
      suggestion: parsed.suggestion,
      priorityOrder: parsed.priorityOrder,
      timelineUpdates: parsed.timelineUpdates,
      reason: parsed.reason || `Groq ${result.model} planner`,
      usage: result.usage
    }
  }

  async function parseIntent({ apiKeyOverride = '', message, context = {}, route = 'small' }) {
    const result = await callJson({
      apiKeyOverride,
      modelRoute: route,
      systemPrompt: PROMPTS.intent,
      userPayload: {
        message,
        context
      }
    })

    return {
      ...result.data,
      route,
      usage: result.usage
    }
  }

  async function explainSchedule({ apiKeyOverride = '', route = 'small', intent = {}, schedule = {} }) {
    const result = await callJson({
      apiKeyOverride,
      modelRoute: route,
      systemPrompt: PROMPTS.explanation,
      userPayload: {
        intent,
        schedule
      }
    })

    return {
      ...result.data,
      route,
      usage: result.usage
    }
  }

  async function extractSyllabusCandidates({ apiKeyOverride = '', syllabusText = '', route = 'small', context = {} }) {
    const result = await callJson({
      apiKeyOverride,
      modelRoute: route,
      systemPrompt: PROMPTS.syllabus,
      userPayload: {
        syllabus_text: syllabusText,
        context
      }
    })

    return {
      candidates: Array.isArray(result.data?.candidates) ? result.data.candidates : [],
      route,
      usage: result.usage
    }
  }

  return {
    isConfigured,
    plan,
    parseIntent,
    explainSchedule,
    extractSyllabusCandidates
  }
}
