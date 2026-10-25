// VISTA (NARUTO): el cuadro del modo 2D compuesto en la GPU con WebGL2. Hace lo mismo que frame2D (CPU), que es su
// oráculo: la CPU sigue haciendo la simulación, el horneado, el render de cada entidad (con caché) y su luz; aquí
// se hace por píxel lo que costaba por píxel en la CPU: juntar la imagen horneada con la luz (horneada, dinámica y
// las sombras de las entidades), pintar las entidades, el agua y las gotas, y pasar la luz a pixel art.
//
// Lo que sube a la GPU:
//   - una vez por horneado: la imagen (color, profundidad, cara) y los pesos de las luces fijas;
//   - al rehornear: solo los recuadros publicados (Baked.published) y los pesos de las luces que cambian;
//   - cada cuadro: la profundidad del agua de las columnas visibles, las gotas proyectadas, la luz de cada entidad
//     y los uniforms de las luces.
import { DIR_VECTORS, unkey } from '../../core';
import { resolveLight } from '../../world/lightutil';
import { entityDraw, occupancy, screenBox, dropLook, SHADOW_REACH, EW, EH, BACKGROUND, type Frame2DOptions } from '../../world/frame2d';
import { worldPointAt, type Baked, type BakedLight } from '../../world/bake';
import type { WorldState } from '../../world/state';
import type { Rendered } from '../../core';
import { FRAG_DROPS, FRAG_SCENE, FRAG_SHADE, FRAG_WATER, MAX_BAKED, MAX_ENTS, MAX_LIGHTS, VERT_DROPS, VERT_FULLSCREEN } from './shaders';

export type GpuOutput = 'frame' | 'color' | 'multiply' | 'add';

interface Target { fbo: WebGLFramebuffer; color: WebGLTexture; light: WebGLTexture; depth: WebGLTexture; dropsFbo: WebGLFramebuffer }
// Por nombre; la Proxy devuelve null para los que el compilador del shader quitó (WebGL ignora un uniform null)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Uniforms = Record<string, any>;
interface Program { prog: WebGLProgram; u: Uniforms }

export class GpuCompositor {
  private readonly gl: WebGL2RenderingContext;
  private readonly scene: Program;
  private readonly water: Program;
  private readonly drops: Program;
  private readonly shade: Program;
  private readonly vao: WebGLVertexArrayObject;
  private readonly dropsVao: WebGLVertexArrayObject;
  private readonly dropsBuf: WebGLBuffer;
  private dropsData = new Float32Array(0);
  // ms del último cuadro en preparar y subir (horneado, pesos, entidades con su luz, agua y gotas): lo que la ruta de
  // la GPU sigue gastando en el hilo principal
  uploadMs = 0;

  // Lo subido del horneado
  private baked: Baked | null = null;
  private bakedSerial = 0;
  private tColor: WebGLTexture | null = null;
  private tDepth: WebGLTexture | null = null;
  private tFace: WebGLTexture | null = null;
  private tWorldY: WebGLTexture | null = null;
  private worldY = new Float32Array(0);
  private tWeights: WebGLTexture | null = null;
  private weightZones: BakedLight[] = [];
  // Entidades: lienzos (color y profundidad: cambian con el giro), su luz (cada cuadro) y sus cuerpos para sombras
  private tEntColor: WebGLTexture;
  private tEntDepth: WebGLTexture;
  private tEntLight: WebGLTexture;
  private entImgs: Array<Rendered | null> = new Array(MAX_ENTS).fill(null);
  private tOcc: WebGLTexture;
  private tLights: WebGLTexture;
  private lightTab = new Float32Array(3 * MAX_LIGHTS * 4);
  private occKey = '';
  private occPlace: Array<{ min: [number, number, number]; size: [number, number, number]; ax: number }> = [];
  // Agua
  private tWDepth: WebGLTexture | null = null;
  private tWStatic: WebGLTexture | null = null;
  private waterOf: unknown = null;
  // Destinos de la vista
  private targets: [Target, Target] | null = null;
  private out: { fbo: WebGLFramebuffer; tex: WebGLTexture } | null = null;
  private size = [0, 0];

