/**
 * Route handlers for /api/v1/simulations.
 *
 * Each handler validates input via middleware, calls the appropriate
 * service or repository function, formats the response per spec §4,
 * and forwards unexpected errors to the global error handler.
 */

import { Router } from 'express';
import { db } from '../db/connection.js';
import { assignRobotNames } from '../utils/robotNames.js';
import {
  createSimulation,
  getSimulation,
  listSimulations,
} from '../repositories/simulationRepository.js';
import {
  createRobots,
  getRobotsBySimulation,
} from '../repositories/robotRepository.js';
import {
  getTotalPresents,
  countHousesWithMinPresents,
} from '../repositories/houseRepository.js';
import { stepSimulation, runSimulation } from '../services/simulationService.js';
import {
  validateCreateSimulation,
  validateSimulationId,
  validateHouseQuery,
} from '../middleware/validate.js';

const router = Router();

// --- Helpers ---

/**
 * Formats a simulation DB row into the full API response shape.
 * Used by create (§4.1), list (§4.7), and detail (§4.8) endpoints.
 */
function formatSimulation(row) {
  return {
    id: row.id,
    robotCount: row.robot_count,
    moveSequence: row.move_sequence,
    currentStep: row.current_step,
    totalSteps: row.move_sequence.length,
    status: row.status,
    createdAt: row.created_at,
  };
}

/**
 * Formats a robot DB row into the API response shape.
 */
function formatRobot(row) {
  return {
    name: row.name,
    turnOrder: row.turn_order,
    position: { x: row.position_x, y: row.position_y },
  };
}

/**
 * Maps known service error codes to HTTP status codes.
 * Unknown errors are forwarded to the global error handler.
 */
function handleServiceError(err, res, next) {
  if (err.code === 'SIMULATION_NOT_FOUND') {
    return res.status(404).json({
      error: { code: err.code, message: err.message },
    });
  }
  if (err.code === 'SIMULATION_COMPLETED') {
    return res.status(409).json({
      error: { code: err.code, message: err.message },
    });
  }
  next(err);
}

/**
 * Fetches a simulation and returns 404 if not found.
 * Returns the row on success, or null after sending the 404 response.
 */
function getSimulationOr404(simulationId, res) {
  const sim = getSimulation(db, simulationId);
  if (!sim) {
    res.status(404).json({
      error: {
        code: 'SIMULATION_NOT_FOUND',
        message: `No simulation found with id ${simulationId}`,
      },
    });
    return null;
  }
  return sim;
}

// --- Routes ---

// ── Authentication (not implemented in v1) ──────────────────────────
// In production, an auth middleware would be applied here:
//
//   import { authenticate } from '../middleware/auth.js';
//   router.use(authenticate);
//
// The middleware would:
//   1. Extract the Bearer token from the Authorization header
//   2. Verify the JWT signature and check expiration
//   3. Look up the user by token claims (e.g. sub → users.id)
//   4. Attach the user to the request: req.user = { id, name }
//   5. Return 401 Unauthorized if the token is missing or invalid
//
// Each handler below would then use req.user.id instead of the
// hardcoded userId = 1. The user_id columns already exist in the
// schema, so enabling auth requires no migrations — only adding
// the middleware and swapping the constant. See spec §6.3.
// ─────────────────────────────────────────────────────────────────────

// POST /simulations — Create simulation (spec §4.1)
router.post('/', validateCreateSimulation, (req, res, next) => {
  try {
    const robotCount = req.body.robotCount ?? 1;
    const { moveSequence } = req.body;
    const userId = 1; // AUTH: would be req.user.id

    const sim = createSimulation(db, { userId, moveSequence, robotCount });
    const names = assignRobotNames(robotCount);
    createRobots(db, sim.id, names);
    const robots = getRobotsBySimulation(db, sim.id);

    res.status(201).json({
      simulation: formatSimulation(sim),
      robots: robots.map(formatRobot),
    });
  } catch (err) {
    next(err);
  }
});

