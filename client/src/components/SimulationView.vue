<template>
  <div class="simulation-view">
    <!-- Loading state -->
    <div v-if="loading" class="loading-state">
      <p class="loading-text">Loading simulation...</p>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="error-state">
      <p class="error-text">{{ error }}</p>
      <button class="btn btn-secondary" @click="$emit('retry')">Retry</button>
    </div>

    <!-- Loaded state -->
    <template v-else>
      <SimulationGrid
        ref="grid"
        :robots="robots"
        :houses="houses"
        :robot-count="robotCount"
      />
    </template>
  </div>
</template>

<script>
import SimulationGrid from './SimulationGrid.vue';

/**
 * Presentational wrapper for the simulation grid area.
 *
 * Displays loading, error, or the simulation grid based on the
 * state props passed down from App.vue. Does not own any state
 * or make API calls — all data flows in as props and all actions
 * flow out as events.
 *
 * @component
 */
export default {
  name: 'SimulationView',

  components: { SimulationGrid },

  props: {
    /** Simulation metadata object, or null if not yet loaded */
    simulation: {
      type: Object,
      default: null,
    },

    /** Array of robot objects */
    robots: {
      type: Array,
      default: () => [],
    },

    /** Array of house objects */
    houses: {
      type: Array,
      default: () => [],
    },

    /** Whether simulation data is currently loading */
    loading: {
      type: Boolean,
      default: false,
    },

    /** Error message to display, or null */
    error: {
      type: String,
      default: null,
    },
  },

  emits: ['retry'],

  computed: {
    /** Robot count derived from simulation metadata */
    robotCount() {
      return this.simulation?.robotCount ?? 1;
    },
  },

  methods: {
    /**
     * Scrolls the grid to center on a robot. Called by the parent
     * via template ref to delegate to SimulationGrid.
     *
     * @param {string} robotName - The robot's name
     */
    scrollToRobot(robotName) {
      this.$refs.grid?.scrollToRobot(robotName);
    },
  },
};
</script>

<style scoped>
.simulation-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: var(--space-md);
}

.loading-text {
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
}

.error-text {
  color: var(--color-error);
  font-size: var(--text-sm);
}

.btn {
  padding: var(--space-sm) var(--space-lg);
  border: none;
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
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
