// La araña, jefa del piso 10 (una de las tres que se sortean), en vóxeles, capa por capa (NARUTO, 2026-11-04). Rápida,
// deja zonas que frenan y llama a sus crías. El mismo cuerpo en los tres mundos y de qué está hecha según el mundo:
//   oficina    araña de cables: el cuerpo, un switch de red con sus luces verdes; el abdomen, una bobina de cable
//              negro; las patas, cables con el conector de plástico y los contactos dorados en la punta
//   medieval   araña de cripta: hueso viejo con marcas moradas oscuras y una calavera en el abdomen
//   cyberpunk  dron araña: cromo negro con franjas de neón rosa y las articulaciones cian
// Ojos rojos encendidos en las tres (la seña de enemigo; el dron, cian con el centro rojo). Unos 26 de ancho con las
// patas, 22 de fondo y 15 de alto: radio 9 en el juego.
// Ejes como el jefe (jefe_capas.px.js): cada capa z es un corte visto desde arriba, norte arriba (atrás) y abajo el
// frente, que mira a la cámara; pivote en el centro, las patas en z = 0.
// Pilas:
//   arana-<mundo>            quieta
//   arana-<mundo>-andar0..3  el paso: cuatro patas en el aire (una sí y otra no, alternas a cada lado) y luego las otras
//   arana-<mundo>-teje       el abdomen abajo, contra el suelo, con las hileras encendidas: deja la zona
//   arana-<mundo>-llama      erguida sobre las patas de atrás, las dos de delante arriba: llama a las crías
//   cria-<mundo>, cria-<mundo>-andar0..3   la cría, la misma araña en pequeño (7 de ancho)
//   zona-<mundo>             la zona que frena, plana (1 de grueso), de 52 x 52 centrada en el origen: maraña de
//                            cables, telaraña o mancha de aceite
// Importar: voxpix import-pxl arana_capas.px.js --stack arana-oficina arana-oficina.json (y cada pila)

pal({
  R: "#7a1426", r: "#d8314a", e: "#ff8a8a",                                  // ojos
  a: "#16181e", b: "#24272f", c: "#363a44", d: "#4c5260",                    // plástico oscuro del switch
  f: "#0c0c10", g: "#1c1c24", h: "#2e2e3a", i: "#44445a",                    // cable negro
  j: "#0e5a2a", k: "#2ee070", l: "#b0ffd0",                                  // luces verdes
  m: "#2a4a6a", n: "#5a8ac0", o: "#a8d0f0",                                  // conector de plástico
  p: "#a88a2a", q: "#f0d060",                                                // contactos dorados
  s: "#4a4438", t: "#7a7260", u: "#a89e86", v: "#cfc6b0", w: "#efe8d6",       // hueso
  x: "#1a1020", y: "#2e1c38", z: "#4a2e58",                                  // morado oscuro
  A: "#0e0c16", B: "#1c1a2a", C: "#2e2c44", D: "#4a4868", E: "#7c7aa4",       // cromo negro
  F: "#7a1f6a", G: "#ff3cc8", H: "#ffc0f0",                                  // neón rosa
  I: "#126a80", J: "#2ee6ff", K: "#c0f8ff",                                  // neón cian
  L: "#06060a", M: "#14121e", N: "#2a2440", O: "#3c3458",                    // aceite
})
ramps("Rre", "abcd", "fghi", "jkl", "mno", "pq", "stuvw", "xyz", "ABCDE", "FGH", "IJK", "LMNO")
// voxpix: outline #12101c
// voxpix: emissive Rre jkl FGH IJK

const RAMP = { eye: "Rre", box: "abcd", cable: "fghi", led: "jkl", plug: "mno", gold: "pq", bone: "stuvw", purple: "xyz",
  chrome: "ABCDE", pink: "FGH", cyan: "IJK", oil: "LMNO" }
const MX = 16, MY = 16, W = 2 * MX + 1, H = 2 * MY + 1, LAYERS = 20

const ell3 = (x, y, z, cx, cy, cz, rx, ry, rz) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 <= 1
// Distancia de un punto al segmento a-b, y dónde cae a lo largo (0 en a, 1 en b)
function seg(p, a, b) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]]
  const L = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2
  const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / L))
  const q = [a[0] + ab[0] * t - p[0], a[1] + ab[1] * t - p[1], a[2] + ab[2] * t - p[2]]
  return { d: Math.hypot(q[0], q[1], q[2]), t }
}

