import { defineStat } from '@engine/api';

export default defineStat({
  format: 1,
  id: 'attack-speed-pct',
  name: 'Cadencia',
  base: 0,
  min: -90,
  max: 500,
  display: 'percent',
});
