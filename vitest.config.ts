import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// El motor es la dependencia voxpix: @voxpix apunta a su src (en TypeScript, sin compilar)
export default defineConfig({
  resolve: {
    alias: {
      '@voxpix': fileURLToPath(new URL('./node_modules/voxpix/src', import.meta.url)),
    },
  },
  test: { include: ['test/**/*.test.ts'] },
});
