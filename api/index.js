let appPromise = null

function getApp() {
  if (!appPromise) {
    appPromise = import('../server/app.mjs')
      .then((mod) => mod.app)
      .catch((err) => {
        console.error('[donna/api] Failed to initialize app:', err?.message || err)
        appPromise = null
        throw err
      })
  }
  return appPromise
}

export default async function handler(req, res) {
  try {
    const app = await getApp()
    return app(req, res)
  } catch (err) {
    console.error('[donna/api] Handler error:', err?.message || err)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Server initialization failed.', detail: err?.message || 'unknown' })
    }
  }
}
