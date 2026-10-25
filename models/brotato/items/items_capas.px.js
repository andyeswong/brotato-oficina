// Iconos de los ítems del Brotato en vóxeles (FERN, 2026-10-25), uno por ítem y por mundo: el objeto que nombra su
// aspecto (Café / Hidromiel / Café sintético...). Los pide NARUTO en la revisión de la tienda: la inicial en un cuadro
// se leía provisional junto a las armas en vóxel. Se ven en la tienda con la cámara del juego (oblicua 0,5, de frente,
// contorno #0d0c12), en una caja de 24x16: cada objeto mide como mucho 13 de ancho y 12 de alto.
//
// Cada icono se construye con primitivas (cajas, cilindros, aros) y se sombrea solo, como arte plano: un material de
// tres letras (oscuro, medio, claro) da el claro a lo que mira arriba, el medio al frente y el oscuro a la base; una
// letra sola es un color fijo (cruces, pantallas, ojos). Ejes: x a la derecha, y hacia el fondo (el frente es -y),
// z arriba. Salen como capas <mundo>-<ítem>_zNN.
// Importar (desde esta carpeta):
//   voxpix import-pxl items_capas.px.js --stack oficina-cafe oficina-cafe.json   (y los 42)

pal({
  a: "#353650", b: "#5f687a", c: "#a3adbf",          // acero
  d: "#8a8aa0", e: "#c8c8d8", f: "#f4f1ee",          // blanco
  g: "#6a1424", h: "#c0283c", i: "#f05a6a",          // rojo
  j: "#3a1e10", k: "#6a3a1c", l: "#9a6030",          // cuero
  m: "#4a2a14", n: "#7a4a22", o: "#a87038",          // madera
  p: "#7a4a10", q: "#d09020", r: "#ffe070",          // oro / latón
  s: "#8a6a10", t: "#e8c030", u: "#fff080",          // amarillo
  v: "#1c2a5a", w: "#2f5fb0", x: "#6aa0f0",          // azul
  y: "#123a1a", z: "#2a7a3a", A: "#6ac060",          // verde
  B: "#12101c", C: "#24222e", D: "#3e3c50",          // negro
  E: "#1e3a24", F: "#345a34", G: "#5a8a4a",          // paño verde
  H: "#8a6a40", I: "#d8b880", J: "#f4e4c0",          // pergamino, venda
  K: "#7a1f6a", L: "#ff3cc8", M: "#ffc0f0",          // neón rosa (luz propia)
  N: "#126a80", O: "#2ee6ff", P: "#c0f8ff",          // neón cian (luz propia)
  Q: "#7a1426", R: "#ff3040", S: "#ff9090",          // rojo que brilla (láser, poción)
  T: "#0e3a22", U: "#2ee06a", V: "#a0ffc0",          // verde que brilla (nanobots)
  W: "#0e0c16", X: "#2e2c44", Y: "#7c7aa4",          // cromo oscuro
  Z: "#2a4a5a", "0": "#5a8aa0", "1": "#b0e0f0",      // vidrio
})
ramps("abc", "def", "ghi", "jkl", "mno", "pqr", "stu", "vwx", "yzA", "BCD", "EFG", "HIJ", "KLM", "NOP", "QRS", "TUV", "WXY", "Z01")
// voxpix: outline #12101c
// voxpix: emissive KLM NOP QRS TUV

const STEEL = "abc", WHITE = "def", RED = "ghi", LEATHER = "jkl", WOOD = "mno", GOLD = "pqr", YELLOW = "stu",
  BLUE = "vwx", GREEN = "yzA", BLACK = "BCD", CLOTH = "EFG", PAPER = "HIJ", PINK = "KLM", CYAN = "NOP",
  GLOW = "QRS", ACID = "TUV", CHROME = "WXY", GLASS = "Z01"

const SIZE = 17, MID = 8   // capas de 17x17, el origen en el centro

