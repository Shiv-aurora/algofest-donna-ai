const routeStats = {
  trivial: { total: 0, clarified: 0 },
  standard: { total: 0, clarified: 0 },
  strong: { total: 0, clarified: 0 }
}

function normalizedComplexity(text = '') {
  const value = String(text || '').toLowerCase()
  if (!value) return 0.1
  const strongSignals = [
    'reorganize',
    'considering',
    'while',
    'whole week',
    'finals',
    'stress',
    'also',
    'and'
  ]
  const standardSignals = ['conflict', 'deadline', 'multiple', 'tradeoff', 'constraint', 'optimize', 'reschedule', 'shift']
  const strongHits = strongSignals.filter((token) => value.includes(token)).length
  const standardHits = standardSignals.filter((token) => value.includes(token)).length
  const commaCount = (value.match(/,/g) || []).length
  const lengthScore = Math.min(0.35, value.length / 420)
  const score = strongHits * 0.16 + standardHits * 0.08 + commaCount * 0.05 + lengthScore
  return Math.max(0, Math.min(1, score))
}

function clarifiedRate(route) {
  const stats = routeStats[route] || { total: 0, clarified: 0 }
  if (stats.total <= 0) return 0
  return stats.clarified / stats.total
}

export function chooseRoute({
  text = '',
  latencyBudgetMs = 500,
  tokenCostCents = 1,
  complexityOverride = null
}) {
  const complexity = Number.isFinite(complexityOverride)
    ? Math.max(0, Math.min(1, Number(complexityOverride)))
    : normalizedComplexity(text)

  let route = 'trivial'
  let reason = 'low_complexity'

  if (complexity >= 0.65 || latencyBudgetMs > 1200 || tokenCostCents > 6) {
    route = 'strong'
    reason = 'high_complexity'
  } else if (complexity >= 0.25 || latencyBudgetMs > 700 || tokenCostCents > 2.5) {
    route = 'standard'
    reason = 'moderate_complexity'
  }

  if (route === 'trivial' && clarifiedRate('trivial') > 0.18) {
    route = 'standard'
    reason = 'promoted_by_feedback'
  }

  return {
    route,
    reason,
    complexity
  }
}

export function recordRouteOutcome(route, clarified = false) {
  const stats = routeStats[route] || routeStats.standard
  stats.total += 1
  if (clarified) stats.clarified += 1
}
