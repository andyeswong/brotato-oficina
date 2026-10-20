import { defineStat } from '@engine/api';

export default defineStat({
  format: 1,
  id: 'dodge-pct',
  name: 'Esquiva',
  base: 0,
  min: -100,
  max: 60,
  display: 'percent',
});
