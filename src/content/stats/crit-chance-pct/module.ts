import { defineStat } from '@engine/api';

export default defineStat({
  format: 1,
  id: 'crit-chance-pct',
  name: 'Crítico',
  base: 0,
  min: 0,
  max: 100,
  display: 'percent',
});
