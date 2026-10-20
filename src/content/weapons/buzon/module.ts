import { defineWeapon } from '@engine/api';
import sheetPng from './buzon.png';
import sheetJson from './buzon.json';

export default defineWeapon({
  format: 1,
  id: 'buzon',
  name: 'Buzón',
  description: 'Manda un sobre al enemigo más cercano. Lo que llega sin destinatario, va al líder.',
  tags: ['distancia', 'oficina'],
  behavior: 'projectile',
  params: { speed: 440, radius: 4 },
  scaling: { 'ranged-damage': 1 },
  tiers: [
    { damage: 6, cooldown: 1.0, range: 320, critChance: 0.05, critMult: 2 },
    { damage: 10, cooldown: 0.9, range: 340, critChance: 0.08, critMult: 2 },
    { damage: 16, cooldown: 0.8, range: 360, critChance: 0.1, critMult: 2 },
    { damage: 26, cooldown: 0.7, range: 380, critChance: 0.12, critMult: 2.2 },
  ],
  grip: { x: 2, y: 9 },
  shop: { price: 15 },
  sprites: {
    image: sheetPng,
    atlas: sheetJson,
    anims: { idle: 'buzon_idle', fire: 'buzon_fire', projectile: 'buzon_sobre' },
  },
});
