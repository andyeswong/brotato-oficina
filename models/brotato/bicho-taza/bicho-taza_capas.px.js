// Bicho taza en vóxeles, capa por capa, para el Brotato sobre VoxPix (FERN, 2026-10-25).
//
// Una taza de oficina con ojos: cerámica clara con una franja de color, el asa a un lado y el café dentro, que es
// lo que escupe. Se queda lejos y dispara. Mide 14 de ancho (con el asa), 11 de fondo y 11 de alto: radio de
// colisión 6 en el juego.
//
// Ejes como MAIA: cada capa z es un corte visto desde arriba, norte arriba (la espalda) y abajo el frente (la cara,
// que mira a la cámara); pivote en el centro de la taza, el culo en z = 0.
// Importar: voxpix import-pxl bicho-taza_capas.px.js --stack taza bicho-taza.json

pal({
  k: "#2a2438", d: "#847d96", m: "#b8b0c0", l: "#ddd6e2", w: "#f6f2f8",               // cerámica: sombras al violeta (revisión de NARUTO)
  B: "#1f4a6e", b: "#2f6fa0",                                                          // la franja
  C: "#2a160c", c: "#5a3018", o: "#8a5228",                                            // café
  R: "#7a1426", r: "#d8314a", e: "#ff8a8a",                                            // ojos
})
ramps("kdmlw", "Bb", "Cco", "Rre")
// voxpix: outline #12101c
// voxpix: emissive Rre   (ojos encendidos: la seña de enemigo se lee en lo oscuro, NARUTO)

const W = 15, H = 14, MID_X = 6, MID_Y = 7, LAYERS = 11
const RADIUS = 5.2

function voxel(x, y, z) {
  const d = Math.hypot(x, y)
  const shell = d < RADIUS && d >= RADIUS - 1.6
  // Ojos: de 2x2, asomando un vóxel por delante de la pared (y = -6); el brillo arriba a la izquierda, la cuenca
  // oscura debajo para que no se fundan con el blanco (revisión de NARUTO: de 1 px parecían gotas de sangre)
  if (y === -6 && (Math.abs(x) === 2 || Math.abs(x) === 3)) {
    if (z === 7) return x === -3 || x === 2 ? "e" : "r"
    if (z === 6) return "r"
  }
  // Culo de la taza (z 0): el disco entero
  if (z === 0 && d < RADIUS - 0.5) return "d"
  // Pared: 1-2 vóxeles de grueso, de z 1 a 10
  if (z >= 1 && z <= 10 && shell) {
    if (y <= -4 && z === 5 && (Math.abs(x) === 2 || Math.abs(x) === 3)) return "R"   // la cuenca, bajo cada ojo
    if (z === 3 || z === 4) return y < 0 ? "b" : "B"                 // la franja
    if (z === 10) return "w"                                         // el borde coge la luz
    return x < 0 || y < -2 ? "l" : "m"                               // luz arriba a la izquierda, como el juego
  }
  // Café: a un vóxel del borde, para que se lea desde la cámara alta
  if (z === 9 && d < RADIUS - 1.6) return d < 1.5 ? "o" : "c"
  if (z === 8 && d < RADIUS - 1.6) return "C"
  // Asa: un aro a la derecha (x positivo), 2 de grueso (y -1 y 0), de z 3 a 8, con el hueco en medio
  if (x >= 5 && x <= 8 && (y === -1 || y === 0) && z >= 3 && z <= 8) {
    const bar = z === 3 || z === 8
    if (x === 8 || (bar && x >= 6)) return y === -1 ? "l" : "m"
  }
  return null
}

for (let z = 0; z < LAYERS; z++) {
  sprite(`taza_z${String(z).padStart(2, "0")}`, { w: W, h: H }, (c) => {
    for (let y = -MID_Y; y <= MID_Y; y++) for (let x = -MID_X; x <= W - MID_X - 1; x++) {
      const k = voxel(x, y, z)
      if (k) c.px(x + MID_X, MID_Y - y, k)
    }
  })
}
