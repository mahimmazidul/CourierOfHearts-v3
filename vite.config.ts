import path from 'path';
import { fileURLToPath } from 'url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// base:
//  - production (own domain): '/' (assets served from domain root by nginx)
//  - GitHub Pages preview: passed via `vite build --base=/CourierOfHearts/` (npm run build:pages)
//  - default './' keeps the build openable from any sub-path
export default defineConfig(() => ({
  base: process.env.VITE_BASE || './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    host: true,
    // Dev-only proxy so browser code can always use relative /api URLs.
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${process.env.BACKEND_PORT || 3947}`,
        changeOrigin: true,
      },
    },
    allowedHosts: true as const,
  },
  preview: {
    host: true,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${process.env.BACKEND_PORT || 3947}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
  },
}));
