# Directory Structure

**Analysis Date:** 2026-03-27

## Root Layout

```
blather-box/
├── server/             # Node.js server — Express, Socket.io, game logic, DB
│   ├── routes/         # Express route handlers
│   ├── index.js        # Server entry point
│   ├── gameManager.js  # In-memory game state and logic
│   └── db.js           # SQLite setup, seed data, prepared statements
├── public/             # Static files served directly by Express
│   ├── js/             # Client-side JavaScript (one file per page)
│   ├── css/            # Stylesheets (one file per page/context)
│   ├── index.html      # Home / landing page
│   ├── host.html       # Host / TV screen
│   ├── join.html       # Player join screen
│   ├── play.html       # Player game screen (phone)
│   ├── submit.html     # Topic submission form
│   └── admin.html      # Admin moderation dashboard
├── .planning/          # GSD planning documents (not served)
│   └── codebase/
├── blatherbox.db       # SQLite database file (created on first run)
├── blatherbox.db-shm   # SQLite WAL shared memory (auto-generated)
├── blatherbox.db-wal   # SQLite WAL log (auto-generated)
├── package.json
├── package-lock.json
├── .env                # Environment config (not committed)
├── .env.example        # Example env file
├── .gitignore
└── README.md
```

## Key Modules

**`server/`**
All server-side code. CommonJS modules (`require`/`module.exports`). No transpilation.
- `index.js` — application bootstrap, middleware setup, Socket.io event handlers, `beginRound()` and `sendScores()` helpers
- `gameManager.js` — pure functions operating on the `rooms` Map; owns the `ROUND_DURATION` constant (60s)
- `db.js` — database singleton, schema creation, seed data, all prepared statements in `topicQueries` object

**`server/routes/`**
Three route files, each an Express Router exported via `module.exports`:
- `admin.js` — password-gated CRUD for topic moderation (`/api/admin/*`)
- `submit.js` — open topic submission with validation; also exports `CLUE_TEMPLATES` constant (`/api/submit`)
- `game.js` — utility endpoint that re-exports `CLUE_TEMPLATES` as JSON (`/api/game/clue-templates`)

**`public/js/`**
One JavaScript file per HTML page. No bundler. Each file is loaded with `<script src="...">` at the bottom of its HTML. All files share a consistent pattern: declare `const socket = io()`, define DOM element references, register socket event listeners, register UI event listeners, define render/helper functions at the bottom.
- `host.js` — 261 lines; host/TV screen logic
- `play.js` — 264 lines; player phone screen logic
- `admin.js` — 347 lines; admin dashboard logic (no socket, REST only)
- `submit.js` — 152 lines; topic submission form
- `join.js` — 58 lines; join flow only, redirects to `/play` on success

**`public/css/`**
One CSS file per context. No preprocessor, no utility framework.
- `main.css` — shared variables (CSS custom properties), base styles, used by all pages
- `host.css` — TV/host screen styles
- `phone.css` — mobile player screen styles
- `admin.css` — admin dashboard styles

## Entry Points

| Entry point | Path | How invoked |
|---|---|---|
| Server start | `server/index.js` | `node server/index.js` (via `npm start` or `npm run dev`) |
| Home page | `public/index.html` | `GET /` |
| Host screen | `public/host.html` | `GET /host` |
| Join screen | `public/join.html` | `GET /join` |
| Player game screen | `public/play.html` | `GET /play` (redirect from join) |
| Topic submission | `public/submit.html` | `GET /submit` |
| Admin panel | `public/admin.html` | `GET /admin` |

## Configuration Files

| File | Purpose |
|---|---|
| `package.json` | npm metadata, `start`/`dev` scripts (both run `node server/index.js`), dependencies |
| `.env` | Runtime secrets — `PORT`, `ADMIN_PASSWORD`. Read by `dotenv` at server startup. Never committed. |
| `.env.example` | Template showing required env vars (no values) |
| `.gitignore` | Excludes `node_modules/`, `.env`, and SQLite db files |

**Required environment variables:**
- `PORT` — HTTP listen port (defaults to `3000`)
- `ADMIN_PASSWORD` — plain-text password for admin routes (defaults to `'blatheradmin'`)

## Naming Conventions

**Files:**
- Server modules: lowercase, no separator (`db.js`, `gameManager.js`)
- Route files: lowercase matching the URL segment they handle (`admin.js`, `submit.js`, `game.js`)
- Client JS: lowercase matching the HTML page they belong to (`host.js`, `play.js`, `admin.js`)
- HTML pages: lowercase single-word (`host.html`, `play.html`, `submit.html`)
- CSS files: lowercase matching scope (`main.css`, `host.css`, `phone.css`, `admin.css`)

**Database:**
- File: `blatherbox.db` at project root
- Table: `topics` (single table, snake_case column names)

## Where to Add New Code

**New server-side game event:**
- Add socket event handler in `server/index.js` (in the `io.on('connection')` block)
- Add supporting game logic as a new exported function in `server/gameManager.js`

**New REST API endpoint:**
- Add to the appropriate existing route file in `server/routes/`, or create a new `server/routes/[name].js` and mount it in `server/index.js` with `app.use('/api/[name]', require('./routes/[name]'))`

**New page:**
- Add `public/[name].html`, `public/js/[name].js`, optionally `public/css/[name].css`
- Mount the page route in `server/index.js`: `app.get('/[name]', (req, res) => res.sendFile(...))`

**New database query:**
- Add a prepared statement to the `topicQueries` object in `server/db.js`
- All queries must use `db.prepare()` (synchronous, `better-sqlite3` API)

**Schema changes:**
- Modify the `db.exec(CREATE TABLE IF NOT EXISTS ...)` block in `server/db.js`
- Note: there is no migration system — existing databases will not be altered automatically

---

*Structure analysis: 2026-03-27*
