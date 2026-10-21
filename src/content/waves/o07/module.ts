import { defineWave } from '@engine/api';

// Rampa continua de F1 (factor de dificultad 0.8): bichos grapa a 1,3 + 0,2 × (oleada − 1) por segundo,
// clip desde la 2 y taza desde la 3. Ver motor/CURVA-F1.md.
export default defineWave({
  format: 1,
  id: 'o07',
  name: 'Oleada 7',
  duration: 50,
  groups: [
    { enemy: 'bicho-grapa', from: 0, to: 48, every: 1, count: 2, pattern: 'random' },
    { enemy: 'bicho-grapa', from: 25, to: 48, every: 5, count: 6, pattern: 'cluster' },
    { enemy: 'bicho-clip', from: 3, to: 48, every: 2.94, count: 2, pattern: 'edge' },
    { enemy: 'bicho-taza', from: 5, to: 48, every: 6, count: 1, pattern: 'edge' },
    { enemy: 'bicho-grapa', from: 35, to: 45, every: 10, count: 7, pattern: 'ring' },
  ],
});
