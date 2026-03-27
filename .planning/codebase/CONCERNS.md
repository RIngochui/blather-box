# Codebase Concerns

**Analysis Date:** 2026-03-27

## Technical Debt

**Admin password transmitted in every authenticated request:**
- The admin password is stored in `sessionStorage` (`public/js/admin.js` line 39: `sessionStorage.setItem('bb_admin_pass', pw)`) and then sent as a plain header (`x-admin-auth: <password>`) on every API call via `authFetch`. There is no session token or cookie-based auth — the raw password travels on every request.
- Files: `public/js/admin.js`, `server/routes/admin.js`
- Fix approach: Replace with a server-issued session token on login. Store the token, not the password.

**Admin password also accepted as a URL query param:**
- `server/routes/admin.js` line 9: `req.query.auth === ADMIN_PASSWORD`. This means the admin password will appear in server logs, browser history, and network logs if someone uses query-param auth.
- Files: `server/routes/admin.js`
- Fix approach: Remove query-param auth entirely; use header-only or cookie-based sessions.

**`CLUE_TEMPLATES` constant duplicated across modules:**
- Defined once in `server/routes/submit.js` and retrieved at runtime inside a route handler in `server/routes/game.js` via `require('./submit')`. This circular-style coupling means `CLUE_TEMPLATES` is exposed on the `submit` module's public API purely to serve `game.js`.
- Files: `server/routes/submit.js`, `server/routes/game.js`
- Fix approach: Move `CLUE_TEMPLATES` to a shared `server/constants.js` or `server/topics.js` file imported by both routes.

**`dev` script is identical to `start`:**
- `package.json` defines `"dev": "node server/index.js"` — same as `start`, no nodemon or file watching. Developers editing code must manually restart the server.
- Files: `package.json`
- Fix approach: Use `nodemon` for `dev`: `"dev": "nodemon server/index.js"`.

**In-memory game state is process-local:**
- All rooms are stored in a `Map` in `server/gameManager.js`. A server restart wipes all active game sessions with no recovery path. This is an intentional design choice for a party game, but means any deploy or crash during a game is unrecoverable.
- Files: `server/gameManager.js`

**Timer TOTAL_TIME hardcoded independently in both server and client:**
- `server/gameManager.js` line 6: `const ROUND_DURATION = 60`. `public/js/host.js` line 5: `const TOTAL_TIME = 60`. If the server value changes, the client timer display will be wrong.
- Files: `server/gameManager.js`, `public/js/host.js`
- Fix approach: Send `ROUND_DURATION` as part of the `round-start` event payload and use it on the client.

---

## Security

**Admin password logged to stdout on server start:**
- `server/index.js` line 250: `console.log(`Admin password: ${process.env.ADMIN_PASSWORD || 'blatheradmin'}`)`. This prints the password to server logs in cleartext on every startup.
- Files: `server/index.js`
- Fix approach: Remove this log line. The default password is documented in `.env.example`.

**Default admin password is `blatheradmin` (weak, documented):**
- `.env.example` ships with `ADMIN_PASSWORD=blatheradmin`. If a user deploys without creating a `.env`, the default is used. The admin panel allows deleting, editing, and approving all game content.
- Files: `.env.example`, `server/routes/admin.js` line 5
- Fix approach: Make the server refuse to start if `ADMIN_PASSWORD` is not set or equals the default in non-development environments.

**No rate limiting on any endpoint:**
- The topic submission endpoint (`POST /api/submit`) and the admin login endpoint (`POST /api/admin/login`) have no rate limiting. The login endpoint is vulnerable to password brute-force. The submit endpoint can be flooded to fill the database.
- Files: `server/routes/admin.js`, `server/routes/submit.js`
- Fix approach: Add `express-rate-limit` to both routes. The login route especially should have a strict limit (e.g., 10 attempts per 15 minutes per IP).

**No CORS configuration:**
- `server/index.js` applies no CORS headers. Socket.io's default CORS is `*` (all origins). For a local LAN game this is acceptable, but if deployed publicly with ngrok or a public server, any origin can connect and interact with Socket.io events.
- Files: `server/index.js`
- Fix approach: Configure Socket.io's `cors` option to restrict allowed origins when `NODE_ENV=production`.

