// The Ice Kingdom: the Ice King's mountain (a faceted ice pyramid with a face), which is
// hollow at the bottom: a tunnel through the front facet leads into his domed hall (throne,
// leopard-print bed, drum kit, bookcase with a treasure on top, a hanging princess cage,
// penguins everywhere); the ice-ledge climb to the mouth; little ice peaks; frozen pillars.
import * as THREE from "three";
import { toon } from "./toon.js";
import { GEO, mtx, pictures } from "./builder.js";
import { boxCollider, cylCollider, ringCollider } from "./physics.js";
import { P, rng } from "./terrain.js";

const TAU = Math.PI * 2;

/**
 * The Ice Crown: the arena on the mountain top where the Ice King fight happens (boss.js). y: its
 * floor (set when the world is built); r: how far from the middle Finn can walk; gate: [angle, width]
 * of the way in; landing: the last ice ledge outside the gate (where Finn wakes up if he faints in the fight).
 */
export const CROWN = { x: P.ice.x, z: P.ice.z, y: 0, r: 13.6, wall: 15, gate: [0, 0], landing: null };
/** Where the Ice King's runaway penguins wait to be rescued (quest.js): { x, y, z, yaw }. */
export const PENGUINS = [];

/**
 * A pyramid with `sides` flat facets, a facet centred on +z; `hole` cuts a doorway [u0, u1] × [0, v1]
 * out of it; `cut` (0..1 of the height) slices the top off flat.
 */
