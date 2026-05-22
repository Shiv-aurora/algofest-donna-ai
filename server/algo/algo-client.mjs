import { HttpError, fetchJson } from '../lib/http.mjs'

function withTimeout(ms = 1500) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort('algo_timeout'), Math.max(100, ms))
  return { controller, timeout }
}

export function createAlgoClient(config) {
  const baseUrl = String(config.algo?.baseUrl || '').trim()
  const timeoutMs = Number(config.algo?.timeoutMs || 1500)

  function isConfigured() {
    return Boolean(baseUrl)
  }

  async function request(path, payload = null, options = {}) {
    if (!baseUrl) {
      throw new HttpError('Algo sidecar is not configured.', 503, { reasonCode: 'algo_unavailable' })
    }

    const method = payload ? 'POST' : 'GET'
    const { controller, timeout } = withTimeout(options.timeoutMs || timeoutMs)

    try {
      return await fetchJson(`${baseUrl}${path}`, {
        method,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json'
        },
        body: payload ? JSON.stringify(payload) : undefined
      })
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new HttpError('Algo sidecar timed out.', 504, { reasonCode: 'algo_timeout' })
      }
      if (error instanceof HttpError) throw error
      throw new HttpError('Algo sidecar request failed.', 503, {
        reasonCode: 'algo_unavailable',
        cause: String(error?.message || '')
      })
    } finally {
      clearTimeout(timeout)
    }
  }

  return {
    isConfigured,
    health: () => request('/health'),
    ingestSyllabus: (payload) => request('/v1/syllabus/ingest', payload),
    estimateQuantiles: (payload) => request('/v1/estimate/quantiles', payload),
    solveSchedule: (payload) => request('/v1/schedule/solve', payload),
    feasibility: (payload) => request('/v1/schedule/feasibility', payload),
    reoptimize: (payload) => request('/v1/schedule/reoptimize', payload),
    survival: (payload) => request('/v1/survival/predict', payload),
    notifyDecision: (payload) => request('/v1/notify/decision', payload),
    forecast: (payload) => request('/v1/forecast/workload', payload),
    energyPredict: (payload) => request('/v1/energy/predict', payload),
    energyUpdate: (payload) => request('/v1/energy/update', payload),
    routerDecision: (payload) => request('/v1/router/decision', payload),
    routerOutcome: (payload) => request('/v1/router/outcome', payload),
    benchmarkMetrics: () => request('/v1/metrics/benchmark', null, { timeoutMs: 20000 })
  }
}
