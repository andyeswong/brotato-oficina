import { defineCharacter } from '@engine/api';
// Hoja provisional: maiaa (abrigo con cinturón), una de las cinco ropas sobre la versión 4 que eligió Andrés.
// Cuando elija la ropa, solo se cambia este par de archivos.
import sheetPng from './maiaa.png';
import sheetJson from './maiaa.json';

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
    // +15 % de alcance: "ve el tablero entero". El alcance es plano, así que son ~19 px sobre un arma de 128
    { stat: 'range', add: 19 },
    // Desventaja: no hace trabajo de campo
    { stat: 'speed-pct', add: -10 },
    // Desventaja: las armas cuerpo a cuerpo hacen la mitad de daño
    { stat: 'damage-pct', add: -50, weaponTag: 'cuerpo-a-cuerpo' },
  ],

  startingWeapons: ['buzon'],

  sprites: {
    image: sheetPng,
    atlas: sheetJson,
    anims: { idle: 'maiaa_idle', walk: 'maiaa_walk' },
    // Sin retrato todavía: la selección usa el frame quieto ampliado
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
