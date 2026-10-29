// El jefe del piso 10 en vóxeles, capa por capa (FERN, 2026-10-29). Un minotauro (idea de Andrés): el mismo cuerpo en
// los tres mundos y lo que lleva puesto según el mundo.
//   oficina   el jefe de planta: traje azul marino, camisa blanca y corbata roja; pezuñas por zapatos
//   medieval  el minotauro de siempre: pelaje al aire, taparrabos y correa de cuero, cinturón y brazales de bronce,
//             argolla en el morro y puntas de los cuernos doradas
//   cyberpunk mitad cíborg: la mitad derecha de cromo con costuras de neón cian, el ojo derecho cian y el cuerno
//             derecho de metal; pantalón técnico oscuro
// Erguido, hombros anchos y cabeza de toro adelantada, cuernos abiertos hacia los lados y hacia arriba, ojos rojos
// encendidos (la seña de enemigo). Unos 25 de ancho con los cuernos, 16 de fondo y 41 de alto: radio 10 en el juego.
//
// Ejes como MAIA: cada capa z es un corte visto desde arriba, norte arriba (la espalda) y abajo el frente (la cara,
// que mira a la cámara); pivote en el centro, los pies en z = 0.
// Importar: voxpix import-pxl jefe_capas.px.js --stack oficina oficina.json (y medieval, cyberpunk)

pal({
  F: "#2a1a12", G: "#4a2e1e", H: "#6e4630", I: "#94633f", J: "#b8875a",   // pelaje
  t: "#8a6448", u: "#b48a64", v: "#d8b48c",                                 // morro
  a: "#1a1410", b: "#2e2620", c: "#4a4038",                                 // pezuñas y nariz
  B: "#3a3226", C: "#6e6352", D: "#a89a80", E: "#e0d6be",                   // cuerno
  S: "#12141f", V: "#1e2235", W: "#2e3550", X: "#46507a",                   // traje
  o: "#9aa0b0", p: "#d8dce6", q: "#f6f8fb",                                 // camisa
  T: "#5a1020", Y: "#a01c34", Z: "#d83a52",                                 // corbata
  L: "#4a3010", M: "#8a5a1c", N: "#c89030", O: "#f0c860",                   // bronce y oro
  l: "#2a1c14", m: "#4a3224", n: "#6a4a34",                                 // cuero
  d: "#1c1a2e", f: "#353650", g: "#5f687a", h: "#8f99ab", s: "#c4cbd8",     // cromo y tela técnica
  i: "#0a5a6a", j: "#18c8e0", w: "#a0f8ff",                                 // neón cian
  R: "#7a1426", r: "#d8314a", e: "#ff8a8a",                                 // ojos
})
ramps("FGHIJ", "tuv", "abc", "BCDE", "SVWX", "opq", "TYZ", "LMNO", "lmn", "dfghs", "ijw", "Rre")
// voxpix: outline #12101c
// voxpix: emissive Rre ijw   (ojos y neón encendidos: se leen en lo oscuro)

const RAMP = { fur: "FGHIJ", muzzle: "tuv", hoof: "abc", horn: "BCDE", suit: "SVWX", shirt: "opq", tie: "TYZ", gold: "LMNO", leather: "lmn", steel: "dfghs", neon: "ijw" }
const MX = 14, MY = 10, W = 2 * MX + 1, H = 2 * MY + 1, LAYERS = 42

const ell = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1

// Los cuernos: un tubo que sale de la cabeza hacia fuera, un poco hacia delante y se curva hacia arriba
function horn(x, y, z) {
  const side = x < 0 ? -1 : 1
  for (let k = 0; k <= 24; k++) {
    const t = k / 24
    const hx = side * (4.5 + 7.5 * t), hy = -1.5 - 2 * t, hz = 35 + 5.5 * t * t
    const r = 1.7 * (1 - t) + 0.55
    if ((x - hx) ** 2 + ((y - hy) * 1.2) ** 2 + (z - hz) ** 2 <= r * r) return t
  }
  return null
}

// El cuerpo, sin ropa: la parte de cada vóxel ("leg", "hoof", "hips", "torso", "arm", "fist", "neck", "head",
// "snout", "ear", "horn") y, para los cuernos, lo lejos de la raíz (t)
function body(x, y, z) {
  const ax = Math.abs(x)
  // Piernas con pezuña
  if (z <= 1 && ell(ax, y, 4.5, -0.5, 3.4, 3.2)) return { part: "hoof" }
  if (z >= 2 && z <= 12 && ell(ax, y, 4.5, 0, z >= 8 ? 3.6 : 3, z >= 8 ? 3.4 : 2.9)) return { part: "leg" }
  // Cadera y torso, que se ensancha hacia los hombros; el pecho sale por delante
  if (z >= 11 && z <= 14 && ell(x, y, 0, 0, 7.5, 4.5)) return { part: "hips" }
  if (z >= 15 && z <= 27) {
    const rx = 7.5 + (z - 15) * 0.2, ry = 4.6 + (z - 15) * 0.08
    if (ell(x, y, 0, 0, rx, ry)) return { part: "torso" }
    if (z >= 21 && z <= 26 && ell(ax, y, 3.5, -3.5, 3.4, 2.8)) return { part: "torso" }   // pectorales
  }
  // Brazos colgando, algo abiertos, y puños grandes
  const armX = 10.5 + (27 - Math.min(27, Math.max(13, z))) * 0.05
  if (z >= 10 && z <= 13 && ell(ax, y, 11.2, -1, 2.8, 2.8)) return { part: "fist" }
  if (z >= 14 && z <= 27 && ell(ax, y, armX, -0.5, z >= 20 ? 2.8 : 2.4, z >= 20 ? 2.8 : 2.4)) return { part: "arm" }
  // Cuello de toro y cabeza adelantada; el morro sale por delante
  if (z >= 28 && z <= 29 && ell(x, y, 0, -0.5, 6, 4)) return { part: "neck" }
  if (z >= 29 && z <= 32 && ell(x, y, 0, -5.8, 3, 2.3)) return { part: "snout" }
  if (z >= 30 && z <= 37 && ell(x, y, 0, -1.5, z >= 36 ? 3.6 : 4.3, 4)) return { part: "head" }
  if (z >= 34 && z <= 35 && ax >= 4 && ax <= 6 && y >= -2 && y <= 0) return { part: "ear" }
  const t = horn(x, y, z)
  if (t !== null && ax >= 3) return { part: "horn", t }
  return null
}

