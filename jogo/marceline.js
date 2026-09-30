// Marceline's cave: a dark cave with a pond, and her two-storey house you can walk into
// (kitchen and living room downstairs, her bedroom and music corner upstairs). The mushroom
// trail from the cave up to Lumpy Space lives in lumpy.js.
import * as THREE from "three";
import { toon } from "./toon.js";
import { GEO, mtx, pictures } from "./builder.js";
import { boxCollider, cylCollider, ringCollider } from "./physics.js";
import { P, rng } from "./terrain.js";

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;

export function buildCanyon(B, W) {
  const Mc = P.marcy, g = W.ground(Mc.x, Mc.z), r = rng(3003);
  const M = {
    rock: toon(0xb4582f, { tex: "rock", scale: 0.12 }),
    caveIn: toon(0x3f5a55, { tex: "rock", scale: 0.1, side: THREE.BackSide, outline: false }),
    rockD: toon(0x3a4a48, { tex: "rock", scale: 0.2 }),
    rockO: toon(0x8a3f24, { tex: "rock", scale: 0.2 }),
    siding: toon(0xcdb8d6, { tex: "siding", scale: 0.55 }),
    trim: toon(0xf4eef6),
    roof: toon(0x4a3a5a, { tex: "shingle", scale: 0.45 }),
    door: toon(0xe8e2f0),
    doorR: toon(0xb3202a),
    frame: toon(0x6a3a8a),
    warm: toon(0xffd27a, { emissive: 0x8a5a10 }),
    porch: toon(0xa99ab8, { tex: "wood", scale: 0.3 }),
    crate: toon(0xa8743e, { tex: "wood", scale: 0.35 }),
    iron: toon(0x3d3d48),
    stem: toon(0xf1e6d0),
    water: toon(0x2f6f6a, { emissive: 0x0a2420, outline: false }),
    pad: toon(0x4f9a4a),
    glow: toon(0x7ff0ff, { emissive: 0x2aa0b0 }),
    grass: toon(0x5fae3a, { outline: false }),
    fence: toon(0xffffff),
    // inside
    wallK: toon(0xf6e8b0), trimK: toon(0x3fa8a0),
    wallL: toon(0xb7a3c9), wallU: toon(0x9a78c0),
    floor: toon(0xb48a60, { tex: "planks", scale: 0.35 }),
    checker: toon(0xffffff, { tex: "checker", scale: 0.25 }),
    cabinet: toon(0xd8303a), fridge: toon(0xeef0f0), steel: toon(0xb8c0c8),
    sofa: toon(0xc8283a), sofaD: toon(0x98182a), wood: toon(0x7a4a2a, { tex: "wood", scale: 0.5 }),
    tv: toon(0x4a4a52), screen: toon(0x5a8aa0, { emissive: 0x10283a }),
    rug: toon(0x3f7a5a), rugP: toon(0x7a3a6a),
    bed: toon(0x2a2030), sheet: toon(0x8a1a2a), pillow: toon(0xe8e0f0),
    amp: toon(0x2a2a30), ampG: toon(0x7a7a80), bass: toon(0xb3202a), neck: toon(0x5d3a1e),
    lamp: toon(0xff8a3a, { emissive: 0x803010 }), strawberry: toon(0xe8303a), leaf: toon(0x3fae3a),
  };

  // ── the cave: rocky outside, dark and damp inside, open towards the east (the Tree Fort) ──
  const gap = 1.1, east = Math.PI / 2;
  const dome = [[24, 0], [23.6, 5], [21.6, 10], [17.6, 14.4], [11, 17.3], [0.01, 18.3]];
  B.lathe(dome, M.rock, Mc.x, g - 0.5, Mc.z, { seg: 40, ps: east + gap / 2, pl: TAU - gap });
  B.lathe(dome.map(([rr, h]) => [rr * 0.97, h * 0.97]), M.caveIn, Mc.x, g - 0.5, Mc.z, { seg: 40, ps: east + gap / 2, pl: TAU - gap });
  ringCollider(Mc.x, Mc.z, 23.3, 1.6, g - 1, g + 12, [[east, gap + 0.1]]);
  W.sealed(Mc.x, Mc.z, 22.5, g - 2, g + 17, 70);
  cylCollider(Mc.x, Mc.z, 16, g + 15, g + 16);
  for (const s of [-1, 1]) {
    const ea = east + s * (gap / 2 + 0.05);
    for (let k = 0; k < 3; k++) B.sphere(Mc.x + Math.sin(ea) * 23.6, g + 1.5 + k * 3.6, Mc.z + Math.cos(ea) * 23.6, 2.6 - k * 0.4, M.rockO);
  }
  // stalactites, stalagmites along the wall, glowing mushrooms
  for (let k = 0; k < 26; k++) {
    const sa = r() * TAU, d = 3 + r() * 15, h = 1.5 + r() * 3.5;
    B.cone(Mc.x + Math.sin(sa) * d, g + 16.5 - h - (d > 12 ? (d - 12) * 0.9 : 0), Mc.z + Math.cos(sa) * d, 0.5 + r() * 0.6, h, M.rockD, { rx: Math.PI, seg: 7 });
  }
  for (let k = 0; k < 18; k++) {
    const sa = r() * TAU;
    if (Math.abs(Math.atan2(Math.sin(sa - east), Math.cos(sa - east))) < 0.9) continue;
    const d = 19 + r() * 3, h = 1.2 + r() * 2.5, x = Mc.x + Math.sin(sa) * d, z = Mc.z + Math.cos(sa) * d;
    B.cone(x, g - 0.3, z, 0.6 + r() * 0.5, h, M.rockD, { seg: 7 });
    cylCollider(x, z, 0.5, g - 0.3, g + h * 0.6, false);
  }
  B.detail(() => {
    for (let k = 0; k < 22; k++) {
      const sa = Math.PI + (r() - 0.5) * 2.6, d = 13 + r() * 8, x = Mc.x + Math.sin(sa) * d, z = Mc.z + Math.cos(sa) * d, s = 0.5 + r() * 0.8;
      B.cyl(x, g - 0.05, z, 0.1 * s, 0.55 * s, M.stem, { solid: false, seg: 5 });
      B.sphere(x, g + 0.55 * s, z, 0.35 * s, M.glow, { sy: 0.55, seg: 8 });
    }
  }, 60);

  // ── the pond behind the house, with a wooden deck out over it ──
  const hx = Mc.x - 2, hz = Mc.z, HW = 5.5, HD = 4.5, H1 = 3.2, H2 = 6.4;
  {
    const px = hx - 14, pz = hz;
    B.raw(GEO.circle(40), M.water, mtx(px, g + 0.07, pz, 0, 8.5, 7, 1, -Math.PI / 2));
    for (const [dx, dz, s] of [[-3, 2.5, 0.8], [-1.5, -3, 0.65], [2.2, 3.4, 0.7], [-5, -1, 0.75], [1, -4.5, 0.6]])
      B.raw(GEO.circle(12), M.pad, mtx(px + dx, g + 0.1, pz + dz, r() * 3, s, s, 1, -Math.PI / 2));
    B.box(hx - HW - 3.6, g, hz, 7.2, 0.3, 7, M.porch, { r: 0.04 });
    for (const dx of [-1.2, -3.6, -6.0]) for (const dz of [-3.3, 3.3]) B.cyl(hx - HW + dx, g - 0.6, hz + dz, 0.16, 0.9, M.porch, { solid: false, seg: 6 });
    for (let k = 0; k < 8; k++) {
      const a = r() * TAU, d = 7 + r() * 1.5;
      B.cyl(px + Math.sin(a) * d * 1.1, g - 0.1, pz + Math.cos(a) * d * 0.9, 0.05, 1.2 + r(), M.leaf, { solid: false, seg: 4 });
    }
  }
  // lawn with a white picket fence by the front door
  {
    const lx = hx + HW + 4.2, lz = hz + HD + 2.5;
    B.raw(GEO.circle(20), M.grass, mtx(lx, g + 0.06, lz, 0, 4.2, 3.2, 1, -Math.PI / 2));
    for (let k = 0; k <= 8; k++) {
      const t = k / 8, x = lx - 3.6 + t * 7.2, z = lz + 3.1;
      B.box(x, g, z, 0.18, 1.05, 0.1, M.fence, { solid: false, r: 0.03 });
      B.cone(x, g + 1.05, z, 0.13, 0.22, M.fence, { seg: 4 });
    }
    for (const y of [0.35, 0.8]) B.box(lx, g + y, lz + 3.1, 7.2, 0.1, 0.06, M.fence, { solid: false });
    boxCollider(lx - 3.7, lx + 3.7, g, g + 1.1, lz + 3.0, lz + 3.2, false);
  }

  // ── Marceline's house: lilac siding, two floors, a cupola on the roof ──
  const x0 = hx - HW, x1 = hx + HW, z0 = hz - HD, z1 = hz + HD, T = 0.3;
  const wall = (ax, az, bx, bz, y0, y1, m = M.siding) => B.box((ax + bx) / 2, y0, (az + bz) / 2, Math.abs(bx - ax), y1 - y0, Math.abs(bz - az), m, { r: 0.03 });
  wall(x0, z0, x1, z0 + T, g, g + H2); // north
  wall(x0, z1 - T, x1, z1, g, g + H2); // south
  wall(x0, z0, x0 + T, z1, g, g + H2); // west
  wall(x1 - T, z0, x1, hz - 0.8, g, g + H2); // east, left of the door
  wall(x1 - T, hz + 0.8, x1, z1, g, g + H2);
  wall(x1 - T, hz - 0.8, x1, hz + 0.8, g + 2.8, g + H2);
  for (const [cx, cz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) B.box(cx, g, cz, 0.36, H2 + 0.1, 0.36, M.trim, { solid: false, r: 0.04 });
  for (const y of [g + H1 + 0.15]) {
    B.box(hx, y, z0 - 0.02, 2 * HW + 0.1, 0.18, 0.1, M.trim, { solid: false });
    B.box(hx, y, z1 + 0.02, 2 * HW + 0.1, 0.18, 0.1, M.trim, { solid: false });
  }
  // the front door (open, swung in), red steps and the porch
  B.box(x1 - 0.2, g, hz - 0.95, 1.5, 2.8, 0.12, M.doorR, { solid: false, ry: 0.35 });
  B.box(x1 + 0.02, g + 2.8, hz, 0.12, 0.25, 1.9, M.trim, { solid: false });
  for (const s of [-1, 1]) B.box(x1 + 0.02, g, hz + s * 0.9, 0.12, 2.9, 0.2, M.trim, { solid: false });
  B.box(x1 + 1.1, g, hz, 2.2, 0.25, 8.4, M.porch, { r: 0.04 });
  for (const s of [-1, 1]) B.cyl(x1 + 2.0, g + 0.25, hz + s * 3.9, 0.12, 2.9, M.trim, { solid: false, seg: 6 });
  B.box(x1 + 1.2, g + 3.15, hz, 2.6, 0.2, 8.8, M.roof, { solid: false });
  for (let k = 0; k < 2; k++) B.box(x1 + 2.5 + k * 0.45, g, hz, 0.45, 0.2 - k * 0.08, 1.8, M.doorR, { solid: false });
  B.cyl(x1 + 3.8, g, hz - 3.5, 0.12, 3.6, M.iron, { solid: false, seg: 6 });
  B.sphere(x1 + 3.8, g + 3.8, hz - 3.5, 0.4, M.warm);
  // windows: warm light inside a dark cave; purple frames, little striped awnings
  const win = (x, y, z, face, w = 1.4, h = 1.3, awning = true) => {
    const nx = Math.sin(face), nz = Math.cos(face);
    B.box(x + nx * 0.02, y - h / 2 - 0.12, z + nz * 0.02, w + 0.3, h + 0.24, 0.16, M.frame, { solid: false, ry: face });
    B.box(x + nx * 0.07, y - h / 2, z + nz * 0.07, w, h, 0.1, M.warm, { solid: false, ry: face });
    B.box(x + nx * 0.1, y - h / 2, z + nz * 0.1, 0.08, h, 0.08, M.frame, { solid: false, ry: face });
    B.box(x + nx * 0.1, y - 0.04, z + nz * 0.1, w, 0.08, 0.08, M.frame, { solid: false, ry: face });
    if (awning) B.box(x + nx * 0.35, y + h / 2 + 0.05, z + nz * 0.35, w + 0.5, 0.12, 0.7, M.frame, { solid: false, ry: face, rx: -0.35 });
    // the same window seen from inside
    B.box(x - nx * (T + 0.03), y - h / 2, z - nz * (T + 0.03), w, h, 0.06, M.warm, { solid: false, ry: face });
  };
  for (const [x, z, f] of [[hx - 2.5, z0, Math.PI], [hx + 2.5, z0, Math.PI], [hx - 2.5, z1, 0], [hx + 2.5, z1, 0], [x0, hz + 1.5, -Math.PI / 2]]) {
    win(x, g + 2.0, z, f);
    win(x, g + 5.1, z, f, 1.2, 1.1);
  }
  win(x1, g + 2.0, hz - 2.6, Math.PI / 2, 1.1, 1.2);
  win(x1, g + 2.0, hz + 2.6, Math.PI / 2, 1.1, 1.2);
  win(x1, g + 5.1, hz, Math.PI / 2, 1.3, 1.1);
  // roof, chimney, cupola, basketball hoop
  B.gable(hx, g + H2, hz, 2 * HD + 0.8, 2.6, 2 * HW + 1, M.roof, Math.PI / 2);
  boxCollider(hx - HW - 0.5, hx + HW + 0.5, g + H2, g + 6.8, hz - HD - 0.4, hz + HD + 0.4);
  boxCollider(hx - HW - 0.3, hx + HW + 0.3, g + 6.8, g + 8.6, hz - 0.8, hz + 0.8);
  B.box(hx + 2.5, g + H2, hz - 2.4, 1.0, 2.6, 1.0, M.iron, { solid: false });
  {
    const cx = hx - 3.2;
    B.box(cx, g + 7.4, hz, 2.2, 2.4, 2.2, M.siding, { r: 0.05 });
    for (const f of [0, Math.PI]) win(cx, g + 8.7, hz + Math.cos(f) * 1.1, f, 0.8, 0.8, false);
    B.gable(cx, g + 9.8, hz, 2.8, 1.3, 2.8, M.roof, Math.PI / 2);
    B.cyl(cx, g + 11.1, hz, 0.05, 0.9, M.iron, { solid: false, seg: 4 });
  }
  {
    const bz = z0 - 0.35;
    B.box(hx - 0.8, g + 4.3, bz, 2.0, 1.3, 0.12, M.fence, { solid: false });
    B.box(hx - 0.8, g + 4.55, bz - 0.07, 0.8, 0.6, 0.02, M.doorR, { solid: false });
    B.raw(GEO.torus(0.4, 0.04, TAU, 16), toon(0xff7a1a), mtx(hx - 0.8, g + 4.4, bz - 0.5, 0, 1, 1, 1, Math.PI / 2));
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU;
      B.capsule([hx - 0.8 + Math.sin(a) * 0.4, g + 4.4, bz - 0.5 + Math.cos(a) * 0.4], [hx - 0.8 + Math.sin(a) * 0.25, g + 3.9, bz - 0.5 + Math.cos(a) * 0.25], 0.015, M.fence, 3);
    }
  }
  // crates up to the roof (the treasure on the ridge)
  const cratePts = [];
  [[-3, 1.6], [-0.4, 3.1], [2.2, 4.6]].forEach(([ox, top]) => {
    const bx = hx + ox, bz = hz + 6.2;
    B.box(bx, g - 0.3, bz, 2, top + 0.3, 2, M.crate, { r: 0.06 });
    cratePts.push({ x: bx, z: bz, y: g + top });
  });
  W.treasure("marcy", hx, g + 8.6, hz);
  W.course("casa-da-marceline", { x: hx - 6, z: hz + 6.2 },
    [...cratePts, { x: hx + 2.2, z: hz + 3.2, y: g + 6.8 }, { x: hx, z: hz, y: g + 8.6 }], "marcy");
  W.npc("marceline", x1 + 3.0, hz + 3.2, Math.PI / 2, { y: g + 1.2, float: true });

  // ── inside ──
  // floors: planks, the checkered kitchen, the upper floor with the stairwell
  B.box(hx, g - 0.3, hz, 2 * HW - 0.2, 0.32, 2 * HD - 0.2, M.floor, { r: 0.02 });
  B.box(hx + 0.75, g + 0.02, hz - 2.35, 2 * HW - 2.1, 0.02, 3.6, M.checker, { solid: false, r: 0.005 });
  const sx0 = x0 + T, sx1 = x0 + T + 1.45; // the stairs along the west wall
  const upper = (ax, az, bx, bz) => B.box((ax + bx) / 2, g + H1, (az + bz) / 2, bx - ax, 0.3, bz - az, M.floor, { r: 0.02 });
  upper(sx1, z0 + T, x1 - T, z1 - T);
  upper(sx0, z0 + T, sx1, hz - 2.3);
  // the stairwell reaches far enough south that walking DOWN never bumps the head: going down,
  // Finn is still on the higher step when he comes under the edge of the upper floor
  upper(sx0, hz + 2.5, sx1, z1 - T);
  // wall paint inside: cream + teal trim downstairs in the kitchen, lilac in the living room, purple upstairs
  const paint = (ax, az, bx, bz, y0, y1, m) => B.box((ax + bx) / 2, y0, (az + bz) / 2, Math.max(0.02, bx - ax), y1 - y0, Math.max(0.02, bz - az), m, { solid: false, r: 0.005 });
  const iz0 = z0 + T + 0.01, iz1 = z1 - T - 0.01, ix0 = x0 + T + 0.01, ix1 = x1 - T - 0.01;
  paint(ix0, iz0, ix1, iz0 + 0.02, g, g + H1, M.wallK);
  paint(ix0, iz1 - 0.02, ix1, iz1, g, g + H1, M.wallL);
  paint(ix0, iz0, ix0 + 0.02, iz1, g, g + H1, M.wallL);
  paint(ix1 - 0.02, iz0, ix1, hz - 0.8, g, g + H1, M.wallK);
  paint(ix1 - 0.02, hz + 0.8, ix1, iz1, g, g + H1, M.wallL);
  paint(ix0, iz0 - 0.005, ix1, iz0 + 0.03, g + 1.1, g + 1.25, M.trimK);
  for (const [a, b, c2, d] of [[ix0, iz0, ix1, iz0 + 0.02], [ix0, iz1 - 0.02, ix1, iz1], [ix0, iz0, ix0 + 0.02, iz1], [ix1 - 0.02, iz0, ix1, iz1]]) paint(a, b, c2, d, g + H1 + 0.3, g + H2, M.wallU);
  // stairs: eleven steps of 0.318 up to the upper floor, rising towards the north
  const zs = hz + 3.9, run = 0.55, rise = (H1 + 0.3) / 11;
  for (let i = 0; i < 11; i++) {
    const za = zs - (i + 1) * run, zb = zs - i * run, top = g + (i + 1) * rise;
    B.box((sx0 + sx1) / 2, g, (za + zb) / 2, sx1 - sx0, top - g, zb - za + (i === 10 ? 0.1 : 0), M.wood, { r: 0.02 });
  }
  // railings round the stairwell upstairs, and a handrail down the stairs
  const up = g + H1 + 0.3;
  for (const [ax, az, bx, bz] of [[sx1 + 0.05, hz - 2.3, sx1 + 0.05, hz + 2.5], [sx0, hz + 2.55, sx1 + 0.05, hz + 2.55]]) {
    B.box((ax + bx) / 2, up + 0.9, (az + bz) / 2, Math.max(0.1, bx - ax), 0.1, Math.max(0.1, bz - az), M.wood, { solid: false });
    const n = Math.max(2, Math.round(Math.hypot(bx - ax, bz - az) / 0.5));
    for (let k = 0; k <= n; k++) B.box(lerp(ax, bx, k / n), up, lerp(az, bz, k / n), 0.07, 0.9, 0.07, M.wood, { solid: false });
    boxCollider(Math.min(ax, bx) - 0.05, Math.max(ax, bx) + 0.05, up, up + 1.0, Math.min(az, bz) - 0.05, Math.max(az, bz) + 0.05);
  }
  B.plank([sx1 + 0.05, g + 1.0, zs], [sx1 + 0.05, up + 1.0, zs - 11 * run], 0.1, 0.08, M.wood);
  const ax = x1 - T - 0.8, az = z1 - T - 0.7; // the amp stack upstairs (treasure on top)
  B.inside(hx, hz, 30, () => {
    // kitchen: red cabinets and counter with a sink, white fridge, red stove, a table with strawberries
    for (let k = 0; k < 4; k++) {
      const cx = hx - 2.4 + k * 1.5;
      B.box(cx, g, z0 + T + 0.45, 1.45, 1.0, 0.9, M.cabinet, { r: 0.05 });
      B.box(cx, g + 1.0, z0 + T + 0.45, 1.5, 0.1, 0.95, M.steel, { solid: false });
      B.box(cx, g + 2.0, z0 + T + 0.2, 1.4, 0.8, 0.4, M.cabinet, { solid: false, r: 0.05 });
      B.sphere(cx + 0.45, g + 0.8, z0 + T + 0.91, 0.05, M.steel, { seg: 5 });
    }
    B.box(hx - 0.9, g + 1.02, z0 + T + 0.45, 0.9, 0.1, 0.6, M.iron, { solid: false });
    B.capsule([hx - 0.9, g + 1.05, z0 + T + 0.15], [hx - 0.9, g + 1.45, z0 + T + 0.3], 0.04, M.steel, 5);
    B.box(x1 - T - 0.7, g, z0 + T + 0.6, 1.2, 2.6, 1.1, M.fridge, { r: 0.25 });
    B.box(x1 - T - 0.7, g + 1.7, z0 + T + 1.16, 1.15, 0.03, 0.03, M.steel, { solid: false });
    B.box(x1 - T - 1.2, g + 1.9, z0 + T + 1.17, 0.06, 0.45, 0.06, M.steel, { solid: false });
    B.box(x1 - T - 1.2, g + 0.9, z0 + T + 1.17, 0.06, 0.6, 0.06, M.steel, { solid: false });
    B.box(hx - 3.6, g, z0 + T + 0.45, 1.1, 1.0, 0.9, M.cabinet, { r: 0.05 });
    for (const dx of [-0.25, 0.25]) B.cyl(hx - 3.6 + dx, g + 1.0, z0 + T + 0.45, 0.18, 0.06, M.iron, { solid: false, seg: 10 });
    B.cyl(hx + 1.0, g, hz - 1.6, 0.12, 0.85, M.steel, { seg: 6, cam: false });
    B.cyl(hx + 1.0, g + 0.85, hz - 1.6, 0.8, 0.1, M.cabinet, { solid: false, seg: 16 });
    cylCollider(hx + 1.0, hz - 1.6, 0.8, g, g + 0.95, false);
    B.cyl(hx + 1.0, g + 0.95, hz - 1.6, 0.35, 0.18, toon(0x7fc8a0), { solid: false, seg: 12, rTop: 0.42 });
    for (let k = 0; k < 5; k++) B.sphere(hx + 1.0 + Math.cos(k * 1.3) * 0.18, g + 1.14, hz - 1.6 + Math.sin(k * 1.3) * 0.18, 0.1, M.strawberry, { seg: 6 });
    for (const s of [-1, 1]) {
      B.box(hx + 1.0 + s * 1.05, g, hz - 1.6, 0.5, 0.5, 0.5, M.cabinet, { solid: false, r: 0.05 });
      B.box(hx + 1.0 + s * 1.28, g + 0.5, hz - 1.6, 0.06, 0.6, 0.5, M.cabinet, { solid: false });
    }
    // living room: red sofa, an old TV, a rug and an orange lamp
    B.box(hx - 0.8, g, z1 - T - 0.55, 3.4, 0.55, 1.0, M.sofa, { r: 0.18 });
    B.box(hx - 0.8, g + 0.5, z1 - T - 0.2, 3.4, 0.9, 0.35, M.sofaD, { solid: false, r: 0.15 });
    for (const s of [-1, 1]) B.box(hx - 0.8 + s * 1.75, g, z1 - T - 0.55, 0.3, 0.85, 1.0, M.sofaD, { solid: false, r: 0.1 });
    B.sphere(hx - 0.8, g + 0.03, hz + 1.6, 1.9, M.rug, { sx: 1.3, sy: 0.02, seg: 20 });
    B.box(hx - 0.8, g, hz + 0.1, 1.6, 0.5, 0.7, M.wood, { r: 0.04 });
    B.box(hx - 0.8, g + 0.5, hz + 0.1, 1.2, 0.9, 0.8, M.tv, { solid: false, r: 0.1 });
    B.box(hx - 0.8, g + 0.62, hz + 0.51, 0.85, 0.62, 0.04, M.screen, { solid: false, r: 0.05 });
    for (const s of [-1, 1]) B.capsule([hx - 0.8, g + 1.4, hz + 0.1], [hx - 0.8 + s * 0.35, g + 1.9, hz + 0.1], 0.015, M.iron, 3);
    B.cyl(hx + 2.4, g, z1 - T - 0.5, 0.2, 0.08, M.iron, { solid: false, seg: 8 });
    B.cyl(hx + 2.4, g, z1 - T - 0.5, 0.04, 1.5, M.iron, { solid: false, seg: 4 });
    B.cyl(hx + 2.4, g + 1.45, z1 - T - 0.5, 0.35, 0.5, M.lamp, { solid: false, seg: 10, rTop: 0.22, open: true });
    // upstairs: Marceline's bedroom and music corner
    B.box(hx + 0.8, up, z0 + T + 1.1, 3.4, 0.55, 2.2, M.bed, { r: 0.06 });
    B.box(hx + 0.8, up + 0.55, z0 + T + 1.2, 3.3, 0.2, 2.1, M.sheet, { solid: false, r: 0.08 });
    B.box(hx + 0.8, up, z0 + T + 0.1, 3.4, 1.5, 0.2, M.bed, { solid: false, r: 0.06 });
    for (const s of [-1, 1]) B.sphere(hx + 0.8 + s * 0.8, up + 0.85, z0 + T + 0.55, 0.42, M.pillow, { sx: 1.2, sy: 0.4, sz: 0.7, seg: 10 });
    B.box(x1 - T - 0.45, up, hz - 0.6, 0.9, 2.5, 2.6, M.wood, { r: 0.04 });
    for (let k = 0; k < 9; k++) B.box(x1 - T - 0.92, up + 0.3 + k * 0.23, hz - 0.6, 0.04, 0.06, 2.4, M.neck, { solid: false });
    // amp stack with the axe bass on a stand, the desk with a reel-to-reel recorder
    B.box(ax, up, az, 1.3, 1.0, 1.0, M.amp, { r: 0.05 });
    B.box(ax - 0.52, up + 0.12, az, 0.04, 0.75, 0.85, M.ampG, { solid: false, r: 0.02 });
    B.box(ax, up + 0.98, az, 1.2, 0.08, 0.9, M.ampG, { solid: false });
    W.treasure("marcyroom", ax, up + 1.0, az);
    {
      const bx = ax - 1.4, bz = az + 0.2;
      for (const s of [-1, 1]) B.capsule([bx + s * 0.25, up, bz - 0.2], [bx, up + 0.8, bz], 0.03, M.iron, 4);
      const axe = new THREE.Shape();
      axe.moveTo(-0.32, -0.44); axe.lineTo(0.36, -0.24); axe.lineTo(0.24, 0.1); axe.lineTo(0.4, 0.4); axe.lineTo(-0.2, 0.28); axe.lineTo(-0.4, 0);
      axe.closePath();
      const g2 = new THREE.ExtrudeGeometry(axe, { depth: 0.1, bevelEnabled: false });
      B.raw(g2, M.bass, mtx(bx, up + 0.75, bz - 0.05, -Math.PI / 2 + 0.2, 1, 1, 1, 0, 0.1));
      B.box(bx, up + 1.1, bz, 0.1, 1.2, 0.07, M.neck, { solid: false, ry: -Math.PI / 2, rz: 0.1 });
    }
    B.box(hx + 0.6, up, z1 - T - 0.45, 2.6, 0.9, 0.8, M.wood, { r: 0.04 });
    B.box(hx + 0.6, up + 0.9, z1 - T - 0.45, 1.3, 0.35, 0.6, M.ampG, { solid: false, r: 0.04 });
    for (const s of [-1, 1]) B.raw(GEO.cyl(0.22, 0.22, 14), M.amp, mtx(hx + 0.6 + s * 0.35, up + 1.35, z1 - T - 0.55, 0, 1, 0.06, 1, Math.PI / 2));
    B.box(hx - 1.5, up, hz + 0.6, 0.7, 0.6, 0.7, M.sofa, { solid: false, r: 0.2 });
    B.sphere(hx + 0.4, up + 0.03, hz + 0.2, 1.6, M.rugP, { sx: 1.4, sy: 0.02, seg: 18 });
    // a trophy head over the bed
    B.sphere(hx + 0.8, up + 2.3, z0 + T + 0.25, 0.35, toon(0x8a5a3a), { sz: 0.8, seg: 10 });
    for (const s of [-1, 1]) B.capsule([hx + 0.8 + s * 0.2, up + 2.55, z0 + T + 0.25], [hx + 0.8 + s * 0.55, up + 2.85, z0 + T + 0.3], 0.04, M.fence, 4);
  });
  // and back down again (no treasure: the test just checks the way down is open)
  W.course("descer-da-marceline", { x: hx - 1.5, z: hz - 1.2, y: up }, [
    { x: sx0 + 0.72, z: hz - 2.9, y: up }, { x: sx0 + 0.72, z: zs - 0.2, y: g + rise }, { x: hx - 2.6, z: hz + 2.6, y: g },
  ], null, { walk: true });
  W.course("quarto-da-marceline", { x: x1 + 3, z: hz - 0.3 }, [
    { x: x1 - 0.9, z: hz, y: g }, { x: hx - 2.6, z: hz + 2.6, y: g }, { x: sx0 + 0.72, z: zs - 0.2, y: g + rise },
    { x: sx0 + 0.72, z: hz - 2.9, y: up }, { x: hx - 1.5, z: hz - 1.2, y: up }, { x: ax - 1.6, z: az - 0.9, y: up },
  ], "marcyroom", { walk: true });
  {
    const pics = [
      { x: x0 + T + 0.04, y: up + 1.6, z: hz + 3.1, ry: Math.PI / 2, w: 0.9, h: 2.0, draw: paintBanner },
      { x: hx - 2.2, y: up + 1.7, z: z0 + T + 0.04, ry: 0, w: 1.1, h: 0.8, draw: paintWings },
      { x: hx - 0.8, y: g + 2.25, z: z1 - T - 0.04, ry: Math.PI, w: 1.2, h: 0.9, draw: paintPortrait },
    ];
    const pm = pictures(pics);
    W.scene.add(pm);
    B.cullNear(pm, hx, hz, 30);
  }
}

