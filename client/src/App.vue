<template>
  <div class="app-frame">
    <div class="app-layout" :class="{ 'has-right-sidebar': selectedSimulationId }">
      <aside class="sidebar-left">
        <h2 class="sidebar-title">Simulations</h2>
        <p class="placeholder-text">Simulation list goes here</p>
      </aside>

      <main class="center-area">
        <template v-if="selectedSimulationId">
          <p class="placeholder-text">Grid goes here (simulation {{ selectedSimulationId }})</p>
        </template>
        <template v-else>
          <p class="placeholder-text">Welcome screen goes here</p>
        </template>
      </main>

      <aside v-if="selectedSimulationId" class="sidebar-right">
        <h2 class="sidebar-title">Controls</h2>
        <p class="placeholder-text">Control panel goes here</p>
      </aside>
    </div>
  </div>
</template>

<script>
export default {
  name: 'App',

  data() {
    return {
      /** @type {number|null} Currently selected simulation ID */
      selectedSimulationId: null,
      /** @type {Array} List of all simulations */
      simulations: [],
    };
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

.sidebar-title {
  font-size: var(--text-lg);
  font-weight: 600;
  margin-bottom: var(--space-md);
}

/* Temporary placeholder styling — removed when real components arrive */
.placeholder-text {
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
}
</style>
