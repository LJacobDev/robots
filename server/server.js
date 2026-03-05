import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApiRouter } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { db } from './db/connection.js';
import { initializeDatabase } from './db/schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:5173'];

// Initialize database schema and seed data on startup
initializeDatabase(db);

/** Express application instance. Exported for Supertest integration tests. */
export const app = express();

// Security middleware
app.use(helmet());
app.use(cors({ origin: ALLOWED_ORIGINS }));

// Request body parsing
app.use(express.json());

// API routes
// Authentication note: add auth middleware here before routes — app.use(authenticate);
app.use('/api/v1', createApiRouter());

// In production, serve the Vite-built frontend and handle SPA routing
if (NODE_ENV === 'production') {
  app.use(express.static(path.join(rootDir, 'dist')));
  app.use((_req, res) => {
    res.sendFile(path.join(rootDir, 'dist', 'index.html'));
  });
}

// Global error handler (must be registered after all routes)
app.use(errorHandler);

// Start the HTTP server only when this file is run directly, not when imported by tests
if (path.resolve(process.argv[1]) === path.resolve(__filename)) {
  app.listen(PORT, () => {
    console.log(`[server] Started on port ${PORT} (${NODE_ENV})`);
  });
}
