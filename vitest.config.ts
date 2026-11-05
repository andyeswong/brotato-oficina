import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// El motor es la dependencia voxpix: @voxpix apunta a su src (en TypeScript, sin compilar)
export default defineConfig({
  resolve: {
    alias: {
      '@voxpix': fileURLToPath(new URL('./node_modules/voxpix/src', import.meta.url)),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    // Muchos tests montan una partida entera: 3-8 s con la suite en paralelo a nice 19, y los 5 s por defecto daban rojos por tiempo
    testTimeout: 30_000,
  },
});
