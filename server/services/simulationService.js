/**
 * Simulation engine — orchestrates stepping through a simulation's
 * move sequence, moving robots and delivering presents.
 *
 * All DB mutations within a single step are wrapped in a transaction
 * so that a step either fully succeeds or fully rolls back.
 */

import { getSimulation, updateSimulationStep } from '../repositories/simulationRepository.js';
import {
  getRobotByTurnOrder,
  updateRobotPosition,
  countRobotsAtPosition,
} from '../repositories/robotRepository.js';
import { deliverPresent } from '../repositories/houseRepository.js';

/**
 * Maps a single-character direction to an {dx, dy} delta.
 *
 * @type {Record<string, { dx: number, dy: number }>}
 */
const DIRECTION_DELTAS = {
  '^': { dx: 0, dy: 1 },
  'V': { dx: 0, dy: -1 },
  '<': { dx: -1, dy: 0 },
  '>': { dx: 1, dy: 0 },
};

/**
 * Executes a single step of a simulation.
 *
 * 1. Validates the simulation exists and is not completed.
 * 2. Determines which robot's turn it is (round-robin).
 * 3. Reads the direction from the move sequence.
 * 4. Calculates the new position.
 * 5. Checks whether another robot already occupies the destination.
 * 6. Moves the robot to the new position.
 * 7. If the destination was clear, delivers a present.
 * 8. Increments current_step and updates status.
 * 9. Returns a turn result object describing what happened.
 *
 * All DB mutations are wrapped in a transaction for atomicity.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {number} simulationId
 * @returns {{ step: number, robotName: string, direction: string, from: { x: number, y: number }, to: { x: number, y: number }, delivered: boolean, status: string }}
 * @throws {Error} If simulation not found or already completed
 */
export function stepSimulation(db, simulationId) {
  const sim = getSimulation(db, simulationId);

  if (!sim) {
    const err = new Error(`No simulation found with id ${simulationId}`);
    err.code = 'SIMULATION_NOT_FOUND';
    throw err;
  }

  if (sim.status === 'completed') {
    const err = new Error(`Simulation ${simulationId} is already completed`);
    err.code = 'SIMULATION_COMPLETED';
    throw err;
  }

  const { current_step: step, move_sequence: moveSequence, robot_count: robotCount } = sim;

  const turnOrder = step % robotCount;
  const direction = moveSequence[step];
  const delta = DIRECTION_DELTAS[direction];

  const robot = getRobotByTurnOrder(db, simulationId, turnOrder);
  const fromX = robot.position_x;
  const fromY = robot.position_y;
  const toX = fromX + delta.dx;
  const toY = fromY + delta.dy;

  // Check BEFORE moving: is another robot already at the destination?
  const occupied = countRobotsAtPosition(db, simulationId, toX, toY) > 0;

  const newStep = step + 1;
  const newStatus = newStep >= moveSequence.length ? 'completed' : 'running';

  // Wrap all mutations in a transaction
  const executeStep = db.transaction(() => {
    updateRobotPosition(db, robot.id, toX, toY);

    if (!occupied) {
      deliverPresent(db, simulationId, toX, toY);
    }

    updateSimulationStep(db, simulationId, newStep, newStatus);
  });

  executeStep();

  console.log(
    `[sim ${simulationId}] Step ${step}: ${robot.name} moved ${direction} from (${fromX},${fromY}) to (${toX},${toY})${occupied ? ' — delivery blocked' : ' — delivered present'}`
  );

  return {
    step,
    robotName: robot.name,
    direction,
    from: { x: fromX, y: fromY },
    to: { x: toX, y: toY },
    delivered: !occupied,
    status: newStatus,
  };
}

/**
 * Runs all remaining steps of a simulation until completion.
 *
 * Calls stepSimulation in a loop until the simulation status
 * reaches 'completed'. Does not accumulate step results in memory
 * to avoid unbounded growth on large simulations.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {number} simulationId
 * @returns {void}
 * @throws {Error} If simulation not found or already completed
 */
export function runSimulation(db, simulationId) {
  // Validate up front so we get the right error for already-completed sims
  const sim = getSimulation(db, simulationId);

  if (!sim) {
    const err = new Error(`No simulation found with id ${simulationId}`);
    err.code = 'SIMULATION_NOT_FOUND';
    throw err;
  }

  if (sim.status === 'completed') {
    const err = new Error(`Simulation ${simulationId} is already completed`);
    err.code = 'SIMULATION_COMPLETED';
    throw err;
  }

  let stepsExecuted = 0;
  let result;

  while (true) {
    result = stepSimulation(db, simulationId);
    stepsExecuted++;

    if (result.status === 'completed') {
      break;
    }
  }

  console.log(`[sim ${simulationId}] Run complete: ${stepsExecuted} steps executed`);
}
