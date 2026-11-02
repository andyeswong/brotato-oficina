// Armas del mundo MEDIEVAL en vóxeles: "tecnología antigua", madera, acero y latón con runas que brillan (FERN,
// 2026-10-25). Mismo papel y mismo largo del agarre a la punta que las de la oficina (MAIA: las versiones por mundo
// son solo de aspecto):
//   tiro      -> ballesta de energía: arco de latón cruzado, virote de luz ámbar        agarre -> punta 14
//   rafaga    -> repetidora rúnica: tres cañones cortos y runas verdes en la caja       agarre -> punta 17
//   estocada  -> espada rúnica: guarda de latón y runas ámbar en la hoja               agarre -> punta 19
// más sus proyectiles: el virote y la chispa rúnica. Perfil de lado (filas de arriba abajo, la punta a la derecha)
// extruido hacia los lados, cada tecla con su grueso; la punta mira al frente y el agarre queda en el origen.
// Importar: voxpix import-pxl armas_capas.px.js --stack tiro tiro.json (y rafaga, estocada, virote, chispa)

pal({
  k: "#2a1810", w: "#6a4224", W: "#9a6a3a",                          // madera
  s: "#5a6070", S: "#a0a8b8", T: "#e4e8f0",                          // acero (sombras al violeta)
  B: "#b0823a", N: "#e0b45a",                                        // latón
  a: "#8a4a10", A: "#f0a030", U: "#fff0b0",                          // runa ámbar (luz propia)
  g: "#1a6a3a", G: "#4af08a", V: "#d0ffe0",                          // runa verde (luz propia)
})
ramps("kwW", "sST", "BN", "aAU", "gGV")
// voxpix: outline #12101c
// voxpix: emissive aAU gGV

const WEAPONS = {
  // Ballesta: caja de madera, arco de latón cruzado delante (ancho, 9 de lado a lado) y el virote de luz encima,
  // asomando 2 por delante del arco (revisión de NARUTO: sin eso se leía como una cruz sin proyectil)
  tiro: { grip: [3, 4], half: { default: 1, B: 4, N: 4, a: 1, A: 1, U: 1 }, rows: [
    "....aAUAAUAAUAAUAU",
    "..kWWWWWWWWWWWNNW.",
    "..kwwwwwwwwwwwBBw.",
    "...wwk.......BB...",
    "..www.............",
    "..ww..............",
    "..kk..............",
  ] },
  // Repetidora: tres cañones cortos de acero, una banda de latón, culata de madera y las runas verdes en una franja
  // de 2 a lo largo del cañón (revisión de NARUTO: sueltas eran 1-2 píxeles)
  rafaga: { grip: [4, 3], half: { default: 1 }, rows: [
    "......TSSSSSSSSSSSSSSS",
    "ww..wwBGVGGVGBGVGGVGGT",
    "wwwwwwwwwwwwwBGGGGGGGS",
    ".wwwwwwwwwww..........",
    "....wwk...............",
    "....ww................",
    "...www................",
    "...kkk................",
  ] },
  // Espada: empuñadura de madera, guarda de latón ancha y hoja de acero de 1 de grueso con runas ámbar
  estocada: { grip: [1, 1], half: { default: 1, B: 2, N: 2, S: 0, s: 0, A: 0, T: 0 }, rows: [
    "....N................",
    "kwwwBTTTTTTTTTTTTTTTT",
    "kwwwBsAssAssAssAsss..",
    "....B................",
  ] },
  virote: { grip: [0, 0], half: { default: 0 }, rows: [
    "aAAU",
  ] },
  chispa: { grip: [1, 1], half: { default: 1, V: 1 }, rows: [
    ".G.",
    "GVG",
    ".G.",
  ] },
  // ---- Catálogo 2 (borrador, 2026-10-25): abanico 15, perforador 22, barrido 16 del agarre a la punta
  // Trabuco: caja de madera, cañón fino de acero y la boca acampanada de latón, que abre a 3x3 en los 2 últimos
  // vóxeles: es lo que hace leer "trabuco" (revisión de NARUTO)
  abanico: { grip: [3, 4], half: { default: 1, S: 0, B: 1, N: 1 }, rows: [
    ".................NN",
    "..kWWWWWSSSSSSSSBNN",
    "..kwwwwww........NN",
    "...wwk.............",
    "..www..............",
    "..ww...............",
    "..kk...............",
  ] },
  // Arcabuz rúnico largo: cañón de acero con una franja de runas verdes y culata de madera
  perforador: { grip: [7, 4], half: { default: 1 }, rows: [
    ".....WWWWWTTTTTTTTTTTTTTTTTTTT",
    "kW..wwwwwwSGGGGGGGGGGGGGGGGGGS",
    "kwwwwwwwwwssssssssssssssssssss",
    ".kwwwwwwk.....................",
    ".......w......................",
    "......ww......................",
    ".....kk.......................",
  ] },
  // Hacha de batalla: mango de madera y una cabeza de acero en media luna de 6 de alto, con el filo de runas ámbar
  // a lo largo (revisión de NARUTO: la de antes era pequeña)
  barrido: { grip: [1, 2], half: { default: 1 }, rows: [
    "..............sSA.",
    ".............sSSSA",
    "kwwwwwwwwwwwBBSSSA",
    ".............sSSSA",
    "..............sSA.",
    "...............A..",
  ] },
  metralla: { grip: [0, 0], half: { default: 0 }, rows: ["BN"] },
  arpon: { grip: [0, 0], half: { default: 0 }, rows: ["gGGV"] },
}

