import { defineItem } from '../../../../game/brotato/api';

export default defineItem({
  format: 1,
  id: 'agenda',
  name: 'Agenda',
  description: '+2 de daño a distancia y +1 de armadura. Todo apuntado, nada se escapa.',
  modifiers: [
    { stat: 'ranged-damage', add: 2 },
    { stat: 'armor', add: 1 },
  ],
  shop: { price: 16, order: 1 },
  looks: {
    oficina: { name: 'Agenda', description: '+2 de daño a distancia y +1 de armadura. Todo apuntado, nada se escapa.' },
    medieval: { name: 'Libro de cuentas', description: '+2 de daño a distancia y +1 de armadura. Todo anotado con pluma, nada se escapa.' },
    cyberpunk: { name: 'Tableta', description: '+2 de daño a distancia y +1 de armadura. Todo en la nube, nada se escapa.' },
  },
});
