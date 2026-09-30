// The Candy People: little citizens that stroll, stop to chat and wave at Finn.
// Each one is ONE skinned mesh (vertex colours, a tiny skeleton: body, two legs, two arms
// and the eyes, which blink by scaling) so a crowd costs one draw call per person (+ ink).
// Specs come from W.citizen(kind, spec) in the world builders:
//   { ring: [cx, cz, radius], arc: [a0, a1], a, dir, speed }  walk back and forth on an arc
//   { line: [x0, z0, x1, z1], t, speed }                        walk back and forth on a line
//   { x, z, yaw }                                               stand (chatting)
// plus, for any of them: y (the floor height, when it isn't the terrain: floating islands),
// float (hover and bob, for the Lumpy Space people), dance (arms up, bouncing).
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { toon } from "./toon.js";

const TAU = Math.PI * 2;
const BLACK = 0x1d1d24, WHITE = 0xffffff, CHEEK = 0xff9fc0;
const GUM = [0xff4f9a, 0x5fd3ff, 0xffd84f, 0x9dff6b, 0xc27bff, 0xff8a3d];
// bones: 0 root, 1 body, 2 left leg, 3 right leg, 4 left arm, 5 right arm, 6 eyes
const ROOT = 0, BODY = 1, LEGL = 2, LEGR = 3, ARML = 4, ARMR = 5, EYES = 6;
const SPH = new THREE.SphereGeometry(1, 10, 7), SPH_MID = new THREE.SphereGeometry(1, 7, 5), SPH_LO = new THREE.OctahedronGeometry(1, 0);
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);

function kit() {
  const parts = [];
  const m4 = (x, y, z, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) =>
    new THREE.Matrix4().compose(_v.set(x, y, z), _q.setFromEuler(new THREE.Euler(rx, ry, rz)), _s.set(sx, sy, sz));
  const K = {
    parts,
    put: (geo, color, bone, m) => parts.push({ geo, color, bone, m }),
    sph(color, bone, x, y, z, sx, sy = sx, sz = sx, o = {}) {
      const big = Math.max(sx, sy, sz);
      K.put(big < 0.028 ? SPH_LO : big < 0.07 ? SPH_MID : SPH, color, bone, m4(x, y, z, sx, sy, sz, o.rx, o.ry, o.rz));
    },
    cap(color, bone, a, b, r) {
      const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = Math.max(0.001, d.length());
      const m = new THREE.Matrix4().compose(_v.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), _q.setFromUnitVectors(Y, d.normalize()), _s.set(1, 1, 1));
      K.put(new THREE.CapsuleGeometry(r, len, 1, 6), color, bone, m);
    },
    lathe(color, bone, profile, y = 0, o = {}) {
      const pts = new THREE.SplineCurve(profile.map(([r, h]) => new THREE.Vector2(r, h))).getPoints(o.smooth ?? 9);
      K.put(new THREE.LatheGeometry(pts, o.seg ?? 12), color, bone, m4(0, y, o.z ?? 0, 1, 1, o.sz ?? 1));
    },
    cone(color, bone, x, y, z, r, h, rx = 0, rz = 0) {
      K.put(new THREE.ConeGeometry(r, h, 6), color, bone, m4(x, y, z, 1, 1, 1, rx, 0, rz));
    },
    torus(color, bone, R, t, arc, x, y, z, rx = 0, ry = 0, rz = 0) {
      K.put(new THREE.TorusGeometry(R, t, 5, 10, arc), color, bone, m4(x, y, z, 1, 1, 1, rx, ry, rz));
    },
  };
  return K;
}

