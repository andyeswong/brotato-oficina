import { defineWeapon } from '../../../../game/brotato/api';

export default defineWeapon({
  format: 1,
  id: 'rafaga',
  name: 'Ráfaga',   // el papel; el nombre que se enseña va en looks, por mundo
  description: 'Disparos rápidos y flojos. Ideal para muchos enemigos pequeños.',
  tags: ['distancia'],
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
  shop: { price: 18, minWave: 2, order: 2 },
  looks: {
    oficina: { name: 'Subfusil de agujas', description: 'Agujas rápidas y flojas. Ideal para muchos enemigos pequeños.', model: 'armas-futuro/subfusil', projectile: 'armas-futuro/aguja' },
    medieval: { name: 'Repetidora rúnica', description: 'Chispas rúnicas rápidas y flojas. Ideal para muchos enemigos pequeños.', model: 'medieval/rafaga', projectile: 'medieval/chispa' },
    cyberpunk: { name: 'Subfusil de neón', description: 'Perdigones de neón rápidos y flojos. Ideal para muchos enemigos pequeños.', model: 'cyberpunk/rafaga', projectile: 'cyberpunk/perdigon' },
  },
});
