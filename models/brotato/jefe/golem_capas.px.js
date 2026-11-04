// El gólem, jefe del piso 10 (uno de los tres que se sortean), en vóxeles, capa por capa (NARUTO, 2026-11-04). Lento,
// golpea el suelo con anillos de onda y lanza trozos. El mismo cuerpo en los tres mundos y de qué está hecho según el
// mundo:
//   oficina    copiadora gigante: el cuerpo, una copiadora beige con el panel de pantalla verde y las bandejas de
//              papel; la cabeza, la tapa del escáner con la línea de luz roja por ojos; los brazos, cartuchos de tóner
//              negros; las piernas, el mueble gris con ruedas
//   medieval   gólem de piedra: bloques de roca gris con musgo por arriba y grietas que brillan ámbar
//   cyberpunk  mecha: placas de cromo negro, el visor de neón rosa, el núcleo cian en el pecho y los pistones
// Dibujado (body) con unos 34 de ancho con los brazos, 23 de fondo y 35 de alto, y puesto a escala 1,3 (SCALE): unos
// 44 x 30 x 45 vóxeles. Radio 12 en el juego. MAIA, tras verlo jugando: de perfil se leía como un tablón estrecho;
// ahora el fondo es al menos 2/3 del frente, con una pieza en la espalda (la unidad de acabado de la copiadora, una joroba
// de roca, la mochila del reactor), el panel saliente en el pecho y los puños por delante del cuerpo.
// Ejes como el jefe (jefe_capas.px.js): cada capa z es un corte visto desde arriba, norte arriba (la espalda) y abajo
// el frente, que mira a la cámara; pivote en el centro, los pies en z = 0.
// Pilas:
//   golem-<mundo>            quieto
//   golem-<mundo>-andar0..3  el paso, pesado: piernas y brazos alternos, el cuerpo sube 1 al pasar
//   golem-<mundo>-golpe      el golpe al suelo: agachado, el cuerpo hacia delante y los dos puños contra el suelo
//   golem-<mundo>-lanza      el brazo derecho atrás y arriba, a punto de lanzar
//   trozo-<mundo>            lo que lanza: un paquete de folios, una roca con musgo, chatarra con neón
// Importar: voxpix import-pxl golem_capas.px.js --stack golem-oficina golem-oficina.json (y cada pila)

pal({
  R: "#7a1426", r: "#d8314a", e: "#ff8a8a",                                  // ojos rojos
  a: "#5a5448", b: "#8a8270", c: "#b4ac96", d: "#d6d0bc", f: "#f2eee0",       // plástico beige
  g: "#141418", h: "#24242c", i: "#383844",                                  // tóner negro
  j: "#2a2e36", k: "#464c58", l: "#6a7280", m: "#9aa2b0",                    // metal gris del mueble
  n: "#0e5a2a", o: "#2ee070", p: "#b0ffd0",                                  // pantalla verde
  s: "#26262c", t: "#3e3e46", u: "#5a5a62", v: "#7c7c84", w: "#a2a2a8",       // roca
  x: "#1e3a1a", y: "#2e5a26", z: "#4a8038",                                  // musgo
  A: "#8a4a10", B: "#f0a030", C: "#fff0b0",                                  // ámbar
  D: "#0e0c16", E: "#1c1a2a", F: "#2e2c44", G: "#4a4868", H: "#7c7aa4", I: "#c8c8f0",   // cromo negro
  J: "#7a1f6a", K: "#ff3cc8", L: "#ffc0f0",                                  // neón rosa
  M: "#126a80", N: "#2ee6ff", O: "#c0f8ff",                                  // neón cian
})
ramps("Rre", "abcdf", "ghi", "jklm", "nop", "stuvw", "xyz", "ABC", "DEFGHI", "JKL", "MNO")
// voxpix: outline #12101c
// voxpix: emissive Rre nop ABC JKL MNO

const RAMP = { eye: "Rre", beige: "abcdf", toner: "ghi", steel: "jklm", screen: "nop", rock: "stuvw", moss: "xyz",
  amber: "ABC", chrome: "DEFGHI", pink: "JKL", cyan: "MNO" }
