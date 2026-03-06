# Robots Simulation — Specification

## Version 1.0 — Backend API, Data Model & Frontend

---

## 1. Overview

A web application that simulates robots delivering presents on an infinite 2D grid. Users create simulations with a configurable number of robots and a movement instruction string. Robots take turns executing moves in round-robin order, delivering presents to houses they visit — unless another robot already occupies that space.

The backend exposes a RESTful API. The frontend provides a visual interface for creating, controlling, and observing simulations.

---

## 2. Core Rules

- The grid is an infinite discrete 2D plane of houses, with origin at `(0, 0)`.
- All robots start at `(0, 0)`. They do **not** deliver a present on initialization — a present is only delivered when a robot **moves into** a space.
- Robots take turns in round-robin order (Robot 0, Robot 1, ..., Robot N-1, Robot 0, ...), each consuming one instruction from the move sequence per turn.
- Valid move characters: `^` (north / y+1), `V` (south / y-1), `<` (west / x-1), `>` (east / x+1).
- A robot delivers a present to a house **if and only if** no other robot occupies the destination space at the end of that robot's move.
- Presents are an infinite resource. Delivery simply increments the house's present count. A blocked delivery does not consume or accumulate anything.
- The simulation ends when all instructions in the move sequence have been consumed. Robots whose turns fall after the last instruction simply do not move.

> **Design decision — origin delivery:**
> The specification states "a present is delivered when a robot enters a space." Since robots begin at `(0, 0)` without moving into it, no present is delivered at the start. Moving _back_ to `(0, 0)` from another space does count as entering it and triggers delivery (subject to the occupancy rule). This was chosen as the most literal reading of "enters."

> **Design decision — blocked delivery:**
> When delivery is blocked, nothing is consumed or deferred. The robot simply doesn't deliver. We considered tracking "attempted but failed" deliveries, but the requirements only ask for present counts — tracking failures would add complexity without meeting a stated need.

---

## 3. Data Model

### 3.1 Schema

Four tables. All resource tables include `user_id` for future multi-user support.

#### `users`

| Column | Type    | Constraints               | Notes                    |
| ------ | ------- | ------------------------- | ------------------------ |
| id     | INTEGER | PRIMARY KEY AUTOINCREMENT |                          |
| name   | TEXT    | NOT NULL                  | Seeded: "default" (id=1) |

#### `simulations`

| Column        | Type    | Constraints                 | Notes                             |
| ------------- | ------- | --------------------------- | --------------------------------- |
| id            | INTEGER | PRIMARY KEY AUTOINCREMENT   |                                   |
| user_id       | INTEGER | NOT NULL, FK → users(id)    | Default: 1                        |
| move_sequence | TEXT    | NOT NULL                    | Full instruction string           |
| robot_count   | INTEGER | NOT NULL                    | Must be >= 1                      |
| current_step  | INTEGER | NOT NULL, DEFAULT 0         | 0-based index into move_sequence  |
| status        | TEXT    | NOT NULL, DEFAULT 'created' | 'created', 'running', 'completed' |
| created_at    | TEXT    | NOT NULL                    | ISO 8601 timestamp                |

#### `robots`

| Column        | Type    | Constraints                    | Notes                           |
| ------------- | ------- | ------------------------------ | ------------------------------- |
| id            | INTEGER | PRIMARY KEY AUTOINCREMENT      |                                 |
| simulation_id | INTEGER | NOT NULL, FK → simulations(id) |                                 |
| name          | TEXT    | NOT NULL                       | From names.json with cycling    |
| position_x    | INTEGER | NOT NULL, DEFAULT 0            | Current x coordinate            |
| position_y    | INTEGER | NOT NULL, DEFAULT 0            | Current y coordinate            |
| turn_order    | INTEGER | NOT NULL                       | 0-based round-robin index       |
| UNIQUE        |         | (simulation_id, turn_order)    | One robot per turn slot per sim |

#### `houses`

| Column         | Type    | Constraints                    | Notes                          |
| -------------- | ------- | ------------------------------ | ------------------------------ |
| id             | INTEGER | PRIMARY KEY AUTOINCREMENT      |                                |
| simulation_id  | INTEGER | NOT NULL, FK → simulations(id) |                                |
| x              | INTEGER | NOT NULL                       | Grid x coordinate              |
| y              | INTEGER | NOT NULL                       | Grid y coordinate              |
| presents_count | INTEGER | NOT NULL, DEFAULT 1            | Incremented on each delivery   |
| UNIQUE         |         | (simulation_id, x, y)          | One row per coordinate per sim |

House rows are created **only** on successful delivery (not on blocked delivery or initialization). Every row in the houses table has `presents_count >= 1`.

### 3.2 Indexes

- `robots`: index on `simulation_id`
- `houses`: index on `simulation_id` (the UNIQUE constraint on `(simulation_id, x, y)` also serves as an index)

### 3.3 Derived Values (Not Stored)

These values are computed via SQL queries, not stored as columns. This eliminates sync risk and is computationally inexpensive for the expected data scale.

- **Total presents delivered:** `SELECT SUM(presents_count) FROM houses WHERE simulation_id = ?`
- **Houses with at least N presents:** `SELECT COUNT(*) FROM houses WHERE simulation_id = ? AND presents_count >= ?`

