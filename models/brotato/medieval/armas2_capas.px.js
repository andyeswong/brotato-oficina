// Las cuatro armas nuevas del mundo medieval en vóxeles, capa por capa (NARUTO, 2026-11-04). Madera, acero y latón
// con runas que brillan, como armas_capas.px.js:
//   retorno      hacha arrojadiza: mango corto y hoja de acero fina con la runa ámbar; vuela ella     agarre -> punta 8
//   chorro       antorcha de brea: mango de madera, olla de brea con brasas y caño de latón          agarre -> punta 14
//   explosivo    mortero de mano: cañón corto de latón sobre la caja; dispara una bomba de mecha     agarre -> punta 12
//   golpe-suelo  martillo de guerra: mango largo y cabeza de acero con bandas y la runa verde        agarre -> punta 17
// más los proyectiles retorno-proy y explosivo-proy. Perfil de lado extruido hacia los lados (la bomba, una esfera);
// la punta mira al frente y el agarre queda en el origen.
// Importar: voxpix import-pxl armas2_capas.px.js --stack retorno retorno.json (y cada arma, pose y proyectil)

pal({
  k: "#2a1810", w: "#6a4224", W: "#9a6a3a",
  s: "#5a6070", S: "#a0a8b8", T: "#e4e8f0",
  B: "#b0823a", N: "#e0b45a",
  a: "#8a4a10", A: "#f0a030", U: "#fff0b0",
  g: "#1a6a3a", G: "#4af08a", V: "#d0ffe0",
})
ramps("kwW", "sST", "BN", "aAU", "gGV")
// voxpix: outline #12101c
// voxpix: emissive aAU gGV
const GLOWS = ["aAU", "gGV"]

const WEAPONS = {
  retorno: { grip: [1, 2], half: { default: 1, s: 0, S: 0, T: 0, a: 0 }, rows: [
    "......sST.",
    "......sSTT",
    "kwWWWWsSaT",
    "......sSTT",
    "......sST.",
  ] },
  "retorno-proy": { grip: [1, 2], half: { default: 1, s: 0, S: 0, T: 0, a: 0 }, rows: [
    "......sST.",
    "......sSTT",
    "kwWWWWsSaT",
    "......sSTT",
    "......sST.",
  ] },
  chorro: { grip: [2, 2], half: { default: 1, k: 2, A: 1 }, rows: [
    "........BNNB.......",
    ".......BkkkkB.BN.",
    "kwwWWWWBkAAkBBNNA",
    ".......BkkkkB.BN.",
    "........BNNB.......",
  ] },
  explosivo: { grip: [1, 2], half: { default: 1, B: 2, N: 2, k: 1 }, rows: [
    ".....BBBBBBBBN",
    "....BNNNNNNNNk",
    "kwWWBNNNNNNNNk",
    "....BNNNNNNNNk",
    ".....BBBBBBBBN",
  ] },
  "explosivo-proy": { shape: "ball", keys: { body: "s", hi: "S", top: [[3, "k"], [4, "A"], [5, "U"]] } },
  "golpe-suelo": { grip: [2, 2], half: { default: 1, B: 2, S: 2, T: 2, s: 2, g: 1, G: 1 }, rows: [
    "..............BSSSSB",
    "..............SSTTSS",
    "kwwWWWWWWWWWWWSSgGSS",
    "..............SSTTSS",
    "..............BSSSSB",
  ] },
}

