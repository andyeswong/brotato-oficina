import { defineWeapon } from '../../../../game/brotato/api';

export default defineWeapon({
  format: 1,
  id: 'buzon',
  name: 'Buzón',
  description: 'Manda un sobre al enemigo más cercano. Lo que llega sin destinatario, va al líder.',
  tags: ['distancia', 'oficina'],
  behavior: 'projectile',
  params: { speed: 176, radius: 3 },
  scaling: { 'ranged-damage': 1 },
  tiers: [
    { damage: 6, cooldown: 1.0, range: 128, critChance: 0.05, critMult: 2 },
    { damage: 10, cooldown: 0.9, range: 136, critChance: 0.08, critMult: 2 },
    { damage: 16, cooldown: 0.8, range: 144, critChance: 0.1, critMult: 2 },
    { damage: 26, cooldown: 0.7, range: 152, critChance: 0.12, critMult: 2.2 },
  ],
  length: 14,   // del agarre a la punta: en el Brotato, ancho de la celda menos el agarre
  shop: { price: 15 },
});
