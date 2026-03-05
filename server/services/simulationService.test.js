import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { initializeDatabase } from '../db/schema.js';
import { createSimulation, getSimulation } from '../repositories/simulationRepository.js';
import { createRobots, getRobotsBySimulation } from '../repositories/robotRepository.js';
import {
  getTotalPresents,
  countHousesWithMinPresents,
  getHousesBySimulation,
} from '../repositories/houseRepository.js';
import { assignRobotNames } from '../utils/robotNames.js';
import { stepSimulation, runSimulation } from './simulationService.js';

let db;

/**
 * Helper: creates a simulation with robots ready to step.
 */
function createReadySimulation(moveSequence, robotCount = 1) {
  const sim = createSimulation(db, {
    userId: 1,
    moveSequence,
    robotCount,
  });
  const names = assignRobotNames(robotCount);
  createRobots(db, sim.id, names);
  return sim;
}

beforeEach(() => {
  db = new Database(':memory:');
  initializeDatabase(db);
});

// ---------------------------------------------------------------------------
// stepSimulation
// ---------------------------------------------------------------------------

describe('stepSimulation', () => {
  it('single robot, single move — delivers present', () => {
    const sim = createReadySimulation('>');
    const result = stepSimulation(db, sim.id);

    expect(result).toMatchObject({
      step: 0,
      robotName: 'Robbie',
      direction: '>',
      from: { x: 0, y: 0 },
      to: { x: 1, y: 0 },
      delivered: true,
      status: 'completed',
    });

    expect(getTotalPresents(db, sim.id)).toBe(1);
  });

  it('two robots, same destination — second robot is blocked', () => {
    const sim = createReadySimulation('^^', 2);

    // Step 0: Robot 0 moves ^ from (0,0) to (0,1) — delivers
    const step0 = stepSimulation(db, sim.id);
    expect(step0.delivered).toBe(true);
    expect(step0.to).toEqual({ x: 0, y: 1 });

    // Step 1: Robot 1 moves ^ from (0,0) to (0,1) — Robot 0 is there, blocked
    const step1 = stepSimulation(db, sim.id);
    expect(step1.delivered).toBe(false);
    expect(step1.to).toEqual({ x: 0, y: 1 });

    expect(getTotalPresents(db, sim.id)).toBe(1);
  });

  it('robot moves back to origin (0,0) — should deliver', () => {
    // Robot moves up then down, returning to origin
    const sim = createReadySimulation('^V');

    stepSimulation(db, sim.id); // moves to (0,1), delivers
    const step1 = stepSimulation(db, sim.id); // moves back to (0,0), delivers

    expect(step1.to).toEqual({ x: 0, y: 0 });
    expect(step1.delivered).toBe(true);
    expect(getTotalPresents(db, sim.id)).toBe(2);
  });

  it('step a created simulation — status transitions to running', () => {
    const sim = createReadySimulation('>>');

    const result = stepSimulation(db, sim.id);
    expect(result.status).toBe('running');

    const updated = getSimulation(db, sim.id);
    expect(updated.status).toBe('running');
  });

  it('step a completed simulation — throws error', () => {
    const sim = createReadySimulation('>');

    stepSimulation(db, sim.id); // completes

    expect(() => stepSimulation(db, sim.id)).toThrow('already completed');

    try {
      stepSimulation(db, sim.id);
    } catch (err) {
      expect(err.code).toBe('SIMULATION_COMPLETED');
    }
  });

  it('step a non-existent simulation — throws error', () => {
    expect(() => stepSimulation(db, 999)).toThrow('No simulation found');

    try {
      stepSimulation(db, 999);
    } catch (err) {
      expect(err.code).toBe('SIMULATION_NOT_FOUND');
    }
  });
});

// ---------------------------------------------------------------------------
// runSimulation
// ---------------------------------------------------------------------------