// Formas que no salen de un perfil (las que son planas en horizontal): set(u, adelante, z, tecla), con el agarre en 0
const SHAPES = {
  // Bumerán en V: dos brazos que salen del codo (el agarre) hacia delante y abiertos, con el filo de luz por fuera
  boomerang: (set, k) => {
    for (let t = 0; t <= 8; t++) for (const side of [-1, 1]) for (let w = 0; w <= 1; w++) {
      const u = side * (Math.round(t * 0.75) + w), f = t
      set(u, f, 0, t >= 7 ? k.tip : w ? k.edge : t < 2 ? k.hub : k.core)
      if (!w && t >= 1 && t <= 6) set(u, f, 1, k.spine)
    }
  },
  // Disco plano de 9 de ancho, cogido por el borde de atrás: el canto de luz, el cuerpo y el núcleo
  disc: (set, k) => {
    for (let u = -5; u <= 5; u++) for (let f = 0; f <= 8; f++) {
      const d = Math.hypot(u, f - 4)
      if (d > 4.3) continue
      set(u, f, 0, d > 3.3 ? (u < 0 ? k.rimHi : k.rim) : d <= 1.5 ? (d < 0.8 ? k.coreHi : k.core) : k.body)
      if (d <= 2.5) set(u, f, 1, d <= 1.5 ? k.coreHi : k.hub)
    }
  },
  // Esfera de radio 2 centrada en el agarre (los proyectiles redondos), con una banda y algo encima
  ball: (set, k) => {
    for (let u = -2; u <= 2; u++) for (let f = -2; f <= 2; f++) for (let z = -2; z <= 2; z++) {
      if (u * u + f * f + z * z > 5.3) continue
      set(u, f, z, k.band && z === 0 ? k.band : u + z > 0 ? k.hi : k.body)
    }
    for (const [z, key] of k.top) set(0, 0, z, key)
  },
}

// 64 y no 28 (como en armas_capas.px.js): el modelo va centrado en el lienzo y nada se recorta
const GRID = 64

function layers(id) {
  const def = WEAPONS[id]
  const m = new Map()
  if (def.shape) {
    SHAPES[def.shape]((u, f, z, k) => vox.set(m, u, -f, z, k), def.keys)
    return { vox: m, z0: vox.bounds(m).minZ }
  }
  const [gx, gy] = def.grip
  def.rows.forEach((row, r) => [...row].forEach((k, c) => {
    if (k === ".") return
    const half = def.half[k] ?? def.half.default
    const lat = def.lat?.[k] ?? Array.from({ length: 2 * half + 1 }, (_, i) => i - half)
    for (const u of lat) vox.set(m, u, -(c - gx), gy - r, k)
  }))
  return { vox: m, z0: vox.bounds(m).minZ }
}

for (const id of Object.keys(WEAPONS)) {
  const { vox: m, z0 } = layers(id)
  vox.layers(id, vox.shift(m, 0, 0, -z0), { w: GRID, h: GRID })
}

// ---- Poses de animación, como las de armas_capas.px.js: el mismo modelo movido, con la luz un tono más clara y los
// efectos de vóxeles de su propia luz. Además de los de allí (flash, wide, trail, impact):
//   cone   chorro: un cono que se abre desde la boca, de ese largo, con huecos (no es macizo). El chorro es
//          continuo: anim0..2 son el chorro y anim3 la vuelta al reposo, como en las demás
//   slam   golpe de suelo: un anillo de luz a ras de lo más bajo del arma, la onda al dar en el suelo
const POSES = {
  retorno: [
    { back: 2, lift: 1 }, { back: -3, glow: 1, trail: 1 },
    { back: -1 }, { back: 0 },
  ],
  chorro: [
    { back: 1, glow: 1, cone: 5 }, { back: 0, cone: 4 },
    { back: 1, glow: 1, cone: 6 }, { back: 0 },
  ],
  explosivo: [
    { back: 3, lift: 2, glow: 1, flash: 3, wide: 1 }, { back: 2, lift: 1, glow: 1, flash: 1 },
    { back: 1 }, { back: 0 },
  ],
  golpe: [
    { back: 2, lift: 5 }, { back: 3, lift: 7, glow: 1 },
    { back: -2, glow: 1, impact: 1, slam: 1 }, { back: -1 },
  ],
}
const ANIM = { retorno: "retorno", chorro: "chorro", explosivo: "explosivo", "golpe-suelo": "golpe" }

function lightRamp(m) {
  let best = GLOWS[0], most = -1
  for (const r of GLOWS) {
    let n = 0
    for (const k of m.values()) if (r.includes(k)) n++
    if (n > most) { best = r; most = n }
  }
  return best
}