/** Legs, arms and a face; `f` holds the body's key measures. */
function limbs(K, f) {
  for (const s of [-1, 1]) {
    const bone = s < 0 ? LEGL : LEGR;
    if (!f.noLegs) {
      K.cap(f.leg, bone, [s * f.lx, f.hip + 0.02, 0], [s * f.lx, 0.07, 0.01], 0.042);
      K.sph(f.foot ?? f.leg, bone, s * f.lx, 0.045, 0.035, 0.06, 0.045, 0.085);
    }
    const arm = s < 0 ? ARML : ARMR;
    K.cap(f.arm ?? f.leg, arm, [s * f.sx, f.sh, 0], [s * (f.sx + 0.1), f.sh - 0.3, 0.02], 0.033);
    K.sph(f.hand ?? f.arm ?? f.leg, arm, s * (f.sx + 0.11), f.sh - 0.34, 0.02, 0.05);
  }
  for (const s of [-1, 1]) K.sph(f.eye ?? BLACK, EYES, s * f.ex, f.ey, f.ez, 0.032, 0.05, 0.022);
  if (f.mouth !== false) K.torus(BLACK, BODY, 0.05, 0.011, Math.PI * 0.8, 0, f.ey - 0.07, f.ez - 0.004, 0, 0, Math.PI * 1.1);
  if (f.cheeks) for (const s of [-1, 1]) K.sph(CHEEK, BODY, s * (f.ex + 0.06), f.ey - 0.06, f.ez - 0.02, 0.035, 0.022, 0.015);
}

