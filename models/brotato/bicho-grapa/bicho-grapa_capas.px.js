// Bicho grapa en vóxeles, capa por capa, para el Brotato sobre VoxPix (FERN, 2026-10-25).
//
// Una grapa con vida: la corona (la barra de arriba) es el cuerpo y las dos patas de la grapa son sus patas, con
// el pie doblado hacia fuera. Anda de lado, como un cangrejo, "directo a por ti". Mide 13 de ancho, 7 de fondo (con
// los ojos) y 11 de alto: radio de colisión 5 en el juego. Corona de 6 de fondo para que de lado se lea como un
// bloque con dos patas (revisión de NARUTO, 2026-10-25).
//
// Ejes como MAIA: cada capa z es un corte visto desde arriba, norte arriba (la espalda) y abajo el frente (mira a
// la cámara); pivote en el centro (columna MID = x 0, fila MID = y 0), los pies en z = 0.
// Importar: voxpix import-pxl bicho-grapa_capas.px.js --stack grapa bicho-grapa.json

pal({
  k: "#1c1a2e", d: "#353650", m: "#5f687a", l: "#8f99ab", h: "#c4cbd8", w: "#f4f1ee",   // acero: sombras al violeta (revisión de NARUTO), brillo cálido
  R: "#7a1426", r: "#d8314a", e: "#ff8a8a",                                             // ojos: cuenca, iris, brillo
})
ramps("kdmlhw", "Rre")
// voxpix: outline #12101c

const W = 15, H = 9, MID_X = 7, MID_Y = 4, LAYERS = 12

// ¿Qué hay en (x, y, z)? x de -7 a 7, y de -4 a 4 (negativo = frente), z de 0 a 11. Devuelve la tecla o null.
function voxel(x, y, z) {
  const ax = Math.abs(x)
  // Ojos: de 2x1, asomando un vóxel por delante de la corona (y = -4); el brillo a la izquierda de cada ojo
  if (y === -4 && z === 9 && (ax === 2 || ax === 3)) return x === -3 || x === 2 ? "e" : "r"
  // Corona: la barra de arriba, de z 8 a 10, de punta a punta, 6 de fondo (y de -3 a 2)
  if (z >= 8 && z <= 10 && ax <= 6 && y >= -3 && y <= 2) {
    if (y === -3 && z === 8 && (ax === 2 || ax === 3)) return "R"     // la cuenca, bajo cada ojo
    if (z === 10) return ax >= 6 ? "l" : y <= -2 ? "w" : "h"     // la tapa coge la luz
    if (ax === 6) return "m"                                       // los cantos, más oscuros
    return z === 8 ? "d" : "l"
  }
  // Patas: las dos puntas de la grapa, de 2x2, bajando desde la corona
  if (z >= 1 && z <= 7 && ax >= 5 && ax <= 6 && y >= -1 && y <= 0) return ax === 6 ? "d" : z >= 5 ? "l" : "m"
  // Pies: doblados hacia fuera, apoyados en el suelo
  if (z === 0 && ax >= 5 && ax <= 7 && y >= -1 && y <= 0) return ax === 7 ? "k" : "d"
  return null
}

for (let z = 0; z < LAYERS; z++) {
  sprite(`grapa_z${String(z).padStart(2, "0")}`, { w: W, h: H }, (c) => {
    for (let y = -MID_Y; y <= MID_Y; y++) for (let x = -MID_X; x <= MID_X; x++) {
      const k = voxel(x, y, z)
      if (k) c.px(x + MID_X, MID_Y - y, k)
    }
  })
}
