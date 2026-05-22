const MAX_EVENTS_PER_KEY = 200

const historyByKey = new Map()

function keyOf(userId, taskType) {
  return `${String(userId || 'anonymous')}::${String(taskType || 'assignment').toLowerCase()}`
}

export function appendWorkEvent({
  userId,
  taskType,
  courseId = 'general',
  actualHours,
  features = {}
}) {
  const key = keyOf(userId, taskType)
  const list = historyByKey.get(key) || []
  list.push({
    user_id: String(userId || 'anonymous'),
    task_type: String(taskType || 'assignment'),
    course_id: String(courseId || 'general'),
    hours: Number(actualHours || 0),
    features: {
      word_count: Number(features.word_count || 0),
      page_count: Number(features.page_count || 0),
      prior_similar_hours: Number(features.prior_similar_hours || 0),
      day_of_week: Number(features.day_of_week || 0),
      hours_slept_proxy: Number(features.hours_slept_proxy || 7),
      course_difficulty_index: Number(features.course_difficulty_index || 0)
    }
  })
  if (list.length > MAX_EVENTS_PER_KEY) {
    list.splice(0, list.length - MAX_EVENTS_PER_KEY)
  }
  historyByKey.set(key, list)
}

export function getWorkHistory(userId, taskType) {
  const key = keyOf(userId, taskType)
  return [...(historyByKey.get(key) || [])]
}
