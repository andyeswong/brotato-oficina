import { defineCharacter } from '@engine/api';
import sheetPng from './maia_hoja.png';
import sheetJson from './maia_hoja.json';

// Valores de relleno hasta que llegue motor/FICHA-MAIA.md
export default defineCharacter({
  format: 1,
  id: 'maia',
  name: 'MAIA',
  description: 'Coordinadora. Cuantas más armas distintas lleva, mejor rinde cada una; ella misma no corre tanto.',
  tags: ['alpha', 'lider'],

  baseStats: { 'max-hp': 10 },

  modifiers: [
    // Desventaja: no hace trabajo de campo
    { stat: 'speed-pct', add: -10 },
  ],

  sprites: {
    image: sheetPng,
    atlas: sheetJson,
    anims: { idle: 'maia32', walk: 'maia32_walk' },
    portrait: 'maia48',
  },
});
