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
  // Escopeta de pulsos: cuerpo corto, boca ancha y bandas cian
  abanico: { grip: [3, 4], half: { default: 1, w: 2 }, rows: [
    "...dhhhhhhhhhhhhhhw",
    "..dmmCCmmCCmmmmmmlw",
    "..dmmmmmmmmmmmmmmlw",
    "..ddmmmmdd.........",
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

const GRID = 28, MID = 14

function layers(id) {
  const def = WEAPONS[id]
  const [gx, gy] = def.grip
  const vox = new Map()
  def.rows.forEach((row, r) => [...row].forEach((k, c) => {
    if (k === ".") return
    const half = def.half[k] ?? def.half.default
    for (let u = -half; u <= half; u++) vox.set(`${u},${-(c - gx)},${gy - r}`, k)
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