> **Design decision — derived vs. stored totals:**
> We considered adding a `total_presents` column to the `simulations` table for O(1) lookups. However, the SUM query scans only the houses for a single simulation (indexed by `simulation_id`) and executes in microseconds even with thousands of rows. Storing the total would require transactional updates on every delivery step, adding code complexity and risking data inconsistency if a transaction fails partway. For production at truly massive scale, a denormalized counter or caching layer could be added — but for this application's expected load, deriving the value is both simpler and safer.

> **Design decision — multi-user readiness:**
> All resource tables include a `user_id` foreign key pointing to a seeded default user (id=1). This adds minimal overhead (one column, one seed row) but means adding real authentication later requires zero schema changes — only adding auth middleware that sets `req.user.id` and wiring it into existing queries. The alternative — adding `user_id` retroactively — would require schema migrations and updating every query, which is error-prone and time-consuming.

> **Design decision — SQLite with repository pattern:**
> SQLite via `better-sqlite3` was chosen for simplicity: zero setup, no background process, single file. The synchronous driver was chosen deliberately — it blocks Node's event loop during queries, which is acceptable for a single-user application with low concurrency. For production multi-user deployment, the path to PostgreSQL is designed to be trivial: all database access goes through a repository layer (named functions like `createSimulation()`, `stepSimulation()`), so switching drivers means replacing implementations without touching route handlers, business logic, or tests. The main SQL dialect differences (AUTOINCREMENT → SERIAL, parameterized query syntax `?` → `$1`) are contained within the repository layer.

---

## 4. API Specification

**Base path:** `/api/v1`

All endpoints return JSON. All error responses follow a consistent shape:

```json
{
  "error": {
    "code": "DESCRIPTIVE_ERROR_CODE",
    "message": "Human-readable explanation"
  }
}
```

### 4.1 Create Simulation

**`POST /api/v1/simulations`**

Creates a new simulation with the specified number of robots and move sequence. Robots are initialized at `(0, 0)` with names assigned from `data/names.json`.

**Request body:**

```json
{
  "robotCount": 3,
  "moveSequence": "^^VV<>"
}
```

| Field        | Type    | Required        | Validation                                                                                                                  |
| ------------ | ------- | --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| robotCount   | integer | No (default: 1) | Must be >= 1                                                                                                                |
| moveSequence | string  | Yes             | Must contain only `^`, `V`, `<`, `>`. Must not be empty. Lowercase `v` is accepted and normalized to `V` before validation. |

> **Design decision — moveSequence case normalization:**
> The input validation middleware applies `.toUpperCase()` to the move sequence before checking it against the valid character set. This means `v` is silently accepted and stored as `V`, improving usability without relaxing correctness. `.toUpperCase()` was chosen over a targeted `.replace(/v/g, 'V')` because it is simpler to read and equally correct — the other three valid characters (`^`, `<`, `>`) are not alphabetic and are returned unchanged by the Unicode uppercase algorithm. At any realistic move sequence length, both approaches execute in microseconds; the performance difference is not a factor.

**Success response:** `201 Created`

```json
{
  "simulation": {
    "id": 1,
    "robotCount": 3,
    "moveSequence": "^^VV<>",
    "currentStep": 0,
    "totalSteps": 6,
    "status": "created",
    "createdAt": "2026-03-04T12:00:00.000Z"
  },
  "robots": [
    { "name": "Robbie", "turnOrder": 0, "position": { "x": 0, "y": 0 } },
    { "name": "Jane", "turnOrder": 1, "position": { "x": 0, "y": 0 } },
    { "name": "Bob", "turnOrder": 2, "position": { "x": 0, "y": 0 } }
  ]
}
```

**Error responses:**

| Status | Code                  | When                                           |
| ------ | --------------------- | ---------------------------------------------- |
| 400    | INVALID_ROBOT_COUNT   | robotCount < 1 or non-integer                  |
| 400    | INVALID_MOVE_SEQUENCE | Empty, missing, or contains invalid characters |

### 4.2 Step Simulation (One Turn)

**`POST /api/v1/simulations/:id/step`**

Executes one turn: the next robot in rotation reads one instruction, moves, and attempts to deliver a present.

**Request body:** None

**Success response:** `200 OK`

```json
{
  "turn": {
    "robotName": "Robbie",
    "direction": "^",
    "from": { "x": 0, "y": 0 },
    "to": { "x": 0, "y": 1 },
    "delivered": true,
    "message": "Robbie moved to (0, 1) and delivered a present!"
  },
  "simulation": {
    "id": 1,
    "currentStep": 1,
    "totalSteps": 6,
    "status": "running"
  }
}
```

When delivery is blocked:

```json
{
  "turn": {
    "robotName": "Robbie",
    "direction": "V",
    "from": { "x": 0, "y": 1 },
    "to": { "x": 0, "y": 0 },
    "delivered": false,
    "message": "Robbie moved to (0, 0) but couldn't deliver — another robot was already there."
  },
  "simulation": {
    "id": 1,
    "currentStep": 4,
    "totalSteps": 6,
    "status": "running"
  }
}
```

**Error responses:**

| Status | Code                  | When                                      |
| ------ | --------------------- | ----------------------------------------- |
| 400    | INVALID_SIMULATION_ID | :id is not a positive integer             |
| 404    | SIMULATION_NOT_FOUND  | No simulation with this ID                |
| 409    | SIMULATION_COMPLETED  | Simulation has already consumed all moves |

### 4.3 Run Full Simulation

**`POST /api/v1/simulations/:id/run`**

Runs the simulation to completion atomically. Returns the final state only — no intermediate history.

