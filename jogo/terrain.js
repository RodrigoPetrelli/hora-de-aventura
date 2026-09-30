// Terrain: seeded heightfield, biomes (with their sky colours), minimap.
import * as THREE from "three";
import { toon } from "./toon.js";

export const WORLD = { half: 400, cell: 2.5, limit: 350 };
const SEED = 1337;

export const P = {
  fort: { x: 0, z: 0 },
  spawn: { x: 0, z: 32 },
  rock: { x: 10, z: 27 },
  candy: { x: 250, z: 30 },
  cupcake: { x: 300, z: 95 },
  ice: { x: 0, z: -275 },
  icePillars: { x: -75, z: -200 },
  fire: { x: 20, z: 270 },
  marcy: { x: -250, z: -10 },
  lumpy: { x: -290, z: -70 },
  lair: { x: 200, z: -130 }, // the Dark Lair floats way up here, out of reach (lair.js)
  colosseum: { x: -160, z: 200 }, // and so does the Flame King's Colosseum of Flames (colosseum.js)
  temple: { x: 125, z: -55 }, // the Temple of the Enchiridion: the three boss crystals open it (temple.js)
  lich: { x: -60, z: -150 }, // the Lich's cave of bones, in his own dimension way up here (lich.js)
};
export const LAVA = [
  { x: -30, z: 230, r: 14 },
  { x: 66, z: 222, r: 12 },
  { x: 52, z: 322, r: 15 },
  { x: -44, z: 304, r: 11 },
  { x: 95, z: 280, r: 9 },
];
// the lava moat round the Fire Palace (open where the road comes in) and the lava rivers
// running from it into the lakes: chains of overlapping pools
{
  const F = P.fire, TAU = Math.PI * 2, road = Math.atan2(11 - F.x, 238 - F.z);
  for (let k = 0; k < 32; k++) {
    const a = (k / 32) * TAU;
    if (Math.abs(Math.atan2(Math.sin(a - road), Math.cos(a - road))) < 0.22) continue;
    LAVA.push({ x: F.x + Math.sin(a) * 35, z: F.z + Math.cos(a) * 35, r: 5.2 });
  }
  for (const lake of [LAVA[2], LAVA[3], LAVA[1], LAVA[4]]) {
    const dx = lake.x - F.x, dz = lake.z - F.z, d = Math.hypot(dx, dz), ux = dx / d, uz = dz / d;
    const len = d - lake.r + 2 - 35, n = Math.max(1, Math.round(len / 4.3));
    for (let i = 1; i <= n; i++) {
      const t = 35 + (len * i) / (n + 1), w = Math.sin(i * 1.7) * 2.2;
      LAVA.push({ x: F.x + ux * t - uz * w, z: F.z + uz * t + ux * w, r: 3.9 });
    }
  }
}
// sky: [zenith, horizon]; light: hemisphere sky tint
export const BIOMES = [
  { key: "grass", x: 0, z: 0, c1: 0x92d650, c2: 0x6fc043, map: "#86cf52", sky: [0x3fb0f0, 0xc4ecff], light: 0xffffff },
  { key: "candy", x: 250, z: 30, c1: 0xffc6e6, c2: 0xf6a3d3, map: "#f7b3da", sky: [0x6cc0f0, 0xffe0f2], light: 0xfff0f8 },
  { key: "ice", x: 0, z: -270, c1: 0xf7fcff, c2: 0xcfe6f8, map: "#e2f1fb", sky: [0x4fb7ee, 0xe2f6ff], light: 0xf0f8ff },
  { key: "fire", x: 20, z: 265, c1: 0x5a2329, c2: 0x3c181e, map: "#6a2a2a", sky: [0x4a0c10, 0xd8401e], light: 0xffb08a },
  { key: "dark", x: -250, z: -10, c1: 0xd67a44, c2: 0xa7512f, map: "#c86a3c", sky: [0x7a3462, 0xffae5c], light: 0xffd2a8 },
];

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
function hash2(ix, iz) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(SEED, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, z) => vnoise(x / 70, z / 70) + 0.5 * vnoise(x / 28 + 7.1, z / 28 - 3.3) + 0.22 * vnoise(x / 11 - 2.7, z / 11 + 9.4);
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function biomeIndexAt(x, z) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < BIOMES.length; i++) {
    const dx = x - BIOMES[i].x, dz = z - BIOMES[i].z, d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
export function biomeWeights(x, z, out) {
  let sum = 0;
  for (let i = 0; i < BIOMES.length; i++) {
    const dx = x - BIOMES[i].x, dz = z - BIOMES[i].z, d2 = dx * dx + dz * dz + 900;
    out[i] = 1 / (d2 * d2);
    sum += out[i];
  }
  for (let i = 0; i < BIOMES.length; i++) out[i] /= sum;
  return out;
}
export function areaAt(x, y, z) {
  if (y > 300 && Math.hypot(x - P.lair.x, z - P.lair.z) < 60) return "lair"; // the Peppermint Butler's (lair.js)
  if (y > 300 && Math.hypot(x - P.colosseum.x, z - P.colosseum.z) < 90) return "colosseum"; // the Flame King's (colosseum.js)
  if (y > 300 && Math.hypot(x - P.lich.x, z - P.lich.z) < 60) return "lichcave"; // the Lich's (lich.js)
  if (y > 25 && Math.hypot(x - P.lumpy.x, z - P.lumpy.z) < 62) return "sky";
  if (Math.hypot(x - P.fort.x, z - P.fort.z) < 11 && y > 1 && y < 40) return "fort";
  // inside the buildings you can walk into
  const dc = Math.hypot(x - P.candy.x, z - P.candy.z);
  if ((dc < 11 && y < 11.5) || (dc < 15.6 && y < 6.5)) return "candycastle";
  if (dc < 19.6 && y < 6.5) { // Bubblegum's lab wing (LAB in candy.js)
    const la = Math.atan2(-P.candy.x, -P.candy.z) + Math.PI / 2, a = Math.atan2(x - P.candy.x, z - P.candy.z);
    const d = Math.atan2(Math.sin(a - la), Math.cos(a - la));
    if (d > -1.0 && d < 1.05) return "candycastle";
  }
  if (Math.hypot(x - P.ice.x, z - P.ice.z) < 15 && y < 36) return "icecastle";
  if (Math.hypot(x - P.ice.x, z - P.ice.z) < 17 && y > 62) return "icetop"; // the Ice Crown (ice.js)
  if (Math.hypot(x - P.fire.x, z - P.fire.z) < 7.5 && y < 7.6) return "firecastle";
  if (Math.hypot(x - P.temple.x, z - P.temple.z) < 11.5 && y < 20) return "temple";
  if (Math.abs(x - (P.marcy.x - 2)) < 5.5 && Math.abs(z - P.marcy.z) < 4.5 && y < 8) return "marcyhouse";
  return BIOMES[biomeIndexAt(x, z)].key;
}

// dirt roads from the Tree Fort to each kingdom (painted on the ground; props keep off them)
export const ROADS = [
  [[0, 21], [30, 38], [75, 44], [120, 33], [160, 25], [190, 22]], // Candy Kingdom gate
  [[0, -12], [-14, -60], [-6, -120], [8, -175], [2, -238]], // Ice Kingdom
  [[4, 21], [18, 80], [6, 140], [16, 196], [10, 246]], // Fire Kingdom
  [[-12, 4], [-60, 12], [-120, -2], [-180, -6], [-224, -10]], // Marceline's cave
];
/** Distance from (x, z) to the nearest road centre line. */
export function roadDist(x, z) {
  let best = Infinity;
  for (const road of ROADS)
    for (let i = 0; i + 1 < road.length; i++) {
      const [ax, az] = road[i], [bx, bz] = road[i + 1];
      const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
      const t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1);
      const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
      if (d < best) best = d;
    }
  return best;
}

