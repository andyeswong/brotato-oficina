import { defineWeapon } from '@engine/api';
import sheetPng from './regla.png';
import sheetJson from './regla.json';

export default defineWeapon({
  format: 1,
  id: 'regla',
  name: 'Regla',
  description: 'Estocada corta y fuerte. Con MAIA hace la mitad de daño: no se ensucia las manos.',
  tags: ['cuerpo-a-cuerpo', 'oficina'],
  behavior: 'thrust',
  params: { width: 20 },
  scaling: { 'melee-damage': 1 },
  tiers: [
    { damage: 8, cooldown: 1.1, range: 88, critChance: 0.05, critMult: 2 },
    { damage: 13, cooldown: 1.0, range: 92, critChance: 0.07, critMult: 2 },
    { damage: 20, cooldown: 0.9, range: 96, critChance: 0.09, critMult: 2 },
    { damage: 32, cooldown: 0.8, range: 100, critChance: 0.11, critMult: 2.2 },
  ],
  grip: { x: 1, y: 3 },
  shop: { price: 12 },
  sprites: { image: sheetPng, atlas: sheetJson, anims: { idle: 'regla_idle' } },
});
