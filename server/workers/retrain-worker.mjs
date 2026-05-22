import { createClient } from 'redis'

const redisUrl = process.env.REDIS_URL || 'redis://redis:6379'
const queueKey = process.env.RETRAIN_QUEUE_KEY || 'donna:retrain:jobs'

async function run() {
  const client = createClient({ url: redisUrl })
  client.on('error', (error) => {
    console.error('[retrain-worker.redis.error]', error?.message || error)
  })

  await client.connect()
  console.log('[retrain-worker] connected', { queueKey })

  for (;;) {
    try {
      const payload = await client.brPop(queueKey, 0)
      const raw = payload?.element || '{}'
      const job = JSON.parse(raw)
      console.log('[retrain-worker] processing', job)
      // placeholder for periodic model refresh pipelines
      await new Promise((resolve) => setTimeout(resolve, 120))
      console.log('[retrain-worker] done', { id: job?.id || 'unknown' })
    } catch (error) {
      console.error('[retrain-worker.error]', error?.message || error)
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }
}

run().catch((error) => {
  console.error('[retrain-worker.fatal]', error)
  process.exit(1)
})
