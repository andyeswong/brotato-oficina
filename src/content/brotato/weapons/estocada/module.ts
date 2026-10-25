import { defineWeapon } from '../../../../game/brotato/api';

export default defineWeapon({
  format: 1,
  id: 'estocada',
  name: 'Regla',
  description: 'Estocada corta y fuerte. Con MAIA hace la mitad de daño: no se ensucia las manos.',
  tags: ['cuerpo-a-cuerpo', 'oficina'],
  behavior: 'thrust',
  params: { width: 8 },
  scaling: { 'melee-damage': 1 },
  tiers: [
    { damage: 8, cooldown: 1.1, range: 35, critChance: 0.05, critMult: 2 },
    { damage: 13, cooldown: 1.0, range: 37, critChance: 0.07, critMult: 2 },
    { damage: 20, cooldown: 0.9, range: 38, critChance: 0.09, critMult: 2 },
    { damage: 32, cooldown: 0.8, range: 40, critChance: 0.11, critMult: 2.2 },
  ],
  length: 19,   // del agarre a la punta: en el Brotato, ancho de la celda menos el agarre
  shop: { price: 12, order: 3 },
});
