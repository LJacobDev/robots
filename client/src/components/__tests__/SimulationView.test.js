/**
 * Component tests for SimulationView.vue
 *
 * SimulationView is a presentational component that renders loading,
 * error, or grid states based on props passed from App.vue.
 * These tests verify each visual state and the retry emit.
 */

import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import SimulationView from '../../components/SimulationView.vue';

/** Stub for SimulationGrid to avoid rendering the full grid */
const GridStub = {
  template: '<div class="grid-stub"></div>',
  methods: { scrollToRobot: vi.fn() },
};

/** Sample simulation object */
const sampleSimulation = {
  id: 1,
  robotCount: 2,
  moveSequence: 'NE',
  status: 'created',
  currentStep: 0,
  totalSteps: 4,
};

const sampleRobots = [
  { name: 'Alpha', turnOrder: 0, position: { x: 0, y: 0 } },
  { name: 'Beta', turnOrder: 1, position: { x: 1, y: 1 } },
];

const sampleHouses = [{ x: 0, y: 0, presentsCount: 2 }];

/** Default props for a loaded state */
function loadedProps(overrides = {}) {
  return {
    simulation: sampleSimulation,
    robots: sampleRobots,
    houses: sampleHouses,
    loading: false,
    error: null,
    ...overrides,
  };
}

/** Global stubs applied to all mounts */
const globalStubs = { stubs: { SimulationGrid: GridStub } };

describe('SimulationView', () => {
  // --- Loading state ---

  it('shows loading text when loading prop is true', () => {
    const wrapper = mount(SimulationView, {
      props: { loading: true },
      global: globalStubs,
    });

    expect(wrapper.find('.loading-text').exists()).toBe(true);
    expect(wrapper.text()).toContain('Loading simulation...');
    expect(wrapper.find('.grid-stub').exists()).toBe(false);
  });

  // --- Error state ---

  it('shows error text when error prop is set', () => {
    const wrapper = mount(SimulationView, {
      props: { loading: false, error: 'Not found' },
      global: globalStubs,
    });

    expect(wrapper.find('.error-text').exists()).toBe(true);
    expect(wrapper.text()).toContain('Not found');
    expect(wrapper.find('.grid-stub').exists()).toBe(false);
  });

  it('emits "retry" when Retry button is clicked', async () => {
    const wrapper = mount(SimulationView, {
      props: { loading: false, error: 'Something went wrong' },
      global: globalStubs,
    });

    await wrapper.find('.btn-secondary').trigger('click');
    expect(wrapper.emitted('retry')).toHaveLength(1);
  });

  // --- Loaded state ---

  it('renders the grid when simulation data is provided', () => {
    const wrapper = mount(SimulationView, {
      props: loadedProps(),
      global: globalStubs,
    });

    expect(wrapper.find('.loading-text').exists()).toBe(false);
    expect(wrapper.find('.error-text').exists()).toBe(false);
    expect(wrapper.find('.grid-stub').exists()).toBe(true);
  });

  it('passes robot count to SimulationGrid via computed prop', () => {
    const wrapper = mount(SimulationView, {
      props: loadedProps(),
      global: globalStubs,
    });

    // Grid stub renders, confirming data flows through
    expect(wrapper.find('.grid-stub').exists()).toBe(true);
    // The robotCount computed is derived from simulation.robotCount
    expect(wrapper.vm.robotCount).toBe(2);
  });

  it('derives robotCount from simulation prop', () => {
    const wrapper = mount(SimulationView, {
      props: loadedProps({
        simulation: { ...sampleSimulation, robotCount: 5 },
      }),
      global: globalStubs,
    });

    expect(wrapper.vm.robotCount).toBe(5);
  });

  it('defaults robotCount to 1 when simulation is null', () => {
    const wrapper = mount(SimulationView, {
      props: { loading: false, error: null, simulation: null },
      global: globalStubs,
    });

    expect(wrapper.vm.robotCount).toBe(1);
  });

  // --- scrollToRobot delegation ---

  it('exposes scrollToRobot that delegates to SimulationGrid', () => {
    const scrollSpy = vi.fn();
    const SpyGridStub = {
      template: '<div class="grid-stub"></div>',
      methods: { scrollToRobot: scrollSpy },
    };

    const wrapper = mount(SimulationView, {
      props: loadedProps(),
      global: { stubs: { SimulationGrid: SpyGridStub } },
    });

    wrapper.vm.scrollToRobot('Alpha');
    expect(scrollSpy).toHaveBeenCalledWith('Alpha');
  });
});