const KINDS = {
  gumdrop(K, r) {
    const c = GUM[Math.floor(r() * GUM.length)];
    K.lathe(c, BODY, [[0.001, 0.13], [0.3, 0.13], [0.32, 0.2], [0.27, 0.48], [0.19, 0.68], [0.08, 0.76], [0.001, 0.77]]);
    for (let i = 0; i < 7; i++) {
      const a = r() * TAU, y = 0.2 + r() * 0.45, rr = 0.31 - (y - 0.2) * 0.3;
      K.sph(WHITE, BODY, Math.sin(a) * rr, y, Math.cos(a) * rr, 0.018);
    }
    limbs(K, { hip: 0.16, lx: 0.1, sx: 0.27, sh: 0.44, ex: 0.07, ey: 0.46, ez: 0.27, leg: c, cheeks: true });
    return 0.8;
  },
  candycorn(K) {
    K.lathe(0xffd23f, BODY, [[0.001, 0.13], [0.26, 0.13], [0.29, 0.2], [0.27, 0.44]], 0, { sz: 0.85 });
    K.lathe(0xff8a2a, BODY, [[0.27, 0.44], [0.24, 0.62], [0.18, 0.8]], 0, { sz: 0.85 });
    K.lathe(0xfff8ec, BODY, [[0.18, 0.8], [0.12, 0.93], [0.05, 1.02], [0.001, 1.04]], 0, { sz: 0.85 });
    limbs(K, { hip: 0.16, lx: 0.09, sx: 0.24, sh: 0.5, ex: 0.065, ey: 0.62, ez: 0.2, leg: 0xe0a020, arm: 0xff8a2a });
    return 1.05;
  },
  marshmallow(K, r) {
    K.lathe(0xfffdf8, BODY, [[0.001, 0.13], [0.27, 0.13], [0.32, 0.19], [0.33, 0.5], [0.32, 0.78], [0.27, 0.85], [0.001, 0.86]]);
    const drip = r() < 0.5 ? 0xd8a8ff : 0xffb8d8;
    K.sph(drip, BODY, 0, 0.85, 0, 0.3, 0.07, 0.3);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + 0.3, l = 0.1 + r() * 0.16;
      K.cap(drip, BODY, [Math.sin(a) * 0.31, 0.83, Math.cos(a) * 0.31], [Math.sin(a) * 0.33, 0.83 - l, Math.cos(a) * 0.33], 0.035);
    }
    limbs(K, { hip: 0.16, lx: 0.11, sx: 0.31, sh: 0.5, ex: 0.08, ey: 0.56, ez: 0.32, leg: 0xf2ece0, cheeks: true });
    return 0.9;
  },
  jellybean(K, r) {
    const c = [0xe8303a, 0x9dff6b, 0xffd84f, 0xc27bff, 0xff8a3d][Math.floor(r() * 5)];
    K.sph(c, BODY, 0, 0.52, 0, 0.24, 0.3, 0.21, { rz: 0.15 });
    K.sph(c, BODY, 0.04, 0.8, 0, 0.21, 0.24, 0.19, { rz: -0.2 });
    K.sph(WHITE, BODY, -0.1, 0.9, 0.12, 0.05, 0.03, 0.02, { rz: 0.5 }); // shine
    limbs(K, { hip: 0.26, lx: 0.09, sx: 0.22, sh: 0.62, ex: 0.07, ey: 0.76, ez: 0.18, leg: c });
    return 1.05;
  },
  cupcake(K) {
    K.lathe(0x5fb8e8, BODY, [[0.001, 0.13], [0.25, 0.13], [0.3, 0.3], [0.34, 0.52], [0.001, 0.52]], 0, { seg: 12 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      K.cap(0x4a9ad0, BODY, [Math.sin(a) * 0.26, 0.15, Math.cos(a) * 0.26], [Math.sin(a) * 0.345, 0.51, Math.cos(a) * 0.345], 0.02);
    }
    K.sph(0xffe06a, BODY, 0, 0.62, 0, 0.39, 0.26, 0.37);
    K.sph(0xfff2b0, BODY, -0.12, 0.8, 0.12, 0.08, 0.04, 0.06);
    // the moustache
    for (const s of [-1, 1]) K.sph(BLACK, BODY, s * 0.07, 0.6, 0.34, 0.08, 0.03, 0.03, { rz: s * -0.3 });
    limbs(K, { hip: 0.16, lx: 0.11, sx: 0.33, sh: 0.46, ex: 0.08, ey: 0.7, ez: 0.33, leg: 0x4a9ad0 });
    return 0.9;
  },
  cinnamon(K) {
    K.sph(0xc27a3a, BODY, 0, 0.52, 0, 0.38, 0.34, 0.34);
    K.torus(0x8a4a1e, BODY, 0.22, 0.03, TAU * 0.9, 0, 0.44, 0.3, 0.25, 0, 0);
    K.torus(0x8a4a1e, BODY, 0.12, 0.025, TAU * 0.9, 0.02, 0.44, 0.33, 0.25, 0, 1);
    K.sph(0xfff8ec, BODY, 0, 0.8, 0, 0.3, 0.1, 0.27);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + 0.4;
      K.cap(0xfff8ec, BODY, [Math.sin(a) * 0.26, 0.78, Math.cos(a) * 0.24], [Math.sin(a) * 0.32, 0.64, Math.cos(a) * 0.29], 0.03);
    }
    limbs(K, { hip: 0.2, lx: 0.12, sx: 0.36, sh: 0.55, ex: 0.09, ey: 0.62, ez: 0.3, leg: 0xa8662e, cheeks: true });
    return 0.95;
  },
  strawberry(K, r) {
    K.lathe(0xe8303a, BODY, [[0.001, 0.12], [0.14, 0.14], [0.27, 0.3], [0.31, 0.52], [0.26, 0.74], [0.12, 0.84], [0.001, 0.86]]);
    for (let i = 0; i < 9; i++) {
      const a = r() * TAU, y = 0.2 + r() * 0.55, rr = y < 0.5 ? 0.14 + (y - 0.14) * 0.5 : 0.31 - (y - 0.52) * 0.55;
      K.sph(0xffe07a, BODY, Math.sin(a) * rr, y, Math.cos(a) * rr, 0.016, 0.024, 0.016);
    }
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      K.sph(0x3fae3a, BODY, Math.sin(a) * 0.12, 0.86, Math.cos(a) * 0.12, 0.1, 0.025, 0.05, { ry: a });
    }
    K.cap(0x3f8a2a, BODY, [0, 0.86, 0], [0.02, 0.97, 0], 0.02);
    limbs(K, { hip: 0.15, lx: 0.09, sx: 0.28, sh: 0.48, ex: 0.075, ey: 0.56, ez: 0.29, leg: 0x3fae3a });
    return 0.95;
  },
  // the Fire Kingdom's people: living flames and little coal golems
  flameling(K, r) {
    const c = [0xff8a2a, 0xff6a1a, 0xffa53b, 0xffd23f][Math.floor(r() * 4)];
    K.lathe(c, BODY, [[0.001, 0.13], [0.25, 0.15], [0.31, 0.32], [0.28, 0.55], [0.19, 0.78], [0.08, 0.95], [0.001, 1.02]]);
    K.lathe(0xffe07a, BODY, [[0.001, 0.2], [0.15, 0.24], [0.18, 0.4], [0.13, 0.58], [0.001, 0.68]], 0, { z: 0.14, sz: 0.55 });
    for (const [x, h, rz] of [[0, 0.5, 0], [0.12, 0.34, -0.5], [-0.13, 0.3, 0.55]]) K.cone(c, BODY, x, 0.96 + h / 2 - 0.1, -0.02, 0.09, h, 0, rz);
    limbs(K, { hip: 0.16, lx: 0.09, sx: 0.27, sh: 0.5, ex: 0.07, ey: 0.56, ez: 0.27, leg: c });
    return 1.25;
  },
  coal(K, r) {
    K.sph(0x2e2a30, BODY, 0, 0.5, 0, 0.3, 0.34, 0.27);
    K.sph(0x3a3438, BODY, 0.05, 0.78, -0.02, 0.2, 0.16, 0.18);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + r(), y = 0.3 + r() * 0.35;
      K.cap(0xff7a1a, BODY, [Math.sin(a) * 0.28, y, Math.cos(a) * 0.25], [Math.sin(a + 0.3) * 0.27, y + 0.12, Math.cos(a + 0.3) * 0.24], 0.018);
    }
    limbs(K, { hip: 0.18, lx: 0.1, sx: 0.29, sh: 0.5, ex: 0.08, ey: 0.6, ez: 0.25, leg: 0x2e2a30, eye: 0xffd05a });
    return 0.95;
  },
  // a Flame Guard: a black silhouette with lava cracks, a crown of flames and a torch staff
  guard(K) {
    const B = 0x1d171b, LAVA = 0xff5a1a;
    K.lathe(B, BODY, [[0.001, 0.2], [0.22, 0.22], [0.3, 0.45], [0.33, 0.75], [0.28, 0.98], [0.16, 1.08], [0.001, 1.12]]);
    K.sph(B, BODY, 0, 1.22, 0, 0.2, 0.2, 0.19);
    for (let i = 0; i < 7; i++) {
      const a = ((i - 3) / 7) * 2.6;
      K.cone(i % 2 ? 0xff8a2a : 0xffc23a, BODY, Math.sin(a) * 0.15, 1.44 + (i % 2 ? 0 : 0.06), Math.cos(a) * 0.1 - 0.02, 0.05, i % 2 ? 0.22 : 0.3, Math.cos(a) * 0.3, -Math.sin(a) * 0.5);
    }
    K.cap(LAVA, BODY, [-0.2, 0.95, 0.28], [0, 0.82, 0.32], 0.018);
    K.cap(LAVA, BODY, [0, 0.82, 0.32], [0.18, 0.9, 0.29], 0.018);
    K.cap(LAVA, BODY, [0, 0.82, 0.32], [0.05, 0.55, 0.33], 0.018);
    K.cap(LAVA, BODY, [0.05, 0.55, 0.33], [-0.15, 0.42, 0.3], 0.018);
    // the torch in the right hand
    K.cap(0x5a3a22, ARMR, [0.43, 0.2, 0.05], [0.43, 1.25, 0.05], 0.025);
    K.cone(0xff8a2a, ARMR, 0.43, 1.38, 0.05, 0.1, 0.32);
    K.cone(0xffe07a, ARMR, 0.43, 1.33, 0.05, 0.05, 0.18);
    limbs(K, { hip: 0.22, lx: 0.11, sx: 0.32, sh: 0.9, ex: 0.07, ey: 1.24, ez: 0.18, leg: B, eye: 0xffd05a, mouth: false });
    return 1.7;
  },
  // a Lumpy Space person: a cloud of lumps with a face and little arms, no legs (they float)
  lumpy(K, r) {
    const c = [0xb887ef, 0x8fa8ff, 0x9fe8b0, 0xff9fd0, 0xe4dcf0, 0x7fd8e8][Math.floor(r() * 6)];
    K.sph(c, BODY, 0, 0.55, 0, 0.33, 0.34, 0.3);
    for (const [x, y, z, rr] of [[0, 0.9, 0, 0.17], [-0.18, 0.84, 0, 0.15], [0.18, 0.84, 0, 0.15], [-0.31, 0.67, 0, 0.15], [0.31, 0.67, 0, 0.15],
      [-0.32, 0.45, 0, 0.15], [0.32, 0.45, 0, 0.15], [-0.2, 0.26, 0.02, 0.16], [0, 0.23, 0.03, 0.17], [0.2, 0.26, 0.02, 0.16], [0, 0.55, -0.22, 0.2]]) K.sph(c, BODY, x, y, z, rr);
    if (r() < 0.3) K.sph(0xffd84f, BODY, 0, 0.78, 0.29, 0.06, 0.06, 0.02);
    limbs(K, { hip: 0.25, lx: 0.1, sx: 0.3, sh: 0.55, ex: 0.09, ey: 0.62, ez: 0.29, leg: c, noLegs: true });
    return 1.05;
  },
  icecream(K, r) {
    const scoop = [0xffb8d8, 0xfff0c0, 0xb8f0d0, 0x8a5030][Math.floor(r() * 4)];
    K.lathe(0xe0a050, BODY, [[0.06, 0.16], [0.12, 0.3], [0.2, 0.48], [0.27, 0.62], [0.001, 0.62]], 0, { seg: 10, smooth: 8 });
    for (const y of [0.3, 0.45]) K.torus(0xb07a30, BODY, 0.13 + (y - 0.3) * 0.55, 0.012, TAU, 0, y, 0, Math.PI / 2);
    K.sph(scoop, BODY, 0, 0.8, 0, 0.32, 0.28, 0.32);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.2;
      K.sph(scoop, BODY, Math.sin(a) * 0.27, 0.64, Math.cos(a) * 0.27, 0.08, 0.06, 0.08);
    }
    K.sph(0xe0202e, BODY, 0.03, 1.12, 0, 0.065);
    limbs(K, { hip: 0.2, lx: 0.07, sx: 0.28, sh: 0.62, ex: 0.075, ey: 0.84, ez: 0.29, leg: 0xe0a050, arm: scoop, cheeks: true });
    return 1.15;
  },
};

