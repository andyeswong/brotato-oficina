import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { ignores: ['dist/**', 'node_modules/**'] },
  {
    // La regla de oro, parte 1: el motor nunca conoce el contenido por su nombre
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['**/content/**', '**/content'], message: 'El motor no importa contenido: el contenido se descubre con import.meta.glob.' }],
      }],
    },
  },
  {
    // La regla de oro, parte 2: el contenido solo habla con @engine/api, nunca con Phaser
    files: ['src/content/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{ name: 'phaser', message: 'El contenido no usa Phaser: pide lo que necesites a la fachada de @engine/api.' }],
        patterns: [
          { group: ['@engine/*', '!@engine/api'], message: 'El contenido solo importa de @engine/api.' },
          { group: ['../*'], message: 'Un módulo solo importa archivos de su propia carpeta.' },
        ],
      }],
    },
  },
);
