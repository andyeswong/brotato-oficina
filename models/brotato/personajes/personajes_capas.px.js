// Los personajes nuevos en vóxeles, capa por capa (NARUTO, 2026-11-04). Con la cabeza grande de MAIA (unos 32 de alto,
// la cabeza la mitad) pero con otra silueta a tamaño de juego:
//   becario   rápido y frágil: delgado (11 de ancho), pelo de punta naranja con un remolino que sube, gafas
//             redondas, sudadera mostaza con la acreditación roja colgando, vaqueros, zapatillas y una mochila
//             verde que asoma por detrás
//   conserje  lenta y dura: ancha (21 de ancho), gorra con visera, mono azul petróleo con peto sobre camisa gris
//             remangada, guantes de goma amarillos, cinturón con llavero y botas
// Ejes como MAIA y el jefe: cada capa z es un corte visto desde arriba, norte arriba (la espalda) y abajo el frente (la
// cara, que mira a la cámara); pivote en el centro, los pies en z = 0.
// Poses: <id> quieto; <id>-andar0..3, el paso (piernas y brazos alternos, el cuerpo sube 1 al pasar), como el del jefe.
// Importar: voxpix import-pxl personajes_capas.px.js --stack becario becario.json (y cada personaje y pose)

pal({
  // becario
  a: "#3a1a0e", b: "#6a2e14", c: "#a04a1c", d: "#d0702c", e: "#f09a4a",       // pelo
  f: "#7a4a3a", g: "#a86a52", h: "#d0906e", i: "#eab48e", j: "#f8d4b4",       // piel
  k: "#4a3208", l: "#7a560e", m: "#b08018", n: "#dca82a", o: "#f4cc58",       // sudadera
  p: "#141c34", q: "#22305a", r: "#344a86", s: "#4e68b0",                     // vaqueros
  t: "#6a6e7a", u: "#b0b4c0", v: "#eef0f4",                                   // zapatillas y tarjeta
  w: "#8a1a1a", x: "#d83030",                                                 // cinta y suela roja
  y: "#16301e", z: "#24502e", A: "#367040", E: "#4e8c52",                     // mochila
  // los dos
  B: "#0e0c14", C: "#2a2632", D: "#f8f8ff",                                   // ojos, gafas
  // conserje
  I: "#2a2420", J: "#4a3e36", K: "#6e6054", L: "#968676",                     // pelo
  M: "#4a2a1e", N: "#6e4030", O: "#94583e", P: "#b87652", Q: "#d49a72",       // piel
  R: "#0e2230", S: "#163a4e", T: "#22566e", U: "#347890", V: "#5aa0b4",       // mono y gorra
  X: "#5a6070", Y: "#8a90a0", Z: "#bcc2cc",                                   // camisa
  0: "#8a6a0a", 1: "#d0a414", 2: "#f8d84a",                                   // guantes
  3: "#141218", 4: "#2a2630", 5: "#3e3846",                                   // botas
  6: "#3a2a18", 7: "#6a4a2a", 8: "#a88a2a", 9: "#f0d060",                     // cinturón y llaves
})
ramps("abcde", "fghij", "klmno", "pqrs", "tuv", "wx", "yzAE", "BCD", "IJKL", "MNOPQ", "RSTUV", "XYZ", "012", "345", "67", "89")
// voxpix: outline #12101c

const MX = 11, MY = 11, W = 2 * MX + 1, H = 2 * MY + 1, LAYERS = 36
const ell = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1
const ell3 = (x, y, z, cx, cy, cz, rx, ry, rz) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 <= 1

