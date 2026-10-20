import { angleTo, defineEnemyBehavior, steerTowards, z } from '@engine/api';

const MOVE = 0;
const AIM = 1;

// Se queda a distancia, se para un momento a apuntar (aviso) y dispara al jugador
export default defineEnemyBehavior({
  format: 1,
  id: 'shooter',
  name: 'Tirador',
  params: z.strictObject({
    distance: z.number().positive().default(120),     // distancia que intenta mantener
    fireEvery: z.number().positive().default(2.2),
    aim: z.number().min(0).default(0.35),             // segundos quieto antes de disparar
    projectileSpeed: z.number().positive().default(110),
  }),
  update(self, dt, api, p) {
    const m = self.mem;
    m.state ??= MOVE;
    m.t ??= p.fireEvery * (0.5 + api.rng() * 0.5); // que no disparen todos a la vez
    m.t -= dt;

    if (m.state === MOVE) {
      const d = Math.hypot(api.player.x - self.x, api.player.y - self.y);
      steerTowards(self, api.player, self.speed);
      if (d < p.distance * 0.8) {
        self.vx = -self.vx; // demasiado cerca: se aleja
        self.vy = -self.vy;
      } else if (d < p.distance * 1.2) {
        self.vx *= 0.2;     // a buena distancia: casi quieto
        self.vy *= 0.2;
      }
      if (m.t <= 0) {
        m.state = AIM;
        m.t = p.aim;
      }
    } else {
      self.vx = 0;
      self.vy = 0;
      if (m.t <= 0) {
        api.shoot(self, angleTo(self, api.player), p.projectileSpeed);
        m.state = MOVE;
        m.t = p.fireEvery;
      }
    }
  },
});
