import { defineEnemy } from '../../../../game/brotato/api';

export default defineEnemy({
  format: 1,
  id: 'bicho-taza',
  name: 'Bicho taza',
  description: 'Se queda lejos y te escupe café. Para un momento antes de cada disparo.',
  hp: 6,
  hpPerWave: 3,
  contactDamage: 1,
  damagePerWave: 0.3,
  speed: 28,
  radius: 6,
  behavior: 'shooter',
  params: { distance: 96, fireEvery: 2.4, aim: 0.4, projectileSpeed: 80 },
  loot: { materials: 2, consumableChance: 0.03 },
  height: 14,   // alto del dibujo del Brotato: dónde salen los números de daño
});