**Request body:** None

**Success response:** `200 OK`

```json
{
  "simulation": {
    "id": 1,
    "currentStep": 6,
    "totalSteps": 6,
    "status": "completed"
  },
  "robots": [
    { "name": "Robbie", "turnOrder": 0, "position": { "x": 0, "y": 0 } },
    { "name": "Jane", "turnOrder": 1, "position": { "x": -1, "y": 1 } },
    { "name": "Bob", "turnOrder": 2, "position": { "x": 1, "y": -1 } }
  ],
  "summary": {
    "totalPresentsDelivered": 5,
    "housesWithPresents": 5
  }
}
```

**Error responses:**

| Status | Code                  | When                          |
| ------ | --------------------- | ----------------------------- |
| 400    | INVALID_SIMULATION_ID | :id is not a positive integer |
| 404    | SIMULATION_NOT_FOUND  | No simulation with this ID    |
| 409    | SIMULATION_COMPLETED  | Simulation already completed  |

> **Design decision — atomic run, no history:**
> The "run full simulation" endpoint returns only the final state. Intermediate step history is not persisted or returned. This was chosen intentionally: the requirements ask for "run the entire simulation through the full sequence of moves" without specifying history. Step-by-step replay is available via the step endpoint. Storing a full move history would add storage and complexity for a feature not requested. If history becomes needed, the move sequence and starting state are deterministic — any past state can be reconstructed by replaying from the beginning.

### 4.4 Get Robot Positions

**`GET /api/v1/simulations/:id/robots`**

Returns the current position of all robots in the simulation.

**Success response:** `200 OK`

```json
{
  "simulationId": 1,
  "currentStep": 3,
  "robots": [
    { "name": "Robbie", "turnOrder": 0, "position": { "x": 0, "y": 1 } },
    { "name": "Jane", "turnOrder": 1, "position": { "x": 0, "y": 1 } },
    { "name": "Bob", "turnOrder": 2, "position": { "x": 0, "y": -1 } }
  ]
}
```

**Error responses:**

| Status | Code                  | When                          |
| ------ | --------------------- | ----------------------------- |
| 400    | INVALID_SIMULATION_ID | :id is not a positive integer |
| 404    | SIMULATION_NOT_FOUND  | No simulation with this ID    |

### 4.5 Get Houses by Present Threshold

**`GET /api/v1/simulations/:id/houses?minPresents=N`**

Returns the count of houses that have received at least N presents.

**Query parameters:**

| Param       | Type    | Required | Validation   |
| ----------- | ------- | -------- | ------------ |
| minPresents | integer | Yes      | Must be >= 1 |

**Success response:** `200 OK`

```json
{
  "simulationId": 1,
  "minPresents": 2,
  "houseCount": 3
}
```

**Error responses:**

| Status | Code                  | When                           |
| ------ | --------------------- | ------------------------------ |
| 400    | INVALID_SIMULATION_ID | :id is not a positive integer  |
| 400    | INVALID_THRESHOLD     | minPresents < 1 or non-integer |
| 404    | SIMULATION_NOT_FOUND  | No simulation with this ID     |

### 4.6 Get Total Presents

**`GET /api/v1/simulations/:id/presents`**

Returns the total number of presents delivered across all houses.

**Success response:** `200 OK`

```json
{
  "simulationId": 1,
  "totalPresents": 12
}
```

**Error responses:**

| Status | Code                  | When                          |
| ------ | --------------------- | ----------------------------- |
| 400    | INVALID_SIMULATION_ID | :id is not a positive integer |
| 404    | SIMULATION_NOT_FOUND  | No simulation with this ID    |

### 4.7 List Simulations

**`GET /api/v1/simulations`**

Returns all simulations. Not in the original requirements but necessary for the UI to show existing simulations.

**Success response:** `200 OK`

```json
{
  "simulations": [
    {
      "id": 1,
      "robotCount": 3,
      "moveSequence": "^^VV<>",
      "currentStep": 6,
      "totalSteps": 6,
      "status": "completed",
      "createdAt": "2026-03-04T12:00:00.000Z"
    }
  ]
}
```

### 4.8 Get Simulation Details

**`GET /api/v1/simulations/:id`**

Returns full details for a single simulation including robots, houses, and delivery summary. This is the frontend's primary data-fetching endpoint — called on initial load, when switching simulations, and after each step or run to refresh the complete simulation state (see §9.3 for the frontend data strategy and scaling considerations).

**Success response:** `200 OK`

```json
{
  "simulation": {
    "id": 1,
    "robotCount": 3,
    "moveSequence": "^^VV<>",
    "currentStep": 6,
    "totalSteps": 6,
    "status": "completed",
    "createdAt": "2026-03-04T12:00:00.000Z"
  },
  "robots": [
    { "name": "Robbie", "turnOrder": 0, "position": { "x": 0, "y": 0 } },
    { "name": "Jane", "turnOrder": 1, "position": { "x": -1, "y": 1 } },
    { "name": "Bob", "turnOrder": 2, "position": { "x": 1, "y": -1 } }
  ],
  "houses": [
    { "x": 0, "y": 1, "presentsCount": 2 },
    { "x": -1, "y": 1, "presentsCount": 1 },
    { "x": 0, "y": -1, "presentsCount": 1 },
    { "x": 1, "y": -1, "presentsCount": 1 }
  ],
  "summary": {
    "totalPresentsDelivered": 5,
    "housesWithPresents": 5
  }
}
```

