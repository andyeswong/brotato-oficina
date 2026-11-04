import { defineWeaponBehavior, z } from '../../../../game/brotato/api';

// Tiro en arco al enemigo más cercano: cae donde estaba y explota, así que al que corre se le escapa
export default defineWeaponBehavior({
  format: 1,
  id: 'lob',
  name: 'Explosivo',
  params: z.strictObject({
    speed: z.number().positive(),
    radius: z.number().positive(),
  }),
  fire(shot, api, p) {
    api.lob(shot, { speed: p.speed, radius: p.radius });
  },
});
