/**
 * Component tests for RobotMarker.vue
 *
 * Verifies that the inline SVG renders with the correct color prop,
 * custom size, accessible label, and default values.
 */

import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import RobotMarker from '../../components/RobotMarker.vue';

describe('RobotMarker', () => {
  it('renders an SVG element', () => {
    const wrapper = mount(RobotMarker);
    expect(wrapper.find('svg').exists()).toBe(true);
  });

  it('applies the color prop as fill on body shapes', () => {
    const wrapper = mount(RobotMarker, {
      props: { color: '#ff0000' },
    });

    // The head rect should use the color
    const head = wrapper.find('rect');
    expect(head.attributes('fill')).toBe('#ff0000');
  });

  it('uses default color when no color prop is provided', () => {
    const wrapper = mount(RobotMarker);

    const head = wrapper.find('rect');
    expect(head.attributes('fill')).toBe('hsl(210, 80%, 55%)');
  });

  it('renders at the specified size', () => {
    const wrapper = mount(RobotMarker, {
      props: { size: 32 },
    });

    const svg = wrapper.find('svg');
    expect(svg.attributes('width')).toBe('32');
    expect(svg.attributes('height')).toBe('32');
  });

  it('uses default size of 24 when no size prop is provided', () => {
    const wrapper = mount(RobotMarker);

    const svg = wrapper.find('svg');
    expect(svg.attributes('width')).toBe('24');
    expect(svg.attributes('height')).toBe('24');
  });

  it('includes the label in the aria-label', () => {
    const wrapper = mount(RobotMarker, {
      props: { label: 'Sparky' },
    });

    expect(wrapper.find('svg').attributes('aria-label')).toBe('Robot: Sparky');
  });

  it('has a generic aria-label when no label is provided', () => {
    const wrapper = mount(RobotMarker);
    expect(wrapper.find('svg').attributes('aria-label')).toBe('Robot');
  });
});
