import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      // Bundle the shared kernel from source, so it does not need rebuilding while developing.
      // Type checking still uses its declarations (project reference in tsconfig.app.json).
      '@cuidat/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
    },
  },
});