function facetGeo(R, H, sides, facets, hole, cut = 1) {
  const pos = [], rot = -Math.PI / sides;
  const V = (a) => [Math.sin(a) * R, 0, Math.cos(a) * R];
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const tri = (a, b, c) => pos.push(...a, ...b, ...c);
  const quad = (a, b, c, d) => { tri(a, b, c); tri(a, c, d); };
  for (const i of facets) {
    const B0 = V(rot + (i / sides) * TAU), B1 = V(rot + ((i + 1) / sides) * TAU), A = [0, H, 0];
    const Pt = (u, v) => lerp3(lerp3(B0, A, v), lerp3(B1, A, v), u);
    // counter-clockwise seen from outside: across (u) then up (v)
    const top = (v) => (cut < 1 ? quad(Pt(0, v), Pt(1, v), Pt(1, cut), Pt(0, cut)) : tri(Pt(0, v), Pt(1, v), A));
    if (i !== 0 || !hole) {
      top(0);
      continue;
    }
    const [u0, u1, v1] = hole;
    top(v1);
    tri(Pt(0, 0), Pt(u0, 0), Pt(u0, v1));
    tri(Pt(0, 0), Pt(u0, v1), Pt(0, v1));
    tri(Pt(u1, 0), Pt(1, 0), Pt(1, v1));
    tri(Pt(u1, 0), Pt(1, v1), Pt(u1, v1));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export function buildIce(B, W) {
  const I = P.ice, g = W.ground(I.x, I.z), r = rng(7007);
  const M = {
    ice: toon(0x8fcdf2, { flat: true, tex: "shards", scale: 0.045 }),
    iceD: toon(0x5aa4de, { flat: true, tex: "shards", scale: 0.05 }),
    iceL: toon(0xc4e9fc, { flat: true, tex: "ice", scale: 0.15 }),
    iceP: toon(0xb0e2ff, { flat: true, tex: "shards", scale: 0.2 }),
    snow: toon(0xffffff, { tex: "frosting", scale: 0.2 }),
    dark: toon(0x1d2d4f),
    cloud: toon(0xffffff),
    // inside
    hall: toon(0x7fc4f0, { flat: true, tex: "shards", scale: 0.08, side: THREE.BackSide, outline: false }),
    floor: toon(0xcdeeff, { tex: "shards", scale: 0.12 }),
    tunnel: toon(0x4f8fd0, { flat: true, tex: "shards", scale: 0.15 }),
    crystal: toon(0x9ae4ff, { flat: true, emissive: 0x1a4a6a }),
    leopard: toon(0xf2c14a, { tex: "spots", scale: 0.7 }),
    white: toon(0xf4f8ff), red: toon(0xd8283a), gold: toon(0xf6c343, { emissive: 0x3a2800 }),
    steel: toon(0xc8d0da), wood: toon(0x7fb8e0, { flat: true, tex: "ice", scale: 0.3 }),
    navy: toon(0x1b2530), cream: toon(0xfff4d6), orange: toon(0xffa51f), black: toon(0x151518),
    book: [toon(0x3f6fd0), toon(0xd04a6a), toon(0x5fbf6a), toon(0xe8b84a), toon(0x8a5ad0)],
  };
  const H = 58, RB = 24, rAt = (y) => RB * (1 - y / H);
  // the mountain: seven facets in two blues, the front one with the doorway; its top is cut off flat
  // under the Ice Crown
  const door = [0.38, 0.62, 6.5 / (H + 1)], cut = 46 / (H + 1);
  B.raw(facetGeo(RB, H + 1, 7, [0, 2, 4, 6], door, cut), M.ice, mtx(I.x, g - 1, I.z));
  B.raw(facetGeo(RB, H + 1, 7, [1, 3, 5], null, cut), M.iceD, mtx(I.x, g - 1, I.z));
  // colliders: solid bands up high, a thick shell around the hall down low, the tunnel
  for (let y = 12; y < 44; y += 4) cylCollider(I.x, I.z, RB * (1 - (y + 4) / H) * 0.9, g + y - 1, g + y + 4);
  for (const [y, inner] of [[0, 15.5], [4, 15.5], [8, 12]]) {
    const Rb = RB * (1 - (y + 4) / H) * 0.9;
    ringCollider(I.x, I.z, (Rb + inner) / 2, Rb - inner, g + y - 1, g + y + 4, [[0, 0.62]]);
  }
  ringCollider(I.x, I.z, 15.2, 1.2, g - 1, g + 8, [[0, 0.44]]);
  cylCollider(I.x, I.z, 13, g + 12.8, g + 16);
  const tz0 = I.z + 14.3, tz1 = I.z + 21.5;
  for (const s of [-1, 1]) boxCollider(I.x + s * 2.5 - (s < 0 ? 1.2 : 0), I.x + s * 2.5 + (s > 0 ? 1.2 : 0), g - 1, g + 7, tz0, tz1);
  boxCollider(I.x - 3.7, I.x + 3.7, g + 5.5, g + 7.5, tz0, tz1);
  // the face
  for (const s of [-1, 1]) B.sphere(I.x + s * 1.9, g + 42.5, I.z + rAt(42.5) * 0.9, 0.9, M.dark, { sx: 0.8, sy: 1.4, sz: 0.5 });
  B.sphere(I.x, g + 35.6, I.z + rAt(35.6) * 0.9, 1.9, M.dark, { sx: 1.25, sy: 1.1, sz: 0.5 });
  B.cyl(I.x, g + 33.4, I.z + 11.2, 2.8, 0.6, M.iceL, { seg: 6 });
  W.treasure("icecastle", I.x, g + 34, I.z + 11.6);
  // the doorway: a tunnel of dark ice, icicles hanging over the entrance
  {
    const zc = (tz0 + tz1) / 2, L = tz1 - tz0;
    for (const s of [-1, 1]) B.box(I.x + s * 2.65, g - 0.2, zc, 0.3, 6.0, L, M.tunnel, { solid: false });
    B.box(I.x, g + 5.5, zc, 5.6, 0.3, L, M.tunnel, { solid: false });
    B.box(I.x, g + 0.01, zc, 5.0, 0.04, L, M.floor, { solid: false });
    const fz = I.z + rAt(0) * Math.cos(Math.PI / 7) - 0.4;
    for (let k = 0; k < 7; k++) B.cone(I.x - 2.4 + k * 0.8, g + 4.4 - (k % 2) * 0.4, fz, 0.2, 1.2 + (k % 3) * 0.3, M.iceL, { rx: Math.PI, seg: 5 });
  }
  W.npc("iceking", I.x + 4.4, I.z + 27, 0);
  W.npc("gunter", I.x + 6.2, I.z + 27.8, -0.3);
  // spiral of ice ledges up to the face
  const ledges = [];
  let a = 0;
  for (let k = 0; k < 20; k++) {
    const top = g + 1.6 + k * 1.64, rad = rAt(top - g) + 3.2;
    if (k > 0) a += 4.3 / rad;
    ledges.push({ top, rad, a });
  }
  const shift = -0.45 - a, icePts = [];
  for (const l of ledges) {
    const la = l.a + shift, x = I.x + Math.sin(la) * l.rad, z = I.z + Math.cos(la) * l.rad;
    icePts.push({ x, z, y: l.top });
    B.cyl(x, l.top - 0.7, z, 1.5, 0.7, M.iceL, { seg: 6 });
    for (let i = 0; i < 3; i++) {
      const ia = (i / 3) * TAU + la;
      B.cone(x + Math.sin(ia) * 1.0, l.top - 1.6, z + Math.cos(ia) * 1.0, 0.25, 0.9, M.iceL, { rx: Math.PI, seg: 5 });
    }
  }
  {
    const s = ledges[0], sa = s.a + shift;
    W.course("montanha-de-gelo", { x: I.x + Math.sin(sa) * (s.rad + 3.5), z: I.z + Math.cos(sa) * (s.rad + 3.5) },
      [...icePts, { x: I.x, z: I.z + 11.4, y: g + 34 }], "icecastle");
  }
  const ledgePt = (k) => icePts[k];

  // ── the Ice Crown on the summit: the arena of the Ice King fight (boss.js) ──
  // A round floor of packed snow ringed by an ice band with seven crystal points (the front one the
  // tallest) and three red gems: the mountain wears the Ice King's own crown. The floor overhangs
  // the cut-off peak on a funnel of dark ice with icicles round its rim.
  const CY = g + 46, CR = 15.6, gateA = 2.244, gateW = 0.36;
  Object.assign(CROWN, { y: CY, gate: [gateA, gateW] });
  // the climb goes on from the mouth: eight more ledges spiralling out past the rim, up to the gate
  const up = [], n = 8, a0 = 0.36, rads = [...Array(n)].map((_, k) => 12.6 + (5 * k) / (n - 1));
  const inv = rads.slice(1).reduce((s, rr) => s + 1 / rr, 0);
  for (let k = 0, la = a0; k < n; k++) {
    if (k) la += (gateA - a0) / (inv * rads[k]);
    const top = g + 34 + ((CY - 1.5 - g - 34) * (k + 1)) / n, x = I.x + Math.sin(la) * rads[k], z = I.z + Math.cos(la) * rads[k];
    up.push({ x, z, y: top, a: la });
    B.cyl(x, top - 0.7, z, 1.5, 0.7, M.iceL, { seg: 6 });
    for (let i = 0; i < 3; i++) {
      const ia = (i / 3) * TAU + la;
      B.cone(x + Math.sin(ia) * 1.0, top - 1.6, z + Math.cos(ia) * 1.0, 0.25, 0.9, M.iceL, { rx: Math.PI, seg: 5 });
    }
  }
  CROWN.landing = up[n - 1];
  // from up there only what the summit's haze lets through is drawn (main.js thickens the fog)
  W.sealed(I.x, I.z, 24, CY - 4, CY + 40, 280);
  const inside = { x: I.x + Math.sin(gateA) * 11, z: I.z + Math.cos(gateA) * 11, y: CY };
  W.course("coroa-de-gelo", { x: I.x, z: I.z + 11.2, y: g + 34 }, [...up, inside]);
  // floor, funnel, snow
  B.cyl(I.x, CY - 1.4, I.z, CR, 1.4, M.iceL, { seg: 21 });
  B.cyl(I.x, CY - 6.5, I.z, 6.2, 5.1, M.iceD, { rTop: CR - 0.3, seg: 21, solid: false });
  B.cyl(I.x, CY - 0.02, I.z, CR - 1.1, 0.07, M.snow, { seg: 36, solid: false });
  // a big snowflake inlaid in the middle of the floor
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU, c = Math.cos(a), s = Math.sin(a);
    B.box(I.x + s * 2.6, CY + 0.03, I.z + c * 2.6, 0.32, 0.04, 5.2, M.iceL, { ry: a, solid: false, r: 0.01 });
    for (const f of [-1, 1]) {
      const b = a + f * 0.5, bx = I.x + s * 3.4 + Math.sin(b) * 0.55, bz = I.z + c * 3.4 + Math.cos(b) * 0.55;
      B.box(bx, CY + 0.03, bz, 0.26, 0.04, 1.3, M.iceL, { ry: b, solid: false, r: 0.01 });
    }
  }
  // the band: open at the gate, framed there by two tall crystal pillars; walls high enough that
  // not even a double jump clears them
  B.lathe([[CR + 0.02, -0.3], [CR + 0.02, 1.45], [CR - 0.15, 1.75], [CR - 0.85, 1.75], [CR - 1.1, 1.45], [CR - 1.1, 0.02]], M.iceP, I.x, CY, I.z,
    { seg: 42, ps: gateA + gateW / 2, pl: TAU - gateW });
  ringCollider(I.x, I.z, CROWN.wall, 1.1, CY, CY + 4.2, [[gateA, gateW]], false);
  for (const s of [-1, 1]) {
    const a = gateA + (s * gateW) / 2, x = I.x + Math.sin(a) * CROWN.wall, z = I.z + Math.cos(a) * CROWN.wall;
    B.cyl(x, CY - 0.2, z, 0.95, 5.6, M.iceL, { rTop: 0.7, seg: 6 });
    B.cone(x, CY + 5.4, z, 0.75, 2.2, M.iceP, { seg: 6 });
  }
  // the seven points and the gems
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU, h = i === 0 ? 10.5 : i === 1 || i === 6 ? 7.5 : 6, rb = i === 0 ? 1.6 : 1.25;
    B.cone(I.x + Math.sin(a) * CROWN.wall, CY + 1.6, I.z + Math.cos(a) * CROWN.wall, rb, h, M.iceL, { seg: 5, ry: a });
  }
  const gem = toon(0xd81f2a, { emissive: 0x3a0006, flat: true });
  for (const a of [-0.55, 0, 0.55]) {
    const x = I.x + Math.sin(a) * (CR + 0.1), z = I.z + Math.cos(a) * (CR + 0.1);
    B.raw(new THREE.OctahedronGeometry(1), gem, mtx(x, CY + 0.2, z, a, a ? 0.75 : 1, a ? 1.0 : 1.3, 0.45));
  }
  // icicles round the rim (not over the ledges) and snow drifts along the band
  for (let k = 0; k < 22; k++) {
    const a = (k / 22) * TAU + 0.1;
    if (up.some((l) => l.y > CY - 6 && Math.abs(Math.atan2(Math.sin(a - l.a), Math.cos(a - l.a))) < 0.4)) continue;
    B.cone(I.x + Math.sin(a) * (CR - 0.5), CY - 1.4 - 1.3 - (k % 3) * 0.5, I.z + Math.cos(a) * (CR - 0.5), 0.45, 1.3 + (k % 3) * 0.5 + 0.1, M.iceL, { rx: Math.PI, seg: 5 });
  }
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * TAU + 0.2;
    if (Math.abs(Math.atan2(Math.sin(a - gateA), Math.cos(a - gateA))) < 0.4) continue;
    B.sphere(I.x + Math.sin(a) * 14.1, CY + 0.05, I.z + Math.cos(a) * 14.1, 0.9 + (k % 3) * 0.25, M.snow, { sy: 0.35, seg: 8 });
  }

  // the runaway penguins (quest.js): on a ledge of the climb, behind the mountain, out east and west
  // on the slopes, on an ice cube by the frozen pillars (added below)
  {
    const l = ledgePt(10);
    PENGUINS.push({ x: l.x, y: l.y, z: l.z, yaw: Math.atan2(l.x - I.x, l.z - I.z) });
    for (const [dx, dz] of [[9, -41], [66, 26], [-60, -2]]) {
      const x = I.x + dx, z = I.z + dz;
      PENGUINS.push({ x, y: W.ground(x, z), z, yaw: Math.atan2(I.x - x, I.z - z) });
    }
  }
  // sea of clouds around the base (leaving the doorway clear)
  for (let k = 0; k < 22; k++) {
    const ca = (k / 22) * TAU + r() * 0.2, d = 27 + r() * 8;
    if (Math.abs(Math.atan2(Math.sin(ca), Math.cos(ca))) < 0.4) continue;
    B.sphere(I.x + Math.sin(ca) * d, g + 0.3, I.z + Math.cos(ca) * d, 2.6 + r() * 2.2, M.cloud, { sy: 0.45 });
  }

  // ── inside: the Ice King's hall ──
  const HR = 14.6, hall = [[HR, 0], [HR, 7], [13.4, 9.6], [10.3, 12.1], [5.5, 13.6], [0.01, 14.1]];
  B.lathe(hall, M.hall, I.x, g, I.z, { seg: 9, ps: 0.19, pl: TAU - 0.38 });
  B.lathe(hall.slice(1), M.hall, I.x, g, I.z, { seg: 1, ps: -0.19, pl: 0.38 });
  B.box(I.x, g + 5.3, I.z + HR - 0.1, 5.6, 1.9, 0.4, M.hall, { solid: false });
  B.raw(GEO.circle(36), M.floor, mtx(I.x, g + 0.04, I.z, 0, HR, HR, 1, -Math.PI / 2));
  W.sealed(I.x, I.z, HR - 0.3, g - 1, g + 14, 55);
  const at = (a, rr) => [I.x + Math.sin(a) * rr, I.z + Math.cos(a) * rr];
  const pics = [];
  B.inside(I.x, I.z, 45, () => {
    // the round dais with the ice throne, facing the door
    B.cyl(I.x, g, I.z - 2, 5.2, 0.3, M.iceP, { seg: 9 });
    B.cyl(I.x, g + 0.3, I.z - 2, 4.2, 0.3, M.iceP, { seg: 9 });
    B.box(I.x, g + 0.6, I.z - 3.4, 2.0, 0.9, 1.6, M.crystal, { r: 0.1 });
    B.box(I.x, g + 0.6, I.z - 4.3, 2.4, 3.6, 0.5, M.crystal, { solid: false, r: 0.1 });
    for (let k = 0; k < 5; k++) B.cone(I.x - 1.0 + k * 0.5, g + 4.2, I.z - 4.3, 0.22, k === 2 ? 1.4 : 0.9, M.crystal, { seg: 4 });
    boxCollider(I.x - 1.2, I.x + 1.2, g + 0.6, g + 4.2, I.z - 4.55, I.z - 4.05);
    for (const s of [-1, 1]) B.box(I.x + s * 1.1, g + 0.6, I.z - 3.4, 0.3, 1.6, 1.6, M.crystal, { solid: false, r: 0.08 });
    // leopard-print bed against the back wall
    {
      const [bx, bz] = at(Math.PI + 0.55, 12.2), a = Math.PI + 0.55;
      B.box(bx, g, bz, 3.0, 0.7, 4.2, M.white, { ry: a, r: 0.12 });
      B.box(bx, g + 0.7, bz, 2.9, 0.45, 4.0, M.leopard, { solid: false, ry: a, r: 0.18 });
      const [px, pz] = at(a, 13.0);
      B.box(px, g + 1.1, pz, 1.8, 0.4, 0.8, M.white, { solid: false, ry: a, r: 0.18 });
      B.box(px + Math.sin(a) * 0.45, g, pz + Math.cos(a) * 0.45, 3.2, 2.4, 0.3, M.white, { solid: false, ry: a, r: 0.12 });
    }
    // the drum kit: bass drum, snare, tom, two cymbals, a stool
    {
      const [dx, dz] = at(2.1, 9.8), a = 2.1 + Math.PI;
      B.cyl(dx, g + 1.0, dz, 1.0, 0.8, M.red, { seg: 16, rx: Math.PI / 2, ry: a, solid: false });
      B.cyl(dx + Math.sin(a) * 0.42, g + 1.0, dz + Math.cos(a) * 0.42, 0.85, 0.04, M.white, { seg: 16, rx: Math.PI / 2, ry: a, solid: false });
      cylCollider(dx, dz, 1.0, g, g + 1.9, false);
      const side = (o, f = 0) => [dx + Math.cos(a) * o + Math.sin(a) * f, dz - Math.sin(a) * o + Math.cos(a) * f];
      for (const [o, f, h, rr] of [[1.3, 0.4, 1.3, 0.45], [-0.3, 0.2, 2.0, 0.35]]) {
        const [x, z] = side(o, f);
        B.cyl(x, g, z, 0.04, h, M.steel, { solid: false, seg: 4 });
        B.cyl(x, g + h, z, rr, 0.35, M.red, { solid: false, seg: 12 });
        B.cyl(x, g + h + 0.35, z, rr, 0.03, M.white, { solid: false, seg: 12 });
      }
      for (const [o, f, h] of [[-1.4, 0.3, 2.5], [1.6, -0.3, 2.3]]) {
        const [x, z] = side(o, f);
        B.cyl(x, g, z, 0.04, h, M.steel, { solid: false, seg: 4 });
        B.cyl(x, g + h, z, 0.7, 0.04, M.gold, { solid: false, seg: 14, rz: 0.15 });
      }
      const [sx, sz] = side(0, -1.5);
      B.cyl(sx, g, sz, 0.35, 0.7, M.navy, { seg: 10, cam: false });
    }
    // the bookcase (treasure on top) and two ice cubes to climb it
    {
      const aS = -2.0, [bx, bz] = at(aS, 12.8), c = Math.cos(aS), s = Math.sin(aS);
      B.box(bx, g, bz, 3.2, 4.2, 0.9, M.wood, { ry: aS, r: 0.06, solid: false });
      boxCollider(bx - 1.05, bx + 1.05, g, g + 4.2, bz - 1.6, bz + 1.6);
      for (let row = 0; row < 3; row++) for (let k = 0; k < 7; k++) {
        const o = (k - 3) * 0.4 + (row % 2) * 0.1, x = bx + c * o - s * 0.42, z = bz - s * o - c * 0.42;
        B.box(x, g + 0.35 + row * 1.3, z, 0.26, 0.9 + ((k * 3 + row) % 3) * 0.1, 0.6, M.book[(k + row) % 5], { solid: false, ry: aS });
      }
      W.treasure("iceshelf", bx, g + 4.2, bz);
      const cube = (o, rr, top, size) => {
        const [x, z] = at(aS + o / rr, rr);
        B.box(x, g, z, size, top, size, M.iceP, { r: 0.12 });
        return { x, z, y: g + top };
      };
      const c1 = cube(1.8, 8.4, 1.3, 1.5), c2 = cube(0.2, 10.2, 2.7, 1.5);
      W.course("castelo-gelado", { x: I.x - 2, z: I.z + 11, y: g }, [{ x: I.x - 5, z: I.z + 6.5, y: g }, { x: I.x - 7.4, z: I.z + 2.4, y: g }, c1, c2, { x: bx, z: bz, y: g + 4.2 }], "iceshelf");
    }
    // the princess cage hanging from the dome (empty: the princesses escaped again)
    {
      const [cx, cz] = at(0.6, 9.5), y0 = g + 3.0, h = 2.6;
      B.cyl(cx, y0, cz, 1.25, 0.2, M.gold, { seg: 16, solid: false });
      B.cyl(cx, y0 + h, cz, 1.25, 0.15, M.gold, { seg: 16, solid: false });
      B.sphere(cx, y0 + h + 0.1, cz, 1.25, M.gold, { sy: 0.45, seg: 14 });
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * TAU;
        B.cyl(cx + Math.sin(a) * 1.18, y0, cz + Math.cos(a) * 1.18, 0.04, h, M.gold, { solid: false, seg: 4 });
      }
      B.cyl(cx, y0 + h + 0.6, cz, 0.05, g + 12.6 - (y0 + h + 0.6), M.steel, { solid: false, seg: 4 });
      B.cyl(cx, y0 + 0.2, cz, 0.3, 0.2, M.gold, { solid: false, seg: 10 });
      for (let k = 0; k < 5; k++) B.cone(cx + Math.sin(k * 1.26) * 0.25, y0 + 0.4, cz + Math.cos(k * 1.26) * 0.25, 0.07, 0.2, M.gold, { seg: 4 });
    }
    // a table with a wrapped present, swords on the wall, the diamond mirror
    {
      const [tx, tz] = at(0.95, 11.6);
      B.cyl(tx, g, tz, 0.12, 1.0, M.wood, { seg: 6, solid: false });
      B.cyl(tx, g + 1.0, tz, 1.0, 0.12, M.wood, { seg: 9, solid: false });
      cylCollider(tx, tz, 1.0, g, g + 1.12, false);
      B.box(tx, g + 1.12, tz, 0.6, 0.5, 0.6, M.red, { solid: false, r: 0.04 });
      B.box(tx, g + 1.12, tz, 0.63, 0.53, 0.12, M.gold, { solid: false });
      B.box(tx, g + 1.12, tz, 0.12, 0.53, 0.63, M.gold, { solid: false });
      for (let k = 0; k < 3; k++) {
        const a = -1.173 + (k - 1) * 0.07, [x, z] = at(a, 13.62), y = g + 1.8 + (k === 1 ? 0.3 : 0);
        B.box(x, y, z, 0.14, 1.6, 0.05, M.steel, { solid: false, ry: a });
        B.cone(x, y - 0.25, z, 0.07, 0.25, M.steel, { seg: 4, rx: Math.PI, ry: a });
        B.box(x, y + 1.6, z, 0.55, 0.1, 0.12, M.gold, { solid: false, ry: a });
        B.box(x, y + 1.7, z, 0.1, 0.45, 0.1, M.navy, { solid: false, ry: a });
        B.sphere(x, y + 2.2, z, 0.09, M.gold, { seg: 6 });
      }
      const ma = 1.83, [mx, mz] = at(ma, 13.65);
      B.box(mx, g + 2.2, mz, 1.5, 1.5, 0.12, M.iceL, { solid: false, ry: ma, rz: Math.PI / 4, r: 0.1 });
      B.box(mx - Math.sin(ma) * 0.05, g + 2.35, mz - Math.cos(ma) * 0.05, 1.2, 1.2, 0.08, toon(0xe8f8ff, { emissive: 0x3a6a8a }), { solid: false, ry: ma, rz: Math.PI / 4 });
    }
    // posters on the walls
    // (the hall has nine flat walls: pictures go at their centres, 13.8 from the middle)
    for (const [a, w, h, draw] of [[-1.829, 1.5, 2.0, paintBlueprint], [2.486, 1.4, 1.9, paintPrincess], [-2.485, 1.3, 1.3, paintHeart]]) {
      const [x, z] = at(a, 13.74);
      pics.push({ x, y: g + 3.2, z, ry: a + Math.PI, w, h, draw });
    }
    // icicles from the dome, crystal clusters, snow drifts
    for (let k = 0; k < 26; k++) {
      const a = r() * TAU, d = 2 + r() * 10, y = d < 5.5 ? 13.4 : d < 10 ? 12 : 9.5;
      B.cone(I.x + Math.sin(a) * d, g + y - 1.8 - r(), I.z + Math.cos(a) * d, 0.2 + r() * 0.2, 1.8 + r() * 1.2, M.iceL, { rx: Math.PI, seg: 5 });
    }
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * TAU + 0.35;
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.5) continue;
      const [x, z] = at(a, 13.3);
      for (let i = 0; i < 3; i++) B.cone(x + (r() - 0.5), g - 0.2, z + (r() - 0.5), 0.35 + r() * 0.2, 1.4 + r() * 1.6, M.crystal, { seg: 5, rx: (r() - 0.5) * 0.5, rz: (r() - 0.5) * 0.5 });
      cylCollider(x, z, 0.7, g, g + 1.5, false);
    }
    // penguins everywhere
    const peng = (x, z, a, s, g0 = g) => {
      const g = g0;
      B.lathe([[0.01, 0.02], [0.14, 0.03], [0.2, 0.1], [0.215, 0.22], [0.2, 0.36], [0.16, 0.46], [0.09, 0.52], [0.01, 0.54]].map(([rr, h]) => [rr * s, h * s]), M.navy, x, g, z, { seg: 10 });
      const f = (d) => [x + Math.sin(a) * d, z + Math.cos(a) * d];
      const [bx, bz] = f(0.1 * s);
      B.sphere(bx, g + 0.27 * s, bz, 0.17 * s, M.cream, { sy: 1.35, sz: 0.8, ry: a, seg: 10 });
      const [ex, ez] = f(0.165 * s);
      for (const e of [-1, 1]) {
        B.sphere(ex + Math.cos(a) * e * 0.065 * s, g + 0.42 * s, ez - Math.sin(a) * e * 0.065 * s, 0.05 * s, M.black, { seg: 6, sy: 1.15 });
        B.sphere(ex + Math.cos(a) * e * 0.055 * s + Math.sin(a) * 0.04 * s, g + 0.44 * s, ez - Math.sin(a) * e * 0.055 * s + Math.cos(a) * 0.04 * s, 0.015 * s, M.white, { seg: 4 });
      }
      const [kx, kz] = f(0.22 * s);
      B.cone(kx, g + 0.33 * s, kz, 0.03 * s, 0.12 * s, M.orange, { seg: 5, rx: Math.PI / 2 * Math.cos(a), rz: -Math.PI / 2 * Math.sin(a) });
      for (const e of [-1, 1]) B.sphere(bx + Math.cos(a) * e * 0.07 * s, g + 0.02 * s, bz - Math.sin(a) * e * 0.07 * s, 0.06 * s, M.orange, { sy: 0.35, sz: 1.3, ry: a, seg: 6 });
    };
    for (let k = 0; k < 14; k++) {
      const a = r() * TAU, d = 6.5 + r() * 6;
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.35) continue;
      const [x, z] = at(a, d);
      peng(x, z, Math.atan2(I.x - x, I.z - z) + (r() - 0.5), 1.6 + r() * 0.8);
    }
    for (const [dx, dz] of [[-1.9, -1.2], [1.9, -1.0], [-2.6, 1.2], [2.5, 1.4]]) peng(I.x + dx, I.z - 2 + dz, 0.2 * dx, 1.8, g + 0.6);
  });
  {
    const pm = pictures(pics);
    W.scene.add(pm);
    B.cullNear(pm, I.x, I.z, 45);
  }

  // little ice peaks with faces
  let placed = 0;
  for (let t = 0; t < 400 && placed < 26; t++) {
    const pa = r() * TAU, d = 42 + r() * 90, x = I.x + Math.sin(pa) * d, z = I.z + Math.cos(pa) * d;
    if (Math.hypot(x - P.icePillars.x, z - (P.icePillars.z - 10)) < 20 || Math.hypot(x, z) > 318 || z > -150) continue;
    const gy = W.ground(x, z), h = 8 + r() * 14, rad = h * (0.32 + r() * 0.1), seg = 5 + Math.floor(r() * 2);
    const m = [M.ice, M.iceD, M.iceL][Math.floor(r() * 3)];
    B.cone(x, gy - 0.5, z, rad, h + 0.5, m, { seg, ry: r() * 3 });
    B.cone(x, gy + h * 0.68, z, rad * 0.34, h * 0.33, M.snow, { seg });
    for (const s of [-1, 1]) B.sphere(x + s * rad * 0.18, gy + h * 0.45, z + rad * 0.5, rad * 0.06, M.dark, { sy: 1.5 });
    cylCollider(x, z, rad * 0.6, gy - 0.5, gy + h * 0.55);
    placed++;
  }
  // frozen pillars south-west of the mountain (treasure)
  const px0 = P.icePillars.x, pz0 = P.icePillars.z, g0 = W.ground(px0, pz0), pillarPts = [];
  for (let k = 0; k < 6; k++) {
    const px = px0, pz = pz0 - k * 4.2, gp = W.ground(px, pz);
    const top = Math.max(g0 + 1.7 * (k + 1), gp + 1.2);
    B.cyl(px, gp - 0.5, pz, 1.3, top - gp + 0.5, k % 2 ? M.iceL : M.ice, { rTop: 1.15, seg: 6 });
    pillarPts.push({ x: px, z: pz, y: top });
    if (k === 5) W.treasure("icepillars", px, top, pz);
  }
  W.course("pilares-de-gelo", { x: px0, z: pz0 + 5 }, pillarPts, "icepillars");
  for (let k = 0; k < 6; k++) {
    const ca = k * 1.05, cx = px0 + Math.cos(ca) * 9, cz = pz0 - 10 + Math.sin(ca) * 9, cy = W.ground(cx, cz) - 0.3;
    B.box(cx, cy, cz, 2.2, 2.2, 2.2, M.iceL, { r: 0.3 });
    if (k === 2) PENGUINS.push({ x: cx, y: cy + 2.2, z: cz, yaw: Math.atan2(px0 - cx, pz0 - 10 - cz) });
  }
}

