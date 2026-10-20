import { defineWave } from '@engine/api';

export default defineWave({
  format: 1,
  id: 'o04',
  name: 'Oleada 4',
  duration: 35,
  groups: [
    { enemy: 'bicho-grapa', from: 0, to: 33, every: 1.2, count: 2, pattern: 'random' },
    { enemy: 'bicho-grapa', from: 17, to: 33, every: 5, count: 5, pattern: 'cluster' },
    { enemy: 'bicho-clip', from: 3, to: 33, every: 3.4, count: 1, pattern: 'edge' },
  ],
});
