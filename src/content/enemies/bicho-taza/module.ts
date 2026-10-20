import { defineEnemy } from '@engine/api';
import sheetPng from './bicho-taza.png';
import sheetJson from './bicho-taza.json';

export default defineEnemy({
  format: 1,
  id: 'bicho-taza',
  name: 'Bicho taza',
  description: 'Se queda lejos y te escupe café. Para un momento antes de cada disparo.',
  hp: 6,
  hpPerWave: 3,
  contactDamage: 1,
  damagePerWave: 0.5,
  speed: 70,
  radius: 6,
  behavior: 'shooter',
  params: { distance: 240, fireEvery: 2.4, aim: 0.4, projectileSpeed: 200 },
  loot: { materials: 2, consumableChance: 0.03 },
  sprites: { image: sheetPng, atlas: sheetJson, anims: { walk: 'bicho-taza_walk' } },
});
