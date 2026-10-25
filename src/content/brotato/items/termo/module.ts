import { defineItem } from '../../../../game/brotato/api';

export default defineItem({
  format: 1,
  id: 'termo',
  name: 'Termo',
  description: '+2 de regeneración. Algo caliente a media mañana y se recupera una.',
  tags: ['oficina', 'vida'],
  modifiers: [{ stat: 'hp-regen', add: 2 }],
  shop: { price: 22, minWave: 2, order: 7 },
  looks: {
    oficina: { name: 'Termo', description: '+2 de regeneración. Algo caliente a media mañana y se recupera una.' },
    medieval: { name: 'Odre', description: '+2 de regeneración. Un trago a media mañana y se recupera una.' },
    cyberpunk: { name: 'Batería de respaldo', description: '+2 de regeneración. Se recarga sola, poco a poco.' },
  },
});
