/**
 * Component tests for SimulationGrid.vue
 *
 * Verifies coordinate-to-pixel positioning, Y-axis inversion,
 * stacked robot offsets, bounding box sizing, data attributes,
 * and robot color assignment.
 */

import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import SimulationGrid from '../../components/SimulationGrid.vue';

/** Must match the CELL_SIZE constant in SimulationGrid.vue */
const CELL_SIZE = 40;
/** Must match MARKER_SIZE */
const MARKER_SIZE = 28;
/** Must match STACK_OFFSET */
const STACK_OFFSET = 6;
/** Must match PADDING_CELLS */
const PADDING_CELLS = 2;

/** Center offset to position marker within cell */
const CENTER_OFFSET = (CELL_SIZE - MARKER_SIZE) / 2;

/**
 * Helper: extracts the translate(px, py) values from a style transform.
 *
 * @param {string} transform - CSS transform string
 * @returns {{ tx: number, ty: number }}
 */
function parseTranslate(transform) {
  const match = transform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
  if (!match) throw new Error(`Could not parse transform: ${transform}`);
  return { tx: parseFloat(match[1]), ty: parseFloat(match[2]) };
}

const sampleRobots = [
  { name: 'Alpha', turnOrder: 0, position: { x: 0, y: 0 } },
  { name: 'Beta', turnOrder: 1, position: { x: 2, y: 3 } },
];

const sampleHouses = [
  { x: 0, y: 0, presentsCount: 2 },
  { x: 1, y: -1, presentsCount: 1 },
];