**Error responses:**

| Status | Code                  | When                          |
| ------ | --------------------- | ----------------------------- |
| 400    | INVALID_SIMULATION_ID | :id is not a positive integer |
| 404    | SIMULATION_NOT_FOUND  | No simulation with this ID    |

> **Design decision — endpoints beyond the minimum set:**
> The requirements specify 6 operations (create, step, run, query robots, query houses by threshold, query total presents). Two additional endpoints have been added: List Simulations (4.7) and Get Simulation Details (4.8). List Simulations is necessary for any frontend — without it, a user who refreshes the page has no way to discover existing simulation IDs. Get Simulation Details combines simulation metadata, robot positions, house coordinates with present counts, and a delivery summary into a single response. The frontend uses this as its primary data-fetching endpoint — called on initial load, when switching simulations, and after each step or run — so that it never needs to maintain its own simulation state. The required endpoints (Get Robots §4.4, Get Total Presents §4.6, Get Houses by Threshold §4.5) remain as focused, lightweight operations for direct API consumers. All endpoints reuse existing repository functions and introduce no redundancy.

> **Design decision — API versioning:**
> All routes are prefixed `/api/v1/`. If a breaking API change were needed in future, a `/api/v2/` router could be introduced alongside v1 without disrupting existing consumers, and v1 deprecated on a timeline.

> **Design decision — simulation lifecycle:**
> Simulations cannot currently be deleted via the API. This is intentional for v1 — simulations accumulate as a history of runs. Manual cleanup can be done via the SQLite CLI (`sqlite3 ./data/robots.db`) or any database management tool. A "clear all simulations" endpoint may be added in a future version.

---

## 5. Robot Naming

Robot names are assigned from `data/names.json` at simulation creation time. The first 20 names are hardcoded (Robbie, Jane, Bob, and 17 common first names). When a simulation has more than 20 robots, the name list cycles with a numeric suffix:

- Robots 1-20: Robbie, Jane, Bob, ..., (20th name)
- Robots 21-40: Robbie_2, Jane_2, Bob_2, ...
- Robots 41-60: Robbie_3, Jane_3, Bob_3, ...

This keeps robots human-identifiable regardless of count.

---

## 6. Server Configuration

### 6.1 Environment Variables

Managed via `.env` (gitignored) and `.env.example` (committed).

| Variable        | Default               | Purpose                                                               |
| --------------- | --------------------- | --------------------------------------------------------------------- |
| PORT            | 3000                  | Express server port                                                   |
| NODE_ENV        | development           | Controls logging verbosity, Express optimizations, error detail level |
| DATABASE_PATH   | ./data/robots.db      | SQLite database file location                                         |
| ALLOWED_ORIGINS | http://localhost:5173 | CORS allowed origins                                                  |

### 6.2 Security Middleware

- **`helmet()`** — Sets HTTP security headers (X-Content-Type-Options, X-Frame-Options, Content-Security-Policy, etc.). Included as real code, not pseudocode, because it is a single line with meaningful production value.
- **`cors()`** — Configured with explicit `ALLOWED_ORIGINS`. In development, allows requests from the Vite dev server. In production, restricts to the same origin.

