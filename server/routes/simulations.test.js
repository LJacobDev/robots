/**
 * API integration tests for /api/v1/simulations routes.
 *
 * Uses Supertest to make real HTTP requests against the Express app.
 * The database is mocked with a fresh in-memory SQLite instance per test
 * so that tests are isolated and don't touch the on-disk database.
 */

import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { initializeDatabase } from '../db/schema.js';

let testDb;

vi.mock('../db/connection.js', () => ({
  get db() {
    return testDb;
  },
}));

let request;

beforeAll(async () => {
  // Suppress console output from service layer and DB initialization
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});

  testDb = new Database(':memory:');
  initializeDatabase(testDb);

  const { app } = await import('../server.js');
  const supertest = (await import('supertest')).default;
  request = supertest(app);
});

beforeEach(() => {
  testDb = new Database(':memory:');
  initializeDatabase(testDb);
});

/** Helper: create a simulation via the API. */
async function createSim(body = { robotCount: 1, moveSequence: '>' }) {
  return request.post('/api/v1/simulations').send(body);
}

// ---------------------------------------------------------------------------
// POST /api/v1/simulations — Create simulation (spec §4.1)
// ---------------------------------------------------------------------------

describe('POST /api/v1/simulations', () => {
  it('creates a simulation with 201 and correct response shape', async () => {
    const res = await createSim({ robotCount: 3, moveSequence: '^^VV<>' });

    expect(res.status).toBe(201);
    expect(res.headers['content-type']).toMatch(/application\/json/);

    const { simulation, robots } = res.body;
    expect(simulation).toMatchObject({
      robotCount: 3,
      moveSequence: '^^VV<>',
      currentStep: 0,
      totalSteps: 6,
      status: 'created',
    });
    expect(simulation.id).toBeTypeOf('number');
    expect(simulation.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    expect(robots).toHaveLength(3);
    expect(robots[0]).toMatchObject({
      name: 'Robbie',
      turnOrder: 0,
      position: { x: 0, y: 0 },
    });
    expect(robots[1].name).toBe('Jane');
    expect(robots[2].name).toBe('Bob');
  });

  it('defaults robotCount to 1 when omitted', async () => {
    const res = await createSim({ moveSequence: '>' });

    expect(res.status).toBe(201);
    expect(res.body.simulation.robotCount).toBe(1);
    expect(res.body.robots).toHaveLength(1);
    expect(res.body.robots[0].name).toBe('Robbie');
  });

  it('normalizes lowercase v to V in moveSequence', async () => {
    const res = await createSim({ moveSequence: '^v<>' });

    expect(res.status).toBe(201);
    expect(res.body.simulation.moveSequence).toBe('^V<>');
  });

  it('400 for invalid robotCount', async () => {
    const res = await createSim({ robotCount: 0, moveSequence: '>' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_ROBOT_COUNT');
  });

  it('400 for missing moveSequence', async () => {
    const res = await createSim({ robotCount: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_MOVE_SEQUENCE');
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/simulations/:id/step — Step one turn (spec §4.2)
// ---------------------------------------------------------------------------

describe('POST /api/v1/simulations/:id/step', () => {
  it('steps one turn with delivery and returns correct shape', async () => {
    const {
      body: { simulation: sim },
    } = await createSim({ moveSequence: '>' });

    const res = await request.post(`/api/v1/simulations/${sim.id}/step`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);

    expect(res.body.turn).toMatchObject({
      robotName: 'Robbie',
      direction: '>',
      from: { x: 0, y: 0 },
      to: { x: 1, y: 0 },
      delivered: true,
    });
    expect(res.body.turn.message).toMatch(/delivered a present/);

    expect(res.body.simulation).toMatchObject({
      id: sim.id,
      currentStep: 1,
      totalSteps: 1,
      status: 'completed',
    });
  });

  it('returns delivered: false when blocked by another robot', async () => {
    const {
      body: { simulation: sim },
    } = await createSim({
      robotCount: 2,
      moveSequence: '^^',
    });

    // Step 0: Robbie moves ^ to (0,1) — delivers
    await request.post(`/api/v1/simulations/${sim.id}/step`);

    // Step 1: Jane moves ^ to (0,1) — blocked by Robbie
    const res = await request.post(`/api/v1/simulations/${sim.id}/step`);

    expect(res.status).toBe(200);
    expect(res.body.turn.delivered).toBe(false);
    expect(res.body.turn.message).toMatch(/couldn't deliver/);
  });

  it('404 for non-existent simulation', async () => {
    const res = await request.post('/api/v1/simulations/999/step');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('SIMULATION_NOT_FOUND');
  });

  it('409 for stepping a completed simulation', async () => {
    const {
      body: { simulation: sim },
    } = await createSim({ moveSequence: '>' });
    await request.post(`/api/v1/simulations/${sim.id}/step`); // completes

    const res = await request.post(`/api/v1/simulations/${sim.id}/step`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SIMULATION_COMPLETED');
  });

  it('400 for invalid simulation ID', async () => {
    const res = await request.post('/api/v1/simulations/abc/step');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_SIMULATION_ID');
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/simulations/:id/run — Run full simulation (spec §4.3)
// ---------------------------------------------------------------------------

describe('POST /api/v1/simulations/:id/run', () => {
  it('runs full simulation and returns correct shape', async () => {
    const {
      body: { simulation: sim },
    } = await createSim({
      robotCount: 3,
      moveSequence: '^^VV<>',
    });

    const res = await request.post(`/api/v1/simulations/${sim.id}/run`);

    expect(res.status).toBe(200);
    expect(res.body.simulation).toMatchObject({
      id: sim.id,
      currentStep: 6,
      totalSteps: 6,
      status: 'completed',
    });

    expect(res.body.robots).toHaveLength(3);
    expect(res.body.robots[0]).toMatchObject({
      name: 'Robbie',
      turnOrder: 0,
      position: { x: 0, y: 0 },
    });

    expect(res.body.summary).toMatchObject({
      totalPresentsDelivered: expect.any(Number),
      housesWithPresents: expect.any(Number),
    });
    expect(res.body.summary.totalPresentsDelivered).toBeGreaterThan(0);
  });

  it('404 for non-existent simulation', async () => {
    const res = await request.post('/api/v1/simulations/999/run');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('SIMULATION_NOT_FOUND');
  });

  it('409 for running a completed simulation', async () => {
    const {
      body: { simulation: sim },
    } = await createSim({ moveSequence: '>' });
    await request.post(`/api/v1/simulations/${sim.id}/run`);

    const res = await request.post(`/api/v1/simulations/${sim.id}/run`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SIMULATION_COMPLETED');
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/simulations — List simulations (spec §4.7)
// ---------------------------------------------------------------------------

describe('GET /api/v1/simulations', () => {
  it('returns empty array when no simulations exist', async () => {
    const res = await request.get('/api/v1/simulations');

    expect(res.status).toBe(200);
    expect(res.body.simulations).toEqual([]);
  });

  it('returns all created simulations', async () => {
    await createSim({ moveSequence: '>' });
    await createSim({ moveSequence: '>>' });

    const res = await request.get('/api/v1/simulations');

    expect(res.status).toBe(200);
    expect(res.body.simulations).toHaveLength(2);
    expect(res.body.simulations[0]).toHaveProperty('id');
    expect(res.body.simulations[0]).toHaveProperty('robotCount');
    expect(res.body.simulations[0]).toHaveProperty('totalSteps');
    expect(res.body.simulations[0]).toHaveProperty('createdAt');
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/simulations/:id — Get simulation details (spec §4.8)
// ---------------------------------------------------------------------------

describe('GET /api/v1/simulations/:id', () => {
  it('returns simulation + robots + houses + summary', async () => {
    const {
      body: { simulation: sim },
    } = await createSim({
      robotCount: 2,
      moveSequence: '>>',
    });
    await request.post(`/api/v1/simulations/${sim.id}/run`);

    const res = await request.get(`/api/v1/simulations/${sim.id}`);

    expect(res.status).toBe(200);
    expect(res.body.simulation).toMatchObject({
      id: sim.id,
      robotCount: 2,
      moveSequence: '>>',
      status: 'completed',
    });
    expect(res.body.robots).toHaveLength(2);
    expect(res.body.houses).toBeInstanceOf(Array);
    expect(res.body.houses.length).toBeGreaterThan(0);
    expect(res.body.houses[0]).toHaveProperty('x');
    expect(res.body.houses[0]).toHaveProperty('y');
    expect(res.body.houses[0]).toHaveProperty('presentsCount');
    expect(res.body.summary).toHaveProperty('totalPresentsDelivered');
    expect(res.body.summary).toHaveProperty('housesWithPresents');
  });

  it('404 for non-existent simulation', async () => {
    const res = await request.get('/api/v1/simulations/999');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('SIMULATION_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/simulations/:id/robots — Get robot positions (spec §4.4)
// ---------------------------------------------------------------------------

describe('GET /api/v1/simulations/:id/robots', () => {
  it('returns robot positions with simulation context', async () => {
    const {
      body: { simulation: sim },
    } = await createSim({ moveSequence: '>' });
    await request.post(`/api/v1/simulations/${sim.id}/step`);

    const res = await request.get(`/api/v1/simulations/${sim.id}/robots`);

    expect(res.status).toBe(200);
    expect(res.body.simulationId).toBe(sim.id);
    expect(res.body.currentStep).toBe(1);
    expect(res.body.robots).toHaveLength(1);
    expect(res.body.robots[0]).toMatchObject({
      name: 'Robbie',
      position: { x: 1, y: 0 },
    });
  });

  it('404 for non-existent simulation', async () => {
    const res = await request.get('/api/v1/simulations/999/robots');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('SIMULATION_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/simulations/:id/houses — Houses by threshold (spec §4.5)
// ---------------------------------------------------------------------------

describe('GET /api/v1/simulations/:id/houses', () => {
  it('returns house count for a given threshold', async () => {
    const {
      body: { simulation: sim },
    } = await createSim({ moveSequence: '>>>' });
    await request.post(`/api/v1/simulations/${sim.id}/run`);

    const res = await request.get(`/api/v1/simulations/${sim.id}/houses?minPresents=1`);

    expect(res.status).toBe(200);
    expect(res.body.simulationId).toBe(sim.id);
    expect(res.body.minPresents).toBe(1);
    expect(res.body.houseCount).toBe(3); // 3 unique houses: (1,0), (2,0), (3,0)
  });

  it('returns 0 when minPresents exceeds all houses', async () => {
    const {
      body: { simulation: sim },
    } = await createSim({ moveSequence: '>' });
    await request.post(`/api/v1/simulations/${sim.id}/run`);

    const res = await request.get(`/api/v1/simulations/${sim.id}/houses?minPresents=999`);

    expect(res.status).toBe(200);
    expect(res.body.houseCount).toBe(0);
  });

  it('400 for missing minPresents query parameter', async () => {
    const {
      body: { simulation: sim },
    } = await createSim({ moveSequence: '>' });

    const res = await request.get(`/api/v1/simulations/${sim.id}/houses`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_THRESHOLD');
  });

  it('404 for non-existent simulation', async () => {
    const res = await request.get('/api/v1/simulations/999/houses?minPresents=1');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('SIMULATION_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/simulations/:id/presents — Total presents (spec §4.6)
// ---------------------------------------------------------------------------

describe('GET /api/v1/simulations/:id/presents', () => {
  it('returns total presents after running', async () => {
    const {
      body: { simulation: sim },
    } = await createSim({ moveSequence: '>>>' });
    await request.post(`/api/v1/simulations/${sim.id}/run`);

    const res = await request.get(`/api/v1/simulations/${sim.id}/presents`);

    expect(res.status).toBe(200);
    expect(res.body.simulationId).toBe(sim.id);
    expect(res.body.totalPresents).toBe(3);
  });

  it('returns 0 for a fresh simulation with no steps', async () => {
    const {
      body: { simulation: sim },
    } = await createSim({ moveSequence: '>' });

    const res = await request.get(`/api/v1/simulations/${sim.id}/presents`);

    expect(res.status).toBe(200);
    expect(res.body.totalPresents).toBe(0);
  });

  it('404 for non-existent simulation', async () => {
    const res = await request.get('/api/v1/simulations/999/presents');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('SIMULATION_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// Full workflow — integration lifecycle test
// ---------------------------------------------------------------------------

describe('full simulation workflow', () => {
  it('create → step → query state → run → verify final state', async () => {
    // 1. Create a 3-robot simulation
    const createRes = await createSim({
      robotCount: 3,
      moveSequence: '^^VV<>',
    });
    expect(createRes.status).toBe(201);
    const simId = createRes.body.simulation.id;

    // 2. Step once — Robbie moves ^ from (0,0) to (0,1), delivers
    const stepRes = await request.post(`/api/v1/simulations/${simId}/step`);
    expect(stepRes.status).toBe(200);
    expect(stepRes.body.turn.robotName).toBe('Robbie');
    expect(stepRes.body.turn.delivered).toBe(true);
    expect(stepRes.body.simulation.currentStep).toBe(1);
    expect(stepRes.body.simulation.status).toBe('running');

    // 3. Query robots — Robbie at (0,1), Jane and Bob still at (0,0)
    const robotsRes = await request.get(`/api/v1/simulations/${simId}/robots`);
    expect(robotsRes.status).toBe(200);
    expect(robotsRes.body.currentStep).toBe(1);
    expect(robotsRes.body.robots[0].position).toEqual({ x: 0, y: 1 });
    expect(robotsRes.body.robots[1].position).toEqual({ x: 0, y: 0 });

    // 4. Query presents — 1 present delivered so far
    const presentsRes = await request.get(`/api/v1/simulations/${simId}/presents`);
    expect(presentsRes.status).toBe(200);
    expect(presentsRes.body.totalPresents).toBe(1);

    // 5. Run remaining steps to completion
    const runRes = await request.post(`/api/v1/simulations/${simId}/run`);
    expect(runRes.status).toBe(200);
    expect(runRes.body.simulation.status).toBe('completed');
    expect(runRes.body.simulation.currentStep).toBe(6);

    // 6. Get full details — verify final state including houses
    const detailRes = await request.get(`/api/v1/simulations/${simId}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.simulation.status).toBe('completed');
    expect(detailRes.body.robots).toHaveLength(3);
    expect(detailRes.body.houses).toBeInstanceOf(Array);
    expect(detailRes.body.houses).toHaveLength(5);
    expect(detailRes.body.houses[0]).toMatchObject({
      x: expect.any(Number),
      y: expect.any(Number),
      presentsCount: expect.any(Number),
    });
    expect(detailRes.body.summary.totalPresentsDelivered).toBe(5);
    expect(detailRes.body.summary.housesWithPresents).toBe(5);

    // 7. Query houses — 5 houses with >= 1 present, 0 with >= 2
    const houses1 = await request.get(`/api/v1/simulations/${simId}/houses?minPresents=1`);
    expect(houses1.body.houseCount).toBe(5);

    const houses2 = await request.get(`/api/v1/simulations/${simId}/houses?minPresents=2`);
    expect(houses2.body.houseCount).toBe(0);

    // 8. List simulations — includes this one
    const listRes = await request.get('/api/v1/simulations');
    expect(listRes.status).toBe(200);
    expect(listRes.body.simulations.length).toBeGreaterThanOrEqual(1);
    expect(listRes.body.simulations.some((s) => s.id === simId)).toBe(true);
  });
});