function pose(m, p, ramp) {
  let out = p.yaw ? vox.rotate(m, p.yaw, { axis: "z" }) : m
  if (p.glow) out = vox.toneUp(out, GLOWS)
  out = vox.shift(out, 0, p.back ?? 0, p.lift ?? 0)
  // La boca: el vóxel más adelantado; si hay varios, el del medio (menor |u|), el más alto y el de la izquierda
  let tip = null, minZ = Infinity
  for (const key of out.keys()) {
    const [u, y, z] = key.split(",").map(Number)
    minZ = Math.min(minZ, z)
    if (!tip || y < tip.y || (y === tip.y && (Math.abs(u) < Math.abs(tip.u) ||
      (Math.abs(u) === Math.abs(tip.u) && (z > tip.z || (z === tip.z && u < tip.u)))))) tip = { u, y, z }
  }
  const [dim, mid, hot] = [ramp[0], ramp[1], ramp[ramp.length - 1]]
  const put = (u, y, z, k) => { if (z >= minZ && !vox.get(out, u, y, z)) vox.set(out, u, y, z, k) }
  if (p.flash && tip) {
    const n = p.flash
    for (let d = 1; d <= n; d++) put(0, tip.y - d, tip.z, d <= Math.ceil(n / 2) ? hot : mid)
    for (let d = 1; d < n; d++) {
      const y = tip.y - 2
      put(0, y, tip.z + d, d === n - 1 ? dim : mid); put(0, y, tip.z - d, d === n - 1 ? dim : mid)
      const side = p.wide ? n + 1 : d
      for (let s = 1; s <= side; s++) { put(s, y - (p.wide ? s : 0), tip.z, s >= side ? dim : mid); put(-s, y - (p.wide ? s : 0), tip.z, s >= side ? dim : mid) }
    }
  }
  if (p.cone && tip) {
    // El chorro: cada paso hacia delante se abre medio vóxel, y se salta un vóxel de cada tres (se ve que no es sólido)
    for (let d = 1; d <= p.cone; d++) {
      const r = Math.floor(d / 2)
      for (let u = -r; u <= r; u++) for (let dz = -r; dz <= r; dz++) {
        if (u * u + dz * dz > r * r + 0.5 || (u + dz + d) % 3 === 0 && d > 1) continue
        put(tip.u + u, tip.y - d, tip.z + dz, d <= 2 ? hot : d <= p.cone - 2 ? mid : dim)
      }
    }
  }
  if (p.trail && tip) for (let d = 1; d <= 4; d++) put(0, tip.y + d + 2, tip.z + 1, d <= 2 ? mid : dim)
  if (p.impact && tip) {
    for (const [du, dy, dz] of [[0, -1, 0], [1, -1, 1], [-1, -1, 1], [0, -2, -1], [2, 0, 0], [-2, 0, 0]]) put(tip.u + du, tip.y + dy, tip.z + dz, hot)
    for (const [du, dy, dz] of [[0, -3, 0], [3, -1, 1], [-3, -1, 1]]) put(tip.u + du, tip.y + dy, tip.z + dz, dim)
  }
  if (p.slam && tip) {
    // El anillo, alrededor de la cabeza del arma (unos vóxeles por detrás de la punta) y a ras de lo más bajo
    for (let a = 0; a < 20; a++) {
      const t = (a / 20) * Math.PI * 2
      put(tip.u + Math.round(Math.cos(t) * 5), tip.y + 3 + Math.round(Math.sin(t) * 5), minZ, a % 2 ? mid : dim)
    }
  }
  return out
}

for (const [id, kind] of Object.entries(ANIM)) {
  const { vox: m, z0 } = layers(id)
  const ramp = lightRamp(m)
  POSES[kind].forEach((p, i) => vox.layers(`${id}-anim${i}`, vox.shift(pose(m, p, ramp), 0, 0, -z0), { w: GRID, h: GRID }))
}