// ---- el cuerpo en una pose: cada pata, de la base (en el tórax) a la rodilla y de la rodilla al pie
// pose: { lift: [8 alturas extra del pie], step: [8 avances del pie, en y], body: subir el cuerpo, tilt: bajar el
// abdomen (teje), raise: [8: la pata levantada al aire (llama)] }
const LEGS = []
for (const side of [-1, 1]) for (let k = 0; k < 4; k++) LEGS.push({ side, k })
function legPoints(leg, pose) {
  const { side, k } = leg, i = LEGS.indexOf(leg)
  const by = -4.6 + k * 1.6, base = [side * 3.6, by, 6.5 + pose.body]
  const footY = [-11, -4.5, 2.5, 8.5][k] + (pose.step?.[i] ?? 0)
  let foot = [side * (11.5 + (k === 0 || k === 3 ? 0 : 1)), footY, pose.lift?.[i] ?? 0]
  if (pose.raise?.[i]) foot = [side * 7, -12, 14 + pose.body]                // al aire, hacia delante
  // La rodilla, por encima de la recta, hacia fuera
  const knee = [side * (Math.abs(foot[0]) * 0.62 + 1.5), (base[1] + foot[1]) / 2, Math.max(base[2], foot[2]) + 5]
  if (pose.raise?.[i]) { knee[0] = side * 9; knee[1] = -8; knee[2] = 13 + pose.body }
  return { base, knee, foot }
}

function body(x, y, z, pose, scale) {
  const p = [x / scale, y / scale, z / scale]
  const b = pose.body, tilt = pose.tilt ?? 0
  // Tórax delante y abdomen grande detrás (bajado hacia el suelo al tejer)
  if (ell3(...p, 0, 4.6, 8.4 + b - tilt, 5.6, 6, 5.1 - tilt * 0.2)) {
    const back = p[1] > 8.6 && tilt > 0 && p[2] < 4 + b
    return { part: back ? "spinneret" : "abdomen", ay: p[1] - 4.6, az: p[2] - 8.4 - b + tilt }
  }
  if (ell3(...p, 0, -2.6, 7.2 + b, 4.2, 4, 2.8)) return { part: "thorax" }
  // Ojos: dos grandes y dos pequeños en la frente; quelíceros debajo
  for (const [ex, ey, ez, er] of [[-1.3, -6.2, 8.4, 0.9], [1.3, -6.2, 8.4, 0.9], [-2.7, -5.6, 8.9, 0.7], [2.7, -5.6, 8.9, 0.7]])
    if (Math.hypot(p[0] - ex, p[1] - ey, (p[2] - ez - b) * 1.2) <= er + 0.35) return { part: "eye" }
  for (const fx of [-1.1, 1.1]) if (Math.hypot(p[0] - fx, p[1] + 6.4, p[2] - 5.6 - b) <= 0.9) return { part: "fang" }
  // Patas: fémur grueso hasta la rodilla y tibia fina hasta el pie
  for (const leg of LEGS) {
    const { base, knee, foot } = legPoints(leg, pose)
    const s1 = seg(p, base, knee), s2 = seg(p, knee, foot)
    // En la cría (escala pequeña) las patas no adelgazan por debajo de medio vóxel: se perderían
    if (s1.d <= Math.max(0.95, 0.62 / scale)) return { part: "leg", t: s1.t * 0.5 }
    if (s2.d <= Math.max(s2.t > 0.85 ? 0.9 : 0.72, 0.55 / scale)) return { part: s2.t > 0.85 ? "foot" : "leg", t: 0.5 + s2.t * 0.5 }
    if (Math.hypot(p[0] - knee[0], p[1] - knee[1], p[2] - knee[2]) <= 1.1) return { part: "joint" }
  }
  return null
}

// De qué está hecho cada vóxel en cada mundo
function material(world, x, y, z, b, pose) {
  if (b.part === "eye") return world === "cyberpunk" ? (Math.abs(x) <= 2 ? "eye" : "cyan") : "eye"
  if (b.part === "spinneret") return world === "oficina" ? "led" : world === "medieval" ? "purple" : "pink"
  if (world === "oficina") {
    if (b.part === "thorax") return z >= 9 + pose.body && (x + y) % 3 === 0 ? "led" : "box"
    if (b.part === "abdomen") return Math.abs(b.ay) <= 4.5 && Math.round(b.az * 1.2) % 2 === 0 ? "cable" : "box"   // la bobina
    if (b.part === "fang") return "gold"
    if (b.part === "foot") return Math.abs(x) % 2 === 0 ? "gold" : "plug"
    if (b.part === "joint") return "plug"
    return "cable"
  }
  if (world === "medieval") {
    if (b.part === "abdomen") {
      // La calavera en el lomo: dos cuencas y la boca, morado oscuro sobre el hueso
      const top = b.az > 2.4
      const eyes = top && (Math.hypot(Math.abs(x) - 1.6, b.ay + 0.6) < 1.1)
      const mouth = top && Math.abs(x) <= 1 && b.ay > 1.6 && b.ay < 2.8
      if (eyes || mouth) return "purple"
      return (Math.round(b.ay) + Math.round(b.az)) % 5 === 0 ? "purple" : "bone"
    }
    if (b.part === "joint" || b.part === "foot") return "purple"
    if (b.part === "fang") return "purple"
    return "bone"
  }
  // cyberpunk
  if (b.part === "joint") return "cyan"
  if (b.part === "abdomen") return Math.abs(x) <= 0 || (b.az > 0 && Math.round(b.ay) % 3 === 0 && Math.abs(x) <= 3) ? "pink" : "chrome"
  if (b.part === "thorax") return Math.abs(x) === 0 && y > -5 ? "pink" : "chrome"
  if (b.part === "foot") return "pink"
  return "chrome"
}