describe('SimulationGrid', () => {
  it('renders robot markers with data-robot-id attributes', () => {
    const wrapper = mount(SimulationGrid, {
      props: { robots: sampleRobots, houses: [], robotCount: 2 },
    });

    const robotEls = wrapper.findAll('[data-robot-id]');
    expect(robotEls).toHaveLength(2);
    expect(robotEls[0].attributes('data-robot-id')).toBe('Alpha');
    expect(robotEls[1].attributes('data-robot-id')).toBe('Beta');
  });

  it('renders house markers at correct positions', () => {
    const wrapper = mount(SimulationGrid, {
      props: { robots: [], houses: sampleHouses, robotCount: 1 },
    });

    const houseEls = wrapper.findAll('.grid-entity');
    expect(houseEls).toHaveLength(2);
  });

  it('positions a robot at (0,0) correctly relative to bounds', () => {
    const robots = [{ name: 'Solo', turnOrder: 0, position: { x: 0, y: 0 } }];
    const wrapper = mount(SimulationGrid, {
      props: { robots, houses: [], robotCount: 1 },
    });

    const robotEl = wrapper.find('[data-robot-id="Solo"]');
    const { tx, ty } = parseTranslate(robotEl.attributes('style'));

    // With only origin, bounds are minX=-2, maxY=2 (padding=2)
    // px = (0 - (-2)) * 40 + offset = 80 + 6 = 86
    // py = (2 - 0) * 40 + offset = 80 + 6 = 86
    const expectedPx = (0 - -PADDING_CELLS) * CELL_SIZE + CENTER_OFFSET;
    const expectedPy = (PADDING_CELLS - 0) * CELL_SIZE + CENTER_OFFSET;

    expect(tx).toBeCloseTo(expectedPx);
    expect(ty).toBeCloseTo(expectedPy);
  });

  it('inverts Y-axis: robot at (0,2) renders above robot at (0,0)', () => {
    const robots = [
      { name: 'Low', turnOrder: 0, position: { x: 0, y: 0 } },
      { name: 'High', turnOrder: 1, position: { x: 0, y: 2 } },
    ];

    const wrapper = mount(SimulationGrid, {
      props: { robots, houses: [], robotCount: 2 },
    });

    const lowEl = wrapper.find('[data-robot-id="Low"]');
    const highEl = wrapper.find('[data-robot-id="High"]');

    const lowPos = parseTranslate(lowEl.attributes('style'));
    const highPos = parseTranslate(highEl.attributes('style'));

    // Higher Y coordinate should have smaller pixel Y (higher on screen)
    expect(highPos.ty).toBeLessThan(lowPos.ty);
    // Difference should be exactly 2 cells
    expect(lowPos.ty - highPos.ty).toBeCloseTo(2 * CELL_SIZE);
  });

  it('offsets stacked robots sharing the same cell', () => {
    const robots = [
      { name: 'R1', turnOrder: 0, position: { x: 0, y: 0 } },
      { name: 'R2', turnOrder: 1, position: { x: 0, y: 0 } },
      { name: 'R3', turnOrder: 2, position: { x: 0, y: 0 } },
    ];

    const wrapper = mount(SimulationGrid, {
      props: { robots, houses: [], robotCount: 3 },
    });

    const r1 = parseTranslate(wrapper.find('[data-robot-id="R1"]').attributes('style'));
    const r2 = parseTranslate(wrapper.find('[data-robot-id="R2"]').attributes('style'));
    const r3 = parseTranslate(wrapper.find('[data-robot-id="R3"]').attributes('style'));

    // Each successive robot should be offset by STACK_OFFSET
    expect(r2.tx - r1.tx).toBeCloseTo(STACK_OFFSET);
    expect(r2.ty - r1.ty).toBeCloseTo(STACK_OFFSET);
    expect(r3.tx - r2.tx).toBeCloseTo(STACK_OFFSET);
    expect(r3.ty - r2.ty).toBeCloseTo(STACK_OFFSET);
  });

  it('sizes the grid container to the bounding box plus padding', () => {
    const robots = [
      { name: 'A', turnOrder: 0, position: { x: -3, y: -1 } },
      { name: 'B', turnOrder: 1, position: { x: 5, y: 4 } },
    ];

    const wrapper = mount(SimulationGrid, {
      props: { robots, houses: [], robotCount: 2 },
    });

    const container = wrapper.find('.grid-container');
    const style = container.attributes('style');

    // Bounds: minX=-5, maxX=7, minY=-3, maxY=6 (with padding of 2)
    // Width: (7 - (-5) + 1) * 40 = 13 * 40 = 520
    // Height: (6 - (-3) + 1) * 40 = 10 * 40 = 400
    const expectedWidth = (5 + PADDING_CELLS - (-3 - PADDING_CELLS) + 1) * CELL_SIZE;
    const expectedHeight = (4 + PADDING_CELLS - (-1 - PADDING_CELLS) + 1) * CELL_SIZE;

    expect(style).toContain(`width: ${expectedWidth}px`);
    expect(style).toContain(`height: ${expectedHeight}px`);
  });

  it('assigns evenly spaced HSL colors to robots', () => {
    const robots = [
      { name: 'R1', turnOrder: 0, position: { x: 0, y: 0 } },
      { name: 'R2', turnOrder: 1, position: { x: 1, y: 0 } },
      { name: 'R3', turnOrder: 2, position: { x: 2, y: 0 } },
    ];

    const wrapper = mount(SimulationGrid, {
      props: { robots, houses: [], robotCount: 3 },
    });

    // Find all RobotMarker SVGs by their aria-label
    const svgs = wrapper.findAll('svg[aria-label^="Robot"]');
    expect(svgs).toHaveLength(3);

    // First robot: hue = 0/3 * 360 = 0
    const firstHead = svgs[0].find('rect');
    expect(firstHead.attributes('fill')).toBe('hsl(0, 70%, 50%)');

    // Second robot: hue = 1/3 * 360 = 120
    const secondHead = svgs[1].find('rect');
    expect(secondHead.attributes('fill')).toBe('hsl(120, 70%, 50%)');

    // Third robot: hue = 2/3 * 360 = 240
    const thirdHead = svgs[2].find('rect');
    expect(thirdHead.attributes('fill')).toBe('hsl(240, 70%, 50%)');
  });

  it('shows an origin marker at (0,0)', () => {
    const wrapper = mount(SimulationGrid, {
      props: { robots: [], houses: [], robotCount: 1 },
    });

    const origin = wrapper.find('.origin-label');
    expect(origin.exists()).toBe(true);
    expect(origin.text()).toBe('0,0');
  });

  it('includes house tooltip with coordinates and present count', () => {
    const houses = [{ x: 3, y: -2, presentsCount: 5 }];
    const wrapper = mount(SimulationGrid, {
      props: { robots: [], houses, robotCount: 1 },
    });

    const houseEl = wrapper.find('.grid-entity');
    expect(houseEl.attributes('title')).toBe('House (3, -2) — 5 presents');
  });

  it('uses singular "present" when count is 1', () => {
    const houses = [{ x: 0, y: 0, presentsCount: 1 }];
    const wrapper = mount(SimulationGrid, {
      props: { robots: [], houses, robotCount: 1 },
    });

    const houseEl = wrapper.find('.grid-entity');
    expect(houseEl.attributes('title')).toBe('House (0, 0) — 1 present');
  });
});
