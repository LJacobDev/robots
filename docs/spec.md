# Robots Simulation — Specification

## Version 1.0 — Backend API & Data Model

---

## 1. Overview

A web application that simulates robots delivering presents on an infinite 2D grid. Users create simulations with a configurable number of robots and a movement instruction string. Robots take turns executing moves in round-robin order, delivering presents to houses they visit — unless another robot already occupies that space.

The backend exposes a RESTful API. The frontend (specified in a future version of this spec) provides a visual interface for creating, controlling, and observing simulations.

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

Returns full details for a single simulation including robots and house data.

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
> The requirements specify 6 operations (create, step, run, query robots, query houses by threshold, query total presents). Two additional endpoints have been added: List Simulations (4.7) and Get Simulation Details (4.8). List Simulations is necessary for any frontend — without it, a user who refreshes the page has no way to discover existing simulation IDs. Get Simulation Details combines simulation metadata, robot positions, and a present summary into a single response, avoiding the need for 3 separate API calls to render a simulation's full state. Both endpoints reuse existing repository functions and introduce no new database queries, so their implementation cost is negligible and they create no redundancy with the required endpoints.

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

| Layer    | Choice                              | Rationale                                                             |
| -------- | ----------------------------------- | --------------------------------------------------------------------- |
| Frontend | Vue 3.5+, Options API               | Team compatibility; Composition API noted as alternative              |
| Bundler  | Vite                                | Standard for Vue 3; fast HMR in dev, optimized builds                 |
| Backend  | Node.js + Express                   | Simple API endpoints; SSR not needed (Nuxt considered, rejected)      |
| Language | JavaScript                          | TypeScript adds friction for this project's scope                     |
| Database | SQLite via better-sqlite3           | Zero setup; repository pattern enables trivial Postgres migration     |
| Testing  | Vitest + Supertest                  | Vitest for unit/integration tests; Supertest for HTTP-level API tests |
| Linting  | ESLint v10 (flat config) + Prettier | Root-level config covering client + server                            |
| Security | helmet.js + cors                    | Production-standard headers and origin control                        |

> **Design decision — Express over Nuxt:**
> Nuxt was considered since it unifies frontend and backend in a single framework. However, the application requires only a simple API and a single-page frontend — Nuxt's SSR, file-based routing, and auto-imports add complexity without corresponding benefit. Express is a well-understood, lightweight server that does exactly what is needed. If the application grew to need SEO or server-rendered pages, Nuxt would become the stronger choice.

> **Design decision — SPA over SSR:**
> This application is a single-page interactive tool with no public content that needs search engine indexing. SSR would add build complexity (hydration, server/client code splitting) without benefit. A static SPA served by Express is the simplest correct architecture for this use case.

> **Design decision — Options API over Composition API:**
> The Composition API is the more modern Vue pattern and the developer's usual API of choice. However, the Options API was chosen for team compatibility, as it aligns with the conventions used by the reviewing team. Both APIs are fully supported in Vue 3.5+ and can coexist in the same project if needed.
