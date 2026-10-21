import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@engine': fileURLToPath(new URL('./src/engine', import.meta.url)) },
  },
  // Las hojas de pxl son diminutas: sin esto Vite las mete como data: URI y da igual,
  // pero mantenerlas como archivo facilita mirarlas en el build.
  build: { assetsInlineLimit: 0, chunkSizeWarningLimit: 1600 }, // Phaser solo ya pesa ~1,2 MB
  // Vite rechaza con 403 los nombres de host que no conoce (protección contra DNS rebinding):
  // el nombre de la tailnet tiene que estar aquí, o el enlace que se reparte da error y solo vale la IP
  preview: { port: 5180, strictPort: true, allowedHosts: ['fedora.risk-char.ts.net'] },
  server: { port: 5181, strictPort: true },
  test: { environment: 'node' },
});
