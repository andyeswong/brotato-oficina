import { defineWave } from '../../../../game/brotato/api';

// Rampa continua de F1 (factor de dificultad 0.8): bichos grapa a 1,3 + 0,2 × (oleada − 1) por segundo,
// clip desde la 2 y taza desde la 3. Ver motor/CURVA-F1.md.
export default defineWave({
  format: 1,
  id: 'o10',
  name: 'Oleada 10',
  duration: 60,
  groups: [
    { enemy: 'perseguidor', from: 0, to: 58, every: 0.81, count: 2, pattern: 'random' },
    { enemy: 'perseguidor', from: 30, to: 58, every: 5, count: 7, pattern: 'cluster' },
    { enemy: 'embestidor', from: 3, to: 58, every: 1.6, count: 2, pattern: 'edge' },
    { enemy: 'escupidor', from: 5, to: 58, every: 3.75, count: 2, pattern: 'edge' },
    { enemy: 'perseguidor', from: 45, to: 55, every: 10, count: 10, pattern: 'ring' },
  ],
});
