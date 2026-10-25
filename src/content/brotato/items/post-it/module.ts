import { defineItem } from '../../../../game/brotato/api';

// Un ítem con efecto que no es una estadística: solo hooks, sin código en el motor
export default defineItem({
  format: 1,
  id: 'post-it',
  name: 'Post-it',
  description: 'Cada 10 bajas, el enemigo suelta un material extra. Lo apuntas todo.',
  tags: ['oficina'],
  maxStack: 3,
  shop: { price: 20, minWave: 2, order: 5 },
  hooks: {
    onKill(ev, api) {
      if (api.counter('kills') % 10 === 0 && ev.at) api.dropMaterials(ev.at as { x: number; y: number }, 1);
    },
  },
});
