import { defineWave } from '@engine/api';

export default defineWave({
  format: 1,
  id: 'o10',
  name: 'Oleada 10',
  duration: 60,
  groups: [
    { enemy: 'bicho-grapa', from: 0, to: 58, every: 0.6, count: 4, pattern: 'random' },
    { enemy: 'bicho-grapa', from: 30, to: 58, every: 3, count: 8, pattern: 'cluster' },
    { enemy: 'bicho-clip', from: 3, to: 58, every: 1.5, count: 3, pattern: 'edge' },
    { enemy: 'bicho-grapa', from: 45, to: 55, every: 10, count: 8, pattern: 'ring' },
    { enemy: 'bicho-taza', from: 5, to: 58, every: 4, count: 2, pattern: 'edge' },
  ],
});
