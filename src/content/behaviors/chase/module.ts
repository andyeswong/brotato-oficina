import { defineEnemyBehavior, steerTowards, z } from '@engine/api';

// Va directo a por el jugador. turnRate < 1 suaviza el giro (no corrige el rumbo de golpe).
export default defineEnemyBehavior({
  format: 1,
  id: 'chase',
  name: 'Perseguir',
  params: z.strictObject({
    turnRate: z.number().gt(0).max(1).default(1),
  }),
  update(self, _dt, api, p) {
    const vx = self.vx;
    const vy = self.vy;
    steerTowards(self, api.player, self.speed);
    self.vx = vx + (self.vx - vx) * p.turnRate;
    self.vy = vy + (self.vy - vy) * p.turnRate;
  },
});
