import { generateLayout } from '../../escenario-motor/src/engine/worldgen';
import { THEMES } from '../../escenario-motor/demo/src/themes';
import { buildWorld } from '../src/world/build';
for (const t of ['medieval', 'cyberpunk', 'oficina'] as const) {
  const l = generateLayout(THEMES[t].spec, 7);
  const w = buildWorld(l, t);
  console.log(t, 'fuente', w.fountain && [w.fountain.x, w.fountain.y], 'salida', [l.spawn.x, l.spawn.y]);
}
