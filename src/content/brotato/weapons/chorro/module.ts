import { defineWeapon } from '../../../../game/brotato/api';

// Catálogo 3 (MAIA, 2026-11-04): un comportamiento nuevo, distinto de los seis de antes. Los números salen de la curva.
// Peso 0,5 en la tienda: con peso 1 diluían el catálogo (31-43 % de victorias con el árbol al máximo; con 0,5, 50-56 %).
export default defineWeapon({
  format: 1,
  id: 'chorro',
  name: 'Chorro',   // el papel; el nombre que se enseña va en looks, por mundo
  description: 'Un cono corto y continuo: daña poco a todo lo que tiene delante.',
  tags: ['distancia'],
  behavior: 'spray',
  params: { halfDeg: 22 },
  scaling: { 'ranged-damage': 0.3 },
  tiers: [
    { damage: 2, cooldown: 0.25, range: 40, critChance: 0.02, critMult: 2 },
    { damage: 3, cooldown: 0.25, range: 42, critChance: 0.03, critMult: 2 },
    { damage: 5, cooldown: 0.22, range: 44, critChance: 0.04, critMult: 2 },
    { damage: 8, cooldown: 0.2, range: 46, critChance: 0.05, critMult: 2 },
  ],
  length: 14,   // del agarre a la punta (el modelo de cada mundo lo respeta)
  shop: { price: 16, weight: 0.5, minWave: 2, order: 8 },
  looks: {
    oficina: { name: 'Extintor', description: 'Un chorro corto y continuo: daña poco a todo lo que tiene delante.', model: 'armas-futuro/chorro' },
    medieval: { name: 'Antorcha de brea', description: 'Una llamarada corta y continua: daña poco a todo lo que tiene delante.', model: 'medieval/chorro' },
    cyberpunk: { name: 'Soplete', description: 'Una llama corta y continua: daña poco a todo lo que tiene delante.', model: 'cyberpunk/chorro' },
  },
});
