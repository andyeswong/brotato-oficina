import { describe, expect, it } from 'vitest';
import { discoverContent } from '../src/engine/registry/discover';
import { validateContent } from '../src/engine/registry/validate';
import { Run } from '../src/engine/sim/Run';
import { armorFactor } from '../src/engine/sim/World';

const { registry } = validateContent(discoverContent());
const maia = registry.character('maia');
const oficina = registry.level('oficina');
const STILL = { x: 0, y: 0 };

function simulate(run: Run, seconds: number) {
  const world = run.world ?? run.startWave();
  for (let t = 0; t < seconds && world.status === 'playing'; t += 1 / 60) world.step(1 / 60, STILL);
  return world;
}

describe('World', () => {
  it('quedarse quieto en la oleada 1 mata a MAIA antes de que acabe', () => {
    const run = new Run(registry, maia, oficina, 42);
    const world = simulate(run, 20);
    expect(world.status).toBe('dead');
    expect(world.player.hp).toBe(0);
  });

  it('la misma semilla da la misma partida', () => {
    const a = simulate(new Run(registry, maia, oficina, 7), 8);
    const b = simulate(new Run(registry, maia, oficina, 7), 8);
    expect(a.enemies.map((e) => [e.x, e.y])).toEqual(b.enemies.map((e) => [e.x, e.y]));
  });

  it('cada enemigo sale tras un aviso de 1 s', () => {
    const run = new Run(registry, maia, oficina, 1);
    const world = run.startWave();
    world.step(1 / 60, STILL);
    expect(world.telegraphs.length).toBeGreaterThan(0);
    expect(world.enemies.length).toBe(0);
    simulate(run, 1.05);
    expect(world.enemies.length).toBeGreaterThan(0);
  });

  it('el pasivo de MAIA baja su velocidad un 10 %', () => {
    const run = new Run(registry, maia, oficina, 1);
    expect(run.stats.get('speed-pct')).toBe(-10);
  });

  it('armadura: 15 de armadura deja el golpe a la mitad; la negativa lo sube', () => {
    expect(armorFactor(0)).toBe(1);
    expect(armorFactor(15)).toBe(0.5);
    expect(armorFactor(-15)).toBe(2);
  });
});

describe('Run', () => {
  it('superar la última oleada es victoria', () => {
    const run = new Run(registry, maia, oficina, 1);
    run.waveIndex = run.totalWaves - 1;
    expect(run.finishWave()).toBe('victory');
  });

  it('un hook que revienta se desactiva y avisa con el módulo que lo causó, una sola vez', () => {
    const broken = { ...maia, hooks: { onWaveStart: () => { throw new Error('boom'); } } };
    const run = new Run(registry, broken, oficina, 1);
    const errors: string[] = [];
    run.onHookError = (m) => errors.push(m);
    run.startWave();
    run.startWave();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('character:maia');
    expect(errors[0]).toContain('boom');
  });
});