const solid = (x, y, z) => body(x, y, z) !== null

// Lo que lleva puesto en cada mundo: el material de cada vóxel del cuerpo
function material(world, x, y, z, b) {
  const ax = Math.abs(x), front = !solid(x, y - 1, z)
  // Ojos, nariz y argolla: iguales en los tres (el derecho del cíborg, cian)
  if (b.part === "head" && z >= 33 && z <= 34 && ax >= 2 && ax <= 3 && front) return world === "cyberpunk" && x > 0 ? "eyeC" : "eye"
  if (b.part === "snout" && z === 30 && ax === 1 && front) return "hoof"
  if (b.part === "horn") {
    if (world === "medieval" && b.t > 0.82) return "gold"
    if (world === "cyberpunk" && x > 0) return b.t > 0.85 ? "neon" : "steel"
    return "horn"
  }
  if (world === "oficina") {
    if (b.part === "leg" || b.part === "hips") return "suit"
    if (b.part === "torso") {
      // La camisa en V por delante, con la corbata en medio; las solapas, el borde de la V
      const v = (z - 16) * 0.5
      if (y < -2 && z >= 16 && ax <= v) return ax <= 0.6 + (z < 19 ? 0.6 : 0) ? "tie" : "shirt"
      return "suit"
    }
    if (b.part === "arm") return z <= 15 ? "shirt" : "suit"   // el puño de la camisa asoma
    if (b.part === "neck" && y < -2) return "shirt"            // el cuello de la camisa
    return b.part === "snout" ? "muzzle" : b.part === "hoof" ? "hoof" : "fur"
  }
  if (world === "medieval") {
    if (b.part === "hips") return y < -2 && ax <= 3 ? "leather" : z >= 13 ? "gold" : "leather"
    if (b.part === "leg" && z >= 7 && y < -2 && ax <= 3) return "leather"   // la falda del taparrabos
    if (b.part === "torso" && Math.abs(x + (z - 21)) <= 1) return "leather"  // la correa cruzada
    if (b.part === "arm" && z <= 17) return "gold"                          // brazales
    return b.part === "snout" ? "muzzle" : b.part === "hoof" ? "hoof" : "fur"
  }
  // cyberpunk: la mitad derecha, de cromo con costuras de neón; el pantalón, tela técnica
  if (b.part === "leg" || b.part === "hips") return "steel"
  if (x > 0 && b.part !== "hoof") {
    if ((z % 6 === 0 && b.part !== "head") || x === 1) return "neon"
    return "steel"
  }
  return b.part === "snout" ? "muzzle" : b.part === "hoof" ? "hoof" : "fur"
}

// El tono dentro de la rampa: medio, más claro arriba y a la izquierda (la luz), más oscuro debajo y detrás
function voxel(world, x, y, z) {
  const b = body(x, y, z)
  if (!b) return null
  const mat = material(world, x, y, z, b)
  if (mat === "eye" || mat === "eyeC") {
    const r = mat === "eye" ? "Rre" : "ijw"
    return z === 34 && (x === -3 || x === 2) ? r[2] : r[1]
  }
  const ramp = RAMP[mat]
  let k = Math.floor((ramp.length - 1) / 2)
  if (!solid(x, y, z + 1)) k += 1
  if (!solid(x - 1, y, z)) k += 1
  if (!solid(x, y, z - 1) && z > 0) k -= 1
  if (y > 2 && !solid(x, y + 1, z)) k -= 1
  if (mat === "neon") k = ramp.length - 2 + (!solid(x, y, z + 1) ? 1 : 0)
  return ramp[Math.max(0, Math.min(ramp.length - 1, k))]
}

for (const world of ["oficina", "medieval", "cyberpunk"]) {
  for (let z = 0; z < LAYERS; z++) {
    sprite(`${world}_z${String(z).padStart(2, "0")}`, { w: W, h: H }, (c) => {
      for (let y = -MY; y <= MY; y++) for (let x = -MX; x <= MX; x++) {
        const k = voxel(world, x, y, z)
        if (k) c.px(x + MX, MY - y, k)
      }
    })
  }
}
