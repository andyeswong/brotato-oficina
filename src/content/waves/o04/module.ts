import { defineWave } from '@engine/api';

// Rampa continua de F1 (factor de dificultad 1): bichos grapa a 1,3 + 0,2 × (oleada − 1) por segundo,
// clip desde la 2 y taza desde la 3. Ver motor/CURVA-F1.md.
export default defineWave({
  format: 1,
  id: 'o04',
  name: 'Oleada 4',
  duration: 35,
  groups: [
    { enemy: 'bicho-grapa', from: 0, to: 33, every: 1.05, count: 2, pattern: 'random' },
    { enemy: 'bicho-grapa', from: 17, to: 33, every: 5, count: 5, pattern: 'cluster' },
    { enemy: 'bicho-clip', from: 3, to: 33, every: 3.7, count: 1, pattern: 'edge' },
    { enemy: 'bicho-taza', from: 5, to: 33, every: 6.6, count: 1, pattern: 'edge' },
  ],
});
