import { defineItem } from '../../../../game/brotato/api';

export default defineItem({
  format: 1,
  id: 'cafe',
  name: 'Café',
  description: '+10 % de cadencia, −1 % de crítico. A la tercera taza tiembla el pulso.',
  modifiers: [
    { stat: 'attack-speed-pct', add: 10 },
    { stat: 'crit-chance-pct', add: -1 },
  ],
  maxStack: 5,
  shop: { price: 12, order: 4 },
  looks: {
    oficina: { icon: 'items/oficina-cafe', name: 'Café', description: '+10 % de cadencia, −1 % de crítico. A la tercera taza tiembla el pulso.' },
    medieval: { icon: 'items/medieval-cafe', name: 'Hidromiel', description: '+10 % de cadencia, −1 % de crítico. A la tercera jarra tiembla el pulso.' },
    cyberpunk: { icon: 'items/cyberpunk-cafe', name: 'Café sintético', description: '+10 % de cadencia, −1 % de crítico. Al tercer vaso tiembla el pulso.' },
  },
});
