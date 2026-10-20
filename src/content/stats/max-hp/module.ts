import { defineStat } from '@engine/api';

export default defineStat({
  format: 1,
  id: 'max-hp',
  name: 'Vida máxima',
  base: 10,
  min: 1,
  max: 9999,
  display: 'number',
});
