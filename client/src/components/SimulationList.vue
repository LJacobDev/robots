<template>
  <div class="simulation-list">
    <!-- Loading skeleton -->
    <template v-if="loading">
      <div
        v-for="n in 3"
        :key="'skeleton-' + n"
        class="simulation-item skeleton"
        aria-hidden="true"
      >
        <div class="skeleton-line skeleton-short"></div>
        <div class="skeleton-line skeleton-long"></div>
      </div>
    </template>

    <!-- Empty state -->
    <p v-else-if="simulations.length === 0" class="empty-state">
      No simulations yet — create one to get started.
    </p>

    <!-- Populated list -->
    <template v-else>
      <button
        v-for="sim in simulations"
        :key="sim.id"
        class="simulation-item"
        :class="{ active: sim.id === selectedId }"
        :aria-current="sim.id === selectedId ? 'true' : undefined"
        @click="$emit('select', sim.id)"
      >
        <div class="item-header">
          <span class="item-id">Sim-{{ sim.id }}</span>
          <span class="status-badge" :class="'status-' + sim.status">{{ sim.status }}</span>
        </div>
        <p class="item-created">{{ formatDate(sim.createdAt) }}</p>
      </button>
    </template>
  </div>
</template>

<script>
/**
 * Displays a scrollable list of simulations in the left sidebar.
 *
 * Each item shows the simulation ID, a color-coded status badge,
 * and the move sequence (truncated with ellipsis). Clicking an item
 * emits the `select` event with the simulation's ID.
 *
 * @component
 */
export default {
  name: 'SimulationList',

  props: {
    /** @type {Array<{ id: number, status: string, moveSequence: string }>} */
    simulations: {
      type: Array,
      required: true,
    },
    /** @type {number|null} Currently selected simulation ID */
    selectedId: {
      type: Number,
      default: null,
    },
    /** Whether the simulation list is still loading */
    loading: {
      type: Boolean,
      default: false,
    },
  },

  emits: ['select'],

  methods: {
    /**
     * Formats an ISO timestamp into a short, readable date string.
     *
     * @param {string} iso - ISO 8601 timestamp
     * @returns {string} Formatted date string
     */
    formatDate(iso) {
      if (!iso) return '';
      const d = new Date(iso);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    },
  },
};
</script>

<style scoped>
.simulation-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.simulation-item {
  display: block;
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  font-size: inherit;
  color: inherit;
  transition:
    background-color var(--transition-fast),
    border-color var(--transition-fast);
}

.simulation-item:hover {
  background-color: var(--color-surface-alt);
  border-color: var(--color-border-strong);
}

.simulation-item:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.simulation-item.active {
  border-color: var(--color-primary);
  background-color: var(--color-surface-alt);
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-xs);
}

.item-id {
  font-weight: 600;
  font-size: var(--text-sm);
}

.status-badge {
  display: inline-block;
  padding: 0.125rem var(--space-sm);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: capitalize;
  color: var(--color-text-inverse);
}

.status-created {
  background-color: var(--color-status-created);
}

.status-running {
  background-color: var(--color-status-running);
}

.status-completed {
  background-color: var(--color-status-completed);
}

.item-created {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  margin: 0;
}

/* --- Empty state --- */
.empty-state {
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  text-align: center;
  padding: var(--space-lg) var(--space-md);
}

/* --- Skeleton loading --- */
.skeleton {
  cursor: default;
  pointer-events: none;
}

.skeleton-line {
  height: 0.75rem;
  border-radius: var(--radius-sm);
  background-color: var(--color-border);
  animation: pulse 1.5s ease-in-out infinite;
}

.skeleton-short {
  width: 40%;
  margin-bottom: var(--space-xs);
}

.skeleton-long {
  width: 80%;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}
</style>
