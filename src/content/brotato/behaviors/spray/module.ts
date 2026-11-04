import { defineWeaponBehavior, z } from '../../../../game/brotato/api';

// Un cono corto y continuo: cada disparo golpea a todo lo que haya dentro; el largo es el alcance del arma
export default defineWeaponBehavior({
  format: 1,
  id: 'spray',
  name: 'Chorro',
  params: z.strictObject({
    halfDeg: z.number().positive().max(90).default(22),
  }),
  fire(shot, api, p) {
    api.cone(shot, { reach: shot.range, half: (p.halfDeg * Math.PI) / 180 });
  },
});
