# Technology Stack

**Analysis Date:** 2026-03-27

## Languages

**Primary:**
- JavaScript (CommonJS modules) - All server and client code

**Secondary:**
- HTML/CSS - Frontend templates and styles (no preprocessor)

## Runtime

**Environment:**
- Node.js v24.14.0 (confirmed from local environment)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Express 5.2.1 - HTTP server and REST API routing (`server/index.js`)
- Socket.io 4.8.3 - Real-time bidirectional WebSocket communication (`server/index.js`)

**Testing:**
- None — `"test"` script in `package.json` exits 1 with "no test specified"

**Build/Dev:**
- None — no bundler, no transpiler, no build step
- `npm start` and `npm run dev` both run `node server/index.js` directly

## Key Dependencies

**Critical:**
- `better-sqlite3` ^12.8.0 — synchronous SQLite driver; the only database (`server/db.js`)
- `socket.io` ^4.8.3 — powers all real-time game state (room creation, round events, timer ticks, guesses)
- `express` ^5.2.1 — REST endpoints for admin, topic submission, and clue templates
- `dotenv` ^17.3.1 — loads `ADMIN_PASSWORD` and `PORT` from `.env`

**Infrastructure:**
- None — no ORM, no migration tool, no queue, no cache layer

## Configuration

**Environment:**
- `.env` file loaded via `dotenv` at server startup
- `.env.example` documents two vars: `ADMIN_PASSWORD` (default: `blatheradmin`) and `PORT` (default: `3000`)
- `.env` file is present in project root (contents not read)

**Build:**
- No build config files — vanilla JS runs directly in Node.js
- No `tsconfig.json`, no `.babelrc`, no `webpack.config.*`, no `vite.config.*`
- No `.eslintrc*` or `.prettierrc*` detected

## Platform Requirements

**Development:**
- Node.js (v24 in dev environment)
- npm

**Production:**
- Any Node.js hosting environment (no container config detected)
- SQLite database file `blatherbox.db` written to project root — requires persistent local filesystem
- README documents ngrok as the recommended tunneling solution for cross-network play

---

*Stack analysis: 2026-03-27*
