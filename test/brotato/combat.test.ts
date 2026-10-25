import { vi, describe, expect, it } from 'vitest';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { Run } from '../../src/game/brotato/sim/Run';
import { weaponStats } from '../../src/game/brotato/sim/World';

// Cada partida construye su mundo de vóxeles (~250 ms): los ficheros que crean muchas pasan de los 5 s por defecto
vi.setConfig({ testTimeout: 60_000 });

const { registry } = validateContent(discoverContent());
const maia = registry.character('maia');
const oficina = registry.level('oficina');
const STILL = { x: 0, y: 0 };

// Vida de sobra: estas pruebas miden armas y enemigos, no la muerte
function immortal(world: { player: { hp: number; maxHp: number } }) {
  world.player.maxHp = world.player.hp = 1e9;
}

describe('armas', () => {
  it('el Buzón mata enemigos y, al acabar la oleada, sus materiales son de MAIA', () => {
    const run = new Run(registry, maia, oficina, 11);
    const world = run.startWave();
    immortal(world);
    for (let t = 0; t < 25 && world.status === 'playing'; t += 1 / 60) world.step(1 / 60, STILL);
    expect(world.status).toBe('cleared');
    expect(run.kills).toBeGreaterThan(0);
    expect(run.materials).toBeGreaterThanOrEqual(run.kills); // cada bicho-grapa suelta 1
  });

  it('caminar hacia un material lo atrae y lo recoge', () => {
    const run = new Run(registry, maia, oficina, 4, { weapons: [] });
    const world = run.startWave();
    immortal(world);
    world.dropMaterials({ x: world.player.x + 20, y: world.player.y - 10 }, 1);
    for (let t = 0; t < 1; t += 1 / 60) world.step(1 / 60, STILL);
    expect(world.materials).toHaveLength(0);
    expect(run.materials).toBe(1);
  });

  it('al acabar la oleada, lo que quedó en el suelo se recoge solo', () => {
    const run = new Run(registry, maia, oficina, 5);
    const world = run.startWave();
    world.dropMaterials({ x: 10, y: 10 }, 5); // lejos, fuera del radio de recolección
    world.time = world.duration - 1 / 60;
    world.step(1 / 60, STILL);
    expect(world.status).toBe('cleared');
    expect(run.materials).toBeGreaterThanOrEqual(5);
  });

  it('pasivo de MAIA: +5 % de daño por cada arma distinta', () => {
    const two = new Run(registry, maia, oficina, 1, { weapons: ['buzon', 'grapadora'] });
    const same = new Run(registry, maia, oficina, 1, { weapons: ['buzon', 'buzon'] });
    expect(two.stats.get('damage-pct')).toBe(10);
    expect(same.stats.get('damage-pct')).toBe(5);
  });

  it('desventaja de MAIA: la Regla (cuerpo a cuerpo) hace la mitad, el Buzón no', () => {
    const run = new Run(registry, maia, oficina, 1, { weapons: ['regla'] });
    const read = (id: string, tags?: readonly string[]) => run.stats.get(id, tags);
    const regla = weaponStats(registry.weapon('regla'), 0, read);
    const buzon = weaponStats(registry.weapon('buzon'), 0, read);
    // regla: 8 × (1 + (5 − 50)/100) = 4,4 → 4 ; buzón: 6 × 1,05 = 6,3 → 6
    expect(regla.damage).toBe(4);
    expect(buzon.damage).toBe(6);
    // y el alcance de MAIA (+19) se suma a las dos
    expect(buzon.range).toBe(128 + 19);
  });
});

describe('bicho-taza', () => {
  it('dispara proyectiles que pueden herir a MAIA', () => {
    const run = new Run(registry, maia, oficina, 2, { weapons: [] });
    run.waveIndex = 3; // la oleada 4 ya trae bichos taza
    const world = run.startWave();
    immortal(world);
    let enemyShots = 0;
    for (let t = 0; t < 20 && world.status === 'playing'; t += 1 / 60) {
      world.step(1 / 60, STILL);
      enemyShots = Math.max(enemyShots, world.projectiles.filter((p) => p.owner === 'enemy').length);
    }
    expect(enemyShots).toBeGreaterThan(0);
  });
});

describe('vida', async () => {
  const { regenInterval } = await import('../../src/game/brotato/sim/World');
  it('regeneración al estilo de Brotato', () => {
    expect(regenInterval(0)).toBe(Infinity);
    expect(regenInterval(1)).toBe(5);
    expect(regenInterval(3.25)).toBeCloseTo(2.5);
  });

  it('con regeneración, MAIA herida se cura sola', () => {
    const run = new Run(registry, maia, oficina, 1, { weapons: [] });
    run.stats.setSource('test', [{ stat: 'hp-regen', add: 1 }]);
    const world = run.startWave();
    world.player.hp = 5;
    for (let t = 0; t < 5.05; t += 1 / 60) world.step(1 / 60, { x: 0, y: 0 });
    expect(world.player.hp).toBeGreaterThanOrEqual(6);
  });
});
