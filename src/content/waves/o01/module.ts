import { defineWave } from '@engine/api';

export default defineWave({
  format: 1,
  id: 'o01',
  name: 'Oleada 1',
  duration: 20,
  groups: [
    { enemy: 'bicho-grapa', from: 0, to: 18, every: 1.5, count: 1, pattern: 'random' },
  ],
});
