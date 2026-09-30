// The Fire Kingdom: the Fire Palace (a pyramid hill of volcanic chimneys, hollow at the
// bottom: Flame Princess's throne room with the Flame King's giant lantern), the lava moat
// and rivers, lanterns on stilts, walls of fire, the royal emblem in the sky, the town.
// The Candy Kingdom lives in candy.js, the Ice Kingdom in ice.js, Marceline's cave (and the
// trail up to Lumpy Space) in marceline.js. BRAZIERS: the Path of Flames of Flame Princess's quest
// (flamepath.js); the Flame King's arena is colosseum.js.
import * as THREE from "three";
import { toon } from "./toon.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { GEO, mtx } from "./builder.js";
import { boxCollider, cylCollider, ringCollider } from "./physics.js";
import { P, LAVA, rng, mushroomTrail } from "./terrain.js";

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
/**
 * The Path of Flames (Flame Princess's quest: flamepath.js), lit in this order: { x, y (the surface
 * it stands on), z, time (s the Royal Flame lasts on the way here from the one before), small (on a
 * chimney: a little one, and not solid, so the climb stays clear) }. Filled by buildFire.
 */
export const BRAZIERS = [];

// ── Fire Kingdom ─────────────────────────────────────────────────────────────
export function buildFire(B, W) {
  const F = P.fire, g = W.ground(F.x, F.z), r = rng(5005);
  const M = {
    rock: toon(0x3b2127, { tex: "rock", scale: 0.2 }),
    rockL: toon(0x5a2c30, { tex: "rock", scale: 0.2 }),
    rim: toon(0x6a3434, { tex: "rock", scale: 0.3 }),
    glow: toon(0xff7a1a, { emissive: 0xff4400, outline: false }),
    lava: toon(0xff8a2a, { emissive: 0xff5a00, outline: false }),
    win: toon(0xffb13b, { emissive: 0xff6a00 }),
    bulb: toon(0xff7a2a, { emissive: 0xb03000 }),
    rib: toon(0x5a1a10),
    smoke: toon(0x2a1a1e),
    basalt: toon(0x3a302c, { tex: "rock", scale: 0.3 }),
    path: toon(0x6a6070, { tex: "stone", scale: 0.35, outline: false }),
    flame: toon(0xffa53b, { emissive: 0xff5500, outline: false }),
    flameIn: toon(0xfff08a, { emissive: 0xffb000, outline: false }),
    // inside the palace
    hall: toon(0x5a1e22, { tex: "rock", scale: 0.15, side: THREE.BackSide, outline: false }),
    floor: toon(0x3a2224, { tex: "rock", scale: 0.25 }),
    carpet: toon(0x8a1a1e, { outline: false }), carpetE: toon(0xff8a2a, { emissive: 0x662200, outline: false }),
    curtain: toon(0xa0181e), cushion: toon(0xd8283a),
    gold: toon(0xf6c343, { emissive: 0x4a2800 }), glass: toon(0xffc070, { opacity: 0.45, outline: false, emissive: 0x442200 }),
    wood: toon(0x5a3a22),
  };
  const at = (a, rr) => [F.x + Math.sin(a) * rr, F.z + Math.cos(a) * rr];
  const flameTop = (x, y, z, s) => {
    B.cone(x, y, z, 0.55 * s, 1.8 * s, M.flame, { seg: 7 });
    B.cone(x, y + 0.05, z, 0.32 * s, 1.1 * s, M.flameIn, { seg: 6 });
    for (const [dx, dz, h] of [[0.35, 0.1, 1.0], [-0.3, -0.2, 1.2], [0.05, -0.35, 0.9]]) B.cone(x + dx * s, y, z + dz * s, 0.22 * s, h * s, M.flame, { seg: 5 });
  };
  // a volcanic chimney: tapered, hollow at the top with lava glowing inside, triangle windows
  const spire = (x, z, y0, h, r0, r1, wins = 0, face = 0, solid = true) => {
    B.cyl(x, y0, z, r0, h, r() < 0.5 ? M.rock : M.rockL, { rTop: r1, seg: 10, solid });
    B.raw(GEO.torus(r1 * 0.92, r1 * 0.16, TAU, 12), M.rim, mtx(x, y0 + h, z, 0, 1, 1, 1, Math.PI / 2));
    B.raw(GEO.circle(10), M.lava, mtx(x, y0 + h - 0.12, z, 0, r1 * 0.82, r1 * 0.82, 1, -Math.PI / 2));
    for (let k = 0; k < wins; k++) {
      const a = face + (k - (wins - 1) / 2) * 0.9, y = y0 + h * (0.45 + (k % 2) * 0.2), rr = r0 + (r1 - r0) * ((y - y0) / h);
      B.cone(x + Math.sin(a) * rr * 0.98, y, z + Math.cos(a) * rr * 0.98, 0.42, 0.95, M.win, { seg: 3, ry: a, sz: 0.2 });
    }
  };

  const pathPts = [];
  // ── the Fire Palace: a pyramid hill of chimneys, hollow at the bottom (the throne room) ──
  const HO = 9.2, HT = 8.0, HH = 7.2, HI = 7.45, door = 0.25, doorA = Math.PI, dIn = (HO * Math.sin(door)) / HI;
  const rOut = (y) => HO + (HT - HO) * ((y - (g - 0.5)) / (HH + 0.5));
  B.cyl(F.x, g - 0.5, F.z, HO, HH + 0.5, M.rock, { rTop: HT, seg: 14, open: true, ts: doorA + door, tl: TAU - 2 * door, solid: false });
  B.cyl(F.x, g + 4.2, F.z, rOut(g + 4.2), HH - 4.2, M.rock, { rTop: HT, seg: 3, open: true, ts: doorA - door, tl: 2 * door, solid: false });
  B.cyl(F.x, g - 0.5, F.z, HI, HH + 0.5, M.hall, { open: true, seg: 14, ts: doorA + dIn, tl: TAU - 2 * dIn, solid: false });
  B.cyl(F.x, g + 4.2, F.z, HI, HH - 4.2, M.hall, { open: true, seg: 3, ts: doorA - dIn, tl: 2 * dIn, solid: false });
  for (const s of [-1, 1]) { // the door jambs close the wall's thickness
    const lat = HO * Math.sin(door), [jx, jz] = at(doorA, (HI + HO) / 2);
    B.box(jx + Math.cos(doorA) * lat * s, g - 0.5, jz - Math.sin(doorA) * lat * s, 0.3, 4.7, HO - HI + 0.2, M.rock, { solid: false, ry: doorA });
  }
  {
    const [ux, uz] = at(doorA, (HI + HO) / 2); // the underside of the lintel
    B.box(ux, g + 4.05, uz, 2 * HO * Math.sin(door) + 0.3, 0.3, HO - HI + 0.2, M.rock, { solid: false, ry: doorA });
  }
  B.cyl(F.x, g + HH, F.z, HT + 0.4, 0.45, M.rim, { seg: 14 });
  ringCollider(F.x, F.z, 8.2, 1.4, g - 1, g + HH, [[doorA, 0.8]]);
  { const [dx, dz] = at(doorA, 8.3); boxCollider(dx - 2.4, dx + 2.4, g + 4.2, g + HH, dz - 1.1, dz + 1.1); }
  W.sealed(F.x, F.z, 7.3, g - 1, g + HH, 55);
  // the doorway: a glowing arch, braziers, a path of grey stone out to the moat bridge
  {
    const [dx, dz] = at(doorA, HO - 0.2);
    B.raw(GEO.torus(2.1, 0.3, Math.PI, 16), M.glow, mtx(dx, g + 3.9, dz, doorA));
    for (const s of [-1, 1]) {
      const bx = dx + Math.cos(doorA) * 3.3 * s, bz = dz - Math.sin(doorA) * 3.3 * s;
      B.cyl(bx, g, bz, 0.5, 1.2, M.basalt, { seg: 8, rTop: 0.75 });
      flameTop(bx, g + 1.2, bz, 0.8);
    }
    const roadA = Math.atan2(11 - F.x, 238 - F.z), dA = Math.atan2(Math.sin(roadA - doorA), Math.cos(roadA - doorA));
    for (let i = 0; i <= 40; i++) {
      const t = i / 40, wig = Math.sin(t * Math.PI * 1.5) * 0.35 * (1 - Math.min(1, Math.max(0, (t - 0.55) / 0.2)));
      pathPts.push(at(doorA + wig + t * dA, HO + 0.6 + t * 30));
    }
    for (const [x, z] of pathPts) B.raw(GEO.circle(12), M.path, mtx(x, W.ground(x, z) + 0.06, z, r() * 3, 1.9, 1.9, 1, -Math.PI / 2));
  }
  // the climb: a spiral of chimney stumps round the palace, up to the top of the central tower
  let a = doorA + 0.75;
  const firePts = [];
  const stumps = [];
  for (let k = 0; k < 15; k++) {
    const rk = k < 14 ? 16.5 - k * 0.48 : 6.9;
    if (k > 0) a += k < 14 ? 4.4 / rk : 0.55;
    const [x, z] = at(a, rk), top = g + 1.6 + k * 1.58, base = k < 14 ? W.ground(x, z) - 1 : g + HH;
    firePts.push({ x, z, y: top });
    stumps.push([x, z]);
    spire(x, z, base, top - base, 1.9, 1.6, k % 3 === 1 ? 1 : 0, a);
  }
  // the central tower on the roof; the treasure waits on its top, the royal fire behind it
  const TT = g + 22;
  B.cyl(F.x, g + HH, F.z, 4.6, TT - g - HH, M.rock, { rTop: 4.1, seg: 16 });
  B.raw(GEO.torus(4.0, 0.3, TAU, 24), M.glow, mtx(F.x, TT, F.z, 0, 1, 1, 1, Math.PI / 2));
  for (let k = 0; k < 8; k++) {
    const wa = (k / 8) * TAU + 0.2, y = g + HH + 3 + (k % 3) * 3.4, rr = 4.6 - ((y - g - HH) / (TT - g - HH)) * 0.5;
    B.cone(F.x + Math.sin(wa) * rr, y, F.z + Math.cos(wa) * rr, 0.5, 1.2, M.win, { seg: 3, ry: wa, sz: 0.2 });
  }
  const last = stumps[14], la = Math.atan2(last[0] - F.x, last[1] - F.z);
  const [tx, tz] = at(la, 1.8), [fx, fz] = at(la + Math.PI, 2.0);
  W.treasure("firetower", tx, TT, tz);
  W.course("castelo-de-fogo", { x: F.x + Math.sin(doorA + 0.75) * 21, z: F.z + Math.cos(doorA + 0.75) * 21 }, [...firePts, { x: tx, z: tz, y: TT }], "firetower");
  flameTop(fx, TT, fz, 3.2);
  // more chimneys: on the roof, hugging the hall, and a skirt round the foot (clear of the climb and the door)
  const clear = (x, z, rad, pad = 1.4) => {
    for (const [sx, sz] of stumps) if (Math.hypot(x - sx, z - sz) < rad + 1.9 + pad) return false;
    const [dx, dz] = at(doorA, 12);
    if (Math.hypot(x - dx, z - dz) < rad + 4.5) return false;
    for (const [px, pz] of pathPts) if (Math.hypot(x - px, z - pz) < rad + 2.2) return false;
    return true;
  };
  for (let k = 0; k < 7; k++) {
    const ra = (k / 7) * TAU + 0.4, [x, z] = at(ra, 6.3), h = 4 + r() * 6;
    if (!clear(x, z, 1.3, 0.8)) continue;
    spire(x, z, g + HH, h, 1.4, 1.0, 1, ra);
  }
  for (let k = 0; k < 16; k++) {
    const ra = (k / 16) * TAU, [x, z] = at(ra, 10.2), h = 8 + r() * 6;
    if (!clear(x, z, 1.8)) continue;
    spire(x, z, g - 0.5, h, 2.0, 1.4, r() < 0.6 ? 2 : 0, ra);
  }
  for (let k = 0; k < 24; k++) {
    const ra = (k / 24) * TAU + 0.13, rad = 13.5 + (k % 3) * 1.1, [x, z] = at(ra, rad), h = 2.5 + r() * 5;
    if (!clear(x, z, 1.7)) continue;
    spire(x, z, W.ground(x, z) - 0.5, h, 1.8, 1.2, r() < 0.3 ? 1 : 0, ra);
  }
  // chimneys leaning on the tower, stepping down from its top: the palace reads as one hill of chimneys
  for (let k = 0; k < 9; k++) {
    const ba = la + 0.9 + (k / 9) * (TAU - 1.8), [x, z] = at(ba, 4.9), h = Math.min(TT - g - HH - 1.2, 7 + ((k * 5) % 9) * 1.1);
    if (!clear(x, z, 1.4, 0.6)) continue;
    spire(x, z, g + HH, h, 1.5, 1.15, k % 2, ba);
  }
  // dark smoke billowing from the top
  for (let k = 0; k < 16; k++) B.sphere(F.x + (r() - 0.5) * 9 + k * 0.6, TT + 5 + k * 1.3 + r() * 2, F.z + (r() - 0.5) * 9 + k * 0.4, 2.4 + r() * 2.4 + k * 0.12, M.smoke, { seg: 10 });

  // ── the throne room ──
  B.raw(GEO.circle(28), M.floor, mtx(F.x, g + 0.03, F.z, 0, 7.5, 7.5, 1, -Math.PI / 2));
  B.inside(F.x, F.z, 36, () => {
    // lava channels in the floor, a dark red carpet with glowing edges from the door to the throne
    for (let k = 0; k < 6; k++) {
      const ca = (k / 6) * TAU + Math.PI / 6, [x0, z0] = at(ca, 1.2), [x1, z1] = at(ca, 7.0);
      B.box((x0 + x1) / 2, g + 0.02, (z0 + z1) / 2, 0.22, 0.04, 5.8, M.lava, { solid: false, ry: ca });
    }
    B.raw(GEO.torus(1.2, 0.1, TAU, 20), M.lava, mtx(F.x, g + 0.05, F.z, 0, 1, 1, 1, Math.PI / 2));
    B.box(F.x, g + 0.05, F.z - 1.3, 2.2, 0.04, 12, M.carpetE, { solid: false });
    B.box(F.x, g + 0.07, F.z - 1.3, 1.8, 0.04, 11.8, M.carpet, { solid: false });
    // the throne: a knot of chimney stumps with glowing rims, a red cushion
    const T = at(0, 5.3);
    const knot = (x, z, h, rr) => {
      B.cyl(x, g, z, rr * 1.1, h, M.rockL, { rTop: rr, seg: 10 });
      B.raw(GEO.torus(rr * 0.9, 0.12, TAU, 12), M.glow, mtx(x, g + h, z, 0, 1, 1, 1, Math.PI / 2));
      B.raw(GEO.circle(10), M.lava, mtx(x, g + h - 0.1, z, 0, rr * 0.78, rr * 0.78, 1, -Math.PI / 2));
    };
    knot(T[0], T[1], 0.95, 0.85);
    B.cyl(T[0], g + 0.95, T[1], 0.72, 0.18, M.cushion, { solid: false, seg: 12 });
    for (const [dx, dz, h, rr] of [[0, 0.9, 3.4, 0.55], [-0.8, 0.7, 2.7, 0.5], [0.8, 0.7, 2.7, 0.5], [-1.2, -0.1, 1.6, 0.45], [1.2, -0.1, 1.6, 0.45]]) knot(T[0] + dx, T[1] + dz, h, rr);
    W.npc("flame", F.x, F.z + 3.6, Math.PI, {});
    // organic pillars with glowing bands, torches between them
    for (const pa of [0.9, 1.8, 2.5, -0.9, -1.8, -2.5]) {
      const [x, z] = at(pa, 6.3);
      B.cyl(x, g, z, 0.75, HH, M.rockL, { rTop: 0.55, seg: 10 });
      for (const y of [1.2, 5.6]) B.raw(GEO.torus(0.72 - y * 0.02, 0.1, TAU, 12), M.glow, mtx(x, g + y, z, 0, 1, 1, 1, Math.PI / 2));
    }
    for (const ta of [1.35, 2.15, -1.35, -2.15]) {
      const [x, z] = at(ta, 7.1);
      B.cyl(x, g + 1.4, z, 0.07, 1.7, M.wood, { solid: false, seg: 5 });
      B.cyl(x, g + 3.0, z, 0.2, 0.2, M.rib, { solid: false, seg: 6, rTop: 0.28 });
      flameTop(x, g + 3.15, z, 0.45);
    }
    // red curtains behind the throne
    for (const s of [-1, 1]) {
      const ca = s * 0.42, [x, z] = at(ca, 7.25);
      B.box(x, g + 0.2, z, 1.6, 6.6, 0.12, M.curtain, { solid: false, ry: ca });
      B.box(x, g + 6.5, z, 1.8, 0.3, 0.2, M.gold, { solid: false, ry: ca });
    }
    // the Flame King's giant lantern: gold base, a glass bulb with a flame inside; treasure on top
    {
      const [lx, lz] = at(1.2, 4.6);
      B.cyl(lx, g, lz, 1.2, 0.55, M.gold, { seg: 14 });
      for (let k = 0; k < 8; k++) {
        const ka = (k / 8) * TAU, [sx, sz] = [lx + Math.sin(ka) * 1.15, lz + Math.cos(ka) * 1.15];
        B.cone(sx, g + 0.15, sz, 0.12, 0.35, M.win, { seg: 3, ry: ka, sz: 0.3 });
      }
      B.lathe([[0.55, 0], [0.95, 0.4], [1.05, 1.2], [0.85, 2.2], [0.6, 2.9], [0.55, 3.05]], M.glass, lx, g + 0.55, lz, { seg: 16 });
      B.cone(lx, g + 0.8, lz, 0.4, 1.4, M.flame, { seg: 7 });
      B.cone(lx, g + 0.85, lz, 0.22, 0.8, M.flameIn, { seg: 6 });
      B.cyl(lx, g + 3.55, lz, 0.85, 0.35, M.gold, { seg: 14 });
      B.raw(GEO.torus(0.4, 0.07, Math.PI, 10), M.gold, mtx(lx, g + 3.9, lz, 0));
      cylCollider(lx, lz, 1.1, g, g + 3.9);
      const [sx, sz] = at(0.62, 4.1);
      B.cyl(sx, g, sz, 0.75, 1.6, M.rockL, { rTop: 0.62, seg: 10 });
      B.raw(GEO.torus(0.56, 0.1, TAU, 12), M.glow, mtx(sx, g + 1.6, sz, 0, 1, 1, 1, Math.PI / 2));
      W.treasure("firelantern", lx, g + 3.9, lz);
      W.course("lanterna-do-rei", { x: F.x, z: F.z - 5, y: g }, [{ x: F.x + 1.6, z: F.z - 0.5, y: g }, { x: sx, z: sz, y: g + 1.6 }, { x: lx, z: lz, y: g + 3.9 }], "firelantern");
    }
    // Flame Guards at the throne and inside the door
    for (const [ga, gr, yaw] of [[0.5, 5.6, Math.PI + 0.2], [-0.5, 5.6, Math.PI - 0.2], [Math.PI - 0.55, 6.3, 0.3], [Math.PI + 0.55, 6.3, -0.3]]) {
      const [x, z] = at(ga, gr);
      W.citizen("guard", { x, z, yaw });
    }
  });
  // two more guards outside the door
  for (const s of [-1, 1]) {
    const [x, z] = at(doorA + s * 0.42, HO + 2.4);
    W.citizen("guard", { x, z, yaw: doorA });
  }

  // ── the giant lanterns on stilts, standing out in the lava ──
  for (const [lx, lz, sc] of [[F.x + 30, F.z + 8, 1], [F.x - 32, F.z + 22, 1.1], [F.x + 18, F.z - 46, 0.85], [F.x - 44, F.z - 16, 0.9]]) {
    const gy = W.ground(lx, lz), H = 20 * sc;
    for (let k = 0; k < 3; k++) {
      const la2 = (k / 3) * TAU + 0.4;
      B.capsule([lx + Math.sin(la2) * 3.6 * sc, gy - 1, lz + Math.cos(la2) * 3.6 * sc], [lx + Math.sin(la2) * 0.8 * sc, gy + H, lz + Math.cos(la2) * 0.8 * sc], 0.2 * sc, M.rib, 6);
      cylCollider(lx + Math.sin(la2) * 3.4 * sc, lz + Math.cos(la2) * 3.4 * sc, 0.4, gy - 1, gy + 3);
    }
    B.sphere(lx, gy + H + 3 * sc, lz, 3.1 * sc, M.bulb, { sy: 1.3, seg: 16 });
    for (let k = 0; k < 10; k++) B.raw(GEO.torus(3.13 * sc, 0.09 * sc, Math.PI, 16), M.rib, mtx(lx, gy + H + 3 * sc, lz, (k / 10) * TAU, 1, 1.3, 1, 0, Math.PI / 2));
    B.cyl(lx, gy + H - 0.9 * sc, lz, 1.2 * sc, 0.6 * sc, M.rib, { solid: false, seg: 10 });
    B.cyl(lx, gy + H + 6.8 * sc, lz, 1.0 * sc, 0.5 * sc, M.rib, { solid: false, seg: 10 });
    for (const s of [-1, 0, 1]) B.cone(lx + s * 0.8 * sc, gy + H + 7.2 * sc, lz, 0.32 * sc, (1.7 - Math.abs(s) * 0.5) * sc, M.rib, { seg: 6 });
  }

  // ── lava bubbles and rocky islets in the lakes, the moat and the rivers ──
  B.detail(() => {
    const bub = [M.lava, M.flameIn, M.win];
    for (const p of LAVA) {
      if (Math.hypot(p.x - F.x, p.z - F.z) > 110) continue;
      const n = Math.round(p.r * 0.6);
      for (let i = 0; i < n; i++) {
        const ba = r() * TAU, d = Math.sqrt(r()) * (p.r - 0.8);
        B.sphere(p.x + Math.sin(ba) * d, -1.15, p.z + Math.cos(ba) * d, 0.3 + r() * 0.7, bub[i % 3], { sy: 0.3, seg: 8 });
      }
    }
  }, 150);
  for (const p of [LAVA[2], LAVA[3], LAVA[4]]) {
    for (let i = 0; i < 2; i++) {
      const ia = r() * TAU, d = p.r * 0.45, x = p.x + Math.sin(ia) * d, z = p.z + Math.cos(ia) * d;
      B.cyl(x, -3.5, z, 2.2, 3.9, M.basalt, { rTop: 1.8, seg: 8 });
      spire(x + 0.6, z + 0.3, 0.2, 2 + r() * 3, 1.0, 0.7, 0, 0);
    }
  }

  // ── walls of fire along the southern rim, and the royal emblem floating over the palace ──
  const fireWall = (cx, cz, face, w, h) => {
    const geos = [], core = [];
    for (let i = 0; i < Math.round(w / 2.2); i++) {
      const o = (i / Math.round(w / 2.2) - 0.5) * w, fh = h * (0.6 + r() * 0.6), fr = 1.3 + r() * 1.2;
      const x = cx + Math.cos(face) * o, z = cz - Math.sin(face) * o, y = W.ground(x, z) - 0.5;
      geos.push(new THREE.ConeGeometry(fr, fh, 7).translate(0, fh / 2, 0).rotateZ((r() - 0.5) * 0.25).translate(x - cx, y, z - cz));
      core.push(new THREE.ConeGeometry(fr * 0.55, fh * 0.6, 6).translate(0, fh * 0.3, 0).translate(x - cx, y + 0.1, z - cz));
    }
    const grp = new THREE.Group();
    grp.position.set(cx, 0, cz);
    grp.add(new THREE.Mesh(mergeGeometries(geos), M.flame), new THREE.Mesh(mergeGeometries(core), M.flameIn));
    W.scene.add(grp);
    const ph = r() * 10;
    W.tick((t) => grp.children.forEach((m, i) => { m.scale.y = 1 + Math.sin(t * (4 + i) + ph) * 0.1 + Math.sin(t * 9.3 + ph * 2) * 0.05; m.scale.x = 1 + Math.sin(t * 3.1 + ph) * 0.04; }));
  };
  for (let k = 0; k < 7; k++) {
    const ra = -0.9 + k * 0.3, rad = 300 - (k % 2) * 6;
    const cx = Math.sin(ra) * rad * 0.35 + F.x, cz = Math.min(Math.sqrt(rad * rad - (cx * cx)), 330);
    fireWall(cx, cz, Math.atan2(cx, cz) + Math.PI, 26, 9 + (k % 3) * 3);
  }
  fireWall(F.x - 4, F.z + 48, Math.PI, 30, 11);
  {
    const s = new THREE.Shape();
    s.moveTo(0, -2.2);
    s.bezierCurveTo(2.4, -2.2, 2.6, 0.4, 1.2, 1.4);
    s.bezierCurveTo(1.6, 0.4, 0.9, 0.2, 0.6, 0.6);
    s.bezierCurveTo(0.9, 1.8, 0.3, 2.6, 0, 3.2);
    s.bezierCurveTo(-0.3, 2.6, -0.9, 1.8, -0.6, 0.6);
    s.bezierCurveTo(-0.9, 0.2, -1.6, 0.4, -1.2, 1.4);
    s.bezierCurveTo(-2.6, 0.4, -2.4, -2.2, 0, -2.2);
    const hole = new THREE.Path();
    hole.moveTo(0, -1.5);
    hole.bezierCurveTo(1.3, -1.5, 1.2, 0, 0, 1.2);
    hole.bezierCurveTo(-1.2, 0, -1.3, -1.5, 0, -1.5);
    s.holes.push(hole);
    const crown = new THREE.Shape();
    crown.moveTo(-1.6, -3.0); crown.lineTo(1.6, -3.0); crown.lineTo(1.8, -2.3); crown.lineTo(1.0, -2.6); crown.lineTo(0, -2.1);
    crown.lineTo(-1.0, -2.6); crown.lineTo(-1.8, -2.3); crown.closePath();
    const geo = mergeGeometries([new THREE.ExtrudeGeometry(s, { depth: 0.35, bevelEnabled: false, curveSegments: 10 }), new THREE.ExtrudeGeometry(crown, { depth: 0.35, bevelEnabled: false })]);
    geo.translate(0, 0, -0.17);
    const sigil = new THREE.Mesh(geo, toon(0xffc23a, { emissive: 0xaa5a00 }));
    sigil.scale.setScalar(2.4);
    sigil.position.set(F.x, g + 58, F.z);
    W.scene.add(sigil);
    W.tick((t) => { sigil.rotation.y = t * 0.4; sigil.position.y = g + 58 + Math.sin(t * 0.8) * 1.2; });
  }

  // stepping columns across the first lava lake
  const lp = LAVA[0], ge = W.ground(lp.x + 16, lp.z), lavaPts = [];
  [12.5, 9, 5.5, 2].forEach((ox, k) => {
    const top = Math.max(ge + 0.6 + k * 0.9, 0.4 + k * 0.9);
    B.cyl(lp.x + ox, -3.5, lp.z, 1.2, top + 3.5, M.basalt, { rTop: 1.0, seg: 7 });
    lavaPts.push({ x: lp.x + ox, z: lp.z, y: top });
  });
  const ctop = Math.max(ge + 0.6 + 4 * 0.9, 4);
  B.cyl(lp.x - 1.5, -3.5, lp.z, 2, ctop + 3.5, M.basalt, { rTop: 1.8, seg: 8 });
  W.treasure("lava", lp.x - 1.5, ctop, lp.z);
  W.course("lago-de-lava", { x: lp.x + 16.5, z: lp.z }, [...lavaPts, { x: lp.x - 1.5, z: lp.z, y: ctop }], "lava");

  // ── the Path of Flames: out of the door, round the town (east, then south), halfway up the chimneys, the tower top ──
  const ground = (a, d) => { const [x, z] = at(a, d); return { x, y: W.ground(x, z), z }; };
  BRAZIERS.push(
    { ...ground(doorA - 0.4, 16), time: 12 },
    { ...ground(1.72, 23), time: 8 },
    { ...ground(0.015, 23), time: 8 },
    { ...firePts[7], time: 17, small: true }, // the course bot takes ~12 s from the one before
    { ...(([x, z]) => ({ x, y: TT, z }))(at(la + Math.PI / 2, 2.4)), time: 14, small: true }, // ~9 s
  );

  // ── the town round the palace: volcanic-rock huts with glowing windows and a flame on top ──
  const hutM = [toon(0x4a2a2e, { tex: "rock", scale: 0.25 }), toon(0x5e3030, { tex: "rock", scale: 0.25 })];
  const winM = toon(0xffd05a, { emissive: 0xff8a00 });
  for (let k = 0; k < 11; k++) {
    const ha = (k / 11) * TAU + 0.3, rad = 22 + (k % 2) * 2.5;
    if (Math.abs(Math.atan2(Math.sin(ha - doorA), Math.cos(ha - doorA))) < 0.5) continue;
    const [x, z] = at(ha, rad), gy = W.ground(x, z), s = 0.9 + (k % 3) * 0.15, fa = ha + Math.PI;
    const m = hutM[k % 2];
    B.cyl(x, gy - 0.3, z, 2.4 * s, 2.6 * s, m, { rTop: 2.1 * s, seg: 12 });
    B.sphere(x, gy + 2.3 * s, z, 2.2 * s, m, { sy: 0.7, seg: 12 });
    cylCollider(x, z, 2.4 * s, gy - 0.3, gy + 3.2 * s);
    flameTop(x, gy + 3.6 * s, z, s);
    const dx = x + Math.sin(fa) * 2.3 * s, dz = z + Math.cos(fa) * 2.3 * s;
    B.box(dx, gy, dz, 1.1, 1.8, 0.3, toon(0x1a0c0c), { solid: false, ry: fa, r: 0.15 });
    B.raw(GEO.torus(0.6, 0.12, Math.PI, 10), M.flame, mtx(dx, gy + 1.8, dz, fa));
    for (const da of [0.9, -0.9]) B.sphere(x + Math.sin(fa + da) * 2.3 * s, gy + 1.5 * s, z + Math.cos(fa + da) * 2.3 * s, 0.35, winM, { sz: 0.3, ry: fa + da, seg: 8 });
  }
  // the people of the Fire Kingdom stroll round the palace
  const kinds = ["flameling", "coal", "flameling", "flameling", "coal", "flameling", "flameling"];
  kinds.forEach((kind, i) => W.citizen(kind, { ring: [F.x, F.z, 19], arc: [doorA + 0.7, doorA + TAU - 0.7], a: doorA + 1 + i * 0.65, dir: i % 2 ? 1 : -1, speed: 1.5 }));
  for (const [kind, ka] of [["flameling", 1.2], ["coal", 1.35], ["flameling", 4.6], ["flameling", 4.45]]) {
    const [x, z] = at(ka, 27.5);
    W.citizen(kind, { x, z, yaw: ka + Math.PI });
  }
}
