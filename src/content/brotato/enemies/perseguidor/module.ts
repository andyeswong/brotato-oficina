import { defineEnemy } from '../../../../game/brotato/api';

export default defineEnemy({
  format: 1,
  id: 'perseguidor',
  name: 'Bicho grapa',
  description: 'Va directo a por ti. Siempre hay otro.',
  hp: 3,
  hpPerWave: 2,
  contactDamage: 1,
  damagePerWave: 0.3,
  speed: 40,
  radius: 5,
  behavior: 'chase',
  params: { turnRate: 0.25 },
  loot: { materials: 1, consumableChance: 0.01 },
  height: 12,   // alto del dibujo del Brotato: dónde salen los números de daño
});
