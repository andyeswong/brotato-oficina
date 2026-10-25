// Enemigos del mundo CYBERPUNK en vóxeles: robots de cromo oscuro con neón (FERN, 2026-10-25). Mismo papel, tamaño
// y planta que los robots de la oficina (MAIA: las versiones por mundo son solo de aspecto), así que los rigs de
// NARUTO valen igual. Ojos rojos: la seña de enemigo en todos los mundos.
//   perseguidor  -> grapa de cromo: la barra con una franja de neón rosa delante y luces cian en los pies
//   embestidor   -> escarabajo de cromo: caparazón negro con franjas cian a los lados y visera rosa
//   escupidor    -> vaso de café para llevar: tapa, funda con el logo de neón y un cable por asa
// Ejes como MAIA: cada capa z es un corte visto desde arriba, norte arriba y abajo el frente; pivote en el centro.
// Importar: voxpix import-pxl enemigos_capas.px.js --stack perseguidor perseguidor.json (y embestidor, escupidor)

pal({
  K: "#0e0c16", D: "#1c1a2a", M: "#2e2c44", L: "#4a4868", H: "#7c7aa4", W: "#c8c8f0",   // cromo oscuro, sombra -> brillo
  p: "#7a1f6a", P: "#ff3cc8", Q: "#ffc0f0",                                            // neón rosa (luz propia)
  c: "#126a80", C: "#2ee6ff", I: "#c0f8ff",                                            // neón cian (luz propia)
  t: "#5a4030", T: "#9a7050", u: "#d8c8b0", v: "#f4ece0",                              // vaso de cartón y tapa
  R: "#7a1426", r: "#d8314a", e: "#ff8a8a",                                            // ojos
})
ramps("KDMLHW", "pPQ", "cCI", "tTuv", "Rre")
// voxpix: outline #12101c
// voxpix: emissive pPQ cCI

const STACKS = {}

// ---- perseguidor (planta de la grapa: corona 13x6 a z 8..10, patas en |x| 5..6)
STACKS.perseguidor = { w: 15, h: 9, mx: 7, my: 4, layers: 11, voxel(x, y, z) {
  const ax = Math.abs(x)
  if (y === -4 && z === 9 && (ax === 2 || ax === 3)) return x === -3 || x === 2 ? "e" : "r"
  if (z >= 8 && z <= 10 && ax <= 6 && y >= -3 && y <= 2) {
    if (y === -3 && z === 8 && (ax === 2 || ax === 3)) return "R"
    if (y === -3 && z === 10) return ax % 2 ? "P" : "Q"                       // franja de neón en el canto delantero
    if (z === 10) return ax >= 6 ? "L" : y <= -2 ? "W" : "H"
    if (ax === 6) return "M"
    return z === 8 ? "D" : "L"
  }
  if (z >= 1 && z <= 7 && ax >= 5 && ax <= 6 && y >= -1 && y <= 0) return ax === 6 ? "D" : z >= 5 ? "L" : "M"
  if (z === 0 && ax >= 5 && ax <= 7 && y >= -1 && y <= 0) return ax === 7 ? "C" : "c"   // pies con luz
  return null
} }

// ---- embestidor (planta del clip: lomo arqueado 13x19, patas en x ±5)
const track = (x, y, cx, y0, y1) => Math.hypot(x - cx, y - Math.min(Math.max(y, y0), y1))
const arch = (y) => 3 + Math.round(2 * Math.cos((Math.PI * Math.min(Math.abs(y), 7)) / 14))
STACKS.embestidor = { w: 13, h: 21, mx: 6, my: 10, layers: 10, voxel(x, y, z) {
  const ax = Math.abs(x)
  const zf = arch(-7)
  if (y === -8 && (ax === 2 || ax === 3)) {
    if (z === zf + 2) return x === -3 || x === 2 ? "e" : "r"
    if (z === zf + 1) return "r"
    if (z === zf) return "R"
  }
  // Visera rosa entre los ojos
  if (y === -8 && ax <= 1 && (z === zf + 1 || z === zf + 2)) return z === zf + 2 ? "Q" : "P"
  const dist = track(x, y, 0, -2, 2)
  const h = arch(y)
  if (dist < 5.5 && (z === h || z === h + 1)) {
    if (z === h) return dist > 4.5 ? "C" : "D"                                // franja cian por debajo del borde
    if (dist > 4.5) return "c"
    return y < 0 ? (ax <= 2 ? "W" : "H") : ax <= 2 ? "H" : "L"
  }
  for (const ly of [-3, 0, 3]) {
    if (y !== ly) continue
    if (ax === 5 && z >= 1 && z <= arch(ly) - 1) return "M"
    if (ax === 6 && z === 0) return "K"
  }
  return null
} }

// ---- escupidor: vaso para llevar (planta de la taza: cilindro de radio 5,2, asa a la derecha)
STACKS.escupidor = { w: 15, h: 15, mx: 6, my: 7, layers: 12, voxel(x, y, z) {
  const d = Math.hypot(x, y), R = 5.2
  const shell = d < R && d >= R - 1.6
  if (y === -6 && (Math.abs(x) === 2 || Math.abs(x) === 3)) {
    if (z === 7) return x === -3 || x === 2 ? "e" : "r"
    if (z === 6) return "r"
  }
  if (z === 0 && d < R - 0.5) return "t"
  if (z >= 1 && z <= 9 && shell) {
    if (y <= -4 && z === 5 && (Math.abs(x) === 2 || Math.abs(x) === 3)) return "R"
    // Funda con el logo de neón: una franja cian con un rombo rosa delante
    if (z >= 2 && z <= 4) {
      if (y <= -4 && Math.abs(x) <= 1) return z === 3 ? "Q" : "P"
      return z === 3 ? "C" : "c"
    }
    return x < 0 || y < -2 ? "u" : "T"
  }
  // Tapa: un disco un poco más ancho, con la boquilla delante
  if (z === 10 && d < R + 0.3) return y < -1 ? "v" : "u"
  if (z === 11 && d < R - 1.2) return d < 1.5 && y < 0 ? "M" : "v"
  // Asa: un cable negro con una luz rosa
  if (x >= 5 && x <= 8 && (y === -1 || y === 0) && z >= 3 && z <= 8) {
    const bar = z === 3 || z === 8
    if (x === 8 && z === 6) return "P"
    if (x === 8 || (bar && x >= 6)) return y === -1 ? "L" : "M"
  }
  return null
} }

for (const [id, s] of Object.entries(STACKS)) {
  for (let z = 0; z < s.layers; z++) {
    sprite(`${id}_z${String(z).padStart(2, "0")}`, { w: s.w, h: s.h }, (c) => {
      for (let y = -s.my; y < s.h - s.my; y++) for (let x = -s.mx; x < s.w - s.mx; x++) {
        const k = s.voxel(x, y, z)
        if (k) c.px(x + s.mx, s.my - y, k)
      }
    })
  }
}
