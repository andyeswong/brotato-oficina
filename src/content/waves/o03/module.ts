import { defineWave } from '@engine/api';

export default defineWave({
  format: 1,
  id: 'o03',
  name: 'Oleada 3',
  duration: 30,
  groups: [
    { enemy: 'bicho-grapa', from: 0, to: 28, every: 1.3, count: 2, pattern: 'random' },
    { enemy: 'bicho-grapa', from: 15, to: 28, every: 6, count: 4, pattern: 'cluster' },
    { enemy: 'bicho-clip', from: 3, to: 28, every: 3.8, count: 1, pattern: 'edge' },
  ],
});
