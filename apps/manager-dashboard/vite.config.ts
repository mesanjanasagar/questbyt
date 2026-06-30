import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@pos/shared-types': resolve(__dirname, '../../packages/shared-types/src/index.ts'),
    },
  },
  plugins: [react()],
  server: {
    port: 5003,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: { outDir: 'dist', sourcemap: true },
});