  static create(canvas: HTMLCanvasElement | OffscreenCanvas): GpuCompositor | null {
    const gl = canvas.getContext('webgl2', { antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false }) as WebGL2RenderingContext | null;
    if (!gl) return null;
    // La luz y la profundidad se guardan en texturas de coma flotante en las que se pinta
    if (!gl.getExtension('EXT_color_buffer_float')) return null;
    try { return new GpuCompositor(gl); } catch (e) { console.warn('[voxpix] compositor GPU: no arranca', e); return null; }
  }

  private constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.scene = program(gl, VERT_FULLSCREEN, FRAG_SCENE);
    this.water = program(gl, VERT_FULLSCREEN, FRAG_WATER);
    this.drops = program(gl, VERT_DROPS, FRAG_DROPS);
    this.shade = program(gl, VERT_FULLSCREEN, FRAG_SHADE);
    this.vao = gl.createVertexArray()!;
    this.dropsVao = gl.createVertexArray()!;
    this.dropsBuf = gl.createBuffer()!;
    gl.bindVertexArray(this.dropsVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.dropsBuf);
    const loc = gl.getAttribLocation(this.drops.prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    this.tEntColor = texArray(gl, gl.RGBA8, EW, EH, MAX_ENTS);
    this.tEntDepth = texArray(gl, gl.R32F, EW, EH, MAX_ENTS);
    this.tEntLight = texArray(gl, gl.RGB32F, EW, EH, MAX_ENTS);
    this.tLights = tex2D(gl, gl.RGBA32F, 3, MAX_LIGHTS, gl.RGBA, gl.FLOAT, null);
    this.tOcc = gl.createTexture()!;
    uploadTo(gl, gl.TEXTURE_3D, this.tOcc);
    nearest(gl, gl.TEXTURE_3D);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8, 1, 1, 1, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array(1));
  }

  // Pinta el cuadro en el lienzo
  frame(state: WorldState, b: Baked, o: Frame2DOptions): void {
    this.compose(state, b, o);
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.present(o, 0, true);
  }

  // Para la prueba del oráculo: una salida del cuadro en RGBA, fila 0 arriba (como frame2D)
  read(state: WorldState, b: Baked, o: Frame2DOptions, what: GpuOutput = 'frame'): Uint8Array {
    const gl = this.gl;
    this.compose(state, b, o);
    if (!this.out) {
      const tex = gl.createTexture()!;
      const fbo = gl.createFramebuffer()!;
      this.out = { tex, fbo };
    }
    uploadTo(gl, gl.TEXTURE_2D, this.out.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, o.vw, o.vh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.out.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.out.tex, 0);
    this.present(o, { frame: 0, color: 1, multiply: 2, add: 3 }[what], false);
    const px = new Uint8Array(o.vw * o.vh * 4);
    gl.readPixels(0, 0, o.vw, o.vh, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return px;
  }

  // ---- los pasos

  private compose(state: WorldState, b: Baked, o: Frame2DOptions): void {
    const gl = this.gl;
    let up = performance.now();
    this.syncBaked(b);
    this.syncWeights(b);
    let upMs = performance.now() - up;
    const [A, B] = this.ensureTargets(o.vw, o.vh);
    gl.viewport(0, 0, o.vw, o.vh);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.vao);

    // Las luces del mundo de este cuadro (las mismas para la escena, las sombras y el agua)
    const lights = state.lights.slice(0, MAX_LIGHTS).map((l) => ({ l, p: resolveLight(l, o.time) }));
    if (state.lights.length > MAX_LIGHTS) warnOnce(`más de ${MAX_LIGHTS} luces: la GPU usa las primeras`);
    const layerOf = new Map(b.lights.map((bl, i) => [bl.light.id, i] as const));

    // 1) la escena
    const s = this.scene;
    gl.useProgram(s.prog);
    gl.bindFramebuffer(gl.FRAMEBUFFER, A.fbo);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2]);
    bindTex(gl, 0, gl.TEXTURE_2D, this.tColor, s.u.uColor);
    bindTex(gl, 1, gl.TEXTURE_2D, this.tDepth, s.u.uDepth);
    bindTex(gl, 2, gl.TEXTURE_2D, this.tFace, s.u.uFace);
    bindTex(gl, 3, gl.TEXTURE_2D_ARRAY, this.tWeights, s.u.uWeights);
    bindTex(gl, 4, gl.TEXTURE_2D_ARRAY, this.tEntColor, s.u.uEntColor);
    bindTex(gl, 5, gl.TEXTURE_2D_ARRAY, this.tEntDepth, s.u.uEntDepth);
    bindTex(gl, 6, gl.TEXTURE_2D_ARRAY, this.tEntLight, s.u.uEntLight);
    bindTex(gl, 7, gl.TEXTURE_3D, this.tOcc, s.u.uOcc);
    bindTex(gl, 9, gl.TEXTURE_2D, this.tWorldY, s.u.uWorldY);
    const a = b.options.oblique?.y ?? 1;
    gl.uniform2i(s.u.uView, o.vx, o.vy);
    const bg = o.background ?? BACKGROUND;
    gl.uniform3f(s.u.uBg, bg[0] / 255, bg[1] / 255, bg[2] / 255);
    gl.uniform3f(s.u.uAmbient, o.ambient[0], o.ambient[1], o.ambient[2]);
    gl.uniform1i(s.u.uLights, o.lights ? 1 : 0);
    gl.uniform1f(s.u.uA, a);
    gl.uniform1f(s.u.uOriginY, b.options.originY ?? 0);
    gl.uniform1f(s.u.uF1, b.cam.fwd[1]);
    gl.uniform1f(s.u.uF2, b.cam.fwd[2]);
    gl.uniform3fv(s.u.uDirs, DIR_VECTORS.flat());
    // Luces horneadas (lightView)
    const nb = Math.min(MAX_BAKED, b.lights.length);
    const rect = new Int32Array(MAX_BAKED * 4), ck = new Float32Array(MAX_BAKED * 3);
    for (let i = 0; i < nb; i++) {
      const bl = b.lights[i]!;
      const k = resolveLight(bl.light, o.time).intensity / bl.intensity;
      rect.set([bl.rect.x, bl.rect.y, bl.rect.w, bl.rect.h], i * 4);
      ck.set([bl.color[0] * k, bl.color[1] * k, bl.color[2] * k], i * 3);
    }
    gl.uniform1i(s.u.uNBaked, nb);
    gl.uniform4iv(s.u.uBakedRect, rect);
    gl.uniform3fv(s.u.uBakedColorK, ck);
    // Luces del mundo: la tabla (posición y radio; color e intensidad; capa horneada, k, dinámica)
    const tab = this.lightTab;
    tab.fill(0);
    lights.forEach(({ l, p }, i) => {
      const layer = layerOf.get(l.id);
      const baked = layer !== undefined && layer < nb;
      tab.set([l.x, l.y, l.z, p.radius], (i * 3) * 4);
      tab.set([p.color[0], p.color[1], p.color[2], p.intensity], (i * 3 + 1) * 4);
      tab.set([baked ? layer : -1, baked ? p.intensity / b.lights[layer]!.intensity : 0, l.baked === false ? 1 : 0, 0], (i * 3 + 2) * 4);
    });
    uploadTo(gl, gl.TEXTURE_2D, this.tLights);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 3, MAX_LIGHTS, gl.RGBA, gl.FLOAT, tab);
    gl.uniform1i(s.u.uNLights, lights.length);
    bindTex(gl, 8, gl.TEXTURE_2D, this.tLights, s.u.uLightTab);
    up = performance.now();
    this.setEntities(state, b, o, lights.map((x) => x.l));
    upMs += performance.now() - up;
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 2) el agua
    const w = this.water;
    gl.useProgram(w.prog);
    gl.bindFramebuffer(gl.FRAMEBUFFER, B.fbo);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2]);
    bindTex(gl, 0, gl.TEXTURE_2D, A.color, w.u.uSrcColor);
    bindTex(gl, 1, gl.TEXTURE_2D, A.light, w.u.uSrcLight);
    bindTex(gl, 2, gl.TEXTURE_2D, A.depth, w.u.uSrcDepth);
    up = performance.now();
    const hasWater = this.syncWater(state, b, o);
    upMs += performance.now() - up;
    bindTex(gl, 3, gl.TEXTURE_2D, this.tWDepth, w.u.uWDepth);
    bindTex(gl, 4, gl.TEXTURE_2D, this.tWStatic, w.u.uWStatic);
    gl.uniform1i(w.u.uHasWater, hasWater ? 1 : 0);
    gl.uniform1i(w.u.uLights, o.lights ? 1 : 0);
    gl.uniform2i(w.u.uView, o.vx, o.vy);
    gl.uniform2i(w.u.uViewSize, o.vw, o.vh);
    gl.uniform3f(w.u.uAmbient, o.ambient[0], o.ambient[1], o.ambient[2]);
    gl.uniform1i(w.u.uNLights, lights.length);
    bindTex(gl, 5, gl.TEXTURE_2D, this.tLights, w.u.uLightTab);
    if (hasWater) {
      const wl = state.water!;
      const f1 = b.cam.fwd[1], f2 = b.cam.fwd[2];
      const originY = b.options.originY ?? 0;
      const vlen = Math.hypot(f1, f2);
      const CELL = 2;
      const yOf = (sy: number, z: number) => (originY - sy - z) / a;
      const gx0 = Math.max(0, Math.floor(o.vx / CELL) - 1), gx1 = Math.min(wl.gw - 1, Math.ceil((o.vx + o.vw) / CELL) + 1);
      const gy0 = Math.max(0, Math.floor(yOf(o.vy + o.vh, -12) / CELL) - 2), gy1 = Math.min(wl.gh - 1, Math.ceil(yOf(o.vy, 12) / CELL) + 2);
      gl.uniform2i(w.u.uGrid, wl.gw, wl.gh);
      gl.uniform4i(w.u.uCells, gx0, gx1, gy0, gy1);
      gl.uniform1f(w.u.uA, a);
      gl.uniform1f(w.u.uOriginY, originY);
      gl.uniform1f(w.u.uF1, f1);
      gl.uniform1f(w.u.uF2, f2);
      gl.uniform1f(w.u.uVy, -f1 / vlen);
      gl.uniform1f(w.u.uVz, -f2 / vlen);
      gl.uniform1f(w.u.uTPerPx, 1 / (a * f1 - f2));
      gl.uniform1f(w.u.uDPerT, f1 * f1 - f2 * f2);
      gl.uniform3fv(w.u.uTones, this.waterTones(state));
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 3) las gotas, sobre lo que dejó el agua
    const drop = dropLook(state, o.ambient);
    up = performance.now();
    const n = drop ? this.projectDrops(state, b, o) : 0;
    this.uploadMs = upMs + performance.now() - up;
    if (n && drop) {
      const d = this.drops;
      gl.useProgram(d.prog);
      gl.bindFramebuffer(gl.FRAMEBUFFER, B.dropsFbo);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
      bindTex(gl, 0, gl.TEXTURE_2D, B.depth, d.u.uDepthNow);
      gl.uniform2f(d.u.uViewSize, o.vw, o.vh);
      gl.uniform3f(d.u.uDropColor, drop.color[0] / 255, drop.color[1] / 255, drop.color[2] / 255);
      gl.uniform3f(d.u.uDropLight, drop.light[0], drop.light[1], drop.light[2]);
      gl.bindVertexArray(this.dropsVao);
      gl.drawArrays(gl.POINTS, 0, n);
      gl.bindVertexArray(this.vao);
    }
  }

  // 4) la luz a pixel art, al lienzo (dando la vuelta) o a una textura (fila 0 arriba)
  private present(o: Frame2DOptions, mode: number, flip: boolean): void {
    const gl = this.gl;
    const B = this.targets![1];
    const p = this.shade;
    gl.viewport(0, 0, o.vw, o.vh);
    gl.useProgram(p.prog);
    gl.drawBuffers([flip ? gl.BACK : gl.COLOR_ATTACHMENT0]);
    bindTex(gl, 0, gl.TEXTURE_2D, B.color, p.u.uColorTex);
    bindTex(gl, 1, gl.TEXTURE_2D, B.light, p.u.uLightTex);
    gl.uniform1i(p.u.uLights, o.lights ? 1 : 0);
    gl.uniform3f(p.u.uAmbient, o.ambient[0], o.ambient[1], o.ambient[2]);
    gl.uniform1i(p.u.uMode, mode);
    gl.uniform1i(p.u.uFlip, flip ? 1 : 0);
    gl.uniform1i(p.u.uHeight, o.vh);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // ---- lo que se sube

  private syncBaked(b: Baked): void {
    const gl = this.gl;
    const pub = b.published;
    if (this.baked !== b || !this.tColor) {
      this.baked = b;
      for (const t of [this.tColor, this.tDepth, this.tFace, this.tWorldY]) if (t) gl.deleteTexture(t);
      this.tColor = tex2D(gl, gl.RGBA8, b.width, b.height, gl.RGBA, gl.UNSIGNED_BYTE, b.rgba);
      this.tDepth = tex2D(gl, gl.R32F, b.width, b.height, gl.RED, gl.FLOAT, b.depth);
      this.tFace = tex2D(gl, gl.R8I, b.width, b.height, gl.RED_INTEGER, gl.BYTE, b.face);
      this.worldY = new Float32Array(b.width * b.height);
      fillWorldY(b, this.worldY, 0, 0, b.width - 1, b.height - 1);
      this.tWorldY = tex2D(gl, gl.R32F, b.width, b.height, gl.RED, gl.FLOAT, this.worldY);
      this.bakedSerial = pub.serial;
      this.weightZones = [];
      return;
    }
    if (pub.serial === this.bakedSerial) return;
    const oldest = pub.rects[0]?.serial ?? Infinity;
    if (oldest > this.bakedSerial + 1) {
      // Se quedó atrás: todo de nuevo
      subImage(gl, this.tColor, 0, 0, b.width, b.height, gl.RGBA, gl.UNSIGNED_BYTE, b.rgba, b.width, 4);
      subImage(gl, this.tDepth!, 0, 0, b.width, b.height, gl.RED, gl.FLOAT, b.depth, b.width, 1);
      subImage(gl, this.tFace!, 0, 0, b.width, b.height, gl.RED_INTEGER, gl.BYTE, b.face, b.width, 1);
      fillWorldY(b, this.worldY, 0, 0, b.width - 1, b.height - 1);
      subImage(gl, this.tWorldY!, 0, 0, b.width, b.height, gl.RED, gl.FLOAT, this.worldY, b.width, 1);
    } else for (const r of pub.rects) {
      if (r.serial <= this.bakedSerial) continue;
      const w = r.x1 - r.x0 + 1, h = r.y1 - r.y0 + 1;
      subImage(gl, this.tColor, r.x0, r.y0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, b.rgba, b.width, 4);
      subImage(gl, this.tDepth!, r.x0, r.y0, w, h, gl.RED, gl.FLOAT, b.depth, b.width, 1);
      subImage(gl, this.tFace!, r.x0, r.y0, w, h, gl.RED_INTEGER, gl.BYTE, b.face, b.width, 1);
      fillWorldY(b, this.worldY, r.x0, r.y0, r.x1, r.y1);
      subImage(gl, this.tWorldY!, r.x0, r.y0, w, h, gl.RED, gl.FLOAT, this.worldY, b.width, 1);
    }
    this.bakedSerial = pub.serial;
  }

  // Los pesos de las luces fijas: una capa por luz (en el orden de b.lights). Se rehacen cuando cambia alguna zona
  private syncWeights(b: Baked): void {
    const gl = this.gl;
    const zones = b.lights.slice(0, MAX_BAKED);
    if (b.lights.length > MAX_BAKED) warnOnce(`más de ${MAX_BAKED} luces horneadas: la GPU usa las primeras`);
    if (zones.length === this.weightZones.length && zones.every((z, i) => z === this.weightZones[i])) return;
    const W = Math.max(1, ...zones.map((z) => z.rect.w)), H = Math.max(1, ...zones.map((z) => z.rect.h));
    if (this.tWeights) gl.deleteTexture(this.tWeights);
    this.tWeights = texArray(gl, gl.R32F, W, H, Math.max(1, zones.length));
    zones.forEach((z, i) => gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, z.rect.w, z.rect.h, 1, gl.RED, gl.FLOAT, z.weight));
    this.weightZones = zones;
  }

  private setEntities(state: WorldState, b: Baked, o: Frame2DOptions, lights: WorldState['lights'][number][]): void {
    const gl = this.gl, u = this.scene.u;
    const ents = state.entities.slice(0, MAX_ENTS);
    if (state.entities.length > MAX_ENTS) warnOnce(`más de ${MAX_ENTS} entidades: la GPU pinta las primeras`);
    const place = new Int32Array(MAX_ENTS * 4), param = new Float32Array(MAX_ENTS * 4), box = new Int32Array(MAX_ENTS * 4);
    const pos = new Float32Array(MAX_ENTS * 3), omin = new Int32Array(MAX_ENTS * 4), osize = new Int32Array(MAX_ENTS * 3), near = new Uint32Array(MAX_ENTS);
    // Los cuerpos de las que dan sombra, en un atlas 3D (uno detrás de otro en x)
    const shadowers = ents.map((e) => (o.lights && e.castsShadow ? occupancy(e.model, e.yaw) : null));
    this.syncOcc(shadowers);
    ents.forEach((e, i) => {
      const d = entityDraw(state, b, e, o);
      if (this.entImgs[i] !== d.img) {
        this.entImgs[i] = d.img;
        uploadTo(gl, gl.TEXTURE_2D_ARRAY, this.tEntColor);
        gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, EW, EH, 1, gl.RGBA, gl.UNSIGNED_BYTE, d.img.rgba);
        uploadTo(gl, gl.TEXTURE_2D_ARRAY, this.tEntDepth);
        gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, EW, EH, 1, gl.RED, gl.FLOAT, d.img.depth);
      }
      if (d.etotal) {
        uploadTo(gl, gl.TEXTURE_2D_ARRAY, this.tEntLight);
        gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, EW, EH, 1, gl.RGB, gl.FLOAT, d.etotal);
      }
      place.set([d.offX, d.offY, d.fx, d.fy], i * 4);
      param.set([d.dOff, d.sry, d.etotal ? 1 : 0, shadowers[i] ? 1 : 0], i * 4);
      const ex = Math.round(e.x), ey = Math.round(e.y), ez = e.z;
      pos.set([ex, ey, ez], i * 3);
      const sb = shadowers[i] ? screenBox(b, ex, ey, ez, SHADOW_REACH, o) : null;
      box.set(sb ?? [1, 1, 0, 0], i * 4);
      const op = this.occPlace[i];
      if (op) { omin.set([op.min[0], op.min[1], op.min[2], op.ax], i * 4); osize.set(op.size, i * 3); }
      let mask = 0;
      lights.forEach((l, j) => { if (Math.hypot(l.x - ex, l.y - ey) < resolveLight(l, 0).radius + SHADOW_REACH) mask |= 1 << j; });
      near[i] = mask >>> 0;
    });
    gl.uniform1i(u.uNEnt, ents.length);
    gl.uniform4iv(u.uEntPlace, place);
    gl.uniform4fv(u.uEntParam, param);
    gl.uniform4iv(u.uEntBox, box);
    gl.uniform3fv(u.uEntPos, pos);
    gl.uniform4iv(u.uEntOccMin, omin);
    gl.uniform3iv(u.uEntOccSize, osize);
    gl.uniform1uiv(u.uEntNear, near);
  }

  private syncOcc(occs: Array<ReturnType<typeof occupancy> | null>): void {
    const gl = this.gl;
    const key = occs.map((o) => (o ? `${occId(o)}` : '-')).join(',');
    if (key === this.occKey) return;
    this.occKey = key;
    this.occPlace = [];
    let ax = 0, H = 1, D = 1;
    for (const o of occs) {
      if (!o) { this.occPlace.push({ min: [0, 0, 0], size: [0, 0, 0], ax: 0 }); continue; }
      const size: [number, number, number] = [o.max[0] - o.min[0], o.max[1] - o.min[1], o.max[2] - o.min[2]];
      this.occPlace.push({ min: o.min, size, ax });
      ax += size[0]; H = Math.max(H, size[1]); D = Math.max(D, size[2]);
    }
    const W = Math.max(1, ax);
    const data = new Uint8Array(W * H * D);
    occs.forEach((o, i) => {
      if (!o) return;
      const p = this.occPlace[i]!;
      for (const k of o.set) {
        const [x, y, z] = unkey(k);
        data[((z - p.min[2]) * H + (y - p.min[1])) * W + (x - p.min[0] + p.ax)] = 255;
      }
    });
    uploadTo(gl, gl.TEXTURE_3D, this.tOcc);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8, W, H, D, 0, gl.RED, gl.UNSIGNED_BYTE, data);
  }

  private syncWater(state: WorldState, b: Baked, o: Frame2DOptions): boolean {
    const gl = this.gl;
    const wl = state.water;
    if (!wl) return false;
    const sim = wl.sim;
    if (this.waterOf !== wl || !this.tWDepth) {
      this.waterOf = wl;
      for (const t of [this.tWDepth, this.tWStatic]) if (t) gl.deleteTexture(t);
      const st = new Float32Array(wl.gw * wl.gh * 4);
      for (let i = 0; i < wl.gw * wl.gh; i++) { st[i * 4] = sim.ground[i]!; st[i * 4 + 1] = sim.solid[i]!; st[i * 4 + 2] = wl.isBasin(i) ? 1 : 0; }
      this.tWStatic = tex2D(gl, gl.RGBA32F, wl.gw, wl.gh, gl.RGBA, gl.FLOAT, st);
      this.tWDepth = tex2D(gl, gl.R32F, wl.gw, wl.gh, gl.RED, gl.FLOAT, sim.depth);
      return true;
    }
    // Cada cuadro, solo las columnas de celdas que se ven (y una más a cada lado, por las vecinas)
    const gx0 = Math.max(0, Math.floor(o.vx / 2) - 2), gx1 = Math.min(wl.gw - 1, Math.ceil((o.vx + o.vw) / 2) + 2);
    subImage(gl, this.tWDepth, gx0, 0, gx1 - gx0 + 1, wl.gh, gl.RED, gl.FLOAT, sim.depth, wl.gw, 1);
    void b;
    return true;
  }

  private waterTones(state: WorldState): Float32Array {
    return new Float32Array(state.water!.toneColors.flat());
  }

  private projectDrops(state: WorldState, b: Baked, o: Frame2DOptions): number {
    const gl = this.gl;
    const dr = state.drops;
    if (this.dropsData.length < dr.count * 3) this.dropsData = new Float32Array(Math.max(256, dr.count * 2) * 3);
    let n = 0;
    for (let k = 0; k < dr.count; k++) {
      const [x, y, z] = dr.at(k);
      const [sx, sy, depth] = b.cam.project(x, y, z);
      const tx = Math.floor(sx) - o.vx, ty = Math.floor(sy) - o.vy;
      if (tx < 0 || ty < 0 || tx >= o.vw || ty >= o.vh) continue;
      this.dropsData[n * 3] = tx; this.dropsData[n * 3 + 1] = ty; this.dropsData[n * 3 + 2] = depth;
      n++;
    }
    if (n) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.dropsBuf);
      gl.bufferData(gl.ARRAY_BUFFER, this.dropsData.subarray(0, n * 3), gl.DYNAMIC_DRAW);
    }
    return n;
  }

  private ensureTargets(w: number, h: number): [Target, Target] {
    if (this.targets && this.size[0] === w && this.size[1] === h) return this.targets;
    const gl = this.gl;
    const make = (): Target => {
      const color = tex2D(gl, gl.RGBA8, w, h, gl.RGBA, gl.UNSIGNED_BYTE, null);
      const light = tex2D(gl, gl.RGBA32F, w, h, gl.RGBA, gl.FLOAT, null);
      const depth = tex2D(gl, gl.R32F, w, h, gl.RED, gl.FLOAT, null);
      const fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, light, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT2, gl.TEXTURE_2D, depth, 0);
      checkFbo(gl);
      const dropsFbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, dropsFbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, light, 0);
      checkFbo(gl);
      return { fbo, color, light, depth, dropsFbo };
    };
    this.targets = [make(), make()];
    this.size = [w, h];
    const c = gl.canvas;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    return this.targets;
  }
}

