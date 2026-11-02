// Armas del mundo CYBERPUNK en vóxeles: cromo negro y neón, más agresivas que las de la oficina (FERN, 2026-10-25).
// Mismo papel y mismo largo del agarre a la punta (MAIA: las versiones por mundo son solo de aspecto):
//   tiro      -> pistola de raíles: dos raíles abiertos con el arco cian entre ellos     agarre -> punta 14
//   rafaga    -> subfusil de neón: compacto, cargador largo y luces rosas                agarre -> punta 17
//   estocada  -> katana de neón: tsuba negra y hoja rosa                                 agarre -> punta 19
// más sus proyectiles: la bala de raíl y el perdigón de neón. Perfil de lado extruido hacia los lados, la punta al
// frente y el agarre en el origen.
// Importar: voxpix import-pxl armas_capas.px.js --stack tiro tiro.json (y rafaga, estocada, bala, perdigon)

pal({
  K: "#0e0c16", D: "#1c1a2a", M: "#2e2c44", L: "#4a4868", H: "#7c7aa4", W: "#c8c8f0",   // cromo negro
  c: "#126a80", C: "#2ee6ff", I: "#c0f8ff",                                            // neón cian (luz propia)
  p: "#7a1f6a", P: "#ff3cc8", Q: "#ffc0f0",                                            // neón rosa (luz propia)
})
ramps("KDMLHW", "cCI", "pPQ")
// voxpix: outline #12101c
// voxpix: emissive cCI pPQ

const WEAPONS = {
  // Pistola de raíles: el raíl de abajo largo y el de arriba solo atrás, para que el arco cian que salta entre ellos
  // se vea desde arriba y de lado
  tiro: { grip: [3, 4], half: { default: 1 }, rows: [
    "...DDLLLL.........",
    "..DMMHCICICICICICW",
    "..DMMLLLLLLLLLLLLW",
    "..DDMMMMDD........",
    "...DMD.D..........",
    "..DMMD............",
    "..DMD.............",
    "..KKK.............",
  ] },
  // Subfusil de neón: compacto, cargador largo bajo el agarre y una línea rosa continua de 2 a lo largo (revisión de
  // NARUTO: en puntitos sueltos no se leía)
  rafaga: { grip: [4, 3], half: { default: 1 }, rows: [
    ".....LLLLLLLLLLLLLL...",
    "DD..DMMQQQQQQQQQQHHHHW",
    "DMDDMMMPPPPPPPPPPLLLL.",
    ".DDDDMDDMMDDD.........",
    "....DMD.DMD...........",
    "....DMD.DPD...........",
    "...DMD..DMD...........",
    "...KKK..DPD...........",
  ] },
  // Katana: empuñadura negra, tsuba ancha y hoja de neón rosa de 1 de grueso; el filo brilla más
  estocada: { grip: [1, 1], half: { default: 1, H: 2, P: 0, Q: 0, p: 0 }, rows: [
    "....H................",
    "DMDMHQQQQQQQQQQQQQQQQ",
    "DMDMHPPPPPPPPPPPPPP..",
    "....H................",
  ] },
  bala: { grip: [0, 0], half: { default: 0 }, rows: [
    "cCCI",
  ] },
  perdigon: { grip: [1, 1], half: { default: 1 }, rows: [
    ".P.",
    "PQP",
    ".P.",
  ] },
  // ---- Catálogo 2 (borrador, 2026-10-25): abanico 15, perforador 22, barrido 16 del agarre a la punta
  // Escopeta de neón: doble cañón de cromo (hueco en medio) y corredera con los neones rosas (revisión de NARUTO)
  abanico: { grip: [3, 4], half: { default: 1 }, lat: { H: [-2, -1, 1, 2] }, rows: [
    "...DLLLLLLHHHHHHHHH",
    "..DMMPPMMMHHHHHHHHH",
    "..DMMMMMMLLLLLLLLL.",
    "..DDMMMMDD.PPQPPQ..",
    "...DMD.............",
    "..DMMD.............",
    "..DMD..............",
    "..KKK..............",
  ] },
  // Rifle de raíles largo: raíles abiertos con el arco cian a todo lo largo y mira rosa
  perforador: { grip: [7, 4], half: { default: 1 }, rows: [
    "...........LLLLLL.............",
    "...........MPPPPM.............",
    "DD...DLLLL....................",
    "DMDDMMHCICICICICICICICICICICIW",
    "DMMMMMMLLLLLLLLLLLLLLLLLLLLLLW",
    ".....DMD......................",
    "....DMMD......................",
    "....KKK.......................",
  ] },
  // Martillo hidráulico: mango negro, cabeza de cromo con los pistones de luz rosa
  barrido: { grip: [1, 2], half: { default: 1, H: 3, Q: 3, P: 3, L: 3 }, rows: [
    "............HHHHHH",
    "............HQPPQH",
    "DMDMDMDMDMDMHPPPPH",
    "............HQPPQH",
    "............LLLLLL",
  ] },
  perdigon2: { grip: [0, 0], half: { default: 0 }, rows: ["PQ"] },
  bala2: { grip: [0, 0], half: { default: 0 }, rows: ["cCCCI"] },
}

