// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.integration.test.ts'],
    setupFiles: ['./__tests__/setup.ts'],
    testTimeout: 15000,
    env: {
      NODE_ENV: 'test', // ← set before any module loads
    },
  },
});
