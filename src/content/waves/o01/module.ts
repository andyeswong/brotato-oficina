import { defineWave } from '@engine/api';

// Rampa continua de F1 (factor de dificultad 0.8): bichos grapa a 1,3 + 0,2 × (oleada − 1) por segundo,
// clip desde la 2 y taza desde la 3. Ver motor/CURVA-F1.md.
export default defineWave({
  format: 1,
  id: 'o01',
  name: 'Oleada 1',
  duration: 20,
  groups: [
    { enemy: 'bicho-grapa', from: 0, to: 18, every: 1.92, count: 2, pattern: 'random' },
  ],
});
