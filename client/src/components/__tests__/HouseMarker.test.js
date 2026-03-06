/**
 * Component tests for HouseMarker.vue
 *
 * Verifies that the inline SVG renders with the correct color prop,
 * custom size, and default values.
 */

import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import HouseMarker from '../../components/HouseMarker.vue';

describe('HouseMarker', () => {
  it('renders an SVG element', () => {
    const wrapper = mount(HouseMarker);
    expect(wrapper.find('svg').exists()).toBe(true);
  });

  it('applies the color prop as stroke on the bow', () => {
    const wrapper = mount(HouseMarker, {
      props: { color: '#e67e22' },
    });

    const bow = wrapper.find('circle');
    expect(bow.attributes('stroke')).toBe('#e67e22');
  });

  it('uses default color when no color prop is provided', () => {
    const wrapper = mount(HouseMarker);

    const bow = wrapper.find('circle');
    expect(bow.attributes('stroke')).toBe('hsl(35, 80%, 50%)');
  });

  it('renders at the specified size', () => {
    const wrapper = mount(HouseMarker, {
      props: { size: 20 },
    });

    const svg = wrapper.find('svg');
    expect(svg.attributes('width')).toBe('20');
    expect(svg.attributes('height')).toBe('20');
  });

  it('uses default size of 24 when no size prop is provided', () => {
    const wrapper = mount(HouseMarker);

    const svg = wrapper.find('svg');
    expect(svg.attributes('width')).toBe('24');
    expect(svg.attributes('height')).toBe('24');
  });

  it('has an accessible aria-label', () => {
    const wrapper = mount(HouseMarker);
    expect(wrapper.find('svg').attributes('aria-label')).toBe('Present');
  });
});
