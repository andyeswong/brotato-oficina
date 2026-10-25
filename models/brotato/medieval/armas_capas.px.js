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

const GRID = 28, MID = 14

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
