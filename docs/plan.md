# Implementation Plan

## Phase 1 — Backend: Project Setup, API & Data Layer

This phase delivers a fully working backend with all API endpoints verified by automated tests (Vitest + Supertest). The frontend is not in scope for this phase beyond a minimal stub to confirm Express serves static files.

---

### 1.1 Project Scaffolding

- [x] Initialize root `package.json` with `npm init`
- [x] Create folder structure:
  ```
  /server
    /routes
    /repositories
    /services
    /middleware
    /utils
    /db
    server.js          # Express entry point
  /client              # Vue app (Vite scaffold in Phase 2)
  /data
    names.json         # Robot name list
  /docs
    spec.md
    plan.md
    findings-decisions-actions.md
  .env.example
  .gitignore
  .nvmrc
  ```
- [x] Create `.env.example` with `PORT`, `NODE_ENV`, `DATABASE_PATH`, `ALLOWED_ORIGINS`
- [x] Create `.env` (gitignored) with development values
- [x] Create `.gitignore` (node_modules, .env, \*.db, dist/)
- [x] Create `.nvmrc` with Node LTS version
- [x] Install backend dependencies: `express`, `better-sqlite3`, `helmet`, `cors`, `dotenv`
- [x] Install dev dependencies: `vitest`, `supertest`, `eslint`, `prettier`, `eslint-plugin-vue`, `eslint-config-prettier`, `globals`
- [x] Create `eslint.config.js` (ESLint v10 flat config, covers /server and /client)
- [x] Create `.prettierrc`
- [x] Create `.vscode/settings.json` (format on save, ESLint fix on save)
- [x] Create `.vscode/extensions.json` (Vue.volar, prettier, eslint, vitest)
- [x] Add `lint`, `lint:fix`, `format` scripts to root `package.json`

### 1.2 Express Server Setup

- [x] Create `server/server.js` — entry point
  - Load dotenv
  - Import and apply middleware: helmet, cors, express.json()
  - Mount API router at `/api/v1`
  - Add catch-all for serving `index.html` in production
  - Add global error handler middleware
  - Start listening on `PORT`
  - Console log: server started, port, environment
- [x] Create `server/middleware/errorHandler.js` — consistent error response format
- [x] Create `server/routes/index.js` — main router, mounts simulation routes
- [x] Add `dev:server` script to `package.json` (e.g., `node server/server.js` or with `--watch` flag)
- [x] Verify: `npm run dev:server` starts Express, hitting `/api/v1` returns a placeholder response

### 1.3 Database Setup

- [x] Create `server/db/connection.js`
  - Opens (or creates) SQLite database at `DATABASE_PATH`
  - Enables WAL mode for better concurrent read performance
  - Exports the database instance
  - Logs connection success/failure
- [x] Create `server/db/schema.js`
  - `initializeDatabase()` function that creates all 4 tables if not exists
  - `users`, `simulations`, `robots`, `houses` — per spec schema
  - Create indexes: `robots(simulation_id)`, `houses(simulation_id)` per spec §3.2
  - Seeds default user (id=1, name="default") if not exists
  - Called on server startup
- [x] Verify: server starts, `data/robots.db` is created with correct tables, default user is seeded

### 1.4 Robot Naming System

- [x] Create `data/names.json` — array of 20 names (Robbie, Jane, Bob + 17 common names)
- [x] Create `server/utils/robotNames.js`
  - `assignRobotNames(count)` — returns array of names for the given robot count
  - Cycles through the 20 names with `_2`, `_3` suffixes for counts > 20
  - Unit testable as a pure function
- [x] Write tests: `server/utils/robotNames.test.js`
  - 1 robot → ["Robbie"]
  - 3 robots → ["Robbie", "Jane", "Bob"]
  - 20 robots → all 20 names
  - 21 robots → 20 names + "Robbie_2"
  - 40 robots → full cycle + full cycle with \_2
  - 41 robots → starts \_3 cycle

### 1.5 Repository Layer

All database operations as named functions. Each function takes the db instance and relevant parameters. All queries use parameterized statements.

