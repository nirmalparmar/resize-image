import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    coverage: {
      reportsDirectory: 'coverage',
      provider: 'v8',
    },
  },
});


