import session from 'express-session'
import { RedisStore } from 'connect-redis'
import { createClient } from 'redis'

export async function createSessionMiddleware(config) {
  let store = null
  let redisClient = null

  if (config.redisUrl) {
    redisClient = createClient({
      url: config.redisUrl
    })
    redisClient.on('error', (error) => {
      console.error('[redis.session.error]', error?.message || error)
    })
    await redisClient.connect()
    store = new RedisStore({
      client: redisClient,
      prefix: 'donna:sess:'
    })
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
