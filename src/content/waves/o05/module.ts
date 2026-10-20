import { defineWave } from '@engine/api';

export default defineWave({
  format: 1,
  id: 'o05',
  name: 'Oleada 5',
  duration: 40,
  groups: [
    { enemy: 'bicho-grapa', from: 0, to: 38, every: 1.1, count: 2, pattern: 'random' },
    { enemy: 'bicho-grapa', from: 20, to: 38, every: 5, count: 5, pattern: 'cluster' },
    { enemy: 'bicho-clip', from: 3, to: 38, every: 3.0, count: 2, pattern: 'edge' },
    { enemy: 'bicho-taza', from: 5, to: 38, every: 7, count: 1, pattern: 'edge' },
  ],
});
