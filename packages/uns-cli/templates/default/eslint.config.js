// eslint.config.js

import { defineConfig } from 'eslint/config';

export default defineConfig([
  // Apply to all source and test files
  {
    files: ['src/**/*', 'test/**/*'],
    ignores: ['dist/', 'node_modules/'], // Folders to ignore
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest', // Use latest ECMAScript version
        sourceType: 'module', // Enable ES modules
      },
    },
    rules: {
      semi: ['warn', 'always'],
    },
  },

  // Override specifically for test files
  {
    files: ['test/**/*'],
    rules: {
      'no-console': 'off',
    },
  },

  // Additional configurations can go here
]);