// La y del mundo que se ve en cada píxel (worldPointAt, en doble precisión y guardada en float32). En la GPU, la
// reconstrucción en float32 a partir de la profundidad se equivoca en milésimas, y en el borde de un vóxel eso basta
// para que el rayo de sombra de una entidad caiga en el vóxel de al lado.
function fillWorldY(b: Baked, out: Float32Array, x0: number, y0: number, x1: number, y1: number): void {
  for (let sy = y0; sy <= y1; sy++) for (let sx = x0; sx <= x1; sx++) {
    const P = b.face[sy * b.width + sx]! >= 0 ? worldPointAt(b, sx, sy) : null;
    out[sy * b.width + sx] = P ? P[1] : 0;
  }
}

// ---- utilidades de WebGL

const occIds = new WeakMap<object, number>();
let nextOcc = 1;
function occId(o: object): number {
  let id = occIds.get(o);
  if (!id) occIds.set(o, (id = nextOcc++));
  return id;
}

const warned = new Set<string>();
function warnOnce(msg: string): void {
  if (warned.has(msg)) return;
  warned.add(msg);
  console.warn(`[voxpix] compositor GPU: ${msg}`);
}

function program(gl: WebGL2RenderingContext, vs: string, fs: string): Program {
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`shader: ${gl.getShaderInfoLog(s)}`);
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`programa: ${gl.getProgramInfoLog(prog)}`);
  const u: Uniforms = {};
  const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(prog, i)!;
    const name = info.name.replace(/\[0\]$/, '');
    u[name] = gl.getUniformLocation(prog, info.name);
  }
  return { prog, u: new Proxy(u, { get: (t, k: string) => t[k] ?? null }) };
}