// ── posters (no words) ──
function paintBlueprint(c, w, h) { // plans for a princess-catching machine
  c.fillStyle = "#1f5fb0";
  c.fillRect(0, 0, w, h);
  c.strokeStyle = "rgba(255,255,255,0.25)";
  c.lineWidth = 1;
  for (let x = 0; x < w; x += 16) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
  for (let y = 0; y < h; y += 16) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  c.strokeStyle = "#ffffff";
  c.lineWidth = 4;
  c.strokeRect(w * 0.2, h * 0.45, w * 0.6, h * 0.3);
  c.beginPath();
  c.arc(w * 0.35, h * 0.8, w * 0.07, 0, 7);
  c.arc(w * 0.65, h * 0.8, w * 0.07, 0, 7);
  c.stroke();
  c.beginPath();
  c.moveTo(w * 0.5, h * 0.45);
  c.lineTo(w * 0.5, h * 0.2);
  c.lineTo(w * 0.72, h * 0.12);
  c.stroke();
  c.beginPath();
  c.arc(w * 0.76, h * 0.14, w * 0.06, 0, 7);
  c.stroke();
}
function paintPrincess(c, w, h) { // a pin-up of a pink princess with hearts
  c.fillStyle = "#ffd6ea";
  c.fillRect(0, 0, w, h);
  c.fillStyle = "#ff5cb8";
  c.beginPath();
  c.moveTo(w * 0.5, h * 0.35);
  c.lineTo(w * 0.78, h * 0.95);
  c.lineTo(w * 0.22, h * 0.95);
  c.fill();
  c.fillStyle = "#ffcbe6";
  c.beginPath();
  c.arc(w * 0.5, h * 0.3, w * 0.14, 0, 7);
  c.fill();
  c.fillStyle = "#ff66c4";
  c.beginPath();
  c.arc(w * 0.5, h * 0.27, w * 0.16, Math.PI, 0);
  c.fill();
  c.fillStyle = "#e8303a";
  for (const [x, y] of [[0.15, 0.15], [0.85, 0.2], [0.12, 0.6], [0.88, 0.55]]) {
    c.beginPath();
    c.arc(w * x - 5, h * y, 6, 0, 7);
    c.arc(w * x + 5, h * y, 6, 0, 7);
    c.moveTo(w * x - 11, h * y + 2);
    c.lineTo(w * x, h * y + 14);
    c.lineTo(w * x + 11, h * y + 2);
    c.fill();
  }
  c.strokeStyle = "#8a2a5a";
  c.lineWidth = 6;
  c.strokeRect(3, 3, w - 6, h - 6);
}
function paintHeart(c, w, h) {
  c.fillStyle = "#bfe8ff";
  c.fillRect(0, 0, w, h);
  c.fillStyle = "#e8303a";
  c.beginPath();
  c.moveTo(w / 2, h * 0.85);
  c.bezierCurveTo(-w * 0.1, h * 0.45, w * 0.25, h * 0.05, w / 2, h * 0.32);
  c.bezierCurveTo(w * 0.75, h * 0.05, w * 1.1, h * 0.45, w / 2, h * 0.85);
  c.fill();
  c.strokeStyle = "#f6c343";
  c.lineWidth = 8;
  c.strokeRect(4, 4, w - 8, h - 8);
}