// ── pictures (no words) ──
function paintBanner(c, w, h) { // skull over a flame and a heart, on black
  c.fillStyle = "#1d1a24";
  c.fillRect(0, 0, w, h);
  c.fillStyle = "#f4eee0";
  c.beginPath();
  c.arc(w / 2, h * 0.22, w * 0.22, 0, 7);
  c.fill();
  c.fillRect(w * 0.36, h * 0.28, w * 0.28, h * 0.08);
  c.fillStyle = "#1d1a24";
  for (const s of [-1, 1]) { c.beginPath(); c.arc(w / 2 + s * w * 0.09, h * 0.22, w * 0.06, 0, 7); c.fill(); }
  c.strokeStyle = "#f4eee0";
  c.lineWidth = 5;
  for (const s of [-1, 1]) { c.beginPath(); c.moveTo(w / 2 + s * w * 0.18, h * 0.1); c.lineTo(w / 2 + s * w * 0.34, h * 0.02); c.stroke(); }
  const fl = c.createLinearGradient(0, h * 0.45, 0, h * 0.85);
  fl.addColorStop(0, "#ffd84f");
  fl.addColorStop(1, "#ff5a1e");
  c.fillStyle = fl;
  c.beginPath();
  c.moveTo(w / 2, h * 0.42);
  c.quadraticCurveTo(w * 0.85, h * 0.6, w * 0.6, h * 0.85);
  c.quadraticCurveTo(w / 2, h * 0.7, w * 0.4, h * 0.85);
  c.quadraticCurveTo(w * 0.15, h * 0.6, w / 2, h * 0.42);
  c.fill();
  c.fillStyle = "#e8303a";
  c.beginPath();
  c.moveTo(w / 2, h * 0.96);
  c.bezierCurveTo(w * 0.2, h * 0.86, w * 0.35, h * 0.78, w / 2, h * 0.84);
  c.bezierCurveTo(w * 0.65, h * 0.78, w * 0.8, h * 0.86, w / 2, h * 0.96);
  c.fill();
}
function paintWings(c, w, h) { // the winged-heart plaque over the desk
  c.fillStyle = "#7a4a2a";
  c.fillRect(0, 0, w, h);
  c.fillStyle = "#f4d0e0";
  for (const s of [-1, 1]) {
    c.beginPath();
    c.ellipse(w / 2 + s * w * 0.24, h * 0.45, w * 0.2, h * 0.18, s * 0.3, 0, 7);
    c.fill();
  }
  c.fillStyle = "#e8303a";
  c.beginPath();
  c.arc(w / 2, h * 0.5, h * 0.16, 0, 7);
  c.fill();
}
function paintPortrait(c, w, h) { // a gold-framed portrait (Marceline's dad, looking stern)
  c.fillStyle = "#c9962b";
  c.fillRect(0, 0, w, h);
  c.fillStyle = "#3a5a7a";
  c.fillRect(w * 0.1, h * 0.1, w * 0.8, h * 0.8);
  c.fillStyle = "#b8c8d0";
  c.beginPath();
  c.ellipse(w / 2, h * 0.5, w * 0.16, h * 0.24, 0, 0, 7);
  c.fill();
  c.fillStyle = "#1d1a24";
  c.fillRect(w * 0.3, h * 0.72, w * 0.4, h * 0.18);
}
