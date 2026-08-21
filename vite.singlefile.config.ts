// One-off config: builds the whole app into a single self-contained HTML file
// (demo mode, no server needed) — used for the in-chat file preview.
import path from 'path';
import { fileURLToPath } from 'url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), viteSingleFile({ removeViteModuleLoader: true })],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    outDir: 'dist-singlefile',
    assetsInlineLimit: 100 * 1024 * 1024,
    chunkSizeWarningLimit: 100000,
  },
});
