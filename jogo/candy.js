// The Candy Kingdom: the cake castle (hollow at the bottom: the throne room, Princess
// Bubblegum's lab and the banquet hall), the Gumball Guardians at the gate, the town of
// candy houses inside the licorice wall, the fountain square, and the giant cupcakes.
import * as THREE from "three";
import { toon } from "./toon.js";
import { GEO, mtx, ringShape, pictures } from "./builder.js";
import { boxCollider, cylCollider, ringCollider } from "./physics.js";
import { P, rng } from "./terrain.js";

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/** Where the Peppermint Butler's runaway spirits hide (spirits.js): { x, y, z }, y the floor under each. */
export const SPIRITS = [];

export function buildCandy(B, W) {
  const C = P.candy, g = W.ground(C.x, C.z), r = rng(9001);
  const M = {
    cake: toon(0xf7e2a6, { tex: "frosting", scale: 0.3 }),
    cakeD: toon(0xeccb84, { tex: "frosting", scale: 0.3 }),
    icing: toon(0xe0344a),
    pink: toon(0xf59ac9, { tex: "frosting", scale: 0.35 }),
    waffle: toon(0xe8a547, { tex: "waffle", scale: 0.7 }),
    cream: toon(0xfffaf2, { tex: "frosting", scale: 0.25 }),
    gum: toon(0xf28cc4, { tex: "dots", scale: 0.25 }),
    licorice: toon(0xc4212f),
    stick: toon(0xfafafa),
    blue: toon(0x3fa7e6),
    white: toon(0xffffff),
    road: toon(0xf2a03c, { outline: false }),
    plaza: toon(0xf7c46a, { tex: "tiles", scale: 0.25, outline: false }),
    door: toon(0xb0303e),
    glass: toon(0x7fd3f7, { emissive: 0x16384a }),
    glassP: toon(0x8a5cc7, { emissive: 0x2a1040 }),
    cherry: toon(0xe0202e),
    cloud: toon(0xcfeeff),
    wrap: toon(0xb86b3c, { tex: "siding", scale: 1.2 }),
    frost: toon(0xffc0e0, { tex: "frosting", scale: 0.3 }),
    choc: toon(0x7a4428, { tex: "frosting", scale: 0.3 }),
    chocD: toon(0x5a3018),
    // inside the castle
    hall: toon(0xffe07a, { tex: "frosting", scale: 0.2, side: THREE.BackSide, outline: false }),
    hallPink: toon(0xff9ecf, { side: THREE.BackSide, outline: false }),
    tile: toon(0xd8b8ff, { tex: "tiles", scale: 0.28 }),
    carpet: toon(0xff4f7a, { outline: false }),
    carpetEdge: toon(0xffd84f, { outline: false }),
    throne: toon(0xff6fb5, { tex: "frosting", scale: 0.4 }),
    gold: toon(0xf6c343, { emissive: 0x4a3000 }),
    bulb: toon(0xfff2a0, { emissive: 0xd0a030 }),
    table: toon(0xffffff, { tex: "frosting", scale: 0.4 }),
    labTop: toon(0x5b6b8a),
    steel: toon(0xc0c8d4),
    board: toon(0x2f6a4a),
    liquidG: toon(0x7dff6b, { emissive: 0x2a8a20, opacity: 0.85 }),
    liquidP: toon(0xff6bd6, { emissive: 0x8a2070, opacity: 0.85 }),
    liquidB: toon(0x6bd6ff, { emissive: 0x20608a, opacity: 0.85 }),
    tube: toon(0xd8f4ff, { opacity: 0.35, outline: false }),
    lamp: toon(0xfff2a0, { emissive: 0xc08a20 }),
  };
  const aG = Math.atan2(-C.x, -C.z); // gate faces the Tree Fort
  const at = (a, rad) => [C.x + Math.sin(a) * rad, C.z + Math.cos(a) * rad];
  const pics = [];

  // ── the cake castle ──
  // tiers 1 and 2 are hollow shells: the ground floor is one big hall, open up into tier 2
  const T1 = 16, T2 = 11.5, doorHalf = 0.13, ceil1 = g + 5.7, ceil2 = g + 10.7;
  // Bubblegum's lab is a wing jutting out of tier 1: angles LAB.a + a0..a1, out to radius LAB.r
  const LAB = { a: aG + Math.PI / 2, a0: -1.0, a1: 1.05, r: 20 };
  const inLab = (a) => { const d = angDiff(a, LAB.a); return d > LAB.a0 && d < LAB.a1; };
  const labKeep = [[LAB.a + (LAB.a0 + LAB.a1) / 2 + Math.PI, TAU - (LAB.a1 - LAB.a0)]]; // ringCollider gaps: only the wing's arc
  // a flat annular sector (Builder.slab shape) between angles a0..a1 and radii r0..r1
  const sectorShape = (a0, a1, r0, r1, n = 24) => {
    const s = new THREE.Shape(), p = (a, rr) => [Math.sin(a) * rr, -Math.cos(a) * rr];
    for (let i = 0; i <= n; i++) { const [x, y] = p(a0 + ((a1 - a0) * i) / n, r1); i ? s.lineTo(x, y) : s.moveTo(x, y); }
    for (let i = n; i >= 0; i--) { const [x, y] = p(a0 + ((a1 - a0) * i) / n, r0); s.lineTo(x, y); }
    return s;
  };
  const drips = (rad, y, skip) => {
    if (!skip) B.raw(GEO.torus(rad, 0.55, TAU, 56), M.icing, mtx(C.x, y, C.z, 0, 1, 1, 1, Math.PI / 2));
    const n = Math.round(rad * 2.4);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + r() * 0.1, len = 0.6 + r() * 1.9;
      if (y < g + 7 && Math.abs(angDiff(a, aG)) < doorHalf + 0.05) continue;
      if (skip && skip(a)) continue;
      const [x, z] = at(a, rad + 0.12);
      B.capsule([x, y - 0.2, z], [x, y - 0.2 - len, z], 0.36, M.icing, 8);
    }
  };
  const windowsOn = (rad, y0, h, inner, skip) => {
    const n = Math.round(rad / 2);
    for (let k = 0; k < n; k++) {
      const a = aG + 0.5 + (k / n) * TAU, [x, z] = at(a, rad + 0.05);
      if (Math.abs(angDiff(a, aG)) < 0.35 || (skip && skip(a))) continue;
      B.box(x, y0 + h * 0.35, z, 1.2, 1.7, 0.25, M.glass, { solid: false, ry: a });
      B.sphere(x, y0 + h * 0.35 + 1.7, z, 0.62, M.cream, { sz: 0.3, ry: a });
      if (inner) {
        const [ix, iz] = at(a, inner);
        B.box(ix, y0 + h * 0.35, iz, 1.2, 1.7, 0.12, M.glass, { solid: false, ry: a });
        B.box(ix, y0 + h * 0.35 - 0.2, iz, 1.6, 0.2, 0.3, M.cream, { solid: false, ry: a });
      }
    }
  };
  // tier 1: outer wall with the doorway (and open into the lab wing), inner wall, roof ring (= the hall's low ceiling)
  for (const [a0, a1] of [[aG + doorHalf, LAB.a + LAB.a0], [LAB.a + LAB.a1, aG + TAU - doorHalf]]) {
    const o = () => ({ open: true, seg: Math.max(2, Math.round((48 * (a1 - a0)) / TAU)), ts: a0, tl: a1 - a0, solid: false });
    B.cyl(C.x, g - 0.5, C.z, T1, 6.5, M.cake, o());
    B.cyl(C.x, g - 0.5, C.z, T1 - 0.4, 6.2, M.hall, o());
    B.cyl(C.x, g - 0.5, C.z, T1 - 0.42, 1.9, M.hallPink, o());
  }
  B.cyl(C.x, g + 4.6, C.z, T1, 1.4, M.cake, { open: true, seg: 6, ts: aG - doorHalf, tl: 2 * doorHalf, solid: false });
  B.cyl(C.x, g + 4.6, C.z, T1 - 0.4, 1.1, M.hall, { open: true, seg: 6, ts: aG - doorHalf, tl: 2 * doorHalf, solid: false });
  for (const s of [-1, 1]) {
    const [x, z] = at(aG + s * doorHalf, T1 - 0.2);
    B.box(x, g - 0.5, z, 0.5, 5.1, 0.55, M.cakeD, { solid: false, ry: aG + s * doorHalf + Math.PI / 2 });
  }
  B.slab(ringShape(T2 - 0.5, T1), 0.3, M.cake, C.x, ceil1, C.z);
  drips(T1, g + 6, inLab);
  windowsOn(T1, g - 0.5, 6.5, T1 - 0.45, inLab);
  ringCollider(C.x, C.z, T1 - 0.2, 0.8, g - 1, ceil1, [[aG, 0.31], [LAB.a + (LAB.a0 + LAB.a1) / 2, LAB.a1 - LAB.a0 + 0.08]]);
  { // the lab wing outside: cake walls, a flat roof level with tier 1's, windows, icing all round the new edge
    const a0 = LAB.a + LAB.a0, a1 = LAB.a + LAB.a1, R = LAB.r, yR = g + 6;
    B.cyl(C.x, g - 0.5, C.z, R, 6.5, M.cake, { open: true, seg: 32, ts: a0, tl: a1 - a0, solid: false });
    for (const a of [a0, a1]) {
      const [x, z] = at(a, (T1 - 0.4 + R) / 2);
      B.box(x, g - 0.5, z, 0.34, 6.5, R - T1 + 0.4, M.cake, { solid: false, ry: a });
    }
    B.slab(sectorShape(a0, a1, T1 - 0.45, R + 0.1, 32), 0.3, M.cake, C.x, ceil1, C.z);
    ringCollider(C.x, C.z, R - 0.2, 0.8, g - 1, ceil1, labKeep);
    ringCollider(C.x, C.z, 16.7, 2.4, ceil1, yR, labKeep);
    ringCollider(C.x, C.z, 18.9, 2.4, ceil1, yR, labKeep);
    for (const da of [-0.6, -0.27, 0.45, 0.78]) {
      const a = LAB.a + da, [x, z] = at(a, R + 0.05), [ix, iz] = at(a, R - 0.45);
      B.box(x, g + 1.78, z, 1.2, 1.7, 0.25, M.glass, { solid: false, ry: a });
      B.sphere(x, g + 3.48, z, 0.62, M.cream, { sz: 0.3, ry: a });
      B.box(ix, g + 1.78, iz, 1.2, 1.7, 0.12, M.glass, { solid: false, ry: a });
      B.box(ix, g + 1.58, iz, 1.6, 0.2, 0.3, M.cream, { solid: false, ry: a });
    }
    // the icing rim: round the castle, out along one side wall, round the wing, back along the other
    const pts = [], add = (a, rr) => { const [x, z] = at(a, rr); pts.push([x, yR, z]); };
    for (let i = 0; i <= 48; i++) add(a1 + ((TAU - (a1 - a0)) * i) / 48, T1);
    for (let rr = T1 + 1; rr < R; rr += 1) add(a0 - 0.3 / rr, rr);
    for (let i = 0; i <= 32; i++) add(a0 + ((a1 - a0) * i) / 32, R + 0.05);
    for (let rr = R - 1; rr > T1; rr -= 1) add(a1 + 0.3 / rr, rr);
    add(a1, T1);
    B.tube(pts, 0.55, M.icing, { seg: 320, radial: 10 });
    // its drips (own hash, so the rest of the kingdom keeps its random layout)
    const h = (i) => { const v = Math.sin(i * 12.9898 + 4.1) * 43758.5453; return v - Math.floor(v); };
    const drip = (x, z, i) => B.capsule([x, yR - 0.2, z], [x, yR - 0.2 - 0.6 - h(i) * 1.9, z], 0.36, M.icing, 8);
    const nArc = Math.round((R * (a1 - a0) * 2.4) / TAU);
    for (let k = 0; k < nArc; k++) drip(...at(a0 + ((k + 0.5) / nArc) * (a1 - a0) + (h(k + 50) - 0.5) * 0.02, R + 0.17), k);
    for (const [a, s] of [[a0, -1], [a1, 1]]) for (const rr of [T1 + 1.3, T1 + 2.9]) drip(...at(a + (s * 0.45) / rr, rr), rr * 7 + s);
  }
  W.sealed(C.x, C.z, T1 - 0.6, g - 1, ceil2, 75);
  ringCollider(C.x, C.z, 14.9, 2.4, ceil1, g + 6);
  ringCollider(C.x, C.z, 12.6, 2.4, ceil1, g + 6);
  // tier 2: open at the bottom, a lid on top
  B.cyl(C.x, g + 6, C.z, T2, 5, M.cake, { open: true, seg: 40, solid: false });
  B.cyl(C.x, ceil1, C.z, T2 - 0.4, ceil2 - ceil1, M.hall, { open: true, seg: 40, solid: false });
  B.raw(GEO.circle(40), M.cake, mtx(C.x, g + 11, C.z, 0, T2, T2, 1, -Math.PI / 2));
  B.raw(GEO.circle(40), M.cakeD, mtx(C.x, ceil2, C.z, 0, T2, T2, 1, Math.PI / 2));
  B.raw(GEO.torus(T2 - 0.5, 0.3, TAU, 40), M.throne, mtx(C.x, ceil1 - 0.1, C.z, 0, 1, 1, 1, Math.PI / 2));
  drips(T2, g + 11);
  windowsOn(T2, g + 6, 5, T2 - 0.45);
  ringCollider(C.x, C.z, T2, 0.8, ceil1, g + 11);
  cylCollider(C.x, C.z, T2 + 0.1, ceil2, g + 11);
  // tier 3 is solid cake
  B.cyl(C.x, g + 11, C.z, 7.5, 4.5, M.cake, { seg: 48 });
  drips(7.5, g + 15.5);
  windowsOn(7.5, g + 11, 4.5);
  { // the doorway arch and its open doors
    const [x, z] = at(aG, T1 + 0.05);
    B.raw(GEO.torus(2.1, 0.4, Math.PI, 16), M.cream, mtx(x, g + 4.3, z, aG));
    for (let k = 0; k < 7; k++) {
      const a = Math.PI * (k / 6), [hx, hz] = [x + Math.cos(aG) * Math.cos(a) * 2.1, z - Math.sin(aG) * Math.cos(a) * 2.1];
      B.sphere(hx, g + 4.3 + Math.sin(a) * 2.1, hz, 0.28, M.icing, { seg: 8 });
    }
    for (const s of [-1, 1]) {
      const [dx, dz] = at(aG + s * 0.2, T1 + 0.9);
      B.box(dx, g, dz, 0.25, 4.1, 2.0, M.door, { solid: false, ry: aG + s * 0.9 });
    }
  }
  // towers and the central tower (unchanged silhouette)
  const tower = (a, rad, y0, h, tr, flag) => {
    const [x, z] = at(a, rad);
    B.cyl(x, y0, z, tr, h, M.cakeD, { seg: 16 });
    B.raw(GEO.torus(tr, 0.3, TAU, 20), M.icing, mtx(x, y0 + h, z, 0, 1, 1, 1, Math.PI / 2));
    B.sphere(x, y0 + h + tr * 0.45, z, tr * 1.15, M.pink);
    B.cone(x, y0 + h + tr * 0.85, z, tr * 1.1, tr * 3.3, M.waffle, { seg: 16 });
    B.sphere(x, y0 + h + tr * 0.85 + tr * 3.3, z, tr * 0.28, M.cream);
    B.box(x + Math.sin(a) * tr, y0 + h * 0.5, z + Math.cos(a) * tr, 0.8, 1.2, 0.2, M.glass, { solid: false, ry: a });
    if (flag) {
      const top = y0 + h + tr * 0.85 + tr * 3.3;
      B.cyl(x, top, z, 0.07, 2.4, M.white, { solid: false, seg: 5 });
      B.raw(new THREE.ConeGeometry(0.55, 1.8, 3), M.icing, mtx(x + 0.9, top + 1.9, z, 0, 1, 1, 0.12, 0, -Math.PI / 2));
    }
  };
  for (let k = 0; k < 6; k++) tower(aG + Math.PI / 6 + (k * Math.PI) / 3, 14, g + 6, 7, 1.8, k % 2 === 0);
  for (let k = 0; k < 4; k++) tower(aG + Math.PI / 4 + (k * Math.PI) / 2, 10, g + 11, 8, 1.6, k % 2 === 1);
  // two horn towers curving out over the gate side, with waffle-cone tips
  for (const s of [-1, 1]) {
    const a = aG + s * 0.75, [x0, z0] = at(a, 12.6), [x1, z1] = at(a + s * 0.12, 16), [x2, z2] = at(a + s * 0.22, 19.5);
    B.branch([[x0, g + 6, z0], [x1, g + 11, z1], [x2, g + 13.5, z2]], 1.3, 0.95, M.cakeD, 14);
    for (let k = 1; k <= 3; k++) {
      const t = k / 4, [xt, zt] = at(a + s * 0.22 * t, 12.6 + 6.9 * t);
      B.raw(GEO.torus(1.25 - t * 0.3, 0.16, TAU, 16), M.icing, mtx(xt, g + 6 + 7.5 * t, zt, a, 1, 1, 1, Math.PI / 2 - 0.5 * t));
    }
    B.cone(x2, g + 13.2, z2, 1.3, 4.2, M.waffle, { seg: 14 });
    B.sphere(x2, g + 17.4, z2, 0.4, M.cream);
  }
  B.cyl(C.x, g + 15.5, C.z, 3.2, 13.5, M.cakeD, { rTop: 2.8, seg: 24 });
  for (let y = g + 17; y < g + 28; y += 2.2) B.raw(GEO.torus(3.05 - (y - g - 15.5) * 0.03, 0.18, TAU, 24), M.icing, mtx(C.x, y, C.z, 0, 1, 1, 1, Math.PI / 2));
  B.cyl(C.x, g + 28.5, C.z, 4.4, 0.5, M.cake, { seg: 32 });
  B.raw(GEO.torus(4.4, 0.3, TAU, 40), M.icing, mtx(C.x, g + 29, C.z, 0, 1, 1, 1, Math.PI / 2));
  for (let k = 0; k < 14; k++) {
    const [x, z] = at((k / 14) * TAU, 4.1);
    B.sphere(x, g + 29.25, z, 0.45, M.cream);
  }
  B.cyl(C.x, g + 29, C.z, 1.0, 1.2, M.icing, { seg: 14 });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU, [x, z] = at(a, 3.9), top = g + 33 + (k % 2);
    B.branch([[C.x, g + 30, C.z], [lerp(C.x, x, 0.5), g + 31.5, lerp(C.z, z, 0.5)], [x, top, z]], 0.42, 0.22, M.icing, 10);
    B.cyl(x, top - 1.3, z, 0.04, 1.3, M.stick, { solid: false, seg: 4 });
    B.sphere(x, top - 1.5, z, 0.38, M.cherry);
  }
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * TAU, rr = k === 8 ? 0 : 2.8;
    const [x, z] = at(a, rr);
    B.sphere(x, g + 36 + (k === 8 ? 1.8 : r() * 1.2), z, 2.2 + r() * 1.1, M.cream);
  }
  W.treasure("candy", C.x + 2.5, g + 29, C.z + 0.8);
  // gumdrop stairs + cotton candy clouds (the climb)
  const GUM = [0xff4f9a, 0x5fd3ff, 0xffd84f, 0x9dff6b, 0xc27bff];
  // gumdrops stand on the ground, the tier-1 roof or the tier-2 lid (never through the hall below)
  const gum = (a, rad, top, gr, floor) => {
    const [x, z] = at(a, rad), gy = floor ?? W.ground(x, z);
    const base = Math.min(gy, top - 1) - 0.4;
    B.cyl(x, base, z, gr, top - base, toon(GUM[Math.floor(r() * 5)]), { rTop: gr * 0.82, seg: 14 });
    B.sphere(x, top, z, gr * 0.82, toon(GUM[Math.floor(r() * 5)]), { sy: 0.3 });
  };
  // the first four wind round the corner of the lab wing up to its roof
  const GUM1 = [[0.3, 18.2], [0.36, 22.0], [0.53, 23.6], [0.72, 22.6]];
  GUM1.forEach(([da, rad], k) => gum(aG + da, rad, g + 1.3 + k * 1.2, 1.4));
  [7.3, 8.6, 9.9].forEach((t, k) => gum(aG + 0.8 + k * 0.25, 13.6, g + t, 1.2, g + 6.3));
  [12.4, 13.8].forEach((t, k) => gum(aG + 1.25 + k * 0.3, 9.5, g + t, 1.1, g + 11.3));
  for (let k = 0; k < 8; k++) {
    const a = aG + 1.6 + k * 0.62, [x, z] = at(a, 5.8), top = g + 17.1 + k * 1.6;
    cylCollider(x, z, 1.4, top - 0.7, top);
    B.sphere(x, top - 0.6, z, 1.4, M.cloud, { sy: 0.45 });
    B.sphere(x + 0.7, top - 0.75, z + 0.3, 0.9, M.white, { sy: 0.5 });
    B.sphere(x - 0.6, top - 0.75, z - 0.4, 0.95, M.cloud, { sy: 0.5 });
  }
  const cp = (a, rad, y) => { const [x, z] = at(a, rad); return { x, z, y }; };
  W.course("castelo-doce", cp(aG + 0.1, 20.5, g), [
    ...GUM1.map(([da, rad], k) => cp(aG + da, rad, g + 1.3 + k * 1.2)),
    cp(aG + 0.8, 19.3, g + 6), cp(aG + 1.0, 15.2, g + 6),
    ...[7.3, 8.6, 9.9].map((t, k) => cp(aG + 0.8 + k * 0.25, 13.6, g + t)),
    cp(aG + 1.3, 10.6, g + 11),
    ...[12.4, 13.8].map((t, k) => cp(aG + 1.25 + k * 0.3, 9.5, g + t)),
    cp(aG + 1.2, 6.6, g + 15.5),
    ...Array.from({ length: 8 }, (_, k) => cp(aG + 1.6 + k * 0.62, 5.8, g + 17.1 + k * 1.6)),
    ...balconyWalk(aG + 1.6 + 7 * 0.62, Math.atan2(2.5, 0.8)),
  ], "candy");
  // waypoints around the crown's pedestal, from where the clouds land you to the gem
  function balconyWalk(a0, a1) {
    const d = Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0)), n = Math.ceil(Math.abs(d)) + 1;
    return Array.from({ length: n + 1 }, (_, i) => cp(a0 + (d * i) / n, 3.3, g + 29));
  }

  // ── inside: the throne room ──
  const back = aG + Math.PI, side = (s) => aG + (s * Math.PI) / 2;
  // structure that shows through the doorway stays loaded; furniture only near the castle
  B.raw(GEO.circle(48), M.tile, mtx(C.x, g + 0.03, C.z, 0, T1 - 0.4, T1 - 0.4, 1, -Math.PI / 2));
  { // the carpet from the door to the throne
    const [x0, z0] = at(aG, T1 - 0.4), [x1, z1] = at(back, 6.2), L = Math.hypot(x1 - x0, z1 - z0);
    B.box((x0 + x1) / 2, g + 0.03, (z0 + z1) / 2, 3.0, 0.05, L, M.carpetEdge, { ry: aG, solid: false, r: 0.02 });
    B.box((x0 + x1) / 2, g + 0.05, (z0 + z1) / 2, 2.4, 0.05, L - 0.2, M.carpet, { ry: aG, solid: false, r: 0.02 });
  }
  // candy-cane pillars around the rotunda (they hold up tier 2)
  const cane = (x, z, y0, y1, rr = 0.5) => {
    B.cyl(x, y0, z, rr, y1 - y0, M.white, { seg: 12, solid: false });
    const pts = [], turns = (y1 - y0) / 1.3;
    for (let i = 0; i <= turns * 10; i++) {
      const t = i / (turns * 10), a = t * turns * TAU;
      pts.push([x + Math.sin(a) * rr * 1.02, y0 + t * (y1 - y0), z + Math.cos(a) * rr * 1.02]);
    }
    B.tube(pts, rr * 0.28, M.icing, { seg: Math.round(turns * 14), radial: 5 });
    for (const y of [y0, y1 - 0.35]) B.cyl(x, y, z, rr * 1.35, 0.35, M.throne, { seg: 12, solid: false });
    cylCollider(x, z, rr + 0.1, y0, y1);
  };
  for (let k = 0; k < 8; k++) {
    const [x, z] = at(aG + Math.PI / 8 + (k * Math.PI) / 4, 10.4);
    cane(x, z, g, ceil1 - 0.1, 0.55);
  }
  // pillars along the carpet from the door
  for (const t of [13.2, 11.2]) for (const s of [-1, 1]) {
    const [x, z] = at(aG + s * (2.7 / t), t);
    cane(x, z, g, ceil1, 0.42);
  }
  // hanging chandelier in the rotunda
  {
    const y = g + 7.6;
    B.raw(GEO.torus(2.3, 0.14, TAU, 32), M.gold, mtx(C.x, y, C.z, 0, 1, 1, 1, Math.PI / 2));
    B.raw(GEO.torus(1.2, 0.1, TAU, 24), M.gold, mtx(C.x, y + 0.9, C.z, 0, 1, 1, 1, Math.PI / 2));
    for (let k = 0; k < 10; k++) {
      const [x, z] = at((k / 10) * TAU, 2.3);
      B.cone(x, y + 0.12, z, 0.26, 0.5, M.bulb, { seg: 8 });
      B.sphere(x, y + 0.7, z, 0.2, M.bulb, { seg: 8 });
    }
    for (let k = 0; k < 3; k++) {
      const [x, z] = at((k / 3) * TAU, 2.2);
      B.capsule([x, y, z], [C.x, ceil2, C.z], 0.04, M.gold, 4);
    }
    B.sphere(C.x, y + 0.2, C.z, 0.7, M.throne, { seg: 12 });
    B.sphere(C.x, y - 0.6, C.z, 0.3, M.cherry, { seg: 8 });
  }
  B.inside(C.x, C.z, 42, () => {
    // the throne: a dais, a pink seat and a tall heart back; the treasure sits on the heart
    const [tx, tz] = at(back, 8.6), fa = aG; // the throne faces the door
    B.cyl(tx, g, tz, 3.2, 0.3, M.carpetEdge, { seg: 24 });
    B.cyl(tx, g + 0.3, tz, 2.5, 0.3, M.carpet, { seg: 24 });
    const [sx, sz] = at(back, 8.1);
    B.box(sx, g + 0.6, sz, 1.8, 0.9, 1.4, M.throne, { ry: fa, r: 0.25 });
    for (const s of [-1, 1]) {
      const ax = sx + Math.cos(fa) * 1.0 * s, az = sz - Math.sin(fa) * 1.0 * s;
      B.box(ax, g + 0.6, az, 0.35, 1.5, 1.4, M.throne, { solid: false, ry: fa, r: 0.15 });
      B.sphere(ax, g + 2.15, az, 0.25, M.gold, { seg: 8 });
    }
    const [bx, bz] = at(back, 8.95);
    B.box(bx, g + 1.5, bz, 2.3, 3.1, 0.6, M.throne, { ry: fa, r: 0.25, solid: false });
    const [hwx, hwz] = Math.abs(Math.cos(fa)) > 0.7 ? [1.15, 0.55] : [0.55, 1.15];
    boxCollider(bx - hwx, bx + hwx, g + 0.6, g + 4.6, bz - hwz, bz + hwz);
    for (const s of [-1, 1]) B.sphere(bx + Math.cos(fa) * 0.6 * s, g + 4.7, bz - Math.sin(fa) * 0.6 * s, 0.75, M.icing, { sz: 0.45, ry: fa, seg: 12 });
    B.cone(bx, g + 3.4, bz, 1.05, 1.3, M.icing, { rx: Math.PI, sz: 0.45, ry: fa, seg: 12 });
    for (let k = 0; k < 5; k++) B.cone(bx + Math.cos(fa) * (k - 2) * 0.35, g + 5.3, bz - Math.sin(fa) * (k - 2) * 0.35, 0.12, k === 2 ? 0.7 : 0.45, M.gold, { seg: 5 });
    W.treasure("throne", bx, g + 4.6, bz);
    // a gumdrop pedestal beside the throne is the way up
    const [px, pz] = [tx + Math.cos(fa) * 3.6, tz - Math.sin(fa) * 3.6];
    B.cyl(px, g, pz, 1.05, 2.2, toon(GUM[1]), { rTop: 0.9, seg: 14 });
    B.sphere(px, g + 2.2, pz, 0.9, toon(GUM[1]), { sy: 0.3 });
    const [ex, ez] = [tx - Math.cos(fa) * 3.6, tz + Math.sin(fa) * 3.6];
    B.cyl(ex, g, ez, 1.05, 2.2, toon(GUM[4]), { rTop: 0.9, seg: 14 });
    B.sphere(ex, g + 2.2, ez, 0.9, toon(GUM[4]), { sy: 0.3 });
    const [dx, dz] = at(back, 7.0);
    W.course("trono", cp(aG, 12, g), [cp(aG, 7.5, g), cp(aG, 3, g), cp(back, 2, g), { x: dx + Math.cos(fa) * 1.4, z: dz - Math.sin(fa) * 1.4, y: g + 0.6 }, { x: px, z: pz, y: g + 2.2 }, { x: bx, z: bz, y: g + 4.6 }], "throne");
    W.npc("pb", tx - Math.cos(fa) * 1.2 + Math.sin(fa) * 1.6, tz + Math.sin(fa) * 1.2 + Math.cos(fa) * 1.6, fa, { y: g + 0.6 });
    // royal banners with the crown emblem between the windows
    for (const a of [aG + 2.69, aG + 4.03, aG + 3.52, aG + 5.6]) { // (two of them flank the throne)
      const [x, z] = at(a, T1 - 0.55);
      B.box(x, g + 1.2, z, 1.4, 3.6, 0.06, M.icing, { solid: false, ry: a });
      B.cone(x - Math.sin(a) * 0.01, g + 0.75, z - Math.cos(a) * 0.01, 0.7, 0.5, M.icing, { rx: Math.PI, sz: 0.08, ry: a, seg: 3 });
      B.capsule(...(() => { const c = Math.cos(a), s = Math.sin(a); return [[x - c * 0.8, g + 4.85, z + s * 0.8], [x + c * 0.8, g + 4.85, z - s * 0.8]]; })(), 0.06, M.gold, 5);
      const [ix, iz] = at(a, T1 - 0.62);
      pics.push({ x: ix, y: g + 3.3, z: iz, ry: a + Math.PI, w: 1.1, h: 1.1, draw: paintCrown });
    }
    // Bubblegum's lab: its own light-blue wing off the hall (LAB), behind a sliding door of candy steel.
    // Counters and white cupboards along the outer wall, the chalkboard, the science shower,
    // two lab tables covered in experiments, the big purple distiller, bubbling tubes, a scanner.
    {
      const LA = LAB.a, A0 = LAB.a0, A1 = LAB.a1, RI = 11.25, RO = LAB.r - 0.43, DH = 0.13, lab = (da, rr) => at(LA + da, rr);
      const LM = {
        wall: toon(0xcdeaf5, { side: THREE.BackSide, outline: false }), wallF: toon(0xcdeaf5, { outline: false }),
        floor: toon(0xc8e8a8, { tex: "tiles", scale: 0.35 }), hallF: toon(0xffe07a, { tex: "frosting", scale: 0.2 }),
        cab: toon(0xf6f6f2), top: toon(0x8fa8b8), wood: toon(0xa8743e, { tex: "wood", scale: 0.5 }), red: toon(0xd8583a),
        steel: toon(0x8fa3b8, { tex: "siding", scale: 1.5 }), steelD: toon(0x6a7e92), rivet: toon(0x5a6a7a), shower: toon(0xffd23f), stripe: toon(0x1d1d24),
        glass: toon(0xe8f8ff, { opacity: 0.35, outline: false }), purple: toon(0xb05ae0, { opacity: 0.8, emissive: 0x3a0a4a }),
        green: toon(0x7dff6b, { emissive: 0x2a8a20, opacity: 0.85 }), pink: toon(0xff6bd6, { emissive: 0x8a2070, opacity: 0.85 }),
        blue: toon(0x6bd6ff, { emissive: 0x20608a, opacity: 0.85 }), black: toon(0x2a2a30), flame: toon(0x6fb8ff, { emissive: 0x2050c0, outline: false }),
        paper: toon(0xfbf6e6), lamp: toon(0xfff8e0, { emissive: 0xb0a070 }), screen: toon(0x9dff9a, { emissive: 0x2a6a2a }),
        mat: [toon(0xffd84f, { outline: false }), toon(0xff6b6b, { outline: false }), toon(0x6bb8ff, { outline: false })],
      };
      const ARC = A1 - A0, MID = (A0 + A1) / 2;
      // floor, ceiling, the outer wall painted blue, a tiled backsplash over the counters
      const sector = (r0, r1) => sectorShape(LA + A0, LA + A1, r0, r1, 32);
      B.slab(sector(RI, RO), 0.03, LM.floor, C.x, g + 0.03, C.z);
      B.slab(sector(RI, RO), 0.04, LM.wallF, C.x, ceil1 - 0.08, C.z);
      B.cyl(C.x, g, C.z, RO, ceil1 - g, LM.wall, { open: true, seg: 32, ts: LA + A0, tl: ARC, solid: false });
      B.cyl(C.x, g + 1.0, C.z, RO - 0.03, 0.75, toon(0xe8f6fa, { tex: "tiles", scale: 0.5, side: THREE.BackSide, outline: false }), { open: true, seg: 32, ts: LA + A0, tl: ARC, solid: false });
      // the curved wall to the hall (yellow on the hall side, blue inside), with the doorway
      for (const [a0, a1] of [[A0, -DH], [DH, A1]]) {
        B.cyl(C.x, g, C.z, RI - 0.08, ceil1 - g, M.hall, { open: true, seg: 12, ts: LA + a0, tl: a1 - a0, solid: false });
        B.cyl(C.x, g, C.z, RI + 0.08, ceil1 - g, LM.wallF, { open: true, seg: 12, ts: LA + a0, tl: a1 - a0, solid: false });
      }
      B.cyl(C.x, g + 3.6, C.z, RI - 0.08, ceil1 - g - 3.6, M.hall, { open: true, seg: 2, ts: LA - DH, tl: 2 * DH, solid: false });
      B.cyl(C.x, g + 3.6, C.z, RI + 0.08, ceil1 - g - 3.6, LM.wallF, { open: true, seg: 2, ts: LA - DH, tl: 2 * DH, solid: false });
      ringCollider(C.x, C.z, RI, 0.5, g - 1, ceil1, [[LA, 0.29], [LA + MID + Math.PI, TAU - ARC]]);
      { const [dx, dz] = lab(0, RI); boxCollider(dx - 1.5, dx + 1.5, g + 3.6, ceil1, dz - 1.5, dz + 1.5); }
      // the side walls (radial): yellow facing the hall, blue inside, cake outside the castle (built
      // with the wing), with a row of small colliders along each
      for (const [ea, s] of [[A0, -1], [A1, 1]]) {
        const a = LA + ea, [mx, mz] = at(a, (RI + T1 - 0.4) / 2);
        B.box(mx, g, mz, 0.3, ceil1 - g, T1 - 0.4 - RI, LM.hallF, { solid: false, ry: a, r: 0.02 });
        const [px, pz] = at(a - s * 0.012, (RI + RO) / 2);
        B.box(px, g, pz, 0.04, ceil1 - g, RO - RI, LM.wallF, { solid: false, ry: a, r: 0.01 });
        for (let d = RI; d <= LAB.r; d += 0.55) { const [cx, cz] = at(a, d); cylCollider(cx, cz, 0.3, g - 1, ceil1); }
      }
      // the doorway: a steel frame with hazard stripes, and a sliding door of candy steel pushed
      // aside on the lab side (riveted, with a porthole and a handle, hanging from a rail)
      {
        for (const s of [-1, 1]) {
          const [jx, jz] = lab(s * (DH + 0.012), RI);
          B.box(jx, g, jz, 0.3, 3.75, 0.62, LM.steelD, { solid: false, ry: LA + s * DH, r: 0.04 });
        }
        const [lx, lz] = lab(0, RI);
        B.box(lx, g + 3.6, lz, 3.3, 0.45, 0.62, LM.steelD, { solid: false, ry: LA, r: 0.04 });
        for (let k = 0; k < 8; k++) {
          const o = (k - 3.5) * 0.4, x = lx + Math.cos(LA) * o - Math.sin(LA) * 0.32, z = lz - Math.sin(LA) * o - Math.cos(LA) * 0.32;
          B.box(x, g + 3.65, z, 0.2, 0.35, 0.02, k % 2 ? LM.shower : LM.stripe, { solid: false, ry: LA, rz: 0.5 });
        }
        const da = DH + 0.125, [dx, dz] = lab(da, RI + 0.34), a = LA + da;
        B.box(dx, g + 0.02, dz, 2.7, 3.5, 0.16, LM.steel, { solid: false, ry: a, r: 0.05 });
        const face = (o, y) => [dx + Math.cos(a) * o + Math.sin(a) * 0.09, g + y, dz - Math.sin(a) * o + Math.cos(a) * 0.09];
        for (const o of [-1.2, 1.2]) for (const y of [0.25, 1.75, 3.25]) { const [x, yy, z] = face(o, y); B.sphere(x, yy, z, 0.06, LM.rivet, { seg: 5 }); }
        { const [x, y, z] = face(0, 2.5); B.raw(GEO.torus(0.34, 0.07, TAU, 14), LM.rivet, mtx(x, y, z, a)); B.raw(GEO.circle(12), LM.glass, mtx(x, y, z, a, 0.32, 0.32, 1)); }
        { const [x, y, z] = face(-1.05, 1.5); B.box(x, y - 0.35, z, 0.1, 0.7, 0.1, LM.rivet, { solid: false, ry: a }); }
        const [rx, rz] = lab(0.2, RI + 0.34);
        B.box(rx, g + 3.55, rz, 5.4, 0.1, 0.12, LM.rivet, { solid: false, ry: LA + 0.2 });
      }
      // counters with white cupboards along the outer wall, wall cupboards over them
      const fwd = (a) => [-Math.sin(a), -Math.cos(a)]; // towards the middle of the castle
      const clearOf = (a, zones) => zones.every(([c, w]) => Math.abs(a - c) > w);
      const RC = RO - 0.72, NC = 19, CS = 1.84 / RC, D0 = -0.83; // counter radius, count, angular step, first
      for (let k = 0; k < NC; k++) {
        const da = D0 + k * CS, a = LA + da, [x, z] = at(a, RC), [fx, fz] = fwd(a);
        B.box(x, g, z, 1.78, 1.0, 1.1, LM.cab, { ry: a, r: 0.04, solid: false });
        B.box(x, g + 1.0, z, 1.84, 0.1, 1.22, LM.top, { solid: false, ry: a, r: 0.02 });
        for (const s of [-0.43, 0.43]) {
          const ox = x + Math.cos(a) * s + fx * 0.56, oz = z - Math.sin(a) * s + fz * 0.56;
          B.box(ox, g + 0.12, oz, 0.8, 0.75, 0.04, LM.cab, { solid: false, ry: a, r: 0.02 });
          B.sphere(ox - Math.cos(a) * s * 0.7 + fx * 0.03, g + 0.8, oz + Math.sin(a) * s * 0.7 + fz * 0.03, 0.045, LM.top, { seg: 5 });
        }
        if (clearOf(da, [[-0.6, 0.09], [-0.27, 0.09], [0.45, 0.09], [0.78, 0.09], [0.1, 0.15]])) { // windows, chalkboard
          const [ux, uz] = at(a, RO - 0.27);
          B.box(ux, g + 2.7, uz, 1.7, 0.95, 0.5, LM.cab, { solid: false, ry: a, r: 0.04 });
          B.box(ux + fx * 0.26, g + 3.15, uz + fz * 0.26, 1.6, 0.03, 0.03, LM.top, { solid: false, ry: a });
        }
        const on = (dx, dd) => [x + Math.cos(a) * dx + fx * dd, z - Math.sin(a) * dx + fz * dd];
        const kind = ["jars", "sink", "flasks", "micro", "burner", "flasks", "scale", "jars", "flasks", "sink", "micro", "burner", "flasks", "jars", "scale", "flasks", "sink", "jars", "burner"][k];
        if (kind === "sink") {
          const [sx, sz] = on(0, 0.1), [kx, kz] = on(0, -0.35);
          B.box(sx, g + 1.02, sz, 0.9, 0.1, 0.6, LM.top, { solid: false, ry: a });
          B.capsule([kx, g + 1.08, kz], [kx, g + 1.5, kz], 0.04, LM.rivet, 5);
          B.capsule([kx, g + 1.5, kz], [sx, g + 1.42, sz], 0.035, LM.rivet, 5);
        } else if (kind === "micro") {
          const [mx, mz] = on(0.2, 0);
          B.box(mx, g + 1.1, mz, 0.4, 0.08, 0.35, LM.black, { solid: false, ry: a });
          B.capsule([mx, g + 1.18, mz], [mx - fx * 0.1, g + 1.6, mz - fz * 0.1], 0.05, LM.black, 5);
          B.cyl(mx + fx * 0.05, g + 1.45, mz + fz * 0.05, 0.07, 0.35, LM.cab, { solid: false, seg: 8, rx: 0.5 });
        } else if (kind === "flasks") {
          [[-0.5, LM.green, 0.3], [0.05, LM.pink, 0.22], [0.5, LM.blue, 0.26]].forEach(([dx, m, h], i) => {
            const [jx, jz] = on(dx, 0.05 * i);
            B.cyl(jx, g + 1.1, jz, 0.17, h, m, { solid: false, seg: 10, rTop: i % 2 ? 0.17 : 0.07 });
            B.cyl(jx, g + 1.1, jz, 0.2, h + 0.25, LM.glass, { solid: false, seg: 10, rTop: 0.07, open: true });
          });
        } else if (kind === "burner") {
          const [bx2, bz2] = on(0, 0);
          B.cyl(bx2, g + 1.1, bz2, 0.18, 0.06, LM.black, { solid: false, seg: 10 });
          B.cyl(bx2, g + 1.16, bz2, 0.05, 0.4, LM.rivet, { solid: false, seg: 8 });
          B.cone(bx2, g + 1.56, bz2, 0.06, 0.25, LM.flame, { seg: 6 });
        } else if (kind === "jars") {
          for (let i = 0; i < 4; i++) {
            const [jx, jz] = on((i - 1.5) * 0.38, 0.1);
            B.cyl(jx, g + 1.1, jz, 0.13, 0.36, toon([0xff4f9a, 0x5fd3ff, 0xffd84f, 0x9dff6b][(i + k) % 4]), { solid: false, seg: 8 });
            B.cyl(jx, g + 1.46, jz, 0.14, 0.06, LM.wood, { solid: false, seg: 8 });
          }
        } else if (kind === "scale") {
          const [sx, sz] = on(0, 0);
          B.box(sx, g + 1.1, sz, 0.6, 0.15, 0.45, LM.steelD, { solid: false, ry: a });
          B.cyl(sx, g + 1.25, sz, 0.22, 0.03, LM.rivet, { solid: false, seg: 10 });
        }
      }
      // the counters' collider follows their curve (boxes would poke square corners into the aisle)
      ringCollider(C.x, C.z, RC + 0.15, 0.9, g - 1, g + 1.0, [[LA + D0 + ((NC - 1) * CS) / 2 + Math.PI, TAU - (NC - 0.2) * CS]]);
      // round colliders along a rotated piece of furniture (length along its tangent, at angle a)
      const tanRow = (a, rr, len, rad, top) => {
        const [x, z] = at(a, rr), n = Math.max(2, Math.round(len / (rad * 1.3)));
        for (let i = 0; i < n; i++) {
          const o = (i / (n - 1) - 0.5) * (len - rad * 2);
          cylCollider(x + Math.cos(a) * o, z - Math.sin(a) * o, rad, g - 0.5, g + top);
        }
      };
      // the wooden wall cabinet on one side wall, a shelf of candy ingredients on the other
      {
        const a = LA + A0 + 0.03, [x, z] = at(a, 14.2);
        B.box(x, g + 2.3, z, 0.4, 1.3, 2.0, LM.wood, { solid: false, ry: a, r: 0.05 });
        for (const s of [-0.5, 0.5]) { const [hx, hz] = at(a + 0.02, 14.2 + s * 0.4); B.sphere(hx, g + 2.95, hz, 0.05, LM.rivet, { seg: 5 }); }
        const sa = LA + A1 - 0.03;
        for (const y of [1.6, 2.4, 3.2]) {
          const [sx, sz] = at(sa, 14.6);
          B.box(sx, g + y, sz, 0.35, 0.08, 2.6, LM.wood, { solid: false, ry: sa });
          for (let i = 0; i < 4; i++) {
            const [jx, jz] = at(sa, 13.6 + i * 0.66);
            B.cyl(jx, g + y + 0.08, jz, 0.12, 0.3, toon([0xff4f9a, 0x5fd3ff, 0xffd84f, 0x9dff6b][(i + Math.round(y * 2)) % 4]), { solid: false, seg: 8 });
          }
        }
      }
      // the science shower in the corner: a yellow head on a pole, a pull ring, a drain, hazard stripes
      {
        const [x, z] = lab(A0 + 0.07, 18.4);
        B.cyl(x, g, z, 0.06, 3.4, LM.shower, { solid: false, seg: 6 });
        const [hx, hz] = lab(A0 + 0.085, 17.8);
        B.capsule([x, g + 3.4, z], [hx, g + 3.4, hz], 0.05, LM.shower, 5);
        B.cone(hx, g + 3.05, hz, 0.35, 0.35, LM.shower, { seg: 10 });
        B.capsule([hx, g + 3.05, hz], [hx, g + 2.1, hz], 0.012, LM.rivet, 3);
        B.raw(GEO.torus(0.1, 0.025, TAU, 10), LM.shower, mtx(hx, g + 2.0, hz, 0));
        B.raw(GEO.circle(14), LM.rivet, mtx(hx, g + 0.05, hz, 0, 0.45, 0.45, 1, -Math.PI / 2));
        for (let i = 0; i < 6; i++) {
          const [sx, sz] = lab(A0 + 0.085 + ((i % 3) - 1) * 0.035, 17.8 + (Math.floor(i / 3) - 0.5) * 0.7);
          B.box(sx, g + 0.035, sz, 0.55, 0.02, 0.55, i % 2 ? LM.shower : LM.stripe, { solid: false, ry: LA + A0 + 0.085 });
        }
        cylCollider(x, z, 0.12, g, g + 3.4, false);
        const [sx2, sz2] = lab(A0 + 0.07, RO - 0.1);
        pics.push({ x: sx2, y: g + 3.9, z: sz2, ry: LA + A0 + 0.07 + Math.PI, w: 0.7, h: 0.7, draw: paintShowerSign });
      }
      // the big purple distiller on a red table: round flask, long neck, a curly glass tube
      {
        const a = LA + 0.68, [tx, tz] = at(a, 15.9);
        B.box(tx, g, tz, 2.0, 1.0, 1.3, LM.red, { ry: a, r: 0.06, solid: false });
        tanRow(a, 15.9, 2.0, 0.65, 1.0);
        B.lathe([[0.01, 0], [0.55, 0.15], [0.75, 0.6], [0.6, 1.1], [0.22, 1.4], [0.18, 2.5], [0.25, 2.6]], LM.purple, tx - Math.cos(a) * 0.4, g + 1.0, tz + Math.sin(a) * 0.4, { seg: 16 });
        const pts = [];
        for (let i = 0; i <= 24; i++) {
          const t = i / 24, ang = t * TAU * 2.2, cx = tx - Math.cos(a) * 0.4 + Math.cos(a) * t * 1.2, cz = tz + Math.sin(a) * 0.4 - Math.sin(a) * t * 1.2;
          pts.push([cx + Math.sin(ang) * 0.28, g + 3.5 - t * 1.9 + Math.cos(ang) * 0.2, cz + Math.cos(ang) * 0.28]);
        }
        B.tube(pts, 0.05, LM.glass, { seg: 60, radial: 6 });
        cylCollider(tx - Math.cos(a) * 0.4, tz + Math.sin(a) * 0.4, 0.75, g + 1.0, g + 3.6);
        B.cyl(tx + Math.cos(a) * 0.8, g + 1.0, tz - Math.sin(a) * 0.8, 0.28, 0.45, LM.green, { solid: false, seg: 10, rTop: 0.1 });
      }
      // two lab tables: glowing serum, a rack of test tubes, goggles, an open notebook, stools; a mat under each
      for (const [ta, tr] of [[-0.62, 15.9], [0.3, 15.9]]) {
        const a = LA + ta, [x, z] = at(a, tr), c = Math.cos(a), s = Math.sin(a);
        B.box(x, g + 0.04, z, 3.8, 0.02, 2.0, LM.mat[ta < 0 ? 0 : 2], { solid: false, ry: a, r: 0.01 });
        B.box(x, g, z, 3.0, 1.0, 1.2, LM.cab, { ry: a, r: 0.05, solid: false });
        B.box(x, g + 1.0, z, 3.1, 0.1, 1.3, LM.top, { solid: false, ry: a });
        tanRow(a, tr, 3.0, 0.6, 1.0);
        const on = (dx, dd) => [x + c * dx - s * dd, z - s * dx - c * dd];
        [[-1.1, LM.green, 0.5], [-0.6, LM.pink, 0.35], [1.15, LM.blue, 0.4]].forEach(([dx, m, h]) => {
          const [fx2, fz2] = on(dx * (ta < 0 ? 1 : -1), 0.2);
          B.cyl(fx2, g + 1.1, fz2, 0.24, h, m, { solid: false, seg: 10, rTop: 0.09 });
          B.cyl(fx2, g + 1.1, fz2, 0.27, h + 0.3, LM.glass, { solid: false, seg: 10, rTop: 0.08, open: true });
        });
        const [rx2, rz2] = on(0.15, -0.3);
        B.box(rx2, g + 1.1, rz2, 1.0, 0.08, 0.3, LM.wood, { solid: false, ry: a });
        B.box(rx2, g + 1.45, rz2, 1.0, 0.06, 0.3, LM.wood, { solid: false, ry: a });
        [LM.red, LM.blue, LM.purple, LM.green, LM.pink].forEach((m, i) => {
          const [ttx, ttz] = on(0.15 + (i - 2) * 0.2, -0.3);
          B.cyl(ttx, g + 1.12, ttz, 0.05, 0.55, LM.glass, { solid: false, seg: 6, open: true });
          B.cyl(ttx, g + 1.14, ttz, 0.045, 0.3, m, { solid: false, seg: 6 });
        });
        const [nx, nz] = on(0.8 * (ta < 0 ? 1 : -1), 0.35);
        B.box(nx, g + 1.1, nz, 0.7, 0.03, 0.5, LM.paper, { solid: false, ry: a + 0.2 });
        if (ta < 0) {
          const [gx, gz] = on(-0.2, 0.45);
          for (const d of [-0.1, 0.1]) B.raw(GEO.torus(0.08, 0.025, TAU, 10), LM.black, mtx(gx + c * d, g + 1.14, gz - s * d, a, 1, 1, 1, Math.PI / 2));
        }
        for (const d of [-1.9, 1.9]) {
          const [sx, sz] = on(d, 0);
          B.cyl(sx, g, sz, 0.3, 0.8, LM.top, { seg: 10, cam: false });
        }
      }
      // tall bubbling tubes, the big computer, the scanner bed under its lamp
      for (const [ta, tr] of [[0.76, 12.15], [0.93, 12.15]]) {
        const [gx, gz] = lab(ta, tr);
        B.cyl(gx, g, gz, 0.72, 0.45, M.steel, { seg: 14 });
        B.cyl(gx, g + 0.45, gz, 0.56, 3.5, ta < 0.8 ? M.liquidG : LM.pink, { solid: false, seg: 14 });
        B.cyl(gx, g + 0.45, gz, 0.64, 3.7, M.tube, { solid: false, seg: 14, open: true });
        B.cyl(gx, g + 4.15, gz, 0.72, 0.4, M.steel, { solid: false, seg: 14 });
        cylCollider(gx, gz, 0.72, g, g + 4.55);
        for (let k = 0; k < 6; k++) B.sphere(gx + (r() - 0.5) * 0.7, g + 1 + k * 0.55, gz + (r() - 0.5) * 0.7, 0.08 + r() * 0.08, M.white, { seg: 5 });
      }
      {
        const ca = LA - 0.8, [cx, cz] = at(ca, 12.2), c = Math.cos(ca), s = Math.sin(ca);
        B.box(cx, g, cz, 2.8, 1.0, 1.0, M.steel, { ry: ca, r: 0.08, solid: false });
        tanRow(ca, 12.2, 2.8, 0.5, 2.1);
        for (const o of [-0.9, 0, 0.9]) {
          const x = cx + c * o, z = cz - s * o;
          B.box(x, g + 1.0, z, 0.85, 1.1, 0.8, M.labTop, { solid: false, ry: ca, r: 0.1 });
          B.box(x + s * 0.41, g + 1.15, z + c * 0.41, 0.65, 0.75, 0.04, LM.screen, { solid: false, ry: ca });
        }
        for (let k = 0; k < 6; k++) B.sphere(cx + c * (k - 2.5) * 0.35 + s * 0.5, g + 0.75, cz - s * (k - 2.5) * 0.35 + c * 0.5, 0.07, toon([0xff4f4f, 0xffd84f, 0x4fff7a, 0x4fb3ff][k % 4], { emissive: 0x333333 }), { seg: 5 });
      }
      {
        const sa = LA - 0.24, [sx, sz] = at(sa, 15.9), c = Math.cos(sa), s = Math.sin(sa);
        B.box(sx, g, sz, 1.1, 0.8, 2.4, LM.black, { ry: sa + Math.PI / 2, r: 0.1, solid: false });
        tanRow(sa, 15.9, 2.4, 0.55, 0.95);
        B.box(sx, g + 0.8, sz, 1.0, 0.15, 2.3, LM.cab, { solid: false, ry: sa + Math.PI / 2, r: 0.07 });
        const [ax, az] = [sx - c * 1.3, sz + s * 1.3];
        B.cyl(ax, g, az, 0.25, 3.2, LM.steelD, { solid: false, seg: 8 });
        cylCollider(ax, az, 0.3, g, g + 3.2, false);
        B.capsule([ax, g + 3.1, az], [sx, g + 3.1, sz], 0.12, LM.steelD, 6);
        B.cone(sx, g + 2.65, sz, 0.5, 0.45, LM.steelD, { seg: 10 });
        B.sphere(sx, g + 2.65, sz, 0.25, LM.lamp, { seg: 8 });
      }
      // a tall bookcase of science books against the wall by the door
      {
        const ba = LA - 0.25, [kx, kz] = at(ba, 11.62), c = Math.cos(ba), s = Math.sin(ba);
        B.box(kx, g, kz, 2.0, 3.2, 0.5, LM.wood, { ry: ba, r: 0.04, solid: false });
        tanRow(ba, 11.62, 2.0, 0.3, 3.2);
        for (let row = 0; row < 4; row++) for (let i = 0; i < 6; i++) {
          const o = (i - 2.5) * 0.3, x = kx + c * o + s * 0.24, z = kz - s * o + c * 0.24;
          B.box(x, g + 0.15 + row * 0.78, z, 0.22, 0.55 + ((i + row) % 3) * 0.08, 0.35, toon([0x3f6fd0, 0xd04a6a, 0x5fbf6a, 0xe8b84a, 0x8a5ad0][(i + row * 2) % 5]), { solid: false, ry: ba });
        }
      }
      // two rows of lamps hanging from the ceiling
      for (const da of [-0.7, -0.25, 0.25, 0.7]) for (const lr of [14.0, 17.4]) {
        const [lx, lz] = lab(da, lr);
        B.cyl(lx, ceil1 - 0.9, lz, 0.02, 0.85, LM.rivet, { solid: false, seg: 3 });
        B.cone(lx, ceil1 - 1.25, lz, 0.45, 0.4, LM.top, { seg: 10 });
        B.sphere(lx, ceil1 - 1.25, lz, 0.2, LM.lamp, { seg: 8 });
      }
      // the chalkboard in its wooden frame, between the two windows
      const bA = LA + 0.1, [bx2, bz2] = at(bA, RO - 0.05);
      B.box(bx2, g + 1.5, bz2, 3.9, 2.5, 0.12, LM.wood, { solid: false, ry: bA });
      B.box(bx2 - Math.sin(bA) * 0.1, g + 1.5, bz2 - Math.cos(bA) * 0.1, 3.9, 0.08, 0.28, LM.wood, { solid: false, ry: bA });
      const [ix, iz] = at(bA, RO - 0.13);
      pics.push({ x: ix, y: g + 2.75, z: iz, ry: bA + Math.PI, w: 3.6, h: 2.25, draw: paintChalkboard });
    }
    // the banquet table on the right: tablecloth, cakes, candles and chairs
    {
      const a0 = side(-1), [x, z] = at(a0, 12.2), c = Math.cos(a0), s = Math.sin(a0);
      B.box(x, g, z, 6.0, 1.0, 1.9, M.table, { ry: a0, r: 0.08 });
      B.box(x, g + 0.35, z, 6.2, 0.7, 2.1, M.frost, { solid: false, ry: a0, r: 0.05 });
      for (let k = 0; k < 4; k++) {
        const o = (k - 1.5) * 1.5, fx = x + c * o, fz = z - s * o;
        if (k % 2) {
          B.cyl(fx, g + 1.0, fz, 0.5, 0.45, M.choc, { solid: false, seg: 12 });
          B.cyl(fx, g + 1.45, fz, 0.52, 0.12, M.cream, { solid: false, seg: 12 });
          B.sphere(fx, g + 1.65, fz, 0.13, M.cherry, { seg: 6 });
        } else {
          B.cyl(fx, g + 1.0, fz, 0.1, 0.5, M.gold, { solid: false, seg: 6 });
          for (const d of [-0.25, 0, 0.25]) {
            B.cyl(fx + c * d, g + 1.45, fz - s * d, 0.05, 0.3, M.white, { solid: false, seg: 5 });
            B.cone(fx + c * d, g + 1.76, fz - s * d, 0.05, 0.14, M.bulb, { seg: 5 });
          }
        }
      }
      for (let k = 0; k < 4; k++) for (const e of [-1, 1]) {
        const o = (k - 1.5) * 1.5, fx = x + c * o + s * e * 1.45, fz = z - s * o + c * e * 1.45;
        B.box(fx, g, fz, 0.8, 0.7, 0.8, M.throne, { solid: false, ry: a0, r: 0.12 });
        B.box(fx + s * e * 0.35, g + 0.7, fz + c * e * 0.35, 0.8, 0.9, 0.12, M.throne, { solid: false, ry: a0, r: 0.05 });
      }
    }
    W.npc("pepbut", ...at(aG + 0.31, 12.2), aG, {});
  });
  {
    const pm = pictures(pics);
    W.scene.add(pm);
    B.cullNear(pm, C.x, C.z, 42);
  }

  // gumball dome
  {
    const [x, z] = at(aG - 0.85, 24);
    B.sphere(x, g - 1.2, z, 6.2, M.gum, { seg: 24 });
    cylCollider(x, z, 5.6, g - 1, g + 3.8);
    const [dx, dz] = at(aG - 0.85, 24 + 5.9);
    B.box(dx, g, dz, 1.8, 2.6, 0.3, M.door, { solid: false, ry: aG - 0.85 });
  }
  // licorice wall with swirl lollipops, and the orange road
  const ring = [];
  for (let k = 0; k <= 64; k++) {
    const a = aG + 0.16 + (k / 64) * (TAU - 0.32), [x, z] = at(a, 40);
    ring.push([x, g + 0.9, z]);
  }
  B.tube(ring, 0.9, M.licorice, { seg: 160, radial: 10 });
  ringCollider(C.x, C.z, 40, 1.4, g - 0.5, g + 1.7, [[aG, 0.32]]);
  for (let k = 0; k < 20; k++) {
    const a = aG + ((k + 0.5) / 20) * TAU, [x, z] = at(a, 40);
    B.cyl(x, g + 1.5, z, 0.16, 4, M.stick, { solid: false, seg: 6 });
    B.raw(GEO.cyl(1.3, 1.3, 24), M.blue, mtx(x, g + 6, z, a, 1, 0.3, 1, Math.PI / 2));
    B.raw(GEO.cyl(0.85, 0.85, 24), M.white, mtx(x + Math.sin(a) * 0.1, g + 6, z + Math.cos(a) * 0.1, a, 1, 0.3, 1, Math.PI / 2));
    B.raw(GEO.cyl(0.4, 0.4, 16), M.blue, mtx(x + Math.sin(a) * 0.2, g + 6, z + Math.cos(a) * 0.2, a, 1, 0.3, 1, Math.PI / 2));
  }
  for (let t = 0; t <= 1.001; t += 1 / 60) {
    const rad = lerp(62, 16.5, t), a = aG + Math.sin(t * 7) * 0.08;
    const [x, z] = at(a, rad);
    B.raw(GEO.circle(16), M.road, mtx(x, W.ground(x, z) + 0.05, z, 0, 1.9, 1.9, 1, -Math.PI / 2));
  }
  for (const s of [-1, 1]) {
    const [x, z] = at(aG + s * 0.09, 41.5);
    W.npc("banana", x, z, aG);
  }

  // ── the Gumball Guardians: giant pink statues with gumball-machine heads ──
  const glass = toon(0xcdefff, { opacity: 0.4, outline: false }), redM = toon(0xd8283a), silver = toon(0xd0d6de);
  for (const s of [-1, 1]) {
    const a = aG + s * 0.21, [x, z] = at(a, 47.5), gy = W.ground(x, z), fa = aG, c = Math.cos(fa), sn = Math.sin(fa);
    const side2 = (o) => [x + c * o * s, z - sn * o * s];
    B.cyl(x, gy - 0.5, z, 3.4, 11.5, M.pink, { rTop: 2.1, seg: 18 });
    B.raw(GEO.torus(3.3, 0.35, TAU, 24), M.frost, mtx(x, gy + 0.2, z, 0, 1, 1, 1, Math.PI / 2));
    B.cyl(x, gy + 11, z, 2.1, 4.6, M.pink, { rTop: 2.7, seg: 18 });
    B.raw(GEO.torus(2.1, 0.3, TAU, 20), M.frost, mtx(x, gy + 11, z, 0, 1, 1, 1, Math.PI / 2));
    for (const e of [-1, 1]) {
      const [sx, sz] = side2(2.9 * e);
      B.sphere(sx, gy + 14.9, sz, 1.2, M.pink, { seg: 12 });
      const [hx, hz] = side2(3.3 * e);
      B.capsule([sx, gy + 14.6, sz], [hx + sn * 0.8, gy + 10.6, hz + c * 0.8], 0.75, M.pink, 10);
      B.sphere(hx + sn * 1.0, gy + 10.2, hz + c * 1.0, 0.85, M.pink, { seg: 10 });
    }
    // the staff with a lollipop, held on the outer side
    {
      const [hx, hz] = side2(3.3);
      B.cyl(hx + sn * 1.1, gy - 0.3, hz + c * 1.1, 0.22, 19, M.white, { solid: false, seg: 8 });
      B.raw(GEO.cyl(1.7, 1.7, 24), M.icing, mtx(hx + sn * 1.1, gy + 20, hz + c * 1.1, fa, 1, 0.35, 1, Math.PI / 2));
      B.raw(GEO.cyl(1.1, 1.1, 24), M.white, mtx(hx + sn * 1.25, gy + 20, hz + c * 1.25, fa, 1, 0.36, 1, Math.PI / 2));
      cylCollider(hx + sn * 1.1, hz + c * 1.1, 0.35, gy, gy + 19, false);
    }
    // the gumball machine: coin box with a crank, glass globe of gumballs, cap
    B.cyl(x, gy + 15.6, z, 1.9, 1.7, redM, { rTop: 1.6, seg: 16 });
    B.box(x + sn * 1.75, gy + 16, z + c * 1.75, 0.8, 0.9, 0.3, silver, { solid: false, ry: fa });
    B.cyl(x + sn * 2.0, gy + 16.45, z + c * 2.0, 0.35, 0.3, silver, { solid: false, seg: 10, rx: Math.PI / 2, ry: fa });
    B.sphere(x, gy + 20.4, z, 3.5, glass, { seg: 20 });
    for (let k = 0; k < 26; k++) {
      const u = r() * TAU, v = r() * 1.6 - 0.8, d = 2.7 * Math.sqrt(r());
      B.sphere(x + Math.sin(u) * Math.cos(v) * d, gy + 19.4 + Math.sin(v) * d * 0.9, z + Math.cos(u) * Math.cos(v) * d, 0.62, toon(GUM[k % 5]), { seg: 8 });
    }
    B.sphere(x, gy + 23.4, z, 1.9, redM, { sy: 0.55, seg: 14 });
    B.sphere(x, gy + 24.5, z, 0.45, silver, { seg: 8 });
    cylCollider(x, z, 3.4, gy - 0.5, gy + 11);
  }

  // ── the town: rings of candy houses, a ring road, the fountain square ──
  const WALL = [0xffb3d9, 0xfff0b3, 0xb3f0e0, 0xffd1a8, 0xe0c8ff, 0xfff8f0].map((c) => toon(c, { tex: "frosting", scale: 0.35 }));
  const CAPS = [M.choc, toon(0xff7ab8, { tex: "frosting", scale: 0.3 }), toon(0xa0522d, { tex: "frosting", scale: 0.3 }), toon(0xffe07a, { tex: "frosting", scale: 0.3 })];
  const RIM = [M.cream, M.frost, toon(0xfff5c0)];
  const DRIP = [toon(0xffffff), toon(0xffc0e0)];
  const SPRINK = [0xff4f9a, 0x5fd3ff, 0xffd84f, 0x9dff6b, 0xffffff].map((c) => toon(c, { outline: false }));
  const pipe = toon(0x9a8a8a), stepM = toon(0x9fd8a8);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const faceTo = (x, z) => Math.atan2(C.x - x, C.z - z);
  const door = (x, gy, z, fa, rad, h = 1.9) => {
    const dx = x + Math.sin(fa) * rad, dz = z + Math.cos(fa) * rad;
    B.box(dx, gy, dz, 1.15, h, 0.3, M.door, { solid: false, ry: fa, r: 0.1 });
    B.sphere(dx + Math.cos(fa) * 0.35 + Math.sin(fa) * 0.16, gy + h * 0.5, dz - Math.sin(fa) * 0.35 + Math.cos(fa) * 0.16, 0.07, M.gold, { seg: 5 });
    B.box(dx + Math.sin(fa) * 0.45, gy - 0.1, dz + Math.cos(fa) * 0.45, 1.5, 0.22, 0.7, stepM, { solid: false, ry: fa, r: 0.08 });
  };
  const roundWin = (x, y, z, a, rad, rr = 0.42) => {
    const wx = x + Math.sin(a) * rad, wz = z + Math.cos(a) * rad;
    B.sphere(wx, y, wz, rr, M.glassP, { sz: 0.25, ry: a, seg: 10 });
    B.raw(GEO.torus(rr, 0.08, TAU, 14), M.cream, mtx(wx + Math.sin(a) * 0.05, y, wz + Math.cos(a) * 0.05, a));
  };
  const curlyChimney = (x, y, z, h, a) => {
    const pts = [[x, y, z], [x, y + h * 0.6, z], [x + Math.sin(a) * 0.4, y + h * 0.9, z + Math.cos(a) * 0.4], [x + Math.sin(a) * 0.9, y + h, z + Math.cos(a) * 0.9], [x + Math.sin(a) * 1.1, y + h * 0.8, z + Math.cos(a) * 1.1]];
    B.tube(pts, 0.14, pipe, { seg: 12, radial: 6 });
    B.cyl(pts[4][0], pts[4][1] - 0.25, pts[4][2], 0.24, 0.3, pipe, { solid: false, seg: 8 });
  };
  const sprinkles = (x, y, z, rad, n) => {
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, d = rad * Math.sqrt(r()), yy = y + Math.sqrt(Math.max(0, 1 - (d * d) / (rad * rad))) * rad * 0.42;
      B.capsule([x + Math.cos(a) * d, yy, z + Math.sin(a) * d], [x + Math.cos(a) * d + 0.2, yy + 0.05, z + Math.sin(a) * d + 0.1], 0.06, pick(SPRINK), 4);
    }
  };
  const HOUSES = {
    mushroom(x, z, gy, fa, s) {
      const wall = pick(WALL), cap = pick(CAPS), rim = pick(RIM);
      B.cyl(x, gy - 0.3, z, 2.6 * s, 3.4 * s, wall, { seg: 16, rTop: 2.45 * s });
      B.sphere(x, gy + 3.35 * s, z, 3.5 * s, cap, { sy: 0.42, seg: 16 });
      B.raw(GEO.torus(3.25 * s, 0.32 * s, TAU, 24), rim, mtx(x, gy + 3.05 * s, z, 0, 1, 1, 1, Math.PI / 2));
      B.cyl(x, gy + 4.3 * s, z, 1.45 * s, 1.7 * s, wall, { seg: 12, solid: false });
      B.sphere(x, gy + 6.0 * s, z, 2.1 * s, cap, { sy: 0.5, seg: 14 });
      B.raw(GEO.torus(1.9 * s, 0.22 * s, TAU, 18), rim, mtx(x, gy + 5.75 * s, z, 0, 1, 1, 1, Math.PI / 2));
      B.sphere(x, gy + 7.1 * s, z, 0.35 * s, M.cherry, { seg: 8 });
      cylCollider(x, z, 2.6 * s, gy - 0.3, gy + 3.2 * s);
      cylCollider(x, z, 3.3 * s, gy + 3.2 * s, gy + 4.2 * s);
      door(x, gy, z, fa, 2.5 * s);
      B.detail(() => {
        for (const da of [0.9, -0.9, 2.4]) roundWin(x, gy + 1.9 * s, z, fa + da, 2.52 * s);
        for (const da of [0, 2.1, -2.1]) roundWin(x, gy + 5.0 * s, z, fa + da, 1.45 * s, 0.3);
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * TAU + r(), [dx, dz] = [x + Math.sin(a) * 3.3 * s, z + Math.cos(a) * 3.3 * s];
          B.capsule([dx, gy + 3.0 * s, dz], [dx, gy + (2.3 - r() * 0.6) * s, dz], 0.24 * s, pick(DRIP), 6);
        }
        sprinkles(x, gy + 5.95 * s, z, 1.9 * s, 10);
        curlyChimney(x + Math.sin(fa + 2.4) * 1.9 * s, gy + 3.8 * s, z + Math.cos(fa + 2.4) * 1.9 * s, 2.6 * s, fa + 2.4);
      }, 160);
    },
    cupcake(x, z, gy, fa, s) {
      const frost = pick([M.frost, M.cream, toon(0xb8f0ff, { tex: "frosting", scale: 0.3 }), toon(0xfff0a0, { tex: "frosting", scale: 0.3 })]);
      B.cyl(x, gy - 0.3, z, 2.5 * s, 3.8 * s, M.wrap, { rTop: 3.0 * s, seg: 18 });
      for (let k = 0; k < 3; k++) B.raw(GEO.torus((2.8 - k * 0.75) * s, (0.6 - k * 0.08) * s, TAU, 22), frost, mtx(x, gy + (3.8 + k * 0.62) * s, z, 0, 1, 1, 1, Math.PI / 2));
      B.cone(x, gy + 5.2 * s, z, 0.9 * s, 1.3 * s, frost, { seg: 12 });
      B.sphere(x, gy + 6.7 * s, z, 0.5 * s, M.cherry, { seg: 10 });
      cylCollider(x, z, 2.7 * s, gy - 0.3, gy + 4.3 * s);
      door(x, gy, z, fa, 2.55 * s);
      B.detail(() => {
        for (const da of [0.95, -0.95]) roundWin(x, gy + 2.2 * s, z, fa + da, 2.75 * s, 0.38);
        B.cyl(x + 0.3 * s, gy + 6.9 * s, z, 0.04, 0.7 * s, toon(0x3f9a3a), { solid: false, seg: 4, rz: 0.4 });
        sprinkles(x, gy + 4.4 * s, z, 2.3 * s, 14);
      }, 160);
    },
    gumdrop(x, z, gy, fa, s) {
      const m = toon(pick(GUM), { tex: "dots", scale: 0.4 });
      B.cyl(x, gy - 0.3, z, 3.0 * s, 3.6 * s, m, { rTop: 2.1 * s, seg: 16 });
      B.sphere(x, gy + 3.3 * s, z, 2.1 * s, m, { sy: 0.62, seg: 14 });
      cylCollider(x, z, 2.9 * s, gy - 0.3, gy + 4.2 * s);
      door(x, gy, z, fa, 2.8 * s);
      B.detail(() => {
        roundWin(x, gy + 2.3 * s, z, fa + 1.0, 2.55 * s, 0.4);
        roundWin(x, gy + 2.3 * s, z, fa - 1.0, 2.55 * s, 0.4);
        const [cx, cz] = [x + Math.sin(fa + 2.8) * 1.4 * s, z + Math.cos(fa + 2.8) * 1.4 * s];
        B.cyl(cx, gy + 3.5 * s, cz, 0.3 * s, 1.6 * s, toon(0xe0e0e0), { solid: false, seg: 8 });
        for (let i = 0; i < 16; i++) {
          const a = r() * TAU, y = gy + (0.4 + r() * 3.2) * s, rr = lerp(3.0, 2.1, (y - gy) / (3.6 * s)) * s;
          B.sphere(x + Math.sin(a) * rr, y, z + Math.cos(a) * rr, 0.1, M.white, { seg: 4 });
        }
      }, 160);
    },
    cottage(x, z, gy, fa, s) {
      const wall = pick(WALL), w = 4.6 * s, d = 4.0 * s, h = 3.2 * s;
      B.box(x, gy - 0.3, z, w, h + 0.3, d, wall, { ry: fa, r: 0.1 });
      B.gable(x, gy + h, z, d + 1.0, 2.2 * s, w + 0.8, M.choc, fa + Math.PI / 2);
      const c = Math.cos(fa), sn = Math.sin(fa);
      for (const e of [-1, 1]) {
        const ex = x + sn * (d / 2 + 0.45) * e, ez = z + c * (d / 2 + 0.45) * e;
        B.capsule([ex - c * (w / 2 + 0.4), gy + h + 0.05, ez + sn * (w / 2 + 0.4)], [ex + c * (w / 2 + 0.4), gy + h + 0.05, ez - sn * (w / 2 + 0.4)], 0.22, M.cream, 6);
      }
      door(x, gy, z, fa, d / 2);
      B.detail(() => {
        for (const e of [-1, 1]) {
          const wx = x + sn * (d / 2 + 0.02) + c * e * 1.4 * s, wz = z + c * (d / 2 + 0.02) - sn * e * 1.4 * s;
          B.box(wx, gy + 1.3 * s, wz, 0.9 * s, 0.9 * s, 0.12, M.glassP, { solid: false, ry: fa });
          B.box(wx + sn * 0.05, gy + 1.2 * s, wz + c * 0.05, 1.2 * s, 0.14, 0.2, M.cream, { solid: false, ry: fa });
        }
        const [kx, kz] = [x - sn * 0.8 * s + c * 1.3 * s, z - c * 0.8 * s - sn * 1.3 * s];
        B.box(kx, gy + h + 0.6 * s, kz, 0.7 * s, 1.8 * s, 0.7 * s, M.cream, { solid: false, ry: fa });
        B.sphere(x, gy + h + 2.3 * s, z, 0.3 * s, M.cherry, { seg: 8 });
      }, 160);
    },
  };
  // house slots: two rings, skipping the road, the gumball dome and the castle climb
  const dome = at(aG - 0.85, 24);
  const kinds = ["mushroom", "cupcake", "mushroom", "gumdrop", "cottage", "mushroom", "cupcake", "gumdrop"];
  let hk = 0;
  const trees = [];
  for (const [rad, n, off, s] of [[25, 13, 0.3, 0.85], [34.4, 18, 0.0, 1.0]]) {
    for (let k = 0; k < n; k++) {
      const a = aG + ((k + off) / n) * TAU, [x, z] = at(a, rad);
      if (Math.abs(angDiff(a, aG)) < 8 / rad) continue;
      if (Math.hypot(x - dome[0], z - dome[1]) < 6.2 + 3.6 * s + 1.2) continue;
      if (rad < 30 && angDiff(a, aG) > 0 && angDiff(a, aG) < 1.25) continue; // gumdrop stairs
      if (rad > 30 && k % 4 === 2) { trees.push([x, z]); continue; }
      const gy = W.ground(x, z);
      const fa = faceTo(x, z) + (rad < 30 && inLab(a) ? Math.PI : 0); // behind the lab wing they face the ring road
      HOUSES[kinds[hk++ % kinds.length]](x, z, gy, fa, s * (0.92 + r() * 0.16));
    }
  }
  // cotton candy trees with striped trunks in the gaps of the outer ring
  const cotton = [toon(0xff9ad4), toon(0xffb8e2), toon(0xd98fff)], trunkW = toon(0xfff5e0), trunkS = toon(0x9fe0b0);
  for (const [x, z] of trees) {
    const gy = W.ground(x, z), m = pick(cotton), h = 4.2 + r() * 1.5;
    B.branch([[x, gy - 0.3, z], [x + 0.5, gy + h * 0.5, z + 0.3], [x - 0.2, gy + h, z]], 0.42, 0.3, trunkW, 6);
    const pts = [];
    for (let i = 0; i <= 18; i++) { const t = i / 18, a2 = t * TAU * 2.5; pts.push([x + 0.5 * Math.sin(t * Math.PI) + Math.sin(a2) * 0.4, gy + t * h, z + 0.3 * Math.sin(t * Math.PI) + Math.cos(a2) * 0.4]); }
    B.tube(pts, 0.12, trunkS, { seg: 30, radial: 5 });
    for (let k2 = 0; k2 < 5; k2++) B.sphere(x + (r() - 0.5) * 2.4, gy + h + 0.6 + r() * 1.3, z + (r() - 0.5) * 2.4, 1.3 + r() * 0.6, m, { seg: 10 });
    cylCollider(x, z, 0.5, gy - 0.3, gy + h);
  }
  // the ring road, and the fountain square where it meets the main road
  for (let k = 0; k < 76; k++) {
    const a = aG + (k / 76) * TAU, [x, z] = at(a, 29.6);
    if (Math.hypot(x - dome[0], z - dome[1]) < 6.8) continue;
    B.raw(GEO.circle(14), M.road, mtx(x, g + 0.05, z, 0, 1.7, 1.7, 1, -Math.PI / 2));
  }
  {
    const [fx, fz] = at(aG, 29.6);
    B.raw(GEO.circle(32), M.plaza, mtx(fx, g + 0.07, fz, 0, 6.2, 6.2, 1, -Math.PI / 2));
    B.cyl(fx, g, fz, 2.8, 0.85, M.choc, { seg: 24 });
    B.raw(GEO.torus(2.8, 0.25, TAU, 28), M.cream, mtx(fx, g + 0.85, fz, 0, 1, 1, 1, Math.PI / 2));
    B.raw(GEO.circle(24), toon(0x6a3418, { emissive: 0x1a0800, outline: false }), mtx(fx, g + 0.75, fz, 0, 2.55, 2.55, 1, -Math.PI / 2));
    B.cyl(fx, g + 0.8, fz, 0.45, 2.2, M.cream, { seg: 12, solid: false });
    B.cyl(fx, g + 2.9, fz, 1.3, 0.35, M.choc, { seg: 18, rTop: 1.5, solid: false });
    B.cyl(fx, g + 3.2, fz, 0.3, 1.0, M.cream, { seg: 10, solid: false });
    B.sphere(fx, g + 4.35, fz, 0.5, M.choc, { seg: 12 });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      B.capsule([fx + Math.sin(a) * 1.4, g + 3.15, fz + Math.cos(a) * 1.4], [fx + Math.sin(a) * 2.2, g + 0.9, fz + Math.cos(a) * 2.2], 0.14, M.chocD, 6);
    }
    cylCollider(fx, fz, 2.8, g - 0.5, g + 0.85);
    cylCollider(fx, fz, 0.6, g + 0.85, g + 4.4);
    for (const s of [-1, 1]) {
      const [bx, bz] = at(aG + s * 0.2, 29.6), fa = aG + s * Math.PI / 2;
      B.box(bx, g + 0.5, bz, 2.4, 0.16, 0.8, M.throne, { solid: false, ry: fa });
      B.box(bx + Math.sin(fa) * 0.35, g + 0.66, bz + Math.cos(fa) * 0.35, 2.4, 0.7, 0.12, M.throne, { solid: false, ry: fa });
      for (const e of [-1, 1]) B.box(bx + Math.cos(fa) * e, g, bz - Math.sin(fa) * e, 0.16, 0.5, 0.7, M.chocD, { solid: false, ry: fa });
      cylCollider(bx, bz, 0.9, g, g + 0.66, false);
    }
  }
  // candy-cane lamp posts along the main road and around the square
  const caneM = [M.icing, M.white], lampM = M.lamp;
  const lampPost = (x, z, fa) => {
    const gy = W.ground(x, z), h = 4.6, pts = [];
    for (let i = 0; i <= 8; i++) pts.push([x, gy + (i / 8) * h, z]);
    for (let i = 1; i <= 5; i++) {
      const t = (i / 5) * Math.PI;
      pts.push([x + Math.sin(fa) * (0.7 - Math.cos(t) * 0.7), gy + h + Math.sin(t) * 0.7, z + Math.cos(fa) * (0.7 - Math.cos(t) * 0.7)]);
    }
    for (let i = 0; i + 1 < pts.length; i++) B.capsule(pts[i], pts[i + 1], 0.16, caneM[i % 2], 6);
    const [lx, ly, lz] = pts[pts.length - 1];
    B.capsule([lx, ly, lz], [lx, ly - 0.4, lz], 0.03, M.chocD, 4);
    B.sphere(lx, ly - 0.75, lz, 0.38, lampM, { seg: 10 });
    B.cone(lx, ly - 0.5, lz, 0.45, 0.35, M.icing, { seg: 10 });
    cylCollider(x, z, 0.25, gy, gy + h, false);
  };
  for (const t of [20.5, 25, 35, 39, 48, 55]) for (const s of [-1, 1]) {
    const a = aG + s * (3.4 / t), [x, z] = at(a, t);
    lampPost(x, z, aG + s * Math.PI / 2 + Math.PI);
  }

  // ── the people of the Candy Kingdom ──
  const walkers = ["gumdrop", "candycorn", "marshmallow", "jellybean", "cupcake", "cinnamon", "gumdrop", "strawberry", "icecream", "jellybean", "gumdrop", "candycorn"];
  // they stroll back and forth along the ring road, between the square and the gumball dome
  walkers.forEach((kind, i) => W.citizen(kind, { ring: [C.x, C.z, 29.6], arc: [aG + 0.3, aG + 5.1], a: aG + 0.4 + (i / walkers.length) * 4.6, dir: i % 2 ? 1 : -1, speed: 1.3 + (i % 3) * 0.35 }));
  // people chatting in the square and by their doors
  const standers = [["cupcake", 3.8, 0.3], ["marshmallow", 3.6, -0.3], ["gumdrop", 4.4, 0.55], ["strawberry", 4.2, -0.6], ["icecream", 4.6, 0.95], ["candycorn", 4.3, -1.0]];
  standers.forEach(([kind, d, da], i) => {
    const [fx, fz] = at(aG, 29.6), dir = aG + (i % 2 ? -1 : 1) * Math.PI / 2 + da * 0.8;
    const x = fx + Math.sin(dir) * d, z = fz + Math.cos(dir) * d;
    W.citizen(kind, { x, z, yaw: Math.atan2(fx - x, fz - z) });
  });
  for (const [kind, a, rad] of [["gumdrop", aG + 2.3, 21.5], ["jellybean", aG - 2.0, 21.6], ["marshmallow", aG + 3.3, 21.4], ["cinnamon", aG - 1.4, 37.3], ["gumdrop", aG + 1.6, 37.4]]) {
    const [x, z] = at(a, rad);
    W.citizen(kind, { x, z, yaw: a + Math.PI });
  }
  // a few walking the road out to the gate
  for (let i = 0; i < 4; i++) {
    const s = i % 2 ? 1 : -1;
    W.citizen(["gumdrop", "jellybean", "candycorn", "gumdrop"][i], { line: [...at(aG + s * (4.3 / 21), 21), ...at(aG + s * (4.3 / 38), 38)], t: i / 4, speed: 1.4 });
  }

  // ── giant cupcakes (bonus treasure) ──
  {
    const cx = P.cupcake.x, cz = P.cupcake.z, cg = W.ground(cx, cz);
    B.cyl(cx - 9, cg - 0.5, cz, 2.2, 2.3, M.wrap, { rTop: 2.6, seg: 18 });
    for (let k = 0; k < 3; k++) B.raw(GEO.torus(2.4 - k * 0.6, 0.45, TAU, 20), M.frost, mtx(cx - 9, cg + 1.95 + k * 0.4, cz, 0, 1, 1, 1, Math.PI / 2));
    B.cyl(cx, cg - 0.5, cz, 4.5, 4.4, M.wrap, { rTop: 5.2, seg: 22 });
    cylCollider(cx, cz, 5.4, cg + 3.9, cg + 4.5);
    for (let k = 0; k < 4; k++) B.raw(GEO.torus(5.0 - k * 1.1, 0.75, TAU, 28), M.frost, mtx(cx, cg + 4.3 + k * 0.55, cz, 0, 1, 1, 1, Math.PI / 2));
    B.sphere(cx - 1.8, cg + 6.4, cz - 1.8, 0.9, M.cherry);
    for (let i = 0; i < 24; i++) {
      const a = r() * TAU, d = 1 + r() * 3.5;
      B.capsule([cx + Math.cos(a) * d, cg + 4.9, cz + Math.sin(a) * d], [cx + Math.cos(a) * d + 0.2, cg + 5.0, cz + Math.sin(a) * d + 0.15], 0.08, toon(GUM[i % 5], { outline: false }), 4);
    }
    W.treasure("cupcake", cx + 1.5, cg + 4.5, cz + 1.5);
    W.course("cupcake", { x: cx - 14, z: cz }, [{ x: cx - 9, z: cz, y: cg + 1.8 }, { x: cx - 1, z: cz, y: cg + 4.5 }], "cupcake");
    SPIRITS.push({ x: cx - 1.8, y: cg + 4.5, z: cz + 1.6 }); // a spirit on top of the big one
  }
  // the other runaway spirits: in Bubblegum's lab, on its roof (up the gumdrops), by the fountain,
  // behind the castle on the ring road
  {
    const [lx, lz] = at(LAB.a - 0.15, 15.2), roof = cp(aG + 1.0, 15.2, g + 6), [qx, qz] = at(aG, 29.6), [bx, bz] = at(aG + Math.PI, 29.6);
    SPIRITS.unshift({ x: lx, y: g, z: lz }, { x: roof.x, y: roof.y, z: roof.z }, { x: qx + Math.sin(aG + Math.PI / 2) * 4.4, y: g, z: qz + Math.cos(aG + Math.PI / 2) * 4.4 }, { x: bx, y: g, z: bz });
  }
  return { gateAngle: aG };
}

