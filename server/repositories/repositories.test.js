import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { initializeDatabase } from '../db/schema.js';
import {
  createSimulation,
  getSimulation,
  listSimulations,
  updateSimulationStep,
} from './simulationRepository.js';
import {
  createRobots,
  getRobotsBySimulation,
  getRobotByTurnOrder,
  updateRobotPosition,
  countRobotsAtPosition,
} from './robotRepository.js';
import {
  deliverPresent,
  getTotalPresents,
  countHousesWithMinPresents,
  getHousesBySimulation,
} from './houseRepository.js';

let db;

beforeEach(() => {
  db = new Database(':memory:');
  initializeDatabase(db);
});

// ---------------------------------------------------------------------------
// Simulation repository
// ---------------------------------------------------------------------------

describe('simulationRepository', () => {
  it('createSimulation returns a full simulation row', () => {
    const sim = createSimulation(db, {
      userId: 1,
      moveSequence: '^^VV<>',
      robotCount: 3,
    });

    expect(sim).toMatchObject({
      id: expect.any(Number),
      user_id: 1,
      move_sequence: '^^VV<>',
      robot_count: 3,
      current_step: 0,
      status: 'created',
    });
    expect(sim.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO 8601
  });

  it('getSimulation returns a simulation by ID', () => {
    const sim = createSimulation(db, {
      userId: 1,
      moveSequence: '>',
      robotCount: 1,
    });
    const found = getSimulation(db, sim.id);
    expect(found).toEqual(sim);
  });

  it('getSimulation returns null for non-existent ID', () => {
    expect(getSimulation(db, 999)).toBeNull();
  });

  it('listSimulations returns all simulations for a user', () => {
    createSimulation(db, { userId: 1, moveSequence: '>', robotCount: 1 });
    createSimulation(db, { userId: 1, moveSequence: '<', robotCount: 2 });

    const list = listSimulations(db, 1);
    expect(list).toHaveLength(2);
  });

  it('listSimulations returns newest first', () => {
    const sim1 = createSimulation(db, {
      userId: 1,
      moveSequence: '>',
      robotCount: 1,
    });
    const sim2 = createSimulation(db, {
      userId: 1,
      moveSequence: '<',
      robotCount: 1,
    });

    const list = listSimulations(db, 1);
    expect(list[0].id).toBe(sim2.id);
    expect(list[1].id).toBe(sim1.id);
  });

  it('updateSimulationStep updates step and status', () => {
    const sim = createSimulation(db, {
      userId: 1,
      moveSequence: '>>',
      robotCount: 1,
    });

    const changes = updateSimulationStep(db, sim.id, 1, 'running');
    expect(changes).toBe(1);

    const updated = getSimulation(db, sim.id);
    expect(updated.current_step).toBe(1);
    expect(updated.status).toBe('running');
  });

  it('updateSimulationStep throws for non-existent simulation', () => {
    expect(() => updateSimulationStep(db, 999, 1, 'running')).toThrow(
      'No simulation found with id 999'
    );
  });
});

// ---------------------------------------------------------------------------
// Robot repository
// ---------------------------------------------------------------------------

describe('robotRepository', () => {
  let simId;

  beforeEach(() => {
    const sim = createSimulation(db, {
      userId: 1,
      moveSequence: '>>',
      robotCount: 2,
    });
    simId = sim.id;
  });

  it('createRobots inserts robots at (0,0) with correct turn order', () => {
    createRobots(db, simId, ['Robbie', 'Jane']);
    const robots = getRobotsBySimulation(db, simId);

    expect(robots).toHaveLength(2);
    expect(robots[0]).toMatchObject({
      name: 'Robbie',
      position_x: 0,
      position_y: 0,
      turn_order: 0,
    });
    expect(robots[1]).toMatchObject({
      name: 'Jane',
      position_x: 0,
      position_y: 0,
      turn_order: 1,
    });
  });

  it('getRobotsBySimulation returns robots ordered by turn_order', () => {
    createRobots(db, simId, ['Alice', 'Bob', 'Charlie']);
    const robots = getRobotsBySimulation(db, simId);

    expect(robots.map((r) => r.turn_order)).toEqual([0, 1, 2]);
  });

  it('getRobotByTurnOrder returns the correct robot', () => {
    createRobots(db, simId, ['Robbie', 'Jane']);
    const robot = getRobotByTurnOrder(db, simId, 1);

    expect(robot.name).toBe('Jane');
    expect(robot.turn_order).toBe(1);
  });

  it('getRobotByTurnOrder returns null for non-existent turn order', () => {
    createRobots(db, simId, ['Robbie']);
    expect(getRobotByTurnOrder(db, simId, 99)).toBeNull();
  });

  it('updateRobotPosition updates the robot coordinates', () => {
    createRobots(db, simId, ['Robbie']);
    const robot = getRobotsBySimulation(db, simId)[0];

    const changes = updateRobotPosition(db, robot.id, 3, -5);
    expect(changes).toBe(1);

    const updated = getRobotByTurnOrder(db, simId, 0);
    expect(updated.position_x).toBe(3);
    expect(updated.position_y).toBe(-5);
  });

  it('updateRobotPosition throws for non-existent robot', () => {
    expect(() => updateRobotPosition(db, 999, 1, 1)).toThrow('No robot found with id 999');
  });

  it('countRobotsAtPosition returns correct count', () => {
    createRobots(db, simId, ['Robbie', 'Jane']);

    // Both start at (0,0)
    expect(countRobotsAtPosition(db, simId, 0, 0)).toBe(2);
    expect(countRobotsAtPosition(db, simId, 1, 0)).toBe(0);
  });

  it('countRobotsAtPosition updates after a robot moves', () => {
    createRobots(db, simId, ['Robbie', 'Jane']);
    const robot = getRobotsBySimulation(db, simId)[0];

    updateRobotPosition(db, robot.id, 1, 0);

    expect(countRobotsAtPosition(db, simId, 0, 0)).toBe(1);
    expect(countRobotsAtPosition(db, simId, 1, 0)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// House repository
// ---------------------------------------------------------------------------

describe('houseRepository', () => {
  let simId;

  beforeEach(() => {
    const sim = createSimulation(db, {
      userId: 1,
      moveSequence: '>>',
      robotCount: 1,
    });
    simId = sim.id;
  });

  it('deliverPresent creates a house with presents_count = 1 on first delivery', () => {
    deliverPresent(db, simId, 1, 0);
    const houses = getHousesBySimulation(db, simId);

    expect(houses).toHaveLength(1);
    expect(houses[0]).toMatchObject({ x: 1, y: 0, presents_count: 1 });
  });

  it('deliverPresent increments presents_count on second delivery to same location', () => {
    deliverPresent(db, simId, 1, 0);
    deliverPresent(db, simId, 1, 0);
    const houses = getHousesBySimulation(db, simId);

    expect(houses).toHaveLength(1);
    expect(houses[0].presents_count).toBe(2);
  });

  it('deliverPresent creates separate houses at different locations', () => {
    deliverPresent(db, simId, 1, 0);
    deliverPresent(db, simId, 2, 0);
    const houses = getHousesBySimulation(db, simId);

    expect(houses).toHaveLength(2);
  });

  it('getTotalPresents sums all presents in a simulation', () => {
    deliverPresent(db, simId, 1, 0);
    deliverPresent(db, simId, 2, 0);
    deliverPresent(db, simId, 1, 0); // second present at (1,0)

    expect(getTotalPresents(db, simId)).toBe(3);
  });

  it('getTotalPresents returns 0 when no deliveries have been made', () => {
    expect(getTotalPresents(db, simId)).toBe(0);
  });

  it('countHousesWithMinPresents returns correct count', () => {
    deliverPresent(db, simId, 1, 0); // 1 present
    deliverPresent(db, simId, 2, 0); // 1 present
    deliverPresent(db, simId, 1, 0); // now 2 presents at (1,0)

    expect(countHousesWithMinPresents(db, simId, 1)).toBe(2); // both houses
    expect(countHousesWithMinPresents(db, simId, 2)).toBe(1); // only (1,0)
  });

  it('countHousesWithMinPresents returns 0 when threshold exceeds all houses', () => {
    deliverPresent(db, simId, 1, 0);

    expect(countHousesWithMinPresents(db, simId, 100)).toBe(0);
  });

  it('getHousesBySimulation returns houses ordered by x then y', () => {
    deliverPresent(db, simId, 3, 1);
    deliverPresent(db, simId, 1, 2);
    deliverPresent(db, simId, 1, 0);

    const houses = getHousesBySimulation(db, simId);
    expect(houses.map((h) => [h.x, h.y])).toEqual([
      [1, 0],
      [1, 2],
      [3, 1],
    ]);
  });
});

// ---------------------------------------------------------------------------
// Simulation isolation
// ---------------------------------------------------------------------------

describe('simulation isolation', () => {
  it('operations on sim 1 do not affect sim 2', () => {
    const sim1 = createSimulation(db, {
      userId: 1,
      moveSequence: '>>',
      robotCount: 1,
    });
    const sim2 = createSimulation(db, {
      userId: 1,
      moveSequence: '<<',
      robotCount: 1,
    });

    createRobots(db, sim1.id, ['Robbie']);
    createRobots(db, sim2.id, ['Jane']);

    // Deliver presents only in sim1
    deliverPresent(db, sim1.id, 1, 0);
    deliverPresent(db, sim1.id, 2, 0);

    // Update step only in sim1
    updateSimulationStep(db, sim1.id, 2, 'completed');

    // Verify sim2 is unaffected
    const sim2State = getSimulation(db, sim2.id);
    expect(sim2State.current_step).toBe(0);
    expect(sim2State.status).toBe('created');

    expect(getRobotsBySimulation(db, sim2.id)).toHaveLength(1);
    expect(getHousesBySimulation(db, sim2.id)).toHaveLength(0);
    expect(getTotalPresents(db, sim2.id)).toBe(0);

    // Verify sim1 has its data
    expect(getHousesBySimulation(db, sim1.id)).toHaveLength(2);
    expect(getTotalPresents(db, sim1.id)).toBe(2);
  });
});
