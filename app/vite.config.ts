import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

// El commit de la build, visible en la portada (MAIA: la copia publicada dice de qué master sale). VITE_COMMIT manda;
// si no, el HEAD del árbol; sin git, 'dev'
function commit(): string {
  if (process.env.VITE_COMMIT) return process.env.VITE_COMMIT;
  try { return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return 'dev'; }
}

// El juego: app/juego.html. El motor es la dependencia voxpix (@voxpix -> su src, en TypeScript)
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  define: { __COMMIT__: JSON.stringify(commit()) },
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
