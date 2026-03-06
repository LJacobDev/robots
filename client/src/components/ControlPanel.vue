<template>
  <div class="control-panel">
    <!-- Simulation info -->
    <section class="panel-section">
      <h3 class="section-title">Simulation #{{ simulation.id }}</h3>
      <div class="info-row">
        <span class="info-label">Status</span>
        <span class="status-badge" :class="`status-${simulation.status}`">
          {{ simulation.status }}
        </span>
      </div>
    </section>

    <!-- Statistics -->
    <section class="panel-section">
      <h3 class="section-title">Statistics</h3>
      <div class="info-row">
        <span class="info-label">Robots</span>
        <span>{{ simulation.robotCount }}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Presents delivered</span>
        <span>{{ totalPresents }}</span>
      </div>
    </section>

    <!-- Houses query -->
    <section class="panel-section">
      <h3 class="section-title">Number of houses with this many presents:</h3>
      <form class="query-form" @submit.prevent="submitHouseQuery">
        <label for="house-threshold" class="sr-only">Minimum presents</label>
        <input
          id="house-threshold"
          v-model.number="houseThreshold"
          type="number"
          min="1"
          class="query-input"
          placeholder="Min presents..."
        />
        <button type="submit" class="btn btn-secondary btn-sm">Check</button>
      </form>
      <p v-if="houseQueryResult" class="query-result">
        <strong>{{ houseQueryResult.houseCount }}</strong>
        {{ houseQueryResult.houseCount === 1 ? 'house has' : 'houses have' }}
        ≥ {{ houseQueryResult.minPresents }}
        {{ houseQueryResult.minPresents === 1 ? 'present' : 'presents' }}
      </p>
    </section>

    <!-- Progress bar -->
    <section class="panel-section">
      <div class="progress-header">
        <span class="info-label">Progress</span>
        <span class="progress-text"
          >Step {{ simulation.currentStep }} of {{ simulation.totalSteps }}</span
        >
      </div>
      <div class="progress-bar-track">
        <div class="progress-bar-fill" :style="progressStyle"></div>
      </div>
    </section>

    <!-- Step / Run controls -->
    <section class="panel-section">
      <div class="button-row">
        <button
          class="btn btn-primary"
          :disabled="isCompleted || isStepLoading || isRunLoading"
          @click="$emit('step')"
        >
          {{ isStepLoading ? 'Stepping...' : 'Step' }}
        </button>
        <button
          class="btn btn-primary"
          :disabled="isCompleted || isStepLoading || isRunLoading"
          @click="$emit('run')"
        >
          {{ isRunLoading ? 'Running...' : 'Run All' }}
        </button>
      </div>
    </section>

    <!-- Move sequence visualization -->
    <section>
      <div class="info-row">
        <span class="info-label">Moves</span>
        <code class="move-sequence">
          <span v-for="(move, index) in moveCharacters" :key="index" :class="moveClass(index)">{{
            move
          }}</span>
        </code>
      </div>
    </section>

    <!-- Robot list -->
    <section class="panel-section">
      <h3 class="section-title">Robots</h3>
      <ul class="robot-list">
        <li
          v-for="robot in robots"
          :key="robot.name"
          class="robot-item"
          @click="$emit('scroll-to-robot', robot.name)"
        >
          <span
            class="robot-color-dot"
            :style="{ backgroundColor: robotColor(robot.turnOrder) }"
          ></span>
          <span class="robot-name">{{ robot.name }}</span>
          <span class="robot-position">({{ robot.position.x }}, {{ robot.position.y }})</span>
        </li>
      </ul>
    </section>
  </div>
</template>

<script>
/**
 * Maps raw move characters to Unicode arrow symbols for display.
 * The API uses <, >, ^, V but the UI renders friendlier arrows.
 */
const ARROW_MAP = {
  '<': '←',
  '>': '→',
  '^': '↑',
  'V': '↓',
};

/**
 * Control panel sidebar for a selected simulation.
 *
 * Displays simulation info, progress bar, step/run action buttons,
 * statistics, a houses-by-threshold query form, and the robot list
 * with click-to-scroll functionality.
 *
 * @component
 */