> **Design decision — real security middleware vs. pseudocode:**
> Unlike authentication (which requires significant implementation effort for this project's scope), helmet and CORS are one-line middleware additions that provide real protective value. Omitting them would be a missed signal for reviewers assessing production readiness.

### 6.3 Authentication & Authorization

Not implemented in v1. Pseudocode comments indicate where auth middleware would be inserted (before route handlers) and how it would set `req.user.id` to scope queries. The `user_id` columns in the schema are already present to support this upgrade path.

When authentication is added, **authorization** would also be enforced: any request for a simulation whose `user_id` does not match `req.user.id` would return `403 Forbidden` with error code `FORBIDDEN`. This requires no schema changes — the `user_id` column on `simulations` already exists, and the check would be a single guard in each route handler or a shared middleware.

### 6.4 Static File Serving

In production, Express serves the Vite-built frontend from `dist/` and includes a catch-all route that serves `index.html` for any request that is not an API route or a known static file. This ensures the Vue SPA loads correctly regardless of the URL path, which is necessary even without Vue Router — and essential if client-side routing is added later.

---

## 7. Tech Stack Summary

| Layer    | Choice                              | Rationale                                                         |
| -------- | ----------------------------------- | ----------------------------------------------------------------- |
| Frontend | Vue 3.5+, Options API               | Team compatibility; Composition API noted as alternative          |
| Bundler  | Vite                                | Standard for Vue 3; fast HMR in dev, optimized builds             |
| Backend  | Node.js + Express                   | Simple API endpoints; SSR not needed (Nuxt considered, rejected)  |
| Language | JavaScript                          | TypeScript adds friction for this project's scope                 |
| Database | SQLite via better-sqlite3           | Zero setup; repository pattern enables trivial Postgres migration |
| Testing  | Vitest + Supertest + Vue Test Utils | Unit, integration, and component tests                            |
| Linting  | ESLint v10 (flat config) + Prettier | Root-level config covering client + server                        |
| CSS      | autoprefixer via PostCSS            | Vendor prefix management without a CSS framework                  |
| Security | helmet.js + cors                    | Production-standard headers and origin control                    |
| Auditing | unlighthouse                        | Automated accessibility and performance auditing                  |

> **Design decision — Express over Nuxt:**
> Nuxt was considered since it unifies frontend and backend in a single framework. However, the application requires only a simple API and a single-page frontend — Nuxt's SSR, file-based routing, and auto-imports add complexity without corresponding benefit. Express is a well-understood, lightweight server that does exactly what is needed. If the application grew to need SEO or server-rendered pages, Nuxt would become the stronger choice.

> **Design decision — SPA over SSR:**
> This application is a single-page interactive tool with no public content that needs search engine indexing. SSR would add build complexity (hydration, server/client code splitting) without benefit. A static SPA served by Express is the simplest correct architecture for this use case.

> **Design decision — Options API over Composition API:**
> The Composition API is the more modern Vue pattern and the developer's usual API of choice. However, the Options API was chosen for team compatibility, as it aligns with the conventions used by the reviewing team. Both APIs are fully supported in Vue 3.5+ and can coexist in the same project if needed.

---

## 8. Frontend Overview

The frontend is a Vue 3.5+ single-page application that communicates with the backend API. It provides an interface for creating simulations, stepping or running them, visualizing robot movement on a 2D grid, and querying delivery statistics.

The UI has two primary views:

1. **Welcome / Create view** — shown when no simulation is selected. Displays a list of existing simulations and a creation form.
2. **Simulation view** — shown when a simulation is selected. Displays the grid, robot positions, simulation controls, and statistics.

The application is designed for desktop use but degrades gracefully on smaller screens.

---

## 9. Application Layout

### 9.1 Three-Panel Structure

| Region        | Width          | Contents                                                  |
| ------------- | -------------- | --------------------------------------------------------- |
| Left sidebar  | Fixed (~260px) | Create simulation button, simulation list (scrollable)    |
| Center area   | Flexible       | Grid viewport (scrollable, zoomable)                      |
| Right sidebar | Fixed (~280px) | Simulation controls, statistics, houses query, robot list |

The left sidebar is always visible. The right sidebar appears only when a simulation is selected.

### 9.2 Left Sidebar

- **"Create Simulation" button** — opens the creation modal (§10).
- **Simulation list** — vertical scrollable list of all simulations, showing ID, status badge, and move sequence (truncated). Clicking a simulation selects it and loads the simulation view.

### 9.3 Right Sidebar (Control Panel)

Visible when a simulation is selected. Contains, from top to bottom:

1. **Simulation info** — ID, status badge (color-coded: created/running/completed), move sequence displayed as highlighted Unicode arrows with step tracking.
2. **Step / Run controls** — "Step" and "Run" buttons side by side. Disabled when the simulation is completed or when an API call is in-flight.
3. **Progress indicator** — Green progress bar showing `currentStep / totalSteps` as a percentage, with text label (e.g., "Step 3 of 6").
4. **Statistics** — Robot count, total presents delivered (fetched from API on each step/run).
5. **Houses query** — Number input for the threshold N, a "Check" button, and a result display area (e.g., "3 houses have ≥ 2 presents"). The result clears when any state change occurs (step or run).
6. **Robot list** — Scrollable list showing each robot's name, color swatch, and current `(x, y)` position. Clicking a robot name scrolls the grid viewport to center on that robot's position.

> **Design decision — move sequence display format (Unicode arrows):**
> The project requirements specify `<`, `>`, `^`, `V` as the move instruction characters, and the API strictly adheres to this: input validation, storage, and processing all use these raw characters. However, in the UI the move sequence is displayed using Unicode arrows (`←`, `→`, `↑`, `↓`) instead. This is a presentation-layer transformation only — the mapping happens in a computed property at render time and does not alter any stored or transmitted data. The rationale: `<>^V` is a sensible data format but a poor display format — the mixed case, varying character widths, and ASCII appearance look rough in a polished interface. Unicode arrows are uniform in width, visually intuitive, and immediately readable. This separation of data format from display format is standard practice (analogous to storing dates as ISO 8601 but displaying them as "January 1, 2026").

> **Design decision — move sequence step highlighting:**
> Each character in the displayed move sequence is individually styled based on the current simulation step. Past moves (index < currentStep) are dimmed to a faded grey, the next move (index === currentStep) is highlighted in green, and future moves remain in the default text color. This gives the user immediate visual feedback about simulation progress directly in the move string itself, complementing the progress bar. When the simulation is completed, all moves show as past. The implementation uses one `<span>` per character — at typical sequence lengths (tens to hundreds of characters) this is negligible for DOM performance. Even at 1,000+ characters the rendering cost remains trivial compared to the grid's SVG markers.

> **Design decision — "Check" button for houses query:**
> The houses-by-threshold query is intentionally user-initiated rather than auto-fired on each step or run. This reflects its nature as an investigative tool — the user enters a specific threshold of interest and deliberately requests the count. Auto-firing on every state change would add API calls for data the user may not be looking at. The displayed result clears after a step or run to signal that it is a snapshot of a prior state, not a live counter. The word "Check" was chosen over "Query" (too technical) and "Update" (ambiguous — implies mutation).

> **Design decision — frontend data strategy (single full-state refresh):**
> After each step or run, the frontend calls `GET /api/v1/simulations/:id` (§4.8) to refresh the complete simulation state — robot positions, house coordinates, and delivery summary — in a single request. This means the frontend is fully stateless with respect to simulation data: it never tracks positions or present counts locally, and the backend is always the single source of truth. The required standalone endpoints (`GET /robots` §4.4, `GET /presents` §4.6) remain available for direct API consumers but the frontend does not call them during its primary step/run flow. At this application's scale — a single human user with debounced button clicks — the full-state refresh adds negligible load. At higher scale or with many concurrent users, a delta-based approach (updating only the moved robot's position from the step response and adding `totalPresents` to the step payload) would reduce bandwidth and query cost. This optimization is documented as a recommended improvement for future scaling. In the meantime, load on this endpoint should be monitored to identify when the full-state refresh pattern begins to warrant optimization.