- [x] Create `server/repositories/simulationRepository.js`
  - `createSimulation(db, { userId, moveSequence, robotCount })` → returns simulation row
  - `getSimulation(db, simulationId)` → returns simulation or null
  - `listSimulations(db, userId)` → returns array of simulations
  - `updateSimulationStep(db, simulationId, newStep, newStatus)` → updates current_step and status
- [x] Create `server/repositories/robotRepository.js`
  - `createRobots(db, simulationId, robotNames)` → bulk inserts robots at (0,0)
  - `getRobotsBySimulation(db, simulationId)` → returns all robots for a simulation
  - `getRobotByTurnOrder(db, simulationId, turnOrder)` → returns single robot
  - `updateRobotPosition(db, robotId, x, y)` → updates position
  - `countRobotsAtPosition(db, simulationId, x, y)` → returns count of robots at a coordinate
    - **Important:** This check must happen **before** the moving robot's position is updated in the DB. The query asks "is any other robot already at this destination?" If count > 0, delivery is blocked. If we checked after the move, we'd need count > 1 (since the moving robot would already be counted), which is more error-prone.
- [x] Create `server/repositories/houseRepository.js`
  - `deliverPresent(db, simulationId, x, y)` → INSERT or UPDATE presents_count (upsert)
  - `getTotalPresents(db, simulationId)` → SUM(presents_count)
  - `countHousesWithMinPresents(db, simulationId, minPresents)` → COUNT where presents_count >= N
  - `getHousesBySimulation(db, simulationId)` → returns all houses (for future grid display)
- [x] Write repository tests (using in-memory SQLite for speed):
  - Simulation CRUD operations
  - Robot creation and position updates
  - House upsert logic (first delivery creates row with presents_count=1)
  - House upsert logic (second delivery to same house increments presents_count to 2)
  - Derived value queries (total presents, houses by threshold)
  - Houses query with minPresents higher than any house has → returns 0
  - Total presents on simulation with no steps taken → returns 0
  - Simulation isolation — operations on sim 1 don't affect sim 2 data

### 1.6 Simulation Engine (Step Logic)

- [x] Create `server/services/simulationService.js`
  - `stepSimulation(db, simulationId)` — core step logic:
    1. Get simulation, validate not completed
    2. Determine which robot's turn: `current_step % robot_count`
    3. Read direction from `move_sequence[current_step]`
    4. Calculate new position from direction
    5. Check if any other robot is already at the new position (before moving)
    6. Move the robot (update position)
    7. If destination was clear (step 5): deliver present (upsert house row)
    8. Increment `current_step`, update status ('running' or 'completed')
    9. Return turn result object with message
  - `runSimulation(db, simulationId)` — loops `stepSimulation` until complete
  - All DB operations wrapped in a transaction for atomicity
- [x] Write service tests:
  - Single robot, single move — delivers present
  - Two robots, same destination — second robot blocked
  - Robot moves back to origin (0,0) — should deliver (entering the space)
  - Robot count > move count — some robots never move, remain at origin
  - Move sequence length not divisible by robot count — last robots get fewer turns
  - Step a 'created' simulation — status transitions to 'running'
  - Run a partially stepped ('running') simulation — finishes from current step
  - Full simulation run — verify final positions and present counts
  - Step a completed simulation — returns error
  - Run a completed simulation — returns error
  - The example from the requirements: 3 robots, "^^VV<>" — verify each step

### 1.7 Input Validation & Sanitization

- [x] Create `server/middleware/validate.js`
  - `validateCreateSimulation` — checks robotCount (integer, >= 1) and moveSequence (non-empty, valid chars only); normalizes moveSequence with `.toUpperCase()` and strips control characters; writes cleaned value back to `req.body.moveSequence`
  - `validateSimulationId` — checks :id param is a positive integer (>= 1); writes parsed value to `req.simulationId` (renamed from `validateStepOrRun` — applies to all 6 :id routes, not just step/run)
  - `validateHouseQuery` — checks minPresents query param (integer, >= 1, required); writes parsed value to `req.minPresents`
  - Strip control characters (0x00–0x1F, 0x7F) from string inputs
  - Parameterized queries handle SQL injection (built into repository layer)
