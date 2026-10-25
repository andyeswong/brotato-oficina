import { defineItem } from '../../../../game/brotato/api';

export default defineItem({
  format: 1,
  id: 'auriculares',
  name: 'Auriculares',
  description: '+6 % de esquiva. No oyes nada, tampoco los golpes.',
  modifiers: [{ stat: 'dodge-pct', add: 6 }],
  shop: { price: 18, minWave: 2, order: 2 },
  looks: {
    oficina: { icon: 'items/oficina-auriculares', name: 'Auriculares', description: '+6 % de esquiva. No oyes nada, tampoco los golpes.' },
    medieval: { icon: 'items/medieval-auriculares', name: 'Capucha', description: '+6 % de esquiva. No oyes nada, tampoco los golpes.' },
    cyberpunk: { icon: 'items/cyberpunk-auriculares', name: 'Cascos de neón', description: '+6 % de esquiva. Música a todo volumen, ni oyes los golpes.' },
  },
});
