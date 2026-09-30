// Scattered scenery per biome + sky clouds. Forests use two levels of detail
// (B.near / B.far): full trees close to the camera, one blob per tree beyond LOD.
// Small things (flowers, tufts, mushrooms...) are B.detail and vanish in the distance.
import * as THREE from "three";
import { toon, noOutline, decalTexture } from "./toon.js";
import { cylCollider, boxCollider } from "./physics.js";
import { BIOMES, biomeIndexAt, rng, P, vnoise, roadDist, ROADS, waterInfo, nearCliff } from "./terrain.js";
import { STR } from "./strings.js";

const TAU = Math.PI * 2;
const LOD = 120;

export function buildProps(B, W, excl) {
  const excluded = (x, z, pad = 0) => {
    for (const e of excl) if ((x - e.x) ** 2 + (z - e.z) ** 2 < (e.r + pad) ** 2) return true;
    // nothing grows in the water (or in the walls of rock round the waterfalls)
    if (waterInfo(x, z).d < pad + 1.2 || nearCliff(x, z, pad)) return true;
    return Math.hypot(x, z) > 318;
  };
  const scatter = (bi, count, radius, seed, fn, center = BIOMES[bi], minD = 0, road = 3.5) => {
    const r = rng(seed);
    let placed = 0;
    for (let t = 0; t < count * 30 && placed < count; t++) {
      const a = r() * TAU, d = minD + Math.sqrt(r()) * (radius - minD);
      const x = center.x + Math.cos(a) * d, z = center.z + Math.sin(a) * d;
      if (biomeIndexAt(x, z) !== bi || excluded(x, z) || roadDist(x, z) < road) continue;
      fn(x, z, W.ground(x, z), r);
      placed++;
    }
  };
  // jittered grid over a biome, thinned by a density function (0..1): forests
  const forest = (bi, spacing, seed, density, fn, road = 6) => {
    const r = rng(seed), b = BIOMES[bi], R = 175;
    for (let gx = -R; gx < R; gx += spacing)
      for (let gz = -R; gz < R; gz += spacing) {
        const x = b.x + gx + (r() - 0.5) * spacing * 0.9, z = b.z + gz + (r() - 0.5) * spacing * 0.9;
        const keep = r(), roll = r();
        if (biomeIndexAt(x, z) !== bi || excluded(x, z, 1.5) || roadDist(x, z) < road) continue;
        if (keep > density(x, z)) continue;
        fn(x, z, W.ground(x, z), r, roll);
      }
  };
  const forestNoise = (x, z, o = 0) => vnoise(x / 55 + 3.3 + o, z / 55 - 7.1) * 0.72 + vnoise(x / 17 - 1.9, z / 17 + o) * 0.28;

  // ── tree kits (each writes a near and a far version into the same chunk) ──
  const trunk = toon(0x8a5a2b, { tex: "bark", scale: 0.35 });
  const trunkD = toon(0x6e4524, { tex: "bark", scale: 0.35 });
  const GREENS = [toon(0x5cbf3c), toon(0x4caf50), toon(0x76c94a), toon(0x3fa33c), toon(0x8ad04e)];
  const PINE = [toon(0x2f8a4a), toon(0x3a9a52), toon(0x267a42)];
  const snowTip = toon(0xffffff, { tex: "frosting", scale: 0.3 });
  const lod = (x, z, near, far) => B.pinned(x, z, () => { B.near(near, LOD); B.far(far, LOD); });

  const APPLE = toon(0xe8303a);
  function puffTree(x, z, g, r, s, m, fruit = false) {
    const lean = (r() - 0.5) * 0.6, top = [x + lean, g + 4.2 * s, z + lean * 0.5];
    const puffs = [[top[0], top[1] + 1.4 * s, top[2], 2.4 * s]];
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU + r();
      puffs.push([top[0] + Math.cos(a) * 1.7 * s, top[1] + (0.6 + r() * 0.8) * s, top[2] + Math.sin(a) * 1.7 * s, (1.4 + r() * 0.5) * s]);
    }
    lod(x, z, () => {
      B.branch([[x, g - 0.3, z], [x + lean * 0.3, g + 2 * s, z], top], 0.55 * s, 0.35 * s, trunk, 4);
      for (const [px, py, pz, pr] of puffs) B.sphere(px, py, pz, pr, m, { seg: 7 });
      if (fruit) for (let k = 0; k < 7; k++) {
        const [px, py, pz, pr] = puffs[k % puffs.length], a = k * 2.4;
        B.sphere(px + Math.sin(a) * pr * 0.9, py - pr * 0.25 + (k % 3) * 0.3 * s, pz + Math.cos(a) * pr * 0.9, 0.2 * s, APPLE, { seg: 5 });
      }
    }, () => {
      B.cyl(x, g - 0.3, z, 0.5 * s, 4.3 * s, trunk, { rTop: 0.35 * s, seg: 5, solid: false });
      B.sphere(top[0], top[1] + 1.0 * s, top[2], 3.0 * s, m, { seg: 6, sy: 0.82 });
    });
    cylCollider(x, z, 0.6 * s, g - 0.3, g + 4 * s, false);
  }
  // a tall thin tree with a stacked oval crown (the lanky trees of the Grass Lands)
  function tallTree(x, z, g, r, s, m) {
    const h = (6.5 + r() * 2) * s;
    lod(x, z, () => {
      B.branch([[x, g - 0.3, z], [x + (r() - 0.5) * 0.4, g + h * 0.5, z], [x, g + h, z]], 0.42 * s, 0.26 * s, trunk, 4);
      B.sphere(x, g + h + 0.8 * s, z, 2.1 * s, m, { seg: 8, sy: 1.25 });
      B.sphere(x + 0.9 * s, g + h - 0.4 * s, z + 0.4 * s, 1.5 * s, m, { seg: 8 });
      B.sphere(x - 0.8 * s, g + h - 0.2 * s, z - 0.5 * s, 1.4 * s, m, { seg: 8 });
      B.sphere(x, g + h + 3 * s, z, 1.3 * s, m, { seg: 8 });
    }, () => {
      B.cyl(x, g - 0.3, z, 0.4 * s, h + 0.3, trunk, { rTop: 0.26 * s, seg: 5, solid: false });
      B.sphere(x, g + h + 1.1 * s, z, 2.4 * s, m, { seg: 6, sy: 1.35 });
    });
    cylCollider(x, z, 0.5 * s, g - 0.3, g + h, false);
  }
  function pineTree(x, z, g, r, s, snowy) {
    const m = PINE[Math.floor(r() * 3)], h = (7 + r() * 3) * s;
    lod(x, z, () => {
      B.cyl(x, g - 0.3, z, 0.35 * s, h * 0.35, trunkD, { seg: 6, solid: false });
      for (let k = 0; k < 3; k++) {
        const y = g + h * (0.18 + k * 0.24), rr = (2.6 - k * 0.7) * s;
        B.cone(x, y, z, rr, h * 0.42, m, { seg: 7, ry: k + x });
        if (snowy) B.cone(x, y + h * 0.42 * 0.55, z, rr * 0.47, h * 0.42 * 0.46, snowTip, { seg: 7, ry: k + x });
      }
    }, () => {
      B.cone(x, g - 0.3, z, 2.4 * s, h + 0.3, m, { seg: 5 });
      if (snowy) B.cone(x, g + h * 0.62, z, 0.9 * s, h * 0.38, snowTip, { seg: 5 });
    });
    cylCollider(x, z, 0.45 * s, g - 0.3, g + h * 0.6, false);
  }
  function bigOak(x, z, g, r, s) {
    const m = GREENS[3];
    lod(x, z, () => {
      B.branch([[x, g - 0.5, z], [x + 0.3, g + 3 * s, z], [x, g + 5.5 * s, z + 0.3]], 1.1 * s, 0.6 * s, trunk, 5);
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * TAU + 0.5;
        B.branch([[x, g + 4 * s, z], [x + Math.sin(a) * 2 * s, g + 5.6 * s, z + Math.cos(a) * 2 * s], [x + Math.sin(a) * 3.6 * s, g + 6.4 * s, z + Math.cos(a) * 3.6 * s]], 0.45 * s, 0.25 * s, trunk, 4);
      }
      for (const b of [-1.2, 1.4]) B.branch([[x, g - 0.2, z], [x + Math.sin(b) * 1.5 * s, g - 0.2, z + Math.cos(b) * 1.5 * s], [x + Math.sin(b) * 2.6 * s, g - 0.5, z + Math.cos(b) * 2.6 * s]], 0.6 * s, 0.2 * s, trunk, 4);
      B.sphere(x, g + 8.4 * s, z, 3.6 * s, m, { seg: 10 });
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * TAU + r() * 0.3;
        B.sphere(x + Math.sin(a) * 3.4 * s, g + (6.8 + r() * 1.6) * s, z + Math.cos(a) * 3.4 * s, (2.1 + r() * 0.6) * s, GREENS[k % 2 ? 0 : 3], { seg: 8 });
      }
    }, () => {
      B.cyl(x, g - 0.5, z, 1.0 * s, 6 * s, trunk, { rTop: 0.6 * s, seg: 5, solid: false });
      B.sphere(x, g + 7.8 * s, z, 5.0 * s, m, { seg: 7, sy: 0.75 });
    });
    cylCollider(x, z, 1.1 * s, g - 0.5, g + 6 * s);
  }
  const willowLeaf = toon(0x72cc3f, { tex: "drape", scale: 0.14 });
  function willow(x, z, g, r, s) {
    const top = g + 7 * s;
    lod(x, z, () => {
      B.branch([[x, g - 0.3, z], [x + 0.4 * s, g + 3 * s, z], [x, top, z]], 0.7 * s, 0.4 * s, trunk, 4);
      B.lathe([[3.6 * s, 0], [3.9 * s, 2 * s], [3.4 * s, 4.2 * s], [2 * s, 5.4 * s], [0.01, 5.7 * s]], willowLeaf, x, top - 1.5 * s, z, { seg: 14 });
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * TAU + r() * 0.2, len = (2.2 + r() * 2.2) * s;
        B.capsule([x + Math.sin(a) * 3.7 * s, top - 1.2 * s, z + Math.cos(a) * 3.7 * s], [x + Math.sin(a) * 3.8 * s, top - 1.2 * s - len, z + Math.cos(a) * 3.8 * s], 0.5 * s, k % 2 ? willowLeaf : GREENS[2], 6);
      }
    }, () => {
      B.cyl(x, g - 0.3, z, 0.6 * s, 6 * s, trunk, { seg: 5, solid: false });
      B.sphere(x, top + 0.2 * s, z, 3.9 * s, willowLeaf, { seg: 6, sy: 1.05 });
    });
    cylCollider(x, z, 0.8 * s, g - 0.3, g + 5 * s, false);
  }

  // ── Grass Lands: dense forests in patches, meadows between, woods along the streams ──
  forest(0, 5.2, 11, (x, z) => {
    const n = forestNoise(x, z), open = Math.hypot(x, z - 10) < 55 ? 0.35 : 1; // lighter near the Tree Fort
    const wet = 1 - smoothstep(3, 16, waterInfo(x, z).d);
    return (0.06 + 0.88 * smoothstep(0.41, 0.61, n) + 0.25 * wet) * open;
  }, (x, z, g, r, roll) => {
    const s = 0.8 + r() * 0.65, wet = waterInfo(x, z).d < 9;
    if (z < -95 && roll < 0.75) pineTree(x, z, g, r, s, false);
    else if (roll < (wet ? 0.12 : 0.03)) willow(x, z, g, r, 0.9 + r() * 0.3);
    else if (roll < 0.33) tallTree(x, z, g, r, s * 0.9, GREENS[Math.floor(r() * 5)]);
    else puffTree(x, z, g, r, s, GREENS[Math.floor(r() * 5)], roll > 0.9);
  });
  scatter(0, 14, 150, 19, (x, z, g, r) => bigOak(x, z, g, r, 1 + r() * 0.35), BIOMES[0], 40, 8);
  const BERRY = toon(0xe8303a);
  B.detail(() => {
    // bushes and berry bushes
    scatter(0, 300, 165, 12, (x, z, g, r) => {
      const m = GREENS[Math.floor(r() * 5)], berry = r() < 0.25;
      for (let k = 0; k < 3; k++) {
        const bx = x + (r() - 0.5) * 1.6, bz = z + (r() - 0.5) * 1.6, br = 0.8 + r() * 0.4;
        B.sphere(bx, g + 0.4, bz, br, m, { seg: 7 });
        if (berry) for (let i = 0; i < 3; i++) {
          const a = r() * TAU;
          B.sphere(bx + Math.cos(a) * br * 0.8, g + 0.6 + r() * 0.5, bz + Math.sin(a) * br * 0.8, 0.13, BERRY, { seg: 5 });
        }
      }
    });
  }, 170);
  B.detail(() => {
    const FLOW = [0xff5c8a, 0xffd84f, 0xffffff, 0xb388ff, 0xff8a3d, 0x5fd3ff].map((c) => toon(c));
    const stem = toon(0x3f9a3a, { outline: false });
    scatter(0, 850, 170, 13, (x, z, g, r) => {
      const h = 0.4 + r() * 0.4;
      B.cyl(x, g, z, 0.04, h, stem, { solid: false, seg: 4 });
      B.sphere(x, g + h, z, 0.18, FLOW[Math.floor(r() * 6)], { sy: 0.7, seg: 6 });
    }, BIOMES[0], 0, 2.5);
    // tufts of tall grass (no ink: they would turn into black scribbles)
    const blade = [toon(0x4fae36, { outline: false }), toon(0x62bf3e, { outline: false })];
    scatter(0, 2000, 170, 15, (x, z, g, r) => {
      const m = blade[Math.floor(r() * 2)];
      for (let k = 0; k < 4; k++) {
        const a = r() * TAU, h = 0.5 + r() * 0.5;
        B.cone(x + Math.cos(a) * 0.25, g - 0.05, z + Math.sin(a) * 0.25, 0.09, h, m, { seg: 3, rx: (r() - 0.5) * 0.5, rz: (r() - 0.5) * 0.5 });
      }
    }, BIOMES[0], 0, 2.5);
  }, 85);
  B.detail(() => {
    // red mushrooms with white dots, in the woods
    const cap = toon(0xe8434f), dot = toon(0xffffff, { outline: false }), stalk = toon(0xf1e6d0);
    forest(0, 9, 16, (x, z) => (forestNoise(x, z) > 0.55 ? 0.35 : 0.02), (x, z, g, r) => {
      const n = 1 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const mx = x + (r() - 0.5) * 1.4, mz = z + (r() - 0.5) * 1.4, s = 0.6 + r() * 0.7;
        B.cyl(mx, g - 0.05, mz, 0.12 * s, 0.5 * s, stalk, { solid: false, seg: 6 });
        B.sphere(mx, g + 0.5 * s, mz, 0.38 * s, cap, { sy: 0.6, seg: 8 });
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * TAU + k;
          B.sphere(mx + Math.cos(a) * 0.22 * s, g + 0.66 * s, mz + Math.sin(a) * 0.22 * s, 0.06 * s, dot, { seg: 4, sy: 0.5 });
        }
      }
    }, 3);
    // ferns under the trees
    const frond = [toon(0x3f9a35, { outline: false }), toon(0x58b03e, { outline: false })];
    forest(0, 6, 18, (x, z) => (forestNoise(x, z) > 0.5 ? 0.4 : 0.03) + (waterInfo(x, z).d < 7 ? 0.3 : 0), (x, z, g, r) => {
      const n = 5 + Math.floor(r() * 2), s = 0.7 + r() * 0.5, m = frond[Math.floor(r() * 2)];
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU + r() * 0.4, l = (0.9 + r() * 0.4) * s;
        B.sphere(x + Math.sin(a) * l * 0.55, g + 0.35 * s, z + Math.cos(a) * l * 0.55, l * 0.6, m, { sx: 0.22, sy: 0.06, ry: a, rx: -0.45, seg: 4 });
      }
    }, 3);
    // logs and stumps
    const ring = toon(0xe8c38a), moss = toon(0x5fae3a);
    scatter(0, 26, 160, 17, (x, z, g, r) => {
      if (r() < 0.5) {
        const a = r() * TAU, l = 2.2 + r() * 2, dx = Math.sin(a) * l / 2, dz = Math.cos(a) * l / 2;
        B.capsule([x - dx, g + 0.4, z - dz], [x + dx, g + 0.4, z + dz], 0.45, trunk, 8);
        B.sphere(x + dx * 0.3, g + 0.8, z + dz * 0.3, 0.35, moss, { sy: 0.4, seg: 6 });
        cylCollider(x, z, 0.8, g, g + 0.8, false);
      } else {
        B.cyl(x, g - 0.2, z, 0.7, 0.9, trunk, { rTop: 0.6, seg: 9, cam: false });
        B.cyl(x, g + 0.7, z, 0.55, 0.02, ring, { solid: false, seg: 9 });
      }
    }, BIOMES[0], 20);
  }, 110);
  const rock = toon(0xa8a8a0, { tex: "rock", scale: 0.4 }), mossy = toon(0x8fb06a, { tex: "rock", scale: 0.4 });
  scatter(0, 50, 170, 14, (x, z, g, r) => B.sphere(x, g, z, 0.8 + r() * 1.2, r() < 0.3 ? mossy : rock, { sy: 0.6, solid: true, top: 0.6, seg: 8 }));

  // signpost where the roads leave the Tree Fort
  signpost(B, W, 6.5, 26, [
    [STR.signs.candy, ROADS[0]], [STR.signs.ice, ROADS[1]], [STR.signs.fire, ROADS[2]], [STR.signs.marcy, ROADS[3]],
  ]);
  // wooden fences along the first stretch of each road
  B.detail(() => {
    const post = toon(0x9a6a3c, { tex: "wood", scale: 0.5 });
    for (const road of ROADS) {
      const [ax, az] = road[1], [bx, bz] = road[2], l = Math.hypot(bx - ax, bz - az), px = -(bz - az) / l, pz = (bx - ax) / l;
      for (let t = 0.1; t < 0.6; t += 0.07) {
        const x = ax + (bx - ax) * t + px * 4.2, z = az + (bz - az) * t + pz * 4.2, g = W.ground(x, z);
        if (excluded(x, z)) continue;
        B.cyl(x, g - 0.2, z, 0.12, 1.4, post, { seg: 5, cam: false });
        const x2 = x + (bx - ax) / l * l * 0.07, z2 = z + (bz - az) / l * l * 0.07;
        if (t + 0.07 < 0.6) for (const y of [0.55, 1.0]) B.plank([x, g + y, z], [x2, W.ground(x2, z2) + y, z2], 0.14, 0.06, post);
      }
    }
  }, 160);

  // ── Candy Kingdom outskirts: a ring of cotton candy forest, gum trees, candy canes, rock candy mountains ──
  const C = P.candy;
  const cotton = [toon(0xffb8e2), toon(0xffd0ec), toon(0xf7a3d6), toon(0xff9ad4)];
  const white = toon(0xffffff), stripe = toon(0xff7ab8);
  forest(1, 5.6, 21, (x, z) => {
    const d = Math.hypot(x - C.x, z - C.z);
    return d < 47 ? 0 : 0.08 + 0.7 * (1 - smoothstep(58, 95, d)) + 0.4 * smoothstep(0.5, 0.7, forestNoise(x, z, 5));
  }, (x, z, g, r) => {
    const s = 0.9 + r() * 0.8, m = cotton[Math.floor(r() * 4)];
    const puffs = [];
    for (let k = 0; k < 4; k++) puffs.push([x + (r() - 0.5) * 2.4 * s, g + (3.6 + r() * 1.4) * s, z + (r() - 0.5) * 2.4 * s, (1.45 + r() * 0.6) * s]);
    const tw = r() * TAU;
    lod(x, z, () => {
      B.cyl(x, g - 0.2, z, 0.2 * s, 3.4 * s, white, { solid: false, seg: 6 });
      for (let k = 0; k < 2; k++) B.raw(GEOtorus(0.2 * s), stripe, mtxY(x, g + (0.9 + k * 1.2) * s, z, tw + k, 0.35));
      for (const [px, py, pz, pr] of puffs) B.sphere(px, py, pz, pr, m, { seg: 7 });
    }, () => {
      B.cyl(x, g - 0.2, z, 0.2 * s, 3.4 * s, white, { solid: false, seg: 4 });
      B.sphere(x, g + 4.3 * s, z, 2.4 * s, m, { seg: 6, sy: 0.8 });
    });
    cylCollider(x, z, 0.3, g, g + 3 * s, false);
  }, 7);
  const teal = toon(0x5fc9b3, { tex: "dots", scale: 0.3 }), GUMDOT = [toon(0xff4f9a), toon(0xffd84f), toon(0xffffff)];
  scatter(1, 60, 150, 22, (x, z, g, r) => {
    const s = 0.9 + r() * 0.5;
    lod(x, z, () => {
      B.cyl(x, g - 0.2, z, 0.25 * s, 2.4 * s, white, { solid: false, seg: 6 });
      B.capsule([x, g + 3.2 * s, z], [x, g + 5.2 * s, z], 1.5 * s, teal, 10);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + r(), y = g + (3 + r() * 2.4) * s;
        B.sphere(x + Math.sin(a) * 1.45 * s, y, z + Math.cos(a) * 1.45 * s, 0.18 * s, GUMDOT[i % 3], { seg: 4 });
      }
    }, () => {
      B.cyl(x, g - 0.2, z, 0.25 * s, 2.4 * s, white, { solid: false, seg: 4 });
      B.sphere(x, g + 4.2 * s, z, 1.6 * s, teal, { seg: 6, sy: 1.3 });
    });
    cylCollider(x, z, 0.35, g, g + 2 * s, false);
  }, C, 46);
  const cane = [toon(0xe8303a), toon(0xffffff)];
  scatter(1, 30, 140, 23, (x, z, g, r) => {
    const h = 4 + r() * 3, a = r() * TAU, pts = [];
    for (let i = 0; i <= 10; i++) pts.push([x, g + (i / 10) * h, z]);
    for (let i = 1; i <= 6; i++) {
      const t = (i / 6) * Math.PI;
      pts.push([x + Math.sin(a) * (0.9 - Math.cos(t) * 0.9), g + h + Math.sin(t) * 0.9, z + Math.cos(a) * (0.9 - Math.cos(t) * 0.9)]);
    }
    for (let i = 0; i + 1 < pts.length; i++) B.capsule(pts[i], pts[i + 1], 0.28, cane[i % 2], 6);
    cylCollider(x, z, 0.4, g, g + h, false);
  }, C, 46);
  const LOLLI = [0xff4f9a, 0x5fd3ff, 0xffd84f, 0x9dff6b, 0xc27bff].map((c) => toon(c));
  scatter(1, 40, 150, 24, (x, z, g, r) => {
    const s = 0.8 + r() * 0.5;
    B.cyl(x, g - 0.2, z, 0.16 * s, 4.6 * s, white, { solid: false, seg: 6 });
    cylCollider(x, z, 0.3, g, g + 4.5 * s, false);
    const m = LOLLI[Math.floor(r() * 5)], ry = r() * Math.PI;
    B.cyl(x, g + 5.2 * s - 0.2, z, 1.5 * s, 0.4, m, { solid: false, seg: 20, rx: Math.PI / 2, ry });
    B.cyl(x + Math.cos(ry) * 0.02, g + 5.2 * s - 0.2, z - Math.sin(ry) * 0.02, 0.8 * s, 0.44, white, { solid: false, seg: 16, rx: Math.PI / 2, ry });
  }, C, 46);
  B.detail(() => {
    // gumdrops and peppermint discs on the pink ground
    const GUMS = [0xff4f9a, 0x5fd3ff, 0xffd84f, 0x9dff6b, 0xc27bff].map((c) => toon(c));
    scatter(1, 220, 150, 25, (x, z, g, r) => {
      const s = 0.4 + r() * 0.5;
      B.cyl(x, g - 0.1, z, 0.6 * s, 0.7 * s, GUMS[Math.floor(r() * 5)], { rTop: 0.45 * s, seg: 8, solid: false });
      B.sphere(x, g + 0.6 * s, z, 0.45 * s, GUMS[Math.floor(r() * 5)], { sy: 0.4, seg: 7 });
    }, C, 46);
    const mintR = toon(0xe8303a), mintW = toon(0xffffff);
    scatter(1, 60, 150, 26, (x, z, g, r) => {
      const s = 0.6 + r() * 0.6, a = r() * TAU;
      B.cyl(x, g - 0.05, z, 0.9 * s, 0.25, mintW, { solid: false, seg: 14 });
      for (let k = 0; k < 3; k++) B.cyl(x, g + 0.02, z, 0.88 * s, 0.25, mintR, { solid: false, seg: 12, ts: a + (k * TAU) / 3, tl: TAU / 6 });
    }, C, 46);
  }, 110);
  const rockCandy = [toon(0xd99a8e, { flat: true }), toon(0xc98476, { flat: true })];
  for (let k = 0; k < 16; k++) {
    const a = 0.9 + (k / 16) * 1.5 + Math.sin(k * 3.1) * 0.05, d = 72 + (k % 3) * 9;
    const x = C.x + Math.sin(a) * d, z = C.z + Math.cos(a) * d;
    if (Math.hypot(x, z) > 330) continue;
    const g = W.ground(x, z), h = 22 + ((k * 7) % 5) * 5, rad = h * 0.28;
    B.cone(x, g - 1, z, rad, h, rockCandy[k % 2], { seg: 6, ry: k });
    B.cone(x, g + h * 0.72, z, rad * 0.29, h * 0.29, white, { seg: 6, ry: k });
    cylCollider(x, z, rad * 0.7, g - 1, g + h * 0.5);
  }

  // ── Ice Kingdom: snowy pines, snow mounds, ice crystals, snowmen ──
  const snow = toon(0xffffff, { tex: "frosting", scale: 0.2 });
  forest(2, 7, 30, (x, z) => {
    const d = Math.hypot(x - P.ice.x, z - P.ice.z);
    return d < 45 ? 0 : 0.05 + 0.55 * smoothstep(0.5, 0.68, forestNoise(x, z, 9));
  }, (x, z, g, r) => pineTree(x, z, g, r, 0.8 + r() * 0.6, true), 6);
  scatter(2, 60, 150, 31, (x, z, g, r) => B.sphere(x, g - 0.2, z, 1.2 + r() * 1.8, snow, { sy: 0.45, seg: 10 }));
  B.detail(() => {
    const crystal = [toon(0x9ad8ff, { flat: true }), toon(0xc9ecff, { flat: true }), toon(0x6fc0f0, { flat: true })];
    scatter(2, 70, 150, 32, (x, z, g, r) => {
      const n = 3 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const h = 0.8 + r() * 1.8;
        B.cone(x + (r() - 0.5) * 1.4, g - 0.2, z + (r() - 0.5) * 1.4, 0.25 + r() * 0.2, h, crystal[k % 3], { seg: 5, rx: (r() - 0.5) * 0.6, rz: (r() - 0.5) * 0.6 });
      }
    });
  }, 110);
  {
    const coal = toon(0x222228), carrot = toon(0xff8a2a), scarf = toon(0xe8303a), stick = toon(0x6e4524);
    scatter(2, 7, 120, 33, (x, z, g, r) => {
      const face = r() * TAU;
      B.sphere(x, g + 0.8, z, 1.0, snow, { seg: 10, solid: true, top: 1.6 });
      B.sphere(x, g + 2.2, z, 0.72, snow, { seg: 10 });
      B.sphere(x, g + 3.25, z, 0.52, snow, { seg: 10 });
      B.raw(GEOtorus(0.5), scarf, mtxY(x, g + 2.8, z, 0, 0.9));
      const fx = Math.sin(face), fz = Math.cos(face);
      B.cone(x + fx * 0.5, g + 3.2, z + fz * 0.5, 0.09, 0.5, carrot, { seg: 6, rx: Math.PI / 2 * fz, rz: -Math.PI / 2 * fx });
      for (const s of [-1, 1]) B.sphere(x + fx * 0.45 - fz * 0.18 * s, g + 3.4, z + fz * 0.45 + fx * 0.18 * s, 0.06, coal, { seg: 5 });
      for (const s of [-1, 1]) B.capsule([x - fz * 0.6 * s, g + 2.3, z + fx * 0.6 * s], [x - fz * 1.5 * s, g + 2.9, z + fx * 1.5 * s], 0.05, stick, 5);
    });
  }

  // ── Fire Kingdom: volcanic stumps with lava, flame geysers, charred trees, rocks ──
  const stumpM = [toon(0x3b2127, { tex: "rock", scale: 0.2 }), toon(0x4a262c, { tex: "rock", scale: 0.2 })];
  const lavaTop = toon(0xff7a1a, { emissive: 0xff4400, outline: false });
  scatter(3, 40, 150, 41, (x, z, g, r) => {
    const h = 3 + r() * 12, rad = 1.5 + r() * 2.5;
    B.cyl(x, g - 0.5, z, rad, h, stumpM[Math.floor(r() * 2)], { rTop: rad * 0.65, seg: 12 });
    B.cyl(x, g + h - 0.45, z, rad * 0.5, 0.3, lavaTop, { solid: false, seg: 12 });
  });
  const flame = toon(0xffa53b, { emissive: 0xff5500, outline: false });
  const flameIn = toon(0xfff08a, { emissive: 0xffb000, outline: false });
  scatter(3, 30, 150, 42, (x, z, g, r) => {
    B.sphere(x, g, z, 1.4, stumpM[0], { sy: 0.5, solid: true, top: 0.5 });
    B.cone(x, g + 0.4, z, 0.8, 2.4 + r(), flame, { seg: 8 });
    B.cone(x, g + 0.5, z, 0.45, 1.5, flameIn, { seg: 8 });
  });
  const char = toon(0x2a1c1c, { tex: "bark", scale: 0.4 }), ember = toon(0xff6a1a, { emissive: 0xcc3300, outline: false });
  scatter(3, 45, 150, 43, (x, z, g, r) => {
    const h = 4 + r() * 3;
    lod(x, z, () => {
      B.branch([[x, g - 0.3, z], [x + 0.3, g + h * 0.5, z], [x - 0.2, g + h, z + 0.2]], 0.45, 0.12, char, 4);
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * TAU + r(), y = g + h * (0.45 + k * 0.17);
        B.branch([[x, y, z], [x + Math.sin(a) * 1.2, y + 0.9, z + Math.cos(a) * 1.2], [x + Math.sin(a) * 2, y + 1.1 + r(), z + Math.cos(a) * 2]], 0.18, 0.05, char, 3);
      }
      B.sphere(x + 0.1, g + h * 0.4, z + 0.42, 0.1, ember, { seg: 4 });
    }, () => B.cyl(x, g - 0.3, z, 0.4, h, char, { rTop: 0.12, seg: 4, solid: false }));
    cylCollider(x, z, 0.45, g - 0.3, g + h, false);
  });
  B.detail(() => {
    const obsidian = [toon(0x2a2438, { flat: true }), toon(0x4a2a4a, { flat: true })];
    scatter(3, 60, 150, 44, (x, z, g, r) => {
      for (let k = 0; k < 3; k++) B.cone(x + (r() - 0.5) * 1.2, g - 0.2, z + (r() - 0.5) * 1.2, 0.3 + r() * 0.3, 1 + r() * 1.6, obsidian[k % 2], { seg: 4, rx: (r() - 0.5) * 0.5, rz: (r() - 0.5) * 0.5 });
    });
  }, 110);

  // ── Canyon: rock spires, boulders, cacti, bleached bones ──
  const spire = [toon(0xb4582f, { tex: "rock", scale: 0.15 }), toon(0x9a4a2c, { tex: "rock", scale: 0.15 })];
  scatter(4, 44, 150, 51, (x, z, g, r) => {
    const h = 6 + r() * 16, rad = 1.5 + r() * 2.5;
    B.cone(x, g - 1, z, rad, h, spire[Math.floor(r() * 2)], { seg: 7, ry: r() * 3 });
    cylCollider(x, z, rad * 0.7, g - 1, g + h * 0.5);
  });
  scatter(4, 40, 150, 52, (x, z, g, r) => B.sphere(x, g, z, 1 + r() * 1.5, spire[1], { sy: 0.7, solid: true, top: 0.6, seg: 8 }));
  const cactus = toon(0x4f9a4a), cactusD = toon(0x3f8a3f);
  scatter(4, 50, 150, 53, (x, z, g, r) => {
    const h = 2.2 + r() * 2.4, m = r() < 0.5 ? cactus : cactusD, a = r() * TAU;
    lod(x, z, () => {
      B.capsule([x, g - 0.2, z], [x, g + h, z], 0.38, m, 8);
      for (const s of [-1, 1]) {
        if (r() < 0.25) continue;
        const y = g + h * (0.35 + r() * 0.3), ax = Math.sin(a) * s, az = Math.cos(a) * s;
        B.capsule([x, y, z], [x + ax * 0.9, y, z + az * 0.9], 0.24, m, 6);
        B.capsule([x + ax * 0.9, y, z + az * 0.9], [x + ax * 0.9, y + 0.9 + r() * 0.5, z + az * 0.9], 0.24, m, 6);
      }
    }, () => B.cyl(x, g - 0.2, z, 0.38, h + 0.2, m, { seg: 5, solid: false }));
    cylCollider(x, z, 0.45, g, g + h, false);
  });
  const SKULL_EYE = toon(0x2a1a1a, { outline: false });
  B.detail(() => {
    const bone = toon(0xf4ecd8);
    scatter(4, 40, 150, 54, (x, z, g, r) => {
      const a = r() * TAU, l = 0.6 + r() * 0.6, dx = Math.sin(a) * l, dz = Math.cos(a) * l;
      B.capsule([x - dx, g + 0.1, z - dz], [x + dx, g + 0.1, z + dz], 0.07, bone, 5);
      for (const e of [-1, 1]) for (const s of [-1, 1]) B.sphere(x + dx * e + Math.cos(a) * 0.08 * s, g + 0.1, z + dz * e - Math.sin(a) * 0.08 * s, 0.1, bone, { seg: 5 });
      if (r() < 0.3) {
        B.sphere(x + 1, g + 0.35, z, 0.4, bone, { sy: 0.85, seg: 8 });
        for (const s of [-1, 1]) B.sphere(x + 1 + 0.15 * s, g + 0.42, z + 0.34, 0.1, SKULL_EYE, { seg: 5 });
      }
    });
  }, 110);

  // ── sky clouds (cartoon puffs) ──
  const cloud = toon(0xffffff, { emissive: 0x333333 });
  const r = rng(66);
  for (let k = 0; k < 40; k++) {
    const a = r() * TAU, d = 40 + r() * 280;
    const x = Math.cos(a) * d, z = Math.sin(a) * d, y = 80 + r() * 40, s = 4 + r() * 5;
    B.sphere(x, y, z, s, cloud, { sy: 0.6 });
    B.sphere(x + s * 0.9, y - 0.8, z + s * 0.3, s * 0.72, cloud, { sy: 0.6 });
    B.sphere(x - s * 0.95, y - 0.6, z - s * 0.2, s * 0.78, cloud, { sy: 0.6 });
    B.sphere(x + s * 0.2, y + s * 0.35, z - s * 0.1, s * 0.6, cloud, { sy: 0.7 });
  }
}

