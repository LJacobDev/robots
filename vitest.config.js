import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'server',
          include: ['server/**/*.test.js'],
          environment: 'node',
        },
      },
      {
        plugins: [vue()],
        resolve: {
          alias: {
            '@': new URL('./client/src', import.meta.url).pathname,
          },
        },
        test: {
          name: 'client',
          include: ['client/src/**/*.test.js'],
          environment: 'node',
        },
      },
    ],
  },
});
