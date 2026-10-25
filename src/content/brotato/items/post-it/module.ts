import { defineItem } from '../../../../game/brotato/api';

// Un ítem con efecto que no es una estadística: solo hooks, sin código en el motor
export default defineItem({
  format: 1,
  id: 'post-it',
  name: 'Post-it',
  description: 'Cada 10 bajas, el enemigo suelta un material extra. Lo apuntas todo.',
  maxStack: 3,
  shop: { price: 20, minWave: 2, order: 5 },
  hooks: {
    onKill(ev, api) {
      if (api.counter('kills') % 10 === 0 && ev.at) api.dropMaterials(ev.at as { x: number; y: number }, 1);
    },
  },
  looks: {
    oficina: { icon: 'items/oficina-post-it', name: 'Post-it', description: 'Cada 10 bajas, el enemigo suelta un material extra. Lo apuntas todo.' },
    medieval: { icon: 'items/medieval-post-it', name: 'Pergamino', description: 'Cada 10 bajas, el enemigo suelta un material extra. Lo anotas todo.' },
    cyberpunk: { icon: 'items/cyberpunk-post-it', name: 'Chip de registro', description: 'Cada 10 bajas, el enemigo suelta un material extra. Lo registra todo.' },
  },
});