function icon(id, build) {
  const V = new Map()
  const key = (x, y, z) => `${x},${y},${z}`
  const set = (x, y, z, m) => V.set(key(x, y, z), m)
  const disc = (dx, dy, r) => dx * dx + dy * dy <= r * r + r * 0.6
  const api = {
    set,
    del: (x, y, z) => V.delete(key(x, y, z)),
    box(x0, y0, z0, x1, y1, z1, m) {
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) set(x, y, z, m)
    },
    // Cilindro vertical
    cyl(cx, cy, r, z0, z1, m) {
      for (let z = z0; z <= z1; z++) for (let x = cx - r; x <= cx + r; x++) for (let y = cy - r; y <= cy + r; y++) if (disc(x - cx, y - cy, r)) set(x, y, z, m)
    },
    // Cilindro tumbado a lo largo de x, y a lo largo de y (un disco de frente)
    cylx(cy, cz, r, x0, x1, m) {
      for (let x = x0; x <= x1; x++) for (let y = cy - r; y <= cy + r; y++) for (let z = cz - r; z <= cz + r; z++) if (disc(y - cy, z - cz, r)) set(x, y, z, m)
    },
    cyly(cx, cz, r, y0, y1, m) {
      for (let y = y0; y <= y1; y++) for (let x = cx - r; x <= cx + r; x++) for (let z = cz - r; z <= cz + r; z++) if (disc(x - cx, z - cz, r)) set(x, y, z, m)
    },
    // Aro de frente (en el plano xz)
    ring(cx, cz, r, y0, y1, m) {
      for (let y = y0; y <= y1; y++) for (let x = cx - r - 1; x <= cx + r + 1; x++) for (let z = cz - r - 1; z <= cz + r + 1; z++) {
        const d = Math.hypot(x - cx, z - cz)
        if (d >= r - 0.5 && d <= r + 0.5) set(x, y, z, m)
      }
    },
    // Recorre lo que hay (para pintar encima de una forma)
    each(fn) { for (const [k, m] of [...V]) { const [x, y, z] = k.split(",").map(Number); fn(x, y, z, m) } },
    has: (x, y, z) => V.has(key(x, y, z)),
  }
  build(api)
  // Sombreado plano: arriba al aire, claro; el resto, medio; lo de abajo que da al frente, oscuro
  const out = new Map()
  for (const [k, m] of V) {
    if (m.length === 1) { out.set(k, m); continue }
    const [x, y, z] = k.split(",").map(Number)
    const top = !V.has(key(x, y, z + 1))
    const bottom = !V.has(key(x, y, z - 1)) && !V.has(key(x, y - 1, z))
    out.set(k, top ? m[2] : bottom ? m[0] : m[1])
  }
  let maxZ = 0
  for (const k of out.keys()) maxZ = Math.max(maxZ, Number(k.split(",")[2]))
  for (let z = 0; z <= maxZ; z++) {
    sprite(`${id}_z${String(z).padStart(2, "0")}`, { w: SIZE, h: SIZE }, (c) => {
      for (const [k, col] of out) {
        const [x, y, vz] = k.split(",").map(Number)
        if (vz === z) c.px(MID + x, MID - y, col)
      }
    })
  }
}

// ---------------------------------------------------------------- formas que se repiten

// Libro de pie, de canto: tapa, hojas a la derecha y un detalle en el frente
function book(o, cover, pages, mark) {
  o.box(-3, -1, 0, 3, 1, 9, cover)
  o.box(3, -1, 1, 3, 0, 8, pages)
  if (mark) mark(o)
}
// Auriculares: diadema en arco y dos copas
function headphones(o, band, cup, glow) {
  o.ring(0, 5, 5, 0, 0, band)
  for (let x = -6; x <= 6; x++) for (let z = 0; z <= 4; z++) o.del(x, 0, z)
  for (const sx of [-1, 1]) {
    o.box(sx * 6 - 1, -1, 0, sx * 6 + 1, 1, 4, cup)
    if (glow) { o.set(sx * 6, -1, 2, glow); o.set(sx * 6, -1, 1, glow); o.set(sx * 6, -1, 3, glow) }
  }
}
// Guante: palma, cuatro dedos, pulgar y puño
function glove(o, mat, cuff, detail) {
  o.box(-3, -1, 2, 2, 1, 6, mat)
  for (const x of [-3, -1, 1]) o.box(x, -1, 7, x, 1, 9, mat)
  o.box(2, -1, 7, 2, 1, 8, mat)
  o.box(3, -1, 3, 4, 1, 4, mat)
  o.box(-3, -1, 0, 2, 1, 1, cuff)
  if (detail) detail(o)
}
// Zapato apuntando a la derecha
function shoe(o, sole, body, tall) {
  o.box(-5, -2, 0, 5, 1, 0, sole)
  o.box(-5, -2, 1, 5, 1, 2, body)
  o.box(-5, -2, 3, -1, 1, 3 + tall, body)
}
// Torso de prenda (cota, peto): cuerpo, hombros y mangas cortas
function torso(o, mat) {
  o.box(-3, -1, 0, 3, 1, 8, mat)
  o.box(-5, -1, 6, 5, 1, 8, mat)
  o.box(-5, -1, 4, -4, 1, 5, mat)
  o.box(4, -1, 4, 5, 1, 5, mat)
  for (let x = -1; x <= 1; x++) o.del(x, -1, 8)          // el cuello
  o.del(0, -1, 7)
}

