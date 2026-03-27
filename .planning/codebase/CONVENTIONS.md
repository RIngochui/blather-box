# Code Conventions

**Analysis Date:** 2026-03-27

## Language & Style

**Language:** Vanilla JavaScript (ES2020+), CommonJS on the server, plain ES modules in the browser (no bundler).

**Formatting:**
- No linter or formatter config present (no `.eslintrc`, no `.prettierrc`, no `biome.json` in project root).
- Indentation: 2 spaces throughout all files.
- Single quotes for strings in server code; template literals used freely for interpolation.
- Semicolons present consistently.
- Trailing comma on multi-line object/array literals.

**Module system:**
- Server: CommonJS (`require` / `module.exports`). See `server/index.js`, `server/gameManager.js`, `server/db.js`.
- Client: Plain `<script>` tags in HTML, no import/export. All client code is global-scoped per page.

## Naming Conventions

**Files:**
- All lowercase with no separator: `gameManager.js`, `admin.js`, `submit.js`.
- Route files match the URL path segment they serve: `server/routes/admin.js` → `/api/admin`, `server/routes/game.js` → `/api/game`.

**Variables and functions:**
- `camelCase` throughout — variables, functions, parameters, object keys.
- Boolean-ish flags named with verb prefix: `hostLeft`, `iAmGuesser`, `iAmDescriber`.
- Constants in `SCREAMING_SNAKE_CASE`: `ROUND_DURATION`, `TOTAL_TIME`, `CATEGORIES`, `CLUE_TEMPLATES`, `ADMIN_PASSWORD`.

**Socket event names:**
- `kebab-case` strings: `'create-room'`, `'join-room'`, `'round-start'`, `'clue-revealed'`, `'correct-guess'`, `'game-end'`.
- Pattern: `noun-verb` or `noun-event`.

**DOM element variables:**
- Named after their `id` converted to `camelCase`: `roomCodeVal` for `#room-code-val`, `nextClueBtn` for `#next-clue-btn`.
- Group-level const blocks at the top of each client file labelled with section banner comments.

**CSS classes:**
- `kebab-case`: `player-chip`, `clue-dot`, `score-row`, `btn-green`, `badge-pending`.
- State modifier classes suffixed or prefixed descriptively: `hidden`, `active`, `revealed`, `editing`, `urgent`.

## Patterns & Idioms

**Section banner comments:**
Every file is divided into named sections with a consistent ASCII banner:
```js
// ── Section Name ─────────────────────────────────────────────────────────────
```
Used in all server and client files to separate: init, socket events, UI actions, helpers, routes, etc.

**Error-object returns (server):**
Functions in `server/gameManager.js` return `{ error: 'message' }` on failure and a result object on success. Callers check `result.error` before proceeding:
```js
const result = gm.addPlayer(upperCode, socket.id, name);
if (result.error) {
  socket.emit('join-error', { message: result.error });
  return;
}
```

**Early return / guard clauses:**
Validation failures return early rather than nesting:
```js
if (!room || room.hostSocketId !== socket.id) return;
if (room.players.length < 2) {
  socket.emit('game-error', { message: 'Need at least 2 players to start.' });
  return;
}
```

**Async patterns (client):**
Client code uses `async/await` with `try/catch` for all `fetch` calls. No `.then()` chains in application code (only in the top-level template-fetch in `submit.js` which is a minor inconsistency):
```js
// Standard pattern used in admin.js and submit.js:
try {
  const res = await fetch('/api/...', { ... });
  const data = await res.json();
  if (!res.ok) { showError(data.error); return; }
  // success path
} catch (err) {
  showError('Network error — please try again.');
}
```
Exception: `public/js/submit.js` uses `.then()` for the initial template load (line 6–8) — inconsistent with the rest.

**DOM rendering helpers:**
Each client page defines local `render*` functions that clear a container and rebuild it from data. No virtual DOM or templating library. innerHTML is set directly on container elements.

**XSS escaping:**
Every client file defines a local `esc()` function that HTML-escapes strings before inserting into innerHTML. Consistent across `host.js`, `play.js`, `admin.js`, `submit.js`:
```js
function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
```
`admin.js` also escapes `"` with `&quot;` for use in HTML attribute values.

**State machine pattern (server rooms):**
Room state is tracked as a string enum on the room object: `'lobby' | 'round' | 'scoring' | 'ended'`. Guards check `room.state` before allowing transitions.

**Prepared statements (database):**
All SQL is defined as named prepared statements on `topicQueries` in `server/db.js` at module load time. No inline SQL string construction elsewhere.

**SessionStorage for cross-page state:**
Client pages pass state between page navigations via `sessionStorage` with `bb_` prefixed keys: `bb_code`, `bb_name`, `bb_socket`, `bb_admin_pass`.

## Comments & Documentation

**Inline comments:** Used liberally to explain non-obvious logic. Written as short prose on the line above or at end-of-line:
```js
const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // skip I and O
// Rotate through players so everyone gets a turn
// Accept if guess contains the topic word or vice versa (handles "the X" etc.)
```

**Section banners:** Every significant logical grouping has a banner comment (see Patterns section above). This is the primary navigation structure within files.

**No JSDoc:** No `@param`, `@returns`, or `@typedef` annotations anywhere in the codebase.

**TODOs/FIXMEs:** None in project source files (only in `node_modules`).

**Inline HTML in JS:** Template literal HTML strings in `admin.js` and `host.js` are not commented; structure is intended to be self-evident from class names and data attributes.