function nearest(gl: WebGL2RenderingContext, target: number): void {
  gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

// Las subidas usan su propia unidad de textura: si no, enlazar para subir pisaría lo que un paso ya enlazó
const UPLOAD_UNIT = 15;
function uploadTo(gl: WebGL2RenderingContext, target: number, t: WebGLTexture): void {
  gl.activeTexture(gl.TEXTURE0 + UPLOAD_UNIT);
  gl.bindTexture(target, t);
}

function tex2D(gl: WebGL2RenderingContext, internal: number, w: number, h: number, format: number, type: number, data: ArrayBufferView | null): WebGLTexture {
  const t = gl.createTexture()!;
  uploadTo(gl, gl.TEXTURE_2D, t);
  nearest(gl, gl.TEXTURE_2D);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
  return t;
}

function texArray(gl: WebGL2RenderingContext, internal: number, w: number, h: number, layers: number): WebGLTexture {
  const t = gl.createTexture()!;
  uploadTo(gl, gl.TEXTURE_2D_ARRAY, t);
  nearest(gl, gl.TEXTURE_2D_ARRAY);
  gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, internal, w, h, layers);
  return t;
}

// Un recuadro de un array que tiene `rowLen` elementos por fila y `comps` componentes por elemento
function subImage(gl: WebGL2RenderingContext, t: WebGLTexture, x: number, y: number, w: number, h: number, format: number, type: number, data: ArrayBufferView, rowLen: number, comps: number): void {
  void comps;
  uploadTo(gl, gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_ROW_LENGTH, rowLen);
  gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, x);
  gl.pixelStorei(gl.UNPACK_SKIP_ROWS, y);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, w, h, format, type, data);
  gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
  gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0);
  gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
}

function bindTex(gl: WebGL2RenderingContext, unit: number, target: number, t: WebGLTexture | null, loc: WebGLUniformLocation | null): void {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(target, t);
  if (loc) gl.uniform1i(loc, unit);
}

function checkFbo(gl: WebGL2RenderingContext): void {
  const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`framebuffer incompleto: 0x${st.toString(16)}`);
}
