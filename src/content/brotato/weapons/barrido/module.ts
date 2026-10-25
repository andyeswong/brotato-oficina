import { defineWeapon } from '../../../../game/brotato/api';

// Catálogo 2 (2026-10-25): un papel que no repiten las demás armas. Precio y rareza salen de la curva F1.
export default defineWeapon({
  format: 1,
  id: 'barrido',
  name: 'Barrido',   // el papel; el nombre que se enseña va en looks, por mundo
  description: 'Golpe cuerpo a cuerpo ancho y corto: despeja lo que ya te rodea. Con MAIA hace la mitad de daño.',
  tags: ['cuerpo-a-cuerpo'],
  behavior: 'thrust',
  params: { width: 24 },
  scaling: { 'melee-damage': 1 },
  tiers: [
    { damage: 7, cooldown: 1.2, range: 26, critChance: 0.05, critMult: 2 },
    { damage: 12, cooldown: 1.1, range: 27, critChance: 0.07, critMult: 2 },
    { damage: 18, cooldown: 1.0, range: 28, critChance: 0.09, critMult: 2 },
    { damage: 28, cooldown: 0.9, range: 30, critChance: 0.11, critMult: 2 },
  ],
  length: 16,   // del agarre a la punta (el modelo de cada mundo lo respeta)
  shop: { price: 14, order: 6 },
  looks: {
    oficina: { name: 'Martillo de energía', description: 'Golpe cuerpo a cuerpo ancho y corto: despeja lo que ya te rodea. Con MAIA hace la mitad de daño.', model: 'armas-futuro/barrido' },
    medieval: { name: 'Hacha de batalla', description: 'Golpe cuerpo a cuerpo ancho y corto: despeja lo que ya te rodea. Con MAIA hace la mitad de daño.', model: 'medieval/barrido' },
    cyberpunk: { name: 'Martillo hidráulico', description: 'Golpe cuerpo a cuerpo ancho y corto: despeja lo que ya te rodea. Con MAIA hace la mitad de daño.', model: 'cyberpunk/barrido' },
  },
});