/** How far into Lumpy Space a point is (0..1): high up, over the lumpy islands. Tints sky, fog and light. */
export function lumpyAt(p) {
  return clamp((p.y - 14) / 22, 0, 1) * (1 - smooth(55, 95, Math.hypot(p.x - P.lumpy.x, p.z - P.lumpy.z)));
}

// the mushroom trail from the cave to Lumpy Space (shared with the builders)
export function mushroomTrail() {
  const S0 = { x: P.marcy.x + 30, z: P.marcy.z - 30 };
  const L = P.lumpy;
  const a0 = Math.atan2(S0.z - L.z, S0.x - L.x);
  const E = { x: L.x + Math.cos(a0) * 14, z: L.z + Math.sin(a0) * 14 };
  return { S0, E, a0 };
}

const FLAT = [
  { x: P.fort.x, z: P.fort.z + 8, r: 44, b: 22, h: 0.2 },
  { x: P.candy.x, z: P.candy.z, r: 46, b: 24, h: 1 },
  { x: P.cupcake.x, z: P.cupcake.z, r: 16, b: 12, h: 1.5 },
  { x: P.fire.x, z: P.fire.z, r: 26, b: 18, h: 0.5 },
  { x: P.marcy.x, z: P.marcy.z, r: 30, b: 18, h: 1 },
  { x: P.lumpy.x, z: P.lumpy.z, r: 26, b: 14, h: 2 },
  { x: P.temple.x, z: P.temple.z, r: 18, b: 12, h: 0.3 },
];
// ── water in the Grass Lands (water.js draws it; the ground is carved to fit) ──
// Rocky hills with a waterfall: a plateau h high whose side facing (tx, tz) drops as a cliff,
// hidden in a wall of rocks that ends at radius rf; round the back it slopes down over `back`.
export const HILLS = [
  { x: 86, z: -106, rf: 18, h: 12, back: 24, tx: 60, tz: -78 },
  { x: -92, z: -96, rf: 17, h: 11, back: 24, tx: -62, tz: -80 },
  { x: -102, z: 112, rf: 16, h: 11, back: 22, tx: -75, tz: 88 },
  { x: -52, z: 38, rf: 9, h: 7, back: 14, tx: -68, tz: 66 },
];
for (const hl of HILLS) {
  hl.face = Math.atan2(hl.tx - hl.x, hl.tz - hl.z);
  hl.at = (d) => [hl.x + Math.sin(hl.face) * d, hl.z + Math.cos(hl.face) * d];
}
function hillHeight(hl, x, z) {
  const dx = x - hl.x, dz = z - hl.z, d = Math.hypot(dx, dz);
  if (d > hl.rf + hl.back + 2) return 0;
  const f = smooth(0.35, 0.85, Math.cos(Math.atan2(dx, dz) - hl.face)); // 1 on the cliff side
  const r0 = hl.rf - lerp(4, 5.6, f) + (vnoise(x / 9 + 31, z / 9 - 12) - 0.5) * 4 * (1 - f);
  return (1 - smooth(r0, r0 + lerp(hl.back, 3, f), d)) * (hl.h + (vnoise(x / 6, z / 6 + 50) - 0.5) * 0.8);
}
/** Is (x, z) in the wall of rocks round a waterfall, or the clearing in front of it (nothing grows there)? */
export function nearCliff(x, z, pad = 0) {
  for (const hl of HILLS) {
    const dx = x - hl.x, dz = z - hl.z, d = Math.hypot(dx, dz);
    if (d > hl.rf - 7.5 - pad && d < hl.rf + 3 + pad && Math.cos(Math.atan2(dx, dz) - hl.face) > 0.5) return true;
    const [cx, cz] = hl.at(hl.rf + hl.rf * 0.45);
    if (Math.hypot(x - cx, z - cz) < hl.rf * 0.5 + pad) return true;
  }
  return false;
}
// Ponds and lakes (a waterfall adds its plunge pool, a spring its little pond). Streams are
// reaches of control points [x, z] with the water's half-width w (to w1 downstream); a reach that
// ends on a hill's lip falls into the next. Levels follow the ground, always downhill.
export const PONDS = [
  { x: 44, z: -37, r: 10 },
  { x: 60, z: 111, r: 12 },
  { x: -28, z: -86, r: 9 },
  { x: -68, z: 66, r: 11 },
];
const lip = (i) => HILLS[i].at(HILLS[i].rf), pool = (i, w) => HILLS[i].at(HILLS[i].rf + w + 2.2);
const STREAMS = [
  [{ w: 1.4, pts: [[93, -114], [86, -104], [79, -98], lip(0)] },
    { w: 2.0, w1: 3.0, pts: [pool(0, 2.0), [62, -78], [54, -64], [48, -50], [44, -37], [50, -24], [54, -8], [56, 10], [58, 28], [60, 42], [56, 58], [48, 74], [46, 90], [52, 102], [60, 111]] }],
  [{ w: 1.3, pts: [[-100, -104], [-92, -97], [-84, -92], lip(1)] },
    { w: 1.9, w1: 2.4, pts: [pool(1, 1.9), [-62, -82], [-50, -80], [-40, -82], [-28, -86]] }],
  [{ w: 1.3, pts: [[-108, 120], [-100, 110], [-94, 105], lip(2)] },
    { w: 1.9, w1: 2.3, pts: [pool(2, 1.9), [-80, 90], [-74, 80], [-68, 66]] }],
  [{ w: 1.0, pts: [[-51, 37.5], lip(3)] },
    { w: 1.5, pts: [pool(3, 1.5), [-63, 56], [-68, 66]] }],
];
const BANK = 6;
/** Streams, ponds and falls with their levels (for water.js); filled in below. */
export const WATER = { reaches: [], ponds: PONDS, falls: [], hills: HILLS };
function buildWaterPlan() {
  const inPond = (p, q) => (p.x - q.x) ** 2 + (p.z - q.z) ** 2 < q.r * q.r;
  STREAMS.forEach((stream) => stream.forEach((rc, k) => {
    const pts = rc.pts.map(([x, z]) => new THREE.Vector3(x, 0, z));
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal"), len = curve.getLength(), n = Math.max(2, Math.ceil(len));
    const S = curve.getSpacedPoints(n).map((v, i) => ({ x: v.x, z: v.z, s: (len * i) / n, w: lerp(rc.w, rc.w1 ?? rc.w, i / n) }));
    // a spring at the top of each stream, a plunge pool below each waterfall
    if (k === 0) PONDS.push({ x: S[0].x, z: S[0].z, r: rc.w + 1.1, bank: 2, spring: true });
    else PONDS.push({ x: S[0].x, z: S[0].z, r: rc.w + 2.4, bank: 1.5, pool: true });
    // the water 0.35 below the (smoothed) ground, never climbing; level across ponds
    const raw = S.map((p) => landHeight(p.x, p.z) - 0.35);
    let prev = Infinity;
    S.forEach((p, i) => {
      let sum = 0, c = 0;
      for (let j = Math.max(0, i - 4); j <= Math.min(n, i + 4); j++) { sum += raw[j]; c++; }
      let L = Math.min(prev, sum / c);
      const q = PONDS.find((o) => inPond(p, o));
      if (q) { if (q.L === undefined) q.L = L; L = q.L; }
      p.L = prev = L;
    });
    // ...and never below a pond it runs into further down
    let floor = -Infinity;
    for (let i = n; i >= 0; i--) {
      const q = PONDS.find((o) => inPond(S[i], o));
      if (q) floor = Math.max(floor, q.L);
      S[i].L = Math.max(S[i].L, floor);
    }
    const falls = k + 1 < stream.length;
    if (falls) { // level to the lip, through the wall of rocks (where the ground is left alone)
      const hold = S.find((p) => p.s >= len - 6).L;
      for (const p of S) if (p.s >= len - 6) { p.L = hold; p.hold = true; }
    }
    if (k > 0) {
      const up = WATER.reaches[WATER.reaches.length - 1], a = up[up.length - 1], hl = HILLS.find((h) => Math.hypot(h.x - S[0].x, h.z - S[0].z) < h.rf + 8);
      WATER.falls.push({ lip: a, base: S[0], w: a.w, hill: hl });
    }
    WATER.reaches.push(S);
  }));
  for (const q of PONDS) if (q.L === undefined) q.L = landHeight(q.x, q.z) - 0.6;
}
// stream segments bucketed on a coarse grid, so carving the ground stays quick
const SEGS = [], BUCKET = 8, buckets = new Map();
const bkey = (i, j) => i * 4096 + j;
function bucketSegments() {
  for (const S of WATER.reaches)
    for (let i = 0; i + 1 < S.length; i++) {
      const a = S[i], b = S[i + 1], m = Math.max(a.w, b.w) + 1.5 + BANK, k = SEGS.length;
      SEGS.push({ a, b, capA: i === 0, capB: i + 2 === S.length, noRaise: !!(a.hold || b.hold) });
      for (let bi = Math.floor((Math.min(a.x, b.x) - m) / BUCKET); bi <= Math.floor((Math.max(a.x, b.x) + m) / BUCKET); bi++)
        for (let bj = Math.floor((Math.min(a.z, b.z) - m) / BUCKET); bj <= Math.floor((Math.max(a.z, b.z) + m) / BUCKET); bj++) {
          const key = bkey(bi, bj);
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key).push(k);
        }
    }
}
const segT = (sg, x, z) => {
  const { a, b } = sg, dx = b.x - a.x, dz = b.z - a.z;
  return ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz);
};
// nearest point of stream segment k: [distance, half-width, level], or null when another segment
// (or nothing, past the ends of a stream) owns the point
function segNear(k, x, z) {
  const sg = SEGS[k], { a, b } = sg, t = segT(sg, x, z);
  if (t < 0 && (sg.capA || segT(SEGS[k - 1], x, z) <= 1)) return null;
  if (t > 1 && (sg.capB || segT(SEGS[k + 1], x, z) >= 0)) return null;
  const u = clamp(t, 0, 1), dx = b.x - a.x, dz = b.z - a.z;
  return [Math.hypot(x - a.x - dx * u, z - a.z - dz * u), lerp(a.w, b.w, u), lerp(a.L, b.L, u)];
}
// the ground shaped round water of half-width w at level L: a bed D deep, banks just above the
// water, blending back into the land over `bank`
function bankShape(h, d, w, L, D, bank) {
  const target = d < w ? L - 0.08 - D * (1 - (d / w) ** 2) : L + 0.3 * smooth(w, w + 1.5, d);
  return lerp(target, h, smooth(w + 1.5, w + 1.5 + bank, d));
}
function carveWater(x, z, h) {
  let lo = h, hi = h;
  // in a pond a stream running through only digs (its banks would make islands)
  const wet = PONDS.some((q) => (x - q.x) ** 2 + (z - q.z) ** 2 < (q.r + 1.5) ** 2);
  const list = buckets.get(bkey(Math.floor(x / BUCKET), Math.floor(z / BUCKET)));
  if (list) for (const k of list) {
    const near = segNear(k, x, z);
    if (!near) continue;
    const [d, w, L] = near;
    if (d > w + 1.5 + BANK) continue;
    const v = bankShape(h, d, w, L, 0.75, BANK);
    if (v < lo) lo = v; else if (v > hi && !SEGS[k].noRaise && !wet) hi = v;
  }
  for (const q of PONDS) {
    const bank = q.bank ?? BANK, d = Math.hypot(x - q.x, z - q.z);
    if (d > q.r + 1.5 + bank) continue;
    const v = bankShape(h, d, q.r, q.L, q.pool ? 1.2 : q.spring ? 0.6 : 1.6, bank);
    if (v < lo) lo = v; else if (v > hi) hi = v;
  }
  return h - lo > hi - h ? lo : hi;
}
/** Distance from (x, z) to the nearest water's edge (negative in the water) and that water's level. */
export function waterInfo(x, z) {
  let d = Infinity, L = 0;
  const list = buckets.get(bkey(Math.floor(x / BUCKET), Math.floor(z / BUCKET)));
  if (list) for (const k of list) {
    const near = segNear(k, x, z);
    if (near && near[0] - near[1] < d) { d = near[0] - near[1]; L = near[2]; }
  }
  for (const q of PONDS) {
    const dd = Math.hypot(x - q.x, z - q.z) - q.r;
    if (dd < d) { d = dd; L = q.L; }
  }
  return { d, L };
}

