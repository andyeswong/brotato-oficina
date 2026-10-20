import { defineWave } from '@engine/api';

export default defineWave({
  format: 1,
  id: 'o02',
  name: 'Oleada 2',
  duration: 25,
  groups: [
    { enemy: 'bicho-grapa', from: 0, to: 23, every: 1.4, count: 1, pattern: 'random' },
    { enemy: 'bicho-grapa', from: 12, to: 23, every: 6, count: 4, pattern: 'cluster' },
  ],
});
