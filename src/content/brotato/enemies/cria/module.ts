import { defineEnemy } from '../../../../game/brotato/api';

// Lo que llama la araña: va a por ti rápido y cae enseguida
export default defineEnemy({
  format: 1,
  id: 'cria',
  name: 'Cría',
  description: 'Rápida y frágil. Siempre llegan en grupo.',
  hp: 3,
  hpPerWave: 1.2,
  contactDamage: 1,
  damagePerWave: 0.4,
  speed: 54,
  radius: 4,
  behavior: 'chase',
  params: { turnRate: 0.3 },
  loot: { materials: 1, consumableChance: 0 },
  height: 8,
  looks: {
    oficina: { name: 'Cría de cables', model: 'jefe/cria-oficina' },
    medieval: { name: 'Cría de cripta', model: 'jefe/cria-medieval' },
    cyberpunk: { name: 'Cría de dron', model: 'jefe/cria-cyberpunk' },
  },
});
