import { defineCharacter } from '../../../../game/brotato/api';

// Lenta y dura (diseño de MAIA, 2026-11-04). Los números salen de la curva de semillas: no debe dominar a MAIA.
const WAVE_LINES = ['Acabo de fregar', 'Aquí no se pisa', 'Yo tengo las llaves', 'Ya lo recojo yo'];

export default defineCharacter({
  format: 1,
  id: 'conserje',
  name: 'La Conserje',
  description: 'Lleva aquí más que el edificio. Aguanta lo que le echen y pega fuerte de cerca, sin ninguna prisa.',
  tags: ['conserje'],
  order: 2,

  baseStats: { 'max-hp': 18 },
  body: { radius: 5, centerY: 10, speed: 67, orbit: 14 },

  modifiers: [
    { stat: 'armor', add: 4 },
    { stat: 'melee-damage', add: 4 },
    { stat: 'speed-pct', add: -20 },
  ],

  startingWeapons: ['barrido'],

  hooks: {
    onWaveStart(_ev, api) {
      api.floatingText(WAVE_LINES[(api.wave - 1) % WAVE_LINES.length]!);
    },
    onRunEnd(ev, api) {
      if (ev.result === 'victory') api.floatingText('Y ahora, a limpiar esto');
    },
  },
});
