// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    globals: true,           // enables global describe/it/expect
    environment: 'node',     // Node.js environment
    include: ['tests/**/*.ts'] // your test files
  }
});
