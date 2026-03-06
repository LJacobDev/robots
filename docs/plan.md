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

---

## Phase 2 — Frontend: Vue SPA, Grid Visualization & Polish

This phase delivers the complete frontend application per spec §8–§16. It builds on the fully working backend from Phase 1. Each step assumes the backend dev server is running on port 3000.

---

### 2.0 Backend Patch — Add Houses to Get Simulation Details

The `GET /simulations/:id` endpoint (§4.8) becomes the frontend's primary data source. It needs to include house coordinates so the grid can render delivered presents. The repository function `getHousesBySimulation()` already exists — this step wires it into the route handler.

- [x] In `server/routes/simulations.js`, update the `GET /simulations/:id` handler to fetch houses via `getHousesBySimulation()` and include a `houses` array in the response (each entry: `{ x, y, presentsCount }`)
- [x] Update existing integration tests in `server/routes/simulations.test.js` to verify the `houses` array is present and correct in the `GET /simulations/:id` response
- [x] Update `docs/curl-examples.md` to show the new `houses` field in the example response
- [x] Verify: `npm test` passes, `GET /simulations/:id` returns houses after stepping or running

### 2.1 Vue Project Scaffolding

- [x] Run `npm create vue@latest` inside the `client/` directory (blank project, no Router, no Pinia, no TypeScript, no JSX, no Vitest/ESLint/Prettier — deferred to root config)
- [x] Configure `vite.config.js`:
  - Dev proxy: `/api` → `http://localhost:3000`
  - `build.outDir`: `../dist` (root-level dist, per spec §6.4)
  - `build.emptyOutDir`: true
  - `root`: set to `client/` directory so Vite finds `index.html`
- [x] Install `autoprefixer` and create `postcss.config.js`
- [x] Verify the root ESLint flat config covers `client/src/**` — already configured
- [x] Add npm scripts to root `package.json`:
  - `dev:client` — runs Vite dev server from `client/`
  - `build` — runs Vite build from `client/`
  - `start` — runs production server
  - (No combined `dev` script — run `dev:server` and `dev:client` in separate terminals)
- [x] Add `dist/` to `.gitignore` — already present; also added `*.log` and `coverage/`
- [x] Remove Vue scaffold boilerplate (default App.vue content, scaffold package.json/.gitignore/README/.vscode)
- [x] Verify: `npm run dev:client` starts Vite, proxied API calls to `http://localhost:5173/api/v1/simulations` return data from the backend

### 2.2 CSS Foundation & Design Tokens

- [ ] Create a CSS reset file (`client/src/assets/reset.css`) — box-sizing border-box, margin/padding reset, sensible defaults
- [ ] Create `client/src/assets/variables.css` — all CSS custom properties:
  - Color tokens (--color-primary, --color-surface, --color-text, --color-border, --color-error, --color-success, status badge colors)
  - Typography (system font stack, monospace stack, font sizes)
  - Spacing scale (--space-xs through --space-xl)
  - Radii, shadows, transition durations
- [ ] Add `prefers-color-scheme: dark` media query block that overrides color tokens with dark variants
- [ ] Add `prefers-reduced-motion: reduce` blanket rule to disable all transitions and animations
- [ ] Import reset and variables in `main.js` (or `main.css`) so they apply globally
- [ ] Verify: page loads with reset applied, custom properties are visible in dev tools, dark mode toggles correctly when OS preference changes

### 2.3 Application Layout Shell

- [ ] Create `App.vue` with the three-panel layout structure:
  - Left sidebar (`<aside>`, fixed ~260px)
  - Center area (`<main>`, flexible)
  - Right sidebar (`<aside>`, fixed ~280px, conditionally rendered)
- [ ] Use CSS Grid or Flexbox for the three-panel layout
- [ ] Add placeholder text in each panel region to verify sizing and scroll behavior
- [ ] Add `selectedSimulationId` and `simulations` to `App.vue` data
- [ ] Verify: three panels visible, center area fills remaining space, sidebars have correct widths

### 2.4 API Client Module

- [ ] Create `client/src/api/simulations.js` — one exported function per API endpoint:
  - `createSimulation(robotCount, moveSequence)` → POST /api/v1/simulations
  - `listSimulations()` → GET /api/v1/simulations
  - `getSimulation(id)` → GET /api/v1/simulations/:id
  - `stepSimulation(id)` → POST /api/v1/simulations/:id/step
  - `runSimulation(id)` → POST /api/v1/simulations/:id/run
  - `getRobots(id)` → GET /api/v1/simulations/:id/robots
  - `getTotalPresents(id)` → GET /api/v1/simulations/:id/presents
  - `getHousesByThreshold(id, minPresents)` → GET /api/v1/simulations/:id/houses?minPresents=N