const MX = 23, MY = 24, W = 2 * MX + 1, H = 2 * MY + 1, LAYERS = 54
const SCALE = 1.3   // sobre las medidas del dibujo (body)
const HD = 8.5      // medio fondo del torso

const ell = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1
function seg(p, a, b) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]]
  const L = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2
  const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / L))
  return { d: Math.hypot(a[0] + ab[0] * t - p[0], a[1] + ab[1] * t - p[1], a[2] + ab[2] * t - p[2]), t }
}

// ---- el cuerpo en una pose. pose: { legL, legR: avance del pie (y), bob: subir el cuerpo, lean: inclinar hacia delante
// (y por cada z sobre la cadera), drop: bajar el cuerpo, hands: [mano izquierda, mano derecha] o nada (cuelgan) }
const HIP = 11
function body(x, y, z, pose) {
  const ax = Math.abs(x), left = x < 0
  // Piernas: columnas gruesas con el pie más ancho; el pie de cada lado avanza `leg` (cizalla desde la cadera)
  if (z <= HIP) {
    const step = left ? pose.legL : pose.legR
    const yy = y - step * (HIP - z) / HIP
    if (z <= 1 && ell(ax, yy, 5, -1, 4, 5.4)) return { part: "foot" }
    if (ell(ax, yy, 5, 0, 3.6, 4.2)) return { part: "leg" }
  }
  // Lo de la cadera para arriba, inclinado hacia delante y bajado según la pose
  const zz = z + pose.drop - pose.bob, yy = y + Math.max(0, zz - HIP) * pose.lean
  if (zz >= HIP && zz <= HIP + 3 && ell(x, yy, 0, 0, 8.4, 7.4)) return { part: "hips" }
  // El torso: una caja de esquinas redondas, más ancha arriba
  if (zz > HIP + 3 && zz <= 28) {
    const hw = 8.6 + (zz - HIP - 3) * 0.12
    const cx = Math.max(0, ax - (hw - 2)), cy = Math.max(0, Math.abs(yy) - (HD - 2))
    if (cx * cx + cy * cy <= 4.2) return { part: "torso", ty: yy, tz: zz }
  }
  // El panel que sale del pecho, arriba a la derecha, y la pieza de la espalda
  if (zz >= 23 && zz <= 26.5 && x >= -1 && x <= 7.5 && yy >= -HD - 2 - (zz - 23) * 0.3 && yy < -HD + 1) return { part: "panel", tz: zz }
  if (zz >= 15 && zz <= 27) {
    const cx = Math.max(0, ax - 4.5), cy = Math.max(0, yy - 11.5)
    if (yy > HD - 2 && cx * cx + cy * cy <= 4) return { part: "back", tz: zz }
  }
  // Hombros y cabeza, hundida entre ellos
  if (Math.hypot(ax - 11, yy / 1.35, zz - 26.5) <= 4.4) return { part: "shoulder" }
  if (zz >= 28 && zz <= 34 && Math.abs(x) <= 4.5 && Math.abs(yy + 1.5) <= 4.8) return { part: "head", hy: yy, hz: zz }
  // Brazos: del hombro al codo y del codo a la mano; puños grandes
  for (const side of [-1, 1]) {
    const hand = pose.hands?.[side < 0 ? 0 : 1] ?? [side * 13, -5, 9 + pose.bob - pose.drop]
    const sh = [side * 12, -Math.max(0, 26 - HIP) * pose.lean, 26 + pose.bob - pose.drop]
    const el = [(sh[0] + hand[0]) / 2 + side * 1.2, (sh[1] + hand[1]) / 2 + 1, (sh[2] + hand[2]) / 2]
    const p = [x, y, z]
    if (Math.hypot(x - hand[0], y - hand[1], z - hand[2]) <= 4.2) return { part: "fist" }
    if (seg(p, sh, el).d <= 3.4 || seg(p, el, hand).d <= 3.1) return { part: "arm", side, along: seg(p, sh, hand).t }
  }
  return null
}

