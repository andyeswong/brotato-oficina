import { defineEnemyBehavior, steerTowards, z } from '../../../../game/brotato/api';

const WALK = 0;
const WINDUP = 1;
const SLAM = 2;
const THROW = 3;

// El gólem (MAIA, 2026-11-04): lento, no embiste. Golpea el suelo con anillos de onda que se esquivan por sus huecos y
// lanza trozos en abanico; en la tercera fase, dos anillos por golpe. Sin azar: los huecos giran con el reloj de la
// oleada. mem.state es para la vista
export default defineEnemyBehavior({
  format: 1,
  id: 'golem',
  name: 'Gólem',
  params: z.strictObject({
    slam: z.tuple([z.number().positive(), z.number().positive(), z.number().positive()]).default([5, 4, 3.2]),
    windup: z.tuple([z.number().positive(), z.number().positive(), z.number().positive()]).default([1, 0.8, 0.6]),
    recover: z.number().positive().default(0.8),
    secondRing: z.number().positive().default(0.45),     // tras cuánto sale el segundo anillo
    ringSpeed: z.number().positive().default(70),
    ringRadius: z.number().positive().default(170),
    gaps: z.number().int().min(1).default(3),
    gapDeg: z.number().positive().max(120).default(55),
    toss: z.tuple([z.number().positive(), z.number().positive(), z.number().positive()]).default([6, 5, 4]),
    tossTime: z.number().positive().default(0.5),
    pieces: z.tuple([z.number().int().min(1), z.number().int().min(1), z.number().int().min(1)]).default([3, 5, 7]),
    spreadDeg: z.number().min(0).max(360).default(50),
    pieceSpeed: z.number().positive().default(110),
    pieceRange: z.number().positive().default(220),
    phase2: z.number().min(0).max(1).default(0.66),
    phase3: z.number().min(0).max(1).default(0.33),
  }),
  update(self, dt, api, p) {
    const m = self.mem;
    m.state ??= WALK;
    m.t ??= 0;
    m.slam ??= p.slam[0];
    m.toss ??= p.toss[0];
    m.left ??= 0;
    m.t -= dt;
    const f = self.hp / self.maxHp;
    const phase = f > p.phase2 ? 0 : f > p.phase3 ? 1 : 2;
    m.phase = phase;
    self.push = 0;
    self.smash = false;
    const ring = () => api.ring(self, { speed: p.ringSpeed, maxRadius: p.ringRadius, gaps: p.gaps, gapDeg: p.gapDeg, start: api.time * 1.7 });

    if (m.state === WALK) {
      m.slam -= dt;
      m.toss -= dt;
      steerTowards(self, api.player, self.speed);
      if (m.slam <= 0) { m.state = WINDUP; m.t = p.windup[phase]!; }
      else if (m.toss <= 0) { m.state = THROW; m.t = p.tossTime; }
      return;
    }
    self.vx = 0;
    self.vy = 0;
    if (m.state === WINDUP) {
      if (m.t > 0) return;
      ring();
      m.left = phase === 2 ? 1 : 0;
      m.state = SLAM;
      m.t = p.recover;
    } else if (m.state === SLAM) {
      if (m.left > 0 && m.t <= p.recover - p.secondRing) { ring(); m.left = 0; }
      if (m.t > 0) return;
      m.slam = p.slam[phase]!;
      m.state = WALK;
    } else {
      if (m.t > 0) return;
      const n = p.pieces[phase]!, aim = Math.atan2(api.player.y - self.y, api.player.x - self.x), spread = (p.spreadDeg * Math.PI) / 180;
      for (let k = 0; k < n; k++) api.shoot(self, aim + (n === 1 ? 0 : (k / (n - 1) - 0.5) * spread), p.pieceSpeed, { radius: 4, range: p.pieceRange });
      m.toss = p.toss[phase]!;
      m.state = WALK;
    }
  },
});
