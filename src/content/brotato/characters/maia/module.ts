import { defineCharacter } from '../../../../game/brotato/api';
// Su dibujo es el modelo de vóxeles de NARUTO (models/maia, con el walk aprobado por Andrés): lo pone la vista.

// Ficha: ~/Sync/brotato-oficina/motor/FICHA-MAIA.md (la valida Andrés). Los números se ajustan jugando.
const WAVE_LINES = ['Equipo, a lo suyo', 'Lo verifico yo', 'Eso no es mío, es de ECHO', 'Busca primero'];

export default defineCharacter({
  format: 1,
  id: 'maia',
  name: 'MAIA',
  description: 'Coordinadora. Cuantas más armas distintas lleva, mejor rinde cada una; ella misma no corre tanto.',
  tags: ['alpha', 'lider'],

  baseStats: { 'max-hp': 10 },

  // El cuerpo del Brotato (salía de su hoja de 24x34: radio 24 x 0,2, centro a 34 x 0,3, armas a 24 x 0,6), escrito
  // aquí para que el balance no cambie. La velocidad se fijó en 67 al pasar a la celda de 24.
  body: { radius: 5, centerY: 10, speed: 67, orbit: 14 },

  modifiers: [
    // Pasivo «Coordinación»: +5 % de daño por cada arma distinta equipada
    { stat: 'damage-pct', add: 5, per: { counter: 'distinct-weapons', every: 1 } },
    // +15 % de alcance: "ve el tablero entero". El alcance es plano, así que son ~19 px sobre un arma de 128
    { stat: 'range', add: 19 },
    // Desventaja: no hace trabajo de campo
    { stat: 'speed-pct', add: -10 },
    // Desventaja: las armas cuerpo a cuerpo hacen la mitad de daño
    { stat: 'damage-pct', add: -50, weaponTag: 'cuerpo-a-cuerpo' },
  ],

  startingWeapons: ['tiro'],


  hooks: {
    onWaveStart(_ev, api) {
      api.floatingText(WAVE_LINES[(api.wave - 1) % WAVE_LINES.length]!);
    },
    onRunEnd(ev, api) {
      if (ev.result === 'victory') api.floatingText('Hecho y verificado');
    },
  },
});
