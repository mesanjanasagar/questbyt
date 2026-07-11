import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    // Point @pos/shared-types at its TypeScript source so both dev (esbuild)
    // and production (Rollup) process it as ESM. This avoids Rollup's inability
    // to statically analyze the CJS __exportStar(require('./enums'), exports)
    // pattern that tsc emits in the dist.
    alias: {
      '@pos/shared-types': resolve(__dirname, '../../packages/shared-types/src/index.ts'),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'POS Terminal',
        short_name: 'POS',
        description: 'Point of Sale Terminal',
        theme_color: '#1e40af',
        background_color: '#ffffff',
        display: 'fullscreen',
        orientation: 'landscape',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Cache menu data, product images for offline use
        runtimeCaching: [
          {
            urlPattern: /\/api\/v1\/menus\/full\//,
            handler: 'NetworkFirst',
            options: { cacheName: 'menu-cache', expiration: { maxAgeSeconds: 3600 } },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      // Auth service via the gateway (/auth → /api/v1/auth)
      '/auth': {
        target: 'http://localhost:3000',
        rewrite: (path) => '/api/v1' + path,
        changeOrigin: true,
      },
      // All /api/v1 routes go through the gateway which handles
      // path-stripping + JWT auth before forwarding to services
      '/api/v1': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});