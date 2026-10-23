import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

// Three projects (TECH_SPEC.md phase 2.1): the domain kernel and the API run in Node, the Vue client in jsdom.
export default defineConfig({
  test: {
    // Each worker takes seconds to start on a WSL /mnt/c checkout; too many at once exceed the
    // pool start timeout. A small fixed pool is as fast and never flaky.
    maxWorkers: 8,
    projects: [
      {
        test: {
          name: 'shared',
          environment: 'node',
          include: ['shared/src/**/*.test.ts'],
        },
      },
      {
        // Source alias for the shared kernel, as in the client project.
        resolve: {
          alias: {
            '@cuidat/shared': fileURLToPath(new URL('./shared/src/index.ts', import.meta.url)),
          },
        },
        test: {
          name: 'server',
          environment: 'node',
          include: ['server/src/**/*.test.ts'],
          testTimeout: 20_000,
        },
      },
      {
        // Same SFC plugin and source alias as client/vite.config.ts.
        plugins: [vue()],
        resolve: {
          alias: {
            '@cuidat/shared': fileURLToPath(new URL('./shared/src/index.ts', import.meta.url)),
          },
        },
        test: {
          name: 'client',
          environment: 'jsdom',
          include: ['client/src/**/*.test.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['shared/src/**/*.ts'],
      exclude: ['shared/src/**/*.test.ts'],
      // 100 % for the correlation engine and the catalog rules (TECH_SPEC.md section 6, ADR-001).
      thresholds: {
        'shared/src/correlation.ts': { lines: 100, functions: 100, branches: 100, statements: 100 },
        'shared/src/catalog.ts': { lines: 100, functions: 100, branches: 100, statements: 100 },
      },
    },
  },
});
