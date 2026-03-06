/**
 * Component tests for WelcomeScreen.vue
 *
 * Verifies that the welcome screen renders its title and message text.
 */

import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import WelcomeScreen from '../../components/WelcomeScreen.vue';

describe('WelcomeScreen', () => {
  it('renders a title and a message', () => {
    const wrapper = mount(WelcomeScreen);

    expect(wrapper.find('.welcome-title').text()).toBe('Robots Simulation');
    expect(wrapper.find('.welcome-message').text()).toContain(
      'Select a simulation',
    );
    expect(wrapper.find('.welcome-message').text()).toContain('create a new one');
  });
});