---

## 10. Create Simulation Modal

The creation form appears as a centered modal overlay on top of the grid area (or welcome screen). It contains:

| Field         | Input type   | Notes                                                     |
| ------------- | ------------ | --------------------------------------------------------- |
| Robot count   | Number input | Defaults to 1. Validated: must be a positive integer.     |
| Move sequence | Textarea     | Auto-expands up to a limit, then scrolls. Monospace font. |

### 10.1 Move Sequence Input Behavior

The move sequence textarea captures arrow key presses and converts them to directional characters (`^`, `V`, `<`, `>`), in addition to accepting those characters typed directly. This makes input more intuitive — users can press arrow keys to "draw" the path.

Only valid characters (`^`, `V`, `v`, `<`, `>`) and standard editing keys (Backspace, Delete, arrow navigation, Ctrl+A/C/V/X/Z) are accepted. All other keystrokes are silently ignored. Lowercase `v` is accepted at the input level for usability; the backend normalizes it to `V`.

### 10.2 Modal Interactions

- **Submit:** Enter key or clicking a "Create" button. The modal closes on success and the new simulation is selected.
- **Cancel:** Escape key or clicking outside the modal. Fields are cleared.
- **Validation feedback:** Inline error messages (red text below the input) for invalid values. No submission occurs until inputs are valid.
- **Loading state:** The "Create" button shows "Creating..." and is disabled during the API call.

> **Design decision — modal over inline form:**
> A modal was chosen over an inline form in the sidebar because the creation inputs (especially the textarea for move sequences) benefit from more horizontal space than the sidebar provides. The modal also provides a focused context that reduces the chance of accidental interaction with other controls during creation.

---

## 11. Grid Visualization

### 11.1 Grid Architecture

The grid represents the infinite 2D plane where robots move. Only cells that contain a robot or a delivered house are rendered as DOM elements. Empty grid cells are not rendered — the grid line pattern is drawn via a CSS background on the grid container.

The grid container is sized dynamically to the bounding box of all occupied coordinates (robots + houses with delivered presents), plus padding. The center area acts as a scrollable viewport (`overflow: auto`) over this container.

### 11.2 Robot Rendering

Each robot is rendered as a small SVG icon positioned on the grid using CSS `transform: translate(x, y)`. Robots are visually distinguished by color, assigned via HSL hue spacing (`hue = (turnOrder / robotCount) * 360`).

When multiple robots occupy the same cell, their SVG icons are stacked with a slight offset so that all are partially visible.

### 11.3 House Rendering

Houses that have received at least one present are rendered as a small gift-box SVG icon (a box with a ribbon and bow). Houses with no deliveries do not exist in the data and are not rendered — the grid background provides the visual structure for empty space.

### 11.4 Zoom

The grid supports zoom in and zoom out via `+` and `−` buttons positioned at a corner of the grid viewport. Zoom is implemented via CSS `transform: scale()` on the grid container. The zoom level is constrained to a reasonable range (e.g., 0.25× to 3×).

Mouse wheel zoom (Ctrl+scroll) may be added as a polish item if time permits, but the button controls are the primary interface.

### 11.5 Click-to-Scroll from Robot List

Clicking a robot's name in the control panel scrolls the grid viewport to center on that robot's current position. This is implemented via `Element.scrollIntoView()` on the robot's SVG element, using the `{ behavior: 'smooth', block: 'center', inline: 'center' }` options. Each robot SVG carries a `data-robot-id` attribute for lookup.

> **Design decision — translate positioning over CSS Grid placement:**
> Robots and houses are positioned using `transform: translate()` rather than `grid-row` / `grid-column`. This was chosen because `translate` enables smooth CSS `transition` animations when robots move between cells, which `grid-row`/`grid-column` changes do not support. Even if animations are not implemented in v1, the positioning strategy is ready for them without refactoring.

> **Design decision — sparse rendering over full grid:**
> Rendering only occupied cells keeps DOM node count proportional to the number of robots and visited houses, not to the grid area. A 3-robot simulation that covers a 100×100 area might have ~20 house elements and 3 robot elements — not 10,000 empty cells. This is essential for large move sequences that produce far-reaching movement patterns.

> **Design decision — CSS background for grid lines:**
> Grid lines are drawn using a `repeating-linear-gradient` or `background-size` pattern on the grid container, rather than rendering border-styled elements for every cell. This produces grid lines across the entire visible area at zero DOM cost, regardless of how far the viewport is scrolled.

> **Design decision — no robot tooltips:**
> We considered adding hover tooltips on robot SVGs showing the robot's name. A `<title>` element inside the SVG would provide this for free on single robots. However, when multiple robots occupy the same cell, only the topmost SVG's tooltip would display, creating an inconsistent experience. Since robot names and colors are already paired in the sidebar robot list, and click-to-scroll provides a way to locate any robot, tooltips were omitted to avoid partial functionality.

---

## 12. Visual Design

### 12.1 CSS Foundation

The application uses a CSS custom properties design system for consistent theming:

- **Colors:** Defined as CSS custom properties (`--color-primary`, `--color-surface`, `--color-text`, `--color-border`, etc.)
- **Typography:** System font stack for body text; monospace for move sequences, coordinates, and code-like content.
- **Spacing:** Consistent spacing scale (`--space-xs` through `--space-xl`).
- **Radii, shadows, transitions:** Shared tokens for border-radius, box-shadow, and transition durations.

A CSS reset (or normalize) is applied globally to ensure cross-browser consistency.

### 12.2 Dark Mode

Dark mode is supported via `prefers-color-scheme: dark` media query. The custom property values are swapped for dark variants (lighter text on darker backgrounds). This requires approximately 10–15 lines of CSS overriding the property values. No JavaScript toggle is needed — the application respects the user's OS preference.

### 12.3 Visual Details

- Buttons and cards have subtle `box-shadow` for depth.
- Hover states shift color tokens slightly (e.g., a darker shade of the primary color).
- `focus-visible` outlines are applied to all interactive elements for keyboard navigation.
- Status badges use color coding: gray for "created", blue for "running", green for "completed".
- Move sequences and coordinates are displayed in monospace font.
- The overall aesthetic aims for a clean, functional "simulation control panel" feel — not a decorative or marketing-style design.

### 12.4 Animations and Motion

If `prefers-reduced-motion` is not set to `reduce`, subtle transitions are used:

- Button hover/active state transitions.
- Modal fade-in/out.
- Robot position transitions when stepping (translate animation from old position to new position).
- Progress bar width transitions.

When `prefers-reduced-motion: reduce` is active, all transitions and animations are disabled via a blanket `*, *::before, *::after { transition: none !important; animation: none !important; }` rule.

No animation adds delay to a user action — all are visual feedback that occurs after or alongside the action completing.

> **Design decision — CSS custom properties over utility classes:**
> Utility class frameworks (e.g., Tailwind CSS) were considered. While they speed up prototyping, they add a build dependency, increase HTML verbosity, and work against the assessment goal of demonstrating CSS understanding. Custom properties provide the same consistency benefits (single source of truth for design tokens) with standard CSS that any developer can read and modify without framework knowledge.

> **Design decision — prefers-color-scheme over manual toggle:**
> A manual dark/light toggle would require state management (localStorage + reactive variable). Respecting the OS preference via a media query achieves dark mode support with zero JavaScript, which aligns with the project's preference for simplicity. A manual toggle can be layered on later if needed.

---

## 13. Loading, Error, and Empty States

### 13.1 Loading States

Every view that fetches data has three possible states: **loading**, **empty**, and **populated**.

- **Loading:** Shown immediately while the API call is in flight. Uses skeleton loaders (pulsing gray rectangles matching the layout of the content that will appear). This prevents layout shift when data arrives.
- **Empty:** Shown when data returns successfully but has no items (e.g., no simulations created yet). Displays a friendly message with a call to action (e.g., "No simulations yet — create one to get started").
- **Populated:** Normal display of returned data.

For action buttons (Step, Run, Create), the button text changes during the API call ("Stepping...", "Running...", "Creating...") and the button is disabled to prevent duplicate submissions.

### 13.2 Error States

Errors from API calls are displayed inline, near the control that triggered them:

- **Form validation errors:** Red border on the input + red text message below it.
- **API errors:** Red text message displayed below the button or in a designated error area within the relevant panel.
- **Optional:** A subtle CSS shake animation on the error message container to draw attention (disabled when `prefers-reduced-motion: reduce`).

No toast notifications are used. Inline errors are more accessible (screen readers announce them in context) and do not require a notification management system.

### 13.3 Client-Side Logging

`console.error()` calls for failed API responses are gated behind `import.meta.env.DEV` so they are tree-shaken out of production builds. This keeps the production bundle clean while providing debugging information during development.

> **Design decision — skeleton loaders over spinners:**
> Skeleton loaders reserve the exact layout space of the incoming content, preventing Cumulative Layout Shift (CLS). Spinners provide no layout hint and cause content to "jump in" when data arrives. For a data-driven dashboard-style application, skeletons are the standard modern approach.

> **Design decision — inline errors over toasts:**
> Toast notifications require a notification management layer (queue, auto-dismiss timers, stacking logic) and present accessibility challenges (screen reader announcement timing, focus management). Inline errors appear in context next to the triggering control, are announced by screen readers naturally as part of the form, and require no additional infrastructure.

---

## 14. Accessibility & Performance

### 14.1 Accessibility

The application targets WCAG 2.1 Level AA compliance:

- **Semantic HTML:** `<nav>`, `<main>`, `<aside>`, `<button>`, `<input>`, `<form>` used for their intended purposes. No `<div>` buttons.
- **ARIA labels:** All interactive elements have accessible names. The grid viewport has `role="img"` with an `aria-label` describing the simulation state.
- **Keyboard navigation:** Tab moves between major control groups (create button → simulation list → step button → run button → other controls). Arrow keys navigate within the simulation list. All interactive elements are reachable and operable without a mouse.
- **Focus management:** `focus-visible` outlines on all focusable elements. When a modal opens, focus is trapped within it and returned to the trigger element on close.
- **Color contrast:** All text/background combinations meet WCAG AA contrast ratios (4.5:1 for normal text, 3:1 for large text).
- **Live regions:** Status updates (step results, error messages) are announced to screen readers via `aria-live="polite"` regions.
- **Reduced motion:** All animations and transitions respect `prefers-reduced-motion: reduce` (see §12.4).

