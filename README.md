# Donna AI

Donna is an academic AI agent app with:
- a Vite React frontend
- a thin Express backend for auth, connectivity, and Donna action execution

## Route Map
- `/` public landing page
- `/login` auth entry (Google, Guest, Demo)
- `/dashboard` canonical app entry (guarded)
- `/overview` redirect to `/dashboard`
- `/today` redirect to `/dashboard`
- `/assignments` guarded app route
- `/calendar` guarded app route
- `/goals` guarded app route
- `/settings` guarded app route

## Local Run
```bash
npm install
npm run dev
```

- `npm run dev` now starts both frontend and backend together.
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8787`

## Donna v2 (Algorithm Sidecar)

Donna v2 adds a Python algorithm sidecar and `/api/v2/*` endpoints for hybrid scheduling:

- `POST /api/v2/syllabus/ingest`
- `POST /api/v2/plan/solve`
- `POST /api/v2/plan/feasibility`
- `POST /api/v2/plan/reoptimize`
- `POST /api/v2/notify/decision`
- `POST /api/v2/events/work`
- `GET /api/v2/metrics/benchmark`

### Local v2 dev (app + api + algo)
```bash
npm run dev:v2
```

### Full local stack (Postgres/Timescale + Redis + API + Algo + Worker)
```bash
npm run dev:stack
```

Optional one-time JSON-to-Postgres importer:
```bash
npm run migrate:legacy
```

Optional Telegram worker:
```bash
npm run worker:telegram
```

## Deploy Option 2 (Vercel Serverless API)
- Express app is now shared in [server/app.mjs](/Users/shivamarora/Documents/Code/Donna Ai/server/app.mjs).
- Local dev runner stays [server/connectivity-server.mjs](/Users/shivamarora/Documents/Code/Donna Ai/server/connectivity-server.mjs).
- Vercel API entry is [api/index.js](/Users/shivamarora/Documents/Code/Donna Ai/api/index.js) and handles all `/api/*` via `vercel.json` routes.
- Frontend uses same-origin `/api/*` in production automatically (no hardcoded `localhost:8787`).

Required Vercel env vars (Production):
- `SESSION_SECRET`
- `REDIS_URL`
- `FRONTEND_ORIGIN` (your Vercel frontend URL)
- `SERVER_BASE_URL` (your Vercel deployment URL)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GROQ_API_KEY`

## Authentication Model
Donna now uses explicit session login modes. There is no implicit auto-login local user.

Users authenticate via `/login`:
1. Continue with Google (identity-only)
2. Continue as Guest
3. Explore Demo

Backend session source of truth: `express-session` cookie on the API.
No frontend token storage is used.

## Google Setup (Identity + Calendar)
Create one Google OAuth Web Application in Google Cloud and enable Google Calendar API.

### Authorized Redirect URIs
Add both:
- `http://localhost:8787/api/auth/google/callback` (Google identity login)
- `http://localhost:8787/api/oauth/google_calendar/callback` (calendar connect in Settings)

### Environment Variables
Copy `.env.example` to `.env` and fill:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GROQ_API_KEY`
- `SESSION_SECRET`
- `REDIS_URL` (required in production)
- optional origin/port overrides

Production startup checks now fail fast if:
- `SESSION_SECRET` is missing/weak
- `FRONTEND_ORIGIN` or `SERVER_BASE_URL` are invalid URLs
- Google OAuth credentials are missing
- `REDIS_URL` is missing

## Auth/Session Endpoints
- `GET /api/auth/login` (legacy helper redirect to `/login`)
- `GET /api/auth/google/start?returnTo=...`
- `GET /api/auth/google/callback`
- `POST /api/auth/guest-login`
- `POST /api/auth/demo-login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/auth/csrf`
- `GET /api/debug/session` (dev only)

`GET /api/auth/me` includes:
- `authenticated`
- `user` (with `mode: google | guest | demo` when authenticated)
- `authStateCode` (`authenticated | unauthenticated`)
- `reasonCode`

## Calendar Connectivity (separate from identity login)
Calendar connect remains explicit in Settings.

Endpoints:
- `GET /api/connectivity/providers`
- `POST /api/connectivity/:provider/connect`
- `POST /api/connectivity/:provider/disconnect`
- `POST /api/connectivity/:provider/sync`
- `GET /api/oauth/google_calendar/callback`
- `GET /api/ops/metrics` (requires authenticated session + `x-ops-key` header and `OPS_METRICS_KEY` env)

## Donna Calendar Action Flow
Endpoints:
- `GET /api/donna/calendar/context`
- `POST /api/donna/planner`
- `GET /api/donna/planner/usage`
- `GET /api/donna/actions`
- `POST /api/donna/actions/propose-study-block`
- `POST /api/donna/actions/:id/approve`

Action lifecycle:
- `proposed`
- `approved`
- `executed`
- `failed`

Action logs are persisted in:
- `server/data/action-log.json`

Planner/rate-limit data is persisted in:
- `server/data/usage-limits.json`

## Groq Planner Free Tier + BYOK
Cloud planning now runs through backend Groq (not browser-direct OpenAI).

Free tier is available only for Google-login sessions and is enforced server-side:
- `50` requests/hour per hashed IP
- `10` requests per user in rolling 24h
- `75,000` tokens per user in rolling 7d

When free quota is exhausted, planner responses return `byok_required` and users can continue by providing their own API key in the Donna widget.

## Auth Guard Codes (frontend/backend contract)
Donna external actions use canonical machine codes:
- `login_required`
- `connect_provider_required`
- `misconfigured`
- `provider_error`
- `backend_unavailable`
- `execution_failed`
- `byok_required`
- `quota_exceeded_hourly_ip`
- `quota_exceeded_daily_user`
- `quota_exceeded_weekly_tokens`

## Security Guardrails (current)
- Redis-backed server sessions (`connect-redis`) with `httpOnly` cookie and production `secure` mode.
- CSRF protection for all state-changing `/api/*` routes using session-bound token + origin check.
- Security headers with `helmet` + explicit CSP policy.
- Sanitized API error responses (no raw upstream token/provider payloads returned to UI).
- Structured logs include request id, route, status, user mode, and reason-code counters (user IDs hashed).
- OAuth pending-state callbacks expire after 10 minutes.
- BYOK planner API keys are stored only in `sessionStorage` (not persisted in `localStorage`).

## Quick E2E Demo Check
1. Open `/login` and choose Google, Guest, or Demo.
2. For real calendar flow: in `/settings`, connect Google Calendar.
3. Verify provider status from Settings or `GET /api/connectivity/providers`.
4. Propose a study block via Donna.
5. Approve it.
6. Confirm action status becomes `executed` and event appears in Google Calendar.

## Design Assets
Design references are in `deisgn-pack/`, transformed into:
- `public/images`
- `src/fragments`

Regenerate:
```bash
npm run prepare:design
```

Screenshot diff QA:
```bash
npm run qa:screens
```
