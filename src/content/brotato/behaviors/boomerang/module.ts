import { defineWeaponBehavior, z } from '../../../../game/brotato/api';

// Va hasta el final de su alcance y vuelve al cuerpo, atravesando: golpea a la ida y a la vuelta
export default defineWeaponBehavior({
  format: 1,
  id: 'boomerang',
  name: 'Retorno',
  params: z.strictObject({
    speed: z.number().positive(),
    radius: z.number().positive().default(4),
  }),
  fire(shot, api, p) {
    api.projectile(shot, { speed: p.speed, radius: p.radius, pierce: 999, returns: true });
  },
});
