import { defineWeapon } from '../../../../game/brotato/api';

// Catálogo 2 (2026-10-25): un papel que no repiten las demás armas. Precio y rareza salen de la curva F1.
export default defineWeapon({
  format: 1,
  id: 'abanico',
  name: 'Abanico',   // el papel; el nombre que se enseña va en looks, por mundo
  description: 'Tres disparos en abanico, de corto alcance. Castiga a los grupos que llegan juntos.',
  tags: ['distancia'],
  behavior: 'projectile',
  params: { speed: 200, radius: 2, count: 3, spreadDeg: 30 },
  scaling: { 'ranged-damage': 0.4 },
  tiers: [
    { damage: 3, cooldown: 1.0, range: 80, critChance: 0.03, critMult: 2 },
    { damage: 5, cooldown: 0.95, range: 84, critChance: 0.05, critMult: 2 },
    { damage: 8, cooldown: 0.9, range: 88, critChance: 0.07, critMult: 2 },
    { damage: 13, cooldown: 0.8, range: 92, critChance: 0.09, critMult: 2 },
  ],
  length: 15,   // del agarre a la punta (el modelo de cada mundo lo respeta)
  shop: { price: 16, order: 4 },
  looks: {
    oficina: { name: 'Escopeta de pulsos', description: 'Tres disparos en abanico, de corto alcance. Castiga a los grupos que llegan juntos.', model: 'armas-futuro/abanico', projectile: 'armas-futuro/pulso' },
    medieval: { name: 'Trabuco', description: 'Tres disparos en abanico, de corto alcance. Castiga a los grupos que llegan juntos.', model: 'medieval/abanico', projectile: 'medieval/metralla' },
    cyberpunk: { name: 'Escopeta de neón', description: 'Tres disparos en abanico, de corto alcance. Castiga a los grupos que llegan juntos.', model: 'cyberpunk/abanico', projectile: 'cyberpunk/perdigon2' },
  },
});