**No HTTP security headers:**
- No `helmet` or equivalent middleware is used. The server returns no `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, or `Referrer-Policy` headers.
- Files: `server/index.js`
- Fix approach: Add `helmet()` as the first middleware.

**Topic submission validation does not cap field lengths on the server:**
- `server/routes/submit.js` does not validate maximum length for `topic` or `submitted_by`. The client-side `submit.js` uses `maxlength="200"` on inputs, but this is bypassable. A malicious POST could submit extremely long strings to inflate the database.
- Files: `server/routes/submit.js`
- Fix approach: Add server-side `maxlength` checks (e.g., `topic.length > 200`).

**Socket events have no input sanitization:**
- Player `name` and `guess` arrive over Socket.io with no length cap or content validation. A very long name or guess string is stored in memory and broadcast to all room members.
- Files: `server/index.js` lines 44-62, 96-123
- Fix approach: Enforce `name.length <= 30` and `guess.length <= 200` checks before processing.

---

## Performance

**`getRoomBySocket` performs a full linear scan on every socket event:**
- `server/gameManager.js` lines 44-50: iterates over every room and every player to find which room a socket belongs to. Called on `next-clue`, `submit-guess`, `next-round`, `end-game`, and `disconnect`. With many concurrent rooms, this is O(rooms × players).
- Files: `server/gameManager.js`
- Fix approach: Maintain a reverse lookup map `socketToRoom: Map<socketId, roomCode>` updated on join/leave.

**`pickTopic` fetches all approved topics from SQLite on every round start:**
- `server/gameManager.js` line 87: `topicQueries.getApproved.all()` runs a full table scan every round. The result is not cached.
- Files: `server/gameManager.js`
- Fix approach: Cache approved topics in memory (or invalidate on admin approval/rejection). A simple module-level array refreshed when the admin changes a topic status is sufficient.

**Timer tick broadcasts one Socket.io message per second per room:**
- Each active game emits `timer-tick` every second via `setInterval`. For many concurrent games this creates a high volume of socket emissions. With the current architecture (single process, in-memory) this is acceptable at small scale, but would degrade under load.
- Files: `server/index.js` lines 219-233

---

## Missing Capabilities

**No tests at all:**
- `package.json` test script exits 1 with "Error: no test specified". No test files exist anywhere in the project. Core game logic in `server/gameManager.js` (scoring, describer rotation, guess checking, topic exhaustion/reset) is entirely untested.
- Files: `package.json`, `server/gameManager.js`

**No structured logging:**
- All server output uses raw `console.log`. There is no log levels, no timestamps, no request IDs, and no error stack traces captured. Errors in Socket.io handlers are silently swallowed — the disconnect handler simply checks `if (!result) return` with no logging.
- Files: `server/index.js`, `server/gameManager.js`

**No error boundaries around database operations:**
- None of the `better-sqlite3` calls in `server/routes/admin.js` or `server/routes/submit.js` are wrapped in try/catch. A SQLite error (disk full, corrupt DB, constraint violation) will crash the request with an unhandled exception and return a 500 with a full stack trace to the client in Express 5.
- Files: `server/routes/admin.js`, `server/routes/submit.js`, `server/db.js`

**No reconnection handling for mid-game host disconnects:**
- If the host's browser refreshes or disconnects, `removePlayer` detects `hostLeft: true`, deletes the room immediately, and emits `host-left` to all players. There is no grace period or rejoin mechanism. The game is permanently destroyed.
- Files: `server/gameManager.js` lines 74-79, `server/index.js` lines 152-154

**No way for a player to rejoin after disconnect during a game in progress:**
- `addPlayer` returns `{ error: 'Game already in progress' }` if `room.state !== 'lobby'`. A player who loses Wi-Fi mid-game cannot rejoin. The reconnect logic in `public/js/play.js` line 66 attempts `join-room` on `connect`, which will fail with this error if the game has started.
- Files: `server/gameManager.js` line 55, `public/js/play.js` lines 65-67

**No admin notification for new topic submissions:**
- When a player submits a topic it silently enters `pending` state. There is no email, webhook, or in-app notification to alert the admin that a submission is waiting for review.
- Files: `server/routes/submit.js`

**No pagination on admin topic list:**
- `GET /api/admin/topics` returns all topics in a single query with no limit or offset. As the topic database grows, this becomes a large payload sent on every admin page load.
- Files: `server/routes/admin.js` lines 30-38, `server/db.js` line 164

---

## Risks

**Guess-checking algorithm is overly permissive:**
- `server/gameManager.js` lines 148-152: a guess is accepted if `g === topic || g.includes(topic) || topic.includes(g)`. The third condition (`topic.includes(g)`) means a one-word guess that is a substring of the topic word will be accepted. E.g., if the topic is "Escalator", the guess "esc" would match. Single-letter guesses are not blocked.
- Files: `server/gameManager.js`

**Room code collision is theoretically possible under load:**
- `generateRoomCode` produces 4-character codes from a 22-character alphabet (22^4 = 234,256 combinations). The collision-prevention loop in `createRoom` works correctly but under high concurrent load (many rooms), the probability of collision increases. Not a concern at party-game scale.
- Files: `server/gameManager.js` lines 8-15

**Database file sits in the project root:**
- `server/db.js` line 4: `path.join(__dirname, '..', 'blatherbox.db')` places the SQLite database at the project root. It is gitignored, but if the project is deployed with a misconfigured static file server, the `.db` file could be publicly accessible as `/blatherbox.db`.
- Files: `server/db.js`
- Fix approach: Move the database to a `data/` subdirectory that is not inside `public/`.

**`public/` directory is served as static files with no restrictions:**
- `server/index.js` line 15: `app.use(express.static(...'public'))`. All files under `public/` are world-accessible with no authentication. The admin UI at `/admin` is guarded only by a client-side login overlay — the HTML, CSS, and JS source are freely downloadable, revealing the admin API structure.
- Files: `server/index.js`
- Note: The API routes themselves do check auth, so data is protected. But the admin panel source is public.

**Describer can still advance clues after a correct guess is received:**
- When a correct guess is submitted, `clearInterval(room.timer)` is called and `endRound` sets `room.state = 'scoring'`. However, `next-clue` in `server/index.js` line 79 checks `room.state !== 'round'` before allowing advancement. This check is correct, but a race condition exists: if a `next-clue` event arrives in the same tick as `correct-guess` processing, the state may not have updated yet. Low-probability but possible.
- Files: `server/index.js` lines 77-93

---

*Concerns audit: 2026-03-27*
