import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // @pos/shared-types is a CommonJS workspace package. Force Vite to pre-bundle
  // it so esbuild converts its `export *` re-exports into statically-analyzable
  // ESM named exports (e.g. the DeviceType enum). Without this, Vite serves the
  // raw CJS and the browser can't resolve named exports.
  optimizeDeps: {
    include: ['@pos/shared-types'],
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
      '/auth': 'http://localhost:3004',
      '/api/v1/menus': 'http://localhost:3005',
      '/api/v1/items': 'http://localhost:3005',
      '/api/v1/orders': 'http://localhost:3001',
      '/api/v1/payments': 'http://localhost:3003',
    },
  },
});