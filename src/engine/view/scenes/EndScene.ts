import Phaser from 'phaser';
import { Run } from '../../sim/Run';
import { FONT_SIZE, text, uiScale } from '../font';

// Game over o victoria. Cualquier tecla o toque vuelve a la elección de agente.
export class EndScene extends Phaser.Scene {
  constructor() {
    super('End');
  }

  create(data: { run: Run; result: 'victory' | 'defeat' }): void {
    const { run, result } = data;
    this.cameras.main.setBackgroundColor('#12101c');
    const cx = Math.floor(this.scale.width / 2);
    const cy = Math.floor(this.scale.height / 2);

    const title = result === 'victory' ? '¡Victoria!' : 'Has caído';
    const detail = result === 'victory'
      ? `${run.totalWaves} oleadas superadas`
      : `en la oleada ${run.waveNumber} de ${run.totalWaves}`;
    const u = uiScale();
    const line = FONT_SIZE * u;
    const maxWidth = this.scale.width - 8 * u; // en pantallas estrechas el texto se parte en líneas
    const lines = [
      text(this, cx, cy - line * 3, title, u * 2).setTint(result === 'victory' ? 0xf0b951 : 0xff4d5e),
      text(this, cx, cy, `${run.character.name} · ${detail}`, u),
      text(this, cx, cy + line * 2, 'pulsa una tecla o toca para volver', u).setAlpha(0.7),
    ];
    for (const t of lines) t.setMaxWidth(maxWidth).setCenterAlign().setOrigin(0.5, 0);

    // Medio segundo de gracia: que una tecla pulsada al morir no salte la pantalla
    this.time.delayedCall(500, () => {
      const again = () => this.scene.start('Select', { registry: run.registry, level: run.level });
      this.input.keyboard?.once('keydown', again);
      this.input.once('pointerdown', again);
    });
  }
}