// shoulder/hip/eye bone positions per kind (model space), read back from the builder's measures
const RIG = {
  gumdrop: { hip: 0.16, lx: 0.1, sx: 0.27, sh: 0.44, ey: 0.46, ez: 0.27 },
  candycorn: { hip: 0.16, lx: 0.09, sx: 0.24, sh: 0.5, ey: 0.62, ez: 0.2 },
  marshmallow: { hip: 0.16, lx: 0.11, sx: 0.31, sh: 0.5, ey: 0.56, ez: 0.32 },
  jellybean: { hip: 0.26, lx: 0.09, sx: 0.22, sh: 0.62, ey: 0.76, ez: 0.18 },
  cupcake: { hip: 0.16, lx: 0.11, sx: 0.33, sh: 0.46, ey: 0.7, ez: 0.33 },
  cinnamon: { hip: 0.2, lx: 0.12, sx: 0.36, sh: 0.55, ey: 0.62, ez: 0.3 },
  strawberry: { hip: 0.15, lx: 0.09, sx: 0.28, sh: 0.48, ey: 0.56, ez: 0.29 },
  icecream: { hip: 0.2, lx: 0.07, sx: 0.28, sh: 0.62, ey: 0.84, ez: 0.29 },
  flameling: { hip: 0.16, lx: 0.09, sx: 0.27, sh: 0.5, ey: 0.56, ez: 0.27 },
  coal: { hip: 0.18, lx: 0.1, sx: 0.29, sh: 0.5, ey: 0.6, ez: 0.25 },
  guard: { hip: 0.22, lx: 0.11, sx: 0.32, sh: 0.9, ey: 1.24, ez: 0.18 },
  lumpy: { hip: 0.25, lx: 0.1, sx: 0.3, sh: 0.55, ey: 0.62, ez: 0.29 },
};
// kinds that glow
const GLOW = { flameling: 0x7a2a00, coal: 0x2a0e00, guard: 0x1a0600 };

