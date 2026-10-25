import { defineWave } from '../../../../game/brotato/api';

// Rampa continua de F1 (factor de dificultad 0.8): bichos grapa a 1,3 + 0,2 × (oleada − 1) por segundo,
// clip desde la 2 y taza desde la 3. Ver motor/CURVA-F1.md.
export default defineWave({
  format: 1,
  id: 'o08',
  name: 'Oleada 8',
  duration: 55,
  groups: [
    { enemy: 'perseguidor', from: 0, to: 53, every: 0.93, count: 2, pattern: 'random' },
    { enemy: 'perseguidor', from: 27, to: 53, every: 5, count: 6, pattern: 'cluster' },
    { enemy: 'embestidor', from: 3, to: 53, every: 2.37, count: 2, pattern: 'edge' },
    { enemy: 'escupidor', from: 5, to: 53, every: 5.25, count: 2, pattern: 'edge' },
    { enemy: 'perseguidor', from: 40, to: 50, every: 10, count: 8, pattern: 'ring' },
  ],
});