### 14.2 Performance Targets

- **Bundle size:** Target < 50KB gzipped for all JavaScript and CSS (Vue + application code). Vue 3's tree-shaking and Vite's bundling make this achievable for a small application.
- **Core Web Vitals awareness:**
  - **LCP (Largest Contentful Paint):** The grid container or simulation list should paint within 2.5s. No external fonts or large images to block rendering.
  - **CLS (Cumulative Layout Shift):** Skeleton loaders reserve space; no content shifts after data loads.
  - **INP (Interaction to Next Paint):** All button clicks trigger immediate visual feedback (disabled state + text change). API responses update the UI without blocking the main thread.
- **DOM efficiency:** Sparse grid rendering keeps node count proportional to occupied cells, not grid area (see §11.1).

### 14.3 Development Tooling

- **Vitest + Vue Test Utils** for component unit tests.
- **unlighthouse** for automated accessibility and performance auditing across all pages.
- **autoprefixer** via PostCSS for vendor prefix management.

> **Design decision — desktop-first responsive design:**
> The application is an interactive simulation dashboard with a three-panel layout, zoom controls, and a grid viewport. This is inherently a desktop experience. The CSS starts with the desktop layout and adds a mobile breakpoint that collapses sidebars for basic usability on smaller screens. This is the opposite of the typical mobile-first approach, but appropriate for the tool's nature — similar to how a code editor or design tool prioritizes the desktop experience.

---

## 15. Component Architecture

### 15.1 Component Tree

```
App.vue                             (owns all state, handles all API calls)
├── SimulationList.vue              (left sidebar)
├── CreateSimulationModal.vue       (modal overlay)
├── WelcomeScreen.vue               (center, when no sim selected)
├── SimulationView.vue              (center, presentational wrapper)
│   └── SimulationGrid.vue          (grid viewport)
│       ├── RobotMarker.vue         (SVG robot icon, per robot)
│       └── HouseMarker.vue         (SVG gift box icon, per house)
└── ControlPanel.vue                (right sidebar)
```

### 15.2 Component Responsibilities

| Component                   | Role                                                                                                                                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `App.vue`                   | Layout shell. Owns all application state (list, selected simulation detail, action flags). Handles all API calls (list, load, step, run, houses query). Passes props to children and handles their events. |
| `SimulationList.vue`        | Renders the list of simulations. Emits selection events.                                                                                                                                                   |
| `CreateSimulationModal.vue` | Form inputs, validation, arrow key capture, API call to create.                                                                                                                                            |
| `WelcomeScreen.vue`         | Shown when no simulation is selected. Prompt to create or select.                                                                                                                                          |
| `SimulationView.vue`        | Presentational wrapper for the center area. Displays loading, error (with retry), or SimulationGrid based on props. Exposes `scrollToRobot()` via ref.                                                     |
| `SimulationGrid.vue`        | Renders the grid background, robot markers, and house markers. Handles zoom and scroll.                                                                                                                    |
| `RobotMarker.vue`           | Single SVG robot icon. Props: color, x, y, robot ID.                                                                                                                                                       |
| `HouseMarker.vue`           | Single SVG gift box icon. Props: x, y.                                                                                                                                                                     |
| `ControlPanel.vue`          | Step/Run buttons, progress bar, stats, houses query input, robot list with click-to-scroll.                                                                                                                |

### 15.3 State Management

There is no external state management library (Pinia, Vuex). State is managed via standard Vue Options API `data()` and `props`/`emits` between parent and child components.

- **`App.vue`** owns: `selectedSimulationId`, `simulations[]` (the list), `simulation`, `robots[]`, `houses[]`, `summary`, `houseQueryResult`, `loadingSimulation`, `simulationError`, `isStepLoading`, `isRunLoading`.
- **`SimulationView.vue`** owns no state — it is purely presentational and receives all data as props.

This is sufficient because the component tree is shallow (max 3 levels deep) and App.vue can pass props directly to both `SimulationView` and `ControlPanel` as siblings without any bridging patterns.

> **Design decision — no Pinia/Vuex:**
> State management libraries add value when state must be shared across deeply nested or sibling component trees. This application has a shallow hierarchy where `App.vue` naturally owns all simulation-related state and passes it down via props to both `SimulationView` (center grid) and `ControlPanel` (right sidebar) as siblings. Adding Pinia would introduce indirection (store files, action definitions, getter patterns) without solving any state-sharing problem that doesn't already have a simpler solution. If the component tree deepens significantly, Pinia could be introduced for specific state slices without refactoring existing components.

> **Design decision — no Vue Router:**
> The application has exactly two visual states: "no simulation selected" and "simulation selected." This binary is managed by a single reactive variable (`selectedSimulationId`). Vue Router would add URL-based navigation, which enables deep linking and browser back/forward support — but also requires route definitions, navigation guards, and the router dependency. For this application's scope, the trade-off favors simplicity. If deep linking becomes important (e.g., sharing a URL to a specific simulation), Vue Router can be added and the `selectedSimulationId` moved to a route parameter with minimal refactoring.

---

## 16. Robot SVG & Favicon

A single SVG robot icon is used throughout the application: as robot markers on the grid, as color swatches in the robot list, and as the browser favicon. The SVG is approximately 15–20 lines and accepts a `color` prop for the body fill. The same SVG file (or an inline variant) is used as the favicon for visual branding consistency.
