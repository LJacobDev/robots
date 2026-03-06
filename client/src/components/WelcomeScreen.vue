<template>
  <div class="welcome-screen">
    <h1 class="welcome-title">Robots Simulation</h1>
    <p class="welcome-message">
      Select a simulation from the list, or create a new one to get started.
    </p>
  </div>
</template>

<script>
/**
 * Welcome screen shown in the center area when no simulation is selected.
 *
 * Displays a friendly message prompting the user to select or create
 * a simulation.
 *
 * @component
 */
export default {
  name: 'WelcomeScreen',
};
</script>

<style scoped>
.welcome-screen {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  padding: var(--space-xl);
  text-align: center;
}

.welcome-title {
  font-size: var(--text-xl);
  font-weight: 600;
  margin-bottom: var(--space-md);
  color: var(--color-text);
}

.welcome-message {
  font-size: var(--text-base);
  color: var(--color-text-secondary);
  max-width: 28rem;
  line-height: 1.5;
}
</style>
