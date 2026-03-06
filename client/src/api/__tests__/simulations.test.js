/**
 * Unit tests for the API client module.
 *
 * Mocks the global `fetch` function to verify that each API function
 * makes the correct request (method, URL, headers, body) and handles
 * errors properly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSimulation,
  listSimulations,
  getSimulation,
  stepSimulation,
  runSimulation,
  getRobots,
  getTotalPresents,
  getHousesByThreshold,
} from '../simulations.js';

/** Builds a mock Response that resolves to the given JSON body. */
function mockResponse(body, { status = 200, ok = true } = {}) {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    url: 'http://localhost/test',
    json: () => Promise.resolve(body),
  };
}

beforeEach(() => {
  globalThis.fetch = vi.fn();
  // Stub import.meta.env.DEV to suppress console.error in tests
  vi.stubGlobal('console', { ...console, error: vi.fn() });
});

// ---------------------------------------------------------------------------
// createSimulation
// ---------------------------------------------------------------------------

describe('createSimulation', () => {
  it('sends POST with robotCount and moveSequence', async () => {
    const responseBody = { simulation: { id: 1 }, robots: [] };
    globalThis.fetch.mockResolvedValue(mockResponse(responseBody));

    const result = await createSimulation(3, '^^VV');

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/simulations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ robotCount: 3, moveSequence: '^^VV' }),
    });
    expect(result).toEqual(responseBody);
  });
});

// ---------------------------------------------------------------------------
// listSimulations
// ---------------------------------------------------------------------------

describe('listSimulations', () => {
  it('sends GET to /api/v1/simulations', async () => {
    const responseBody = { simulations: [] };
    globalThis.fetch.mockResolvedValue(mockResponse(responseBody));

    const result = await listSimulations();

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/simulations');
    expect(result).toEqual(responseBody);
  });
});

// ---------------------------------------------------------------------------
// getSimulation
// ---------------------------------------------------------------------------

describe('getSimulation', () => {
  it('sends GET to /api/v1/simulations/:id', async () => {
    const responseBody = { simulation: { id: 5 }, robots: [], houses: [], summary: {} };
    globalThis.fetch.mockResolvedValue(mockResponse(responseBody));

    const result = await getSimulation(5);

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/simulations/5');
    expect(result).toEqual(responseBody);
  });
});

// ---------------------------------------------------------------------------
// stepSimulation
// ---------------------------------------------------------------------------

describe('stepSimulation', () => {
  it('sends POST to /api/v1/simulations/:id/step', async () => {
    const responseBody = { turn: {}, simulation: {} };
    globalThis.fetch.mockResolvedValue(mockResponse(responseBody));

    const result = await stepSimulation(7);

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/simulations/7/step', {
      method: 'POST',
    });
    expect(result).toEqual(responseBody);
  });
});

// ---------------------------------------------------------------------------
// runSimulation
// ---------------------------------------------------------------------------

describe('runSimulation', () => {
  it('sends POST to /api/v1/simulations/:id/run', async () => {
    const responseBody = { simulation: {}, robots: [], summary: {} };
    globalThis.fetch.mockResolvedValue(mockResponse(responseBody));

    const result = await runSimulation(3);

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/simulations/3/run', {
      method: 'POST',
    });
    expect(result).toEqual(responseBody);
  });
});

// ---------------------------------------------------------------------------
// getRobots
// ---------------------------------------------------------------------------

describe('getRobots', () => {
  it('sends GET to /api/v1/simulations/:id/robots', async () => {
    const responseBody = { simulationId: 2, currentStep: 0, robots: [] };
    globalThis.fetch.mockResolvedValue(mockResponse(responseBody));

    const result = await getRobots(2);

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/simulations/2/robots');
    expect(result).toEqual(responseBody);
  });
});

// ---------------------------------------------------------------------------
// getTotalPresents
// ---------------------------------------------------------------------------

describe('getTotalPresents', () => {
  it('sends GET to /api/v1/simulations/:id/presents', async () => {
    const responseBody = { simulationId: 4, totalPresents: 10 };
    globalThis.fetch.mockResolvedValue(mockResponse(responseBody));

    const result = await getTotalPresents(4);

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/simulations/4/presents');
    expect(result).toEqual(responseBody);
  });
});

// ---------------------------------------------------------------------------
// getHousesByThreshold
// ---------------------------------------------------------------------------

describe('getHousesByThreshold', () => {
  it('sends GET with minPresents query param', async () => {
    const responseBody = { simulationId: 1, minPresents: 3, houseCount: 5 };
    globalThis.fetch.mockResolvedValue(mockResponse(responseBody));

    const result = await getHousesByThreshold(1, 3);

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/simulations/1/houses?minPresents=3');
    expect(result).toEqual(responseBody);
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('error handling', () => {
  it('throws with status and parsed error body on non-ok response', async () => {
    const errorBody = {
      error: { code: 'SIMULATION_NOT_FOUND', message: 'No simulation found with id 999' },
    };
    globalThis.fetch.mockResolvedValue(mockResponse(errorBody, { status: 404, ok: false }));

    await expect(getSimulation(999)).rejects.toThrow('No simulation found with id 999');

    try {
      await getSimulation(999);
    } catch (err) {
      expect(err.status).toBe(404);
      expect(err.body).toEqual(errorBody);
    }
  });

  it('handles non-JSON error responses gracefully', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      url: 'http://localhost/test',
      json: () => Promise.reject(new Error('not json')),
    });

    await expect(listSimulations()).rejects.toThrow('Internal Server Error');
  });
});
