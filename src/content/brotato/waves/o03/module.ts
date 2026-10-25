import { defineWave } from '../../../../game/brotato/api';

// Rampa continua de F1 (factor de dificultad 0.8): bichos grapa a 1,3 + 0,2 × (oleada − 1) por segundo,
// clip desde la 2 y taza desde la 3. Ver motor/CURVA-F1.md.
export default defineWave({
  format: 1,
  id: 'o03',
  name: 'Oleada 3',
  duration: 30,
  groups: [
    { enemy: 'perseguidor', from: 0, to: 28, every: 1.47, count: 2, pattern: 'random' },
    { enemy: 'perseguidor', from: 15, to: 28, every: 5, count: 4, pattern: 'cluster' },
    { enemy: 'embestidor', from: 3, to: 28, every: 5.19, count: 1, pattern: 'edge' },
    { enemy: 'escupidor', from: 5, to: 28, every: 9, count: 1, pattern: 'edge' },
  ],
});
