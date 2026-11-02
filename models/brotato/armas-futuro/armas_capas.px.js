// Armas futuristas del Brotato en vóxeles, capa por capa, para VoxPix (FERN, 2026-10-25).
//
// Andrés: "tus armas no me convencen ... haz armas futuristas reales". Sustituyen al buzón, la grapadora y la regla
// conservando su papel en el juego (y su largo del agarre a la punta, que usa la simulación):
//   pistola de plasma  (era el buzón)      disparo lento y fuerte          agarre -> punta 14
//   subfusil de agujas (era la grapadora)  ráfaga rápida y floja           agarre -> punta 17
//   hoja de energía    (era la regla)      estocada corta                  agarre -> punta 19
// más sus proyectiles: el bólido de plasma y la aguja.
//
// Metal pizarra con sombras al violeta (como MAIA y los bichos) y brillos de energía: cian el plasma y la hoja,
// magenta el subfusil. Cada perfil es el arma vista de lado (filas de arriba abajo, la punta a la derecha), y se
// extruye hacia los lados; cada tecla puede tener su grueso. La punta mira al frente (y negativo) y el agarre queda
// en el origen. Cada capa z es un corte visto desde arriba (norte arriba). Importar:
//   voxpix import-pxl armas_capas.px.js --stack pistola pistola.json   (y subfusil, hoja, bolido, aguja)

pal({
  D: "#1c1a2e", d: "#2b2a44", m: "#45475f", l: "#6e7591", h: "#a7afc6", w: "#eef0f6",   // metal, sombra -> brillo
  c: "#1e7fa8", C: "#3ae0ff", i: "#c8f8ff",                                             // energía cian
  p: "#7a1f96", P: "#e04cff", q: "#ffd0ff",                                             // energía magenta
})
ramps("Ddmlhw", "cCi", "pPq")
// voxpix: outline #12101c
// voxpix: emissive cCi pPq
// (la energía brilla sola: con luz 1 no se apaga en las zonas oscuras; el metal no)

// half: medio grueso lateral por tecla (0 = 1 vóxel, 1 = 3, 2 = 5); grip: [columna, fila] del agarre
const WEAPONS = {
  // Pistola compacta: cañón con una bobina de plasma a la vista, célula de energía encima, empuñadura inclinada
  pistola: { grip: [3, 4], half: { default: 1, C: 1, i: 0, c: 1 }, rows: [
    "....dddddd........",
    "...dlhhhhhhhhhhh..",
    "..dlmmCiCiCimmmhw.",
    "..dmmmCCCCCCmmmlw.",
    "..ddmmmmmmmmmmdd..",
    "...dddd.dd........",
    "...dmd..d.........",
    "..dmmd............",
    "..dmd.............",
    "..DDD.............",
  ] },
  // Subfusil: cuerpo largo y bajo, raíl de energía magenta, cargador delante del agarre, culata corta
  subfusil: { grip: [4, 4], half: { default: 1 }, rows: [
    "......hPPhhqPhhPPh......",
    "ll..llhwwwwwwwwwwhh.....",
    "lmllmmPPqqPPqqPPmmmlhhw.",
    "dmmmmmmmmmmmmmmmmmmmlll.",
    ".ddddmddmmmdddddd.......",
    "....dmd..dmd............",
    "....dmd..dmd............",
    "...dmd...dmd............",
    "...DDD...DDD............",
  ] },
  // Hoja de energía: empuñadura con guarda y una hoja de luz de 1 de grueso; el filo brilla más arriba
  hoja: { grip: [1, 2], half: { default: 1, C: 0, i: 0, c: 0 }, rows: [
    "....h................",
    "....hiiiiiiiiiiiiiiii",
    "dmmmhCCCCCCCCCCCCCCC.",
    "dmmmhcccccccccccccc..",
    "....h................",
  ] },
  // Proyectiles: bólido de plasma (núcleo blanco) y aguja magenta
  bolido: { grip: [1, 1], half: { default: 1, i: 1 }, rows: [
    ".C.",
    "CiC",
    ".C.",
  ] },
  aguja: { grip: [0, 0], half: { default: 0 }, rows: [
    "ppPq",
  ] },
  // ---- Catálogo 2 (borrador, 2026-10-25): abanico 15, perforador 22, barrido 16 del agarre a la punta
  // Escopeta de pulsos: doble cañón (5 de ancho con el hueco del medio, más ancho que la pistola) y corredera con
  // bandas cian debajo (revisión de NARUTO: sin eso se confundía con la pistola de plasma)
  abanico: { grip: [3, 4], half: { default: 1 }, lat: { w: [-2, -1, 1, 2] }, rows: [
    "...dhhhhhhwwwwwwwww",
    "..dmmCCmmmwwwwwwwww",
    "..dmmmmmmlllllllll.",
    "..ddmmmmdd.CClCCl..",
    "...dmd.............",
    "..dmmd.............",
    "..dmd..............",
    "..DDD..............",
  ] },
  // Rifle de agujas largo: mira con lente magenta y cañón largo con una ventana cian
  perforador: { grip: [7, 4], half: { default: 1 }, rows: [
    "...........hhhhhh.............",
    "...........mPPPPm.............",
    "dd...dhhhhhhhhhhhhhhhhhhhhhhhw",
    "dmddmmmmmmmCCCmmmmmmmmmmmmmmlw",
    "dmmmmmmmdd....................",
    ".....dmd......................",
    "....dmmd......................",
    "....DDD.......................",
  ] },
  // Martillo de energía: mango largo y cabeza ancha con el núcleo cian
  barrido: { grip: [1, 2], half: { default: 1, h: 3, i: 3, C: 3, D: 3 }, rows: [
    "............hhhhhh",
    "............hiCCih",
    "Ddmmmmmmmmmmhiiiih",
    "............hiCCih",
    "............DDDDDD",
  ] },
  pulso: { grip: [0, 0], half: { default: 0 }, rows: ["Ci"] },
  aguja2: { grip: [0, 0], half: { default: 0 }, rows: ["pPPPq"] },
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
const GLOWS = ["cCi", "pPq"]   // las rampas de luz propia
const ANIM = { pistola: "tiro", subfusil: "rafaga", abanico: "abanico", perforador: "perforador", hoja: "estocada", barrido: "barrido" }
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
