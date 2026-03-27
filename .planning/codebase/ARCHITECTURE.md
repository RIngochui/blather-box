# Architecture

**Analysis Date:** 2026-03-27

## System Overview

BlatherBox is a real-time multiplayer party game inspired by "Blather Round". Players join a shared room via room code, take turns as the describer (who gives structured clue completions without saying the topic word), and the rest try to guess the topic within 60 seconds. Topics are community-submitted and moderated through an admin panel before entering the game pool.

## Architectural Pattern

**Single-process Node.js monolith with event-driven real-time layer.**

The server is a single Express + Socket.io process. All game state is held in-memory during a session. Persistent data (topics/clues) lives in a local SQLite database. The frontend is server-rendered static HTML pages — no build step, no framework, no bundler.

Key characteristics:
- No framework on the client — vanilla JS, DOM manipulation, `fetch`, `socket.io` client CDN
- One database table (`topics`); all game state is transient RAM
- Each "view" is a separate HTML file with a paired JS file; there is no SPA router
- The server acts as both the HTTP server (static files + REST API) and the WebSocket server

## Data Flow

**Game flow (Socket.io):**

1. Host opens `/host`, connects socket, emits `create-room` → server calls `gameManager.createRoom()`, stores room in `Map`, emits `room-created` with 4-letter code
2. Players open `/join`, emit `join-room` → server calls `gameManager.addPlayer()`, emits `join-success` → client stores code/name in `sessionStorage`, redirects to `/play`
3. `/play` reconnects socket and re-emits `join-room` on every `connect` event (handles refreshes)
4. Host emits `start-game` → server calls `gameManager.startRound()` → picks a random approved topic from SQLite, picks describer by round-robin, starts a 60s `setInterval` countdown
5. Server emits `round-start` with role-differentiated payloads:
   - Describer: receives topic word + all clues
   - Guessers: receive only category + describer name
   - Host view: receives topic, describer name, first clue, round number
6. Server broadcasts `clue-revealed` to the full room as clues advance
7. Players emit `submit-guess` → server fuzzy-matches against topic → on correct guess, awards points, clears timer, emits `correct-guess` then `show-scores` after 1.5s delay
8. On timeout, timer fires `round-end` then `show-scores` after 1.5s
9. Host emits `next-round` or `end-game` to continue or terminate

**Topic submission flow (HTTP REST):**

1. User fills `/submit` form → `public/js/submit.js` fetches `/api/game/clue-templates` to get category-specific prompts
2. On submit, `POST /api/submit` → `server/routes/submit.js` validates, checks no topic word appears in clues, inserts into SQLite with `status = 'pending'`
3. Admin logs into `/admin` → `public/js/admin.js` uses `x-admin-auth` header with password on every request
4. Admin approves/rejects via `PATCH /api/admin/topics/:id/status` → approved topics become available to `gameManager.pickTopic()`

**State Management:**

- **In-memory (server):** All active rooms are stored in a `Map` in `server/gameManager.js`. Keys are 4-letter room codes. Each room object contains: player list, current topic, clue index, describer socket ID, timer reference, used topic IDs (Set), and state machine value (`lobby | round | scoring | ended`).
- **SessionStorage (client):** After joining, `join.js` writes `bb_code`, `bb_name`, `bb_socket` to `sessionStorage`. `play.js` reads these on load and uses them to rejoin on reconnect.
- **Database:** SQLite file at `blatherbox.db` (project root). A single `topics` table. `clues` column stores a JSON array as TEXT. No migrations system — table is created with `CREATE TABLE IF NOT EXISTS` on every startup.

## Key Components

**`server/index.js`** — Entry point and Socket.io event hub
- Mounts Express middleware and all route modules
- Defines all Socket.io event handlers (`create-room`, `join-room`, `start-game`, `next-clue`, `submit-guess`, `next-round`, `end-game`, `disconnect`)
- Contains `beginRound()` helper that orchestrates round start: calls `gameManager.startRound()`, sends role-differentiated `round-start` events, starts the countdown timer
- Contains `sendScores()` helper that sorts players and emits `show-scores`
- Owns the server-side timer (`setInterval`) — NOT the gameManager

**`server/gameManager.js`** — In-memory game state
- Owns the `rooms` Map; exposes pure functions for mutating it
- `createRoom(hostSocketId)` → generates unique 4-letter code, initialises room object
- `addPlayer(code, socketId, name)` → validates state is `lobby`, prevents duplicate names
- `pickTopic(room)` → queries SQLite for approved topics, filters out `usedTopicIds`, resets if exhausted
- `pickDescriber(room)` → round-robin by `currentRound % players.length`
- `startRound(room)` → coordinates topic/describer selection, advances state to `round`
- `checkGuess(room, guess)` → fuzzy match: `g === topic || g.includes(topic) || topic.includes(g)` (case-insensitive)
- `awardPoints(room, guesserSocketId)` → guesser points scale from 10 down to 5 based on clues revealed; describer always gets flat 5
- `removePlayer(socketId)` → handles both host and player disconnects

**`server/db.js`** — Database layer
- Initialises SQLite with WAL mode via `better-sqlite3`
- Seeds 10 approved topics if database is empty
- Exposes prepared statement objects grouped as `topicQueries` (getAll, getByStatus, getById, getApproved, insert, updateStatus, update, delete, getStats)
- `parseTopicClues(topic)` — JSON.parse helper for clues column

**`server/routes/admin.js`** — Admin REST API
- Password auth via `x-admin-auth` header or `?auth=` query param (compared in plain text against `ADMIN_PASSWORD` env var)
- CRUD for topics: list (with status filter), update status (single + bulk), edit, delete
- No session tokens — password is sent on every request

**`server/routes/submit.js`** — Topic submission API
- Defines `CLUE_TEMPLATES` — per-category clue sentence starters with `required` flags
- `POST /` validates: required clues filled, topic word not present in any clue response
- Inserts with `status = 'pending'`

**`server/routes/game.js`** — Minimal game utility API
- `GET /clue-templates` — returns `CLUE_TEMPLATES` from `submit.js` (used by both submission form and admin edit form)

**`public/js/host.js`** — Host / TV screen client
- Manages 5 screens: `create`, `lobby`, `round`, `scores`, `gameover`
- Drives SVG countdown arc animation from `timer-tick` events
- Sends `start-game`, `next-clue`, `next-round`, `end-game` socket events

**`public/js/play.js`** — Player / phone client
- Manages 5 screens: `lobby-wait`, `describer`, `guesser`, `round-end`, `gameover`
- Rejoins room on every socket `connect` event (handles reconnects)
- Maintains local `myScore` counter, reconciled against server on `show-scores`

**`public/js/join.js`** — Join screen
- Emits `join-room`, on success writes to `sessionStorage` and redirects to `/play`

**`public/js/submit.js`** — Topic submission form
- Fetches clue templates on load, dynamically renders input fields per category
- Client-side validation mirrors server-side: required clues, topic word detection

**`public/js/admin.js`** — Admin dashboard
- Inline edit UX: injects `<tr>` after target row
- Bulk approve/reject via checkbox selection
- Auth password stored in `sessionStorage` after login; sent as `x-admin-auth` header

## Error Handling

- Socket errors: emitted back to the originating socket as `game-error` or `join-error` events; client shows `alert()`
- REST errors: standard HTTP status codes with `{ error: "message" }` JSON body
- No global error middleware; no uncaught exception handlers
- Database errors from `better-sqlite3` are unhandled (will crash the process)

---

*Architecture analysis: 2026-03-27*
