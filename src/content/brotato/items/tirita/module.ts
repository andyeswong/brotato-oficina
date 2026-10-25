import { defineItem } from '../../../../game/brotato/api';

export default defineItem({
  format: 1,
  id: 'tirita',
  name: 'Tirita',
  description: '+4 % de robo de vida. Cada golpe que das puede curarte 1.',
  tags: ['oficina', 'vida'],
  modifiers: [{ stat: 'life-steal-pct', add: 4 }],
  maxStack: 5,
  shop: { price: 10, order: 8 },
  looks: {
    oficina: { icon: 'items/oficina-tirita', name: 'Tirita', description: '+4 % de robo de vida. Cada golpe que das puede curarte 1.' },
    medieval: { icon: 'items/medieval-tirita', name: 'Vendas', description: '+4 % de robo de vida. Cada golpe que das puede curarte 1.' },
    cyberpunk: { icon: 'items/cyberpunk-tirita', name: 'Parche médico', description: '+4 % de robo de vida. Cada golpe que das puede curarte 1.' },
  },
});
