// Piezas pequeñas del Brotato en vóxeles, una por mundo (FERN, 2026-10-25): el material que sueltan los enemigos y
// el disparo de los escupidores. Borrador para la fase 3 (vista del juego); pasan por NARUTO como el resto.
//   material   oficina: un clip suelto (acero)   medieval: una moneda (oro)   cyberpunk: un chip (verde con pistas)
//   escupitajo oficina: gota de café            medieval: gota de cerveza    cyberpunk: gota de ácido de neón
// Importar: voxpix import-pxl efectos_capas.px.js --stack material-oficina material-oficina.json (y los demás)

pal({
  d: "#353650", m: "#5f687a", l: "#8f99ab", h: "#c4cbd8",                  // acero
  o: "#8a5a10", O: "#d8a020", Y: "#ffe070",                                // oro
  g: "#0e3a22", G: "#1e8a4a", n: "#7affb0",                                // chip y ácido (el ácido brilla)
  c: "#3a1c0c", C: "#6a3a18", k: "#a8662a",                                // café
  b: "#8a5010", B: "#e09a28", W: "#fff2d0",                                // cerveza y espuma
})
ramps("dmlh", "oOY", "gGn", "cCk", "bBW")
// voxpix: outline #12101c
// voxpix: emissive gGn

const STACKS = {
  // Clip suelto: un lazo de 4x2 tumbado
  "material-oficina": [["hlll", "l..l", "llll"]],
  // Moneda: un disco de 3x3 con el canto oscuro
  "material-medieval": [[".O.", "OYO", ".O."], [".o.", "ooo", ".o."]],
  // Chip: placa verde de 3x3 con una pista que brilla
  "material-cyberpunk": [["GnG", "nGn", "GnG"]],
  // Gotas: 2x2 de dos capas, brillo arriba
  "escupitajo-oficina": [["Ck", "CC"], ["cC", "cc"]],
  "escupitajo-medieval": [["BW", "BB"], ["bB", "bb"]],
  "escupitajo-cyberpunk": [["Gn", "GG"], ["gG", "gg"]],
}

// Cada pieza: capas de arriba (índice 0) abajo, cada capa un dibujo visto desde arriba centrado en el origen
for (const [id, layers] of Object.entries(STACKS)) {
  const n = layers.length
  layers.forEach((rows, i) => {
    const z = n - 1 - i
    sprite(`${id}_z${String(z).padStart(2, "0")}`, { w: 7, h: 7 }, (c) => {
      const h = rows.length, w = rows[0].length
      rows.forEach((row, r) => [...row].forEach((k, x) => { if (k !== ".") c.px(3 - (w >> 1) + x, 3 - (h >> 1) + r, k) }))
    })
  })
}
