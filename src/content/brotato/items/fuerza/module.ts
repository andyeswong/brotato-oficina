import { defineItem } from '../../../../game/brotato/api';

// Catálogo 2 (2026-10-25): da una stat que antes no daba ningún objeto. Rareza (weight) de la curva F1: con peso 1
// los seis objetos nuevos quitaban sitio a las armas en la tienda (4 huecos) y la oficina caía de 7,63 a 6,91; con
// 0,3 (0,5 la furia, cara y desde la oleada 2) queda en 7,34, y ninguno baja del 10 % de compras del piloto.
export default defineItem({
  format: 1,
  id: 'fuerza',
  name: 'Fuerza',   // el papel; el nombre que se enseña va en looks, por mundo
  description: '+2 de daño cuerpo a cuerpo.',
  modifiers: [
    { stat: 'melee-damage', add: 2 },
  ],
  shop: { price: 14, weight: 0.3, order: 10 },
  looks: {
    oficina: { icon: 'items/oficina-fuerza', name: 'Guantes de carga', description: '+2 de daño cuerpo a cuerpo.' },
    medieval: { icon: 'items/medieval-fuerza', name: 'Guanteletes', description: '+2 de daño cuerpo a cuerpo.' },
    cyberpunk: { icon: 'items/cyberpunk-fuerza', name: 'Puños hidráulicos', description: '+2 de daño cuerpo a cuerpo.' },
  },
});