// 64 y no 28: con 28 (centro 14) todo lo que pasaba de 13 vóxeles por delante del agarre se recortaba sin avisar;
// el rifle perdía 9 y las hojas 6 (MAIA, 2026-10-29). Cambiar el lienzo no mueve el modelo: va centrado en MID
const GRID = 64, MID = 32

function layers(id) {
  const def = WEAPONS[id]
  const [gx, gy] = def.grip
  const vox = new Map()
  def.rows.forEach((row, r) => [...row].forEach((k, c) => {
    if (k === ".") return
    // lat: columnas laterales por tecla (un doble cañón deja el hueco del medio); si no, de -half a half
    const half = def.half[k] ?? def.half.default
    const lat = def.lat?.[k] ?? Array.from({ length: 2 * half + 1 }, (_, i) => i - half)
    for (const u of lat) vox.set(`${u},${-(c - gx)},${gy - r}`, k)
  }))
  const zs = [...vox.keys()].map((s) => Number(s.split(",")[2]))
  return { vox, z0: Math.min(...zs), z1: Math.max(...zs) }
}

// Las capas van de z0 a z1 y se nombran desde 00 (el importador apila desde z = 0): en el modelo el vóxel más bajo
// queda en z = 0 y el agarre, a la altura -z0.
for (const id of Object.keys(WEAPONS)) {
  const { vox, z0, z1 } = layers(id)
  for (let z = z0; z <= z1; z++) {
    sprite(`${id}_z${String(z - z0).padStart(2, "0")}`, { w: GRID, h: GRID }, (c) => {
      for (const [key, k] of vox) {
        const [x, y, zz] = key.split(",").map(Number)
        if (zz === z) c.px(x + MID, MID - y, k)
      }
    })
  }
}

// ---- Poses de animación (MAIA, 2026-10-29) ----
const GLOWS = ["aAU", "gGV"]   // las rampas de luz propia
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

function pose(vox, p, ramp) {
  const th = ((p.yaw ?? 0) * Math.PI) / 180, cos = Math.cos(th), sin = Math.sin(th)
  let R = 0
  for (const key of vox.keys()) { const [u, y] = key.split(",").map(Number); R = Math.max(R, Math.ceil(Math.hypot(u, y)) + 1) }
  const zs = [...new Set([...vox.keys()].map((s) => Number(s.split(",")[2])))]
  const out = new Map()
  // Girar (u, y) un ángulo th alrededor del agarre con muestreo inverso, para que no queden agujeros
  for (const z of zs) for (let u = -R; u <= R; u++) for (let y = -R; y <= R; y++) {
    const su = Math.round(u * cos + y * sin), sy = Math.round(-u * sin + y * cos)
    let k = vox.get(`${su},${sy},${z}`)
    if (!k) continue
    if (p.glow) for (const r of GLOWS) { const i = r.indexOf(k); if (i >= 0 && i < r.length - 1) { k = r[i + 1]; break } }
    out.set(`${u},${y + (p.back ?? 0)},${z + (p.lift ?? 0)}`, k)
  }
  // La boca: el vóxel más adelantado (en la fila de en medio si hay varios)
  let tip = null
  for (const key of out.keys()) {
    const [u, y, z] = key.split(",").map(Number)
    if (!tip || y < tip.y || (y === tip.y && Math.abs(u) < Math.abs(tip.u))) tip = { u, y, z }
  }
  const [dim, mid, hot] = [ramp[0], ramp[1], ramp[ramp.length - 1]]
  const put = (u, y, z, k) => { if (!out.has(`${u},${y},${z}`)) out.set(`${u},${y},${z}`, k) }
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

for (const [id, kind] of Object.entries(ANIM)) {
  const { vox, z0 } = layers(id)
  const ramp = lightRamp(vox)
  POSES[kind].forEach((p, i) => {
    const out = pose(vox, p, ramp)
    const zs = [...out.keys()].map((s) => Number(s.split(",")[2]))
    const z1 = Math.max(...zs)
    for (let z = z0; z <= z1; z++) {
      sprite(`${id}-anim${i}_z${String(z - z0).padStart(2, "0")}`, { w: GRID, h: GRID }, (c) => {
        for (const [key, k] of out) {
          const [x, y, zz] = key.split(",").map(Number)
          if (zz === z) c.px(x + MID, MID - y, k)
        }
      })
    }
  })
}
