# Findings, Decisions & Actions

This file traces discoveries made during implementation that caused the plan or spec to evolve.

---

## 2026-03-04 — Technology Version Check (Pre-Implementation)

Checked current stable versions of all planned dependencies against documentation. Key findings:

### Express 5 is now the default on npm (v5.2.1)

`npm install express` now installs v5, not v4. Express 5 has minor API changes: `app.del()` removed (use `app.delete()`), `req.query` is read-only, `res.send(obj, status)` signature removed (use `res.status(s).send(obj)`), default query parser changed from "extended" to "simple".

**Decision:** Use Express 5 since this is a new project. Our planned usage (`app.use()`, `app.get()`, `app.post()`, `app.listen()`) is unchanged. The API changes don't affect us.

**Action:** Update spec §7 and plan references from "Express" to note v5. No code changes needed — just awareness.

### ESLint 10 is now current (v10.0.2)

ESLint 10 was released February 2026. The `.eslintrc` format is completely removed — flat config (`eslint.config.js`) is the only supported format. Node.js < 20.19.0 is no longer supported.

**Decision:** Use ESLint 10 instead of ESLint 9. Our plan already specifies flat config, so this is a clean upgrade. `eslint-plugin-vue` and `eslint-config-prettier` both support ESLint 10.

**Action:** Update plan references from "ESLint v9" to "ESLint v10". Ensure `.nvmrc` specifies Node 20+.

### Vite 7 requires Node.js 20+ (v7.3.1)

Vite 7 dropped Node.js 18 support. Minor config changes: `splitVendorChunkPlugin` removed, `transformIndexHtml` hook uses `order` instead of `enforce`.

**Decision:** Use Vite 7. We'll specify Node.js 20 LTS in `.nvmrc`.

**Action:** Set `.nvmrc` to Node 20 LTS (20.19.0 or later).

### Vitest 4 is current (v4.0.18)

Vitest 4 has breaking changes to `poolOptions` (removed, now top-level) and mock behavior (`vi.fn().getMockName()` returns `"vi.fn()"` instead of `"spy"`). Core `describe/it/expect/vi` API is unchanged.

**Decision:** Use Vitest 4. Our planned usage (standard test suites) is unaffected.

### dotenv 17 changed quiet default (v17.3.1)

`dotenv.config()` now logs a startup message by default. Pass `{ quiet: true }` to suppress.

**Decision:** Use `dotenv.config({ quiet: true })` to keep console output clean and controlled by our own logging.

### No issues found

- **better-sqlite3** (v12.6.2): Core sync API unchanged. Works fine.
- **helmet** (v8.1.0): Stable, no breaking changes. Works with Express 5.
- **cors** (v2.8.6): Stable, works with Express 5.
- **Supertest** (v7.2.2): Works with Vitest. Test-runner agnostic.
- **Vue** (v3.5.29): Options API fully supported. Not deprecated.
- **globals** (v17.4.0): Standard way to declare environments in ESLint flat config.

### Node.js version requirement

ESLint 10 requires Node.js >= 20.19.0, Vite 7 requires Node.js >= 20. Both constraints are satisfied by Node 20 LTS.

**Action:** `.nvmrc` must specify `20` (or a specific 20.x.x LTS version).

---

## 2026-03-04 — Repository Write Functions Return `result.changes`

During Step 1.5 planning, discussed whether repository write functions (`updateSimulationStep`, `updateRobotPosition`, `deliverPresent`) should return `void` or a value.

**Decision:** All three return `result.changes` (the integer count of rows affected by the statement). This provides two benefits:

1. **Guard against silent no-ops:** If `changes === 0`, the function throws immediately, catching bugs like updating a nonexistent simulation or robot without needing a follow-up query.
2. **Avoids redundant reads:** The service layer already loads the entity before updating, so it can compute the new state in memory. Returning `changes` confirms success without re-querying.

Read-only functions and inserts are unaffected — reads return data or null naturally, and inserts throw on constraint violations via SQLite.

**Action:** Implemented in `simulationRepository.js`, `robotRepository.js`, and `houseRepository.js`.

---

## 2026-03-04 — `runSimulation` Does Not Accumulate a Step History Array

During Step 1.6 implementation, the initial version of `runSimulation` collected each step's result into an array and returned it. Reviewed whether this was appropriate.

**Finding:** The `/run` endpoint only needs to return the final state (robot positions, house counts, total presents). No requirement asks for a step-by-step history. The console logging inside each `stepSimulation` call already provides a debug trace.

**Concern:** Simulations could have thousands of steps. Accumulating an object per step wastes memory for data that has no consumer. The route handler would still need to query the DB for aggregates (total presents, house counts) regardless, so the array doesn't even eliminate DB reads.

**Decision:** `runSimulation` loops `stepSimulation` internally without collecting results. The route handler queries final state from the DB after the run completes.

**Action:** Removed the `results` array from `runSimulation`. Updated tests to verify final state via repository queries instead of inspecting returned step objects.
