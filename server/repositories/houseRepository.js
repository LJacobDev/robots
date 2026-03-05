/**
 * Repository functions for the houses table.
 *
 * Every function takes a `db` instance as its first argument so that
 * callers can inject an in-memory database during tests.
 */

/**
 * Delivers a present to a house at (x, y) in a simulation.
 *
 * Uses an upsert pattern: if the house already exists, increments
 * presents_count; otherwise inserts a new row with presents_count = 1.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {number} simulationId
 * @param {number} x
 * @param {number} y
 * @returns {number} Number of rows changed by the UPDATE (0 if this was a fresh insert, 1 if incremented)
 */
export function deliverPresent(db, simulationId, x, y) {
  db.prepare(
    `INSERT OR IGNORE INTO houses (simulation_id, x, y, presents_count)
     VALUES (?, ?, ?, 0)`
  ).run(simulationId, x, y);

  const result = db
    .prepare(
      `UPDATE houses SET presents_count = presents_count + 1
       WHERE simulation_id = ? AND x = ? AND y = ?`
    )
    .run(simulationId, x, y);

  return result.changes;
}

/**
 * Returns the total number of presents delivered across all houses in a simulation.
 *
 * Returns 0 if no houses exist yet (no deliveries made).
 *
 * @param {import('better-sqlite3').Database} db
 * @param {number} simulationId
 * @returns {number}
 */
export function getTotalPresents(db, simulationId) {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(presents_count), 0) AS total
       FROM houses WHERE simulation_id = ?`
    )
    .get(simulationId);
  return row.total;
}

/**
 * Counts the number of houses that have received at least `minPresents` presents.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {number} simulationId
 * @param {number} minPresents - Minimum presents threshold (inclusive)
 * @returns {number}
 */
export function countHousesWithMinPresents(db, simulationId, minPresents) {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count FROM houses
       WHERE simulation_id = ? AND presents_count >= ?`
    )
    .get(simulationId, minPresents);
  return row.count;
}

/**
 * Returns all houses for a simulation, ordered by coordinates.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {number} simulationId
 * @returns {Array<{ id: number, simulation_id: number, x: number, y: number, presents_count: number }>}
 */
export function getHousesBySimulation(db, simulationId) {
  return db.prepare('SELECT * FROM houses WHERE simulation_id = ? ORDER BY x, y').all(simulationId);
}
