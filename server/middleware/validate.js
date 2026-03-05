/**
 * Strips ASCII control characters (0x00–0x1F, 0x7F) from a string.
 * These characters are invisible and can cause issues in logging or storage.
 *
 * @param {string} str
 * @returns {string}
 */
function stripControlChars(str) {
  // eslint-disable-next-line no-control-regex -- intentional: stripping control chars from user input
  return str.replace(/[\x00-\x1F\x7F]/g, '');
}

/**
 * Validation middleware for POST /api/v1/simulations.
 *
 * - robotCount: optional, defaults to 1 if omitted. Must be an integer >= 1.
 * - moveSequence: required. Normalized with toUpperCase() (v → V) and control
 *   character stripping before validation. Must be non-empty and contain only
 *   ^, V, <, >. The cleaned value is written back to req.body.moveSequence so
 *   downstream handlers receive the normalized string.
 *
 * @type {import('express').RequestHandler}
 */
export function validateCreateSimulation(req, res, next) {
  const { robotCount, moveSequence } = req.body;

  // Validate robotCount (optional — omitting it defaults to 1 in the route handler)
  if (robotCount !== undefined) {
    if (robotCount === null || !Number.isInteger(robotCount) || robotCount < 1) {
      return res.status(400).json({
        error: {
          code: 'INVALID_ROBOT_COUNT',
          message: 'robotCount must be an integer >= 1',
        },
      });
    }
  }

  // Validate moveSequence (required)
  if (moveSequence === undefined || moveSequence === null) {
    return res.status(400).json({
      error: {
        code: 'INVALID_MOVE_SEQUENCE',
        message: 'moveSequence is required',
      },
    });
  }

  if (typeof moveSequence !== 'string') {
    return res.status(400).json({
      error: {
        code: 'INVALID_MOVE_SEQUENCE',
        message: 'moveSequence must be a string',
      },
    });
  }

  // Normalize: uppercase converts v → V; other valid chars (^, <, >) are unaffected
  const normalized = stripControlChars(moveSequence.toUpperCase());

  if (normalized.length === 0) {
    return res.status(400).json({
      error: {
        code: 'INVALID_MOVE_SEQUENCE',
        message: 'moveSequence must not be empty',
      },
    });
  }

  if (!/^[\^V<>]+$/.test(normalized)) {
    return res.status(400).json({
      error: {
        code: 'INVALID_MOVE_SEQUENCE',
        message: 'moveSequence may only contain ^, V, <, > (lowercase v is also accepted)',
      },
    });
  }

  // Write the normalized value back so route handlers receive the cleaned string
  req.body.moveSequence = normalized;

  next();
}

/**
 * Validation middleware for all routes with a :id simulation parameter.
 *
 * Ensures :id is a positive integer (>= 1). Parses it and attaches the numeric
 * value to req.simulationId for convenience in downstream handlers.
 *
 * Applies to: step, run, GET robots, GET houses, GET presents, GET detail.
 *
 * @type {import('express').RequestHandler}
 */
export function validateSimulationId(req, res, next) {
  const raw = req.params.id;

  if (!/^\d+$/.test(raw)) {
    return res.status(400).json({
      error: {
        code: 'INVALID_SIMULATION_ID',
        message: 'Simulation ID must be a positive integer',
      },
    });
  }

  const id = parseInt(raw, 10);

  if (id < 1) {
    return res.status(400).json({
      error: {
        code: 'INVALID_SIMULATION_ID',
        message: 'Simulation ID must be a positive integer',
      },
    });
  }

  req.simulationId = id;
  next();
}

/**
 * Validation middleware for GET /api/v1/simulations/:id/houses.
 *
 * minPresents is required. Query parameters arrive as strings; this middleware
 * validates the raw string matches a whole positive integer before parsing.
 * Parsed value is attached to req.minPresents for downstream handlers.
 *
 * @type {import('express').RequestHandler}
 */
export function validateHouseQuery(req, res, next) {
  const raw = req.query.minPresents;

  if (raw === undefined) {
    return res.status(400).json({
      error: {
        code: 'INVALID_THRESHOLD',
        message: 'minPresents query parameter is required',
      },
    });
  }

  // Must be a whole number string — rejects decimals ("1.5"), negatives ("-1"), and non-numeric ("abc")
  if (!/^\d+$/.test(raw)) {
    return res.status(400).json({
      error: {
        code: 'INVALID_THRESHOLD',
        message: 'minPresents must be an integer >= 1',
      },
    });
  }

  const minPresents = parseInt(raw, 10);

  if (minPresents < 1) {
    return res.status(400).json({
      error: {
        code: 'INVALID_THRESHOLD',
        message: 'minPresents must be an integer >= 1',
      },
    });
  }

  req.minPresents = minPresents;
  next();
}