- [ ] Each function uses `fetch()`, checks `response.ok`, parses JSON, throws on error with the error body attached
- [ ] Dev-only `console.error()` logging gated behind `import.meta.env.DEV`
- [ ] JSDoc on each function
- [ ] Install `@vue/test-utils` as dev dependency (needed for component tests in later steps)
- [ ] Configure Vitest to cover both `server/` and `client/src/` from the root config so `npm test` runs everything
- [ ] Ensure `test:watch` script is available for continuous testing during development
- [ ] Write API client unit tests (`client/src/api/__tests__/simulations.test.js`):
  - Mock `fetch` and verify each function makes the correct request (method, URL, body)
  - Verify error handling: non-ok response throws with error body
- [ ] Verify: import a function in App.vue's `mounted()`, call `listSimulations()`, confirm data appears in console

### 2.5 Simulation List (Left Sidebar)

- [ ] Create `SimulationList.vue` component (Options API):
  - Props: `simulations` (array), `selectedId` (number or null)
  - Emits: `select` (simulation ID)
  - Renders a scrollable list of simulation items
  - Each item shows: simulation ID, status badge (colored span), move sequence (truncated, monospace)
  - Active item is visually highlighted
- [ ] Wire into `App.vue`: pass `simulations` and `selectedSimulationId` as props, handle `select` event
- [ ] Fetch simulation list on `App.vue` mount via `listSimulations()` API call
- [ ] Handle loading state (skeleton placeholders) and empty state ("No simulations yet")
- [ ] Style: scrollable overflow, status badge colors (gray/blue/green), truncated text with ellipsis
- [ ] Write component tests for `SimulationList.vue`:
  - Renders one list item per simulation with ID, status badge, and truncated move sequence
  - Emits `select` with the simulation ID when an item is clicked
  - Highlights the active item when `selectedId` matches
  - Shows empty state message when `simulations` array is empty
  - Shows skeleton placeholders when in loading state
  - Status badge color matches simulation status (gray/blue/green)
- [ ] Write component test for `WelcomeScreen.vue`: renders message text
- [ ] Verify: list loads from API, clicking an item updates `selectedSimulationId`, active item highlights

### 2.6 Welcome Screen

- [ ] Create `WelcomeScreen.vue` — shown in center area when `selectedSimulationId` is null
  - Friendly message: "Select a simulation or create a new one"
  - Minimal styling, centered in the available space
- [ ] Conditionally render `WelcomeScreen` vs `SimulationView` in `App.vue` based on `selectedSimulationId`
- [ ] Verify: welcome screen shows on load, disappears when a simulation is selected, reappears when deselected

### 2.7 Create Simulation Modal

- [ ] Create `CreateSimulationModal.vue` component:
  - Props: `visible` (boolean)
  - Emits: `close`, `created` (new simulation data)
  - Data: `robotCount` (default 1), `moveSequence` (empty string), `error` (null), `isSubmitting` (false)
- [ ] Robot count: number input, validated >= 1
- [ ] Move sequence: `<textarea>` with monospace font
  - `@keydown` handler captures arrow keys → appends `^`, `V`, `<`, `>` and calls `preventDefault()`
  - Allows only valid characters and editing keys; silently ignores all others
  - Hint text below input explaining arrow key usage
- [ ] Submit: calls `createSimulation()` API, emits `created` on success, shows inline error on failure
- [ ] Loading state: button text "Creating...", disabled during API call
- [ ] Cancel: Escape key or click-outside closes and resets fields
- [ ] Focus trap: when modal opens, focus moves to first input; Tab cycles within modal; focus returns to trigger on close
- [ ] Modal overlay: semi-transparent backdrop, centered card
- [ ] Wire into `App.vue`:
  - "Create Simulation" button in left sidebar opens modal
  - On `created` event: add new simulation to list, select it, close modal
