import { defineEnemyBehavior, steerTowards, z } from '@engine/api';

const APPROACH = 0;
const WINDUP = 1;
const DASH = 2;
const RECOVER = 3;

// Se acerca, se para a cargar (aviso), embiste en línea recta y descansa
export default defineEnemyBehavior({
  format: 1,
  id: 'dash',
  name: 'Embestir',
  params: z.strictObject({
    triggerRange: z.number().positive().default(90),  // a qué distancia empieza a cargar
    windup: z.number().positive().default(0.5),       // segundos parado antes de embestir
    dashSpeed: z.number().positive().default(3.5),    // multiplica su velocidad
    dashTime: z.number().positive().default(0.45),
    recover: z.number().min(0).default(0.8),
  }),
  update(self, dt, api, p) {
    const m = self.mem;
    m.state ??= APPROACH;
    m.t ??= 0;
    m.t -= dt;

    if (m.state === APPROACH) {
      steerTowards(self, api.player, self.speed);
      if (Math.hypot(api.player.x - self.x, api.player.y - self.y) < p.triggerRange) {
        m.state = WINDUP;
        m.t = p.windup;
      }
    } else if (m.state === WINDUP) {
      self.vx = 0;
      self.vy = 0;
      if (m.t <= 0) {
        // Apunta al sitio donde está el jugador AHORA, no lo sigue durante la embestida
        steerTowards(self, api.player, self.speed * p.dashSpeed);
        m.dx = self.vx;
        m.dy = self.vy;
        m.state = DASH;
        m.t = p.dashTime;
      }
    } else if (m.state === DASH) {
      self.vx = m.dx!;
      self.vy = m.dy!;
      if (m.t <= 0) {
        m.state = RECOVER;
        m.t = p.recover;
      }
    } else {
      self.vx *= 0.8;
      self.vy *= 0.8;
      if (m.t <= 0) m.state = APPROACH;
    }
  },
});