// ---- cada personaje: su cuerpo (la parte de cada vóxel) y su ropa (la rampa de cada parte)
const CHARS = {
  becario: {
    legTop: 5, armTop: 13,
    body(x, y, z) {
      const ax = Math.abs(x)
      // Zapatillas con la puntera adelantada, y las piernas finas
      if (z <= 1 && ax >= 1 && ax <= 3 && y >= -3 && y <= 1) return { part: "shoe" }
      if (z >= 2 && z <= 5 && ell(ax, y, 2, 0, 1.6, 1.6)) return { part: "leg" }
      // Torso estrecho de sudadera (con la capucha caída por detrás, arriba) y la mochila a la espalda
      if (z >= 6 && z <= 13 && ell(x, y, 0, 0, 4.4, 3)) return { part: "torso" }
      if (z >= 12 && z <= 13 && ell(x, y, 0, 2.5, 3.4, 1.6)) return { part: "hood" }
      if (z >= 6 && z <= 13 && ax <= 4 && y >= 3 && y <= 5) return { part: "pack" }
      // Brazos finos pegados, con las manos
      if (z >= 5 && z <= 6 && ell(ax, y, 5.4, -0.4, 1.2, 1.2)) return { part: "hand" }
      if (z >= 7 && z <= 13 && ell(ax, y, 5.4, 0, 1.3, 1.4)) return { part: "arm" }
      // Cuello y cabeza redonda
      if (z === 14 && ell(x, y, 0, 0, 2, 2)) return { part: "neck" }
      if (ell3(x, y, z, 0, -0.3, 21.5, 7, 6.4, 7.2)) return { part: "head" }
      // El pelo de punta: tres mechones grandes arriba y el remolino que sube
      for (const [sx, sy, sz, r] of [[-3.5, 0.5, 27.5, 2.6], [0.5, -1.5, 28.4, 2.8], [3.8, 0.8, 27.6, 2.5], [-1, 2.5, 28, 2.6]])
        if (ell3(x, y, z, sx, sy, sz, r, r, r * 0.9)) return { part: "hair" }
      if (z >= 29 && z <= 33 && Math.hypot(x - 0.5 + (z - 29) * 0.35, y + 0.5) <= 1.6 - (z - 29) * 0.25) return { part: "hair" }
      return null
    },
    material(x, y, z, b, front) {
      const ax = Math.abs(x)
      if (b.part === "shoe") return z === 0 ? (y < -1 ? "sole" : "shoe") : "shoe"
      if (b.part === "leg") return "jeans"
      if (b.part === "pack") return y === 3 ? "packDark" : "pack"
      if (b.part === "hood") return "hoodie"
      if (b.part === "torso") {
        // La acreditación: la cinta roja en V desde los hombros y la tarjeta blanca sobre el pecho
        if (front && z >= 9 && z <= 13 && Math.abs(ax - (z - 9) * 0.5 - 0.5) <= 0.5) return "strap"
        if (front && z >= 7 && z <= 9 && ax <= 1) return "card"
        if (front && z === 6) return "hoodieDark"   // el elástico de abajo
        return "hoodie"
      }
      if (b.part === "arm") {
        if (y <= -1 && ax === 5 && z >= 10 && z <= 13 && front) return "packStrap"
        return z === 7 ? "hoodieDark" : "hoodie"
      }
      if (b.part === "hand" || b.part === "neck") return "skin"
      if (b.part === "hair") return "hair"
      // La cabeza: pelo por arriba, por detrás y en las sienes; la cara por delante, con las gafas
      if (z >= 25 || y >= 2 || (ax >= 6 && z >= 20) || (y >= 0 && z >= 23)) return "hair"
      if (front && z >= 19 && z <= 22) {
        // Gafas redondas: un aro de 3 x 4 alrededor de cada ojo, y el puente
        const ex = ax - 3
        if (z >= 20 && z <= 21 && ex >= 0 && ex <= 1) return z === 21 && ex === 0 ? "eyeShine" : "eye"
        if (Math.abs(ex - 0.5) <= 2 && (ex === -1 || ex === 2 || z === 19 || z === 22)) return "glasses"
        if (ax <= 1 && z === 21) return "glasses"
      }
      if (front && z === 17 && ax <= 1) return "mouth"
      return "skin"
    },
    ramp: { hair: "abcde", skin: "fghij", hoodie: "klmno", hoodieDark: "klm", jeans: "pqrs", shoe: "tuv", sole: "wx", strap: "wx", card: "tuv",
      pack: "yzAE", packDark: "yz", packStrap: "yzA", mouth: "fg" },
  },

  conserje: {
    legTop: 5, armTop: 14,
    body(x, y, z) {
      const ax = Math.abs(x)
      // Botas anchas y piernas gruesas
      if (z <= 2 && ell(ax, y, 3, -0.8, 2.6, 3)) return { part: "boot" }
      if (z >= 3 && z <= 5 && ell(ax, y, 3, 0, 2.4, 2.4)) return { part: "leg" }
      // Torso ancho y hondo (un barril), con el cinturón
      if (z >= 6 && z <= 15 && ell(x, y, 0, 0, 6.4 + (z >= 12 ? 0.4 : 0), 4.4)) return { part: "torso" }
      // Brazos gruesos algo abiertos, guantes grandes
      if (z >= 4 && z <= 7 && ell(ax, y, 8.3, -0.6, 2, 2)) return { part: "glove" }
      if (z >= 8 && z <= 15 && ell(ax, y, 8.3, 0, z >= 12 ? 2.3 : 2, z >= 12 ? 2.3 : 2)) return { part: "arm" }
      if (z === 16 && ell(x, y, 0, 0, 3, 2.6)) return { part: "neck" }
      // Cabeza redonda algo más ancha que alta, con la gorra: copa y visera hacia delante
      if (z >= 26 && z <= 29 && ell(x, y, 0, 0.3, 7.4 - (z - 26) * 0.5, 6.6 - (z - 26) * 0.5)) return { part: "cap" }
      if (z === 26 && ell(x, y, 0, -7, 5.4, 2.6) && y < -4) return { part: "brim" }
      if (ell3(x, y, z, 0, 0, 21, 7.6, 6.8, 6.4)) return { part: "head" }
      // El moño por detrás, bajo la gorra
      if (ell3(x, y, z, 0, 6.4, 22.5, 2.4, 2, 2.2)) return { part: "bun" }
      return null
    },
    material(x, y, z, b, front) {
      const ax = Math.abs(x)
      if (b.part === "boot") return "boot"
      if (b.part === "leg") return "overall"
      if (b.part === "torso") {
        if (z === 9) return front && x >= 2 && x <= 3 ? "keys" : "belt"               // el cinturón, con el llavero
        if (z === 8 && front && x >= 2 && x <= 4) return "keys"
        // El peto: delante y por encima del cinturón, más estrecho; a los lados, la camisa; tirantes por encima
        if (z >= 10 && y < -1 && ax <= 3) return z === 15 || ax === 3 ? "overallDark" : "overall"
        if (z >= 10 && ax >= 2 && ax <= 3) return "overallDark"                      // los tirantes
        if (z >= 10) return "shirt"
        return "overall"
      }
      if (b.part === "arm") return z >= 12 ? "shirt" : "skin"                       // remangada
      if (b.part === "glove") return "glove"
      if (b.part === "neck") return "skin"
      if (b.part === "cap") return "cap"
      if (b.part === "brim") return "capDark"
      if (b.part === "bun") return "hair"
      // La cabeza: el pelo asoma bajo la gorra por los lados y detrás; la cara por delante
      if (y >= 2 || (ax >= 6 && z >= 21)) return "hair"
      if (front && z >= 21 && z <= 23) {
        const ex = ax - 3
        if (ex >= 0 && ex <= 1) return z === 23 && ex === 0 ? "eyeShine" : "eye"
      }
      if (front && z === 24 && ax >= 2 && ax <= 4) return "hair"                    // las cejas
      if (front && z === 18 && ax <= 1) return "mouth"
      return "skin"
    },
    ramp: { hair: "IJKL", skin: "MNOPQ", overall: "RSTUV", overallDark: "RST", shirt: "XYZ", glove: "012", boot: "345", belt: "67", keys: "89",
      cap: "RSTUV", capDark: "RS", mouth: "MN" },
  },
}

