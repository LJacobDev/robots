/**
 * Component tests for SimulationList.vue
 *
 * Verifies rendering of simulation items, status badges, created
 * timestamps, selection highlighting, loading skeletons, and
 * empty state messaging.
 */

import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import SimulationList from '../../components/SimulationList.vue';

/** Sample simulations matching the shape returned by listSimulations() */
const sampleSimulations = [
  {
    id: 1,
    status: 'created',
    moveSequence: '^^VV<>',
    robotCount: 2,
    createdAt: '2026-03-06T10:30:00Z',
  },
  {
    id: 2,
    status: 'running',
    moveSequence: '^>V<^>V<',
    robotCount: 3,
    createdAt: '2026-03-06T11:00:00Z',
  },
  {
    id: 3,
    status: 'completed',
    moveSequence: '>>><<<^^^VVV',
    robotCount: 1,
    createdAt: '2026-03-06T11:30:00Z',
  },
];

describe('SimulationList', () => {
  it('renders one list item per simulation', () => {
    const wrapper = mount(SimulationList, {
      props: { simulations: sampleSimulations },
    });

    const items = wrapper.findAll('.simulation-item');
    expect(items).toHaveLength(3);
  });

  it('displays simulation ID, status badge, and created date for each item', () => {
    const wrapper = mount(SimulationList, {
      props: { simulations: sampleSimulations },
    });

    const firstItem = wrapper.findAll('.simulation-item')[0];
    expect(firstItem.find('.item-id').text()).toBe('Sim-1');
    expect(firstItem.find('.status-badge').text()).toBe('created');
    expect(firstItem.find('.item-created').exists()).toBe(true);
    expect(firstItem.find('.item-created').text()).not.toBe('');
  });

  it('emits select with the simulation ID when an item is clicked', async () => {
    const wrapper = mount(SimulationList, {
      props: { simulations: sampleSimulations },
    });

    await wrapper.findAll('.simulation-item')[1].trigger('click');

    expect(wrapper.emitted('select')).toHaveLength(1);
    expect(wrapper.emitted('select')[0]).toEqual([2]);
  });

  it('highlights the active item when selectedId matches', () => {
    const wrapper = mount(SimulationList, {
      props: { simulations: sampleSimulations, selectedId: 2 },
    });

    const items = wrapper.findAll('.simulation-item');
    expect(items[0].classes()).not.toContain('active');
    expect(items[1].classes()).toContain('active');
    expect(items[2].classes()).not.toContain('active');
  });

  it('sets aria-current on the active item', () => {
    const wrapper = mount(SimulationList, {
      props: { simulations: sampleSimulations, selectedId: 2 },
    });

    const items = wrapper.findAll('.simulation-item');
    expect(items[0].attributes('aria-current')).toBeUndefined();
    expect(items[1].attributes('aria-current')).toBe('true');
  });

  it('shows empty state message when simulations array is empty', () => {
    const wrapper = mount(SimulationList, {
      props: { simulations: [] },
    });

    expect(wrapper.find('.empty-state').exists()).toBe(true);
    expect(wrapper.find('.empty-state').text()).toContain('No simulations yet');
    expect(wrapper.findAll('.simulation-item')).toHaveLength(0);
  });

  it('shows skeleton placeholders when loading is true', () => {
    const wrapper = mount(SimulationList, {
      props: { simulations: [], loading: true },
    });

    const skeletons = wrapper.findAll('.skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
    expect(wrapper.find('.empty-state').exists()).toBe(false);
  });

  it('applies correct status badge class for each status', () => {
    const wrapper = mount(SimulationList, {
      props: { simulations: sampleSimulations },
    });

    const badges = wrapper.findAll('.status-badge');
    expect(badges[0].classes()).toContain('status-created');
    expect(badges[1].classes()).toContain('status-running');
    expect(badges[2].classes()).toContain('status-completed');
  });

  it('handles missing createdAt gracefully', () => {
    const wrapper = mount(SimulationList, {
      props: {
        simulations: [{ id: 1, status: 'created', moveSequence: '^^' }],
      },
    });

    const created = wrapper.find('.item-created');
    expect(created.exists()).toBe(true);
    expect(created.text()).toBe('');
  });
});
