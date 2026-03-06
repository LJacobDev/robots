/**
 * Component tests for ControlPanel.vue
 *
 * Verifies rendering of simulation info, status badge, progress bar,
 * step/run button states and emits, statistics display, houses query
 * form, and robot list with click-to-scroll.
 */

import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ControlPanel from '../../components/ControlPanel.vue';

/** Helper: creates a default simulation object for tests */
function makeSimulation(overrides = {}) {
  return {
    id: 1,
    robotCount: 2,
    moveSequence: 'NESW',
    status: 'created',
    currentStep: 0,
    totalSteps: 8,
    createdAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

/** Helper: creates sample robots */
const sampleRobots = [
  { name: 'Alpha', turnOrder: 0, position: { x: 0, y: 0 } },
  { name: 'Beta', turnOrder: 1, position: { x: 2, y: 3 } },
];

/** Default props for mounting the component */
function defaultProps(overrides = {}) {
  return {
    simulation: makeSimulation(),
    robots: sampleRobots,
    totalPresents: 4,
    houseQueryResult: null,
    isStepLoading: false,
    isRunLoading: false,
    robotCount: 2,
    ...overrides,
  };
}

describe('ControlPanel', () => {
  // --- Rendering ---

  it('renders the simulation ID in the header', () => {
    const wrapper = mount(ControlPanel, { props: defaultProps() });
    expect(wrapper.text()).toContain('Simulation #1');
  });

  it('renders the status badge with correct class', () => {
    const wrapper = mount(ControlPanel, {
      props: defaultProps({ simulation: makeSimulation({ status: 'running' }) }),
    });
    const badge = wrapper.find('.status-badge');
    expect(badge.exists()).toBe(true);
    expect(badge.classes()).toContain('status-running');
    expect(badge.text()).toBe('running');
  });

  it('renders the move sequence in a code element', () => {
    const wrapper = mount(ControlPanel, {
      props: defaultProps({ simulation: makeSimulation({ moveSequence: '^V<>' }) }),
    });
    const code = wrapper.find('.move-sequence');
    expect(code.exists()).toBe(true);
    // Raw ^V<> displayed as Unicode arrows
    expect(code.text()).toBe('↑↓←→');
  });

  it('highlights the next move in green and dims past moves', () => {
    const wrapper = mount(ControlPanel, {
      props: defaultProps({
        simulation: makeSimulation({ moveSequence: '^V<>', currentStep: 2 }),
      }),
    });
    const spans = wrapper.findAll('.move-sequence span');
    expect(spans).toHaveLength(4);
    // First two moves are past
    expect(spans[0].classes()).toContain('move-past');
    expect(spans[1].classes()).toContain('move-past');
    // Third move is next
    expect(spans[2].classes()).toContain('move-next');
    // Fourth move is future
    expect(spans[3].classes()).toContain('move-future');
  });

  it('marks all moves as past when simulation is completed', () => {
    const wrapper = mount(ControlPanel, {
      props: defaultProps({
        simulation: makeSimulation({ moveSequence: '^V', currentStep: 2, status: 'completed' }),
      }),
    });
    const spans = wrapper.findAll('.move-sequence span');
    expect(spans[0].classes()).toContain('move-past');
    expect(spans[1].classes()).toContain('move-past');
  });

  it('renders the progress bar text with current and total steps', () => {
    const wrapper = mount(ControlPanel, {
      props: defaultProps({ simulation: makeSimulation({ currentStep: 3, totalSteps: 8 }) }),
    });
    expect(wrapper.find('.progress-text').text()).toBe('Step 3 of 8');
  });

  it('sets progress bar width based on current/total steps', () => {
    const wrapper = mount(ControlPanel, {
      props: defaultProps({ simulation: makeSimulation({ currentStep: 4, totalSteps: 8 }) }),
    });
    const fill = wrapper.find('.progress-bar-fill');
    expect(fill.attributes('style')).toContain('width: 50%');
  });

  it('renders the statistics section with robot count and presents', () => {
    const wrapper = mount(ControlPanel, { props: defaultProps() });
    const text = wrapper.text();
    expect(text).toContain('Robots');
    expect(text).toContain('2');
    expect(text).toContain('Presents delivered');
    expect(text).toContain('4');
  });

  // --- Buttons ---

  it('enables Step and Run All buttons when simulation is not completed', () => {
    const wrapper = mount(ControlPanel, { props: defaultProps() });
    const buttons = wrapper.findAll('.btn-primary');
    expect(buttons[0].attributes('disabled')).toBeUndefined();
    expect(buttons[1].attributes('disabled')).toBeUndefined();
  });

  it('disables Step and Run All buttons when simulation is completed', () => {
    const wrapper = mount(ControlPanel, {
      props: defaultProps({ simulation: makeSimulation({ status: 'completed' }) }),
    });
    const buttons = wrapper.findAll('.btn-primary');
    expect(buttons[0].attributes('disabled')).toBeDefined();
    expect(buttons[1].attributes('disabled')).toBeDefined();
  });

  it('disables buttons while step is loading', () => {
    const wrapper = mount(ControlPanel, {
      props: defaultProps({ isStepLoading: true }),
    });
    const buttons = wrapper.findAll('.btn-primary');
    expect(buttons[0].attributes('disabled')).toBeDefined();
    expect(buttons[0].text()).toBe('Stepping...');
  });

  it('disables buttons while run is loading', () => {
    const wrapper = mount(ControlPanel, {
      props: defaultProps({ isRunLoading: true }),
    });
    const buttons = wrapper.findAll('.btn-primary');
    expect(buttons[1].attributes('disabled')).toBeDefined();
    expect(buttons[1].text()).toBe('Running...');
  });

  it('emits "step" when Step button is clicked', async () => {
    const wrapper = mount(ControlPanel, { props: defaultProps() });
    await wrapper.findAll('.btn-primary')[0].trigger('click');
    expect(wrapper.emitted('step')).toHaveLength(1);
  });

  it('emits "run" when Run All button is clicked', async () => {
    const wrapper = mount(ControlPanel, { props: defaultProps() });
    await wrapper.findAll('.btn-primary')[1].trigger('click');
    expect(wrapper.emitted('run')).toHaveLength(1);
  });

  // --- Houses query ---

  it('emits "check-houses" with threshold value on form submit', async () => {
    const wrapper = mount(ControlPanel, { props: defaultProps() });

    const input = wrapper.find('#house-threshold');
    await input.setValue(3);

    await wrapper.find('.query-form').trigger('submit');
    expect(wrapper.emitted('check-houses')).toHaveLength(1);
    expect(wrapper.emitted('check-houses')[0]).toEqual([3]);
  });

  it('does not emit "check-houses" when threshold is invalid', async () => {
    const wrapper = mount(ControlPanel, { props: defaultProps() });

    const input = wrapper.find('#house-threshold');
    await input.setValue(0);

    await wrapper.find('.query-form').trigger('submit');
    expect(wrapper.emitted('check-houses')).toBeUndefined();
  });

  it('displays house query result with correct pluralization', async () => {
    const wrapper = mount(ControlPanel, {
      props: defaultProps({
        houseQueryResult: { simulationId: 1, minPresents: 2, houseCount: 5 },
      }),
    });
    const result = wrapper.find('.query-result');
    expect(result.text()).toContain('5');
    expect(result.text()).toContain('houses have');
    expect(result.text()).toContain('presents');
  });

  it('uses singular "house has" when count is 1', () => {
    const wrapper = mount(ControlPanel, {
      props: defaultProps({
        houseQueryResult: { simulationId: 1, minPresents: 1, houseCount: 1 },
      }),
    });
    const result = wrapper.find('.query-result');
    expect(result.text()).toContain('house has');
    expect(result.text()).toContain('1 present');
  });

  it('hides query result when houseQueryResult is null', () => {
    const wrapper = mount(ControlPanel, { props: defaultProps() });
    expect(wrapper.find('.query-result').exists()).toBe(false);
  });

  // --- Robot list ---

  it('renders a list item for each robot with color dot, name, and position', () => {
    const wrapper = mount(ControlPanel, { props: defaultProps() });
    const items = wrapper.findAll('.robot-item');
    expect(items).toHaveLength(2);

    expect(items[0].find('.robot-name').text()).toBe('Alpha');
    expect(items[0].find('.robot-position').text()).toBe('(0, 0)');
    expect(items[0].find('.robot-color-dot').exists()).toBe(true);

    expect(items[1].find('.robot-name').text()).toBe('Beta');
    expect(items[1].find('.robot-position').text()).toBe('(2, 3)');
  });

  it('emits "scroll-to-robot" with robot name when a robot item is clicked', async () => {
    const wrapper = mount(ControlPanel, { props: defaultProps() });
    const items = wrapper.findAll('.robot-item');
    await items[1].trigger('click');
    expect(wrapper.emitted('scroll-to-robot')).toHaveLength(1);
    expect(wrapper.emitted('scroll-to-robot')[0]).toEqual(['Beta']);
  });

  it('assigns correct HSL colors to robot dots', () => {
    const wrapper = mount(ControlPanel, { props: defaultProps() });

    // Verify robotColor method produces correct HSL strings
    // (jsdom converts inline HSL values to RGB, so we test the method directly)
    expect(wrapper.vm.robotColor(0)).toBe('hsl(0, 70%, 50%)');
    expect(wrapper.vm.robotColor(1)).toBe('hsl(180, 70%, 50%)');

    // Verify dots exist and have inline background-color styles
    const dots = wrapper.findAll('.robot-color-dot');
    expect(dots).toHaveLength(2);
    expect(dots[0].attributes('style')).toContain('background-color');
    expect(dots[1].attributes('style')).toContain('background-color');
  });
});
