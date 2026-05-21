import cors from 'cors'
import express from 'express'

const app = express()
const port = Number(process.env.CONNECTIVITY_PORT || 8787)

app.use(cors())
app.use(express.json())

const providers = {
  canvas: {
    provider: 'canvas',
    connected: false,
    lastSyncAt: null,
    status: 'idle',
    errorMessage: '',
    institutionDomain: ''
  },
  blackboard: {
    provider: 'blackboard',
    connected: false,
    lastSyncAt: null,
    status: 'idle',
    errorMessage: '',
    institutionDomain: ''
  },
  googleCalendar: {
    provider: 'googleCalendar',
    connected: false,
    lastSyncAt: null,
    status: 'idle',
    errorMessage: '',
    institutionDomain: ''
  }
}

function normalizeProvider(raw) {
  if (raw === 'google_calendar') return 'googleCalendar'
  return raw
}

function providerOr404(req, res) {
  const key = normalizeProvider(req.params.provider)
  const provider = providers[key]
  if (!provider) {
    res.status(404).json({ error: 'Unknown provider' })
    return null
  }
  return { provider }
}

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/connectivity/providers', (_req, res) => {
  res.json({ providers })
})

app.post('/api/connectivity/:provider/connect', (req, res) => {
  const resolved = providerOr404(req, res)
  if (!resolved) return

  const { provider } = resolved
  const institutionDomain = String(req.body?.institutionDomain || '').trim()

  if (provider.provider === 'blackboard' && !institutionDomain) {
    res.status(400).json({ error: 'Institution domain required for Blackboard.' })
    return
  }

  provider.connected = true
  provider.status = 'idle'
  provider.errorMessage = ''
  provider.lastSyncAt = new Date().toISOString()
  provider.institutionDomain = institutionDomain || provider.institutionDomain || ''

  res.json({ provider })
})

app.post('/api/connectivity/:provider/disconnect', (req, res) => {
  const resolved = providerOr404(req, res)
  if (!resolved) return

  const { provider } = resolved
  provider.connected = false
  provider.status = 'idle'
  provider.errorMessage = ''
  provider.lastSyncAt = null

  res.json({ provider })
})

app.post('/api/connectivity/:provider/sync', (req, res) => {
  const resolved = providerOr404(req, res)
  if (!resolved) return

  const { provider } = resolved
  if (!provider.connected) {
    res.status(400).json({ error: 'Provider is not connected.' })
    return
  }

  provider.status = 'idle'
  provider.errorMessage = ''
  provider.lastSyncAt = new Date().toISOString()

  res.json({ provider })
})

app.get('/api/oauth/:provider/callback', (req, res) => {
  const key = normalizeProvider(req.params.provider)
  const provider = providers[key]
  if (!provider) {
    res.status(404).send('Unknown provider')
    return
  }

  provider.connected = true
  provider.status = 'idle'
  provider.errorMessage = ''
  provider.lastSyncAt = new Date().toISOString()

  res.setHeader('content-type', 'text/html')
  res.send(
    '<html><body style="font-family: sans-serif; padding: 24px;">Donna connectivity successful. You can close this window.</body></html>'
  )
})

app.listen(port, () => {
  console.log(`Connectivity API listening on http://localhost:${port}`)
})
