import { defineWave } from '@engine/api';

// Rampa continua de F1 (factor de dificultad 0.8): bichos grapa a 1,3 + 0,2 × (oleada − 1) por segundo,
// clip desde la 2 y taza desde la 3. Ver motor/CURVA-F1.md.
export default defineWave({
  format: 1,
  id: 'o05',
  name: 'Oleada 5',
  duration: 40,
  groups: [
    { enemy: 'bicho-grapa', from: 0, to: 38, every: 1.19, count: 2, pattern: 'random' },
    { enemy: 'bicho-grapa', from: 20, to: 38, every: 5, count: 5, pattern: 'cluster' },
    { enemy: 'bicho-clip', from: 3, to: 38, every: 4.06, count: 1, pattern: 'edge' },
    { enemy: 'bicho-taza', from: 5, to: 38, every: 7.5, count: 1, pattern: 'edge' },
  ],
});