function rawHeight(x, z) {
  let h = carveWater(x, z, landHeight(x, z));
  // flat trail from the cave to Lumpy Space
  const { S0, E } = mushroomTrail();
  for (let t = 0; t <= 1; t += 0.25) {
    const px = lerp(S0.x, E.x, t), pz = lerp(S0.z, E.z, t);
    h = lerp(h, 2, 1 - smooth(8, 16, Math.hypot(x - px, z - pz)));
  }
  for (const p of LAVA) h = lerp(h, -3, 1 - smooth(p.r - 5, p.r + 2, Math.hypot(x - p.x, z - p.z)));
  const d0 = Math.hypot(x, z);
  if (d0 > 320) h += (d0 - 320) * (d0 - 320) * 0.035;
  return h;
}
function landHeight(x, z) {
  let h = (fbm(x, z) - 0.85) * 8;
  // Ice Kingdom plateau (the giant ice mountain stands on it)
  const di = Math.hypot(x - P.ice.x, z - P.ice.z);
  h += 22 * (1 - smooth(30, 120, di));
  h = lerp(h, 22, 1 - smooth(34, 40, di));
  // canyon ridges around Marceline's cave
  const dm = Math.hypot(x - P.marcy.x, z - P.marcy.z);
  const canyon = 1 - smooth(95, 150, dm);
  if (canyon > 0) {
    const n = vnoise(x / 38 + 11, z / 38 - 5);
    h += canyon * Math.pow(1 - Math.abs(2 * n - 1), 2.2) * 18;
  }
  for (const f of FLAT) h = lerp(h, f.h, 1 - smooth(f.r, f.r + f.b, Math.hypot(x - f.x, z - f.z)));
  for (const hl of HILLS) h += hillHeight(hl, x, z);
  return h;
}
buildWaterPlan();
bucketSegments();

