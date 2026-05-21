import { app, config, observability } from './app.mjs'

app.listen(config.port, () => {
  observability.logEvent('server.started', null, {
    port: config.port,
    frontendOrigin: config.frontendOrigin,
    serverBaseUrl: config.serverBaseUrl,
    redisEnabled: Boolean(config.redisUrl)
  })
  console.log(`Connectivity API listening on http://localhost:${config.port}`)
})
