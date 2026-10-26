import { defineEnemy } from '../../../../game/brotato/api';

export default defineEnemy({
  format: 1,
  id: 'embestidor',
  name: 'Embestidor',   // el papel; el nombre que se enseña va en looks, por mundo
  description: 'Se para, tiembla y embiste en línea recta. Apártate de su línea.',
  hp: 4,
  hpPerWave: 2.5,
  contactDamage: 2,
  damagePerWave: 0.9,
  speed: 32,
  radius: 6,
  behavior: 'dash',
  params: { triggerRange: 72, windup: 0.55, dashSpeed: 4, dashTime: 0.4 },
  loot: { materials: 2, consumableChance: 0.02 },
  height: 14,   // alto del dibujo del Brotato: dónde salen los números de daño
  looks: {
    oficina: { name: 'Clip robot', model: 'bicho-clip/bicho-clip' },
    medieval: { name: 'Escarabajo de latón', model: 'medieval/embestidor' },
    cyberpunk: { name: 'Escarabajo de cromo', model: 'cyberpunk/embestidor' },
  },
});
