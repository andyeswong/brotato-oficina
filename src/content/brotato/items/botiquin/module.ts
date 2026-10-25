import { defineItem } from '../../../../game/brotato/api';

export default defineItem({
  format: 1,
  id: 'botiquin',
  name: 'Botiquín',
  description: '+5 de vida máxima. El de la cocina, con todo caducado menos las tiritas.',
  tags: ['oficina', 'vida'],
  modifiers: [{ stat: 'max-hp', add: 5 }],
  shop: { price: 20, order: 3 },
  looks: {
    oficina: { icon: 'items/oficina-botiquin', name: 'Botiquín', description: '+5 de vida máxima. El de la cocina, con todo caducado menos las tiritas.' },
    medieval: { icon: 'items/medieval-botiquin', name: 'Hierbas', description: '+5 de vida máxima. Un manojo para cada herida.' },
    cyberpunk: { icon: 'items/cyberpunk-botiquin', name: 'Nanobots', description: '+5 de vida máxima. Te cosen por dentro mientras corres.' },
  },
});