describe('runSimulation', () => {
  it('robot count > move count — some robots never move', () => {
    // 3 robots, 2 moves: only robots 0 and 1 get a turn
    const sim = createReadySimulation('>>', 3);
    runSimulation(db, sim.id);

    const robots = getRobotsBySimulation(db, sim.id);
    // R0 moved right once, R1 moved right once, R2 never moved
    expect(robots[0]).toMatchObject({ name: 'Robbie', position_x: 1, position_y: 0 });
    expect(robots[1]).toMatchObject({ name: 'Jane', position_x: 1, position_y: 0 });
    expect(robots[2]).toMatchObject({ name: 'Bob', position_x: 0, position_y: 0 });

    const final = getSimulation(db, sim.id);
    expect(final.current_step).toBe(2);
    expect(final.status).toBe('completed');
  });

  it('move sequence length not divisible by robot count — last robots get fewer turns', () => {
    // 2 robots, 5 moves (all >): R0 gets turns 0,2,4 (3 moves), R1 gets turns 1,3 (2 moves)
    const sim = createReadySimulation('>>>>>', 2);
    runSimulation(db, sim.id);

    const robots = getRobotsBySimulation(db, sim.id);
    // R0 moved right 3 times, R1 moved right 2 times
    expect(robots[0]).toMatchObject({ name: 'Robbie', position_x: 3, position_y: 0 });
    expect(robots[1]).toMatchObject({ name: 'Jane', position_x: 2, position_y: 0 });

    const final = getSimulation(db, sim.id);
    expect(final.current_step).toBe(5);
    expect(final.status).toBe('completed');
  });

  it('run a partially stepped simulation — finishes from current step', () => {
    const sim = createReadySimulation('>>>', 1);

    // Step once manually
    stepSimulation(db, sim.id);
    expect(getSimulation(db, sim.id).current_step).toBe(1);

    // Run the rest
    runSimulation(db, sim.id);

    const final = getSimulation(db, sim.id);
    expect(final.status).toBe('completed');
    expect(final.current_step).toBe(3);
  });

  it('full simulation run — verify final positions and present counts', () => {
    // Single robot, moves right 3 times: visits (1,0), (2,0), (3,0)
    const sim = createReadySimulation('>>>', 1);
    runSimulation(db, sim.id);

    const robots = getRobotsBySimulation(db, sim.id);
    expect(robots[0]).toMatchObject({ position_x: 3, position_y: 0 });

    expect(getTotalPresents(db, sim.id)).toBe(3);
    expect(countHousesWithMinPresents(db, sim.id, 1)).toBe(3);
  });

  it('run a completed simulation — throws error', () => {
    const sim = createReadySimulation('>');
    runSimulation(db, sim.id);

    expect(() => runSimulation(db, sim.id)).toThrow('already completed');

    try {
      runSimulation(db, sim.id);
    } catch (err) {
      expect(err.code).toBe('SIMULATION_COMPLETED');
    }
  });

  it('run a non-existent simulation — throws error', () => {
    expect(() => runSimulation(db, 999)).toThrow('No simulation found');

    try {
      runSimulation(db, 999);
    } catch (err) {
      expect(err.code).toBe('SIMULATION_NOT_FOUND');
    }
  });
});

// ---------------------------------------------------------------------------
// 3-robot "^^VV<>" example — full step-by-step verification
// ---------------------------------------------------------------------------

describe('3-robot ^^VV<> example', () => {
  let sim;

  beforeEach(() => {
    sim = createReadySimulation('^^VV<>', 3);
  });

  it('verifies each step produces the correct result', () => {
    // Step 0: R0 (Robbie) moves ^ from (0,0) to (0,1) — no one at (0,1), delivers
    const s0 = stepSimulation(db, sim.id);
    expect(s0).toMatchObject({
      step: 0,
      robotName: 'Robbie',
      direction: '^',
      from: { x: 0, y: 0 },
      to: { x: 0, y: 1 },
      delivered: true,
      status: 'running',
    });

    // Step 1: R1 (Jane) moves ^ from (0,0) to (0,1) — R0 is at (0,1), blocked
    const s1 = stepSimulation(db, sim.id);
    expect(s1).toMatchObject({
      step: 1,
      robotName: 'Jane',
      direction: '^',
      from: { x: 0, y: 0 },
      to: { x: 0, y: 1 },
      delivered: false,
      status: 'running',
    });

    // Step 2: R2 (Bob) moves V from (0,0) to (0,-1) — no one there, delivers
    const s2 = stepSimulation(db, sim.id);
    expect(s2).toMatchObject({
      step: 2,
      robotName: 'Bob',
      direction: 'V',
      from: { x: 0, y: 0 },
      to: { x: 0, y: -1 },
      delivered: true,
      status: 'running',
    });

    // Step 3: R0 (Robbie) moves V from (0,1) to (0,0) — R1 is at (0,1), but dest is (0,0), no one there, delivers
    const s3 = stepSimulation(db, sim.id);
    expect(s3).toMatchObject({
      step: 3,
      robotName: 'Robbie',
      direction: 'V',
      from: { x: 0, y: 1 },
      to: { x: 0, y: 0 },
      delivered: true,
      status: 'running',
    });

    // Step 4: R1 (Jane) moves < from (0,1) to (-1,1) — no one there, delivers
    const s4 = stepSimulation(db, sim.id);
    expect(s4).toMatchObject({
      step: 4,
      robotName: 'Jane',
      direction: '<',
      from: { x: 0, y: 1 },
      to: { x: -1, y: 1 },
      delivered: true,
      status: 'running',
    });

    // Step 5: R2 (Bob) moves > from (0,-1) to (1,-1) — no one there, delivers
    const s5 = stepSimulation(db, sim.id);
    expect(s5).toMatchObject({
      step: 5,
      robotName: 'Bob',
      direction: '>',
      from: { x: 0, y: -1 },
      to: { x: 1, y: -1 },
      delivered: true,
      status: 'completed',
    });
  });

  it('verifies final state after full run', () => {
    runSimulation(db, sim.id);

    // Final robot positions
    const robots = getRobotsBySimulation(db, sim.id);
    expect(robots[0]).toMatchObject({ name: 'Robbie', position_x: 0, position_y: 0 });
    expect(robots[1]).toMatchObject({ name: 'Jane', position_x: -1, position_y: 1 });
    expect(robots[2]).toMatchObject({ name: 'Bob', position_x: 1, position_y: -1 });

    // 5 unique houses, 5 total presents, 0 houses with >= 2
    const houses = getHousesBySimulation(db, sim.id);
    expect(houses).toHaveLength(5);
    expect(getTotalPresents(db, sim.id)).toBe(5);
    expect(countHousesWithMinPresents(db, sim.id, 1)).toBe(5);
    expect(countHousesWithMinPresents(db, sim.id, 2)).toBe(0);
  });
});