// x, y, z: en las medidas del dibujo (redondeadas); front y rear: si la cara de delante o la de atrás dan al aire
function material(world, x, y, z, b, front, rear) {
  const ax = Math.abs(x)
  if (world === "oficina") {
    if (b.part === "head") {
      if (front && b.hz >= 30 && b.hz <= 31) return "eye"                          // la línea del escáner
      return b.hz >= 33 ? "steel" : "toner"                                       // la tapa
    }
    if (b.part === "torso") {
      // El panel de control arriba delante (pantalla verde), y las bandejas de papel abajo (franjas blancas)
      if (front && b.tz >= 24 && b.tz <= 26 && x >= 1 && x <= 6) return "screen"
      if (front && b.tz <= 21 && (Math.round(b.tz) % 3 === 0)) return ax <= 7 ? "steel" : "beige"
      return "beige"
    }
    // El panel de control: la pantalla verde encima, el canto gris
    if (b.part === "panel") return b.tz >= 25.5 && x >= 1 && x <= 6 ? "screen" : "steel"
    // La unidad de acabado detrás: beige, con las ranuras de salida de papel
    if (b.part === "back") return rear && Math.round(b.tz) % 3 === 0 && ax <= 4 ? "steel" : "beige"
    if (b.part === "hips") return "steel"
    if (b.part === "arm") return Math.round(b.along * 8) % 4 === 0 ? "beige" : "toner"
    if (b.part === "fist") return "steel"
    if (b.part === "shoulder") return "beige"
    if (b.part === "foot") return z === 0 && (Math.abs(x) % 4 === 1) ? "toner" : "steel"   // las ruedas
    return "steel"
  }
  if (world === "medieval") {
    if (b.part === "panel" && front && (x + z) % 4 === 0) return "amber"
    if (b.part === "head" && front && b.hz >= 30 && b.hz <= 31 && ax >= 1 && ax <= 3) return "eye"
    // Grietas que brillan: una en zigzag por el pecho
    if (b.part === "torso" && front && Math.abs(x - Math.round(Math.sin(b.tz * 0.9) * 2)) <= 0 && b.tz >= 16 && b.tz <= 26) return "amber"
    if (b.part === "fist" && front && (x + z) % 5 === 0) return "amber"
    return "rock"
  }
  // cyberpunk
  if (b.part === "head") return front && b.hz >= 30 && b.hz <= 31 ? "pink" : "chrome"   // el visor
  if (b.part === "torso" && front && Math.hypot(x, b.tz - 22) <= 2.4) return "cyan"     // el núcleo
  if (b.part === "torso" && (Math.round(b.tz) === 18 || Math.round(b.tz) === 27)) return "pink"
  if (b.part === "arm" && Math.round(b.along * 10) % 3 === 0) return "steel"            // los pistones
  if (b.part === "shoulder" && front) return "pink"
  if (b.part === "back" && rear && Math.round(b.tz) % 3 === 0 && ax <= 3.5) return "cyan"   // las rejillas del reactor
  if (b.part === "panel") return front ? "pink" : "chrome"
  return "chrome"
}

function voxel(world, x, y, z, pose) {
  const S = SCALE, r = Math.round
  const at = (a, c, d) => body(a / S, c / S, d / S, pose)
  const b = at(x, y, z)
  if (!b) return null
  const solid = (a, c, d) => at(a, c, d) !== null
  let mat = material(world, r(x / S), r(y / S), r(z / S), b, !solid(x, y - 1, z), !solid(x, y + 1, z))
  // El musgo del gólem de piedra, en lo que mira arriba
  if (world === "medieval" && mat === "rock" && !solid(x, y, z + 1) && (x * 7 + y * 13 + z * 3) % 4 !== 0) mat = "moss"
  const ramp = RAMP[mat]
  if (mat === "eye") return ramp[2]
  let k = Math.floor((ramp.length - 1) / 2)
  if (!solid(x, y, z + 1)) k += 1
  if (!solid(x - 1, y, z)) k += 1
  if (!solid(x, y, z - 1) && z > 0) k -= 1
  if (y > 2 && !solid(x, y + 1, z)) k -= 1
  if (mat === "rock" && (x * 5 + y * 3 + z * 7) % 11 === 0) k -= 1                  // la roca, con vetas
  if (mat === "screen" || mat === "amber" || mat === "pink" || mat === "cyan") k = ramp.length - 2 + (!solid(x, y, z + 1) ? 1 : 0)
  return ramp[Math.max(0, Math.min(ramp.length - 1, k))]
}

