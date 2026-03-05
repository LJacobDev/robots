import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateCreateSimulation,
  validateSimulationId,
  validateHouseQuery,
} from './validate.js';

// Helpers for building mock Express req/res/next objects
const makeReq = ({ body = {}, params = {}, query = {} } = {}) => ({ body, params, query });

const makeRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

// ─── validateCreateSimulation ────────────────────────────────────────────────

describe('validateCreateSimulation', () => {
  let next;
  beforeEach(() => {
    next = vi.fn();
  });

  it('passes valid robotCount and moveSequence, calls next()', () => {
    const req = makeReq({ body: { robotCount: 3, moveSequence: '^^VV<>' } });
    const res = makeRes();
    validateCreateSimulation(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('passes with robotCount omitted (optional field)', () => {
    const req = makeReq({ body: { moveSequence: '^' } });
    const res = makeRes();
    validateCreateSimulation(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('normalizes lowercase v to V and writes back to req.body.moveSequence', () => {
    const req = makeReq({ body: { moveSequence: '^^vv<>' } });
    const res = makeRes();
    validateCreateSimulation(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.body.moveSequence).toBe('^^VV<>');
  });

  it('missing moveSequence → 400 INVALID_MOVE_SEQUENCE', () => {
    const req = makeReq({ body: { robotCount: 1 } });
    const res = makeRes();
    validateCreateSimulation(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'INVALID_MOVE_SEQUENCE' }) })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('moveSequence = null → 400 INVALID_MOVE_SEQUENCE', () => {
    const req = makeReq({ body: { moveSequence: null } });
    const res = makeRes();
    validateCreateSimulation(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'INVALID_MOVE_SEQUENCE' }) })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('moveSequence whitespace-only → 400 INVALID_MOVE_SEQUENCE', () => {
    const req = makeReq({ body: { moveSequence: '   ' } });
    const res = makeRes();
    validateCreateSimulation(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'INVALID_MOVE_SEQUENCE' }) })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('moveSequence with invalid characters → 400 INVALID_MOVE_SEQUENCE', () => {
    const req = makeReq({ body: { moveSequence: '^^XX' } });
    const res = makeRes();
    validateCreateSimulation(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'INVALID_MOVE_SEQUENCE' }) })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('robotCount = 0 → 400 INVALID_ROBOT_COUNT', () => {
    const req = makeReq({ body: { robotCount: 0, moveSequence: '^' } });
    const res = makeRes();
    validateCreateSimulation(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'INVALID_ROBOT_COUNT' }) })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('robotCount = -1 → 400 INVALID_ROBOT_COUNT', () => {
    const req = makeReq({ body: { robotCount: -1, moveSequence: '^' } });
    const res = makeRes();
    validateCreateSimulation(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'INVALID_ROBOT_COUNT' }) })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('robotCount = "abc" → 400 INVALID_ROBOT_COUNT', () => {
    const req = makeReq({ body: { robotCount: 'abc', moveSequence: '^' } });
    const res = makeRes();
    validateCreateSimulation(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'INVALID_ROBOT_COUNT' }) })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('robotCount = 1.5 (float) → 400 INVALID_ROBOT_COUNT', () => {
    const req = makeReq({ body: { robotCount: 1.5, moveSequence: '^' } });
    const res = makeRes();
    validateCreateSimulation(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'INVALID_ROBOT_COUNT' }) })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('robotCount = null → 400 INVALID_ROBOT_COUNT', () => {
    const req = makeReq({ body: { robotCount: null, moveSequence: '^' } });
    const res = makeRes();
    validateCreateSimulation(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'INVALID_ROBOT_COUNT' }) })
    );
    expect(next).not.toHaveBeenCalled();
  });
});

// ─── validateSimulationId ────────────────────────────────────────────────────

describe('validateSimulationId', () => {
  let next;
  beforeEach(() => {
    next = vi.fn();
  });

  it('valid ID "1" → calls next(), sets req.simulationId = 1', () => {
    const req = makeReq({ params: { id: '1' } });
    const res = makeRes();
    validateSimulationId(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.simulationId).toBe(1);
  });

  it('ID = "abc" → 400 INVALID_SIMULATION_ID', () => {
    const req = makeReq({ params: { id: 'abc' } });
    const res = makeRes();
    validateSimulationId(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'INVALID_SIMULATION_ID' }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('ID = "0" → 400 INVALID_SIMULATION_ID', () => {
    const req = makeReq({ params: { id: '0' } });
    const res = makeRes();
    validateSimulationId(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('ID = "-5" → 400 INVALID_SIMULATION_ID', () => {
    const req = makeReq({ params: { id: '-5' } });
    const res = makeRes();
    validateSimulationId(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });
});

// ─── validateHouseQuery ──────────────────────────────────────────────────────

describe('validateHouseQuery', () => {
  let next;
  beforeEach(() => {
    next = vi.fn();
  });

  it('valid minPresents "2" → calls next(), sets req.minPresents = 2', () => {
    const req = makeReq({ query: { minPresents: '2' } });
    const res = makeRes();
    validateHouseQuery(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.minPresents).toBe(2);
  });

  it('minPresents missing → 400 INVALID_THRESHOLD', () => {
    const req = makeReq({ query: {} });
    const res = makeRes();
    validateHouseQuery(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'INVALID_THRESHOLD' }) })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('minPresents = "0" → 400 INVALID_THRESHOLD', () => {
    const req = makeReq({ query: { minPresents: '0' } });
    const res = makeRes();
    validateHouseQuery(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('minPresents = "1.5" (decimal) → 400 INVALID_THRESHOLD', () => {
    const req = makeReq({ query: { minPresents: '1.5' } });
    const res = makeRes();
    validateHouseQuery(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('minPresents = "abc" → 400 INVALID_THRESHOLD', () => {
    const req = makeReq({ query: { minPresents: 'abc' } });
    const res = makeRes();
    validateHouseQuery(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('minPresents = "-1" → 400 INVALID_THRESHOLD', () => {
    const req = makeReq({ query: { minPresents: '-1' } });
    const res = makeRes();
    validateHouseQuery(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });
});