import { defineWave } from '../../../../game/brotato/api';

// Rampa continua de F1 (factor de dificultad 0.8): bichos grapa a 1,3 + 0,2 × (oleada − 1) por segundo,
// clip desde la 2 y taza desde la 3. Ver motor/CURVA-F1.md.
export default defineWave({
  format: 1,
  id: 'o02',
  name: 'Oleada 2',
  duration: 25,
  groups: [
    { enemy: 'perseguidor', from: 0, to: 23, every: 1.67, count: 2, pattern: 'random' },
    { enemy: 'perseguidor', from: 12, to: 23, every: 5, count: 4, pattern: 'cluster' },
    { enemy: 'embestidor', from: 3, to: 23, every: 5.75, count: 1, pattern: 'edge' },
  ],
});
