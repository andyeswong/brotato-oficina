import { defineEnemy } from '../../../../game/brotato/api';

// Un jefe del piso 10 (comportamiento golem). Vida y daño, de la curva de semillas (árbol al máximo, 48 semillas por
// mundo): con 7 de contacto, 41-62 % de victorias; con 5, 45-62 %. Bajarle la vida un 10 % apenas movía nada
export default defineEnemy({
  format: 1,
  id: 'golem',
  name: 'Gólem',   // el papel; el nombre que se enseña va en looks, por mundo
  description: 'Lento y enorme. Sus anillos de onda se esquivan por los huecos, y lanza trozos en abanico.',
  hp: 1300,
  hpPerWave: 0,
  contactDamage: 5,
  damagePerWave: 0,
  speed: 18,
  radius: 12,
  behavior: 'golem',
  params: {},
  loot: { materials: 30, consumableChance: 0 },
  height: 45,
  boss: true,
  poses: { 2: 'golpe', 3: 'lanza' },
  eyes: [0, -8, 39],
  looks: {
    oficina: { name: 'Copiadora gigante', model: 'jefe/golem-oficina', projectile: 'jefe/trozo-oficina' },
    medieval: { name: 'Gólem de piedra', model: 'jefe/golem-medieval', projectile: 'jefe/trozo-medieval' },
    cyberpunk: { name: 'Mecha', model: 'jefe/golem-cyberpunk', projectile: 'jefe/trozo-cyberpunk' },
  },
});
