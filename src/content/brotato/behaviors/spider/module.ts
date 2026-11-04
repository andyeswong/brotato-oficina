import { defineEnemyBehavior, steerTowards, z } from '../../../../game/brotato/api';

const RUN = 0;
const WEAVE = 1;
const CALL = 2;

// La araña (MAIA, 2026-11-04): rápida, no embiste. Corre rodeando a MAIA, para a dejar zonas que la frenan y a llamar
// crías, cada vez más seguido según pierde vida. Sin azar: la órbita gira un ángulo fijo. mem.state es para la vista
export default defineEnemyBehavior({
  format: 1,
  id: 'spider',
  name: 'Araña',
  params: z.strictObject({
    orbit: z.number().min(0).default(46),               // a qué distancia de MAIA corre
    turn: z.number().positive().default(1.2),           // cada cuánto cambia de punto en la órbita
    weave: z.tuple([z.number().positive(), z.number().positive(), z.number().positive()]).default([4, 3, 2.2]),
    weaveTime: z.number().positive().default(0.45),
    zoneRadius: z.number().positive().default(26),
    zoneLife: z.number().positive().default(7),
    zoneSlow: z.number().positive().max(1).default(0.55),
    call: z.tuple([z.number().positive(), z.number().positive(), z.number().positive()]).default([10, 7, 5]),
    callTime: z.number().positive().default(0.7),
    summon: z.string().default('cria'),
    summonCount: z.number().int().min(0).default(3),
    phase2: z.number().min(0).max(1).default(0.66),
    phase3: z.number().min(0).max(1).default(0.33),
  }),
  update(self, dt, api, p) {
    const m = self.mem;
    m.state ??= RUN;
    m.t ??= 0;
    m.a ??= 0;
    m.turn ??= 0;
    m.weave ??= p.weave[0];
    m.call ??= p.call[0];
    m.t -= dt;
    const f = self.hp / self.maxHp;
    const phase = f > p.phase2 ? 0 : f > p.phase3 ? 1 : 2;
    m.phase = phase;
    self.push = 0;
    self.smash = false;

    if (m.state === RUN) {
      m.weave -= dt;
      m.call -= dt;
      m.turn -= dt;
      if (m.turn <= 0) { m.a += 2.4; m.turn = p.turn; }
      steerTowards(self, { x: api.player.x + Math.cos(m.a) * p.orbit, y: api.player.y + Math.sin(m.a) * p.orbit }, self.speed);
      if (m.call <= 0 && p.summonCount > 0) { m.state = CALL; m.t = p.callTime; }
      else if (m.weave <= 0) { m.state = WEAVE; m.t = p.weaveTime; }
    } else {
      self.vx = 0;
      self.vy = 0;
      if (m.t > 0) return;
      if (m.state === WEAVE) {
        api.zone(self, { radius: p.zoneRadius, life: p.zoneLife, slow: p.zoneSlow });
        m.weave = p.weave[phase]!;
      } else {
        api.summon(self, p.summon, p.summonCount);
        m.call = p.call[phase]!;
      }
      m.state = RUN;
    }
  },
});
