import { defineStat } from '../../../../game/brotato/api';

export default defineStat({
  format: 1,
  id: 'damage-pct',
  name: 'Daño',
  base: 0,
  min: -100,
  max: 1000,
  display: 'percent',
});