// POST /simulations/:id/step — Step one turn (spec §4.2)
router.post('/:id/step', validateSimulationId, (req, res, next) => {
  try {
    const result = stepSimulation(db, req.simulationId);
    const sim = getSimulation(db, req.simulationId);

    const message = result.delivered
      ? `${result.robotName} moved to (${result.to.x}, ${result.to.y}) and delivered a present!`
      : `${result.robotName} moved to (${result.to.x}, ${result.to.y}) but couldn't deliver \u2014 another robot was already there.`;

    res.json({
      turn: {
        robotName: result.robotName,
        direction: result.direction,
        from: result.from,
        to: result.to,
        delivered: result.delivered,
        message,
      },
      simulation: {
        id: sim.id,
        currentStep: sim.current_step,
        totalSteps: sim.move_sequence.length,
        status: sim.status,
      },
    });
  } catch (err) {
    handleServiceError(err, res, next);
  }
});

// POST /simulations/:id/run — Run full simulation (spec §4.3)
router.post('/:id/run', validateSimulationId, (req, res, next) => {
  try {
    runSimulation(db, req.simulationId);

    const sim = getSimulation(db, req.simulationId);
    const robots = getRobotsBySimulation(db, req.simulationId);
    const totalPresents = getTotalPresents(db, req.simulationId);
    const housesWithPresents = countHousesWithMinPresents(
      db,
      req.simulationId,
      1
    );

    res.json({
      simulation: {
        id: sim.id,
        currentStep: sim.current_step,
        totalSteps: sim.move_sequence.length,
        status: sim.status,
      },
      robots: robots.map(formatRobot),
      summary: {
        totalPresentsDelivered: totalPresents,
        housesWithPresents,
      },
    });
  } catch (err) {
    handleServiceError(err, res, next);
  }
});

// GET /simulations — List all simulations (spec §4.7)
router.get('/', (_req, res, next) => {
  try {
    const userId = 1; // AUTH: would be req.user.id
    const sims = listSimulations(db, userId);

    res.json({
      simulations: sims.map(formatSimulation),
    });
  } catch (err) {
    next(err);
  }
});

// GET /simulations/:id — Get simulation details (spec §4.8)
router.get('/:id', validateSimulationId, (req, res, next) => {
  try {
    const sim = getSimulationOr404(req.simulationId, res);
    if (!sim) return;

    const robots = getRobotsBySimulation(db, req.simulationId);
    const totalPresents = getTotalPresents(db, req.simulationId);
    const housesWithPresents = countHousesWithMinPresents(
      db,
      req.simulationId,
      1
    );

    res.json({
      simulation: formatSimulation(sim),
      robots: robots.map(formatRobot),
      summary: {
        totalPresentsDelivered: totalPresents,
        housesWithPresents,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /simulations/:id/robots — Get robot positions (spec §4.4)
router.get('/:id/robots', validateSimulationId, (req, res, next) => {
  try {
    const sim = getSimulationOr404(req.simulationId, res);
    if (!sim) return;

    const robots = getRobotsBySimulation(db, req.simulationId);

    res.json({
      simulationId: sim.id,
      currentStep: sim.current_step,
      robots: robots.map(formatRobot),
    });
  } catch (err) {
    next(err);
  }
});

// GET /simulations/:id/houses — Count houses by threshold (spec §4.5)
router.get(
  '/:id/houses',
  validateSimulationId,
  validateHouseQuery,
  (req, res, next) => {
    try {
      const sim = getSimulationOr404(req.simulationId, res);
      if (!sim) return;

      const houseCount = countHousesWithMinPresents(
        db,
        req.simulationId,
        req.minPresents
      );

      res.json({
        simulationId: sim.id,
        minPresents: req.minPresents,
        houseCount,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /simulations/:id/presents — Get total presents (spec §4.6)
router.get('/:id/presents', validateSimulationId, (req, res, next) => {
  try {
    const sim = getSimulationOr404(req.simulationId, res);
    if (!sim) return;

    const totalPresents = getTotalPresents(db, req.simulationId);

    res.json({
      simulationId: sim.id,
      totalPresents,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
