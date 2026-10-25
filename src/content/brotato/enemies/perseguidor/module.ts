import { defineEnemy } from '../../../../game/brotato/api';

export default defineEnemy({
  format: 1,
  id: 'perseguidor',
  name: 'Perseguidor',   // el papel; el nombre que se enseña va en looks, por mundo
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
  looks: {
    oficina: { name: 'Grapa robot', model: 'bicho-grapa/bicho-grapa' },
    medieval: { name: 'Autómata de latón', model: 'medieval/perseguidor' },
    cyberpunk: { name: 'Grapa de cromo', model: 'cyberpunk/perseguidor' },
  },
});
