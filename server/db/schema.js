/**
 * Initializes the database schema and seeds required baseline data.
 *
 * Creates all four tables and their indexes using IF NOT EXISTS, so this
 * is safe to call on every server startup without risk of data loss.
 * Seeds the default user (id=1) if it is not already present.
 *
 * @param {import('better-sqlite3').Database} db
 */
export function initializeDatabase(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS simulations (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id),
      move_sequence TEXT    NOT NULL,
      robot_count   INTEGER NOT NULL,
      current_step  INTEGER NOT NULL DEFAULT 0,
      status        TEXT    NOT NULL DEFAULT 'created',
      created_at    TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS robots (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      simulation_id INTEGER NOT NULL REFERENCES simulations(id),
      name          TEXT    NOT NULL,
      position_x    INTEGER NOT NULL DEFAULT 0,
      position_y    INTEGER NOT NULL DEFAULT 0,
      turn_order    INTEGER NOT NULL,
      UNIQUE (simulation_id, turn_order)
    );

    CREATE TABLE IF NOT EXISTS houses (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      simulation_id  INTEGER NOT NULL REFERENCES simulations(id),
      x              INTEGER NOT NULL,
      y              INTEGER NOT NULL,
      presents_count INTEGER NOT NULL DEFAULT 1,
      UNIQUE (simulation_id, x, y)
    );

    CREATE INDEX IF NOT EXISTS idx_robots_simulation_id ON robots(simulation_id);
    CREATE INDEX IF NOT EXISTS idx_houses_simulation_id ON houses(simulation_id);
  `);

  // Seed the default user if not already present
  const defaultUser = db.prepare('SELECT id FROM users WHERE id = 1').get();
  if (!defaultUser) {
    db.prepare("INSERT INTO users (id, name) VALUES (1, 'default')").run();
    console.log('[db] Seeded default user (id=1)');
  }

  console.log('[db] Schema initialized');
}