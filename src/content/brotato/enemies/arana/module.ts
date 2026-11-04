import { defineEnemy } from '../../../../game/brotato/api';

// Un jefe del piso 10 (comportamiento spider). Vida y daño, de la curva de semillas, como el minotauro
export default defineEnemy({
  format: 1,
  id: 'arana',
  name: 'Araña',   // el papel; el nombre que se enseña va en looks, por mundo
  description: 'Corre, deja zonas que te frenan y llama crías. No la dejes tejer a tu alrededor.',
  hp: 850,
  hpPerWave: 0,
  contactDamage: 5,
  damagePerWave: 0,
  speed: 46,
  radius: 11,
  behavior: 'spider',
  params: {},
  loot: { materials: 30, consumableChance: 0 },
  height: 21,
  boss: true,
  poses: { 1: 'teje', 2: 'llama' },
  companions: ['cria'],
  eyes: [0, -8, 17],
  looks: {
    oficina: { name: 'Araña de cables', model: 'jefe/arana-oficina' },
    medieval: { name: 'Araña de cripta', model: 'jefe/arana-medieval' },
    cyberpunk: { name: 'Araña dron', model: 'jefe/arana-cyberpunk' },
  },
});
