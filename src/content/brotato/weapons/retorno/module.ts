import { defineWeapon } from '../../../../game/brotato/api';

// Catálogo 3 (MAIA, 2026-11-04): un comportamiento nuevo, distinto de los seis de antes. Los números salen de la curva.
// Peso 0,5 en la tienda: con peso 1 diluían el catálogo (31-43 % de victorias con el árbol al máximo; con 0,5, 50-56 %).
export default defineWeapon({
  format: 1,
  id: 'retorno',
  name: 'Retorno',   // el papel; el nombre que se enseña va en looks, por mundo
  description: 'Va y vuelve atravesando: golpea a la ida y a la vuelta.',
  tags: ['distancia'],
  behavior: 'boomerang',
  params: { speed: 150, radius: 4 },
  scaling: { 'ranged-damage': 0.8 },
  tiers: [
    { damage: 5, cooldown: 1.4, range: 90, critChance: 0.04, critMult: 2 },
    { damage: 8, cooldown: 1.3, range: 95, critChance: 0.06, critMult: 2 },
    { damage: 13, cooldown: 1.2, range: 100, critChance: 0.08, critMult: 2 },
    { damage: 21, cooldown: 1.05, range: 106, critChance: 0.1, critMult: 2 },
  ],
  length: 8,   // del agarre a la punta (el modelo de cada mundo lo respeta)
  shop: { price: 18, weight: 0.5, minWave: 2, order: 7 },
  looks: {
    oficina: { name: 'Cinta métrica', description: 'La lanza y la recoge: corta a la ida y a la vuelta.', model: 'armas-futuro/retorno', projectile: 'armas-futuro/retorno-proy' },
    medieval: { name: 'Hacha arrojadiza', description: 'Vuelve a la mano y corta a la ida y a la vuelta.', model: 'medieval/retorno', projectile: 'medieval/retorno-proy' },
    cyberpunk: { name: 'Disco de plasma', description: 'Un disco guiado: corta a la ida y a la vuelta.', model: 'cyberpunk/retorno', projectile: 'cyberpunk/retorno-proy' },
  },
});
