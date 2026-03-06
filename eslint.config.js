import js from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  // Ignore generated and dependency directories
  {
    ignores: ['node_modules/', 'dist/'],
  },

  // Base JS recommended rules for all JS files
  js.configs.recommended,

  // Vue plugin rules for .vue files
  ...pluginVue.configs['flat/recommended'],

  // Root config files: Node.js globals
  {
    files: ['*.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },

  // Server files: Node.js globals
  {
    files: ['server/**/*.js'],
    languageOptions: {
      globals: globals.node,
    },
  },

  // Client files: browser globals
  {
    files: ['client/**/*.js', 'client/**/*.vue'],
    languageOptions: {
      globals: globals.browser,
    },
  },

  // Test files: Vitest globals + Node globals (for globalThis, vi, etc.)
  {
    files: ['**/*.test.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        globalThis: 'readonly',
      },
    },
  },

  // Prettier: disables formatting rules that conflict with Prettier (must be last)
  eslintConfigPrettier,
];
