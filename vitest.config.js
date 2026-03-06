import { defineConfig } from 'vitest/config';

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
      'client',
    ],
  },
});