// ---------------------------------------------------------------- oficina

icon("oficina-agenda", (o) => book(o, RED, WHITE, (o) => { for (let z = 0; z <= 9; z++) o.set(1, -2, z, "B") }))
icon("oficina-alcance", (o) => {
  o.cylx(0, 2, 1, -5, 3, STEEL)
  o.box(4, 0, 2, 4, 0, 2, BLACK); o.set(5, 0, 2, "R"); o.set(6, 0, 2, "S")
  o.set(-2, -1, 3, "R")                                   // el botón
})
icon("oficina-auriculares", (o) => headphones(o, BLACK, BLACK))
icon("oficina-botiquin", (o) => {
  o.box(-4, -2, 0, 4, 2, 6, WHITE)
  o.box(-1, 0, 7, 1, 0, 7, STEEL)
  for (let z = 1; z <= 5; z++) o.set(0, -3, z, "h")
  for (let x = -2; x <= 2; x++) o.set(x, -3, 3, "h")
})
icon("oficina-cafe", (o) => {
  o.cyl(0, 0, 3, 0, 6, WHITE)
  o.cyl(0, 0, 2, 6, 6, "m")
  for (const [x, z] of [[4, 2], [5, 2], [5, 3], [5, 4], [4, 4]]) o.set(x, 0, z, WHITE)
})
icon("oficina-fuerza", (o) => glove(o, YELLOW, BLUE))
icon("oficina-furia", (o) => {
  o.cyl(0, 0, 2, 0, 8, GREEN)
  o.cyl(0, 0, 2, 9, 9, STEEL)
  for (const [x, z] of [[0, 6], [-1, 5], [0, 4], [1, 4], [0, 3], [-1, 2]]) o.set(x, -3, z, "u")   // el rayo
})
icon("oficina-iman", (o) => {
  o.box(-4, -1, 0, 4, 1, 2, RED)
  o.box(-4, -1, 3, -2, 1, 7, RED); o.box(2, -1, 3, 4, 1, 7, RED)
  o.box(-4, -1, 8, -2, 1, 9, STEEL); o.box(2, -1, 8, 4, 1, 9, STEEL)
})
icon("oficina-post-it", (o) => {
  o.box(-4, 0, 0, 4, 0, 8, YELLOW)
  o.del(4, 0, 8)
  for (const z of [6, 4, 2]) for (let x = -2; x <= 2; x++) o.set(x, -1, z, "s")
})
icon("oficina-precision", (o) => {
  o.ring(-3, 4, 2, 0, 0, BLACK); o.ring(3, 4, 2, 0, 0, BLACK)
  o.box(-1, 0, 5, 1, 0, 5, BLACK)
  o.box(-5, 1, 5, -5, 3, 5, BLACK); o.box(5, 1, 5, 5, 3, 5, BLACK)
  for (const cx of [-3, 3]) for (let x = -1; x <= 1; x++) for (let z = 3; z <= 5; z++) o.set(cx + x, 1, z, "1")
})
icon("oficina-prisa", (o) => {
  shoe(o, WHITE, BLUE, 2)
  for (const x of [-2, 0, 2]) o.set(x, 0, 3, "f")          // los cordones
})
icon("oficina-silla-ergonomica", (o) => {
  o.box(-4, 0, 0, 4, 0, 0, BLACK); o.box(0, -2, 0, 0, 2, 0, BLACK)
  for (const x of [-4, 4]) o.set(x, 0, 0, "D")              // las ruedas
  o.box(0, 0, 1, 0, 0, 2, STEEL)
  o.box(-4, -2, 3, 4, 1, 4, BLUE)
  o.box(-4, 1, 5, 4, 2, 9, BLUE)
  o.box(-5, -1, 5, -5, 1, 5, BLACK); o.box(5, -1, 5, 5, 1, 5, BLACK)   // los brazos
})
icon("oficina-termo", (o) => {
  o.cyl(0, 0, 2, 0, 8, STEEL)
  o.cyl(0, 0, 2, 9, 10, BLACK)
  o.box(-2, -3, 4, 2, -3, 5, "h")                          // la franja
})
icon("oficina-tirita", (o) => {
  o.box(-6, 0, 0, 6, 0, 3, PAPER)
  o.box(-2, -1, 0, 2, -1, 3, "J")
  for (const x of [-5, -4, 4, 5]) o.set(x, -1, 2, "H")
})

// ---------------------------------------------------------------- medieval