let seed = 7;
function rand() {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
}

/** One Candy Person: a SkinnedMesh with bones { body, legs, arms, eyes }. Scale ~1.5 world units tall. */
export function makeCitizen(kind) {
  const K = kit(), height = KINDS[kind](K, rand), f = RIG[kind];
  const geos = K.parts.map(({ geo, color, bone, m }) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(m);
    for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal") g.deleteAttribute(k);
    const n = g.attributes.position.count, c = new THREE.Color(color);
    const col = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      si[i * 4] = bone;
      sw[i * 4] = 1;
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4));
    return g;
  });
  const geo = mergeGeometries(geos, false);
  const root = new THREE.Bone(), body = new THREE.Bone(), legL = new THREE.Bone(), legR = new THREE.Bone();
  const armL = new THREE.Bone(), armR = new THREE.Bone(), eyes = new THREE.Bone();
  body.position.set(0, f.hip, 0);
  legL.position.set(-f.lx, f.hip, 0);
  legR.position.set(f.lx, f.hip, 0);
  armL.position.set(-f.sx, f.sh - f.hip, 0);
  armR.position.set(f.sx, f.sh - f.hip, 0);
  eyes.position.set(0, f.ey - f.hip, f.ez);
  root.add(body, legL, legR);
  body.add(armL, armR, eyes);
  const mesh = new THREE.SkinnedMesh(geo, toon(0xffffff, { vc: true, thick: 0.0055, emissive: GLOW[kind] || 0 }));
  mesh.add(root);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton([root, body, legL, legR, armL, armR, eyes]));
  mesh.scale.setScalar(1.45);
  mesh.userData = { kind, height: height * 1.45, body, legL, legR, armL, armR, eyes, hip: f.hip };
  return mesh;
}

