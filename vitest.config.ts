import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./shared/__tests__/setup.ts'],
    environment: 'jsdom',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
});
