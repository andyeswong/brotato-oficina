import { defineItem } from '../../../../game/brotato/api';

// Catálogo 2 (2026-10-25): da una stat que antes no daba ningún objeto. Rareza (weight) de la curva F1: con peso 1
// los seis objetos nuevos quitaban sitio a las armas en la tienda (4 huecos) y la oficina caía de 7,63 a 6,91; con
// 0,3 (0,5 la furia, cara y desde la oleada 2) queda en 7,34, y ninguno baja del 10 % de compras del piloto.
export default defineItem({
  format: 1,
  id: 'precision',
  name: 'Precisión',   // el papel; el nombre que se enseña va en looks, por mundo
  description: '+5 % de crítico.',
  modifiers: [
    { stat: 'crit-chance-pct', add: 5 },
  ],
  maxStack: 5,
  shop: { price: 18, weight: 0.3, order: 9 },
  looks: {
    oficina: { name: 'Lentes de precisión', description: '+5 % de crítico.' },
    medieval: { name: 'Ojo de halcón', description: '+5 % de crítico.' },
    cyberpunk: { name: 'Implante ocular', description: '+5 % de crítico.' },
  },
});
