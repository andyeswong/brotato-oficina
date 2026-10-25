import { defineItem } from '../../../../game/brotato/api';

// Catálogo 2 (2026-10-25): da una stat que antes no daba ningún objeto. Rareza (weight) de la curva F1: con peso 1
// los seis objetos nuevos quitaban sitio a las armas en la tienda (4 huecos) y la oficina caía de 7,63 a 6,91; con
// 0,3 (0,5 la furia, cara y desde la oleada 2) queda en 7,34, y ninguno baja del 10 % de compras del piloto.
export default defineItem({
  format: 1,
  id: 'alcance',
  name: 'Alcance',   // el papel; el nombre que se enseña va en looks, por mundo
  description: '+12 de alcance de las armas.',
  modifiers: [
    { stat: 'range', add: 12 },
  ],
  shop: { price: 16, weight: 0.3, order: 12 },
  looks: {
    oficina: { icon: 'items/oficina-alcance', name: 'Puntero láser', description: '+12 de alcance de las armas.' },
    medieval: { icon: 'items/medieval-alcance', name: 'Catalejo', description: '+12 de alcance de las armas.' },
    cyberpunk: { icon: 'items/cyberpunk-alcance', name: 'Mira holográfica', description: '+12 de alcance de las armas.' },
  },
});