function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
// a flat ring around a vertical trunk (stripes, scarves)
const torusCache = new Map();
function GEOtorus(r) {
  const k = r.toFixed(2);
  if (!torusCache.has(k)) torusCache.set(k, new THREE.TorusGeometry(r * 1.05, r * 0.35, 3, 8));
  return torusCache.get(k);
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
/** Torus lying flat at (x, y, z), tilted by `tilt` around an axis at angle a. */
function mtxY(x, y, z, a, tilt = 0) {
  _e.set(Math.PI / 2 + Math.cos(a) * tilt, 0, Math.sin(a) * tilt, "XYZ");
  _q.setFromEuler(_e);
  return _m.compose(_p.set(x, y, z), _q, _s);
}

/** A post with arrow boards pointing along roads: entries are [text, road polyline]. */
function signpost(B, W, x, z, entries) {
  const g = W.ground(x, z), wood = toon(0xb98652, { tex: "wood", scale: 0.5 }), woodD = toon(0x8a5d36, { tex: "wood", scale: 0.5 });
  B.cyl(x, g - 0.3, z, 0.18, 4.4, woodD, { seg: 7 });
  B.sphere(x, g + 4.15, z, 0.24, woodD, { seg: 7 });
  const tex = decalTexture(512, 64 * entries.length, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.font = "bold 38px sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = "#4a2c14";
    entries.forEach(([t], i) => c.fillText(t, w / 2, i * 64 + 34));
  });
  const geos = [];
  entries.forEach(([, road], i) => {
    // point at the road's third node (where the road heads off to)
    const [tx, tz] = road[Math.min(2, road.length - 1)], a = Math.atan2(tx - x, tz - z);
    const y = g + 3.5 - i * 0.62, dx = Math.sin(a), dz = Math.cos(a), nx = Math.cos(a), nz = -Math.sin(a);
    const cx = x + dx * 1.35, cz = z + dz * 1.35;
    // the board's length runs along (dx, dz); a diamond at its end makes the arrow tip
    B.box(cx, y - 0.24, cz, 0.12, 0.48, 2.6, wood, { solid: false, ry: a, r: 0.04 });
    B.box(x + dx * 2.62, y - 0.24, z + dz * 2.62, 0.12, 0.48, 0.48, wood, { solid: false, ry: a, rx: Math.PI / 4, r: 0.04 });
    // text on both faces; each reads left to right as seen from its own side
    for (const side of [1, -1]) {
      const p = new THREE.PlaneGeometry(2.4, 0.42);
      const uv = p.attributes.uv, v0 = 1 - (i + 1) / entries.length, v1 = 1 - i / entries.length;
      for (let k = 0; k < uv.count; k++) uv.setY(k, uv.getY(k) > 0.5 ? v1 : v0);
      p.rotateY(a + (side > 0 ? Math.PI / 2 : -Math.PI / 2));
      p.translate(cx + nx * 0.066 * side, y, cz + nz * 0.066 * side);
      geos.push(p);
    }
  });
  W.scene.add(new THREE.Mesh(mergeFlat(geos), noOutline(new THREE.MeshBasicMaterial({ map: tex, transparent: true }))));
  cylCollider(x, z, 0.3, g, g + 4.2);
}
function mergeFlat(geos) {
  const pos = [], uv = [], idx = [];
  let base = 0;
  for (const gg of geos) {
    pos.push(...gg.attributes.position.array);
    uv.push(...gg.attributes.uv.array);
    for (const i of gg.index.array) idx.push(i + base);
    base += gg.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(idx);
  return out;
}
