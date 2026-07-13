/// <reference types="vitest/config" />
import { mergeConfig, defineConfig } from 'vitest/config';
import viteConfig from './vite.config';

// Reuse the production Vite config (React plugin + the `@` -> ./src alias) so tests
// resolve modules exactly like the app does, then layer on the Vitest-only settings.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: false,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      clearMocks: true,
      restoreMocks: true,
    },
  }),
);
