import Database from 'better-sqlite3';
import path from 'path';
import { mkdirSync } from 'fs';

const dbPath = path.resolve(process.env.DATABASE_PATH || './data/robots.db');

// Ensure the directory exists (important on a fresh clone where data/ may not exist)
mkdirSync(path.dirname(dbPath), { recursive: true });

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