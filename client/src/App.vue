<template>
  <div class="app-frame">
    <div class="app-layout" :class="{ 'has-right-sidebar': selectedSimulationId }">
      <aside class="sidebar-left">
        <div class="sidebar-header">
          <h2 class="sidebar-title">Simulations</h2>
          <button class="btn-create" @click="showCreateModal = true">+ New</button>
        </div>
        <SimulationList
          :simulations="simulations"
          :selected-id="selectedSimulationId"
          :loading="loadingList"
          @select="selectSimulation"
        />
      </aside>

      <main class="center-area">
        <template v-if="selectedSimulationId">
          <p class="placeholder-text">Grid goes here (simulation {{ selectedSimulationId }})</p>
        </template>
        <WelcomeScreen v-else />
      </main>

      <aside v-if="selectedSimulationId" class="sidebar-right">
        <h2 class="sidebar-title">Controls</h2>
        <p class="placeholder-text">Control panel goes here</p>
      </aside>
    </div>

    <CreateSimulationModal
      :visible="showCreateModal"
      @close="showCreateModal = false"
      @created="handleCreated"
    />
  </div>
</template>

<script>
import { listSimulations } from './api/simulations.js';
import CreateSimulationModal from './components/CreateSimulationModal.vue';
import SimulationList from './components/SimulationList.vue';
import WelcomeScreen from './components/WelcomeScreen.vue';

/**
 * Root application component.
 *
 * Manages the three-panel layout, owns the simulation list and
 * selected simulation state, and fetches the simulation list on mount.
 *
 * @component
 */
export default {
  name: 'App',

  components: { CreateSimulationModal, SimulationList, WelcomeScreen },

  data() {
    return {
      /** @type {number|null} Currently selected simulation ID */
      selectedSimulationId: null,
      /** @type {Array} List of all simulations */
      simulations: [],
      /** Whether the simulation list is currently loading */
      loadingList: true,
      /** Whether the create simulation modal is open */
      showCreateModal: false,
    };
  },

  async mounted() {
    await this.fetchSimulations();
  },

  methods: {
    /**
     * Fetches the simulation list from the API and updates state.
     * Sets loadingList to false when complete, whether successful or not.
     */
    async fetchSimulations() {
      this.loadingList = true;
      try {
        const data = await listSimulations();
        this.simulations = data.simulations;
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error('[App] Failed to fetch simulations:', err);
        }
        this.simulations = [];
      } finally {
        this.loadingList = false;
      }
    },

    /**
     * Selects a simulation by ID.
     *
     * @param {number} id - The simulation ID to select
     */
    selectSimulation(id) {
      this.selectedSimulationId = id;
    },

    /**
     * Handles a newly created simulation.
     * Prepends it to the list, selects it, and closes the modal.
     *
     * @param {object} data - The API response containing the new simulation
     */
    handleCreated(data) {
      this.simulations.unshift(data.simulation);
      this.selectedSimulationId = data.simulation.id;
      this.showCreateModal = false;
    },
  },
};
</script>

<style scoped>
.app-frame {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100vw;
  height: 100vh;
  background-color: var(--color-background);
  font-family: var(--font-sans);
  font-size: var(--text-base);
  color: var(--color-text);
}

.app-layout {
  display: grid;
  grid-template-columns: var(--sidebar-left-width) 1fr;
  width: 80%;
  height: 80%;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  overflow: hidden;
}

.app-layout.has-right-sidebar {
  grid-template-columns: var(--sidebar-left-width) 1fr var(--sidebar-right-width);
}

.sidebar-left,
.sidebar-right {
  background-color: var(--color-surface);
  border-right: 1px solid var(--color-border);
  overflow-y: auto;
  padding: var(--space-md);
}

.sidebar-right {
  border-right: none;
  border-left: 1px solid var(--color-border);
}

.center-area {
  overflow: auto;
  padding: var(--space-md);
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-md);
}

.sidebar-title {
  font-size: var(--text-lg);
  font-weight: 600;
}

.btn-create {
  padding: var(--space-xs) var(--space-sm);
  border: none;
  border-radius: var(--radius-md);
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.btn-create:hover {
  background-color: var(--color-primary-hover);
}

.btn-create:active {
  background-color: var(--color-primary-active);
}

.btn-create:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Temporary placeholder styling — removed when real components arrive */
.placeholder-text {
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
}
</style>
