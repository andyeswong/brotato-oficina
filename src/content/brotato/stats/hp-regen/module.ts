import { defineStat } from '../../../../game/brotato/api';

export default defineStat({
  format: 1,
  id: 'hp-regen',
  name: 'Regeneración',
  base: 0,
  min: -50,
  max: 100,
  display: 'number',
});
