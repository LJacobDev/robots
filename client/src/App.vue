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
        <SimulationView
          v-if="selectedSimulationId"
          ref="simView"
          :simulation="simulation"
          :robots="robots"
          :houses="houses"
          :loading="loadingSimulation"
          :error="simulationError"
          @retry="loadSimulation"
        />
        <WelcomeScreen v-else />
      </main>

      <aside v-if="selectedSimulationId && simulation" class="sidebar-right">
        <ControlPanel
          :simulation="simulation"
          :robots="robots"
          :total-presents="totalPresents"
          :house-query-result="houseQueryResult"
          :is-step-loading="isStepLoading"
          :is-run-loading="isRunLoading"
          :robot-count="simulation.robotCount"
          @step="handleStep"
          @run="handleRun"
          @check-houses="handleCheckHouses"
          @scroll-to-robot="handleScrollToRobot"
        />
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
import {
  listSimulations,
  getSimulation,
  stepSimulation,
  runSimulation,
  getHousesByThreshold,
} from './api/simulations.js';
import ControlPanel from './components/ControlPanel.vue';
import CreateSimulationModal from './components/CreateSimulationModal.vue';
import SimulationList from './components/SimulationList.vue';
import SimulationView from './components/SimulationView.vue';
import WelcomeScreen from './components/WelcomeScreen.vue';

/**
 * Root application component.
 *
 * Manages the three-panel layout and owns all application state:
 * the simulation list, the selected simulation's full detail
 * (simulation, robots, houses, summary), and action state
 * (step/run loading, house query results).
 *
 * Passes state down as props to SimulationView (center grid) and
 * ControlPanel (right sidebar). Handles all API interactions.
 *
 * @component
 */
export default {
  name: 'App',

  components: { ControlPanel, CreateSimulationModal, SimulationList, SimulationView, WelcomeScreen },

  data() {
    return {
      // --- Simulation list state ---
      /** @type {number|null} Currently selected simulation ID */
      selectedSimulationId: null,
      /** @type {Array} List of all simulations */
      simulations: [],
      /** Whether the simulation list is currently loading */
      loadingList: true,
      /** Whether the create simulation modal is open */
      showCreateModal: false,

      // --- Selected simulation detail state ---
      /** @type {object|null} Simulation metadata */
      simulation: null,
      /** @type {Array} Current robot positions */
      robots: [],
      /** @type {Array} Houses with present counts */
      houses: [],
      /** @type {object|null} Summary stats from API */
      summary: null,
      /** Whether simulation details are loading */
      loadingSimulation: false,
      /** @type {string|null} Error message from simulation operations */
      simulationError: null,

      // --- Action state ---
      /** Whether a step action is in flight */
      isStepLoading: false,
      /** Whether a run action is in flight */
      isRunLoading: false,
      /** @type {object|null} Result of a houses-by-threshold query */
      houseQueryResult: null,
    };
  },

  computed: {
    /** Total presents delivered, derived from API summary */
    totalPresents() {
      return this.summary?.totalPresentsDelivered ?? 0;
    },
  },

  watch: {
    selectedSimulationId(newId) {
      if (newId) {
        this.loadSimulation();
      } else {
        this.clearSimulationState();
      }
    },
  },

  async mounted() {
    await this.fetchSimulations();
  },

  methods: {
    // --- List methods ---

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

    // --- Simulation detail methods ---

    /** Resets all simulation detail state to initial values */
    clearSimulationState() {
      this.simulation = null;
      this.robots = [];
      this.houses = [];
      this.summary = null;
      this.simulationError = null;
      this.houseQueryResult = null;
      this.isStepLoading = false;
      this.isRunLoading = false;
    },

    /**
     * Fetches full simulation details from the API.
     * Called when a simulation is selected and on retry.
     */
    async loadSimulation() {
      this.loadingSimulation = true;
      this.simulationError = null;

      try {
        const data = await getSimulation(this.selectedSimulationId);
        this.simulation = data.simulation;
        this.robots = data.robots;
        this.houses = data.houses;
        this.summary = data.summary;
        this.houseQueryResult = null;
      } catch (err) {
        this.simulationError = err.body?.error?.message || 'Failed to load simulation.';
        if (import.meta.env.DEV) {
          console.error('[App] Load simulation error:', err);
        }
      } finally {
        this.loadingSimulation = false;
      }
    },

    /**
     * Refreshes simulation state from the API after an action (step/run).
     * Also updates the simulation entry in the sidebar list.
     */
    async refreshSimulation() {
      const data = await getSimulation(this.selectedSimulationId);
      this.simulation = data.simulation;
      this.robots = data.robots;
      this.houses = data.houses;
      this.summary = data.summary;
      this.houseQueryResult = null;

      // Keep the sidebar list in sync
      const idx = this.simulations.findIndex((s) => s.id === data.simulation.id);
      if (idx !== -1) {
        this.simulations[idx] = { ...this.simulations[idx], ...data.simulation };
      }
    },

    /**
     * Steps the simulation forward by one turn.
     */
    async handleStep() {
      this.isStepLoading = true;
      try {
        await stepSimulation(this.selectedSimulationId);
        await this.refreshSimulation();
      } catch (err) {
        this.simulationError = err.body?.error?.message || 'Step failed.';
        if (import.meta.env.DEV) {
          console.error('[App] Step error:', err);
        }
      } finally {
        this.isStepLoading = false;
      }
    },

    /**
     * Runs the simulation to completion.
     */
    async handleRun() {
      this.isRunLoading = true;
      try {
        await runSimulation(this.selectedSimulationId);
        await this.refreshSimulation();
      } catch (err) {
        this.simulationError = err.body?.error?.message || 'Run failed.';
        if (import.meta.env.DEV) {
          console.error('[App] Run error:', err);
        }
      } finally {
        this.isRunLoading = false;
      }
    },

    /**
     * Queries houses with at least N presents.
     *
     * @param {number} threshold - Minimum present count
     */
    async handleCheckHouses(threshold) {
      try {
        const data = await getHousesByThreshold(this.selectedSimulationId, threshold);
        this.houseQueryResult = data;
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error('[App] Houses query error:', err);
        }
      }
    },

    /**
     * Scrolls the grid viewport to center on a specific robot.
     *
     * @param {string} robotName - The robot's name
     */
    handleScrollToRobot(robotName) {
      this.$refs.simView?.scrollToRobot(robotName);
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
</style>
