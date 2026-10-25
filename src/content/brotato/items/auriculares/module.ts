import { defineItem } from '../../../../game/brotato/api';

export default defineItem({
  format: 1,
  id: 'auriculares',
  name: 'Auriculares',
  description: '+6 % de esquiva. No oyes nada, tampoco los golpes.',
  tags: ['oficina'],
  modifiers: [{ stat: 'dodge-pct', add: 6 }],
  shop: { price: 18, minWave: 2 },
});
