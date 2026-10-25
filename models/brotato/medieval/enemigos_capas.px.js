// Enemigos del mundo MEDIEVAL en vóxeles: autómatas de "tecnología antigua", latón, peltre y madera (FERN,
// 2026-10-25). Mismo papel, tamaño y planta que los robots de la oficina (MAIA: las versiones por mundo son solo de
// aspecto), así que los rigs de NARUTO, que eligen las partes por geometría, valen igual. Ojos rojos: la seña de
// enemigo en todos los mundos.
//   perseguidor  (grapa robot)  -> autómata de latón: la misma barra con dos patas, remaches y una llave de cuerda
//   embestidor   (clip robot)   -> escarabajo de latón: el lomo arqueado es un caparazón lleno con cresta y cuerno
//   escupidor    (taza robot)   -> jarra de peltre: tapa abierta, aros de latón y cerveza con espuma
// Ejes como MAIA: cada capa z es un corte visto desde arriba, norte arriba y abajo el frente; pivote en el centro.
// Importar: voxpix import-pxl enemigos_capas.px.js --stack perseguidor perseguidor.json (y embestidor, escupidor)

pal({
  K: "#241612", D: "#4a2e1a", M: "#7a5228", L: "#b0823a", H: "#dcb460", W: "#fff0c8",   // latón, sombra -> brillo
  a: "#262433", b: "#4e5064", c: "#7e8296", g: "#b4b8c8", f: "#e2e4ee",                 // peltre (frío, sombras al violeta)
  y: "#6a3a10", Y: "#c07a20", U: "#f4c860", F: "#fff6e0",                                // cerveza y espuma
  R: "#7a1426", r: "#d8314a", e: "#ff8a8a",                                              // ojos
})
ramps("KDMLHW", "abcgf", "yYUF", "Rre")
// voxpix: outline #12101c

const STACKS = {}

// ---- perseguidor: autómata de latón (planta de la grapa: corona 13x6 a z 8..10, patas en |x| 5..6)
STACKS.perseguidor = { w: 15, h: 9, mx: 7, my: 4, layers: 16, voxel(x, y, z) {
  const ax = Math.abs(x)
  if (y === -4 && z === 9 && (ax === 2 || ax === 3)) return x === -3 || x === 2 ? "e" : "r"
  // Llave de cuerda encima, en el centro: el detalle que dice "autómata". Vástago de 2 y una anilla de 3x3 de
  // cara a la cámara (revisión de NARUTO: más alta para que se lea)
  if ((z === 11 || z === 12) && x === 0 && y === 0) return "M"
  if (y === 0 && z >= 13 && z <= 15 && ax <= 1 && !(z === 14 && x === 0)) return z === 15 ? "H" : "L"
  if (z >= 8 && z <= 10 && ax <= 6 && y >= -3 && y <= 2) {
    if (y === -3 && z === 8 && (ax === 2 || ax === 3)) return "R"
    if (y === -3 && (z === 8 || z === 10) && ax === 5) return "D"                // remaches en las esquinas del frente
    if (z === 10) return ax >= 6 ? "L" : y <= -2 ? "W" : "H"
    if (ax === 6) return "M"
    return z === 8 ? "D" : "L"
  }
  if (z >= 1 && z <= 7 && ax >= 5 && ax <= 6 && y >= -1 && y <= 0) return z === 4 ? "D" : ax === 6 ? "D" : z >= 5 ? "L" : "M"   // rodilla
  if (z === 0 && ax >= 5 && ax <= 7 && y >= -1 && y <= 0) return ax === 7 ? "K" : "D"
  return null
} }

// ---- embestidor: escarabajo de latón (planta del clip: lomo arqueado 13x19, patas en x ±5)
const track = (x, y, cx, y0, y1) => Math.hypot(x - cx, y - Math.min(Math.max(y, y0), y1))
const arch = (y) => 3 + Math.round(2 * Math.cos((Math.PI * Math.min(Math.abs(y), 7)) / 14))
STACKS.embestidor = { w: 13, h: 21, mx: 6, my: 10, layers: 11, voxel(x, y, z) {
  const ax = Math.abs(x)
  const zf = arch(-7)
  if (y === -8 && (ax === 2 || ax === 3)) {
    if (z === zf + 2) return x === -3 || x === 2 ? "e" : "r"
    if (z === zf + 1) return "r"
    if (z === zf) return "R"
  }
  // Cuerno: sale del frente, entre los ojos, y sube
  if (x === 0 && ((y === -8 && z >= zf + 1 && z <= zf + 2) || (y === -9 && z === zf + 3))) return y === -9 ? "W" : "H"
  // Caparazón: el óvalo del clip, lleno, 2 de alto, con la cresta en el centro
  const inShell = track(x, y, 0, -2, 2) < 5.5
  const h = arch(y)
  if (inShell && (z === h || z === h + 1)) {
    if (z === h) return "D"
    if (x === 0) return "M"                                  // cresta: la juntura de las alas
    return y < 0 ? (ax <= 2 ? "W" : "H") : ax <= 2 ? "H" : "L"
  }
  for (const ly of [-3, 0, 3]) {
    if (y !== ly) continue
    if (ax === 5 && z >= 1 && z <= arch(ly) - 1) return "D"
    if (ax === 6 && z === 0) return "K"
  }
  return null
} }

// ---- escupidor: jarra de peltre (planta de la taza: cilindro de radio 5,2, asa a la derecha)
STACKS.escupidor = { w: 15, h: 15, mx: 6, my: 7, layers: 13, voxel(x, y, z) {
  const d = Math.hypot(x, y), R = 5.2
  const shell = d < R && d >= R - 1.6
  if (y === -6 && (Math.abs(x) === 2 || Math.abs(x) === 3)) {
    if (z === 7) return x === -3 || x === 2 ? "e" : "r"
    if (z === 6) return "r"
  }
  if (z === 0 && d < R - 0.5) return "b"
  if (z >= 1 && z <= 10 && shell) {
    if (y <= -4 && z === 5 && (Math.abs(x) === 2 || Math.abs(x) === 3)) return "R"
    if (z === 2 || z === 9) return y < 0 ? "H" : "L"                           // aros de latón
    if (z === 10) return "f"
    return x < 0 || y < -2 ? "g" : "c"
  }
  // Cerveza con espuma a un vóxel del borde
  if (z === 9 && d < R - 1.6) return d < 2 ? "F" : "U"
  if (z === 8 && d < R - 1.6) return "Y"
  // Tapa abierta: un disco levantado sobre la mitad de atrás, con la bisagra junto al asa
  if (z === 11 && d < R && y >= 2) return "c"
  if (z === 12 && d < R - 1 && y >= 3) return "g"
  if (x >= 5 && x <= 8 && (y === -1 || y === 0) && z >= 3 && z <= 8) {
    const bar = z === 3 || z === 8
    if (x === 8 || (bar && x >= 6)) return y === -1 ? "g" : "c"
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
