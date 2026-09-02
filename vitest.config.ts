/// <reference types="vitest/config" />
import { mergeConfig, defineConfig } from 'vitest/config';
import viteConfig from './vite.config';

// Reuse the production Vite config (React plugin + the `@` -> ./src alias) so tests
// resolve modules exactly like the app does, then layer on the Vitest-only settings.
export default defineConfig(async (env) => {
  const baseConfig = typeof viteConfig === 'function' ? await viteConfig(env) : viteConfig;
  return mergeConfig(
    baseConfig,
    defineConfig({
      test: {
        globals: false,
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        css: false,
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        clearMocks: true,
        restoreMocks: true,
        // Vitest's 5s default is a wall-clock budget, and these are user-event tests: a click that
        // waits on a query, a re-render and a settled effect is fast in isolation and not fast on a
        // loaded machine running a dozen files at once. At the default the suite had started failing
        // on a DIFFERENT couple of admin files each run — the signature of contention, not of a bug,
        // and the kind of noise that trains people to re-run CI instead of reading it.
        testTimeout: 15_000,
        hookTimeout: 15_000,
      },
    }),
  );
});