- [ ] Write component tests for `CreateSimulationModal.vue`:
  - Renders form with robot count input, move sequence textarea, and submit/cancel buttons
  - Robot count input validates >= 1 (rejects 0 and negative numbers)
  - Arrow key presses in textarea append correct characters: ArrowUp→`^`, ArrowDown→`V`, ArrowLeft→`<`, ArrowRight→`>`
  - Non-arrow, non-editing keypresses in textarea are silently ignored (no character inserted)
  - Submit button calls `createSimulation()` API and emits `created` with response data on success
  - Submit button shows "Creating..." and is disabled while API call is in flight
  - API error displays as inline error message within the modal
  - Cancel button emits `close` and resets form fields
  - Escape key emits `close`
  - Focus moves to first input when modal becomes visible
- [ ] Verify: modal opens/closes, arrow keys produce move characters, submit creates simulation via API, new simulation appears in list and is selected

### 2.8 Robot SVG Component

- [ ] Create `RobotMarker.vue` — inline SVG robot icon (~15–20 lines)
  - Props: `color` (string, HSL or hex)
  - The SVG body fill uses the `color` prop
  - Small, recognizable robot shape (head, body, antenna — simple geometric shapes)
- [ ] Export or save a static version of the SVG for use as the browser favicon (`client/public/favicon.svg` or similar)
- [ ] Write component test for `RobotMarker.vue`: renders SVG with correct color prop
- [ ] Verify: renders at various colors, scales reasonably at small sizes (grid marker ~20–30px)

### 2.9 House SVG Component

- [ ] Create `HouseMarker.vue` — inline SVG gift box icon
  - Simple box with ribbon and bow, single fill color
  - Sized to match the grid cell scale
- [ ] Write component test for `HouseMarker.vue`: renders SVG
- [ ] Verify: renders clearly at grid cell size, visually distinct from robot markers

### 2.10 Simulation Grid

- [ ] Create `SimulationGrid.vue` component:
  - Props: `robots` (array), `houses` (array), `robotCount` (number for color calculation — assign each robot an HSL color via `hue = (robot.turnOrder / robotCount) * 360` to space colors evenly around the wheel)
  - The grid container uses a CSS background pattern for grid lines (repeating-linear-gradient or background-size)
  - Container is sized to the bounding box of all robots + houses, plus padding
- [ ] Position robot markers using `transform: translate()` based on grid coordinates
  - Coordinate-to-pixel conversion: `(x * cellSize, -y * cellSize)` (y-axis inverted so `^` goes visually up)
  - Each robot SVG has a `data-robot-id` attribute
- [ ] Position house markers using the same translate approach
- [ ] Handle stacked robots: when multiple robots share a cell, offset each SVG slightly so all are partially visible
- [ ] Wrap grid container in a viewport div with `overflow: auto` for scrolling
- [ ] Write component tests for `SimulationGrid.vue`:
  - Renders a robot marker at the correct pixel position for a given grid coordinate (x _ cellSize, -y _ cellSize)
  - Y-axis is inverted: a robot at (0, 2) renders above (0, 0), not below
  - Renders house markers at correct positions using the same coordinate-to-pixel logic
  - When multiple robots share a cell, each gets a slight translate offset so all are partially visible
  - Grid container is sized to the bounding box of all entities plus padding
  - Each robot SVG element has the correct `data-robot-id` attribute
  - Zoom: `transform: scale()` is applied to the grid container when zoomLevel ≠ 1.0
- [ ] Verify: robots and houses render at correct positions, grid lines visible, scrolling works when content overflows

### 2.11 Zoom Controls

- [ ] Add `+` and `−` buttons to a corner of the grid viewport (absolute positioned over the viewport)
- [ ] Zoom state: `zoomLevel` in component data (default 1.0, min 0.25, max 3.0)
- [ ] Apply zoom via `transform: scale()` on the grid container (combined with any existing transforms)
- [ ] Verify: clicking + zooms in, clicking − zooms out, grid remains scrollable at all zoom levels

### 2.12 Simulation View & Control Panel

- [ ] Create `SimulationView.vue` component:
  - Props: `simulationId` (number)
  - Fetches simulation details via `getSimulation(id)` on mount and when `simulationId` changes (via `watch`)
  - Owns: `simulation`, `robots`, `houses`, `totalPresents`, `houseQueryResult`, loading/error state
  - Renders `SimulationGrid` (center) and `ControlPanel` (right sidebar)
- [ ] Create `ControlPanel.vue` component:
  - Props: `simulation`, `robots`, `totalPresents`, `houseQueryResult`, `isStepLoading`, `isRunLoading`
  - Emits: `step`, `run`, `check-houses` (with threshold N), `scroll-to-robot` (with robot ID)
