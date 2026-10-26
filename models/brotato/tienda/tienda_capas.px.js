// Entradas a la tienda en vóxeles (FERN, 2026-10-25; encargo de Andrés): el objeto del mapa que brilla cuando la
// oleada queda limpia y al que MAIA se acerca para entrar en la tienda. En el medieval es la fuente (la pone VoxPix);
// en los otros dos mundos, un adorno del mismo tamaño de huella (cabe en un círculo de radio 10):
//   impresora  -> oficina: fotocopiadora grande de pie, con bandejas de papel, escáner y su panel con pantalla
//   servidor   -> cyberpunk: rack doble de servidores en cromo negro, con luces de neón y cables por arriba
// Ejes como MAIA: cada capa z es un corte visto desde arriba, norte arriba y abajo el frente; pivote en el centro.
// Importar: voxpix import-pxl tienda_capas.px.js --stack impresora impresora.json (y servidor)

pal({
  K: "#16161e", D: "#34343f", M: "#62626f", L: "#9a9ca8", H: "#c8cad2", W: "#eeeff4",   // gris de oficina / cromo
  b: "#1f3f78", B: "#3a6cc8",                                                           // franja de la marca
  s: "#123a56", S: "#3ab0f0", T: "#bfeaff",                                             // pantalla (luz propia)
  g: "#1c6a2a", G: "#5ef070",                                                           // luz de encendido (luz propia)
  k: "#0e0c16", d: "#1c1a2a", m: "#2e2c44", l: "#4a4868", h: "#7c7aa4",                 // cromo negro (cyberpunk)
  p: "#7a1f6a", P: "#ff3cc8", Q: "#ffc0f0",                                             // neón rosa (luz propia)
  c: "#126a80", C: "#2ee6ff", I: "#c0f8ff",                                             // neón cian (luz propia)
})
ramps("KDMLHW", "bB", "sST", "gG", "kdmlh", "pPQ", "cCI")
// voxpix: outline #12101c
// voxpix: emissive sST gG pPQ cCI

const STACKS = {}

// ---- impresora: cuerpo 20x14 (x -10..9, y -7..6), 22 de alto. El frente (y = -7) mira a la cámara
STACKS.impresora = { w: 20, h: 15, mx: 10, my: 7, layers: 22, voxel(x, y, z) {
  if (y > 6) return null                                                   // la pila mide 15 (impar); el cuerpo, 14
  const front = y === -7, side = x === -10 || x === 9, back = y === 6
  // Pies: un zócalo oscuro metido 1
  if (z === 0) return x > -10 && x < 9 && y > -7 && y < 6 ? "K" : null
  // Cuerpo de las bandejas (z 1..12)
  if (z >= 1 && z <= 12) {
    if (front) {
      if (z === 6 || z === 12) return "D"                                 // juntas entre bandejas
      if ((z === 4 || z === 10) && x >= -3 && x <= 2) return "K"          // tiradores
      if (x === -10 || x === 9) return "M"
      return z === 1 ? "M" : "H"
    }
    if (side) return z % 4 === 0 ? "M" : "L"                              // rejillas a los lados
    if (back) return "M"
    return "L"
  }
  // La salida del papel: un hueco oscuro al frente con dos hojas que asoman (z 13..14)
  if (z >= 13 && z <= 14) {
    if (front && x >= -7 && x <= 4) return z === 13 ? "W" : "D"
    if (front) return "H"
    return side || back ? "M" : "L"
  }
  // La unidad de arriba (z 15..18), con la franja de la marca al frente
  if (z >= 15 && z <= 18) {
    if (front && z === 16) return x % 2 ? "B" : "b"
    if (front) return "H"
    return side || back ? "M" : z === 18 ? "W" : "L"
  }
  // El panel de control, delante a la derecha, con la pantalla y la luz de encendido (z 19)
  if (z === 19) {
    if (y >= -7 && y <= -4 && x >= 1 && x <= 8) {
      if (y >= -6 && y <= -5 && x >= 2 && x <= 5) return x === 2 || y === -5 ? "S" : "T"
      if (x === 7 && y === -6) return "G"
      return "D"
    }
    // la tapa del escáner, con su borde
    if (y >= -3) return x === -10 || x === 9 || y === 6 ? "M" : "W"
    return null
  }
  // El alimentador de originales, detrás a la izquierda, con hojas encima (z 20..21)
  if (z >= 20 && z <= 21 && x >= -8 && x <= 0 && y >= 0 && y <= 5) {
    if (z === 21) return x >= -7 && x <= -1 && y >= 1 && y <= 4 ? "W" : null
    return x === -8 || x === 0 || y === 5 ? "D" : "M"
  }
  return null
} }

// ---- servidor: rack doble 20x12 (x -10..9, y -6..5), 30 de alto. Dos armarios con una junta negra en medio
STACKS.servidor = { w: 20, h: 13, mx: 10, my: 6, layers: 32, voxel(x, y, z) {
  if (y > 5) return null                                                   // la pila mide 13 (impar); el rack, 12
  const front = y === -6, side = x === -10 || x === 9, back = y === 5, seam = x === -1 || x === 0
  if (z <= 1) return "k"                                                  // zócalo
  if (z >= 2 && z <= 27) {
    if (front) {
      if (side || seam) return "d"                                       // marcos de los armarios
      if (z % 3 === 1) return "k"                                        // separación entre servidores
      // Cada servidor: rejilla de cromo con luces de estado. Cian casi siempre, rosa de vez en cuando
      const u = Math.floor(z / 3)
      if (z % 3 === 2 && (x === 7 || x === -8)) return (u % 3) ? "C" : "P"
      if (z % 3 === 2 && (x === 6 || x === -7) && u % 2) return "c"
      if (z % 3 === 0 && ((x + u * 3) % 7 === 0)) return "I"
      return (x + z) % 2 ? "m" : "l"
    }
    if (side) return z % 3 === 1 ? "k" : (y % 2 ? "d" : "m")              // laterales con rejilla
    if (back) return "d"
    return "m"
  }
  // La tapa (z 28..29), con una franja de neón rosa en el canto delantero
  if (z >= 28 && z <= 29) {
    if (front && z === 28 && !seam) return "P"
    if (z === 29) return side || front || back ? "d" : "l"
    return "d"
  }
  // Cables por arriba (z 30..31): dos lazos de un armario al otro, uno cian y otro rosa
  if (z === 30 && (y === -2 || y === 2) && x >= -6 && x <= 5) return y === -2 ? "c" : "p"
  if (z === 31 && (y === -2 || y === 2) && x >= -3 && x <= 2) return y === -2 ? "C" : "P"
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
