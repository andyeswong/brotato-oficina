import Phaser from 'phaser';
import { setDebug } from '@engine/view/overlay';
import { currentLayout, watchLayout } from '@engine/view/pixel';
import { ArenaScene } from '@engine/view/scenes/ArenaScene';
import { BootScene } from '@engine/view/scenes/BootScene';
import { EndScene } from '@engine/view/scenes/EndScene';

const first = currentLayout();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: first.width,
  height: first.height,
  backgroundColor: '#000000',
  pixelArt: true,     // texturas NEAREST, sin antialias
  roundPixels: true,
  scale: { mode: Phaser.Scale.NONE, autoRound: false },
  scene: [BootScene, ArenaScene, EndScene],
});

// Etiqueta de depuración (F2 la oculta): sirve para verificar el escalado en cada pantalla
let debug = !new URLSearchParams(location.search).has('nodebug');
game.events.once(Phaser.Core.Events.READY, () => watchLayout(game, (l) => {
  if (debug) setDebug(`s=${l.scale} · ${l.width}×${l.height} lógicos · dpr ${window.devicePixelRatio} · `
    + `${Math.floor(window.innerWidth * window.devicePixelRatio)}×${Math.floor(window.innerHeight * window.devicePixelRatio)} físicos`);
}));
window.addEventListener('keydown', (e) => {
  if (e.key !== 'F2') return;
  debug = !debug;
  if (!debug) setDebug(null);
  else window.dispatchEvent(new Event('resize'));
});