export default {
  name: 'ControlPanel',

  props: {
    /** Simulation metadata object */
    simulation: {
      type: Object,
      required: true,
    },

    /** Array of robot objects */
    robots: {
      type: Array,
      default: () => [],
    },

    /** Total presents delivered */
    totalPresents: {
      type: Number,
      default: 0,
    },

    /** Result from houses threshold query, or null */
    houseQueryResult: {
      type: Object,
      default: null,
    },

    /** Whether a step action is in progress */
    isStepLoading: {
      type: Boolean,
      default: false,
    },

    /** Whether a run action is in progress */
    isRunLoading: {
      type: Boolean,
      default: false,
    },

    /** Total number of robots, for color calculation */
    robotCount: {
      type: Number,
      default: 1,
    },
  },

  emits: ['step', 'run', 'check-houses', 'scroll-to-robot'],

  data() {
    return {
      /** @type {number} Threshold input value for houses query */
      houseThreshold: 1,
    };
  },

  computed: {
    /** Whether the simulation has finished all steps */
    isCompleted() {
      return this.simulation.status === 'completed';
    },

    /** Progress bar width style */
    progressStyle() {
      const ratio =
        this.simulation.totalSteps > 0
          ? this.simulation.currentStep / this.simulation.totalSteps
          : 0;
      return { width: `${ratio * 100}%` };
    },

    /**
     * Splits the move sequence into an array of Unicode arrow characters.
     * Each character is mapped from the raw API format (^V<>) to a
     * display-friendly Unicode arrow (↑↓←→).
     *
     * @returns {string[]}
     */
    moveCharacters() {
      return this.simulation.moveSequence.split('').map((ch) => ARROW_MAP[ch] || ch);
    },
  },

  methods: {
    /**
     * Returns the CSS class for a move character based on its position
     * relative to the current step.
     *
     * @param {number} index - Index of the move in the sequence
     * @returns {string} CSS class name
     */
    moveClass(index) {
      if (index < this.simulation.currentStep) return 'move-past';
      if (index === this.simulation.currentStep && !this.isCompleted) return 'move-next';
      return 'move-future';
    },
    /**
     * Emits the check-houses event with the current threshold value.
     */
    submitHouseQuery() {
      if (Number.isInteger(this.houseThreshold) && this.houseThreshold >= 1) {
        this.$emit('check-houses', this.houseThreshold);
      }
    },

    /**
     * Generates an HSL color for a robot based on turn order.
     * Must match the logic in SimulationGrid.
     *
     * @param {number} turnOrder
     * @returns {string} HSL color string
     */
    robotColor(turnOrder) {
      const hue = this.robotCount > 1 ? (turnOrder / this.robotCount) * 360 : 210;
      return `hsl(${hue}, 70%, 50%)`;
    },
  },
};
</script>

<style scoped>
.control-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  height: 100%;
  overflow-y: auto;
}

.panel-section {
  padding-bottom: var(--space-md);
  border-bottom: 1px solid var(--color-border);
}

.panel-section:last-child {
  border-bottom: none;
}

.section-title {
  font-size: var(--text-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-secondary);
  margin-bottom: var(--space-sm);
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--text-sm);
  padding: var(--space-xs) 0;
}

.info-label {
  color: var(--color-text-secondary);
  font-size: var(--text-xs);
}

.status-badge {
  display: inline-block;
  padding: 2px var(--space-sm);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: capitalize;
}

.status-created {
  background-color: var(--color-status-created);
  color: white;
}

.status-running {
  background-color: var(--color-status-running);
  color: white;
}

.status-completed {
  background-color: var(--color-status-completed);
  color: white;
}

.move-sequence {
  font-family: var(--font-mono);
  font-size: 1.5rem;
  word-break: break-all;
  max-width: 60%;
  text-align: right;
  letter-spacing: 0.05em;
}

.move-past {
  color: var(--color-text-secondary);
  opacity: 0.4;
}

.move-next {
  color: var(--color-success);
  font-weight: 700;
}

.move-future {
  color: var(--color-text);
}

/* Progress bar */
.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-xs);
}

.progress-text {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  font-family: var(--font-mono);
}

.progress-bar-track {
  width: 100%;
  height: 6px;
  background-color: var(--color-surface-alt);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background-color: var(--color-success);
  border-radius: var(--radius-full);
  transition: width var(--transition-normal);
}

/* Buttons */
.button-row {
  display: flex;
  gap: var(--space-sm);
}

.btn {
  padding: var(--space-sm) var(--space-md);
  border: none;
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--transition-fast);
  flex: 1;
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

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background-color: transparent;
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover {
  background-color: var(--color-surface-alt);
}

.btn-sm {
  padding: var(--space-xs) var(--space-sm);
  flex: none;
}

/* Houses query */
.query-form {
  display: flex;
  gap: var(--space-xs);
  margin-bottom: var(--space-sm);
}

.query-input {
  flex: 1;
  min-width: 0;
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--color-text);
  background-color: var(--color-surface);
  box-sizing: border-box;
}

.query-input:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.query-result {
  font-size: var(--text-sm);
  color: var(--color-text);
  padding: var(--space-xs) 0;
}

/* Robot list */
.robot-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.robot-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--text-sm);
  transition: background-color var(--transition-fast);
}

.robot-item:hover {
  background-color: var(--color-surface-alt);
}

.robot-color-dot {
  width: 10px;
  height: 10px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.robot-name {
  font-weight: 600;
  flex: 1;
}

.robot-position {
  color: var(--color-text-secondary);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}

/* Screen reader only */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
