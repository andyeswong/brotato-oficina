import { defineItem } from '../../../../game/brotato/api';

export default defineItem({
  format: 1,
  id: 'termo',
  name: 'Termo',
  description: '+2 de regeneración. Algo caliente a media mañana y se recupera una.',
  tags: ['oficina', 'vida'],
  modifiers: [{ stat: 'hp-regen', add: 2 }],
  shop: { price: 22, minWave: 2, order: 7 },
});
