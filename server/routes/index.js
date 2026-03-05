import { Router } from 'express';

/**
 * Creates and returns the main API v1 router.
 *
 * Sub-routers for each resource are mounted here. A 404 handler at the
 * end catches any request that doesn't match a known API route.
 *
 * @returns {import('express').Router}
 */
export function createApiRouter() {
  const router = Router();

  // Health check — confirms the API is reachable
  router.get('/', (req, res) => {
    res.json({ message: 'Robots API v1' });
  });

  // TODO 1.8: mount simulation routes
  // import simulationsRouter from './simulations.js';
  // router.use('/simulations', simulationsRouter);

  // 404 handler for unmatched API routes (must be last in this router)
  router.use((req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `No API route found for ${req.method} ${req.originalUrl}`,
      },
    });
  });

  return router;
}