const STILL = { legL: 0, legR: 0, bob: 0, lean: 0, drop: 0 }
const POSES = {
  "": STILL,
  andar0: { ...STILL, legL: -3, legR: 3, hands: [[-13, -1, 9], [13, -8, 9]] },
  andar1: { ...STILL, bob: 1 },
  andar2: { ...STILL, legL: 3, legR: -3, hands: [[-13, -8, 9], [13, -1, 9]] },
  andar3: { ...STILL, bob: 1 },
  // Agachado, hacia delante, los puños contra el suelo delante de los pies
  golpe: { ...STILL, legL: -2, legR: -2, lean: 0.25, drop: 3, hands: [[-9, -13, 3.5], [9, -13, 3.5]] },
  // El brazo derecho atrás y arriba, el izquierdo delante para apuntar
  lanza: { ...STILL, legL: -2, legR: 2, lean: -0.05, hands: [[-13, -10, 15], [12, 8, 36]] },
}

function stack(name, world, pose) {
  const at = new Map()
  for (let z = 0; z < LAYERS; z++) for (let y = -MY; y <= MY; y++) for (let x = -MX; x <= MX; x++) {
    const k = voxel(world, x, y, z, pose)
    if (k) at.set(`${x},${y},${z}`, k)
  }
  for (let z = 0; z < LAYERS; z++) {
    sprite(`${name}_z${String(z).padStart(2, "0")}`, { w: W, h: H }, (c) => {
      for (let y = -MY; y <= MY; y++) for (let x = -MX; x <= MX; x++) {
        const k = at.get(`${x},${y},${z}`)
        if (k) c.px(x + MX, MY - y, k)
      }
    })
  }
}

for (const world of ["oficina", "medieval", "cyberpunk"])
  for (const [pose, def] of Object.entries(POSES)) stack(pose ? `golem-${world}-${pose}` : `golem-${world}`, world, def)

// ---- el trozo que lanza: unos 7 x 6 x 6, centrado en el origen
const TR = 5, TW = 2 * TR + 1
function chunk(world, x, y, z) {
  if (world === "oficina") {
    // Un paquete de folios: un bloque blanco con el envoltorio oscuro en medio
    if (Math.abs(x) > 3 || Math.abs(y) > 2 || z < 0 || z > 3) return null
    if (Math.abs(x) <= 1) return z === 3 ? "i" : "h"
    return z === 3 || Math.abs(y) === 2 ? "f" : "d"
  }
  // Una roca o un trozo de chatarra: una bola deforme
  const d = Math.hypot(x, y * 1.1, (z - 2.5) * 1.2) + Math.sin(x * 1.7 + y * 2.3 + z) * 0.6
  if (d > 3.4 || z < 0) return null
  if (world === "medieval") return z >= 4 ? "y" : (x + y + z) % 4 === 0 ? "t" : "u"
  return (x + z) % 4 === 0 ? "K" : (x * y) % 3 === 0 ? "G" : "F"
}
for (const world of ["oficina", "medieval", "cyberpunk"]) for (let z = 0; z <= 6; z++) {
  sprite(`trozo-${world}_z${String(z).padStart(2, "0")}`, { w: TW, h: TW }, (c) => {
    for (let y = -TR; y <= TR; y++) for (let x = -TR; x <= TR; x++) {
      const k = chunk(world, x, y, z)
      if (k) c.px(x + TR, TR - y, k)
    }
  })
}
