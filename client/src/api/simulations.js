/**
 * API client for the Robots Simulation backend.
 *
 * Each function corresponds to one REST endpoint. All functions use
 * the Fetch API, check for non-ok responses, and throw an error with
 * the parsed error body attached. Console logging of errors is gated
 * behind `import.meta.env.DEV` so it is tree-shaken in production.
 *
 * @module api/simulations
 */

const BASE_URL = '/api/v1/simulations';

/**
 * Checks a fetch response and throws if it is not ok.
 * The thrown error includes the parsed JSON error body when available.
 *
 * @param {Response} response - Fetch API response
 * @returns {Promise<Response>} The original response if ok
 * @throws {{ status: number, error: object }} Parsed error from the API
 */
async function handleResponse(response) {
  if (!response.ok) {
    let body;
    try {
      body = await response.json();
    } catch {
      body = { error: { code: 'UNKNOWN', message: response.statusText } };
    }

    if (import.meta.env.DEV) {
      console.error(`[api] ${response.status} ${response.url}`, body);
    }

    const err = new Error(body.error?.message || response.statusText);
    err.status = response.status;
    err.body = body;
    throw err;
  }
  return response;
}

/**
 * Creates a new simulation.
 *
 * @param {number} robotCount - Number of robots (>= 1)
 * @param {string} moveSequence - Movement instruction string (^V<> characters)
 * @returns {Promise<{ simulation: object, robots: Array }>}
 */
export async function createSimulation(robotCount, moveSequence) {
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ robotCount, moveSequence }),
  });
  await handleResponse(response);
  return response.json();
}

/**
 * Lists all simulations for the current user.
 *
 * @returns {Promise<{ simulations: Array }>}
 */
export async function listSimulations() {
  const response = await fetch(BASE_URL);
  await handleResponse(response);
  return response.json();
}

/**
 * Gets full details for a single simulation, including robots,
 * houses, and delivery summary.
 *
 * @param {number} id - Simulation ID
 * @returns {Promise<{ simulation: object, robots: Array, houses: Array, summary: object }>}
 */
export async function getSimulation(id) {
  const response = await fetch(`${BASE_URL}/${id}`);
  await handleResponse(response);
  return response.json();
}

/**
 * Steps a simulation forward by one turn.
 *
 * @param {number} id - Simulation ID
 * @returns {Promise<{ turn: object, simulation: object }>}
 */
export async function stepSimulation(id) {
  const response = await fetch(`${BASE_URL}/${id}/step`, { method: 'POST' });
  await handleResponse(response);
  return response.json();
}

/**
 * Runs a simulation to completion from its current step.
 *
 * @param {number} id - Simulation ID
 * @returns {Promise<{ simulation: object, robots: Array, summary: object }>}
 */
export async function runSimulation(id) {
  const response = await fetch(`${BASE_URL}/${id}/run`, { method: 'POST' });
  await handleResponse(response);
  return response.json();
}

/**
 * Gets current robot positions for a simulation.
 *
 * @param {number} id - Simulation ID
 * @returns {Promise<{ simulationId: number, currentStep: number, robots: Array }>}
 */
export async function getRobots(id) {
  const response = await fetch(`${BASE_URL}/${id}/robots`);
  await handleResponse(response);
  return response.json();
}

/**
 * Gets the total number of presents delivered in a simulation.
 *
 * @param {number} id - Simulation ID
 * @returns {Promise<{ simulationId: number, totalPresents: number }>}
 */
export async function getTotalPresents(id) {
  const response = await fetch(`${BASE_URL}/${id}/presents`);
  await handleResponse(response);
  return response.json();
}

/**
 * Counts houses that have received at least N presents.
 *
 * @param {number} id - Simulation ID
 * @param {number} minPresents - Minimum presents threshold (>= 1)
 * @returns {Promise<{ simulationId: number, minPresents: number, houseCount: number }>}
 */
export async function getHousesByThreshold(id, minPresents) {
  const response = await fetch(
    `${BASE_URL}/${id}/houses?minPresents=${minPresents}`
  );
  await handleResponse(response);
  return response.json();
}
