import { defineWave } from '@engine/api';

export default defineWave({
  format: 1,
  id: 'o06',
  name: 'Oleada 6',
  duration: 45,
  groups: [
    { enemy: 'bicho-grapa', from: 0, to: 43, every: 1.0, count: 3, pattern: 'random' },
    { enemy: 'bicho-grapa', from: 22, to: 43, every: 4, count: 6, pattern: 'cluster' },
    { enemy: 'bicho-clip', from: 3, to: 43, every: 2.6, count: 2, pattern: 'edge' },
    { enemy: 'bicho-grapa', from: 30, to: 40, every: 10, count: 8, pattern: 'ring' },
  ],
});
