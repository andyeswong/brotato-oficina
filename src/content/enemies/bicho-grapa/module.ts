import { defineEnemy } from '@engine/api';
import sheetPng from './bicho-grapa.png';
import sheetJson from './bicho-grapa.json';

export default defineEnemy({
  format: 1,
  id: 'bicho-grapa',
  name: 'Bicho grapa',
  description: 'Va directo a por ti. Siempre hay otro.',
  hp: 3,
  hpPerWave: 2,
  contactDamage: 1,
  damagePerWave: 0.6,
  speed: 50,
  radius: 5,
  behavior: 'chase',
  params: { turnRate: 0.25 },
  loot: { materials: 1, consumableChance: 0.01 },
  sprites: { image: sheetPng, atlas: sheetJson, anims: { walk: 'bicho-grapa_walk' } },
});
