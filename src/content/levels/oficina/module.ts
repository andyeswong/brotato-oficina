import { defineLevel } from '@engine/api';

export default defineLevel({
  format: 1,
  id: 'oficina',
  name: 'La oficina',
  arena: { width: 640, height: 640 },
  // F1: 10 oleadas
  waves: ['o01', 'o02', 'o03', 'o04', 'o05', 'o06', 'o07', 'o08', 'o09', 'o10'],
});
