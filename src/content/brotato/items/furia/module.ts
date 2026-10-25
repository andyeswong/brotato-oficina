import { defineItem } from '../../../../game/brotato/api';

// Catálogo 2 (2026-10-25): da una stat que antes no daba ningún objeto. Rareza (weight) de la curva F1: con peso 1
// los seis objetos nuevos quitaban sitio a las armas en la tienda (4 huecos) y la oficina caía de 7,63 a 6,91; con
// 0,3 (0,5 la furia, cara y desde la oleada 2) queda en 7,34, y ninguno baja del 10 % de compras del piloto.
export default defineItem({
  format: 1,
  id: 'furia',
  name: 'Furia',   // el papel; el nombre que se enseña va en looks, por mundo
  description: '+12 % de daño, −3 de vida máxima.',
  modifiers: [
    { stat: 'damage-pct', add: 12 },
    { stat: 'max-hp', add: -3 },
  ],
  shop: { price: 20, weight: 0.5, minWave: 2, order: 14 },
  looks: {
    oficina: { icon: 'items/oficina-furia', name: 'Bebida energética', description: '+12 % de daño, −3 de vida máxima.' },
    medieval: { icon: 'items/medieval-furia', name: 'Poción de furia', description: '+12 % de daño, −3 de vida máxima.' },
    cyberpunk: { icon: 'items/cyberpunk-furia', name: 'Estimulante', description: '+12 % de daño, −3 de vida máxima.' },
  },
});