// 64 y no 28: con 28 (centro 14) todo lo que pasaba de 13 vóxeles por delante del agarre se recortaba sin avisar;
// el rifle perdía 9 y las hojas 6 (MAIA, 2026-10-29). Cambiar el lienzo no mueve el modelo: va centrado en el lienzo
const GRID = 64

// Los vóxeles se modelan con el global `vox` de VoxPix (mapas "x,y,z" -> tecla, ver src/pxl/voxmap.ts)
function layers(id) {
  const def = WEAPONS[id]
  const [gx, gy] = def.grip
  const m = new Map()
  def.rows.forEach((row, r) => [...row].forEach((k, c) => {
    if (k === ".") return
    // lat: columnas laterales por tecla (un doble cañón deja el hueco del medio); si no, de -half a half
    const half = def.half[k] ?? def.half.default
    const lat = def.lat?.[k] ?? Array.from({ length: 2 * half + 1 }, (_, i) => i - half)
    for (const u of lat) vox.set(m, u, -(c - gx), gy - r, k)
  }))
  return { vox: m, z0: vox.bounds(m).minZ }
}

// Las capas se nombran desde 00 (el importador apila desde z = 0): en el modelo el vóxel más bajo queda en z = 0 y el
// agarre, a la altura -z0. Por eso el mapa baja -z0 antes de cortarlo en capas.
for (const id of Object.keys(WEAPONS)) {
  const { vox: m, z0 } = layers(id)
  vox.layers(id, vox.shift(m, 0, 0, -z0), { w: GRID, h: GRID })
}

// ---- Poses de animación (MAIA, 2026-10-29) ----
const GLOWS = ["cCI", "pPQ"]   // las rampas de luz propia
const ANIM = { tiro: "tiro", rafaga: "rafaga", abanico: "abanico", perforador: "perforador", estocada: "estocada", barrido: "barrido" }
// Andrés: "quiero la animación con VoxPix", no solo efectos del juego. Cada arma saca de su MISMO perfil cuatro cuadros
// de disparo o de golpe: <id>-anim0..3. Nada se dibuja aparte: cada cuadro es el arma de arriba movida (hacia atrás,
// o hacia delante en la estocada), levantada o girada en horizontal alrededor del agarre, con la energía un tono más clara
// y, en las de fuego, el fogonazo en la boca hecho de vóxeles de su propia luz.
//   back   vóxeles hacia atrás (negativo: hacia delante)       lift   vóxeles hacia arriba (el culatazo)
//   yaw    grados en el plano horizontal alrededor del agarre (el barrido del martillo)
//   glow   la energía sube un tono                            flash  0-3, tamaño del fogonazo en la boca
//   wide   fogonazo abierto a los lados (escopeta)            long   fogonazo largo y fino (rifle)
//   trail  estela de energía detrás de la punta (estocada)    impact chispas en la cabeza (martillo)
// Las capas de cada pose arrancan en la misma z que el arma quieta, para que el agarre quede a la misma altura en todos
// los cuadros. Sin cabeceo a propósito: inclinar el perfil lo convierte en escalones y deja a la vista la cara de
// arriba de cada uno, y el arma entera se ve clara; y bajando se saldría por debajo del agarre.
const POSES = {
  tiro: [
    { back: 2, lift: 1, glow: 1, flash: 3 }, { back: 2, lift: 1, glow: 1, flash: 2 },
    { back: 1, lift: 1 }, { back: 0 },
  ],
  rafaga: [
    { back: 1, glow: 1, flash: 2 }, { back: 0 },
    { back: 1, glow: 1, flash: 2 }, { back: 0 },
  ],
  abanico: [
    { back: 3, lift: 1, glow: 1, flash: 3, wide: 1 }, { back: 3, lift: 2, glow: 1, flash: 2, wide: 1 },
    { back: 2, lift: 1 }, { back: 1 },
  ],
  perforador: [
    { back: 2, glow: 1, flash: 3, long: 1 }, { back: 2, lift: 1, glow: 1, flash: 1, long: 1 },
    { back: 1 }, { back: 0 },
  ],
  estocada: [
    { back: 2 }, { back: -4, glow: 1, trail: 1 },
    { back: -3, glow: 1 }, { back: -1 },
  ],
  barrido: [
    { yaw: -60 }, { yaw: -25, glow: 1 },
    { yaw: 35, glow: 1, impact: 1 }, { yaw: 15 },
  ],
}

