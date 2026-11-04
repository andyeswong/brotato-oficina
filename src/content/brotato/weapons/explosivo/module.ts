import { defineWeapon } from '../../../../game/brotato/api';

// Catálogo 3 (MAIA, 2026-11-04): un comportamiento nuevo, distinto de los seis de antes. Los números salen de la curva.
// Peso 0,5 en la tienda: con peso 1 diluían el catálogo (31-43 % de victorias con el árbol al máximo; con 0,5, 50-56 %).
export default defineWeapon({
  format: 1,
  id: 'explosivo',
  name: 'Explosivo',   // el papel; el nombre que se enseña va en looks, por mundo
  description: 'Tiro en arco que explota al caer: al que corre se le escapa.',
  tags: ['distancia'],
  behavior: 'lob',
  params: { speed: 170, radius: 30 },
  scaling: { 'ranged-damage': 1 },
  tiers: [
    { damage: 10, cooldown: 1.6, range: 130, critChance: 0.03, critMult: 2 },
    { damage: 16, cooldown: 1.5, range: 136, critChance: 0.05, critMult: 2 },
    { damage: 26, cooldown: 1.4, range: 142, critChance: 0.07, critMult: 2 },
    { damage: 42, cooldown: 1.25, range: 150, critChance: 0.09, critMult: 2 },
  ],
  length: 12,   // del agarre a la punta (el modelo de cada mundo lo respeta)
  shop: { price: 20, weight: 0.5, minWave: 3, order: 9 },
  looks: {
    oficina: { name: 'Cartucho de tóner', description: 'Lo lanza en arco y revienta al caer: al que corre se le escapa.', model: 'armas-futuro/explosivo', projectile: 'armas-futuro/explosivo-proy' },
    medieval: { name: 'Bomba de mecha', description: 'Cae en arco y explota: al que corre se le escapa.', model: 'medieval/explosivo', projectile: 'medieval/explosivo-proy' },
    cyberpunk: { name: 'Granada de pulso', description: 'Cae en arco y suelta un pulso: al que corre se le escapa.', model: 'cyberpunk/explosivo', projectile: 'cyberpunk/explosivo-proy' },
  },
});
