// Water in the Grass Lands: the streams (ribbons of flowing water), ponds and lakes, the waterfalls
// over their walls of rock, rapids, stepping stones, the bridge where the big stream crosses the
// Candy Kingdom road, and waterside plants. Shapes and levels come from WATER (terrain.js), which
// has already carved the ground to fit.
import * as THREE from "three";
import { toon, noOutline, waterTexture } from "./toon.js";
import { mtx } from "./builder.js";
import { cylCollider, boxCollider } from "./physics.js";
import { WATER, ROADS, roadDist, rng } from "./terrain.js";

const TAU = Math.PI * 2;

export function buildWater(B, W) {
  const r = rng(909);
  const { reaches, ponds, falls } = WATER;
  const inPond = (x, z, m = 0) => ponds.find((p) => (x - p.x) ** 2 + (z - p.z) ** 2 < (p.r - m) ** 2);
  // unit direction of the stream at sample i, and its left normal
  const dirAt = (S, i) => {
    const a = S[Math.max(0, i - 1)], b = S[Math.min(S.length - 1, i + 1)], l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    return [(b.x - a.x) / l, (b.z - a.z) / l];
  };

  // ── the water surfaces: streams, ponds, falls (one mesh each) ──
  const flow = waterTexture("flow"), still = flow.clone(), sheet = waterTexture("fall");
  still.needsUpdate = true;
  for (const t of [flow, still, sheet]) t.colorSpace = THREE.SRGBColorSpace;
  const surface = (pos, uv, idx, map) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, noOutline(new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide })));
    W.scene.add(m);
    return m;
  };
  {
    const pos = [], uv = [], idx = [];
    for (const S of reaches) {
      let run = [];
      const strip = () => {
        if (run.length > 1) {
          const base = pos.length / 3;
          run.forEach((i, k) => {
            const p = S[i], [tx, tz] = dirAt(S, i), hw = p.w + 1.1;
            pos.push(p.x - tz * hw, p.L + 0.02, p.z + tx * hw, p.x + tz * hw, p.L + 0.02, p.z - tx * hw);
            uv.push(0, p.s / 7, (p.w * 2) / 5, p.s / 7);
            if (k) { const q = base + (k - 1) * 2; idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); }
          });
        }
        run = [];
      };
      S.forEach((p, i) => (inPond(p.x, p.z, 1.2) ? strip() : run.push(i)));
      strip();
    }
    surface(pos, uv, idx, flow);
  }
  {
    const pos = [], uv = [], idx = [];
    for (const p of ponds) {
      const n = p.r > 5 ? 48 : 24, R = p.r + 1.4, base = pos.length / 3;
      pos.push(p.x, p.L + 0.05, p.z);
      uv.push(p.x / 9, p.z / 9);
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * TAU, x = p.x + Math.sin(a) * R, z = p.z + Math.cos(a) * R;
        pos.push(x, p.L + 0.05, z);
        uv.push(x / 9, z / 9);
        if (i) idx.push(base, base + i, base + i + 1);
      }
    }
    surface(pos, uv, idx, still);
  }
  // the falling sheets: over the lip, curving out, down into the pool, spreading a little
  const foams = [];
  {
    const pos = [], uv = [], idx = [];
    const foamM = toon(0xffffff, { outline: false, emissive: 0x3a4650 }), mistM = noOutline(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, depthWrite: false }));
    const white = toon(0xffffff, { outline: false, emissive: 0x2a3640 });
    for (const f of falls) {
      const dx = f.base.x - f.lip.x, dz = f.base.z - f.lip.z, l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l, nx = -uz, nz = ux;
      const drop = f.lip.L - f.base.L, K = 12, A = 4, base = pos.length / 3;
      for (let k = 0; k <= K; k++) {
        const t = k / K, y = f.lip.L + 0.03 - (drop + 0.15) * t, out = 0.1 + 1.25 * Math.sqrt(t);
        for (let j = 0; j <= A; j++) {
          const q = (j / A - 0.5) * 2 * (f.w + 0.15) * (1 + 0.18 * t);
          pos.push(f.lip.x + ux * out + nx * q, y, f.lip.z + uz * out + nz * q);
          uv.push((j / A) * f.w * 0.6, (drop * t) / 5);
          if (k && j) { const i0 = base + (k - 1) * (A + 1) + j - 1; idx.push(i0, i0 + 1, i0 + A + 1, i0 + 1, i0 + A + 2, i0 + A + 1); }
        }
      }
      // a white roll of water on the lip
      B.capsule([f.lip.x - nx * f.w, f.lip.L + 0.05, f.lip.z - nz * f.w], [f.lip.x + nx * f.w, f.lip.L + 0.05, f.lip.z + nz * f.w], 0.16, white, 6);
      // foam boiling where it lands, and a little mist
      const cx = f.lip.x + ux * 1.4, cz = f.lip.z + uz * 1.4, parts = [];
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * TAU, rr = k ? f.w * 0.75 : 0, s = 0.55 + r() * 0.45;
        parts.push(new THREE.SphereGeometry(s, 8, 5).scale(1, 0.4, 1).translate(Math.sin(a) * rr, 0, Math.cos(a) * rr));
      }
      const foam = new THREE.Mesh(mergeAll(parts), foamM);
      foam.position.set(cx, f.base.L + 0.08, cz);
      const mist = new THREE.Mesh(mergeAll([0, 1, 2].map((k) => new THREE.SphereGeometry(1.1 + k * 0.3, 8, 6).translate((k - 1) * f.w * 0.7, 0.9 + k * 0.35, 0))), mistM);
      mist.position.set(cx, f.base.L, cz);
      mist.rotation.y = Math.atan2(nx, nz) - Math.PI / 2;
      W.scene.add(foam, mist);
      foams.push({ foam, mist, k: foams.length * 1.7, y: f.base.L });
    }
    surface(pos, uv, idx, sheet);
  }
  W.tick((time) => {
    flow.offset.y = -time * 0.45;
    still.offset.set(Math.sin(time * 0.13) * 0.08, time * 0.012);
    sheet.offset.y = -time * 1.6;
    for (const o of foams) {
      o.foam.scale.set(1 + Math.sin(time * 5 + o.k) * 0.06, 1 + Math.sin(time * 7.3 + o.k) * 0.35, 1 + Math.cos(time * 4.1 + o.k) * 0.06);
      o.mist.position.y = o.y + Math.sin(time * 1.3 + o.k) * 0.15;
    }
  });

  // ── the walls of rock round each waterfall, with a sill where the water goes over ──
  const ROCK = [toon(0x9a958a, { tex: "rock", scale: 0.22, flat: true }), toon(0x88847a, { tex: "rock", scale: 0.22, flat: true }), toon(0xa9a393, { tex: "rock", scale: 0.22, flat: true })];
  const mossM = toon(0x6fae45, { flat: true });
  for (const f of falls) {
    const hl = f.hill, R = hl.rf - 2.8, notch = (f.w + 0.3) / hl.rf, half = 2.0 / R, step = 2.4 / R;
    const at = (a, d) => [hl.x + Math.sin(a) * d, hl.z + Math.cos(a) * d];
    for (const side of [-1, 1])
      for (let a = notch + half; a < 0.9; a += step) {
        const ang = hl.face + side * a + (r() - 0.5) * 0.03, [x, z] = at(ang, R);
        const top = Math.max(W.ground(...at(ang, hl.rf - 6.6)), a < notch + half + step ? f.lip.L + 0.7 : -Infinity) + 0.2 + r() * 0.8;
        const bot = Math.min(W.ground(...at(ang, hl.rf + 1.2)), W.ground(x, z)) - 1.2;
        if (top - bot < 1.2) continue;
        const w = 4.2 + r() * 0.8;
        B.box(x, bot, z, w, top - bot, 6.0, ROCK[Math.floor(r() * 3)], { ry: ang + (r() - 0.5) * 0.16, rz: (r() - 0.5) * 0.06, r: 0.35, solid: false });
        cylCollider(x, z, 2.0, bot, top);
        cylCollider(...at(ang, R - 1.6), 1.7, bot, top);
        if (r() < 0.5) B.sphere(x + (r() - 0.5), top, z + (r() - 0.5), 0.9 + r() * 0.5, mossM, { sy: 0.35, seg: 7 });
      }
    // the sill under the water, and boulders at the foot
    const [sx, sz] = at(hl.face, R);
    B.box(sx, f.base.L - 1.2, sz, 2 * (f.w + 0.45), f.lip.L - 0.3 - f.base.L + 1.2, 5.8, ROCK[0], { ry: hl.face, r: 0.3, solid: false });
    cylCollider(sx, sz, f.w + 0.3, f.base.L - 1.2, f.lip.L - 0.3);
    for (let k = 0; k < 7; k++) {
      const ang = hl.face + (k - 3) * 0.2 + (r() - 0.5) * 0.08, d = hl.rf + 1.2 + r() * 2.2;
      if (Math.abs(ang - hl.face) < 0.18) continue; // not in the falling water
      const [x, z] = at(ang, d), s = 0.8 + r() * 0.9;
      B.sphere(x, W.ground(x, z) + s * 0.2, z, s, ROCK[k % 3], { sy: 0.7, seg: 7, solid: true, top: 0.8 });
    }
  }

  // ── rapids (white water and rocks where a stream runs steep), rocks on the banks, stepping stones ──
  const foamFlat = toon(0xf4fbff, { outline: false, emissive: 0x303a40 });
  const stone = toon(0xa39d90, { tex: "rock", scale: 0.35 }), stoneD = toon(0x8e897e, { tex: "rock", scale: 0.35 });
  reaches.forEach((S) => {
    for (let i = 3; i + 3 < S.length; i += 2) {
      const p = S[i], [tx, tz] = dirAt(S, i), slope = (S[i - 3].L - S[i + 3].L) / (S[i + 3].s - S[i - 3].s);
      if (inPond(p.x, p.z, -0.5)) continue;
      if (slope > 0.06) {
        const o = (r() - 0.5) * p.w;
        B.sphere(p.x - tz * o, p.L + 0.03, p.z + tx * o, p.w * (0.35 + r() * 0.25), foamFlat, { sy: 0.1, seg: 8 });
        if (r() < 0.35) {
          const o2 = (r() - 0.5) * p.w * 1.4;
          B.sphere(p.x - tz * o2, p.L - 0.1, p.z + tx * o2, 0.35 + r() * 0.3, stoneD, { sy: 0.8, seg: 6 });
        }
      } else if (i % 12 === 5 && r() < 0.45) {
        const side = r() < 0.5 ? -1 : 1, o = side * (p.w + 0.6 + r() * 0.8), x = p.x - tz * o, z = p.z + tx * o;
        if (roadDist(x, z) > 4) B.sphere(x, W.ground(x, z) - 0.1, z, 0.5 + r() * 0.6, r() < 0.5 ? stone : stoneD, { sy: 0.6, seg: 7, solid: true, top: 0.7 });
      }
    }
  });
  // stepping stones across three calm stretches (reach index, metres from its start)
  const stepping = [[1, 35], [3, 24], [5, 14]];
  for (const [ri, si] of stepping) {
    const S = reaches[ri];
    if (!S || !S[si]) continue;
    const p = S[si], [tx, tz] = dirAt(S, si), n = Math.ceil((2 * p.w + 1.2) / 1.15);
    for (let k = 0; k < n; k++) {
      const o = (k / (n - 1) - 0.5) * (2 * p.w + 1.2) + (r() - 0.5) * 0.2;
      B.sphere(p.x - tz * o + tx * (r() - 0.5) * 0.3, p.L + 0.05, p.z + tx * o + tz * (r() - 0.5) * 0.3, 0.5 + r() * 0.12, k % 2 ? stone : stoneD, { sy: 0.45, seg: 8, solid: true, top: 1.0 });
    }
  }

  // ── a wooden bridge wherever a stream crosses a road ──
  const plank = toon(0xb98652, { tex: "wood", scale: 0.5 }), plankD = toon(0x8a5d36, { tex: "wood", scale: 0.5 });
  const roadDir = (x, z) => {
    let best = Infinity, dir = [1, 0];
    for (const road of ROADS)
      for (let i = 0; i + 1 < road.length; i++) {
        const [ax, az] = road[i], [bx, bz] = road[i + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)), d = Math.hypot(x - ax - dx * t, z - az - dz * t);
        if (d < best) { best = d; dir = [dx / Math.sqrt(l2), dz / Math.sqrt(l2)]; }
      }
    return dir;
  };
  const bridge = (p) => {
    const [ux, uz] = roadDir(p.x, p.z), a = Math.atan2(ux, uz), half = p.w + 3.4, wid = 4.4, vx = uz, vz = -ux;
    const gA = W.ground(p.x - ux * half, p.z - uz * half), gB = W.ground(p.x + ux * half, p.z + uz * half);
    const top = Math.max(gA, gB, p.L + 0.4) + 0.28;
    B.box(p.x, top - 0.3, p.z, wid, 0.3, 2 * half, plank, { ry: a, r: 0.04, solid: false });
    for (let o = -half + 0.3; o < half; o += 0.62) B.box(p.x + ux * o, top - 0.02, p.z + uz * o, wid + 0.25, 0.06, 0.5, plankD, { ry: a, r: 0.02, solid: false });
    for (const s of [-1, 1]) {
      // the beams under the deck, posts in the water, a rail on each side
      B.capsule([p.x - ux * half + vx * s * 1.7, top - 0.45, p.z - uz * half + vz * s * 1.7], [p.x + ux * half + vx * s * 1.7, top - 0.45, p.z + uz * half + vz * s * 1.7], 0.22, plankD, 7);
      for (const o of [-half + 0.3, -p.w * 0.5, p.w * 0.5, half - 0.3]) {
        const x = p.x + ux * o + vx * s * (wid / 2 - 0.1), z = p.z + uz * o + vz * s * (wid / 2 - 0.1);
        B.cyl(x, W.ground(x, z) - 0.3, z, 0.14, top + 1.0 - W.ground(x, z) + 0.3, plankD, { seg: 6, solid: false });
        cylCollider(x, z, 0.16, top, top + 1.0, false);
      }
      const [ax, az] = [p.x - ux * (half - 0.3) + vx * s * (wid / 2 - 0.1), p.z - uz * (half - 0.3) + vz * s * (wid / 2 - 0.1)];
      const [bx, bz] = [p.x + ux * (half - 0.3) + vx * s * (wid / 2 - 0.1), p.z + uz * (half - 0.3) + vz * s * (wid / 2 - 0.1)];
      for (const y of [0.55, 0.95]) B.plank([ax, top + y, az], [bx, top + y, bz], 0.14, 0.07, plank);
    }
    // the deck is walkable: small square colliders cover the turned plank
    for (let o = -half + 0.5; o <= half - 0.5 + 0.01; o += 0.9)
      for (let q = -wid / 2 + 0.55; q <= wid / 2 - 0.55 + 0.01; q += 0.9) {
        const x = p.x + ux * o + vx * q, z = p.z + uz * o + vz * q;
        boxCollider(x - 0.55, x + 0.55, top - 0.6, top, z - 0.55, z + 0.55, false);
      }
    // steps down to the bank at each end, none higher than 0.3 (Finn walks up 0.35)
    for (const s of [-1, 1]) {
      const g = W.ground(p.x + ux * s * (half + 0.45), p.z + uz * s * (half + 0.45)), rise = top - g;
      if (rise <= 0.3) continue;
      const m = Math.ceil(rise / 0.3) - 1;
      for (let i = 1; i <= m; i++) {
        const d = half + 0.45 + (i - 1) * 0.9, ex = p.x + ux * s * d, ez = p.z + uz * s * d, sy = top - (i * rise) / (m + 1), gy = W.ground(ex, ez);
        if (sy <= gy + 0.05) break;
        B.box(ex, gy - 0.2, ez, wid, sy - gy + 0.2, 0.9, plank, { ry: a, r: 0.04, solid: false });
        for (const q of [-1.4, 0, 1.4]) boxCollider(ex + vx * q - 0.55, ex + vx * q + 0.55, gy - 0.2, sy, ez + vz * q - 0.55, ez + vz * q + 0.55, false);
      }
    }
  };
  for (const S of reaches) {
    let best = null;
    S.forEach((p) => {
      const d = roadDist(p.x, p.z);
      if (d < 1.5 && (!best || d < best.d)) best = { d, p };
      else if (best && d > 8) { bridge(best.p); best = null; }
    });
    if (best) bridge(best.p);
  }

  // ── waterside plants: reeds and cattails on the banks, lily pads on the lakes ──
  B.detail(() => {
    const reed = [toon(0x4f9f35, { outline: false }), toon(0x6bb840, { outline: false })], cat = toon(0x7a4a26), stem = toon(0x5a8a32, { outline: false });
    const clump = (x, z) => {
      const g = W.ground(x, z);
      for (let k = 0; k < 6; k++) {
        const a = r() * TAU, d = r() * 0.4;
        B.cone(x + Math.cos(a) * d, g - 0.1, z + Math.sin(a) * d, 0.07, 0.9 + r() * 0.8, reed[k % 2], { seg: 3, rx: (r() - 0.5) * 0.35, rz: (r() - 0.5) * 0.35 });
      }
      if (r() < 0.6) for (let k = 0; k < 2; k++) {
        const cx = x + (r() - 0.5) * 0.5, cz = z + (r() - 0.5) * 0.5, h = 1.3 + r() * 0.6;
        B.cyl(cx, g - 0.1, cz, 0.03, h, stem, { seg: 3, solid: false });
        B.capsule([cx, g + h - 0.05, cz], [cx, g + h + 0.35, cz], 0.08, cat, 5);
      }
    };
    for (const S of reaches)
      for (let i = 0; i < S.length; i += 2) {
        const p = S[i];
        if (r() > 0.22 || inPond(p.x, p.z, -1)) continue;
        const [tx, tz] = dirAt(S, i), o = (r() < 0.5 ? -1 : 1) * (p.w + 0.2 + r() * 0.8), x = p.x - tz * o, z = p.z + tx * o;
        if (roadDist(x, z) > 5) clump(x, z);
      }
    for (const q of ponds) {
      if (q.pool) continue;
      const n = Math.round(q.r * 2.2);
      for (let k = 0; k < n; k++) {
        if (r() > 0.5) continue;
        const a = (k / n) * TAU + r() * 0.2, d = q.r + 0.2 + r() * 0.7;
        clump(q.x + Math.sin(a) * d, q.z + Math.cos(a) * d);
      }
    }
  }, 95);
  B.detail(() => {
    const padGeo = new THREE.CircleGeometry(1, 12, 0.4, TAU - 0.8), lily = [toon(0x3f9f3a), toon(0x5cb845)];
    const petal = [toon(0xffb8d8), toon(0xffffff)], heart = toon(0xffd84f, { outline: false });
    for (const q of ponds) {
      if (q.pool || q.spring || q.r < 8) continue;
      const n = Math.round(q.r * 1.3);
      for (let k = 0; k < n; k++) {
        const a = r() * TAU, d = q.r * (0.35 + r() * 0.5), x = q.x + Math.sin(a) * d, z = q.z + Math.cos(a) * d, s = 0.45 + r() * 0.35;
        B.raw(padGeo, lily[k % 2], mtx(x, q.L + 0.09, z, r() * TAU, s, s, 1, -Math.PI / 2));
        if (r() < 0.35) {
          const pm = petal[k % 2];
          for (let i = 0; i < 5; i++) {
            const pa = (i / 5) * TAU;
            B.sphere(x + Math.sin(pa) * 0.13, q.L + 0.2, z + Math.cos(pa) * 0.13, 0.13, pm, { sx: 0.6, sy: 0.5, ry: pa, seg: 5 });
          }
          B.sphere(x, q.L + 0.26, z, 0.07, heart, { seg: 5 });
        }
      }
    }
  }, 110);
}

function mergeAll(geos) {
  const pos = [], nrm = [], idx = [];
  let base = 0;
  for (const g of geos) {
    pos.push(...g.attributes.position.array);
    nrm.push(...g.attributes.normal.array);
    for (const i of g.index.array) idx.push(i + base);
    base += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  out.setIndex(idx);
  return out;
}
