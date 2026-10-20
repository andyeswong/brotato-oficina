import { describe, expect, it } from 'vitest';
import type { CharacterModule } from '../src/engine/registry/schemas';
import { resolveBody } from '../src/engine/sim/body';

const character = (cell: number, body?: CharacterModule['body']): CharacterModule => ({
  format: 1, kind: 'character', id: 'x', name: 'X', body,
  sprites: {
    image: 'x.png',
    anims: { idle: 'x_idle', walk: 'x_idle' },
    atlas: {
      frames: { x_idle_0: { frame: { x: 0, y: 0, w: cell, h: cell } } },
      meta: { image: 'x.png', frameTags: [{ name: 'x_idle', from: 0, to: 0 }] },
    },
  },
});

describe('resolveBody: el motor no asume celdas de 32', () => {
  it('32×32', () => {
    expect(resolveBody(character(32))).toMatchObject({ radius: 6, centerY: 10, speed: 90, cellH: 32 });
  });

  it('64×64 escala todo con la celda', () => {
    expect(resolveBody(character(64))).toMatchObject({ radius: 13, centerY: 19, speed: 179, cellH: 64 });
  });

  it('lo que declare el personaje manda', () => {
    expect(resolveBody(character(64, { radius: 10, speed: 150 }))).toMatchObject({ radius: 10, centerY: 19, speed: 150 });
  });
});
