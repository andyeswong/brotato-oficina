import { defineStat } from '@engine/api';

export default defineStat({
  format: 1,
  id: 'pickup-range',
  name: 'Recolección',
  base: 80,
  min: 0,
  max: 400,
  display: 'number',
});