- [ ] Simulation info section: ID, status badge, move sequence (monospace)
- [ ] Step / Run buttons: emit events to parent, disabled when completed or loading
  - Button text changes during loading: "Stepping..." / "Running..."
- [ ] Progress bar: green bar width = `(currentStep / totalSteps) * 100%`, text label "Step X of Y"
  - Smooth width transition (respects prefers-reduced-motion)
- [ ] Write component tests for `ControlPanel.vue`:
  - Renders simulation info: ID, status badge, move sequence
  - Renders robot list with name, color, and position for each robot
  - Step and Run buttons are enabled when status is 'created' or 'running'
  - Step and Run buttons are disabled when status is 'completed'
  - Step and Run buttons are disabled and show loading text when `isStepLoading` or `isRunLoading` is true
  - Clicking Step emits `step` event
  - Clicking Run emits `run` event
  - Progress bar width reflects `currentStep / totalSteps` ratio
  - Houses query: entering a threshold and clicking Check emits `check-houses` with the threshold number
  - Houses query: threshold input validates >= 1
  - Houses query result displays when `houseQueryResult` prop is provided, empty when null
  - Clicking a robot name emits `scroll-to-robot` with the robot's ID
- [ ] Verify: selecting a simulation loads its data, step/run buttons work, progress bar updates

### 2.13 Step & Run API Integration

Both step and run follow the same pattern: perform the action, then refresh full state via `getSimulation(id)`. This keeps the frontend stateless — no local tracking of positions or present counts.

- [ ] In `SimulationView.vue`, create a shared `refreshSimulation()` method:
  1. Call `getSimulation(id)` API
  2. Update `simulation`, `robots`, `houses`, and `totalPresents` from response
  3. Clear `houseQueryResult` (snapshot invalidated by state change)
  4. Update the simulation's status in the sidebar list
- [ ] Implement `step` handler:
  1. Set `isStepLoading` = true, disable buttons
  2. Call `stepSimulation(id)` API
  3. On success: call `refreshSimulation()`
  4. On error: display inline error message
  5. Set `isStepLoading` = false
- [ ] Implement `run` handler:
  1. Set `isRunLoading` = true, disable buttons
  2. Call `runSimulation(id)` API
  3. On success: call `refreshSimulation()`
  4. On error: display inline error message
  5. Set `isRunLoading` = false
- [ ] Verify: stepping updates grid positions one at a time, running completes all steps, completed simulation disables buttons

### 2.14 Statistics & Houses Query

- [ ] In `ControlPanel.vue`, display:
  - Robot count (from simulation.robotCount)
  - Total presents delivered (from `totalPresents` prop, sourced from `getSimulation` response summary)
- [ ] Houses query section:
  - Number input for threshold N (validated >= 1)
  - "Check" button, emits `check-houses` with N
  - Result area shows "X houses have ≥ N presents" or empty when cleared
- [ ] In `SimulationView.vue`, handle `check-houses` event:
  - Call `getHousesByThreshold(id, N)` API
  - Set `houseQueryResult` with the response
- [ ] Verify: total presents updates after each step/run, houses query returns correct count, result clears after step/run

### 2.15 Click-to-Scroll from Robot List

- [ ] In `ControlPanel.vue`, robot list shows each robot's name, color swatch (small robot SVG or colored dot), and `(x, y)` position
- [ ] Clicking a robot name emits `scroll-to-robot` with the robot's ID
- [ ] In `SimulationView.vue`, handle `scroll-to-robot`:
  - Find the robot SVG in the grid via `document.querySelector([data-robot-id="..."])`
  - Call `.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })`
- [ ] Verify: clicking a robot name scrolls the grid to center on that robot

### 2.16 Loading, Empty, and Error States

- [ ] Simulation list: skeleton loader while fetching, "No simulations yet — create one to get started" when empty
- [ ] Simulation view: skeleton loader while fetching simulation details
- [ ] Action buttons: text changes ("Stepping...", "Running...", "Creating...") + disabled during in-flight API calls
- [ ] API error messages: displayed inline in red text near the triggering control
- [ ] Form validation errors: red border on input + red text below
- [ ] Verify: each state is visually distinct, no layout shift when transitioning between states

### 2.17 Accessibility Pass

