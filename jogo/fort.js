// The Tree Fort: a weeping-willow tree house you can explore inside.
// Ground: entrance shack / treasure room -> hollow trunk (ladders, landing,
// door to the outside deck) -> living room -> bedroom -> attic -> roof -> boat.
import * as THREE from "three";
import { toon } from "./toon.js";
import { discShape, ringShape, GEO, mtx, pictures } from "./builder.js";
import { boxCollider, cylCollider, ringCollider, addLadder } from "./physics.js";
import { rng } from "./terrain.js";

export function buildFort(B, W) {
  const g = W.ground(0, 0);
  const F1 = g + 16, F2 = g + 22, F3 = g + 28, R = g + 33.5;
  const TAU = Math.PI * 2;
  const r = rng(4242);

  const M = {
    bark: toon(0x9c6b3c, { tex: "bark", scale: 0.2 }),
    barkD: toon(0x7c5230, { tex: "bark", scale: 0.22 }),
    wood: toon(0xb98652, { tex: "wood", scale: 0.28 }),
    woodD: toon(0x8a5d36, { tex: "wood", scale: 0.3 }),
    wallIn: toon(0xa77847, { tex: "wood", scale: 0.3, side: THREE.BackSide, outline: false }),
    floor: toon(0xd2b27a, { tex: "planks", scale: 0.2 }),
    roof: toon(0x6f82a0, { tex: "shingle", scale: 0.4 }),
    leaf: toon(0x72cc3f, { tex: "drape", scale: 0.1, side: THREE.DoubleSide }),
    leafD: toon(0x55b22e, { tex: "drape", scale: 0.12 }),
    glass: toon(0x6cc4f0, { emissive: 0x16384a }),
    frame: toon(0x6b4423),
    red: toon(0xc8372d),
    redSoft: toon(0xd9534a),
    gold: toon(0xf6c343, { emissive: 0x4a3000 }),
    coin: toon(0xffd54f, { emissive: 0x5a3c00, outline: false }),
    stone: toon(0xb8b3a8, { tex: "stone", scale: 0.35 }),
    iron: toon(0x3d3d48),
    white: toon(0xf4f1e8),
    rope: toon(0xd8b777, { outline: false }),
    couch: toon(0x8b5a3c),
    pelt1: toon(0x7a5b44), pelt2: toon(0x9a8a7a), pelt3: toon(0x5e4a6e),
    bag: toon(0x9fd0ef),
    water: toon(0x5ec3e8, { emissive: 0x0a2a3a, outline: false }),
    pad: toon(0x5cba3c),
    tv: toon(0x7d7f86),
    screen: toon(0x3aa38f, { emissive: 0x0f3a33 }),
    yellow: toon(0xf7d44a),
    orange: toon(0xf28b2e),
    green: toon(0x3f9a4a),
    rust: toon(0x8a6446, { tex: "wood", scale: 0.4 }),
    rug: toon(0x6f6284),
    rugRed: toon(0xc0443a),
    lamp: toon(0xffe08a, { emissive: 0xc08a20 }),
    sofa: toon(0x8e2a2e), sofaD: toon(0x6e1c22),
    fridge: toon(0xf2f0ea), steel: toon(0xb8c0c8), pot: toon(0x5a5f6a),
    can1: toon(0xf06a8a), can2: toon(0xf5a04a), canTop: toon(0xd8d8d8),
    knot: toon(0x3a2616, { outline: false }),
    blade: toon(0xdfe6ee), hilt: toon(0x7a4a22), guard: toon(0xd9a53a),
    armor: toon(0xa9b2bc), armorD: toon(0x7c8590),
    hand: toon(0x4f7fd0), cloth: toon(0x5fa84a), strap: toon(0x3f7a34),
    shield1: toon(0xc8372d), shield2: toon(0x2e6fc1),
    tank: toon(0x6f7a5a, { tex: "rock", scale: 0.3 }), tankD: toon(0x4a5240), rustM: toon(0x9a5a34),
    moss: toon(0x5fae3a),
    smoke: toon(0xe8ecf0, { emissive: 0x303030 }),
  };

  // ── helpers ──
  const ladder = (x, z, y0, y1, face, exit) => {
    addLadder({ x, z, y0, y1, fx: face[0], fz: face[1], ex: exit[0], ez: exit[1] });
    const px = -face[1], pz = face[0];
    const bx = x + face[0] * 0.28, bz = z + face[1] * 0.28;
    for (const s of [-1, 1]) B.cyl(bx + px * 0.42 * s, y0, bz + pz * 0.42 * s, 0.07, y1 - y0 + 1.0, M.woodD, { solid: false, seg: 6 });
    for (let y = y0 + 0.35; y < y1 + 0.9; y += 0.45) B.capsule([bx - px * 0.42, y, bz - pz * 0.42], [bx + px * 0.42, y, bz + pz * 0.42], 0.05, M.wood, 6);
  };
  // disc floor with an optional square hatch; colliders are strips that follow the circle
  const floor = (y, rad, hatch, mat = M.floor, visual = true) => {
    if (visual) B.slab(discShape(rad, hatch), 0.5, mat, 0, y - 0.5, 0);
    const bounds = [];
    for (let z = -rad; z < rad; z += 1.4) bounds.push(z);
    bounds.push(rad);
    if (hatch) bounds.push(hatch[1] - hatch[2] / 2, hatch[1] + hatch[2] / 2);
    bounds.sort((a, b) => a - b);
    const zs = bounds.filter((v, i) => i === 0 || v - bounds[i - 1] > 0.15);
    for (let i = 0; i + 1 < zs.length; i++) {
      const z0 = zs[i], z1 = zs[i + 1];
      const hw = Math.sqrt(Math.max(0, rad * rad - Math.max(z0 * z0, z1 * z1)));
      if (hw < 0.3) continue;
      if (hatch && z0 >= hatch[1] - hatch[2] / 2 - 0.01 && z1 <= hatch[1] + hatch[2] / 2 + 0.01) {
        const hx0 = hatch[0] - hatch[2] / 2, hx1 = hatch[0] + hatch[2] / 2;
        if (hx0 > -hw) boxCollider(-hw, hx0, y - 0.5, y, z0, z1);
        if (hx1 < hw) boxCollider(hx1, hw, y - 0.5, y, z0, z1);
      } else boxCollider(-hw, hw, y - 0.5, y, z0, z1);
    }
    if (hatch && visual) {
      const [hx, hz, hs] = hatch;
      for (const [dx, dz, w, d] of [[0, -hs / 2, hs + 0.3, 0.15], [0, hs / 2, hs + 0.3, 0.15], [-hs / 2, 0, 0.15, hs], [hs / 2, 0, 0.15, hs]])
        B.box(hx + dx, y, hz + dz, w, 0.12, d, M.frame, { solid: false });
    }
  };
  const window = (x, y, z, ry, w = 1.4, h = 1.7) => {
    B.box(x, y - h / 2 - 0.25, z, w + 0.5, h + 0.5, 0.25, M.frame, { solid: false, ry });
    B.box(x + Math.sin(ry) * 0.06, y - h / 2, z + Math.cos(ry) * 0.06, w, h, 0.22, M.glass, { solid: false, ry });
    B.box(x + Math.sin(ry) * 0.1, y - h / 2, z + Math.cos(ry) * 0.1, 0.1, h, 0.24, M.frame, { solid: false, ry });
  };
  // window on the inside of the round room wall (radius ~9.9) at angle a
  const innerWindow = (a, y) => window(Math.sin(a) * 9.85, y, Math.cos(a) * 9.85, a + Math.PI);
  const rt = (y) => 6.6 - y * 0.08; // trunk outer radius at height y above g
  const at = (a, rr) => [Math.sin(a) * rr, Math.cos(a) * rr];
  // canvas pictures on the round walls, all in one mesh (built at the end)
  const pics = [];
  const hang = (a, y, w, h, draw, frame = true, rad = 9.8) => {
    if (frame) B.box(Math.sin(a) * (rad + 0.02), y - h / 2 - 0.12, Math.cos(a) * (rad + 0.02), w + 0.24, h + 0.24, 0.1, M.frame, { solid: false, ry: a });
    pics.push({ x: Math.sin(a) * (rad - 0.06), y, z: Math.cos(a) * (rad - 0.06), ry: a + Math.PI, w, h, draw });
  };
  // limbs of the tree growing from floor y0 to ceiling y1 along the wall, with knotholes
  const treeLimbs = (y0, y1, angles) => {
    for (const a of angles) {
      const [x, z] = at(a, 8.8), [mx, mz] = at(a + 0.12, 8.2);
      B.branch([[x, y0 - 0.3, z], [mx, (y0 + y1) / 2, mz], [x, y1 - 0.4, z]], 1.05, 0.75, M.bark, 10);
      for (const [t, s] of [[0.3, 0.34], [0.72, 0.24]]) {
        const [kx, kz] = at(a + 0.1, 7.55);
        B.sphere(kx, y0 + (y1 - y0) * t, kz, s, M.knot, { sx: 0.9, sy: 1.7, sz: 0.4, ry: a });
      }
      cylCollider(x, z, 0.95, y0 - 0.5, y1 - 0.4);
    }
  };
  // a little box window sticking out of the leaves, with a sill and a shingle hood
  const boxWindow = (x, y, z, ry, w = 1.4, h = 1.7) => {
    const sx = Math.sin(ry), sz = Math.cos(ry), o = (d) => [x + sx * d, z + sz * d];
    let [px, pz] = o(0.15);
    B.box(px, y - h / 2 - 0.35, pz, w + 0.7, h + 0.7, 0.8, M.wood, { solid: false, ry, r: 0.08 });
    [px, pz] = o(0.52);
    B.box(px, y - h / 2, pz, w, h, 0.1, M.glass, { solid: false, ry });
    [px, pz] = o(0.58);
    B.box(px, y - h / 2, pz, 0.09, h, 0.06, M.frame, { solid: false, ry });
    B.box(px, y - 0.05 - h / 2 + h / 2, pz, w, 0.09, 0.06, M.frame, { solid: false, ry });
    [px, pz] = o(0.6);
    B.box(px, y - h / 2 - 0.45, pz, w + 1.0, 0.14, 0.6, M.woodD, { solid: false, ry });
    [px, pz] = o(0.3);
    B.gable(px, y + 0.35, pz, w + 1.1, 0.6, 1.2, M.roof, ry);
  };

  // ── trunk (hollow, in four height bands; A and C have doorways) ──
  const bandProfile = (y0, y1, inset = 0) => [[rt(y0) - inset, y0], [rt((y0 + y1) / 2) - inset, (y0 + y1) / 2], [rt(y1) - inset, y1]];
  const A = [[8.8, 0], [7.4, 0.6], [6.7, 1.8], [rt(3.6), 3.6]];
  B.lathe(A, M.bark, 0, g, 0, { seg: 32, ps: 0.55, pl: TAU - 1.1 });
  B.lathe(bandProfile(0, 3.6, 0.8), M.wallIn, 0, g, 0, { seg: 32, ps: 0.55, pl: TAU - 1.1 });
  B.lathe(bandProfile(3.6, 8), M.bark, 0, g, 0, { seg: 32 });
  B.lathe(bandProfile(3.6, 8, 0.8), M.wallIn, 0, g, 0, { seg: 32 });
  const cDoor = 3.927; // back-left
  B.lathe(bandProfile(8, 11), M.bark, 0, g, 0, { seg: 32, ps: cDoor + 0.3, pl: TAU - 0.6 });
  B.lathe(bandProfile(8, 11, 0.8), M.wallIn, 0, g, 0, { seg: 32, ps: cDoor + 0.3, pl: TAU - 0.6 });
  B.lathe(bandProfile(11, 15.5), M.bark, 0, g, 0, { seg: 32 });
  B.lathe(bandProfile(11, 15.5, 0.8), M.wallIn, 0, g, 0, { seg: 32 });
  // wooden floors in the shack and inside the trunk
  B.box(0, g - 0.08, 7.9, 11.8, 0.12, 10.6, M.floor, { solid: false, r: 0.02 });
  B.raw(GEO.circle(28), M.floor, mtx(0, g + 0.012, 0, 0, rt(0.5) - 0.8, rt(0.5) - 0.8, 1, -Math.PI / 2));
  ringCollider(0, 0, rt(1.8) - 0.4, 1.0, g - 1, g + 3.6, [[0, 1.1]]);
  ringCollider(0, 0, rt(6) - 0.4, 1.0, g + 3.6, g + 8);
  ringCollider(0, 0, rt(9.5) - 0.4, 1.0, g + 8, g + 11, [[-2.356, 0.62]]);
  ringCollider(0, 0, rt(13.5) - 0.4, 1.0, g + 11, F1 - 0.4);
  // door frame to the deck
  for (const s of [-1, 1]) {
    const a = cDoor + s * 0.3, rr = rt(9.5) - 0.4;
    B.box(Math.sin(a) * rr, g + 8, Math.cos(a) * rr, 0.35, 3.1, 1.1, M.frame, { solid: false, ry: a });
  }
  // roots
  for (const a of [1.2, 2.2, 3.1, 3.9, 5.1, 5.7]) {
    const s = Math.sin(a), c = Math.cos(a);
    B.branch([[s * 5.6, g + 1.8, c * 5.6], [s * 8.2, g + 0.5, c * 8.2], [s * 11, g - 0.3, c * 11]], 1.5, 0.35, M.bark, 12);
  }

  // ── entrance shack = treasure room ──
  const woodWall = (x, z, w, d, h = 4.2, y = g) => B.box(x, y, z, w, h, d, M.wood, { r: 0.05 });
  woodWall(-6, 7.75, 0.4, 10.5);
  woodWall(6, 7.75, 0.4, 10.5);
  woodWall(-3.5, 12.8, 5, 0.4);
  woodWall(3.5, 12.8, 5, 0.4);
  B.box(0, g + 2.8, 12.8, 2, 1.4, 0.4, M.wood, { r: 0.05 });
  B.box(0, g + 4.2, 7.75, 12.6, 0.35, 11, M.woodD, { r: 0.05 });
  B.gable(0, g + 4.55, 7.9, 13.6, 3.0, 11.8, M.roof);
  B.gable(-3.3, g + 4.55, 11.6, 5.6, 2.4, 4.6, M.roof, Math.PI / 2);
  B.gable(3.8, g + 4.55, 4.2, 4.6, 2.0, 3.6, M.roof, Math.PI / 2);
  boxCollider(-2.2, 2.2, g + 4.55, g + 6.4, 2.5, 13.2);
  B.cyl(4.2, g + 5.5, 9.5, 0.35, 2.4, M.iron, { solid: false, seg: 8 });
  for (const [dx, w, h] of [[-1.1, 0.25, 2.9], [1.1, 0.25, 2.9]]) B.box(dx, g, 13.05, w, h, 0.3, M.frame, { solid: false });
  B.box(0, g + 2.8, 13.05, 2.5, 0.25, 0.3, M.frame, { solid: false });
  B.box(-1.95, g + 0.02, 12.35, 1.9, 2.7, 0.14, M.red, { solid: false });
  B.sphere(-1.2, g + 1.35, 12.25, 0.08, M.gold);
  B.box(0, g - 0.2, 13.8, 3.2, 0.32, 1.3, M.stone, { solid: false });
  for (const s of [-1, 1]) {
    window(s * 6.22, g + 3, 5.8, s * Math.PI / 2, 1.3, 1.4);
    window(s * 6.22, g + 3, 10.2, s * Math.PI / 2, 1.3, 1.4);
  }
  window(3.6, g + 3.3, 13.02, 0, 1.2, 1.2);
  // treasure piles, coins and junk
  const pile = (x, z, rad, sy, top) => {
    B.sphere(x, g, z, rad, M.gold, { sy });
    cylCollider(x, z, rad * 0.8, g - 0.5, g + top, false);
    for (let i = 0; i < 26; i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * rad * 0.9;
      const cx = x + Math.cos(a) * d, cz = z + Math.sin(a) * d;
      const cy = g + sy * rad * Math.sqrt(Math.max(0, 1 - (d * d) / (rad * rad)));
      B.raw(GEO.cyl(0.2, 0.2, 10), M.coin, mtx(cx, cy + 0.02, cz, r() * 3, 1, 0.06, 1, (r() - 0.5) * 0.8, (r() - 0.5) * 0.8));
    }
  };
  pile(-3, 8.4, 2.6, 0.5, 1.25);
  pile(3.1, 9.9, 1.9, 0.45, 0.8);
  pile(2.8, 1.6, 1.6, 0.45, 0.65);
  for (const [x, z, c] of [[-2.2, 7.4, 0xe53935], [-3.8, 9.2, 0x42a5f5], [2.6, 9.4, 0x66bb6a], [-2.6, 9.6, 0xab47bc]])
    B.raw(new THREE.OctahedronGeometry(0.3), toon(c, { emissive: 0x111111 }), mtx(x, g + 1.0, z, r() * 3));
  for (let i = 0; i < 40; i++) {
    const x = (r() - 0.5) * 10, z = 3.5 + r() * 8.8;
    B.raw(GEO.cyl(0.2, 0.2, 10), M.coin, mtx(x, g + 0.03, z, 0, 1, 0.05, 1));
  }
  B.box(4.7, g, 5.2, 1.6, 1.3, 1.2, M.tv);
  B.box(4.7, g + 0.25, 4.58, 1.1, 0.8, 0.06, M.screen, { solid: false });
  B.box(4.8, g + 1.3, 5.3, 0.9, 0.12, 0.7, M.tv, { solid: false });
  B.box(4.1, g, 7.3, 1.1, 0.35, 0.9, toon(0x9e9e9e), { solid: false });
  B.sphere(-4.7, g + 0.55, 5.2, 0.55, M.white, { sy: 0.9 });
  for (const s of [-1, 1]) B.sphere(-4.7 + s * 0.2, g + 0.62, 5.68, 0.12, M.iron);
  B.plank([-4.7, g + 0.8, 5.2], [-4.9, g + 2.3, 5.0], 0.12, 0.05, toon(0xcfd8dc));
  B.raw(GEO.torus(0.7, 0.28, TAU, 20), M.yellow, mtx(-4.6, g + 0.28, 11.3, 0, 1, 1, 1, Math.PI / 2));
  B.sphere(-4.0, g + 0.62, 11.3, 0.3, M.yellow);
  B.cone(-3.7, g + 0.55, 11.3, 0.12, 0.25, M.orange, { rz: -Math.PI / 2, seg: 8 });
  B.sphere(0, g + 3.4, 8, 0.32, M.lamp);
  B.cyl(0, g + 3.6, 8, 0.03, 0.6, M.iron, { solid: false, seg: 4 });
  W.treasure("treasureroom", -3, g + 1.25, 8.4);
  B.inside(0, 0, 34, () => {
    // a crown and a sword on the big pile, an open chest of coins, a trophy
    B.cyl(-1.9, g + 1.0, 7.6, 0.42, 0.3, M.gold, { solid: false, open: true, seg: 14, rx: 0.25 });
    for (let k = 0; k < 6; k++) B.cone(-1.9 + Math.sin(k * 1.05) * 0.4, g + 1.25, 7.6 + Math.cos(k * 1.05) * 0.4, 0.1, 0.35, M.gold, { seg: 5 });
    for (const [dx, c] of [[0.42, 0xe53935], [-0.42, 0x42a5f5]]) B.sphere(-1.9 + dx, g + 1.12, 7.6, 0.09, toon(c, { emissive: 0x220000 }), { seg: 6 });
    B.box(-4.3, g + 0.9, 9.3, 0.14, 1.4, 0.05, M.blade, { solid: false, rz: 0.35, rx: 0.2 });
    B.box(-4.55, g + 2.15, 9.2, 0.55, 0.1, 0.12, M.guard, { solid: false, rz: 0.35 });
    B.capsule([-4.64, g + 2.2, 9.2], [-4.82, g + 2.6, 9.1], 0.05, M.hilt, 5);
    B.box(4.4, g, 11.5, 1.8, 0.9, 1.1, M.wood, { r: 0.06 });
    B.box(4.4, g + 0.85, 12.05, 1.85, 0.12, 1.1, M.woodD, { solid: false, rx: -1.2, r: 0.04 });
    B.sphere(4.4, g + 0.85, 11.5, 0.75, M.gold, { sx: 1.15, sy: 0.3, sz: 0.65 });
    B.cyl(3.0, g + 0.7, 1.9, 0.1, 0.35, M.gold, { solid: false, seg: 8 });
    B.lathe([[0.01, 0], [0.3, 0.02], [0.42, 0.3], [0.4, 0.55], [0.01, 0.5]], M.gold, 3.0, g + 1.05, 1.9, { seg: 14 });
    for (const s of [-1, 1]) B.raw(GEO.torus(0.14, 0.04, Math.PI, 8), M.gold, mtx(3.0 + s * 0.42, g + 1.4, 1.9, 0, 1, 1, 1, 0, s * Math.PI / 2));
  });

  // ── inside the trunk: landing + ladders ──
  B.box(-0.3, g + 7.6, -3.1, 7, 0.4, 2.6, M.floor);
  B.box(-3.9, g + 7.6, -3.9, 1.8, 0.4, 1.8, M.floor);
  ladder(-2.0, -1.25, g, g + 8, [0, -1], [0, -1]);
  ladder(1.8, -3.4, g + 8, F1, [0, -1], [0, 1]);
  ladder(-11.05, 0, g, g + 8, [1, 0], [1, 0]);

  // ── outside deck around the trunk ──
  B.slab(ringShape(5.9, 10.6), 0.4, M.floor, 0, g + 7.6, 0);
  ringCollider(0, 0, 8.3, 4.2, g + 7.6, g + 8);
  for (let k = 0; k < 20; k++) {
    const a = (k / 20) * TAU;
    if (Math.abs(Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2))) < 0.2) continue;
    B.cyl(Math.sin(a) * 10.3, g + 8, Math.cos(a) * 10.3, 0.1, 1.1, M.woodD, { solid: false, seg: 6 });
  }
  const railPts = [];
  for (let k = 0; k <= 40; k++) {
    const a = -Math.PI / 2 + 0.2 + (k / 40) * (TAU - 0.4);
    railPts.push([Math.sin(a) * 10.3, g + 9, Math.cos(a) * 10.3]);
  }
  B.tube(railPts, 0.06, M.rope, { seg: 80, radial: 5 });

  // ── rooms inside the canopy ──
  B.cyl(0, F1, 0, 10, R - F1, M.wallIn, { open: true, solid: false, seg: 48 });
  ringCollider(0, 0, 10.35, 0.6, F1, R + 0.2);
  for (const y of [F2 - 0.25, F3 - 0.25]) B.raw(GEO.torus(9.9, 0.18, TAU, 48), M.woodD, mtx(0, y, 0, 0, 1, 1, 1, Math.PI / 2));

  // living room: red sectional sofa around a round table, kitchen corner, wood stove,
  // BMO on his little table, branches of the tree growing through the room
  floor(F1, 10.2, [1.8, -3.4, 2.4]);
  for (const a of [0.55, 2.3, 4.5, 5.5]) innerWindow(a, F1 + 3.4);
  B.inside(0, 0, 34, () => {
    // curved sectional along the back wall
    const s0 = 3.3, s1 = 4.25, n = 5, seatW = ((s1 - s0) / n) * 8.2 + 0.2;
    for (let k = 0; k < n; k++) {
      const a = s0 + ((k + 0.5) / n) * (s1 - s0), [x, z] = at(a, 8.1), [bx, bz] = at(a, 9.0);
      B.box(x, F1, z, seatW, 0.72, 1.55, M.sofa, { solid: false, ry: a, r: 0.22 });
      B.box(bx, F1 + 0.35, bz, seatW + 0.05, 1.45, 0.55, M.sofaD, { solid: false, ry: a, r: 0.22 });
      cylCollider(x, z, 0.8, F1 - 0.2, F1 + 0.72, false);
    }
    for (const a of [s0 - 0.05, s1 + 0.05]) {
      const [x, z] = at(a, 8.3);
      B.box(x, F1, z, 0.5, 1.1, 2.1, M.sofaD, { solid: false, ry: a, r: 0.2 });
    }
    // round coffee table on a rug, with a mug and a comic book
    const [tx, tz] = at(3.8, 5.4);
    B.sphere(tx, F1 + 0.03, tz, 2.8, M.rug, { sy: 0.02, seg: 24 });
    B.cyl(tx, F1 + 0.62, tz, 1.35, 0.14, M.woodD, { solid: false, seg: 20 });
    for (let k = 0; k < 4; k++) B.cyl(tx + Math.cos(k * 1.57 + 0.4) * 0.95, F1, tz + Math.sin(k * 1.57 + 0.4) * 0.95, 0.09, 0.62, M.woodD, { solid: false, seg: 6 });
    cylCollider(tx, tz, 1.35, F1 - 0.2, F1 + 0.76, false);
    B.cyl(tx + 0.4, F1 + 0.76, tz - 0.2, 0.16, 0.3, M.white, { solid: false, seg: 10 });
    B.raw(GEO.torus(0.09, 0.03, TAU, 10), M.white, mtx(tx + 0.58, F1 + 0.92, tz - 0.2, 0, 1, 1, 1, 0, Math.PI / 2));
    B.box(tx - 0.4, F1 + 0.76, tz + 0.2, 0.7, 0.04, 0.5, M.yellow, { solid: false, ry: 0.4 });
    // Jake's viola leaning under the clock
    {
      const [vx, vz] = at(Math.PI + 0.12, 9.1);
      B.sphere(vx, F1 + 0.55, vz, 0.42, M.orange, { sx: 1, sy: 1.1, sz: 0.35, ry: 0.12 });
      B.sphere(vx, F1 + 1.15, vz, 0.33, M.orange, { sx: 1, sy: 1.0, sz: 0.35, ry: 0.12 });
      B.box(vx, F1 + 1.3, vz, 0.12, 1.2, 0.08, M.frame, { solid: false, ry: 0.12 });
      B.sphere(vx, F1 + 2.55, vz, 0.1, M.frame, { seg: 6 });
    }
    // kitchen corner: counters with a sink under the window, fridge, hanging pots, jar shelf
    for (const [a, sink] of [[0.4, false], [0.7, true], [1.0, false]]) {
      const [x, z] = at(a, 8.75);
      B.box(x, F1, z, 2.35, 1.0, 1.1, M.wood, { ry: a, r: 0.05 });
      B.box(x, F1 + 1.0, z, 2.45, 0.12, 1.25, M.woodD, { solid: false, ry: a, r: 0.03 });
      const [fx, fz] = at(a, 8.17);
      for (const s of [-0.55, 0.55]) {
        const dx = Math.cos(a) * s, dz = -Math.sin(a) * s;
        B.box(fx + dx, F1 + 0.15, fz + dz, 1.0, 0.7, 0.05, M.woodD, { solid: false, ry: a, r: 0.02 });
        B.sphere(fx + dx * 0.4, F1 + 0.75, fz + dz * 0.4, 0.05, M.gold, { seg: 5 });
      }
      if (sink) {
        const [sx, sz] = at(a, 8.7), [kx, kz] = at(a, 9.2);
        B.box(sx, F1 + 1.05, sz, 1.1, 0.1, 0.75, M.steel, { solid: false, ry: a, r: 0.03 });
        B.capsule([kx, F1 + 1.1, kz], [kx, F1 + 1.55, kz], 0.05, M.steel, 6);
        B.capsule([kx, F1 + 1.55, kz], [sx, F1 + 1.5, sz], 0.05, M.steel, 6);
      }
    }
    {
      const a = 1.35, [x, z] = at(a, 8.55);
      B.box(x, F1, z, 1.45, 2.9, 1.25, M.fridge, { ry: a, r: 0.25 });
      const [fx, fz] = at(a, 7.9);
      B.box(fx, F1 + 1.95, fz, 1.35, 0.04, 0.06, M.steel, { solid: false, ry: a });
      for (const [y, h] of [[2.2, 0.5], [0.9, 0.8]]) B.box(fx + Math.cos(a) * 0.5, F1 + y, fz - Math.sin(a) * 0.5, 0.08, h, 0.08, M.steel, { solid: false, ry: a });
      B.sphere(fx - Math.cos(a) * 0.3, F1 + 2.5, fz + Math.sin(a) * 0.3, 0.12, M.red, { seg: 6, sz: 0.3, ry: a });
      // pots hanging from a rail above the right counter
      const [r0x, r0z] = at(0.88, 9.3), [r1x, r1z] = at(1.12, 9.3);
      B.capsule([r0x, F1 + 2.9, r0z], [r1x, F1 + 2.9, r1z], 0.04, M.iron, 5);
      for (let k = 0; k < 3; k++) {
        const t = (k + 0.5) / 3, px = r0x + (r1x - r0x) * t, pz = r0z + (r1z - r0z) * t;
        B.capsule([px, F1 + 2.9, pz], [px, F1 + 2.5, pz], 0.02, M.iron, 4);
        B.cyl(px, F1 + 2.0 - k * 0.1, pz, 0.28 - k * 0.04, 0.38, M.pot, { solid: false, seg: 10 });
      }
      // jars on a wall shelf
      const [jx, jz] = at(1.75, 9.6);
      B.box(jx, F1 + 2.1, jz, 2.2, 0.1, 0.5, M.woodD, { solid: false, ry: 1.75 });
      [0xff7a7a, 0xffd84f, 0x9dff6b, 0xc27bff].forEach((c, k) => {
        const s = (k - 1.5) * 0.5, x2 = jx + Math.cos(1.75) * s, z2 = jz - Math.sin(1.75) * s;
        B.cyl(x2, F1 + 2.2, z2, 0.17, 0.42, toon(c), { solid: false, seg: 8 });
        B.cyl(x2, F1 + 2.62, z2, 0.18, 0.08, M.woodD, { solid: false, seg: 8 });
      });
    }
    // stacked cans (Jake's collection) by the stove, firewood on the other side
    {
      const a = 5.02, [cx, cz] = at(a, 8.7), tx2 = Math.cos(a), tz2 = -Math.sin(a);
      for (let row = 0; row < 4; row++)
        for (let i = 0; i < 4 - row; i++)
          for (const d of [0, 0.5]) {
            const o = (i - (3 - row) / 2) * 0.5, x = cx + tx2 * o - Math.sin(a) * d, z = cz + tz2 * o - Math.cos(a) * d;
            B.cyl(x, F1 + row * 0.5, z, 0.23, 0.48, (row + i) % 2 ? M.can1 : M.can2, { solid: false, seg: 9 });
            B.cyl(x, F1 + row * 0.5 + 0.47, z, 0.2, 0.03, M.canTop, { solid: false, seg: 9 });
          }
      cylCollider(cx, cz, 1.1, F1 - 0.2, F1 + 2, false);
      const [lx, lz] = at(4.52, 8.7);
      for (let k = 0; k < 6; k++) {
        const y = F1 + 0.22 + Math.floor(k / 3) * 0.42, o = ((k % 3) - 1) * 0.45 + (k >= 3 ? 0.22 : 0);
        B.capsule([lx - 0.7, y, lz + o], [lx + 0.7, y, lz + o], 0.2, k % 2 ? M.bark : M.barkD, 7);
      }
      cylCollider(lx, lz, 1.0, F1 - 0.2, F1 + 0.9, false);
    }
    // white cooler chest
    {
      const a = 5.65, [x, z] = at(a, 8.4);
      B.box(x, F1, z, 1.7, 1.05, 1.05, M.fridge, { ry: a, r: 0.18 });
      B.box(x, F1 + 1.02, z, 1.75, 0.16, 1.1, M.white, { solid: false, ry: a, r: 0.06 });
      B.box(x, F1 + 0.55, z, 1.72, 0.06, 1.07, M.steel, { solid: false, ry: a, r: 0.02 });
    }
    treeLimbs(F1, F2, [2.6, 6.2]);
  });
  B.cyl(6.3, F1, -4.9, 1.5, 0.75, M.redSoft);
  B.raw(GEO.torus(1.4, 0.35, Math.PI * 1.3, 16), M.redSoft, mtx(6.3, F1 + 0.95, -4.9, 2.1, 1, 1, 1, Math.PI / 2));
  B.box(0.8, F1, 1.5, 1.5, 0.6, 1.1, M.woodD);
  B.box(-8.2, F1, 0.6, 1.4, 1.5, 1.4, M.iron);
  B.cyl(-8.2, F1 + 1.5, 0.6, 0.22, F2 - F1 - 1.8, M.iron, { solid: false, seg: 8 });
  B.sphere(-8.2, F1 + 0.75, 1.32, 0.25, toon(0xff7a1a, { emissive: 0xaa3300 }), { sy: 0.8 });
  B.raw(GEO.cyl(0.95, 0.95, 24), M.woodD, mtx(0, F1 + 3.8, -9.75, 0, 1, 0.15, 1, Math.PI / 2));
  B.raw(GEO.cyl(0.8, 0.8, 24), M.white, mtx(0, F1 + 3.8, -9.66, 0, 1, 0.05, 1, Math.PI / 2));
  B.box(0, F1 + 3.8, -9.6, 0.08, 0.6, 0.04, M.iron, { solid: false });
  B.box(0.2, F1 + 3.75, -9.6, 0.45, 0.08, 0.04, M.iron, { solid: false });
  B.sphere(0, F2 - 1.0, 0, 0.35, M.lamp);
  hang(3.78, F1 + 3.2, 2.7, 1.6, paintMountains);
  W.npc("bmo", 0.8, 1.5, 0.3, { y: F1 + 0.6 });
  W.npc("billy", -4.5, 24, 0.5); // out front, where Finn starts (billy.js moves him to the temple later)

  // bedroom
  floor(F2, 10.2, [-6.5, 4, 2.4]);
  ladder(-6.5, 4, F1, F2, [-0.83, 0.55], [0.8, -0.6]);
  for (const a of [1.2, 2.8, 4.4, 5.9]) innerWindow(a, F2 + 3.4);
  B.sphere(-5.5, F2 + 0.2, -4.5, 2.0, M.pelt1, { sx: 1.3, sy: 0.25, sz: 0.9 });
  B.sphere(-5.3, F2 + 0.45, -4.4, 1.7, M.pelt2, { sx: 1.2, sy: 0.22, sz: 0.8 });
  B.sphere(-5.7, F2 + 0.62, -4.6, 1.3, M.pelt3, { sx: 1.1, sy: 0.18, sz: 0.7 });
  B.capsule([-6.6, F2 + 0.95, -4.5], [-4.2, F2 + 0.95, -4.5], 0.55, M.bag, 12);
  B.sphere(-7.0, F2 + 1.0, -4.5, 0.6, M.white, { sx: 0.7, sy: 0.6 });
  cylCollider(-5.5, -4.5, 2.1, F2 - 0.3, F2 + 0.75, false);
  {
    const dx = 0.774, dz = 0.633, jx = -dx * 9.7, jz = -dz * 9.7, ry = Math.atan2(dx, dz);
    B.raw(GEO.torus(0.85, 0.14, TAU, 20), M.white, mtx(jx, F2 + 3.4, jz, ry, 1, 0.7, 1));
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * TAU, lx = Math.cos(a) * 0.75, ly = Math.sin(a) * 0.52;
      B.raw(GEO.cone(6), M.white, mtx(jx + Math.cos(ry) * lx, F2 + 3.4 + ly, jz - Math.sin(ry) * lx, ry, 0.08, 0.25, 0.08, 0, a + Math.PI / 2));
    }
  }
  B.cyl(1.5, F2 + 3.8, -1.5, 0.04, F3 - F2 - 4.3, M.iron, { solid: false, seg: 4 });
  B.sphere(1.5, F2 + 3.6, -1.5, 0.5, M.iron);
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU, b = (k % 3) * 0.6 - 0.6;
    const dx = Math.cos(a) * Math.cos(b), dy = Math.sin(b), dz = Math.sin(a) * Math.cos(b);
    B.cone(1.5 + dx * 0.55, F2 + 3.6 + dy * 0.55 - 0.15, -1.5 + dz * 0.55, 0.12, 0.3, toon(0xcfd8dc), { seg: 6, rx: Math.atan2(dz, dy), rz: -Math.atan2(dx, dy) });
  }
  B.box(6.8, F2, -3.8, 1.4, 2.8, 2.6, M.wood);
  B.box(5.5, F2 + 0.35, -3.8, 1.3, 0.55, 2.1, M.woodD);
  B.sphere(5.4, F2 + 1.0, -3.4, 0.55, M.white, { sx: 0.9, sy: 0.35 });
  for (const y of [1.6, 2.3]) B.sphere(6.05, F2 + y, -3.8, 0.1, M.gold);
  B.box(6.8, F2 + 2.8, -3.2, 0.5, 0.2, 1.4, toon(0x8d5a2b), { solid: false });
  W.treasure("bedroom", 5.3, F2 + 0.9, -4.2);
  {
    const pts = [[-9.6, F2 + 1.2, 7.2], [0, F2 + 2.0, 7.0], [9.6, F2 + 2.7, 6.1]];
    B.branch(pts, 0.95, 0.75, M.bark, 16);
    for (let t = 0; t <= 1.001; t += 1 / 9) {
      const x = -9.6 + 19.2 * t, y = F2 + 1.2 + 1.5 * t, z = 7.2 - 1.1 * t * t;
      cylCollider(x, z, 0.8, y - 0.85, y + 0.8);
    }
    B.box(1.5, F2 + 2.75, 6.95, 1.8, 0.12, 1.0, M.woodD, { solid: false });
    B.cyl(1.2, F2 + 2.87, 6.9, 0.2, 0.45, toon(0xbfe8ff, { opacity: 0.7 }), { solid: false, seg: 10 });
  }
  B.sphere(0.5, F2 + 0.03, 1.2, 2.0, M.pelt3, { sy: 0.02 });
  B.plank([3.5, F2, 1.8], [3.3, F2 + 1.6, 1.9], 0.14, 0.05, toon(0xcfd8dc));
  B.sphere(0, F3 - 1.0, 0, 0.35, M.lamp);

  B.inside(0, 0, 34, () => {
    // Finn's bed: a wooden frame with posts under the pile of pelts
    const bx = -5.5, bz = -4.5;
    for (const [dx, dz, w, d] of [[0, -1.5, 4.7, 0.2], [0, 1.5, 4.7, 0.2], [2.35, 0, 0.2, 3.2]])
      B.box(bx + dx, F2 + 0.05, bz + dz, w, 0.5, d, M.woodD, { solid: false, r: 0.05 });
    B.box(bx - 2.45, F2, bz, 0.25, 2.0, 3.3, M.wood, { solid: false, r: 0.1 });
    for (const dx of [-2.35, 2.35]) for (const dz of [-1.5, 1.5]) {
      B.cyl(bx + dx, F2, bz + dz, 0.15, dx < 0 ? 2.3 : 0.95, M.wood, { solid: false, seg: 6 });
      B.sphere(bx + dx, F2 + (dx < 0 ? 2.4 : 1.02), bz + dz, 0.2, M.wood, { seg: 7 });
    }
    // nightstand with a candle
    B.box(-8.0, F2, -1.6, 1.0, 0.95, 0.95, M.wood, { r: 0.06 });
    B.cyl(-8.0, F2 + 0.95, -1.6, 0.26, 0.08, M.gold, { solid: false, seg: 10 });
    B.cyl(-8.0, F2 + 1.0, -1.6, 0.09, 0.45, M.white, { solid: false, seg: 8 });
    B.cone(-8.0, F2 + 1.47, -1.6, 0.07, 0.2, M.lamp, { seg: 6 });
    // shelf of little old TVs on the wall
    {
      const a = 3.45, [x, z] = at(a, 9.35);
      B.box(x, F2 + 1.5, z, 3.2, 0.12, 0.9, M.woodD, { solid: false, ry: a });
      for (const s of [-1, 1]) {
        const [lx, lz] = [x + Math.cos(a) * s * 1.45, z - Math.sin(a) * s * 1.45];
        B.box(lx, F2, lz, 0.12, 1.5, 0.8, M.woodD, { solid: false, ry: a });
      }
      for (const [s, y, sc] of [[-0.95, 1.62, 1], [0.1, 1.62, 1.15], [1.05, 1.62, 0.9], [-0.4, 0.0, 1.2]]) {
        const tx = x + Math.cos(a) * s, tz = z - Math.sin(a) * s, [fx, fz] = [tx - Math.sin(a) * 0.36 * sc, tz - Math.cos(a) * 0.36 * sc];
        B.box(tx, F2 + y, tz, 0.8 * sc, 0.65 * sc, 0.7 * sc, M.tv, { solid: false, ry: a, r: 0.08 });
        B.box(fx, F2 + y + 0.1 * sc, fz, 0.55 * sc, 0.42 * sc, 0.04, M.screen, { solid: false, ry: a, r: 0.05 });
        B.capsule([tx, F2 + y + 0.65 * sc, tz], [tx + Math.cos(a) * 0.3, F2 + y + 1.05 * sc, tz - Math.sin(a) * 0.3], 0.02, M.iron, 4);
      }
    }
    // Finn's green backpack on the floor
    B.sphere(-1.6, F2 + 0.55, -6.3, 0.58, M.cloth, { sx: 1, sy: 1.05, sz: 0.72, seg: 12 });
    B.sphere(-1.6, F2 + 0.8, -5.9, 0.45, M.strap, { sx: 1.05, sy: 0.6, sz: 0.4, seg: 10 });
    for (const s of [-1, 1]) B.raw(GEO.torus(0.32, 0.05, Math.PI, 10), M.strap, mtx(-1.6 + s * 0.28, F2 + 0.7, -6.75, 0, 1, 1.3, 1, 0, Math.PI / 2));
    // boombox on the dresser, a bone Jake left on the floor
    B.box(6.9, F2 + 2.8, -4.5, 0.4, 0.6, 1.3, M.tv, { solid: false, r: 0.08 });
    for (const dz of [-0.35, 0.35]) B.raw(GEO.cyl(0.2, 0.2, 12), M.iron, mtx(6.68, F2 + 3.1, -4.5 + dz, 0, 1, 0.06, 1, 0, Math.PI / 2));
    B.raw(GEO.torus(0.4, 0.05, Math.PI, 12), M.iron, mtx(6.9, F2 + 3.4, -4.5, Math.PI / 2, 1, 1, 1));
    B.capsule([4.4, F2 + 0.12, -1.3], [5.3, F2 + 0.12, -1.9], 0.08, M.white, 6);
    for (const [x, z] of [[4.35, -1.15], [4.3, -1.42], [5.38, -2.05], [5.3, -1.78]]) B.sphere(x, F2 + 0.13, z, 0.13, M.white, { seg: 6 });
    treeLimbs(F2, F3, [0.55]);
  });
  hang(5.4, F2 + 2.6, 2.3, 1.4, paintDrawings, false);
  hang(3.95, F2 + 3.2, 1.2, 1.5, paintPoster);

  // attic = the weapon room: sword rack, suit of armour, shields, the blue hand, a tall
  // arms cabinet (treasure on top), plus the old junk: candy, books, the AT carving
  floor(F3, 10.2, [5.5, 4.5, 2.4]);
  ladder(5.5, 4.5, F2, F3, [0.77, 0.63], [-0.8, -0.6]);
  for (const a of [0.2, 1.9, 3.3, 4.9]) innerWindow(a, F3 + 3.0);
  B.sphere(-2, F3 + 0.03, 2, 2.2, M.rugRed, { sy: 0.02 });
  const CAND = [0xff4f9a, 0x5fd3ff, 0xffd84f, 0x9dff6b, 0xc27bff];
  for (let i = 0; i < 14; i++) B.sphere(-4 + r() * 1.6, F3 + 0.2 + (i % 3) * 0.15, -2 + r() * 1.6, 0.2, toon(CAND[i % 5]));
  for (let i = 0; i < 5; i++) B.box(3.5, F3 + i * 0.25, -5, 1.1 - i * 0.08, 0.24, 0.8, toon([0xc0392b, 0x2e86c1, 0x27ae60, 0xf39c12, 0x8e44ad][i]), { solid: false, ry: i * 0.2 });
  hang(2.6, F3 + 2.6, 2.4, 1.2, paintAT, false);
  hang(4.2, F3 + 2.8, 1.8, 1.35, paintRainbow);
  B.cyl(-6, F3, -4, 0.45, 0.8, M.woodD, { seg: 10 });
  B.sphere(0, R - 1.3, 0, 0.35, M.lamp);
  B.inside(0, 0, 34, () => {
    // sword rack: the wooden sword, the grass sword, a golden one, the red demon blood sword, a crystal one
    {
      const a = 0.95, [x, z] = at(a, 9.72), cs = Math.cos(a), sn = Math.sin(a);
      B.box(x, F3 + 0.9, z, 3.4, 2.3, 0.15, M.woodD, { solid: false, ry: a, r: 0.05 });
      [[0xb98652, 0x8a5d36], [0x5fd35a, 0x3f9a3a], [0xf6c343, 0xb07a1a], [0xc8372d, 0x3a2a2a], [0x8fdcff, 0x3a6fa0]].forEach(([bc, hc], k) => {
        const s = (k - 2) * 0.62, sx2 = x + cs * s - sn * 0.14, sz2 = z - sn * s - cs * 0.14;
        B.box(sx2, F3 + 1.15, sz2, 0.13, 1.35, 0.04, toon(bc), { solid: false, ry: a });
        B.cone(sx2, F3 + 0.95, sz2, 0.065, 0.2, toon(bc), { seg: 4, rx: Math.PI, ry: a });
        B.box(sx2, F3 + 2.5, sz2, 0.5, 0.09, 0.1, M.guard, { solid: false, ry: a });
        B.box(sx2, F3 + 2.59, sz2, 0.09, 0.42, 0.09, toon(hc), { solid: false, ry: a });
        B.sphere(sx2, F3 + 3.06, sz2, 0.08, M.guard, { seg: 6 });
      });
    }
    // suit of armour on a stand
    {
      const [x, z] = at(2.2, 8.2), a = 2.2 + Math.PI;
      B.cyl(x, F3, z, 0.65, 0.15, M.woodD, { seg: 12 });
      for (const s of [-1, 1]) B.capsule([x + Math.cos(a) * 0.2 * s, F3 + 0.2, z - Math.sin(a) * 0.2 * s], [x + Math.cos(a) * 0.2 * s, F3 + 1.2, z - Math.sin(a) * 0.2 * s], 0.13, M.armorD, 8);
      B.box(x, F3 + 1.15, z, 0.8, 0.95, 0.5, M.armor, { solid: false, ry: a, r: 0.2 });
      for (const s of [-1, 1]) {
        B.sphere(x + Math.cos(a) * 0.5 * s, F3 + 1.95, z - Math.sin(a) * 0.5 * s, 0.22, M.armor, { seg: 8 });
        B.capsule([x + Math.cos(a) * 0.55 * s, F3 + 1.85, z - Math.sin(a) * 0.55 * s], [x + Math.cos(a) * 0.6 * s, F3 + 1.2, z - Math.sin(a) * 0.6 * s], 0.11, M.armorD, 6);
      }
      B.sphere(x, F3 + 2.4, z, 0.34, M.armor, { sy: 1.1, seg: 10 });
      B.box(x + Math.sin(a) * 0.3, F3 + 2.4, z + Math.cos(a) * 0.3, 0.4, 0.07, 0.1, M.iron, { solid: false, ry: a });
      B.cone(x, F3 + 2.75, z, 0.08, 0.35, M.red, { seg: 6 });
      cylCollider(x, z, 0.65, F3 - 0.2, F3 + 2.6, false);
    }
    // round shields on the wall
    for (const [a, y, m] of [[1.45, F3 + 2.5, M.shield1], [3.72, F3 + 2.7, M.shield2]]) {
      const [x, z] = at(a, 9.75);
      B.raw(GEO.cyl(0.75, 0.75, 16), m, mtx(x, y, z, a, 1, 0.12, 1, Math.PI / 2));
      B.raw(GEO.torus(0.72, 0.07, TAU, 20), M.gold, mtx(x - Math.sin(a) * 0.06, y, z - Math.cos(a) * 0.06, a));
      B.sphere(x - Math.sin(a) * 0.08, y, z - Math.cos(a) * 0.08, 0.18, M.gold, { seg: 8 });
    }
    // the blue hand on a pedestal
    {
      const [x, z] = at(4.95, 8.1), a = 4.95 + Math.PI, c = Math.cos(a), sn = Math.sin(a);
      B.box(x, F3, z, 1.0, 1.1, 1.0, M.stone, { ry: a, r: 0.08 });
      B.box(x, F3 + 1.1, z, 0.7, 0.75, 0.28, M.hand, { solid: false, ry: a, r: 0.12 });
      for (let k = 0; k < 4; k++) {
        const s = (k - 1.5) * 0.17, fx = x + c * s, fz = z - sn * s;
        B.capsule([fx, F3 + 1.8, fz], [fx, F3 + 2.25 + (k === 1 || k === 2 ? 0.1 : 0), fz], 0.075, M.hand, 6);
      }
      B.capsule([x + c * 0.36, F3 + 1.3, z - sn * 0.36], [x + c * 0.58, F3 + 1.7, z - sn * 0.58], 0.08, M.hand, 6);
    }
    // closed chest
    {
      const [x, z] = at(2.83, 8.2), a = 2.83;
      B.box(x, F3, z, 1.6, 0.8, 1.0, M.wood, { ry: a, r: 0.06 });
      B.box(x, F3 + 0.8, z, 1.65, 0.35, 1.05, M.woodD, { solid: false, ry: a, r: 0.15 });
      B.box(x - Math.sin(a) * 0.52, F3 + 0.72, z - Math.cos(a) * 0.52, 0.25, 0.3, 0.05, M.gold, { solid: false, ry: a });
    }
    // the tall arms cabinet: its top holds the treasure (one jump up)
    {
      const [x, z] = at(5.68, 8.35), a = 5.68 + Math.PI, c = Math.cos(a), sn = Math.sin(a);
      B.box(x, F3, z, 2.0, 1.55, 1.0, M.woodD, { r: 0.06, ry: a, solid: false });
      boxCollider(x - 1.05, x + 1.05, F3 - 0.2, F3 + 1.55, z - 0.75, z + 0.75);
      for (const s of [-0.48, 0.48]) {
        const [dx, dz] = [x + c * s + Math.sin(a) * 0.5, z - sn * s + Math.cos(a) * 0.5];
        B.box(dx, F3 + 0.12, dz, 0.9, 1.3, 0.05, M.wood, { solid: false, ry: a, r: 0.03 });
        B.sphere(dx - c * s * 0.7, F3 + 0.85, dz + sn * s * 0.7, 0.06, M.gold, { seg: 5 });
      }
      B.cone(x + c * 0.6, F3 + 1.55, z - sn * 0.6, 0.35, 0.9, M.gold, { rx: -0.9, seg: 10 });
      W.treasure("armory", x - c * 0.25, F3 + 1.55, z + sn * 0.25);
      W.course("arsenal", { x: -2.4, z: 4.4, y: F3 }, [{ x: x - c * 0.25, z: z + sn * 0.25, y: F3 + 1.55 }], "armory");
    }
    treeLimbs(F3, R, [3.95]);
  });

  // roof (flat top of the canopy) + ladder up
  floor(R, 8.6, [0, -4.8, 2.4], M.floor, false);
  ladder(0, -4.8, F3, R, [0, -1], [0, 1]);
  ringCollider(0, 0, 10.1, 1.6, R - 2.3, R - 1.0);
  for (const [dx, dz, w, d] of [[0, -1.2, 2.7, 0.2], [0, 1.2, 2.7, 0.2], [-1.2, 0, 0.2, 2.4], [1.2, 0, 0.2, 2.4]])
    B.box(dx, R, -4.8 + dz, w, 0.25, d, M.frame, { solid: false });
  B.tube([[3.2, R - 0.5, 2.2], [3.2, R + 3, 2.2], [3.6, R + 4.4, 2.6], [4.7, R + 4.8, 3.2]], 0.38, M.iron, { seg: 20, radial: 10 });
  cylCollider(3.2, 2.2, 0.5, R, R + 3);
  B.cyl(4.9, R + 4.3, 3.3, 0.55, 0.5, M.iron, { solid: false, rTop: 0.62, seg: 10 });
  // a trail of smoke puffs from the chimney
  for (const [dx, dy, dz, rr] of [[0.3, 1.4, 0.2, 0.55], [1.0, 2.6, 0.5, 0.75], [2.1, 3.9, 0.9, 0.95]])
    B.sphere(4.9 + dx, R + 4.8 + dy, 3.3 + dz, rr, M.smoke, { seg: 10 });

  W.sealed(0, 0, 10.3, F1 - 0.45, R - 0.2);

  // ── the willow canopy ──
  const yb = F1 - 2.5;
  B.lathe([[11.3, 0], [11.9, 2.5], [12.1, 7], [12, 12], [11.6, 15.5], [10.8, 17.8], [9.6, 19.3], [8.2, 19.95], [0.01, 20]], M.leaf, 0, yb, 0, { seg: 40 });
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * TAU + 0.1;
    B.capsule([Math.sin(a) * 11.75, yb + 0.5, Math.cos(a) * 11.75], [Math.sin(a) * 11.6, yb + 14 + (k % 3), Math.cos(a) * 11.6], 1.2, M.leafD, 10);
  }
  for (let k = 0; k < 44; k++) {
    const a = (k / 44) * TAU + r() * 0.1, len = 2 + r() * 2.5;
    B.capsule([Math.sin(a) * 11.6, yb + 1.5, Math.cos(a) * 11.6], [Math.sin(a) * 11.8, yb - len, Math.cos(a) * 11.8], 0.75, k % 2 ? M.leaf : M.leafD, 8);
  }
  for (const [a, y] of [[0.3, F1 + 2], [1.9, F1 + 8], [3.4, F1 + 3.5], [4.5, F1 + 12], [5.6, F1 + 6.5], [0.9, F1 + 13]])
    boxWindow(Math.sin(a) * 12.05, y, Math.cos(a) * 12.05, a);

  // ── side canopies on branches, bridges, flag, gourd ──
  const sideCanopy = (x, y, z, s) => {
    B.lathe([[11.3, 0], [11.9, 2.5], [12.1, 7], [12, 12], [11.4, 15.5], [9.8, 18], [7, 19.6], [0.01, 20]].map(([rr, h]) => [rr * s, h * s * 1.1]), M.leaf, x, y, z, { seg: 28 });
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * TAU, len = (2 + r() * 2) * s * 2;
      B.capsule([x + Math.sin(a) * 11.6 * s, y + 1.2 * s, z + Math.cos(a) * 11.6 * s], [x + Math.sin(a) * 11.8 * s, y - len, z + Math.cos(a) * 11.8 * s], 0.65 * s * 2, M.leafD, 8);
    }
    boxWindow(x + 12.1 * s * 0.98, y + 11 * s, z, Math.PI / 2, 1.0, 1.3);
    boxWindow(x, y + 7 * s, z + 12.1 * s * 0.98, 0, 1.0, 1.3);
  };
  B.branch([[-4, F1 - 6, 0], [-11, F1 - 5.5, 1.5], [-19, F1 - 4.5, 3]], 1.3, 0.6, M.bark, 14);
  sideCanopy(-19, F1 - 5, 3, 0.42);
  // the knob on top of the left canopy
  B.cyl(-19, F1 + 3.9, 3, 0.4, 1.0, M.barkD, { solid: false, seg: 10 });
  B.sphere(-19, F1 + 5.3, 3, 0.75, M.barkD, { seg: 10 });
  B.branch([[4, F1 - 7, 2], [10, F1 - 7.5, 6.5], [15, F1 - 6, 10.5]], 1.2, 0.55, M.bark, 14);
  sideCanopy(15, F1 - 7, 10.5, 0.38);
  // a little lantern perched on the front canopy
  B.cyl(15, F1 + 1.2, 10.5, 0.35, 0.5, M.woodD, { solid: false, seg: 8 });
  B.sphere(15, F1 + 2.0, 10.5, 0.42, M.lamp, { sy: 1.2, seg: 10 });
  B.cone(15, F1 + 2.4, 10.5, 0.5, 0.6, M.roof, { seg: 8 });
  B.branch([[4, F1 - 2, -2], [10, F1 + 0.5, -5.5], [16, F1 + 3.5, -9]], 1.2, 0.55, M.bark, 14);
  sideCanopy(16, F1 + 3, -9, 0.4);
  B.cyl(16, F1 + 3 + 8.8, -9, 0.08, 3.2, M.woodD, { solid: false, seg: 6 });
  B.raw(new THREE.ConeGeometry(0.7, 2.2, 3), M.red, mtx(17.1, F1 + 3 + 11.4, -9, 0, 1, 1, 0.12, 0, -Math.PI / 2));
  const bridge = (a, b) => {
    const n = 10;
    for (let i = 0; i <= n; i++) {
      const t = i / n, sag = Math.sin(t * Math.PI) * 0.6;
      const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t - sag, z = a[2] + (b[2] - a[2]) * t;
      const dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz), px = -dz / l, pz = dx / l;
      B.plank([x - px * 0.6, y, z - pz * 0.6], [x + px * 0.6, y, z + pz * 0.6], 0.35, 0.1, M.wood);
    }
    for (const s of [-1, 1]) {
      const dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz), px = (-dz / l) * 0.65 * s, pz = (dx / l) * 0.65 * s;
      B.tube([[a[0] + px, a[1] + 1, a[2] + pz], [(a[0] + b[0]) / 2 + px, (a[1] + b[1]) / 2 + 0.3, (a[2] + b[2]) / 2 + pz], [b[0] + px, b[1] + 1, b[2] + pz]], 0.05, M.rope, { seg: 12, radial: 4 });
    }
  };
  bridge([-11.6, F1 + 1, 1.2], [-15, F1 + 0.3, 2.4]);
  bridge([11.2, F1 + 5, -4.2], [12.9, F1 + 4.4, -6.6]);
  B.cyl(12.5, F1 - 11, 8.2, 0.03, 3.5, M.rope, { solid: false, seg: 4 });
  // the hanging gourd birdhouse: a bulb with a neck, a round hole and a perch
  B.lathe([[0.01, -1.1], [0.7, -0.95], [1.0, -0.45], [0.95, 0.15], [0.55, 0.55], [0.34, 0.95], [0.3, 1.35], [0.01, 1.4]], M.orange, 12.5, F1 - 12.2, 8.2, { seg: 16 });
  B.sphere(12.5 + 0.6, F1 - 12.3, 8.2 + 0.72, 0.3, M.knot, { sx: 1, sy: 1, sz: 0.35, ry: 0.7 });
  B.capsule([12.5 + 0.75, F1 - 12.75, 8.2 + 0.85], [12.5 + 1.2, F1 - 12.8, 8.2 + 1.3], 0.05, M.woodD, 5);

  // ── the lookout boat, reached by a branch walkway from the roof ──
  const walk = new THREE.CatmullRomCurve3([[-5.2, R, -3.2], [-8.6, R, -4.7], [-11.8, R, -5.6], [-14.6, R, -6.0]].map((p) => new THREE.Vector3(...p)));
  B.branch([[-3, R - 1.3, -2], [-8.6, R + 1.2, -4.7], [-11.8, R + 3.5, -5.6], [-15.5, R + 5.4, -6.1]], 1.0, 0.55, M.bark, 18);
  const N = 20, rise = 6.3, walkPts = [];
  for (let i = 0; i <= N; i++) {
    const p = walk.getPointAt(i / N), tg = walk.getTangentAt(i / N);
    const y = R + 0.05 + rise * (i / N), px = -tg.z, pz = tg.x, l = Math.hypot(px, pz);
    if (i > 0 && i % 4 === 0) walkPts.push({ x: p.x, z: p.z, y });
    B.plank([p.x - (px / l) * 0.95, y - 0.09, p.z - (pz / l) * 0.95], [p.x + (px / l) * 0.95, y - 0.09, p.z + (pz / l) * 0.95], 0.55, 0.18, i % 2 ? M.wood : M.woodD);
    cylCollider(p.x, p.z, 0.85, y - 0.45, y);
    if (i % 4 === 0) for (const s of [-1, 1]) B.cyl(p.x + (px / l) * 1.0 * s, y, p.z + (pz / l) * 1.0 * s, 0.07, 1.0, M.woodD, { solid: false, seg: 5 });
  }
  const E = { x: -17.2, y: R + 6.6, z: -6.3 };
  B.lathe([[0.01, -1.5], [1.4, -1.35], [2.2, -0.9], [2.6, -0.1], [2.7, 0.35]], toon(0xf2efe6, { side: THREE.DoubleSide }), E.x, E.y, E.z, { seg: 24, sx: 1.45 });
  B.raw(GEO.torus(2.65, 0.14, TAU, 32), M.red, mtx(E.x, E.y + 0.2, E.z, 0, 1.45, 1, 1, Math.PI / 2));
  B.raw(GEO.circle(28), M.floor, mtx(E.x, E.y - 0.02, E.z, 0, 2.5 * 1.4, 2.5, 1, -Math.PI / 2));
  cylCollider(E.x, E.z, 2.6, E.y - 0.6, E.y);
  ringCollider(E.x, E.z, 2.7, 0.3, E.y - 0.2, E.y + 0.9, [[Math.atan2(2.6, 0.3), 1.0]]);
  B.raw(GEO.torus(2.7, 0.06, TAU, 32), M.gold, mtx(E.x, E.y + 0.85, E.z, 0, 1.2, 1, 1, Math.PI / 2));
  B.cyl(E.x + 0.8, E.y, E.z, 0.08, 3.4, M.white, { solid: false, seg: 6 });
  for (let k = 0; k < 8; k++)
    B.raw(new THREE.CylinderGeometry(0.02, 2.7, 0.9, 2, 1, false, (k / 8) * TAU, TAU / 8), k % 2 ? M.orange : M.yellow, mtx(E.x + 0.8, E.y + 3.1, E.z));
  B.cyl(E.x - 0.6, E.y, E.z, 0.6, 0.8, M.woodD, { seg: 12 });
  for (const [dx, dz] of [[-1.7, 0], [-0.6, 1.2], [-0.6, -1.2]]) B.box(E.x + dx, E.y, E.z + dz, 0.6, 0.5, 0.6, M.wood, { solid: false });
  B.capsule([E.x + 1.4, E.y + 1.3, E.z + 1.0], [E.x + 3.0, E.y + 1.9, E.z + 1.0], 0.17, M.yellow, 10);
  B.raw(GEO.torus(0.2, 0.05), M.red, mtx(E.x + 2.2, E.y + 1.6, E.z + 1.0, Math.PI / 2, 1, 1, 1, 0, 0.36));
  for (const [dx, dz] of [[1.8, 1.4], [1.9, 0.6], [1.4, 1.0]]) B.capsule([E.x + 2.1, E.y + 1.5, E.z + 1.0], [E.x + dx, E.y, E.z + dz], 0.04, M.iron, 5);
  W.treasure("boat", E.x - 1.7, E.y, E.z - 0.6);
  W.course("barco", { x: -4.8, z: -3.0, y: R }, [...walkPts, { x: E.x, z: E.z, y: E.y }], "boat", { walk: true });
  W.course("sala-do-tesouro", { x: 0.5, z: 11.2 }, [{ x: -3, z: 8.4, y: g + 1.25 }], "treasureroom");
  W.course("quarto", { x: 2, z: 2, y: F2 }, [{ x: 5.3, z: -3.8, y: F2 + 0.9 }], "bedroom");

  // ── the yard ──
  const well = { x: -15, z: 16 }, gw = W.ground(well.x, well.z);
  B.cyl(well.x, gw - 0.2, well.z, 1.4, 1.3, M.stone, { seg: 16 });
  B.raw(GEO.circle(16), M.iron, mtx(well.x, gw + 1.12, well.z, 0, 1.15, 1.15, 1, -Math.PI / 2));
  for (const s of [-1, 1]) B.cyl(well.x + s * 1.3, gw, well.z, 0.1, 2.6, M.woodD, { solid: false, seg: 6 });
  B.gable(well.x, gw + 2.5, well.z, 3.2, 1.0, 2.2, M.roof, Math.PI / 2);
  B.cyl(well.x, gw + 1.7, well.z, 0.25, 0.35, M.woodD, { solid: false, seg: 8 });
  const pond = { x: 10, z: 19 }, gp = W.ground(pond.x, pond.z);
  B.raw(GEO.circle(30), M.water, mtx(pond.x, gp + 0.06, pond.z, 0.3, 5, 3.3, 1, -Math.PI / 2));
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU;
    B.sphere(pond.x + Math.cos(a + 0.3) * 5.2 * Math.cos(0.3) - Math.sin(a) * 0, gp + 0.1, pond.z + Math.sin(a) * 3.5, 0.55 + r() * 0.3, M.stone, { sy: 0.45 });
  }
  for (const [dx, dz] of [[-1.5, 0.5], [1.2, -0.8], [2.4, 1.1]]) B.raw(GEO.circle(12), M.pad, mtx(pond.x + dx, gp + 0.1, pond.z + dz, r() * 3, 0.55, 0.55, 1, -Math.PI / 2));
  for (let i = 0; i < 9; i++) {
    const z = 15 + i * 2.1, x = Math.sin(i * 1.3) * 0.6;
    B.sphere(x, W.ground(x, z) + 0.05, z, 0.75, M.stone, { sy: 0.25 });
  }
  const tw = { x: 18, z: 4 }, gt = W.ground(tw.x, tw.z);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.capsule([tw.x + dx * 1.4, gt, tw.z + dz * 1.4], [tw.x + dx * 0.9, gt + 5, tw.z + dz * 0.9], 0.12, M.woodD, 6);
  B.cyl(tw.x, gt + 5, tw.z, 1.6, 2.2, M.rust, { seg: 14 });
  B.cone(tw.x, gt + 7.2, tw.z, 1.8, 1.0, M.roof, { seg: 14 });
  cylCollider(tw.x, tw.z, 1.6, gt, gt + 5);
  for (let i = 0; i < 12; i++) {
    const a = r() * TAU, d = 18 + r() * 12, x = Math.sin(a) * d, z = Math.cos(a) * d + 4;
    if (Math.abs(x) < 4 && z > 10) continue;
    const gy = W.ground(x, z), h = 1 + r() * 1.2;
    B.capsule([x, gy, z], [x, gy + h, z], 0.35, M.green, 8);
    B.capsule([x + 0.3, gy + h * 0.5, z], [x + 0.6, gy + h * 0.8, z], 0.2, M.green, 6);
  }
  for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) {
    const x = -18 + i * 1.4, z = -12 + j * 1.6;
    B.sphere(x, W.ground(x, z) + 0.3, z, 0.45, j === 1 ? toon(0x8bc34a) : M.green);
  }
  const rg = W.ground(P0().x, P0().z);
  B.cyl(P0().x, rg - 0.5, P0().z, 2, 1.9, M.stone, { rTop: 1.6, seg: 9 });
  W.treasure("rock", P0().x, rg + 1.4, P0().z);
  W.course("pedra", { x: P0().x - 4.5, z: P0().z }, [{ x: P0().x, z: P0().z, y: rg + 1.4 }], "rock");
  function P0() { return W.P.rock; }

  // bench by the pond
  {
    const bx = 16.8, bz = 20.5, gb = W.ground(bx, bz), a = -0.9;
    B.box(bx, gb + 0.55, bz, 2.6, 0.14, 0.7, M.wood, { solid: false, ry: a });
    B.box(bx + Math.sin(a) * 0.32, gb + 0.75, bz + Math.cos(a) * 0.32, 2.6, 0.6, 0.1, M.wood, { solid: false, ry: a });
    for (const s of [-1, 1]) B.box(bx + Math.cos(a) * 1.1 * s, gb, bz - Math.sin(a) * 1.1 * s, 0.14, 0.55, 0.6, M.woodD, { solid: false, ry: a });
    cylCollider(bx, bz, 0.9, gb, gb + 0.69, false);
  }
  // the wrecked tank from the Mushroom War, half sunk and mossy, a little tree growing out of it
  {
    const tx = 29, tz = 13, gt2 = W.ground(tx, tz) - 0.5, a = 0.5, c = Math.cos(a), sn = Math.sin(a);
    const P = (u, v) => [tx + sn * u + c * v, tz + c * u - sn * v];
    B.box(tx, gt2, tz, 3.4, 1.7, 5.6, M.tank, { ry: a, rz: 0.12, r: 0.3, solid: false });
    for (const v of [-1.9, 1.9]) {
      const [x0, z0] = P(-2.8, v), [x1, z1] = P(2.8, v);
      B.capsule([x0, gt2 + 0.6 + v * 0.06, z0], [x1, gt2 + 0.6 + v * 0.06, z1], 0.7, M.tankD, 10);
      for (let k = -2; k <= 2; k++) {
        const [wx, wz] = P(k * 1.1, v * 1.2);
        B.raw(GEO.cyl(0.45, 0.45, 10), M.iron, mtx(wx, gt2 + 0.6, wz, a, 1, 0.3, 1, 0, Math.PI / 2));
      }
    }
    const [ux, uz] = P(-0.4, 0);
    B.cyl(ux, gt2 + 1.6, uz, 1.35, 0.9, M.tank, { rTop: 1.1, seg: 12, solid: false, rz: 0.12 });
    const [bx0, bz0] = P(0.5, 0), [bx1, bz1] = P(4.2, 0.4);
    B.capsule([bx0, gt2 + 2.1, bz0], [bx1, gt2 + 3.3, bz1], 0.22, M.tankD, 8);
    B.cyl(bx1, gt2 + 3.2, bz1, 0.3, 0.3, M.tankD, { solid: false, seg: 8, rx: 1.2, ry: a });
    for (const [u, v, rr] of [[-2.2, 1, 0.6], [1.4, -1.2, 0.5], [0.2, 1.5, 0.45]]) {
      const [mx, mz] = P(u, v);
      B.sphere(mx, gt2 + 1.75, mz, rr, M.moss, { sy: 0.35, seg: 8 });
    }
    for (const [u, v] of [[1.8, 0.6], [-1.6, -0.8]]) {
      const [rx2, rz2] = P(u, v);
      B.sphere(rx2, gt2 + 1.72, rz2, 0.4, M.rustM, { sy: 0.12, seg: 8 });
    }
    B.branch([[ux, gt2 + 2.4, uz], [ux + 0.3, gt2 + 3.6, uz], [ux, gt2 + 4.8, uz + 0.2]], 0.18, 0.1, M.bark, 4);
    B.sphere(ux, gt2 + 5.2, uz + 0.2, 1.1, M.green, { seg: 8 });
    B.sphere(ux + 0.6, gt2 + 4.8, uz, 0.7, M.green, { seg: 8 });
    const [cx0, cz0] = P(-3, -2.6), [cx1, cz1] = P(3, 2.6);
    boxCollider(Math.min(cx0, cx1) + 0.6, Math.max(cx0, cx1) - 0.6, gt2, gt2 + 1.8, Math.min(cz0, cz1) + 0.6, Math.max(cz0, cz1) - 0.6);
    cylCollider(ux, uz, 1.3, gt2 + 1.6, gt2 + 2.5);
  }
  // fence posts with a sagging rope, from the pond out towards the tank
  {
    const posts = [];
    for (let k = 0; k < 6; k++) {
      const x = 16 + k * 2.4, z = 25.5 - k * 1.5, gy = W.ground(x, z);
      B.cyl(x, gy - 0.3, z, 0.13, 1.6, M.woodD, { seg: 6, cam: false });
      posts.push([x, gy + 1.15, z]);
    }
    for (let k = 0; k + 1 < posts.length; k++) {
      const [a, b] = [posts[k], posts[k + 1]];
      B.tube([a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.35, (a[2] + b[2]) / 2], b], 0.04, M.rope, { seg: 8, radial: 4 });
    }
  }
  // mailbox by the path, a chopping stump with an axe and a stack of firewood by the shack
  {
    const mx = 3.6, mz = 21.5, gm = W.ground(mx, mz);
    B.cyl(mx, gm - 0.2, mz, 0.1, 1.4, M.woodD, { seg: 6, cam: false });
    B.box(mx, gm + 1.2, mz, 0.55, 0.5, 0.9, M.shield2, { solid: false, r: 0.2 });
    B.box(mx + 0.3, gm + 1.3, mz - 0.1, 0.05, 0.5, 0.12, M.red, { solid: false });
    B.box(mx + 0.3, gm + 1.68, mz - 0.1, 0.05, 0.14, 0.3, M.red, { solid: false });
    const sx = -9.8, sz = 9.5, gs = W.ground(sx, sz);
    B.cyl(sx, gs - 0.2, sz, 0.75, 1.0, M.bark, { rTop: 0.7, seg: 10 });
    B.box(sx + 0.1, gs + 0.8, sz, 0.12, 0.45, 0.6, M.iron, { solid: false, rz: 0.4 });
    B.capsule([sx + 0.25, gs + 1.05, sz], [sx + 0.9, gs + 1.9, sz], 0.06, M.hilt, 5);
    for (let k = 0; k < 9; k++) {
      const y = gs + 0.22 + Math.floor(k / 3) * 0.42, o = (k % 3) * 0.45 - 0.45 + (Math.floor(k / 3) % 2) * 0.22;
      B.capsule([-7.1, y, 5.2 + o], [-7.1, y, 7.4 + o], 0.2, k % 2 ? M.bark : M.barkD, 7);
    }
    boxCollider(-7.5, -6.7, gs - 0.2, gs + 1.3, 4.6, 8.0);
  }
  // all the canvas pictures of the rooms, in one mesh
  {
    const pm = pictures(pics);
    W.scene.add(pm);
    B.cullNear(pm, 0, 0, 34);
  }
  return { F1, F2, F3, R, g };
}

