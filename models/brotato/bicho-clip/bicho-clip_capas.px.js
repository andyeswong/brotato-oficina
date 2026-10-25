// Bicho clip en vóxeles, capa por capa, para el Brotato sobre VoxPix (FERN, 2026-10-25).
//
// Un clip tumbado con patas de alambre: los dos lazos del clip, uno dentro del otro, hacen de lomo, y la curva de
// delante es la cabeza, con dos ojos rojos. Se para, tiembla y embiste en línea recta. Revisión de NARUTO
// (2026-10-25): el alambre de fuera es de 2 de ancho y hueco (por dentro se ve el suelo), el de dentro va en un tono
// más oscuro para separar los lazos, y el lomo se arquea como una oruga a medio paso (más alto en el medio). Mide 11
// de ancho, 17 de largo (con los ojos) y 9 de alto: radio de colisión 6 en el juego.
//
// Ejes como MAIA: cada capa z es un corte visto desde arriba, norte arriba (la cola) y abajo el frente (la
// cabeza, que mira a la cámara); pivote en el centro, los pies en z = 0.
// Importar: voxpix import-pxl bicho-clip_capas.px.js --stack clip bicho-clip.json

pal({
  k: "#1c1a2e", d: "#353650", m: "#5f687a", l: "#8f99ab", h: "#c4cbd8", w: "#f4f1ee",   // acero: sombras al violeta (revisión de NARUTO), brillo cálido
  R: "#7a1426", r: "#d8314a", e: "#ff8a8a",                                             // ojos: cuenca, iris, brillo
})
ramps("kdmlhw", "Rre")
// voxpix: outline #12101c
// voxpix: emissive Rre   (ojos encendidos: la seña de enemigo se lee en lo oscuro, NARUTO)

const W = 13, H = 19, MID_X = 6, MID_Y = 9, LAYERS = 10

// Distancia de (x, y) al segmento vertical x = cx, y de y0 a y1 (una pista de carreras alrededor de él)
function track(x, y, cx, y0, y1) {
  const yy = Math.min(Math.max(y, y0), y1)
  return Math.hypot(x - cx, y - yy)
}
// Alambre de fuera (2 de ancho) y de dentro (1, abierto por detrás) en (x, y): "o", "i" o null
function wire(x, y) {
  if (Math.abs(track(x, y, 0, -2, 2) - 4.5) < 1) return "o"
  if (Math.abs(track(x, y, 0, -1, 2) - 2) < 0.55 && !(y > 3 && x > 0)) return "i"
  return null
}
// Altura del lomo según lo lejos que esté del medio: arqueado, 2 más alto en el centro
const arch = (y) => 3 + Math.round(2 * Math.cos((Math.PI * Math.min(Math.abs(y), 7)) / 14))

function voxel(x, y, z) {
  const ax = Math.abs(x)
  // Ojos: de 2x2, asomando por delante de la curva (y = -8); el brillo arriba a la izquierda, la cuenca debajo
  const zf = arch(-7)
  if (y === -8 && (ax === 2 || ax === 3)) {
    if (z === zf + 2) return x === -3 || x === 2 ? "e" : "r"
    if (z === zf + 1) return "r"
    if (z === zf) return "R"
  }
  // Lomo: el alambre, 2 de alto, a la altura del arco
  const w = wire(x, y), h = arch(y)
  if (w && (z === h || z === h + 1)) {
    if (w === "i") return z === h + 1 ? "m" : "d"                       // el lazo de dentro, más oscuro
    return z === h + 1 ? (y < 0 ? "w" : "h") : "m"
  }
  // Patas: tres pares de alambre que bajan del lazo de fuera hasta el suelo y se apoyan hacia fuera
  for (const ly of [-3, 0, 3]) {
    if (y !== ly) continue
    const top = arch(ly) - 1
    if (ax === 5 && z >= 1 && z <= top) return "d"
    if (ax === 6 && z === 0) return "k"
  }
  return null
}

for (let z = 0; z < LAYERS; z++) {
  sprite(`clip_z${String(z).padStart(2, "0")}`, { w: W, h: H }, (c) => {
    for (let y = -MID_Y; y <= MID_Y; y++) for (let x = -MID_X; x <= MID_X; x++) {
      const k = voxel(x, y, z)
      if (k) c.px(x + MID_X, MID_Y - y, k)
    }
  })
}
