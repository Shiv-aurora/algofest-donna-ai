# Donna AI

Donna is an academic AI agent app with a Vite frontend and a thin Express backend for connectivity/auth integrations.

## Core Routes
- `/dashboard` (canonical)
- `/overview` (redirect)
- `/today` (redirect)
- `/assignments`
- `/calendar`
- `/goals`
- `/settings`

## Local Run
```bash
npm install
npm run dev:api
npm run dev
```

Frontend defaults to `http://localhost:5173` and backend defaults to `http://localhost:8787`.

## Direct Google Calendar Integration (No Auth0)
Donna now connects Google Calendar directly using Google OAuth 2.0.

### 1) Required Google setup
1. Open Google Cloud Console.
2. Enable **Google Calendar API**.
3. Create OAuth credentials for a **Web application**.
4. Add authorized redirect URI:
   - `http://localhost:8787/api/oauth/google_calendar/callback`
5. Copy client credentials into `.env`:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`

### 2) Environment variables
Create `.env` from `.env.example` and fill values.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are required for real Google connect.
- `DONNA_DEMO_MODE=true` keeps seeded calendar behavior for demo fallback.

### 3) Connection flow (end-to-end)
1. Open Donna settings page.
2. Click `Connect` for Google Calendar.
3. Complete Google consent.
4. Callback returns to Settings with `provider/status/reason`.
5. Use `Sync Now` to validate calendar access.

### 4) What is stored where
- **Not stored in frontend localStorage**: Google OAuth tokens.
- **Stored in backend session only**: Google access/refresh tokens for the local user session.
- **Stored in `server/data/action-log.json`**: Donna action proposals/approvals/execution logs.

## API Surface (backend)
### Auth
- `GET /api/auth/login`
- `GET /api/auth/callback`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/debug/session` (dev only)

### Connectivity
- `GET /api/connectivity/providers`
- `POST /api/connectivity/:provider/connect`
- `POST /api/connectivity/:provider/disconnect`
- `POST /api/connectivity/:provider/sync`
- `GET /api/oauth/google_calendar/callback`

### Donna calendar operations
- `GET /api/donna/calendar/context`
- `GET /api/donna/actions`
- `POST /api/donna/actions/propose-study-block`
- `POST /api/donna/actions/:id/approve`

## Approval-based action lifecycle
Donna calendar actions are tracked with statuses:
- `proposed`
- `approved`
- `executed`
- `failed`

Approvals and execution outcomes are audit logged with timestamps.

## Testing the flow quickly
1. Start backend and frontend.
2. `Connect` Google Calendar from settings.
3. Verify `/api/connectivity/providers` returns `googleCalendar.connected: true`.
4. Call `GET /api/donna/calendar/context` from authenticated session.
5. Propose + approve study block:
   - `POST /api/donna/actions/propose-study-block`
   - `POST /api/donna/actions/:id/approve`
6. Confirm event appears in Google Calendar and action state becomes `executed`.

## Auth/connectivity response shape
- `GET /api/auth/me` includes:
  - `authenticated`
  - `authStateCode` (`authenticated|unauthenticated`)
  - `reasonCode`
- `GET /api/connectivity/providers` includes:
  - `stateCode`
  - `reasonCode`
  - provider objects with `reasonCode` on Google Calendar.

## Design Assets & Visual QA
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
