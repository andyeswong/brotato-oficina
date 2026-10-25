import { defineItem } from '../../../../game/brotato/api';

export default defineItem({
  format: 1,
  id: 'silla-ergonomica',
  name: 'Silla ergonómica',
  description: '+3 de vida máxima, −3 % de velocidad. Cómoda, pero cuesta levantarse.',
  modifiers: [
    { stat: 'max-hp', add: 3 },
    { stat: 'speed-pct', add: -3 },
  ],
  shop: { price: 15, order: 6 },
  looks: {
    oficina: { name: 'Silla ergonómica', description: '+3 de vida máxima, −3 % de velocidad. Cómoda, pero cuesta levantarse.' },
    medieval: { name: 'Cota de malla', description: '+3 de vida máxima, −3 % de velocidad. Protege, pero pesa.' },
    cyberpunk: { name: 'Exoesqueleto pesado', description: '+3 de vida máxima, −3 % de velocidad. Protege, pero pesa.' },
  },
});
