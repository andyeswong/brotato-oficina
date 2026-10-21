import { defineWeapon } from '@engine/api';
import sheetPng from './grapadora.png';
import sheetJson from './grapadora.json';

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
  grip: { x: 3, y: 10 },
  shop: { price: 18, minWave: 2 },
  sprites: {
    image: sheetPng,
    atlas: sheetJson,
    anims: { idle: 'grapadora_idle', projectile: 'grapadora_tiro' },
  },
});
