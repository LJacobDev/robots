/**
 * Component tests for CreateSimulationModal.vue
 *
 * Verifies rendering, form validation, arrow key capture, direct
 * character input filtering, API submission (success and error),
 * cancel behaviour, and focus management.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import CreateSimulationModal from '../../components/CreateSimulationModal.vue';

// Mock the API client
vi.mock('../../api/simulations.js', () => ({
  createSimulation: vi.fn(),
}));

import { createSimulation } from '../../api/simulations.js';

describe('CreateSimulationModal', () => {
  beforeEach(() => {
    createSimulation.mockReset();
  });

  it('does not render the modal when visible is false', () => {
    const wrapper = mount(CreateSimulationModal, {
      props: { visible: false },
    });

    expect(wrapper.find('.modal-overlay').exists()).toBe(false);
  });

  it('renders the modal with form fields when visible is true', () => {
    const wrapper = mount(CreateSimulationModal, {
      props: { visible: true },
    });

    expect(wrapper.find('.modal-overlay').exists()).toBe(true);
    expect(wrapper.find('#robot-count').exists()).toBe(true);
    expect(wrapper.find('#move-sequence').exists()).toBe(true);
    expect(wrapper.find('.modal-title').text()).toBe('Create Simulation');
  });

  it('shows validation errors when submitting with empty fields', async () => {
    const wrapper = mount(CreateSimulationModal, {
      props: { visible: true },
    });

    // Clear robot count to trigger both validations
    await wrapper.find('#robot-count').setValue('');
    await wrapper.find('form').trigger('submit');

    expect(wrapper.find('.field-error').exists()).toBe(true);
    expect(createSimulation).not.toHaveBeenCalled();
  });

  it('shows move sequence error when only move sequence is empty', async () => {
    const wrapper = mount(CreateSimulationModal, {
      props: { visible: true },
    });

    // Robot count defaults to 1 (valid), but moveSequence is empty
    await wrapper.find('form').trigger('submit');

    const errors = wrapper.findAll('.field-error');
    expect(errors).toHaveLength(1);
    expect(errors[0].text()).toContain('Move sequence is required');
  });

  it('shows robot count error for non-positive values', async () => {
    const wrapper = mount(CreateSimulationModal, {
      props: { visible: true },
    });

    await wrapper.find('#robot-count').setValue(0);
    await wrapper.find('#move-sequence').setValue('^^VV');
    await wrapper.find('form').trigger('submit');

    const errors = wrapper.findAll('.field-error');
    expect(errors).toHaveLength(1);
    expect(errors[0].text()).toContain('positive integer');
  });

  it('converts arrow key presses to direction characters', async () => {
    const wrapper = mount(CreateSimulationModal, {
      props: { visible: true },
    });

    const textarea = wrapper.find('#move-sequence');

    await textarea.trigger('keydown', { key: 'ArrowUp' });
    await textarea.trigger('keydown', { key: 'ArrowDown' });
    await textarea.trigger('keydown', { key: 'ArrowLeft' });
    await textarea.trigger('keydown', { key: 'ArrowRight' });

    expect(wrapper.vm.moveSequence).toBe('^V<>');
  });

  it('allows Backspace and Delete for editing', async () => {
    const wrapper = mount(CreateSimulationModal, {
      props: { visible: true },
    });

    const textarea = wrapper.find('#move-sequence');

    // These should not be prevented
    const backspaceEvent = new KeyboardEvent('keydown', { key: 'Backspace' });
    const spy = vi.spyOn(backspaceEvent, 'preventDefault');
    textarea.element.dispatchEvent(backspaceEvent);

    expect(spy).not.toHaveBeenCalled();
  });

  it('blocks invalid key presses in the textarea', async () => {
    const wrapper = mount(CreateSimulationModal, {
      props: { visible: true },
    });

    const textarea = wrapper.find('#move-sequence');

    // 'a' is not a valid direction character
    const event = new KeyboardEvent('keydown', {
      key: 'a',
      cancelable: true,
    });
    const spy = vi.spyOn(event, 'preventDefault');
    textarea.element.dispatchEvent(event);

    // The component's keydown handler should have called preventDefault
    expect(spy).toHaveBeenCalled();
  });

  it('calls createSimulation API on valid submit and emits created', async () => {
    const mockResponse = {
      simulation: { id: 5, status: 'created', moveSequence: '^^', robotCount: 2 },
      robots: [],
    };
    createSimulation.mockResolvedValue(mockResponse);

    const wrapper = mount(CreateSimulationModal, {
      props: { visible: true },
    });

    await wrapper.find('#robot-count').setValue(2);
    await wrapper.find('#move-sequence').setValue('^^');
    await wrapper.find('form').trigger('submit');

    // Wait for the async submit to complete
    await vi.waitFor(() => {
      expect(wrapper.emitted('created')).toHaveLength(1);
    });

    expect(createSimulation).toHaveBeenCalledWith(2, '^^');
    expect(wrapper.emitted('created')[0]).toEqual([mockResponse]);
  });

  it('displays API error message on submission failure', async () => {
    const apiErr = new Error('Invalid move sequence');
    apiErr.body = { error: { code: 'VALIDATION_ERROR', message: 'Invalid move sequence' } };
    createSimulation.mockRejectedValue(apiErr);

    const wrapper = mount(CreateSimulationModal, {
      props: { visible: true },
    });

    await wrapper.find('#robot-count').setValue(1);
    await wrapper.find('#move-sequence').setValue('^^');
    await wrapper.find('form').trigger('submit');

    await vi.waitFor(() => {
      expect(wrapper.find('.api-error').exists()).toBe(true);
    });

    expect(wrapper.find('.api-error').text()).toBe('Invalid move sequence');
  });

  it('disables the submit button while submitting', async () => {
    // Never resolve — stays in submitting state
    createSimulation.mockReturnValue(new Promise(() => {}));

    const wrapper = mount(CreateSimulationModal, {
      props: { visible: true },
    });

    await wrapper.find('#move-sequence').setValue('^^');
    await wrapper.find('form').trigger('submit');

    await vi.waitFor(() => {
      expect(wrapper.find('.btn-primary').attributes('disabled')).toBeDefined();
    });

    expect(wrapper.find('.btn-primary').text()).toBe('Creating...');
  });

  it('emits close and resets form when Cancel is clicked', async () => {
    const wrapper = mount(CreateSimulationModal, {
      props: { visible: true },
    });

    // Modify some state first
    await wrapper.find('#move-sequence').setValue('^^VV');
    await wrapper.find('.btn-secondary').trigger('click');

    expect(wrapper.emitted('close')).toHaveLength(1);
    // Form should be reset
    expect(wrapper.vm.moveSequence).toBe('');
    expect(wrapper.vm.robotCount).toBe(1);
  });

  it('emits close when clicking the overlay backdrop', async () => {
    const wrapper = mount(CreateSimulationModal, {
      props: { visible: true },
    });

    await wrapper.find('.modal-overlay').trigger('mousedown');

    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('has proper ARIA attributes for accessibility', () => {
    const wrapper = mount(CreateSimulationModal, {
      props: { visible: true },
    });

    const dialog = wrapper.find('.modal-card');
    expect(dialog.attributes('role')).toBe('dialog');
    expect(dialog.attributes('aria-modal')).toBe('true');
    expect(dialog.attributes('aria-labelledby')).toBe('create-sim-title');
  });

  it('submits the form when Enter is pressed in the textarea', async () => {
    const wrapper = mount(CreateSimulationModal, {
      props: { visible: true },
    });

    // Leave moveSequence empty so validation fires — proves submit() was called
    const textarea = wrapper.find('#move-sequence');
    await textarea.trigger('keydown', { key: 'Enter' });

    // Validation error should appear, meaning submit() ran
    expect(wrapper.find('.field-error').exists()).toBe(true);
    expect(wrapper.find('.field-error').text()).toContain('Move sequence is required');
  });

  it('clears robot count error when robotCount changes', async () => {
    const wrapper = mount(CreateSimulationModal, {
      props: { visible: true },
    });

    // Trigger validation error
    await wrapper.find('#robot-count').setValue(0);
    await wrapper.find('#move-sequence').setValue('^^');
    await wrapper.find('form').trigger('submit');

    expect(wrapper.findAll('.field-error')).toHaveLength(1);
    expect(wrapper.find('.field-error').text()).toContain('positive integer');

    // Fix the value — error should clear
    await wrapper.find('#robot-count').setValue(3);
    expect(wrapper.find('.field-error').exists()).toBe(false);
  });

  it('clears move sequence error when moveSequence changes', async () => {
    const wrapper = mount(CreateSimulationModal, {
      props: { visible: true },
    });

    // Trigger validation error
    await wrapper.find('form').trigger('submit');

    const errors = wrapper.findAll('.field-error');
    expect(errors).toHaveLength(1);
    expect(errors[0].text()).toContain('Move sequence is required');

    // Type something — error should clear
    await wrapper.find('#move-sequence').setValue('^^');
    expect(wrapper.find('.field-error').exists()).toBe(false);
  });
});
