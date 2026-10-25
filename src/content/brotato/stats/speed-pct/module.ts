import { defineStat } from '../../../../game/brotato/api';

export default defineStat({
  format: 1,
  id: 'speed-pct',
  name: 'Velocidad',
  base: 0,
  min: -80,
  max: 300,
  display: 'percent',
});