function voxel(world, x, y, z, pose, scale) {
  const b = body(x, y, z, pose, scale)
  if (!b) return null
  const solid = (a, c, d) => body(a, c, d, pose, scale) !== null
  const mat = material(world, x, y, z, b, pose)
  const ramp = RAMP[mat]
  if (mat === "eye") return z % 2 === 0 ? ramp[2] : ramp[1]
  let k = Math.floor((ramp.length - 1) / 2)
  if (!solid(x, y, z + 1)) k += 1
  if (!solid(x - 1, y, z)) k += 1
  if (!solid(x, y, z - 1) && z > 0) k -= 1
  if (y > 2 && !solid(x, y + 1, z)) k -= 1
  if (mat === "led" || mat === "pink" || mat === "cyan") k = ramp.length - 2 + (!solid(x, y, z + 1) ? 1 : 0)
  return ramp[Math.max(0, Math.min(ramp.length - 1, k))]
}

// Las poses. El paso: patas A (izquierda 0 y 2, derecha 1 y 3) y B (las otras), alternas
const A = [1, 0, 1, 0, 0, 1, 0, 1], NONE = [0, 0, 0, 0, 0, 0, 0, 0]
const POSES = {
  "": { body: 0 },
  andar0: { body: 0, lift: A.map((a) => a * 3), step: A.map((a) => (a ? -2 : 1)) },
  andar1: { body: 1, step: NONE },
  andar2: { body: 0, lift: A.map((a) => (1 - a) * 3), step: A.map((a) => (a ? 1 : -2)) },
  andar3: { body: 1, step: NONE },
  teje: { body: 0, tilt: 4 },
  llama: { body: 3, raise: [1, 0, 0, 0, 1, 0, 0, 0], step: [0, 0, 1, 2, 0, 0, 1, 2] },
}

function stack(name, world, pose, scale) {
  const at = new Map()
  for (let z = 0; z < LAYERS; z++) for (let y = -MY; y <= MY; y++) for (let x = -MX; x <= MX; x++) {
    const k = voxel(world, x, y, z, pose, scale)
    if (k) at.set(`${x},${y},${z}`, k)
  }
  for (let z = 0; z < LAYERS; z++) {
    sprite(`${name}_z${String(z).padStart(2, "0")}`, { w: W, h: H }, (c) => {
      for (let y = -MY; y <= MY; y++) for (let x = -MX; x <= MX; x++) {
        const k = at.get(`${x},${y},${z}`)
        if (k) c.px(x + MX, MY - y, k)
      }
    })
  }
}

for (const world of ["oficina", "medieval", "cyberpunk"]) {
  for (const [pose, def] of Object.entries(POSES)) stack(pose ? `arana-${world}-${pose}` : `arana-${world}`, world, def, 1)
  // La cría: la misma, a un 30 %, solo quieta y andando
  for (const pose of ["", "andar0", "andar1", "andar2", "andar3"]) stack(pose ? `cria-${world}-${pose}` : `cria-${world}`, world, POSES[pose], 0.3)
}

// ---- la zona que frena: 52 x 52, plana (z = 0), centrada en el origen
const ZR = 26, ZW = 2 * ZR + 1
function zone(world, x, y) {
  const d = Math.hypot(x, y), a = Math.atan2(y, x)
  // El borde, irregular
  const edge = ZR - 2 - 2.2 * (0.5 + 0.5 * Math.sin(a * 5 + 1.3)) - 1.2 * (0.5 + 0.5 * Math.sin(a * 11 + 0.4))
  if (d > edge) return null
  if (world === "cyberpunk") {
    // Mancha de aceite: negra, con aguas de color (anillos rosa y cian apagados) que dan el brillo
    const ring = Math.sin(d * 0.7 + Math.sin(a * 3) * 1.5)
    if (ring > 0.86) return d < edge - 2 ? "G" : "F"
    if (ring < -0.9) return "I"
    return d > edge - 1.5 ? "O" : ring > 0.3 ? "N" : "M"
  }
  // Telaraña o maraña de cables: radios y anillos, con huecos (los huecos dejan ver el suelo)
  const spokes = 12, sa = ((a + Math.PI) / (Math.PI * 2)) * spokes
  const onSpoke = Math.abs(sa - Math.round(sa)) * (Math.PI * 2 / spokes) * d < 0.6
  const wob = Math.sin(a * spokes) * 0.6
  const onRing = d > 3 && Math.abs(((d + wob) % 4.2) - 2.1) > 1.65
  if (!onSpoke && !onRing && d > 2) return null
  if (world === "oficina") return onSpoke ? (Math.round(d) % 7 === 3 ? "n" : "h") : (Math.round(a * 6) % 4 === 0 ? "i" : "g")
  return onSpoke ? "w" : d > edge - 3 ? "u" : "v"
}
for (const world of ["oficina", "medieval", "cyberpunk"]) {
  sprite(`zona-${world}_z00`, { w: ZW, h: ZW }, (c) => {
    for (let y = -ZR; y <= ZR; y++) for (let x = -ZR; x <= ZR; x++) {
      const k = zone(world, x, y)
      if (k) c.px(x + ZR, ZR - y, k)
    }
  })
}
