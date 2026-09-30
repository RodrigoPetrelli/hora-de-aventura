// Lumpy Space: the mushroom trail from Marceline's cave, a spiral of lumpy clouds up into a
// deep purple starry sky, and the floating islands at the top: Lumpy Space Princess's house,
// the party dome (with a party inside), Make-Out Point, the Lumpy Abyss swirling below.
// Angles in this file follow mushroomTrail(): math-style atan2(z, x), pt(a, r) = L + (cos a, sin a)·r.
import * as THREE from "three";
import { toon, noOutline } from "./toon.js";
import { GEO, mtx } from "./builder.js";
import { boxCollider, cylCollider, ringCollider } from "./physics.js";
import { P, rng, mushroomTrail, lumpyAt } from "./terrain.js";

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const std = (dx, dz) => Math.atan2(dx, dz); // the rest of the game's angles (0 = +z)

export function buildLumpy(B, W) {
  const r = rng(4747), L = P.lumpy;
  const M = {
    stem: toon(0xf1e6d0), dot: toon(0xffffff, { outline: false }),
    top: [toon(0x6ec8f0, { tex: "frosting", scale: 0.25 }), toon(0x5fe0d0, { tex: "frosting", scale: 0.25 }), toon(0xb8a0f8, { tex: "frosting", scale: 0.25 })],
    mid: [toon(0xa98ce8), toon(0x8fa0f0), toon(0xc49af7)],
    low: [toon(0xe29ae0), toon(0xf0a8d8), toon(0xd88ae8)],
    drip: [toon(0xc8a0f0), toon(0xf0b0e0)],
    pine: [toon(0x8fd06a), toon(0x6fbf5a), toon(0xa8e07a)], trunk: toon(0x7a9a5a),
    shroomTree: toon(0x7fcf8a), pinkTree: toon(0xff9fd8),
    house: toon(0x9a8ab8, { tex: "siding", scale: 0.6 }), roof: toon(0x2a2a6a, { tex: "shingle", scale: 0.5 }),
    trim: toon(0x5a4a7a), win: toon(0x7ff0ff, { emissive: 0x1a6a7a }), door: toon(0x4a2a6a), stone: toon(0x9a9ab0, { tex: "stone", scale: 0.4 }),
    pipe: toon(0x7a7a8a),
    dome: toon(0xff9fd0, { tex: "frosting", scale: 0.3 }), domeIn: toon(0x2f9a72, { side: THREE.BackSide, outline: false }),
    floorG: toon(0x3fb880, { tex: "frosting", scale: 0.3 }), lantern: toon(0xd8ff8a, { emissive: 0x5a8a10 }),
    djTable: toon(0x6a4a9a), black: toon(0x1d1d24), speaker: toon(0x3a3a48), punch: toon(0xff6fb0, { emissive: 0x3a0a20 }),
    glassCup: toon(0xe8f8ff), mirror: toon(0xd8e0f0, { flat: true, emissive: 0x3a3a50 }),
    hill: toon(0xe8905a, { tex: "frosting", scale: 0.2 }), hillG: toon(0x8fd06a), cave: toon(0x2a1438, { outline: false }),
    car: [toon(0xff6fb0), toon(0x6fd8ff), toon(0xffd84f), toon(0x9dff6b), toon(0xc27bff), toon(0xff8a3d)],
    lamp: toon(0xfff2a0, { emissive: 0xa08020 }),
  };
  const pt = (a, rr) => [L.x + Math.cos(a) * rr, L.z + Math.sin(a) * rr];
  const pick = (arr) => arr[Math.floor(r() * arr.length)];

  // a floating lumpy island: a walkable top with lumpy edges, two layers below it getting
  // smaller (blue, lilac, pink), a pointed bottom, and goo dripping off every edge
  const island = (x, y, z, R, pal = 0, o = {}) => {
    const cT = M.top[pal % 3], cM = M.mid[pal % 3], cL = M.low[pal % 3];
    B.cyl(x, y - 1.2, z, R, 1.2, cT, { seg: R > 5 ? 20 : 12 });
    const n = Math.max(6, Math.round(R * 1.5)), lr = R * 0.2 + 0.4;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + r() * 0.2;
      B.sphere(x + Math.cos(a) * R * 0.93, y - lr * 0.55 - 0.02, z + Math.sin(a) * R * 0.93, lr, cT, { sy: 0.55, seg: 8 });
    }
    if (!o.flat) for (let i = 0; i < R * 0.7; i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * R * 0.75;
      B.sphere(x + Math.cos(a) * d, y - 0.08, z + Math.sin(a) * d, 0.5 + r() * 0.9, cT, { sy: 0.14, seg: 8 });
    }
    B.cyl(x, y - 3.4, z, R * 0.8, 2.2, cM, { rTop: R * 0.98, seg: 16, solid: false });
    B.cyl(x, y - 5.8, z, R * 0.5, 2.4, cL, { rTop: R * 0.8, seg: 14, solid: false });
    B.cone(x, y - 8.4, z, R * 0.47, 2.6, cL, { rx: Math.PI, seg: 12 });
    for (const [rad, yy, m, cnt] of [[R * 0.97, y - 1.2, cM, n], [R * 0.8, y - 3.4, cL, Math.round(n * 0.8)], [R * 0.5, y - 5.8, M.drip[pal % 2], Math.round(n * 0.6)]]) {
      const lumpR = R * 0.13 + 0.25;
      for (let k = 0; k < cnt; k++) {
        const a = (k / cnt) * TAU + r(), len = (0.5 + r() * 1.8) * Math.min(1.5, R / 6 + 0.4), dx = Math.cos(a) * rad, dz = Math.sin(a) * rad;
        if (k % 2) B.sphere(x + dx, yy - 0.1, z + dz, lumpR, m, { sy: 0.6, seg: 7 });
        else B.capsule([x + dx, yy, z + dz], [x + dx * 0.98, yy - len, z + dz * 0.98], Math.min(0.45, R * 0.05 + 0.12), m, 6);
      }
    }
  };
  const pine = (x, y, z, s = 1) => {
    const m = pick(M.pine), lean = (r() - 0.5) * 0.8;
    B.branch([[x, y - 0.2, z], [x + lean * 0.5, y + 1.4 * s, z], [x - lean * 0.3, y + 2.6 * s, z + lean * 0.3]], 0.2 * s, 0.1 * s, M.trunk, 4);
    for (let k = 0; k < 3; k++) {
      const yy = y + (1.1 + k * 1.0) * s, rr = (1.3 - k * 0.33) * s;
      B.cone(x + (k === 1 ? lean * 0.3 : -lean * 0.2), yy, z, rr, 1.5 * s, m, { seg: 6, rz: (r() - 0.5) * 0.35, rx: (r() - 0.5) * 0.35 });
    }
    B.sphere(x - lean * 0.3, y + 4.4 * s, z, 0.18 * s, m, { seg: 5 });
    cylCollider(x, z, 0.3 * s, y, y + 2.5 * s, false);
  };
  const shroomTree = (x, y, z, s = 1) => {
    B.branch([[x, y - 0.3, z], [x + 1.4 * s, y + 2.5 * s, z + 0.4 * s], [x + 0.4 * s, y + 5 * s, z], [x + 1.2 * s, y + 6.4 * s, z]], 0.75 * s, 0.45 * s, M.shroomTree, 12);
    B.sphere(x + 1.2 * s, y + 6.8 * s, z, 3.0 * s, M.shroomTree, { sy: 0.32, seg: 12 });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      B.sphere(x + 1.2 * s + Math.cos(a) * 2.7 * s, y + 6.55 * s, z + Math.sin(a) * 2.7 * s, 0.7 * s, M.shroomTree, { sy: 0.5, seg: 7 });
    }
    cylCollider(x + 0.6 * s, z, 0.7 * s, y, y + 5 * s, false);
  };
  const dripTree = (x, y, z, s = 1) => {
    B.cyl(x, y - 0.2, z, 0.25 * s, 3.2 * s, M.drip[1], { solid: false, seg: 6 });
    B.sphere(x, y + 3.9 * s, z, 1.7 * s, M.pinkTree, { sy: 0.7, seg: 10 });
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * TAU;
      B.capsule([x + Math.cos(a) * 1.4 * s, y + 3.4 * s, z + Math.sin(a) * 1.4 * s], [x + Math.cos(a) * 1.45 * s, y + (2.2 - (k % 3) * 0.4) * s, z + Math.sin(a) * 1.45 * s], 0.18 * s, M.pinkTree, 6);
    }
    cylCollider(x, z, 0.35 * s, y, y + 3 * s, false);
  };

  // ── the mushroom trail from the cave ──
  const { S0, E, a0 } = mushroomTrail();
  const gS = W.ground(S0.x, S0.z);
  const CAP = [0xe8434f, 0xff8a3d, 0x4fc3f7, 0xba68c8];
  const skyPts = [];
  for (let k = 0; k < 10; k++) {
    const t = k / 10, mx = lerp(S0.x, E.x, t), mz = lerp(S0.z, E.z, t), gm = W.ground(mx, mz);
    const top = Math.max(gS + 1.6 + k * 1.0, gm + 1.3);
    skyPts.push({ x: mx, z: mz, y: top });
    B.cyl(mx, gm - 0.3, mz, 0.6, top - gm - 0.4, M.stem, { solid: false, rTop: 0.45, seg: 10 });
    cylCollider(mx, mz, 2.1, top - 0.7, top);
    B.sphere(mx, top - 0.55, mz, 2.1, toon(CAP[k % 4]), { sy: 0.45 });
    for (let i = 0; i < 5; i++) {
      const da = (i / 5) * TAU + k;
      B.sphere(mx + Math.cos(da) * 1.3, top + 0.02, mz + Math.sin(da) * 1.3, 0.28, M.dot, { sy: 0.3 });
    }
  }

  // ── one turn of little lumpy islands up to the top ──
  // (it starts a little to the side of the last mushroom, so the two don't overlap)
  const base = gS + 12, SR = 18, step = TAU / 25, s0 = a0 + 0.22;
  for (let k = 0; k < 26; k++) {
    const [cx, cz] = pt(s0 + k * step, SR), top = base + k * 1.6;
    skyPts.push({ x: cx, z: cz, y: top });
    island(cx, top, cz, 2.2, k % 3, { flat: true });
  }
  const itop = base + 25 * 1.6 + 1.4;

  // ── the main island: Lumpy Space Princess's house ──
  island(L.x, itop, L.z, 13, 0);
  {
    const [ax, az] = pt(s0, 12.2);
    skyPts.push({ x: ax, z: az, y: itop });
    W.course("espaco-carocudo", { x: S0.x + (S0.x - E.x) * 0.08, z: S0.z + (S0.z - E.z) * 0.08 }, skyPts, "lumpy");
  }
  {
    // a tall Victorian house: gabled main block, a wing, a round tower, a crooked chimney
    const [hx, hz] = pt(a0 + Math.PI, 5.2), hf = std(Math.cos(a0), Math.sin(a0)), y = itop;
    const loc = (right, fwd) => [hx + Math.cos(hf) * right + Math.sin(hf) * fwd, hz - Math.sin(hf) * right + Math.cos(hf) * fwd];
    const box = (right, fwd, y0, w, h, d, m, solid = true) => { const [x, z] = loc(right, fwd); B.box(x, y0, z, w, h, d, m, { ry: hf, solid, r: 0.06 }); };
    box(0, 0, y, 6.4, 6.0, 4.6, M.house);
    box(4.6, -0.4, y, 3.4, 4.4, 3.8, M.house);
    { const [x, z] = loc(0, 0); B.gable(x, y + 6, z, 5.4, 2.8, 7.0, M.roof, hf + Math.PI / 2); }
    { const [x, z] = loc(4.6, -0.4); B.gable(x, y + 4.4, z, 4.4, 2.2, 4.0, M.roof, hf + Math.PI / 2); }
    for (const rt of [-1.6, 1.6]) { const [x, z] = loc(rt, 2.2); B.gable(x, y + 4.6, z, 2.0, 1.4, 1.6, M.roof, hf); box(rt, 2.4, y + 3.3, 1.6, 1.3, 0.6, M.house, false); }
    {
      const [x, z] = loc(-3.6, 1.2);
      B.cyl(x, y, z, 1.35, 8.6, M.house, { seg: 12 });
      B.cone(x, y + 8.6, z, 1.7, 3.6, M.roof, { seg: 12 });
      B.cyl(x, y + 12.2, z, 0.05, 1.0, M.trim, { solid: false, seg: 4 });
      for (const wy of [2.0, 4.6, 7.0]) { const [wx, wz] = loc(-3.6, 1.2 + 1.37); B.box(wx, y + wy, wz, 0.6, 1.0, 0.12, M.win, { solid: false, ry: hf }); }
    }
    // windows (tall and glowing), the door with steps
    for (const [rt, wy] of [[-1.6, 1.2], [1.6, 1.2], [-1.6, 3.4], [1.6, 3.4], [0, 3.4], [-1.6, 4.9], [1.6, 4.9], [4.6, 1.3], [4.6, 3.0]]) {
      const fwd = rt > 4 ? -0.4 + 1.92 : wy > 4.5 ? 2.72 : 2.32;
      box(rt, fwd, y + wy, 0.9, 1.4, 0.1, M.win, false);
      box(rt, fwd - 0.03, y + wy - 0.12, 1.15, 1.65, 0.06, M.trim, false);
    }
    box(0, 2.34, y, 1.3, 2.3, 0.14, M.door, false);
    box(0, 2.9, y - 0.3, 2.2, 0.35, 1.0, M.stone, false);
    box(0, 3.5, y - 0.45, 2.4, 0.3, 0.8, M.stone, false);
    { const [x, z] = loc(2.2, -1.0); B.tube([[x, y + 6.8, z], [x + 0.3, y + 8.2, z], [x - 0.4, y + 9.3, z + 0.3], [x + 0.2, y + 10.4, z]], 0.3, M.pipe, { seg: 12, radial: 7 }); B.cyl(x + 0.2, y + 10.3, z, 0.42, 0.4, M.pipe, { solid: false, seg: 8 }); }
    const [lx, lz] = pt(a0 + Math.PI * 0.72, 3.2);
    W.npc("lsp", lx, lz, std(Math.cos(a0), Math.sin(a0)), { y: itop + 0.6, float: true });
  }
  {
    const [tx, tz] = pt(a0 + 0.9, 7.5);
    W.treasure("lumpy", tx, itop, tz);
  }
  for (const [a, d, kind] of [[a0 - 0.9, 9.5, "pine"], [a0 - 1.4, 7, "pine"], [a0 + 2.4, 10, "pine"], [a0 - 2.4, 9.5, "shroom"], [a0 + 1.35, 10.6, "drip"], [a0 - 0.35, 10.2, "pine"]]) {
    const [x, z] = pt(a, d);
    if (kind === "pine") pine(x, itop, z, 1 + r() * 0.3);
    else if (kind === "shroom") shroomTree(x, itop, z, 0.9);
    else dripTree(x, itop, z, 1);
  }
  // Lumpy people hanging out on the island
  for (const [a, d] of [[a0 + 0.35, 6.5], [a0 - 0.6, 6], [a0 + 1.9, 7.5], [a0 - 1.9, 6.8]]) {
    const [x, z] = pt(a, d);
    W.citizen("lumpy", { x, z, y: itop, float: true, yaw: std(L.x - x, L.z - z) });
  }
  {
    const [x0, z0] = pt(a0 + 0.5, 9), [x1, z1] = pt(a0 - 1.0, 9);
    W.citizen("lumpy", { line: [x0, z0, x1, z1], t: 0.3, speed: 1.1, y: itop, float: true });
  }

  // ── steps out to the party island and to Make-Out Point ──
  const cloudStep = (a, d, y, pal) => { const [x, z] = pt(a, d); island(x, y, z, 2.4, pal, { flat: true }); return { x, z, y }; };
  const aP = a0 + Math.PI / 2, aK = a0 - Math.PI / 2;
  const partySteps = [cloudStep(aP, 16.8, itop + 1.1, 1), cloudStep(aP, 20.8, itop + 2.2, 2)];
  cloudStep(aK, 16.8, itop + 1.3, 2);
  cloudStep(aK, 20.6, itop + 2.6, 1);

  // ── the party island: a pink dome with searchlights, lumpy cars parked round it ──
  const [px, pz] = pt(aP, 35), y2 = itop + 3.3, DR = 6.8, doorS = std(L.x - px, L.z - pz), half = 0.23;
  island(px, y2, pz, 11, 1);
  {
    const prof = [], prIn = [];
    for (let i = 0; i <= 8; i++) {
      const t = (i / 8) * (Math.PI / 2);
      prof.push([Math.max(0.01, DR * Math.cos(t)), 6.8 * Math.sin(t)]);
      prIn.push([Math.max(0.01, (DR - 0.4) * Math.cos(t)), 6.4 * Math.sin(t)]);
    }
    B.lathe(prof, M.dome, px, y2, pz, { seg: 22, ps: doorS + half, pl: TAU - 2 * half });
    B.lathe(prIn, M.domeIn, px, y2, pz, { seg: 22, ps: doorS + half * 1.1, pl: TAU - 2.2 * half });
    const above = (pr) => pr.filter(([, h]) => h >= 3.4 - 0.01);
    B.lathe([[DR * Math.cos(Math.asin(3.4 / 6.8)), 3.4], ...above(prof)], M.dome, px, y2, pz, { seg: 2, ps: doorS - half, pl: 2 * half });
    B.lathe([[(DR - 0.4) * Math.cos(Math.asin(3.4 / 6.4)), 3.4], ...above(prIn)], M.domeIn, px, y2, pz, { seg: 2, ps: doorS - half * 1.1, pl: 2.2 * half });
    for (const s of [-1, 1]) {
      const ja = doorS + s * half, jx = px + Math.sin(ja) * (DR - 0.2), jz = pz + Math.cos(ja) * (DR - 0.2);
      B.box(jx, y2, jz, 0.25, 3.4, 0.5, M.dome, { solid: false, ry: ja });
    }
    ringCollider(px, pz, 6.6, 0.8, y2 - 1, y2 + 4, [[doorS, 0.62]]);
    ringCollider(px, pz, 5.2, 1.6, y2 + 4, y2 + 5.8);
    cylCollider(px, pz, 4.4, y2 + 5.8, y2 + 7.4);
    { const dx = px + Math.sin(doorS) * 6.6, dz = pz + Math.cos(doorS) * 6.6; boxCollider(dx - 1.9, dx + 1.9, y2 + 3.4, y2 + 4.2, dz - 1.9, dz + 1.9); }
    W.sealed(px, pz, 6.1, y2 - 1, y2 + 7, 40);
    // round windows, a red knob on top
    for (let k = 0; k < 10; k++) {
      const wa = doorS + 0.55 + (k / 10) * (TAU - 1.1), wy = k % 2 ? 2.2 : 4.4, wr = DR * Math.cos(Math.asin(wy / 6.8));
      B.sphere(px + Math.sin(wa) * wr, y2 + wy, pz + Math.cos(wa) * wr, 0.55, M.win, { sz: 0.3, ry: wa, seg: 10 });
    }
    B.cyl(px, y2 + 6.7, pz, 0.8, 0.5, M.car[0], { seg: 12, solid: false });
    B.sphere(px, y2 + 7.4, pz, 0.35, M.lamp, { seg: 8 });
    // lumpy cars, parked
    for (let k = 0; k < 7; k++) {
      const ca = doorS + 0.8 + (k / 7) * (TAU - 1.6), cr = 8.8, cx = px + Math.sin(ca) * cr, cz = pz + Math.cos(ca) * cr, fa = ca + Math.PI / 2;
      const m = M.car[k % 6];
      B.sphere(cx, y2 + 0.75, cz, 1.0, m, { sx: 1.0, sy: 0.55, sz: 1.6, ry: fa, seg: 10 });
      B.sphere(cx, y2 + 1.15, cz - 0, 0.62, M.win, { sx: 1.0, sy: 0.55, sz: 1.1, ry: fa, seg: 8 });
      for (const [wx, wz] of [[-0.75, 0.9], [0.75, 0.9], [-0.75, -0.9], [0.75, -0.9]]) {
        const x = cx + Math.cos(fa) * wx + Math.sin(fa) * wz, z = cz - Math.sin(fa) * wx + Math.cos(fa) * wz;
        B.raw(GEO.cyl(0.3, 0.3, 10), M.black, mtx(x, y2 + 0.3, z, fa, 1, 0.25, 1, 0, Math.PI / 2));
      }
      cylCollider(cx, cz, 1.1, y2, y2 + 1.2, false);
    }
    for (const [a, d] of [[doorS + 2.4, 9.8], [doorS - 2.6, 9.6]]) pine(px + Math.sin(a) * d, y2, pz + Math.cos(a) * d, 0.9);
    // searchlights sweeping the sky
    const beamGeo = new THREE.CylinderGeometry(0.25, 1.7, 45, 12, 1, true).translate(0, 22.5, 0);
    const beamMat = noOutline(new THREE.MeshBasicMaterial({ color: 0xfff8d0, transparent: true, opacity: 0.11, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    [doorS + 1.0, doorS - 1.1, doorS + Math.PI].forEach((sa, i) => {
      const sx = px + Math.sin(sa) * 8.6, sz = pz + Math.cos(sa) * 8.6;
      B.box(sx, y2, sz, 0.9, 0.8, 0.9, M.speaker, { cam: false });
      const pivot = new THREE.Group();
      pivot.position.set(sx, y2 + 0.9, sz);
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.rotation.z = 0.45;
      pivot.add(beam);
      W.scene.add(pivot);
      W.tick((t) => { pivot.rotation.y = t * (0.35 + i * 0.12) + i * 2; beam.rotation.z = 0.35 + 0.2 * Math.sin(t * 0.7 + i); });
    });
  }
  // ── inside the dome: a party ──
  B.raw(GEO.circle(24), M.floorG, mtx(px, y2 + 0.03, pz, 0, 6.4, 6.4, 1, -Math.PI / 2));
  const back = doorS + Math.PI, bx = (d, lat = 0) => [px + Math.sin(back) * d + Math.cos(back) * lat, pz + Math.cos(back) * d - Math.sin(back) * lat];
  B.inside(px, pz, 40, () => {
    // strings of glowing lime lanterns hanging from the dome
    for (let k = 0; k < 8; k++) {
      const la = (k / 8) * TAU + 0.3, lr = k % 2 ? 4.8 : 3.4, lx = px + Math.sin(la) * lr, lz = pz + Math.cos(la) * lr;
      if (Math.abs(Math.atan2(Math.sin(la - back), Math.cos(la - back))) < 0.9) continue; // clear of the DJ booth
      const topY = y2 + 6.4 * Math.sqrt(1 - (lr / 6.4) ** 2) - 0.2;
      B.cyl(lx, y2 + 2.6, lz, 0.02, topY - y2 - 2.6, M.trim, { solid: false, seg: 3 });
      for (let i = 0; i < 5; i++) B.sphere(lx + Math.sin(i * 2.1) * 0.12, topY - 0.45 - i * 0.62, lz + Math.cos(i * 2.1) * 0.12, 0.27, M.lantern, { seg: 8 });
    }
    // the DJ booth: turntables, and a stack of speakers (the treasure waits on top)
    const [dx, dz] = bx(3.3, -0.8), [sx, sz] = bx(3.3, 1.7);
    B.box(dx, y2, dz, 3.0, 1.0, 1.2, M.djTable, { ry: back, r: 0.1 });
    for (const lat of [-0.7, 0.7]) {
      const [tx, tz] = bx(3.3, -0.8 + lat);
      B.cyl(tx, y2 + 1.0, tz, 0.42, 0.08, M.black, { solid: false, seg: 14 });
      B.cyl(tx, y2 + 1.08, tz, 0.12, 0.03, M.punch, { solid: false, seg: 8 });
    }
    for (const [yy, h] of [[0, 1.2], [1.2, 1.2]]) {
      B.box(sx, y2 + yy, sz, 1.4, h, 1.1, M.speaker, { ry: back, r: 0.06 });
      const [fx, fz] = bx(2.72, 1.7);
      B.raw(GEO.cyl(0.42, 0.42, 14), M.black, mtx(fx, y2 + yy + 0.6, fz, back + Math.PI, 1, 0.08, 1, Math.PI / 2));
    }
    W.treasure("lumpyparty", sx, y2 + 2.4, sz);
    // the punch table
    {
      const [tx, tz] = bx(0.5, 4.6);
      B.box(tx, y2, tz, 1.2, 0.95, 2.6, M.djTable, { ry: back, r: 0.08 });
      B.cyl(tx, y2 + 0.95, tz, 0.45, 0.35, M.glassCup, { solid: false, seg: 12, rTop: 0.55 });
      B.cyl(tx, y2 + 1.0, tz, 0.44, 0.25, M.punch, { solid: false, seg: 12 });
      for (const o of [-0.9, 0.9]) { const [cx, cz] = bx(0.5 + o * 0.2, 4.6 + o * 0.1); B.cyl(cx, y2 + 0.95, cz, 0.1, 0.22, M.glassCup, { solid: false, seg: 6 }); }
    }
    // coloured light spots on the dance floor
    for (let k = 0; k < 7; k++) {
      const la = (k / 7) * TAU, lr = 1.2 + (k % 3) * 1.1;
      B.raw(GEO.circle(12), [M.punch, M.win, M.lamp][k % 3], mtx(px + Math.sin(la) * lr, y2 + 0.05, pz + Math.cos(la) * lr, 0, 0.55, 0.55, 1, -Math.PI / 2));
    }
    // the dancers
    for (let k = 0; k < 5; k++) {
      const la = (k / 5) * TAU + 0.5, x = px + Math.sin(la) * 2.2, z = pz + Math.cos(la) * 2.2;
      W.citizen("lumpy", { x, z, y: y2, float: true, dance: true, yaw: std(px - x, pz - z) });
    }
    W.course("festa-carocuda", { x: pt(aP, 10)[0], z: pt(aP, 10)[1], y: itop }, [...partySteps, { x: pt(aP, 25.6)[0], z: pt(aP, 25.6)[1], y: y2 },
      { x: pt(aP, 30.5)[0], z: pt(aP, 30.5)[1], y: y2 }, { x: pt(aP, 34.3)[0], z: pt(aP, 34.3)[1], y: y2 }, { x: dx, z: dz, y: y2 + 1.0 }], "lumpyparty");
  });
  {
    // the disco ball, spinning
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 1), M.mirror);
    ball.position.set(px, y2 + 5.2, pz);
    W.scene.add(ball);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 3), M.trim);
    cord.position.set(px, y2 + 6.1, pz);
    W.scene.add(cord);
    B.cullNear(ball, px, pz, 40);
    B.cullNear(cord, px, pz, 40);
    W.tick((t) => { ball.rotation.y = t * 1.2; });
  }

  // ── Make-Out Point: a lumpy orange hill with a cave, on its own island ──
  {
    const [kx, kz] = pt(aK, 30), y3 = itop + 3.9;
    island(kx, y3, kz, 7.5, 2);
    const [hx, hz] = pt(aK, 32.5);
    B.sphere(hx, y3 - 0.6, hz, 4.6, M.hill, { sy: 0.75, seg: 16, solid: true, top: 0.8 });
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU;
      B.sphere(hx + Math.cos(a) * 3.4, y3 + 0.4 + (k % 2) * 0.8, hz + Math.sin(a) * 3.4, 1.4 + (k % 3) * 0.4, k % 2 ? M.hillG : M.hill, { sy: 0.8, seg: 10 });
    }
    const [cx, cz] = pt(aK, 28.2);
    B.sphere(cx, y3 + 0.6, cz, 1.3, M.cave, { sx: 1.1, sy: 0.9, sz: 0.4, ry: std(Math.cos(aK + Math.PI), Math.sin(aK + Math.PI)), seg: 10 });
    const [tx, tz] = pt(aK + 0.35, 28.5);
    shroomTree(tx, y3, tz, 0.55);
  }

  // ── faraway islands drifting in the purple sky ──
  for (let k = 0; k < 10; k++) {
    const a = a0 + 0.3 + (k / 10) * TAU, y = itop - 14 + ((k * 7) % 5) * 7;
    let d = 55 + (k % 3) * 13, [x, z] = pt(a, d);
    while (Math.hypot(x, z) > 322 && d > 40) [x, z] = pt(a, (d -= 4)); // not inside the mountains at the world's rim
    const R = 4 + (k % 4) * 1.6;
    island(x, y, z, R, k % 3);
    pine(x + 0.5, y, z - 0.5, 0.8 + (k % 2) * 0.3);
    if (k % 3 === 0) dripTree(x - R * 0.4, y, z + R * 0.3, 0.8);
    if (k % 4 === 1) pine(x - R * 0.45, y, z + R * 0.2, 0.7);
  }

  // ── the Lumpy Abyss swirling far below the main island ──
  {
    const tex = abyssTexture();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(13.5, 48).rotateX(-Math.PI / 2), noOutline(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })));
    disc.position.set(L.x, itop - 22, L.z);
    W.scene.add(disc);
    W.tick((t) => { disc.rotation.y = -t * 0.25; });
  }

  // ── stars: only in Lumpy Space ──
  {
    const n = 900, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = r() * TAU, v = r() * 1.3 - 0.35, d = 150 + r() * 90;
      pos[i * 3] = L.x + Math.cos(u) * Math.cos(v) * d;
      pos[i * 3 + 1] = itop + Math.sin(v) * d;
      pos[i * 3 + 2] = L.z + Math.sin(u) * Math.cos(v) * d;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = noOutline(new THREE.PointsMaterial({ color: 0xfff4b0, size: 2.2, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    const stars = new THREE.Points(geo, mat);
    stars.frustumCulled = false;
    W.scene.add(stars);
    W.tick((t, cam) => {
      const lf = cam ? lumpyAt(cam) : 0;
      stars.visible = lf > 0.02;
      mat.opacity = lf * (0.75 + 0.25 * Math.sin(t * 2.3));
    });
  }
}

/** The swirl of the Lumpy Abyss: dark purple arms turning into the middle, fading at the rim. */
function abyssTexture() {
  const s = 256, c = document.createElement("canvas");
  c.width = c.height = s;
  const x = c.getContext("2d"), g = x.createRadialGradient(s / 2, s / 2, 4, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(10,2,20,1)");
  g.addColorStop(0.7, "rgba(40,10,70,0.95)");
  g.addColorStop(1, "rgba(60,20,90,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, s, s);
  x.lineCap = "round";
  for (let arm = 0; arm < 5; arm++) {
    x.strokeStyle = arm % 2 ? "rgba(95,224,208,0.55)" : "rgba(184,160,248,0.55)";
    x.lineWidth = 7;
    x.beginPath();
    for (let i = 0; i <= 60; i++) {
      const t = i / 60, a = arm * (Math.PI * 2 / 5) + t * 5.5, rr = t * s * 0.46;
      const px = s / 2 + Math.cos(a) * rr, py = s / 2 + Math.sin(a) * rr;
      i ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
