import { defineWave } from '@engine/api';

export default defineWave({
  format: 1,
  id: 'o08',
  name: 'Oleada 8',
  duration: 55,
  groups: [
    { enemy: 'bicho-grapa', from: 0, to: 53, every: 0.8, count: 3, pattern: 'random' },
    { enemy: 'bicho-grapa', from: 27, to: 53, every: 3, count: 7, pattern: 'cluster' },
    { enemy: 'bicho-clip', from: 3, to: 53, every: 1.8, count: 2, pattern: 'edge' },
    { enemy: 'bicho-grapa', from: 40, to: 50, every: 10, count: 8, pattern: 'ring' },
    { enemy: 'bicho-taza', from: 5, to: 53, every: 5, count: 2, pattern: 'edge' },
  ],
});
