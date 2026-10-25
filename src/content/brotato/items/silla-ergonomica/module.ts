import { defineItem } from '../../../../game/brotato/api';

export default defineItem({
  format: 1,
  id: 'silla-ergonomica',
  name: 'Silla ergonómica',
  description: '+3 de vida máxima, −3 % de velocidad. Cómoda, pero cuesta levantarse.',
  tags: ['oficina'],
  modifiers: [
    { stat: 'max-hp', add: 3 },
    { stat: 'speed-pct', add: -3 },
  ],
  shop: { price: 15 },
});
