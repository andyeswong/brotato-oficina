import { defineWeaponBehavior, z } from '@engine/api';

// Estocada cuerpo a cuerpo en línea recta hacia el objetivo; el largo es el alcance del arma
export default defineWeaponBehavior({
  format: 1,
  id: 'thrust',
  name: 'Estocada',
  params: z.strictObject({
    width: z.number().positive().default(10),
  }),
  fire(shot, api, p) {
    api.melee(shot, { reach: shot.range, width: p.width });
  },
});