/** Walk / idle / wave animation and movement for one citizen (c: state from spawn()). */
function animate(c, dt, time, finn) {
  const u = c.mesh.userData;
  const dxF = finn.x - c.x, dzF = finn.z - c.z, dF = Math.hypot(dxF, dzF);
  // stop for Finn (and turn to him), otherwise follow the path with little pauses
  if (dF < 5) c.pause = Math.max(c.pause, 0.5);
  c.pause -= dt;
  let moving = false;
  if (c.pause <= 0 && c.speed) {
    const step = c.speed * dt;
    if (c.ring) {
      const [cx, cz, rad] = c.ring;
      c.a += (step / rad) * c.dir;
      if (c.arc && (c.a > c.arc[1] || c.a < c.arc[0])) {
        c.a = Math.min(c.arc[1], Math.max(c.arc[0], c.a));
        c.dir = -c.dir;
        c.pause = 1 + Math.random() * 2;
      }
      const rr = rad + Math.sin(c.a * 5 + c.phase) * 0.6;
      c.x = cx + Math.sin(c.a) * rr;
      c.z = cz + Math.cos(c.a) * rr;
      c.yaw = c.a + (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    } else if (c.line) {
      const [x0, z0, x1, z1] = c.line, L = Math.hypot(x1 - x0, z1 - z0);
      c.t += (step / L) * c.dir;
      if (c.t > 1 || c.t < 0) {
        c.t = Math.min(1, Math.max(0, c.t));
        c.dir = -c.dir;
        c.pause = 1.5 + Math.random() * 2;
      }
      c.x = x0 + (x1 - x0) * c.t;
      c.z = z0 + (z1 - z0) * c.t;
      c.yaw = Math.atan2((x1 - x0) * c.dir, (z1 - z0) * c.dir);
    }
    moving = true;
    if (Math.random() < dt * 0.06) c.pause = 1.5 + Math.random() * 2.5;
  }
  let target = c.yaw;
  if (dF < 7) target = Math.atan2(dxF, dzF);
  const dy = Math.atan2(Math.sin(target - c.face), Math.cos(target - c.face));
  c.face += dy * Math.min(1, dt * 6);
  c.walk = moving ? c.walk + dt * c.speed * 6.5 : c.walk * Math.max(0, 1 - dt * 8);
  const sw = moving ? Math.sin(c.walk) : 0, amp = moving ? 0.55 : 0;
  u.legL.rotation.x = sw * amp;
  u.legR.rotation.x = -sw * amp;
  // greet Finn once when he comes close
  if (!c.greeted && dF < 4.5) { c.greeted = true; c.wave = 1.4; }
  if (dF > 9) c.greeted = false;
  c.wave = Math.max(0, c.wave - dt);
  const w = c.wave > 0 ? Math.sin((c.wave / 1.4) * Math.PI) ** 0.5 : 0;
  u.armL.rotation.set(-sw * amp * 0.8, 0, -0.25 - 0.05 * Math.sin(time * 1.5 + c.phase));
  u.armR.rotation.set(sw * amp * 0.8 * (1 - w), 0, 0.25 + w * (2.4 + 0.3 * Math.sin(time * 14)));
  const bob = moving ? Math.abs(Math.sin(c.walk)) * 0.035 : 0;
  u.body.position.y = u.hip + bob;
  u.body.rotation.z = moving ? Math.sin(c.walk) * 0.06 : 0.03 * Math.sin(time * 0.8 + c.phase);
  u.body.rotation.x = moving ? 0.06 : 0;
  u.body.scale.set(1, 1 + (moving ? 0 : 0.02 * Math.sin(time * 2.2 + c.phase)), 1);
  if (c.dance) {
    const b = time * 5 + c.phase;
    u.body.position.y = u.hip + Math.abs(Math.sin(b)) * 0.12;
    u.body.rotation.z = Math.sin(b * 0.5) * 0.18;
    u.armL.rotation.set(0, 0, -2.3 - 0.4 * Math.sin(b * 1.6));
    u.armR.rotation.set(0, 0, 2.3 + 0.4 * Math.sin(b * 1.6 + 1));
    c.face += dt * 0.6;
  }
  c.blink -= dt;
  if (c.blink < -0.12) c.blink = 2 + Math.random() * 3.5;
  u.eyes.scale.y = c.blink < 0 ? 0.12 : 1;
}

/** Spawns every citizen; returns { list, update(dt, time, finnPos, camPos) }. */
export function spawnCitizens(scene, specs, ground, makeShadow) {
  const list = specs.map((sp, i) => {
    const mesh = makeCitizen(sp.kind);
    const shadow = makeShadow(0.42);
    scene.add(mesh, shadow);
    const c = {
      kind: sp.kind, mesh, shadow, x: sp.x ?? 0, z: sp.z ?? 0, yaw: sp.yaw ?? 0, face: sp.yaw ?? 0,
      ring: sp.ring, arc: sp.arc, a: sp.a ?? 0, line: sp.line, t: sp.t ?? 0, dir: sp.dir ?? 1,
      speed: sp.ring || sp.line ? sp.speed ?? 1.4 : 0, pause: 0, walk: 0, wave: 0, greeted: false,
      blink: 1 + (i % 5) * 0.7, phase: i * 1.7, y: sp.y ?? 0, floor: sp.y, float: !!sp.float, dance: !!sp.dance,
    };
    if (c.ring) {
      c.x = c.ring[0] + Math.sin(c.a) * c.ring[2];
      c.z = c.ring[1] + Math.cos(c.a) * c.ring[2];
    } else if (c.line) {
      c.x = c.line[0] + (c.line[2] - c.line[0]) * c.t;
      c.z = c.line[1] + (c.line[3] - c.line[1]) * c.t;
    }
    return c;
  });
  function update(dt, time, finn, cam, hidden = false) {
    for (const c of list) {
      const dc = Math.hypot(cam.x - c.x, cam.z - c.z);
      const vis = !hidden && dc < 85;
      c.mesh.visible = c.shadow.visible = vis;
      if (!vis) continue;
      animate(c, Math.min(dt, 0.05), time, finn);
      c.y = c.floor ?? ground(c.x, c.z);
      c.mesh.position.set(c.x, c.y + (c.float ? 0.35 + Math.sin(time * 1.6 + c.phase) * 0.15 : 0), c.z);
      c.mesh.rotation.y = c.face;
      c.shadow.position.set(c.x, c.y + 0.03, c.z);
    }
  }
  return { list, update };
}
