import { defineItem } from '../../../../game/brotato/api';

export default defineItem({
  format: 1,
  id: 'cafe',
  name: 'Café',
  description: '+10 % de cadencia, −1 % de crítico. A la tercera taza tiembla el pulso.',
  tags: ['oficina'],
  modifiers: [
    { stat: 'attack-speed-pct', add: 10 },
    { stat: 'crit-chance-pct', add: -1 },
  ],
  maxStack: 5,
  shop: { price: 12 },
});