// El tono dentro de la rampa: medio, más claro arriba y a la izquierda (la luz), más oscuro debajo y detrás
function voxel(ch, x, y, z) {
  const b = ch.body(x, y, z)
  if (!b) return null
  const solid = (a, c, d) => ch.body(a, c, d) !== null
  const mat = ch.material(x, y, z, b, !solid(x, y - 1, z))
  const ramp = ch.ramp[mat]
  // Ojos y gafas, sin sombreado: el negro del ojo, el gris de la montura y el brillo
  if (mat === "eye") return "B"
  if (mat === "glasses") return "C"
  if (mat === "eyeShine") return "D"
  let k = Math.floor((ramp.length - 1) / 2)
  if (!solid(x, y, z + 1)) k += 1
  if (!solid(x - 1, y, z)) k += 1
  if (!solid(x, y, z - 1) && z > 0) k -= 1
  if (y > 2 && !solid(x, y + 1, z)) k -= 1
  return ramp[Math.max(0, Math.min(ramp.length - 1, k))]
}

function rest(ch) {
  const out = []
  for (let z = 0; z < LAYERS; z++) for (let y = -MY; y <= MY; y++) for (let x = -MX; x <= MX; x++) {
    const k = voxel(ch, x, y, z)
    if (k) out.push({ x, y, z, k, part: ch.body(x, y, z).part })
  }
  return out
}

const LOWER = new Set(["leg", "shoe", "boot"])
const ARMS = new Set(["arm", "hand", "glove"])

// El paso, como el del jefe: 0 y 2, zancada (un pie delante y otro detrás); 1 y 3, el pie pasa por debajo y el cuerpo
// sube 1. Las piernas giran en la cadera y los brazos en el hombro, al revés que la pierna de su lado
function offset(ch, pose, v) {
  const { x, z, part } = v
  const left = x < 0
  const k = Number(pose.slice(5)), sw = [1, 0, -1, 0][k], bob = sw === 0 ? 1 : 0
  if (LOWER.has(part)) return [0, Math.round((left ? -sw : sw) * 2 * (ch.legTop + 1 - z) / (ch.legTop + 1)), 0]
  if (ARMS.has(part)) return [0, Math.round((left ? sw : -sw) * 2 * (ch.armTop - Math.min(ch.armTop, z)) / (ch.armTop - 4)), bob]
  return [0, 0, bob]
}

for (const [id, ch] of Object.entries(CHARS)) {
  const base = rest(ch)
  for (const pose of ["", "andar0", "andar1", "andar2", "andar3"]) {
    const at = new Map()
    for (const v of base) {
      const [dx, dy, dz] = pose ? offset(ch, pose, v) : [0, 0, 0]
      const x = v.x + dx, y = v.y + dy, z = v.z + dz
      if (z < 0 || z >= LAYERS || y < -MY || y > MY) continue
      const key = `${x},${y},${z}`
      if (!at.has(key)) at.set(key, v.k)
    }
    const stack = pose ? `${id}-${pose}` : id
    for (let z = 0; z < LAYERS; z++) {
      sprite(`${stack}_z${String(z).padStart(2, "0")}`, { w: W, h: H }, (c) => {
        for (let y = -MY; y <= MY; y++) for (let x = -MX; x <= MX; x++) {
          const k = at.get(`${x},${y},${z}`)
          if (k) c.px(x + MX, MY - y, k)
        }
      })
    }
  }
}
