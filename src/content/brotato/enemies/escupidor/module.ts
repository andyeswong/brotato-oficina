import { defineEnemy } from '../../../../game/brotato/api';

export default defineEnemy({
  format: 1,
  id: 'escupidor',
  name: 'Escupidor',   // el papel; el nombre que se enseña va en looks, por mundo
  description: 'Se queda lejos y te escupe. Para un momento antes de cada disparo.',
  hp: 6,
  hpPerWave: 3,
  contactDamage: 1,
  damagePerWave: 0.54,
  speed: 28,
  radius: 6,
  behavior: 'shooter',
  params: { distance: 96, fireEvery: 2.4, aim: 0.4, projectileSpeed: 80 },
  loot: { materials: 2, consumableChance: 0.03 },
  height: 14,   // alto del dibujo del Brotato: dónde salen los números de daño
  looks: {
    oficina: { name: 'Taza robot', description: 'Se queda lejos y te escupe café. Para un momento antes de cada disparo.', model: 'bicho-taza/bicho-taza' },
    medieval: { name: 'Jarra de peltre', description: 'Se queda lejos y te escupe cerveza. Para un momento antes de cada disparo.', model: 'medieval/escupidor' },
    cyberpunk: { name: 'Vaso para llevar', description: 'Se queda lejos y te escupe café. Para un momento antes de cada disparo.', model: 'cyberpunk/escupidor' },
  },
});
