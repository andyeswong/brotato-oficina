import type Phaser from 'phaser';
import type { Sprites } from '../registry/schemas';

export function textureKey(kind: string, id: string): string {
  return `${kind}:${id}`;
}

export function animKey(kind: string, id: string, anim: string): string {
  return `${kind}:${id}:${anim}`;
}

// Las hojas de claude-pxl se cargan tal cual: imagen + JSON estilo TexturePacker
export function loadSheet(scene: Phaser.Scene, key: string, sprites: Sprites): void {
  scene.load.atlas(key, sprites.image, sprites.atlas);
}

// frameTags de la hoja → animaciones de Phaser, respetando la duración de cada frame
export function createAnims(scene: Phaser.Scene, key: string, sprites: Sprites, kind: string, id: string): void {
  const frameNames = Object.keys(sprites.atlas.frames);
  const tags = new Map(sprites.atlas.meta.frameTags.map((t) => [t.name, t]));

  for (const [anim, tagName] of Object.entries(sprites.anims)) {
    const tag = tags.get(tagName)!; // el validador ya garantizó que existe
    const frames = frameNames.slice(tag.from, tag.to + 1).map((frame) => ({
      key,
      frame,
      duration: sprites.atlas.frames[frame]?.duration ?? 100,
    }));
    if (tag.direction === 'reverse') frames.reverse();
    // No sirve anims.createFromAseprite: busca los frames por índice ("0", "1"…) y pxl los nombra ("maia32_0").
    // En Phaser 3.90 la duración de cada frame sustituye a msPerFrame, así que se respeta la de la hoja.
    scene.anims.create({
      key: animKey(kind, id, anim),
      frames,
      duration: frames.reduce((sum, f) => sum + f.duration, 0),
      repeat: -1,
      yoyo: tag.direction === 'pingpong',
    });
  }
}

// Nombre del frame n de una animación (para pintar estáticos: losetas, iconos)
export function frameOf(sprites: Sprites, anim: string, n = 0): string {
  const tag = sprites.atlas.meta.frameTags.find((t) => t.name === sprites.anims[anim]);
  return Object.keys(sprites.atlas.frames)[(tag?.from ?? 0) + n]!;
}
