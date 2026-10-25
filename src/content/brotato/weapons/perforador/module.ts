import { defineWeapon } from '../../../../game/brotato/api';

// Catálogo 2 (2026-10-25): un papel que no repiten las demás armas. Precio y rareza salen de la curva F1.
export default defineWeapon({
  format: 1,
  id: 'perforador',
  name: 'Perforador',   // el papel; el nombre que se enseña va en looks, por mundo
  description: 'Un disparo lento y de largo alcance que atraviesa a dos enemigos.',
  tags: ['distancia'],
  behavior: 'projectile',
  params: { speed: 260, radius: 2, pierce: 2 },
  scaling: { 'ranged-damage': 1 },
  tiers: [
    { damage: 9, cooldown: 1.6, range: 200, critChance: 0.08, critMult: 2 },
    { damage: 15, cooldown: 1.5, range: 210, critChance: 0.1, critMult: 2 },
    { damage: 24, cooldown: 1.4, range: 220, critChance: 0.12, critMult: 2 },
    { damage: 38, cooldown: 1.2, range: 230, critChance: 0.14, critMult: 2 },
  ],
  length: 22,   // del agarre a la punta (el modelo de cada mundo lo respeta)
  shop: { price: 22, minWave: 3, order: 5 },
  looks: {
    oficina: { name: 'Rifle de agujas', description: 'Un disparo lento y de largo alcance que atraviesa a dos enemigos.', model: 'armas-futuro/perforador', projectile: 'armas-futuro/aguja2' },
    medieval: { name: 'Arcabuz rúnico', description: 'Un disparo lento y de largo alcance que atraviesa a dos enemigos.', model: 'medieval/perforador', projectile: 'medieval/arpon' },
    cyberpunk: { name: 'Rifle de raíles', description: 'Un disparo lento y de largo alcance que atraviesa a dos enemigos.', model: 'cyberpunk/perforador', projectile: 'cyberpunk/bala2' },
  },
});
