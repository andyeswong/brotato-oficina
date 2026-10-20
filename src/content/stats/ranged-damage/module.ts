import { defineStat } from '@engine/api';

export default defineStat({
  format: 1,
  id: 'ranged-damage',
  name: 'Daño a distancia',
  base: 0,
  min: -100,
  max: 500,
  display: 'number',
});
