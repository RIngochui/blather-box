# Integrations

**Analysis Date:** 2026-03-27

## Databases

**SQLite via better-sqlite3:**
- File: `blatherbox.db` in project root (auto-created on first run)
- Driver: `better-sqlite3` ^12.8.0 — synchronous API, no async/await needed
- Client: `server/db.js` — raw SQL only, no ORM
- WAL mode enabled: `db.pragma('journal_mode = WAL')`
- Single table: `topics` with columns `id`, `topic`, `category`, `clues` (JSON string), `status`, `submitted_by`, `created_at`
- Seeded automatically with 10 approved topics on first run if table is empty
- All queries are pre-compiled prepared statements defined in `server/db.js` (`topicQueries` object)
- Migration: None — schema defined via `CREATE TABLE IF NOT EXISTS` in `server/db.js`

## External APIs & Services

**None** — no outbound HTTP calls to third-party APIs detected anywhere in the codebase.

**ngrok (optional, developer-operated):**
- Not a code dependency; documented in README as a manual tunneling option for cross-network play
- No ngrok SDK or client code in the project

## Authentication & Authorization

**Custom password-based admin auth:**
- Implementation: `server/routes/admin.js`
- Strategy: plaintext password comparison against `process.env.ADMIN_PASSWORD` (default: `blatheradmin`)
- Transport: `x-admin-auth` request header or `?auth=` query param
- No sessions, no JWT, no cookies — each request independently checked by `isAuthenticated()`
- No auth library used (no passport, no jsonwebtoken, no bcrypt)

**Player identity:**
- No auth at all — players identify by socket ID and a self-chosen display name
- Name uniqueness enforced per room only, in memory (`server/gameManager.js`)

## Notable Third-party Libraries

**Socket.io 4.8.3:**
- Powers the entire real-time game loop: room creation, player join/leave, round start, clue reveals, guess checking, timer ticks, score broadcasting
- Server: `server/index.js` mounts `new Server(server)` on the HTTP server
- Client: loaded from `node_modules` — no CDN; scripts served as static files from `public/`
- Events are custom (e.g. `create-room`, `join-room`, `start-game`, `clue-revealed`, `submit-guess`, `correct-guess`, `timer-tick`, `show-scores`, `game-end`)

**Express 5.x:**
- Used for three REST route groups: `/api/admin`, `/api/submit`, `/api/game`
- Also serves all static frontend assets from `public/` and explicit HTML file routes
- No view engine (no EJS/Pug/Handlebars) — raw `res.sendFile()` for HTML pages

**dotenv 17.3.1:**
- Loaded at top of `server/index.js`
- Only two env vars consumed: `PORT` and `ADMIN_PASSWORD`

---

*Integration audit: 2026-03-27*
