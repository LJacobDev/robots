/**
 * Repository functions for the simulations table.
 *
 * Every function takes a `db` instance as its first argument so that
 * callers can inject an in-memory database during tests.
 */

/**
 * Creates a new simulation and returns the full row.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {{ userId: number, moveSequence: string, robotCount: number }} params
 * @returns {{ id: number, user_id: number, move_sequence: string, robot_count: number, current_step: number, status: string, created_at: string }}
 */
export function createSimulation(db, { userId, moveSequence, robotCount }) {
  const createdAt = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO simulations (user_id, move_sequence, robot_count, created_at)
       VALUES (?, ?, ?, ?)`
    )
    .run(userId, moveSequence, robotCount, createdAt);

  return db.prepare('SELECT * FROM simulations WHERE id = ?').get(result.lastInsertRowid);
}

/**
 * Returns a single simulation row by ID, or null if not found.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {number} simulationId
 * @returns {{ id: number, user_id: number, move_sequence: string, robot_count: number, current_step: number, status: string, created_at: string } | null}
 */
export function getSimulation(db, simulationId) {
  return db.prepare('SELECT * FROM simulations WHERE id = ?').get(simulationId) ?? null;
}

/**
 * Returns all simulations for a given user, ordered by creation time (newest first).
 *
 * @param {import('better-sqlite3').Database} db
 * @param {number} userId
 * @returns {Array<{ id: number, user_id: number, move_sequence: string, robot_count: number, current_step: number, status: string, created_at: string }>}
 */
export function listSimulations(db, userId) {
  return db.prepare('SELECT * FROM simulations WHERE user_id = ? ORDER BY id DESC').all(userId);
}

/**
 * Updates a simulation's current_step and status.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {number} simulationId
 * @param {number} newStep
 * @param {string} newStatus - 'running' or 'completed'
 * @returns {number} Number of rows changed (1 on success)
 * @throws {Error} If no simulation exists with the given ID
 */
export function updateSimulationStep(db, simulationId, newStep, newStatus) {
  const result = db
    .prepare('UPDATE simulations SET current_step = ?, status = ? WHERE id = ?')
    .run(newStep, newStatus, simulationId);

  if (result.changes === 0) {
    throw new Error(`No simulation found with id ${simulationId}`);
  }
  return result.changes;
}
