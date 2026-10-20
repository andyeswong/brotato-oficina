import Phaser from 'phaser';

const JOYSTICK_RADIUS = 24; // píxeles lógicos

// Teclado (WASD y flechas) y joystick táctil flotante → un solo vector de movimiento de largo ≤ 1
export class MoveInput {
  private readonly keys: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key[]>;
  private origin: Phaser.Math.Vector2 | null = null;
  private readonly touch = new Phaser.Math.Vector2();
  private readonly gfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      up: [kb.addKey(K.W), kb.addKey(K.UP)],
      down: [kb.addKey(K.S), kb.addKey(K.DOWN)],
      left: [kb.addKey(K.A), kb.addKey(K.LEFT)],
      right: [kb.addKey(K.D), kb.addKey(K.RIGHT)],
    };

    this.gfx = scene.add.graphics().setScrollFactor(0).setDepth(1000);
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.origin = new Phaser.Math.Vector2(Math.round(p.x), Math.round(p.y));
      this.touch.set(0, 0);
    });
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.origin || !p.isDown) return;
      this.touch.set(p.x - this.origin.x, p.y - this.origin.y);
      if (this.touch.length() > JOYSTICK_RADIUS) this.touch.setLength(JOYSTICK_RADIUS);
    });
    const release = () => {
      this.origin = null;
      this.touch.set(0, 0);
    };
    scene.input.on('pointerup', release);
    scene.input.on('pointerupoutside', release);
  }

  read(out: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    const down = (list: Phaser.Input.Keyboard.Key[]) => list.some((k) => k.isDown);
    out.set(
      (down(this.keys.right) ? 1 : 0) - (down(this.keys.left) ? 1 : 0),
      (down(this.keys.down) ? 1 : 0) - (down(this.keys.up) ? 1 : 0),
    );
    if (out.lengthSq() > 0) return out.normalize(); // la diagonal no va más rápida
    if (this.origin) out.set(this.touch.x / JOYSTICK_RADIUS, this.touch.y / JOYSTICK_RADIUS);
    return out;
  }

  draw(): void {
    this.gfx.clear();
    if (!this.origin) return;
    this.gfx.lineStyle(1, 0xffffff, 0.35).strokeCircle(this.origin.x, this.origin.y, JOYSTICK_RADIUS);
    this.gfx.fillStyle(0xffffff, 0.5).fillCircle(Math.round(this.origin.x + this.touch.x), Math.round(this.origin.y + this.touch.y), 6);
  }
}
