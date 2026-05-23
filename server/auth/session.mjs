import session from 'express-session'
import { RedisStore } from 'connect-redis'
import { createClient } from 'redis'

export async function createSessionMiddleware(config) {
  let store = null
  let redisClient = null

  if (config.redisUrl) {
    try {
      redisClient = createClient({
        url: config.redisUrl,
        socket: {
          connectTimeout: 5000,
          reconnectStrategy: false
        }
      })
      redisClient.on('error', (error) => {
        console.error('[redis.session.error]', error?.message || error)
      })
      await redisClient.connect()
      store = new RedisStore({
        client: redisClient,
        prefix: 'donna:sess:'
      })
    } catch (error) {
      console.error('[redis.session.disabled]', error?.message || error)
      if (redisClient) {
        try {
          await redisClient.disconnect?.()
        } catch {
          // Client may already be closed after a failed initial connection.
        }
        try {
          redisClient.destroy?.()
        } catch {
          // Best-effort cleanup only.
        }
      }
      redisClient = null
      store = null
    }
  }

  const middleware = session({
    name: 'donna.sid',
    secret: config.sessionSecret,
    store: store || undefined,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.isProduction,
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  })

  return {
    middleware,
    close: async () => {
      if (redisClient) await redisClient.quit()
    }
  }
}
