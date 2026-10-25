import { defineItem } from '../../../../game/brotato/api';

export default defineItem({
  format: 1,
  id: 'agenda',
  name: 'Agenda',
  description: '+2 de daño a distancia y +1 de armadura. Todo apuntado, nada se escapa.',
  tags: ['oficina'],
  modifiers: [
    { stat: 'ranged-damage', add: 2 },
    { stat: 'armor', add: 1 },
  ],
  shop: { price: 16, order: 1 },
});
