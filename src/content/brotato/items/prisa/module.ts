import { defineItem } from '../../../../game/brotato/api';

// Catálogo 2 (2026-10-25): da una stat que antes no daba ningún objeto. Rareza (weight) de la curva F1: con peso 1
// los seis objetos nuevos quitaban sitio a las armas en la tienda (4 huecos) y la oficina caía de 7,63 a 6,91; con
// 0,3 (0,5 la furia, cara y desde la oleada 2) queda en 7,34, y ninguno baja del 10 % de compras del piloto.
export default defineItem({
  format: 1,
  id: 'prisa',
  name: 'Prisa',   // el papel; el nombre que se enseña va en looks, por mundo
  description: '+8 % de velocidad, −5 % de daño.',
  modifiers: [
    { stat: 'speed-pct', add: 8 },
    { stat: 'damage-pct', add: -5 },
  ],
  shop: { price: 15, weight: 0.3, order: 13 },
  looks: {
    oficina: { name: 'Zapatillas', description: '+8 % de velocidad, −5 % de daño.' },
    medieval: { name: 'Botas de viaje', description: '+8 % de velocidad, −5 % de daño.' },
    cyberpunk: { name: 'Patines de neón', description: '+8 % de velocidad, −5 % de daño.' },
  },
});
