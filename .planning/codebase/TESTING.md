# Testing

**Analysis Date:** 2026-03-27

## Test Setup

No test infrastructure exists in this project.

- No test runner installed (no Jest, Vitest, Mocha, or similar in `package.json` dependencies or devDependencies).
- No test configuration files (`jest.config.*`, `vitest.config.*`, `.mocharc.*`).
- No test files found (no `*.test.js`, `*.spec.js`, or `__tests__/` directories).
- The `"test"` script in `package.json` is the npm default stub:
  ```json
  "test": "echo \"Error: no test specified\" && exit 1"
  ```

## Test Coverage

No automated test coverage exists. The following areas are entirely untested:

**`server/gameManager.js`** — Core game logic with no tests:
- `createRoom` / `deleteRoom` room lifecycle
- `addPlayer` / `removePlayer` player management
- `pickTopic` / `pickDescriber` selection logic
- `startRound` state transitions
- `checkGuess` matching logic (fuzzy substring matching)
- `awardPoints` scoring calculation

**`server/routes/admin.js`** — Admin API with no tests:
- Auth middleware (`requireAuth`, `isAuthenticated`)
- Status update endpoints (single and bulk)
- CRUD operations on topics

**`server/routes/submit.js`** — Submission validation with no tests:
- Required clue validation
- Topic-word-in-clue detection
- Category validation

**`server/db.js`** — Database layer with no tests:
- Schema creation
- Seed data insertion guard
- All prepared queries

**Client JS** (`public/js/*.js`) — No client-side tests of any kind.

## Testing Patterns

None established. If tests are added, the following would be natural starting points given the codebase structure:

**Most testable unit today:** `server/gameManager.js` — pure functions with no I/O except `topicQueries` calls. `checkGuess`, `awardPoints`, `generateRoomCode`, `pickDescriber` could be unit-tested without database setup.

**Integration test surface:** The Express REST routes in `server/routes/` are straightforward request/response handlers that could be tested with supertest against a test database instance.

**Socket.io testing:** The real-time game flow in `server/index.js` would require a socket.io test client (e.g., `socket.io-client` in tests) and is the most complex surface to cover.

## Test Commands

No working test command exists. Running `npm test` exits with code 1.

```bash
npm test   # Prints "Error: no test specified" and exits 1
```

To add tests, install a test runner (e.g., `npm install --save-dev jest`) and update the `"test"` script in `package.json`.
