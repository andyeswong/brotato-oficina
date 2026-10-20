import { defineStat } from '@engine/api';

export default defineStat({
  format: 1,
  id: 'melee-damage',
  name: 'Daño cuerpo a cuerpo',
  base: 0,
  min: -100,
  max: 500,
  display: 'number',
});