const N = (WORLD.half * 2) / WORLD.cell;
const V = N + 1;
let heights = null;
export function groundHeight(x, z) {
  const gx = (x + WORLD.half) / WORLD.cell, gz = (z + WORLD.half) / WORLD.cell;
  const i = clamp(Math.floor(gx), 0, N - 1), j = clamp(Math.floor(gz), 0, N - 1);
  const fx = clamp(gx - i, 0, 1), fz = clamp(gz - j, 0, 1);
  const h00 = heights[j * V + i], h10 = heights[j * V + i + 1];
  const h01 = heights[(j + 1) * V + i], h11 = heights[(j + 1) * V + i + 1];
  if (fx + fz <= 1) return h00 + (h10 - h00) * fx + (h01 - h00) * fz;
  return h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
}

export function buildTerrain() {
  heights = new Float32Array(V * V);
  for (let j = 0; j <= N; j++)
    for (let i = 0; i <= N; i++) heights[j * V + i] = rawHeight(-WORLD.half + i * WORLD.cell, -WORLD.half + j * WORLD.cell);

  const pos = new Float32Array(V * V * 3), col = new Float32Array(V * V * 3);
  const w = new Array(BIOMES.length).fill(0);
  const C1 = BIOMES.map((b) => new THREE.Color(b.c1)), C2 = BIOMES.map((b) => new THREE.Color(b.c2));
  const rim = new THREE.Color(0x9fbad6), lava = new THREE.Color(0x2a0c08), lawn = new THREE.Color(0xe6ea8c);
  const path = new THREE.Color(0xe0b870), tmp = new THREE.Color(), acc = new THREE.Color();
  const caveFloor = new THREE.Color(0x56645a), sand = new THREE.Color(0xd8c48c), lush = new THREE.Color(0x4f9f34), stone = new THREE.Color(0x938d80);
  const H = (i, j) => heights[clamp(j, 0, N) * V + clamp(i, 0, N)];
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      const k = j * V + i, x = -WORLD.half + i * WORLD.cell, z = -WORLD.half + j * WORLD.cell, h = heights[k];
      pos[k * 3] = x;
      pos[k * 3 + 1] = h;
      pos[k * 3 + 2] = z;
      biomeWeights(x, z, w);
      const n = vnoise(x / 13 + 40, z / 13 - 17);
      acc.setRGB(0, 0, 0);
      for (let b = 0; b < BIOMES.length; b++) {
        tmp.copy(C1[b]).lerp(C2[b], n);
        acc.r += tmp.r * w[b];
        acc.g += tmp.g * w[b];
        acc.b += tmp.b * w[b];
      }
      // lawn inside the Candy Kingdom's licorice wall
      const dc = Math.hypot(x - P.candy.x, z - P.candy.z);
      if (dc < 44) acc.lerp(lawn, 1 - smooth(36, 44, dc));
      // dirt yard + path at the Tree Fort, and the roads out to the kingdoms
      const dy = Math.hypot(x - P.fort.x, z - (P.fort.z + 10));
      if (dy < 20 && Math.abs(x) < 3.5 && z > 10) acc.lerp(path, 0.55);
      // the damp, dark floor inside Marceline's cave
      const dm = Math.hypot(x - P.marcy.x, z - P.marcy.z);
      if (dm < 25) acc.lerp(caveFloor, 1 - smooth(19, 25, dm));
      const dr = roadDist(x, z);
      if (dr < 5 && dc > 40) acc.lerp(path, (1 - smooth(2.2, 5, dr)) * 0.75);
      const d0 = Math.hypot(x, z);
      if (d0 > 320) acc.lerp(rim, smooth(15, 70, h) * 0.65);
      for (const p of LAVA) {
        const dl = Math.hypot(x - p.x, z - p.z);
        if (dl < p.r + 3) acc.lerp(lava, 1 - smooth(p.r - 2, p.r + 3, dl));
      }
      // lusher grass by the water, wet sand at the waterline, bare rock on the hills' steep sides
      const wi = waterInfo(x, z);
      if (wi.d < 6) {
        acc.lerp(lush, (1 - smooth(1, 6, wi.d)) * 0.5);
        if (wi.d < 3) acc.lerp(sand, (1 - smooth(wi.L + 0.1, wi.L + 0.55, h)) * (1 - smooth(1.5, 3, wi.d)));
      }
      for (const hl of HILLS) {
        if (Math.hypot(x - hl.x, z - hl.z) > hl.rf + hl.back) continue;
        const slope = Math.hypot(H(i + 1, j) - H(i - 1, j), H(i, j + 1) - H(i, j - 1)) / (2 * WORLD.cell);
        acc.lerp(stone, smooth(0.45, 0.9, slope) * 0.85);
      }
      col[k * 3] = acc.r;
      col[k * 3 + 1] = acc.g;
      col[k * 3 + 2] = acc.b;
    }
  }
  const idx = new Uint32Array(N * N * 6);
  let p = 0;
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const a = j * V + i, b = (j + 1) * V + i, c = j * V + i + 1, d = (j + 1) * V + i + 1;
      idx[p++] = a; idx[p++] = b; idx[p++] = c;
      idx[p++] = c; idx[p++] = b; idx[p++] = d;
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  // cut into square chunks so the ones behind the camera aren't drawn (normals come from the
  // whole, so the seams don't show)
  const nrm = geo.attributes.normal.array, mat = toon(0xffffff, { vc: true, tex: "grass", scale: 0.16, outline: false });
  const group = new THREE.Group(), C = 64;
  for (let j0 = 0; j0 < N; j0 += C)
    for (let i0 = 0; i0 < N; i0 += C) {
      const i1 = Math.min(N, i0 + C), j1 = Math.min(N, j0 + C), w = i1 - i0 + 1, h = j1 - j0 + 1;
      const cp = new Float32Array(w * h * 3), cc = new Float32Array(w * h * 3), cn = new Float32Array(w * h * 3);
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const src = (j * V + i) * 3, dst = ((j - j0) * w + (i - i0)) * 3;
          for (let e = 0; e < 3; e++) { cp[dst + e] = pos[src + e]; cc[dst + e] = col[src + e]; cn[dst + e] = nrm[src + e]; }
        }
      const ci = new Uint32Array((w - 1) * (h - 1) * 6);
      let q = 0;
      for (let j = 0; j < h - 1; j++)
        for (let i = 0; i < w - 1; i++) {
          const a = j * w + i, b = (j + 1) * w + i, c = j * w + i + 1, d = (j + 1) * w + i + 1;
          ci[q++] = a; ci[q++] = b; ci[q++] = c;
          ci[q++] = c; ci[q++] = b; ci[q++] = d;
        }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(cp, 3));
      g.setAttribute("color", new THREE.BufferAttribute(cc, 3));
      g.setAttribute("normal", new THREE.BufferAttribute(cn, 3));
      g.setIndex(new THREE.BufferAttribute(ci, 1));
      group.add(new THREE.Mesh(g, mat));
    }
  return group;
}

