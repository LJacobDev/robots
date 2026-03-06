<template>
  <div
    v-if="visible"
    class="modal-overlay"
    @mousedown.self="cancel"
    @keydown.esc="cancel"
  >
    <div
      ref="modal"
      class="modal-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-sim-title"
    >
      <h2 id="create-sim-title" class="modal-title">Create Simulation</h2>

      <form @submit.prevent="submit">
        <div class="form-group">
          <label for="robot-count" class="form-label">Robot count</label>
          <input
            id="robot-count"
            ref="robotCountInput"
            v-model.number="robotCount"
            type="number"
            class="form-input"
            :class="{ 'input-error': robotCountError }"
          />
          <p v-if="robotCountError" class="field-error">{{ robotCountError }}</p>
        </div>

        <div class="form-group">
          <label for="move-sequence" class="form-label">Move sequence</label>
          <textarea
            id="move-sequence"
            ref="moveSequenceInput"
            v-model="moveSequence"
            class="form-textarea"
            :class="{ 'input-error': moveSequenceError }"
            rows="4"
            placeholder="Type ^V<> or press arrow keys..."
            @keydown="handleKeydown"
          ></textarea>
          <p class="form-hint">
            Use arrow keys to input directions, or type
            <kbd>^</kbd> <kbd>V</kbd> <kbd>&lt;</kbd> <kbd>&gt;</kbd> directly.
          </p>
          <p v-if="moveSequenceError" class="field-error">{{ moveSequenceError }}</p>
        </div>

        <p v-if="apiError" class="api-error" role="alert">{{ apiError }}</p>

        <div class="modal-actions">
          <button
            type="button"
            class="btn btn-secondary"
            @click="cancel"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="btn btn-primary"
            :disabled="isSubmitting"
          >
            {{ isSubmitting ? 'Creating...' : 'Create' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { createSimulation } from '../api/simulations.js';

/**
 * Arrow key → direction character mapping.
 * @type {Record<string, string>}
 */
const ARROW_MAP = {
  ArrowUp: '^',
  ArrowDown: 'V',
  ArrowLeft: '<',
  ArrowRight: '>',
};

/**
 * Keys that are always allowed in the move sequence textarea
 * for editing and navigation purposes.
 * @type {Set<string>}
 */
const ALLOWED_KEYS = new Set([
  'Backspace',
  'Delete',
  'Tab',
  'Home',
  'End',
]);

/**
 * Valid characters that can be typed directly into the move sequence.
 * @type {Set<string>}
 */
const VALID_CHARS = new Set(['^', 'V', 'v', '<', '>']);

/**
 * Modal dialog for creating a new simulation.
 *
 * Captures arrow key presses in the move sequence textarea and converts
 * them to directional characters (^, V, <, >). Validates inputs before
 * submitting to the API. Emits `created` with the new simulation data
 * on success, or `close` on cancel.
 *
 * @component
 */
export default {
  name: 'CreateSimulationModal',

  props: {
    /** Whether the modal is visible */
    visible: {
      type: Boolean,
      required: true,
    },
  },

  emits: ['close', 'created'],

  data() {
    return {
      /** @type {number} Number of robots */
      robotCount: 1,
      /** @type {string} Movement instruction string */
      moveSequence: '',
      /** @type {string|null} Robot count validation error */
      robotCountError: null,
      /** @type {string|null} Move sequence validation error */
      moveSequenceError: null,
      /** @type {string|null} API error message */
      apiError: null,
      /** Whether an API call is in flight */
      isSubmitting: false,
    };
  },

  watch: {
    visible(isVisible) {
      if (isVisible) {
        this.$nextTick(() => {
          this.$refs.robotCountInput?.focus();
        });
      }
    },

    robotCount() {
      if (this.robotCountError) {
        this.robotCountError = null;
      }
    },

    moveSequence() {
      if (this.moveSequenceError) {
        this.moveSequenceError = null;
      }
    },
  },

  methods: {
    /**
     * Handles keydown events in the move sequence textarea.
     * Converts arrow keys to direction characters and blocks
     * invalid key presses.
     *
     * @param {KeyboardEvent} event
     */
    handleKeydown(event) {
      // Allow Ctrl/Cmd shortcuts (copy, paste, select all, undo, redo)
      if (event.ctrlKey || event.metaKey) {
        return;
      }

      // Enter submits the form instead of inserting a newline
      if (event.key === 'Enter') {
        event.preventDefault();
        this.submit();
        return;
      }

      // Arrow keys → append direction character
      if (ARROW_MAP[event.key]) {
        event.preventDefault();
        this.moveSequence += ARROW_MAP[event.key];
        return;
      }

      // Allow editing/navigation keys
      if (ALLOWED_KEYS.has(event.key)) {
        return;
      }

      // Allow valid direction characters typed directly
      if (VALID_CHARS.has(event.key)) {
        return;
      }

      // Block everything else
      event.preventDefault();
    },

    /**
     * Validates form inputs. Returns true if valid, false otherwise.
     * Sets error messages on the relevant fields.
     *
     * @returns {boolean}
     */
    validate() {
      this.robotCountError = null;
      this.moveSequenceError = null;

      let valid = true;

      if (!Number.isInteger(this.robotCount) || this.robotCount < 1) {
        this.robotCountError = 'Robot count must be a positive integer.';
        valid = false;
      }

      const trimmed = this.moveSequence.trim();
      if (!trimmed) {
        this.moveSequenceError = 'Move sequence is required.';
        valid = false;
      }

      return valid;
    },

    /**
     * Validates and submits the form. On success, emits `created`
     * with the API response data. On failure, displays the error inline.
     */
    async submit() {
      this.apiError = null;

      if (!this.validate()) {
        return;
      }

      this.isSubmitting = true;
      try {
        const data = await createSimulation(
          this.robotCount,
          this.moveSequence.trim(),
        );
        this.$emit('created', data);
        this.resetForm();
      } catch (err) {
        this.apiError = err.body?.error?.message || 'Failed to create simulation.';
      } finally {
        this.isSubmitting = false;
      }
    },

    /**
     * Cancels the modal — resets all fields and emits `close`.
     */
    cancel() {
      this.resetForm();
      this.$emit('close');
    },

    /**
     * Resets all form fields and error states to their defaults.
     */
    resetForm() {
      this.robotCount = 1;
      this.moveSequence = '';
      this.robotCountError = null;
      this.moveSequenceError = null;
      this.apiError = null;
      this.isSubmitting = false;
    },
  },
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 100;
}

.modal-card {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: var(--space-xl);
  width: 100%;
  max-width: 28rem;
}

.modal-title {
  font-size: var(--text-lg);
  font-weight: 600;
  margin-bottom: var(--space-lg);
}

.form-group {
  margin-bottom: var(--space-md);
}

.form-label {
  display: block;
  font-size: var(--text-sm);
  font-weight: 600;
  margin-bottom: var(--space-xs);
}

.form-input {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: var(--text-base);
  color: var(--color-text);
  background-color: var(--color-surface);
  box-sizing: border-box;
}

.form-input:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
  border-color: var(--color-primary);
}

.form-textarea {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-family: var(--font-mono);
  font-size: var(--text-base);
  color: var(--color-text);
  background-color: var(--color-surface);
  resize: vertical;
  box-sizing: border-box;
}

.form-textarea:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
  border-color: var(--color-primary);
}

.input-error {
  border-color: var(--color-error);
}

.form-hint {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  margin-top: var(--space-xs);
}

.form-hint kbd {
  display: inline-block;
  padding: 0 0.25rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  background-color: var(--color-surface-alt);
}

.field-error {
  font-size: var(--text-xs);
  color: var(--color-error);
  margin-top: var(--space-xs);
}

.api-error {
  font-size: var(--text-sm);
  color: var(--color-error);
  background-color: var(--color-error-bg);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-md);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
  margin-top: var(--space-lg);
}

.btn {
  padding: var(--space-sm) var(--space-lg);
  border: none;
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.btn-primary {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
}

.btn-primary:active:not(:disabled) {
  background-color: var(--color-primary-active);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background-color: transparent;
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover {
  background-color: var(--color-surface-alt);
  color: var(--color-text);
}
</style>
