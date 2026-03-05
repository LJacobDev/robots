/**
 * Database connection module.
 *
 * Opens (or creates) the SQLite database at the path specified by the
 * DATABASE_PATH environment variable, enables WAL mode for better
 * concurrent read performance, and exports the connection instance.
 */

import Database from 'better-sqlite3';
import path from 'path';
import { mkdirSync } from 'fs';

const dbPath = path.resolve(process.env.DATABASE_PATH || './data/robots.db');

// Ensure the directory exists (important on a fresh clone where data/ may not exist)
mkdirSync(path.dirname(dbPath), { recursive: true });

/** @type {import('better-sqlite3').Database} */
let db;

try {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  console.log(`[db] Connected to ${dbPath}`);
} catch (err) {
  console.error(`[db] Failed to connect to ${dbPath}:`, err.message);
  process.exit(1);
}

export { db };