- [x] Write validation tests:
  - Valid inputs pass through and call next()
  - moveSequence normalized: lowercase 'v' → 'V', written back to req.body
  - Missing moveSequence → 400
  - moveSequence = null → 400
  - moveSequence whitespace-only → 400 (fails valid-chars regex)
  - Invalid characters in moveSequence → 400
  - robotCount = 0 → 400
  - robotCount = -1 → 400
  - robotCount = "abc" → 400
  - robotCount = 1.5 (float) → 400
  - robotCount = null → 400
  - Simulation ID = "abc" → 400
  - Simulation ID = 0 → 400
  - Simulation ID = -5 → 400
  - minPresents missing → 400
  - minPresents = 0 → 400
  - minPresents = 1.5 → 400 (decimal string fails integer pattern)

### 1.8 Route Handlers

Wire up all 8 endpoints per spec. Each handler: validates input, calls service/repository, formats response, handles errors with try/catch and logging.

- [x] `POST /api/v1/simulations` — create simulation
- [x] `POST /api/v1/simulations/:id/step` — step one turn
- [x] `POST /api/v1/simulations/:id/run` — run full simulation
- [x] `GET /api/v1/simulations` — list all simulations
- [x] `GET /api/v1/simulations/:id` — get simulation details
- [x] `GET /api/v1/simulations/:id/robots` — get robot positions
- [x] `GET /api/v1/simulations/:id/houses?minPresents=N` — count houses by threshold
- [x] `GET /api/v1/simulations/:id/presents` — get total presents
- [x] Add auth pseudocode comments on each route handler (where middleware would go)

### 1.9 API Integration Tests (Supertest) & Curl Reference

Automated API tests cover the full HTTP request → route → service → repository → DB flow. Manual curl testing is unnecessary as it is slower and more error-prone than the automated suite. A curl examples file is maintained as human-readable API documentation for the README "Things to try out" section and quick reference.

- [x] Install `supertest` as dev dependency
- [x] Create API integration tests (`server/routes/simulations.test.js` or similar):
  - **Happy path — full workflow:**
    - Create simulation → 201, response shape matches spec
    - Step through turns → 200, turn object with correct robot/direction/delivery
    - Query robots → 200, positions match expected state
    - Query houses → 200, correct count for various minPresents thresholds
    - Query presents → 200, correct total
    - Run full simulation → 200, final state matches expected
    - List simulations → 200, returns all created simulations
    - Get simulation details → 200, combines metadata + robots + summary
  - **Error cases:**
    - 404 for non-existent simulation ID on all :id endpoints
    - 409 for stepping a completed simulation
    - 409 for running a completed simulation
    - 400 for all validation failures (covered in 1.7 but verified at HTTP level)
  - **Response shape verification:**
    - All responses have correct Content-Type: application/json
    - Response JSON field names and nesting match spec exactly
    - Error responses follow the `{ error: { code, message } }` shape
  - **Edge cases at API level:**
    - Create simulation with robotCount omitted → defaults to 1
    - GET houses with minPresents higher than any house → returns houseCount: 0
    - GET presents on fresh simulation (no steps) → returns totalPresents: 0
- [x] Create `docs/curl-examples.md` — curl commands for each endpoint with example responses, for use as human-readable API reference and README content
- [x] Verify logging output is informative but contains no sensitive data

### 1.10 Phase 1 Checkpoint Review

- [x] All 8 endpoints working
- [x] All automated tests passing: unit (names, repositories, services, validation) and integration (Supertest API tests)
- [x] Error handling: every failure path returns consistent error JSON, logs the issue, nothing fails silently
- [x] Code review: JSDoc on all exported functions, consistent formatting
- [x] Spec accuracy check: do the actual API responses match what spec.md describes?
- [x] Verify lint toolchain works end-to-end: `npm run lint` runs without config errors, fix any missing dependencies (e.g. `@eslint/js`)
- [x] Run `npm run format` across entire codebase — no unformatted files
- [x] Run `npm run lint` across entire codebase — no warnings or errors
- [x] Verify dev server starts cleanly: `npm run dev:server` produces expected console output with no warnings
- [x] Verify all npm scripts work: `test`, `test:watch`, `lint`, `lint:fix`, `format`, `dev:server`

---

_Phases 2+ (Frontend UI, CSS grid visualization, polish, Docker, final review) will be planned after Phase 1 is complete and the spec is updated with frontend decisions._
