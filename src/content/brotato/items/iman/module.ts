import { defineItem } from '../../../../game/brotato/api';

// Catálogo 2 (2026-10-25): da una stat que antes no daba ningún objeto. Rareza (weight) de la curva F1: con peso 1
// los seis objetos nuevos quitaban sitio a las armas en la tienda (4 huecos) y la oficina caía de 7,63 a 6,91; con
// 0,3 (0,5 la furia, cara y desde la oleada 2) queda en 7,34, y ninguno baja del 10 % de compras del piloto.
export default defineItem({
  format: 1,
  id: 'iman',
  name: 'Imán',   // el papel; el nombre que se enseña va en looks, por mundo
  description: '+20 de alcance para recoger materiales.',
  modifiers: [
    { stat: 'pickup-range', add: 20 },
  ],
  shop: { price: 12, weight: 0.3, order: 11 },
  looks: {
    oficina: { icon: 'items/oficina-iman', name: 'Imán de bolsillo', description: '+20 de alcance para recoger materiales.' },
    medieval: { icon: 'items/medieval-iman', name: 'Bolsa de cuero', description: '+20 de alcance para recoger materiales.' },
    cyberpunk: { icon: 'items/cyberpunk-iman', name: 'Imán de neodimio', description: '+20 de alcance para recoger materiales.' },
  },
});