icon("medieval-agenda", (o) => book(o, LEATHER, PAPER, (o) => { o.box(-1, -2, 4, 1, -2, 5, GOLD) }))
icon("medieval-alcance", (o) => {
  o.cylx(0, 3, 2, -6, -2, GOLD)
  o.cylx(0, 3, 1, -1, 3, GOLD)
  o.cylx(0, 3, 1, 4, 6, "p")
  o.box(-4, -2, 3, -4, 2, 3, LEATHER)                      // la correa
})
icon("medieval-auriculares", (o) => {
  // Capucha: media cúpula de paño con la cara en sombra, y la esclavina abajo
  for (let z = 0; z <= 8; z++) {
    const r = z < 2 ? 5 : Math.round(4 * Math.sqrt(Math.max(0, 1 - ((z - 2) / 7) ** 2)))
    o.cyl(0, 0, r, z, z, CLOTH)
  }
  for (let x = -2; x <= 2; x++) for (let z = 2; z <= 5; z++) for (let y = -6; y <= -1; y++) o.del(x, y, z)
  for (let x = -2; x <= 2; x++) for (let z = 2; z <= 5; z++) o.set(x, 0, z, "B")
})
icon("medieval-botiquin", (o) => {
  for (const [x, y] of [[-2, 0], [0, -1], [2, 0], [-1, 1], [1, 1]]) o.box(x, y, 0, x, y, 7, GREEN)
  for (const [x, z] of [[-3, 8], [-2, 9], [0, 10], [2, 9], [3, 8], [1, 8], [-1, 8]]) o.set(x, 0, z, "A")
  o.box(-3, -2, 3, 3, 1, 3, PAPER)                         // el cordel
})
icon("medieval-cafe", (o) => {
  o.cyl(0, 0, 3, 0, 7, WOOD)
  for (const z of [1, 6]) o.cyl(0, 0, 3, z, z, STEEL)
  o.cyl(0, 0, 2, 8, 8, WHITE)
  for (const [x, z] of [[4, 2], [5, 2], [5, 3], [5, 4], [5, 5], [4, 5]]) o.set(x, 0, z, WOOD)
})
icon("medieval-fuerza", (o) => glove(o, STEEL, LEATHER, (o) => { for (const x of [-3, -1, 1]) o.set(x, -2, 7, "c") }))
icon("medieval-furia", (o) => {
  o.cyl(0, 0, 3, 0, 4, GLOW)
  o.cyl(0, 0, 2, 5, 5, GLOW)
  o.cyl(0, 0, 1, 6, 8, GLASS)
  o.cyl(0, 0, 1, 9, 9, WOOD)
})
icon("medieval-iman", (o) => {
  o.cyl(0, 0, 4, 0, 4, LEATHER)
  o.cyl(0, 0, 3, 5, 5, LEATHER)
  o.cyl(0, 0, 2, 6, 6, "j")
  o.cyl(0, 0, 1, 7, 7, LEATHER)
  o.set(1, -1, 7, "r"); o.set(-1, 0, 7, "q")              // monedas asomando
  o.ring(0, 6, 2, -3, -3, GOLD)
  for (let x = -3; x <= 3; x++) for (let z = 4; z <= 9; z++) if (z !== 6) o.del(x, -3, z)
})
icon("medieval-post-it", (o) => {
  o.cylx(0, 2, 2, -4, 4, PAPER)
  o.cylx(0, 2, 2, -6, -5, WOOD); o.cylx(0, 2, 2, 5, 6, WOOD)
  o.box(-1, -3, 1, 1, -3, 3, "h")                          // el lacre
})
icon("medieval-precision", (o) => {
  o.cyly(0, 4, 4, 0, 0, GOLD)
  o.cyly(0, 4, 2, -1, -1, "f")
  o.set(0, -2, 4, "B"); o.set(1, -2, 4, "q"); o.set(-1, -2, 4, "q")
  o.box(0, 0, 9, 0, 0, 10, GOLD)                           // la anilla
})
icon("medieval-prisa", (o) => shoe(o, "j", LEATHER, 6))
icon("medieval-silla-ergonomica", (o) => {
  torso(o, STEEL)
  o.each((x, y, z) => { if (y === -1 && (x + z) % 2 === 0) o.set(x, y, z, "a") })   // la malla
})
icon("medieval-termo", (o) => {
  o.cyl(0, 0, 4, 0, 5, LEATHER)
  o.cyl(0, 0, 3, 6, 6, LEATHER)
  o.cyl(0, 0, 1, 7, 8, LEATHER)
  o.cyl(0, 0, 1, 9, 9, WOOD)
  o.box(-4, -1, 6, -4, 0, 9, "j"); o.box(-4, 0, 9, 0, 0, 9, "j")   // el cordón
})
icon("medieval-tirita", (o) => {
  o.cyly(0, 3, 3, -1, 1, PAPER)
  o.cyly(0, 3, 1, -2, -2, "H")
  o.box(3, -1, 0, 6, -1, 0, PAPER)                         // la punta suelta
})

