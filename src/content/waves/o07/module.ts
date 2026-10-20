import { defineWave } from '@engine/api';

export default defineWave({
  format: 1,
  id: 'o07',
  name: 'Oleada 7',
  duration: 50,
  groups: [
    { enemy: 'bicho-grapa', from: 0, to: 48, every: 0.9, count: 3, pattern: 'random' },
    { enemy: 'bicho-grapa', from: 25, to: 48, every: 4, count: 6, pattern: 'cluster' },
    { enemy: 'bicho-clip', from: 3, to: 48, every: 2.2, count: 2, pattern: 'edge' },
    { enemy: 'bicho-grapa', from: 35, to: 45, every: 10, count: 8, pattern: 'ring' },
    { enemy: 'bicho-taza', from: 5, to: 48, every: 6, count: 2, pattern: 'edge' },
  ],
});
