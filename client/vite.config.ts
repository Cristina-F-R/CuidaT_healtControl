import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // PWA (Phase 3.2): manifest, icons and a service worker that caches the app shell only.
    // API answers are never cached by the service worker: the registered user's data lives in the
    // offline cache and the sync queue (IndexedDB), which are wiped on sign-out (ADR-007, ADR-020).
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'CuidaT',
        short_name: 'CuidaT',
        description: 'Registro visual de síntomas, desencadenantes y medicación.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#FDFDFD',
        theme_color: '#496580',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  // Development without VITE_API_URL: /api goes to the local API, so the page and the API share the
  // origin as in production (the browser keeps sending Origin: http://localhost:5173).
  // CUIDAT_API_PROXY points the proxy elsewhere (the E2E API runs on its own port, see playwright.config.ts).
  server: {
    proxy: { '/api': process.env['CUIDAT_API_PROXY'] ?? 'http://localhost:3000' },
  },
  resolve: {
    alias: {
      // Bundle the shared kernel from source, so it does not need rebuilding while developing.
      // Type checking still uses its declarations (project reference in tsconfig.app.json).
      '@cuidat/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
    },
  },
});
