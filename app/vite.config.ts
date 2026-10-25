import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// El juego: app/juego.html. El motor es la dependencia voxpix (@voxpix -> su src, en TypeScript)
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  resolve: {
    alias: {
      '@voxpix': fileURLToPath(new URL('../node_modules/voxpix/src', import.meta.url)),
    },
  },
  server: { host: '0.0.0.0', port: 5191, fs: { allow: ['..', '../node_modules/voxpix'] } },
  build: {
    outDir: 'dist', emptyOutDir: true,
    rollupOptions: { input: { juego: fileURLToPath(new URL('./juego.html', import.meta.url)) } },
  },
});