// ---------------------------------------------------------------- cyberpunk

icon("cyberpunk-agenda", (o) => {
  o.box(-4, 0, 0, 4, 0, 10, CHROME)
  for (let x = -3; x <= 3; x++) for (let z = 1; z <= 9; z++) o.set(x, -1, z, z % 3 === 0 ? "P" : "O")
})
icon("cyberpunk-alcance", (o) => {
  o.box(-3, 0, 0, 3, 2, 3, CHROME)
  o.ring(0, 7, 3, 0, 0, PINK)
  o.set(0, 0, 7, "L")
  o.box(0, 1, 4, 0, 1, 4, CHROME)
})
icon("cyberpunk-auriculares", (o) => headphones(o, CHROME, CHROME, "L"))
icon("cyberpunk-botiquin", (o) => {
  o.cyl(0, 0, 2, 1, 8, GLASS)
  o.cyl(0, 0, 2, 0, 0, CHROME); o.cyl(0, 0, 2, 9, 9, CHROME)
  for (const [x, z] of [[0, 2], [1, 4], [-1, 5], [0, 7], [1, 6]]) o.set(x, -3, z, "U")
})
icon("cyberpunk-cafe", (o) => {
  for (let z = 0; z <= 7; z++) o.cyl(0, 0, z < 3 ? 2 : 3, z, z, PAPER)
  o.cyl(0, 0, 3, 3, 4, PINK)
  o.cyl(0, 0, 3, 8, 8, WHITE)
  o.set(1, -1, 9, "f")
})
icon("cyberpunk-fuerza", (o) => glove(o, CHROME, CYAN, (o) => { for (const x of [-2, 0]) o.box(x, -2, 2, x, -2, 6, "O") }))
icon("cyberpunk-furia", (o) => {
  o.cylx(0, 3, 1, -4, 2, GLASS)
  o.box(-3, -1, 3, 1, -1, 3, "L")
  o.box(-6, 0, 2, -5, 0, 4, CHROME)
  o.box(3, 0, 3, 6, 0, 3, STEEL)
})
icon("cyberpunk-iman", (o) => {
  o.cyly(0, 4, 4, 0, 1, STEEL)
  o.cyly(0, 4, 2, -1, -1, "O")
  o.cyly(0, 4, 1, -1, -1, "W")
})
icon("cyberpunk-post-it", (o) => {
  o.box(-3, -3, 1, 3, 3, 2, BLACK)
  for (const x of [-2, 0, 2]) { o.set(x, -4, 0, "q"); o.set(x, -4, 1, "q"); o.set(x, 4, 0, "q") }
  o.box(-1, -1, 3, 1, 1, 3, "O")
})
icon("cyberpunk-precision", (o) => {
  o.cyly(0, 4, 4, 0, 1, CHROME)
  o.cyly(0, 4, 2, -1, -1, "L")
  o.set(0, -2, 4, "M")
  o.box(4, 0, 4, 6, 0, 4, STEEL)                           // el cable
})
icon("cyberpunk-prisa", (o) => {
  o.box(-5, -2, 2, 4, 1, 3, CHROME)
  o.box(-5, -2, 4, -1, 1, 8, CHROME)
  o.box(-5, -2, 1, 4, 1, 1, PINK)
  for (const x of [-4, 3]) o.cyly(x, 0, 0, -2, -2, "L")
})
icon("cyberpunk-silla-ergonomica", (o) => {
  torso(o, CHROME)
  for (let z = 1; z <= 6; z += 2) for (let x = -2; x <= 2; x++) o.set(x, -2, z, z === 5 ? "O" : "Y")
})
icon("cyberpunk-termo", (o) => {
  o.box(-3, -2, 0, 3, 2, 8, CHROME)
  o.box(-1, -1, 9, 1, 1, 9, STEEL)
  for (const z of [1, 3, 5]) for (let x = -2; x <= 2; x++) o.set(x, -3, z, "O")
  for (let x = -2; x <= 2; x++) o.set(x, -3, 7, "N")
})
icon("cyberpunk-tirita", (o) => {
  o.box(-4, 0, 0, 4, 0, 7, WHITE)
  for (let z = 1; z <= 6; z++) o.set(0, -1, z, "L")
  for (let x = -3; x <= 3; x++) o.set(x, -1, 4, "L")
})
