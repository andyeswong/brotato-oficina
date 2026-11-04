import { defineWeaponBehavior, z } from '../../../../game/brotato/api';

// Golpe lento al suelo: lo que tiene delante recibe el daño entero, y la onda alcanza alrededor con una parte
export default defineWeaponBehavior({
  format: 1,
  id: 'slam',
  name: 'Golpe de suelo',
  params: z.strictObject({
    width: z.number().positive().default(18),
    ringRadius: z.number().positive(),
    ringFactor: z.number().positive().max(1).default(0.5),
  }),
  fire(shot, api, p) {
    api.slam(shot, { reach: shot.range, width: p.width, radius: p.ringRadius, factor: p.ringFactor });
  },
});