- [ ] Semantic HTML audit: `<nav>`, `<main>`, `<aside>`, `<button>`, `<form>`, `<input>` used correctly — no `<div>` buttons
- [ ] ARIA labels on all interactive elements, including the grid viewport (`role="img"`, `aria-label`)
- [ ] `aria-live="polite"` on status update regions (step result messages, error messages)
- [ ] Focus management: modal focus trap (focus moves to first input on open, returns to trigger on close)
- [ ] Keyboard navigation: Tab between major control groups, arrow keys within simulation list
- [ ] `focus-visible` outlines on all focusable elements
- [ ] Color contrast check: verify all text/background combinations meet WCAG AA (4.5:1 normal, 3:1 large)
- [ ] Verify: navigate the entire app using only the keyboard, screen reader announces status changes

### 2.18 Visual Polish & Animations

- [ ] Button hover/active state transitions
- [ ] Modal fade-in/out transition
- [ ] Robot position transitions (translate animation on step)
- [ ] Progress bar width transition
- [ ] Confirm all transitions are disabled under `prefers-reduced-motion: reduce`
- [ ] Status badge styling: gray (created), blue (running), green (completed) with rounded pill shape
- [ ] Box shadows on buttons, cards, and sidebar panels
- [ ] Mobile breakpoint: collapse sidebars on small screens (basic usability, not a primary target)
- [ ] Verify: animations are smooth, no janky layout shifts, reduced motion preference is respected

### 2.19 Frontend Test Coverage Review

All component and API client tests were written alongside their implementation steps (2.4–2.14). This step reviews coverage and fills any gaps.

- [ ] Review all existing frontend tests — identify any missing edge cases or error paths
- [ ] Fill coverage gaps: add tests for any untested branches, error states, or prop variations
- [ ] Verify `npm test` runs all server + client tests in a single pass
- [ ] Verify: all tests pass, no skipped or pending tests

### 2.20 Build & Production Serving

- [ ] Run `npm run build` — Vite outputs to root `/dist/`
- [ ] Verify Express serves the built frontend in production mode:
  - Set `NODE_ENV=production`
  - Start server with `node server/server.js`
  - Visit `http://localhost:3000` — app loads
  - API calls from the frontend reach the backend
  - Navigating directly to any URL serves `index.html` (SPA catch-all)
- [ ] Check bundle size: target < 50KB gzipped for JS + CSS
- [ ] Add `start` script to root `package.json`: `NODE_ENV=production node server/server.js`

### 2.21 Docker Setup

- [ ] Create `Dockerfile`:
  - Multi-stage build: Node image → install deps → build client → production image with server + dist
  - Expose PORT
  - CMD: `node server/server.js`
- [ ] Create `.dockerignore` (node_modules, .env, data/\*.db, .git)
- [ ] Create `docker-compose.yml` (optional, for easy `docker compose up`)
- [ ] Verify: `docker build` succeeds, `docker run` starts the app, app is fully functional in the container
- [ ] Verify: works on a clean environment (no host node_modules or .env assumed)

### 2.22 README.md

- [ ] Write `README.md` per spec structure:
  - **How to run it** — npm setup, Docker alternative, environment variables
  - **Things to try out** — example workflows (create simulation, step through it, run to completion, query houses)
  - **Description of the API** — summary table of endpoints with link to `docs/curl-examples.md` for details
  - **Reference** — link to `docs/spec.md` for full specification
- [ ] Keep it clear, concise, and free of unnecessary clutter
- [ ] Verify: a reader unfamiliar with the project can follow the instructions to run the app

### 2.23 Phase 2 Checkpoint Review

- [ ] Full app walkthrough: create simulation → step through → run → query houses → query presents → select different simulation — all flows work end to end
- [ ] All tests pass: `npm test` runs server unit/integration + client component tests
- [ ] Lint clean: `npm run lint` passes with no warnings or errors
- [ ] Format clean: `npm run format` produces no changes
- [ ] Accessibility audit: run unlighthouse or manual keyboard/screen reader walkthrough
- [ ] Production build works: `npm run build && npm start` serves the full app
- [ ] Docker build works: `docker build` and `docker run` produce a working app
- [ ] Spec alignment: verify the running app matches every detail in spec.md §8–§16
- [ ] Code review pass: JSDoc on all exported functions and components, consistent formatting, no dead code
- [ ] README is complete and accurate
- [ ] `docs/findings-decisions-actions.md` is up to date with any deviations discovered during implementation
