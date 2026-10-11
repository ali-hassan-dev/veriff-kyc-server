import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
    clearMocks: true,
    restoreMocks: true,
    // The handlers log every request and upload, so only show output for failing tests
    silent: 'passed-only',
  },
});