export function paintMinimap(ctx, size) {
  const img = ctx.createImageData(size, size);
  const w = new Array(BIOMES.length).fill(0);
  const cols = BIOMES.map((b) => new THREE.Color(b.map));
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = (px / size - 0.5) * 2 * WORLD.limit, z = (py / size - 0.5) * 2 * WORLD.limit;
      biomeWeights(x, z, w);
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < BIOMES.length; i++) { r += cols[i].r * w[i]; g += cols[i].g * w[i]; b += cols[i].b * w[i]; }
      const shade = 0.85 + clamp(groundHeight(x, z) / 60, -0.2, 0.35);
      let lavaHit = false;
      for (const p of LAVA) if ((x - p.x) ** 2 + (z - p.z) ** 2 < p.r * p.r) lavaHit = true;
      const o = (py * size + px) * 4;
      if (lavaHit) { img.data[o] = 255; img.data[o + 1] = 90; img.data[o + 2] = 26; }
      else if (waterInfo(x, z).d < 0.5) { img.data[o] = 84; img.data[o + 1] = 186; img.data[o + 2] = 232; }
      else if (roadDist(x, z) < 2.6 && Math.hypot(x - P.candy.x, z - P.candy.z) > 40) { img.data[o] = 214; img.data[o + 1] = 178; img.data[o + 2] = 110; }
      else {
        img.data[o] = Math.min(255, Math.pow(r, 1 / 2.2) * 255 * shade);
        img.data[o + 1] = Math.min(255, Math.pow(g, 1 / 2.2) * 255 * shade);
        img.data[o + 2] = Math.min(255, Math.pow(b, 1 / 2.2) * 255 * shade);
      }
      img.data[o + 3] = Math.hypot(x, z) > WORLD.limit ? 0 : 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}
