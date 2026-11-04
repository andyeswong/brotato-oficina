import { defineWeapon } from '../../../../game/brotato/api';

// Catálogo 3 (MAIA, 2026-11-04): un comportamiento nuevo, distinto de los seis de antes. Los números salen de la curva.
// Peso 0,5 en la tienda: con peso 1 diluían el catálogo (31-43 % de victorias con el árbol al máximo; con 0,5, 50-56 %).
export default defineWeapon({
  format: 1,
  id: 'golpe-suelo',
  name: 'Golpe de suelo',   // el papel; el nombre que se enseña va en looks, por mundo
  description: 'Cuerpo a cuerpo lento: lo de delante recibe el golpe entero y la onda alcanza alrededor.',
  tags: ['cuerpo-a-cuerpo'],
  behavior: 'slam',
  params: { width: 18, ringRadius: 34, ringFactor: 0.5 },
  scaling: { 'melee-damage': 1.2 },
  tiers: [
    { damage: 12, cooldown: 1.9, range: 30, critChance: 0.05, critMult: 2 },
    { damage: 19, cooldown: 1.8, range: 32, critChance: 0.07, critMult: 2 },
    { damage: 30, cooldown: 1.65, range: 34, critChance: 0.09, critMult: 2 },
    { damage: 46, cooldown: 1.5, range: 36, critChance: 0.11, critMult: 2 },
  ],
  length: 17,   // del agarre a la punta (el modelo de cada mundo lo respeta)
  shop: { price: 17, weight: 0.5, minWave: 2, order: 10 },
  looks: {
    oficina: { name: 'Sello gigante', description: 'Lento: lo de delante recibe el golpe entero y la onda alcanza alrededor.', model: 'armas-futuro/golpe-suelo' },
    medieval: { name: 'Martillo de guerra', description: 'Lento: lo de delante recibe el golpe entero y la onda alcanza alrededor.', model: 'medieval/golpe-suelo' },
    cyberpunk: { name: 'Puño hidráulico', description: 'Lento: lo de delante recibe el golpe entero y la onda alcanza alrededor.', model: 'cyberpunk/golpe-suelo' },
  },
});
