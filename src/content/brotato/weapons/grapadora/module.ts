import { defineWeapon } from '../../../../game/brotato/api';

export default defineWeapon({
  format: 1,
  id: 'grapadora',
  name: 'Grapadora',
  description: 'Grapas rápidas y flojas. Ideal para muchos enemigos pequeños.',
  tags: ['distancia', 'oficina'],
  behavior: 'projectile',
  params: { speed: 240, radius: 2 },
  scaling: { 'ranged-damage': 0.5 },
  tiers: [
    { damage: 3, cooldown: 0.45, range: 112, critChance: 0.03, critMult: 2 },
    { damage: 5, cooldown: 0.4, range: 116, critChance: 0.05, critMult: 2 },
    { damage: 8, cooldown: 0.35, range: 120, critChance: 0.07, critMult: 2 },
    { damage: 13, cooldown: 0.3, range: 124, critChance: 0.09, critMult: 2 },
  ],
  length: 17,   // del agarre a la punta: en el Brotato, ancho de la celda menos el agarre
  shop: { price: 18, minWave: 2 },
});
