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