// ── pictures painted on canvases (no words: every text the player reads is in strings.js) ──
function paintMountains(c, w, h) {
  const sky = c.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#5ec3f2");
  sky.addColorStop(1, "#d8f4ff");
  c.fillStyle = sky;
  c.fillRect(0, 0, w, h);
  c.fillStyle = "#ffe066";
  c.beginPath();
  c.arc(w * 0.8, h * 0.24, h * 0.11, 0, 7);
  c.fill();
  for (const [x, top, col] of [[0.18, 0.2, "#8a6fc7"], [0.42, 0.1, "#7a5fb8"], [0.68, 0.28, "#9a7fd4"]]) {
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(w * (x - 0.26), h * 0.72);
    c.lineTo(w * x, h * top);
    c.lineTo(w * (x + 0.26), h * 0.72);
    c.fill();
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.moveTo(w * (x - 0.07), h * (top + 0.14));
    c.lineTo(w * x, h * top);
    c.lineTo(w * (x + 0.07), h * (top + 0.14));
    c.lineTo(w * (x + 0.02), h * (top + 0.11));
    c.lineTo(w * (x - 0.02), h * (top + 0.16));
    c.fill();
  }
  c.fillStyle = "#72c94a";
  c.beginPath();
  c.ellipse(w * 0.25, h * 0.92, w * 0.45, h * 0.3, 0, 0, 7);
  c.ellipse(w * 0.85, h * 0.95, w * 0.4, h * 0.3, 0, 0, 7);
  c.fill();
  c.fillStyle = "#4fa8e0";
  c.beginPath();
  c.ellipse(w * 0.55, h * 0.84, w * 0.2, h * 0.07, 0, 0, 7);
  c.fill();
  c.strokeStyle = "#3b2a1a";
  c.lineWidth = 6;
  c.strokeRect(3, 3, w - 6, h - 6);
}
function paintDrawings(c, w, h) {
  c.clearRect(0, 0, w, h);
  const paper = (x, y, pw, ph, rot, fn) => {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.fillStyle = "#fbf6e6";
    c.fillRect(-pw / 2, -ph / 2, pw, ph);
    c.fillStyle = "#d33";
    c.beginPath();
    c.arc(0, -ph / 2 + 8, 5, 0, 7);
    c.fill();
    c.lineWidth = 5;
    c.lineCap = "round";
    fn(pw, ph);
    c.restore();
  };
  paper(w * 0.2, h * 0.3, w * 0.3, h * 0.48, -0.08, (pw, ph) => { // Jake's face
    c.fillStyle = "#f7b52c";
    c.beginPath();
    c.arc(0, 4, pw * 0.3, 0, 7);
    c.fill();
    c.fillStyle = "#222";
    for (const s of [-1, 1]) { c.beginPath(); c.arc(s * pw * 0.12, -2, 6, 0, 7); c.fill(); }
    c.strokeStyle = "#222";
    c.beginPath();
    c.arc(0, 14, 10, 0.2, Math.PI - 0.2);
    c.stroke();
  });
  paper(w * 0.5, h * 0.35, w * 0.28, h * 0.5, 0.06, (pw, ph) => { // a sword
    c.strokeStyle = "#8a8f99";
    c.lineWidth = 9;
    c.beginPath();
    c.moveTo(0, -ph * 0.35);
    c.lineTo(0, ph * 0.2);
    c.stroke();
    c.strokeStyle = "#c9962b";
    c.beginPath();
    c.moveTo(-pw * 0.25, ph * 0.2);
    c.lineTo(pw * 0.25, ph * 0.2);
    c.moveTo(0, ph * 0.2);
    c.lineTo(0, ph * 0.36);
    c.stroke();
  });
  paper(w * 0.8, h * 0.3, w * 0.3, h * 0.46, -0.04, (pw, ph) => { // a heart
    c.fillStyle = "#ff5c8a";
    c.beginPath();
    c.moveTo(0, ph * 0.28);
    c.bezierCurveTo(-pw * 0.5, -ph * 0.05, -pw * 0.2, -ph * 0.4, 0, -ph * 0.1);
    c.bezierCurveTo(pw * 0.2, -ph * 0.4, pw * 0.5, -ph * 0.05, 0, ph * 0.28);
    c.fill();
  });
  paper(w * 0.36, h * 0.75, w * 0.34, h * 0.42, 0.1, (pw, ph) => { // the Tree Fort
    c.fillStyle = "#6c4a2a";
    c.fillRect(-6, -ph * 0.05, 12, ph * 0.35);
    c.fillStyle = "#6ccf3f";
    c.beginPath();
    c.ellipse(0, -ph * 0.12, pw * 0.3, ph * 0.28, 0, 0, 7);
    c.fill();
  });
  paper(w * 0.7, h * 0.76, w * 0.3, h * 0.42, -0.12, (pw, ph) => { // Finn's hat
    c.fillStyle = "#ffffff";
    c.strokeStyle = "#222";
    c.lineWidth = 3;
    c.beginPath();
    c.arc(0, 6, pw * 0.3, Math.PI, 0);
    c.lineTo(pw * 0.3, ph * 0.25);
    c.lineTo(-pw * 0.3, ph * 0.25);
    c.closePath();
    c.fill();
    c.stroke();
    for (const s of [-1, 1]) { c.beginPath(); c.arc(s * pw * 0.2, -ph * 0.14, 7, 0, 7); c.fill(); c.stroke(); }
  });
}
function paintPoster(c, w, h) { // a hero poster: a sword against a starburst
  c.fillStyle = "#2e6fc1";
  c.fillRect(0, 0, w, h);
  c.fillStyle = "#ffd84f";
  c.beginPath();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2, rr = i % 2 ? w * 0.22 : w * 0.46;
    c.lineTo(w / 2 + Math.cos(a) * rr, h * 0.45 + Math.sin(a) * rr);
  }
  c.fill();
  c.fillStyle = "#e8ecf2";
  c.fillRect(w / 2 - 9, h * 0.12, 18, h * 0.5);
  c.fillStyle = "#c9962b";
  c.fillRect(w * 0.28, h * 0.62, w * 0.44, 14);
  c.fillStyle = "#7a4a22";
  c.fillRect(w / 2 - 8, h * 0.62 + 14, 16, h * 0.14);
  c.strokeStyle = "#1d2340";
  c.lineWidth = 8;
  c.strokeRect(4, 4, w - 8, h - 8);
}
function paintAT(c, w, h) {
  c.clearRect(0, 0, w, h);
  c.fillStyle = "#4a2c14";
  c.font = `bold ${Math.round(h * 0.8)}px sans-serif`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText("AT", w / 2, h / 2 + h * 0.05);
}
function paintRainbow(c, w, h) {
  c.fillStyle = "#6b4423";
  c.fillRect(0, 0, w, h);
  const cols = ["#ff5252", "#ffab40", "#ffee58", "#69f0ae", "#40c4ff", "#b388ff"], m = w * 0.06, bh = (h - 2 * m) / cols.length;
  cols.forEach((col, i) => { c.fillStyle = col; c.fillRect(m, m + i * bh, w - 2 * m, bh + 0.5); });
}
