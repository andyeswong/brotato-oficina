import { defineCharacter } from '../../../../game/brotato/api';

// Rápido y frágil (diseño de MAIA, 2026-11-04). Los números salen de la curva de semillas: no debe dominar a MAIA.
const WAVE_LINES = ['Voy, voy', 'Esto no venía en la inducción', '¿Quién firma esto?', 'Es mi primer día'];

export default defineCharacter({
  format: 1,
  id: 'becario',
  name: 'El Becario',
  description: 'Recién llegado. Corre más que nadie y recoge de lejos, pero cualquier golpe le duele.',
  tags: ['becario'],
  order: 1,

  baseStats: { 'max-hp': 8 },
  body: { radius: 4, centerY: 10, speed: 67, orbit: 14 },

  modifiers: [
    { stat: 'speed-pct', add: 20 },
    { stat: 'pickup-range', add: 40 },
  ],

  startingWeapons: ['tiro'],

  hooks: {
    onWaveStart(_ev, api) {
      api.floatingText(WAVE_LINES[(api.wave - 1) % WAVE_LINES.length]!);
    },
    onRunEnd(ev, api) {
      if (ev.result === 'victory') api.floatingText('¿Me contratan?');
    },
  },
});
