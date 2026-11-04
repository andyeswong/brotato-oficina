import { defineEnemy } from '../../../../game/brotato/api';

// El jefe del piso 10 (comportamiento boss). La vida y el daño los fija la curva (MAIA, 2026-10-29: META=0 a ±0,1 de
// calib y, con el árbol al máximo, 55-65 % de victorias). Un minotauro con la ropa de cada mundo
// (models/brotato/jefe/jefe_capas.px.js)
export default defineEnemy({
  format: 1,
  id: 'jefe',
  name: 'Jefe',   // el papel; el nombre que se enseña va en looks, por mundo
  description: 'Carga y embiste arrastrando lo que pille. Llévalo contra algo duro: se queda aturdido.',
  hp: 1000,
  hpPerWave: 0,
  contactDamage: 6,
  damagePerWave: 0,
  speed: 26,
  radius: 10,
  behavior: 'boss',
  params: {},
  loot: { materials: 30, consumableChance: 0 },
  height: 28,
  boss: true,
  poses: { 1: 'carga', 2: 'embiste' },
  looks: {
    oficina: { name: 'Jefe de planta', model: 'jefe/oficina' },
    medieval: { name: 'Minotauro', model: 'jefe/medieval' },
    cyberpunk: { name: 'Minotauro cíborg', model: 'jefe/cyberpunk' },
  },
});
