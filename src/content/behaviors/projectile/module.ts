import { defineWeaponBehavior, z } from '@engine/api';

// Dispara uno o varios proyectiles hacia el objetivo, repartidos en abanico si son varios
export default defineWeaponBehavior({
  format: 1,
  id: 'projectile',
  name: 'Proyectil',
  params: z.strictObject({
    speed: z.number().positive(),
    count: z.number().int().min(1).default(1),
    spreadDeg: z.number().min(0).max(360).default(0),
    pierce: z.number().int().min(0).default(0),
    radius: z.number().positive().default(3),
    anim: z.string().default('projectile'),   // nombre en sprites.anims del arma
  }),
  fire(shot, api, p) {
    const spread = (p.spreadDeg * Math.PI) / 180;
    for (let i = 0; i < p.count; i++) {
      const offset = p.count === 1 ? 0 : (i / (p.count - 1) - 0.5) * spread;
      api.projectile(shot, { angle: shot.angle + offset, speed: p.speed, pierce: p.pierce, radius: p.radius, anim: p.anim });
    }
  },
});