// La rampa de luz propia que más usa el arma: de ella salen el fogonazo, la estela y las chispas
function lightRamp(vox) {
  let best = GLOWS[0], most = -1
  for (const r of GLOWS) {
    let n = 0
    for (const k of vox.values()) if (r.includes(k)) n++
    if (n > most) { best = r; most = n }
  }
  return best
}

function pose(m, p, ramp) {
  // Girar en horizontal alrededor del agarre (muestreo inverso, sin agujeros), aclarar la energía y mover
  let out = p.yaw ? vox.rotate(m, p.yaw, { axis: "z" }) : m
  if (p.glow) out = vox.toneUp(out, GLOWS)
  out = vox.shift(out, 0, p.back ?? 0, p.lift ?? 0)
  // La boca: el vóxel más adelantado; si hay varios, el del medio (menor |u|), el más alto y el de la izquierda
  let tip = null
  for (const key of out.keys()) {
    const [u, y, z] = key.split(",").map(Number)
    if (!tip || y < tip.y || (y === tip.y && (Math.abs(u) < Math.abs(tip.u) ||
      (Math.abs(u) === Math.abs(tip.u) && (z > tip.z || (z === tip.z && u < tip.u)))))) tip = { u, y, z }
  }
  const [dim, mid, hot] = [ramp[0], ramp[1], ramp[ramp.length - 1]]
  const put = (u, y, z, k) => { if (!vox.get(out, u, y, z)) vox.set(out, u, y, z, k) }
  if (p.flash && tip) {
    // Fogonazo: núcleo blanco de su luz pegado a la boca, una cruz alrededor y las puntas en el tono oscuro
    const n = p.flash, len = p.long ? n + 2 : n
    for (let d = 1; d <= len; d++) put(0, tip.y - d, tip.z, d <= Math.ceil(len / 2) ? hot : mid)
    for (let d = 1; d < n; d++) {
      const y = tip.y - 1 - (p.long ? 0 : 1)
      put(0, y, tip.z + d, d === n - 1 ? dim : mid); put(0, y, tip.z - d, d === n - 1 ? dim : mid)
      const side = p.wide ? n + 1 : p.long ? 0 : d
      for (let s = 1; s <= side; s++) { put(s, y - (p.wide ? s : 0), tip.z, s >= side ? dim : mid); put(-s, y - (p.wide ? s : 0), tip.z, s >= side ? dim : mid) }
    }
  }
  if (p.trail && tip) for (let d = 1; d <= 4; d++) put(0, tip.y + d + 2, tip.z + 1, d <= 2 ? mid : dim)
  if (p.impact && tip) {
    for (const [du, dy, dz] of [[0, -1, 0], [1, -1, 1], [-1, -1, 1], [0, -2, -1], [2, 0, 0], [-2, 0, 0]]) put(tip.u + du, tip.y + dy, tip.z + dz, hot)
    for (const [du, dy, dz] of [[0, -3, 0], [3, -1, 1], [-3, -1, 1]]) put(tip.u + du, tip.y + dy, tip.z + dz, dim)
  }
  return out
}

// Las capas de cada pose arrancan en la z del arma quieta (ver POSES)
for (const [id, kind] of Object.entries(ANIM)) {
  const { vox: m, z0 } = layers(id)
  const ramp = lightRamp(m)
  POSES[kind].forEach((p, i) => vox.layers(`${id}-anim${i}`, vox.shift(pose(m, p, ramp), 0, 0, -z0), { w: GRID, h: GRID }))
}