// ── canvas pictures (no words) ──
function paintCrown(c, w, h) {
  c.clearRect(0, 0, w, h);
  c.fillStyle = "#f6c343";
  c.strokeStyle = "#7a4a10";
  c.lineWidth = 6;
  c.beginPath();
  c.moveTo(w * 0.15, h * 0.75);
  c.lineTo(w * 0.12, h * 0.3);
  c.lineTo(w * 0.32, h * 0.5);
  c.lineTo(w * 0.5, h * 0.2);
  c.lineTo(w * 0.68, h * 0.5);
  c.lineTo(w * 0.88, h * 0.3);
  c.lineTo(w * 0.85, h * 0.75);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = "#4fc3f7";
  c.beginPath();
  c.arc(w * 0.5, h * 0.62, w * 0.07, 0, 7);
  c.fill();
}
function paintChalkboard(c, w, h) { // equations in chalk, like the board in "Slumber Party Panic"
  c.fillStyle = "#2f6a4a";
  c.fillRect(0, 0, w, h);
  c.fillStyle = "#f4f4ea";
  c.strokeStyle = "#f4f4ea";
  c.lineWidth = 3;
  c.lineCap = "round";
  const fs = Math.round(h * 0.11);
  c.font = `${fs}px sans-serif`;
  c.fillText("B=Δ(f(x)<5>)+3", w * 0.05, h * 0.18);
  c.fillText("C=4,375", w * 0.62, h * 0.14);
  c.beginPath(); c.moveTo(w * 0.62, h * 0.18); c.lineTo(w * 0.9, h * 0.18); c.stroke();
  c.fillText("√(A+D+Q)", w * 0.63, h * 0.29);
  c.fillText("Σx/π(A+Q)", w * 0.05, h * 0.36);
  c.fillText("yπ(Φ)÷(C+D)=X→C5", w * 0.05, h * 0.55);
  c.fillText("Σx/(n+1) > x < Y", w * 0.05, h * 0.73);
  c.font = `bold ${Math.round(h * 0.14)}px sans-serif`;
  c.fillText("X =", w * 0.1, h * 0.92);
  // a molecule and a little triangle in the corner
  for (const [x, y, rr] of [[0.76, 0.5, 11], [0.86, 0.62, 9], [0.7, 0.66, 8]]) { c.beginPath(); c.arc(w * x, h * y, rr, 0, 7); c.stroke(); }
  c.beginPath(); c.moveTo(w * 0.76, h * 0.5 + 11); c.lineTo(w * 0.72, h * 0.66 - 8); c.moveTo(w * 0.76 + 10, h * 0.5 + 5); c.lineTo(w * 0.86 - 8, h * 0.62 - 5); c.stroke();
  c.beginPath(); c.moveTo(w * 0.8, h * 0.9); c.lineTo(w * 0.9, h * 0.9); c.lineTo(w * 0.85, h * 0.78); c.closePath(); c.stroke();
}
function paintShowerSign(c, w, h) { // an emergency shower pictogram: a figure under a shower head
  c.fillStyle = "#1f9a4a";
  c.fillRect(0, 0, w, h);
  c.fillStyle = "#ffffff";
  c.fillRect(w * 0.45, h * 0.08, w * 0.1, h * 0.12);
  c.beginPath(); c.moveTo(w * 0.3, h * 0.28); c.lineTo(w * 0.7, h * 0.28); c.lineTo(w * 0.58, h * 0.18); c.lineTo(w * 0.42, h * 0.18); c.closePath(); c.fill();
  for (let i = 0; i < 5; i++) c.fillRect(w * (0.34 + i * 0.075), h * (0.34 + (i % 2) * 0.04), w * 0.03, h * 0.08);
  c.beginPath(); c.arc(w * 0.5, h * 0.55, w * 0.07, 0, 7); c.fill();
  c.fillRect(w * 0.43, h * 0.63, w * 0.14, h * 0.2);
  c.fillRect(w * 0.43, h * 0.83, w * 0.05, h * 0.12);
  c.fillRect(w * 0.52, h * 0.83, w * 0.05, h * 0.12);
  c.strokeStyle = "#ffffff";
  c.lineWidth = 4;
  c.strokeRect(3, 3, w - 6, h - 6);
}
