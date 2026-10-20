import { defineCharacter } from '@engine/api';
import sheetPng from './maia.png';
import sheetJson from './maia.json';

// Ficha: ~/Sync/brotato-oficina/motor/FICHA-MAIA.md (la valida Andrés). Los números se ajustan jugando.
const WAVE_LINES = ['Equipo, a lo suyo', 'Lo verifico yo', 'Eso no es mío, es de ECHO', 'Busca primero'];

export default defineCharacter({
  format: 1,
  id: 'maia',
  name: 'MAIA',
  description: 'Coordinadora. Cuantas más armas distintas lleva, mejor rinde cada una; ella misma no corre tanto.',
  tags: ['alpha', 'lider'],

  baseStats: { 'max-hp': 10 },

  modifiers: [
    // Pasivo «Coordinación»: +5 % de daño por cada arma distinta equipada
    { stat: 'damage-pct', add: 5, per: { counter: 'distinct-weapons', every: 1 } },
    // +15 % de alcance: "ve el tablero entero". El alcance es plano, así que son ~24 px sobre un arma de 160
    { stat: 'range', add: 24 },
    // Desventaja: no hace trabajo de campo
    { stat: 'speed-pct', add: -10 },
    // Pendiente (hito 2, con las armas): −50 % de daño en las armas con tag "cuerpo-a-cuerpo"
  ],

  sprites: {
    image: sheetPng,
    atlas: sheetJson,
    anims: { idle: 'maia_idle', walk: 'maia_walk' },
    portrait: 'maia_portrait',
  },

  hooks: {
    onWaveStart(_ev, api) {
      api.floatingText(WAVE_LINES[(api.wave - 1) % WAVE_LINES.length]!);
    },
    onRunEnd(ev, api) {
      if (ev.result === 'victory') api.floatingText('Hecho y verificado');
    },
  },
});
