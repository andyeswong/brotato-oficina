import { defineWave } from '@engine/api';

// Rampa continua de F1 (factor de dificultad 1): bichos grapa a 1,3 + 0,2 × (oleada − 1) por segundo,
// clip desde la 2 y taza desde la 3. Ver motor/CURVA-F1.md.
export default defineWave({
  format: 1,
  id: 'o06',
  name: 'Oleada 6',
  duration: 45,
  groups: [
    { enemy: 'bicho-grapa', from: 0, to: 43, every: 0.87, count: 2, pattern: 'random' },
    { enemy: 'bicho-grapa', from: 22, to: 43, every: 5, count: 6, pattern: 'cluster' },
    { enemy: 'bicho-clip', from: 3, to: 43, every: 2.8, count: 1, pattern: 'edge' },
    { enemy: 'bicho-taza', from: 5, to: 43, every: 5.4, count: 1, pattern: 'edge' },
    { enemy: 'bicho-grapa', from: 30, to: 40, every: 10, count: 6, pattern: 'ring' },
  ],
});
