// The Colosseum of Flames: the gladiators' arena where the Flame King fights Finn (flameking.js), out
// in the Fire Kingdom's far burning country, off the map: Flame Princess sends Finn and Jake there
// through the flames (main.js). Built like the Colosseum of Rome: a round sand floor with the royal
// flame inlaid in it, the podium wall round it with two great gates (in by one, out by the other
// once the fight is won) and the royal box on the side (Flame Princess watches from it), tiers of
// seats packed with the Fire People, a colonnade of arches on top. On the floor, eight stone
// columns with braziers: the only cover from the Flame King's Sun (the mega fireball). Volcanoes smoke
// on the horizon under a red sky (the outside of the building is never seen from in there, so it
// isn't built). It has its own Builder: its meshes are drawn only near it (and from inside W.sealed
// hides the world down below).
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Builder, GEO, mtx } from "./builder.js";
import { toon, noOutline } from "./toon.js";
import { ringCollider, cylCollider } from "./physics.js";
import { P, rng, smooth } from "./terrain.js";
import { glowTexture } from "./lair.js";

const TAU = Math.PI * 2;

/**
 * y: the floor; floor: its radius; r: how far from the middle markers and summons stay; wall: the
 * ring no one walks past (Finn stops ~29.3 from the middle; the camera ~29.6, clear of the wall and
 * everything on it); pillars: the columns ({ x, z, r }: the
 * cover from the Sun); spawnA / portalA: the gates Finn comes in by and leaves by (angles round the
 * middle, 0 = +z); box: the royal box, where Flame Princess watches ({ x, y, z, yaw }); fx: what the
 * fight tints as it goes (flameking.js).
 */
export const ARENA = { x: P.colosseum.x, z: P.colosseum.z, y: 400, floor: 30, r: 28.5, wall: 30.6, pillars: [], spawnA: Math.PI, portalA: 0, box: null, fx: null };

// colours by mood (the fight's phase: a fire, a furious fire, the blue flame): flames, their cores, embers
const MOOD = [
  [0xff7a1a, 0xffe08a, 0xff9a3a],
  [0xff4a12, 0xfff0a0, 0xff6a1a],
  [0x3a8aff, 0xe0f4ff, 0x6ab8ff],
];

/** How far inside the Colosseum of Flames a point is (0..1): tints sky, fog and light (main.js). */
export function colosseumAt(p) {
  return smooth(ARENA.y - 90, ARENA.y - 50, p.y) * (1 - smooth(110, 150, Math.hypot(p.x - ARENA.x, p.z - ARENA.z)));
}

export function buildColosseum(W) {
  const X = ARENA.x, Z = ARENA.z, Y = ARENA.y, R = ARENA.floor, r = rng(7707);
  const grp = new THREE.Group();
  W.scene.add(grp);
  const B = new Builder(grp);
  const M = {
    sand: toon(0x9a6448, { tex: "rock", scale: 0.09 }),
    wall: toon(0x6a3a30, { tex: "stone", scale: 0.4 }),
    wallD: toon(0x4a2622, { tex: "stone", scale: 0.4 }),
    seat: toon(0x5e3a34, { tex: "stone", scale: 0.35, flat: true }),
    arch: toon(0x7a4636, { tex: "stone", scale: 0.45 }),
    pillar: toon(0x4a3a3a, { tex: "rock", scale: 0.25 }),
    stone: toon(0x6a5048, { tex: "stone", scale: 0.5 }),
    rock: toon(0x2e1a1c, { tex: "rock", scale: 0.05, flat: true }),
    rockL: toon(0x4a2a28, { tex: "rock", scale: 0.08, flat: true }),
    dark: toon(0x140808, { outline: false }),
    iron: toon(0x2a2224),
    bronze: toon(0xb8742e, { emissive: 0x2a1000 }),
    gold: toon(0xf6c343, { emissive: 0x4a2800 }),
    red: toon(0xa8141e),
    redD: toon(0x6a0a12),
    glow: toon(0xff7a1b, { emissive: 0xff4400, outline: false }),
    smoke: toon(0x2a1a1e),
  };
  const at = (a, d) => [X + Math.sin(a) * d, Z + Math.cos(a) * d];
  const nearGate = (a, w) => Math.min(...[ARENA.spawnA, ARENA.portalA].map((g) => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))))) < w;
  const BOX_A = Math.PI / 2;
  const nearBox = (a, w) => Math.abs(Math.atan2(Math.sin(a - BOX_A), Math.cos(a - BOX_A))) < w;

  // flames: one mesh per colour (they flicker in brightness and take the fight's mood)
  const flameGeo = [], coreGeo = [];
  const flame = (x, y, z, s) => {
    flameGeo.push(new THREE.ConeGeometry(0.5 * s, 1.5 * s, 7).translate(x, y + 0.7 * s, z));
    for (const [dx, dz, h] of [[0.3, 0.1, 0.9], [-0.28, -0.15, 1.05], [0.05, -0.3, 0.8]]) flameGeo.push(new THREE.ConeGeometry(0.22 * s, h * s, 5).translate(x + dx * s, y + h * 0.45 * s, z + dz * s));
    coreGeo.push(new THREE.ConeGeometry(0.28 * s, 0.85 * s, 6).translate(x, y + 0.4 * s, z));
  };
  const brazier = (x, y, z, s) => {
    B.cyl(x, y, z, 0.35 * s, 0.9 * s, M.iron, { rTop: 0.2 * s, seg: 8, solid: false });
    B.cyl(x, y + 0.9 * s, z, 0.45 * s, 0.4 * s, M.bronze, { rTop: 0.7 * s, seg: 10, solid: false });
    flame(x, y + 1.2 * s, z, s);
  };

  // ── the floor: a thick disc (its collider is the floor), sand with the royal flame inlaid ──
  B.cyl(X, Y - 3, Z, 31.2, 3, M.sand, { seg: 64 });
  const inlay = new THREE.Mesh(new THREE.CircleGeometry(R + 0.1, 96).rotateX(-Math.PI / 2), noOutline(new THREE.MeshBasicMaterial({
    map: floorTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  })));
  inlay.position.set(X, Y + 0.02, Z);
  inlay.renderOrder = 1;
  grp.add(inlay);
  // a glowing gutter at the foot of the wall
  B.raw(new THREE.RingGeometry(29.35, 30.2, 96).rotateX(-Math.PI / 2), M.glow, mtx(X, Y + 0.03, Z));

  // ── the podium wall, and the ring no one walks (or double-jumps) past; not for the camera: main.js keeps it inside ──
  B.lathe([[31.9, -0.2], [31.9, 4.9], [30.45, 4.9], [30.2, 4.6], [30.2, 0]], M.wall, X, Y, Z, { seg: 96 });
  B.raw(GEO.torus(30.25, 0.16, TAU, 96), M.wallD, mtx(X, Y + 0.5, Z, 0, 1, 1, 1, Math.PI / 2));
  ringCollider(X, Z, ARENA.wall, 1.2, Y - 0.5, Y + 8, [], false);
  // relief panels, torches on brackets, red banners hanging from the parapet
  for (let k = 0; k < 32; k++) {
    const a = ((k + 0.5) / 32) * TAU;
    if (nearGate(a, 0.2) || nearBox(a, 0.12)) continue;
    const [x, z] = at(a, 30.15);
    B.box(x, Y + 1.2, z, 3.4, 2.3, 0.12, M.wallD, { solid: false, ry: a });
    if (k % 2) {
      const [tx, tz] = at(a + TAU / 64, 30.05);
      B.box(tx, Y + 2.6, tz, 0.25, 0.25, 0.5, M.iron, { solid: false, ry: a });
      B.cyl(tx, Y + 2.85, tz, 0.22, 0.3, M.bronze, { rTop: 0.34, seg: 7, solid: false });
      flame(tx, Y + 3.1, tz, 0.55);
    }
  }
  for (let k = 0; k < 12; k++) {
    const a = ((k + 0.25) / 12) * TAU;
    if (nearGate(a, 0.3) || nearBox(a, 0.3)) continue;
    const [x, z] = at(a, 30.12);
    B.box(x, Y + 2.2, z, 1.6, 2.7, 0.1, M.red, { solid: false, ry: a, r: 0.03 });
    B.box(x, Y + 4.8, z, 1.9, 0.2, 0.2, M.gold, { solid: false, ry: a });
    const [ex, ez] = at(a, 30.02);
    B.cone(ex, Y + 3.0, ez, 0.35, 0.9, M.gold, { seg: 6, ry: a, sz: 0.3 });
  }

  // ── the two great gates: a dark arched doorway under a tower, a portcullis, braziers ──
  for (const g of [ARENA.spawnA, ARENA.portalA]) {
    const cx = Math.cos(g), cz = -Math.sin(g), ux = Math.sin(g), uz = Math.cos(g), [tx, tz] = at(g, 31.6);
    B.box(tx, Y + 4.9, tz, 8.4, 5.6, 2.8, M.wall, { solid: false, ry: g });
    B.box(tx, Y + 10.5, tz, 9.0, 0.5, 3.2, M.wallD, { solid: false, ry: g });
    for (const s of [-1, 0, 1]) brazier(tx + cx * 3.2 * s, Y + 11.0, tz + cz * 3.2 * s, 1.2);
    // (everything on the wall's face stays behind r 29.7, out of the camera's way)
    const [x, z] = at(g, 30.12);
    B.box(x, Y, z, 5.6, 3.2, 0.1, M.dark, { solid: false, ry: g, r: 0.02 });
    B.raw(new THREE.CircleGeometry(2.8, 16, 0, Math.PI), M.dark, mtx(x - ux * 0.06, Y + 3.2, z - uz * 0.06, g + Math.PI));
    B.raw(GEO.torus(2.8, 0.3, Math.PI, 14), M.arch, mtx(x - ux * 0.12, Y + 3.2, z - uz * 0.12, g));
    for (const s of [-1, 1]) {
      B.box(x + cx * 3.2 * s - ux * 0.12, Y, z + cz * 3.2 * s - uz * 0.12, 0.9, 3.3, 0.5, M.arch, { solid: false, ry: g });
      const bx = x + cx * 4.6 * s - ux * 0.75, bz = z + cz * 4.6 * s - uz * 0.75;
      brazier(bx, Y, bz, 1.1);
      cylCollider(bx, bz, 0.5, Y, Y + 1.6, false);
    }
    for (let i = -5; i <= 5; i++) {
      const o = i * 0.5;
      B.box(x + cx * o - ux * 0.16, Y, z + cz * o - uz * 0.16, 0.1, 3.2 + Math.sqrt(2.8 * 2.8 - o * o) - 0.15, 0.1, M.iron, { solid: false, ry: g, r: 0.02 });
    }
    for (const y of [1.2, 2.5]) B.box(x - ux * 0.18, Y + y, z - uz * 0.18, 5.4, 0.12, 0.12, M.iron, { solid: false, ry: g, r: 0.02 });
    B.box(x + ux * 0.02, Y + 6.3, z + uz * 0.02, 2.6, 3.4, 0.1, M.red, { solid: false, ry: g, r: 0.03 });
    B.cone(x - ux * 0.05, Y + 7.3, z - uz * 0.05, 0.7, 1.7, M.gold, { seg: 6, ry: g, sz: 0.3 });
  }

  // ── the royal box: a balcony over the podium with a red canopy and a throne (Flame Princess watches from it) ──
  {
    const a = BOX_A, cx = Math.cos(a), cz = -Math.sin(a), ux = Math.sin(a), uz = Math.cos(a), [x, z] = at(a, 31.45);
    const P3 = (d, l) => [x + ux * d + cx * l, z + uz * d + cz * l];
    B.box(x, Y + 4.4, z, 7.4, 0.6, 2.6, M.wall, { solid: false, ry: a });
    { const [px, pz] = P3(-1.15, 0); B.box(px, Y + 5.0, pz, 7.4, 1.0, 0.25, M.wallD, { solid: false, ry: a }); }
    { const [px, pz] = P3(1.25, 0); B.box(px, Y + 5.0, pz, 7.4, 4.8, 0.3, M.red, { solid: false, ry: a }); }
    for (const l of [-3.4, 3.4]) for (const d of [-1.0, 1.0]) { const [px, pz] = P3(d, l); B.cyl(px, Y + 5.0, pz, 0.22, 4.8, M.gold, { seg: 8, solid: false }); }
    B.box(x, Y + 9.8, z, 7.9, 0.35, 2.6, M.red, { solid: false, ry: a });
    B.raw(new THREE.ConeGeometry(1, 1, 4, 1).rotateY(Math.PI / 4), M.redD, mtx(x, Y + 11.4, z, a, 5.6, 2.6, 2.2));
    B.cone(x, Y + 12.6, z, 0.3, 1.1, M.gold, { seg: 6 });
    for (const l of [-2.8, 2.8]) { const [px, pz] = P3(-0.4, l); brazier(px, Y + 5.0, pz, 0.8); }
    { const [px, pz] = P3(0.55, 0); B.box(px, Y + 5.0, pz, 1.4, 1.0, 0.9, M.red, { solid: false, ry: a }); }
    { const [px, pz] = P3(1.0, 0); B.box(px, Y + 5.0, pz, 1.6, 2.6, 0.3, M.gold, { solid: false, ry: a }); }
    const [fx, fz] = P3(-0.35, 0);
    ARENA.box = { x: fx, y: Y + 5.0, z: fz, yaw: a + Math.PI };
  }

  // ── the stands: three tiers of seats stepping up and back, walkways with dark vomitoria between ──
  const prof = [[31.9, 4.9]];
  let pr = 31.9, py = 4.9;
  const row = (d, h) => { prof.push([pr, py + h]); py += h; prof.push([pr + d, py]); pr += d; };
  const seats = []; // [radius, y] of each tread's front, for the crowd
  const tier = (n, d, h) => { for (let i = 0; i < n; i++) { row(d, h); seats.push([pr - d * 0.45, py]); } };
  const walk = (w, wall) => { row(w, 0.5); const r0 = pr - w; row(0.1, wall); return r0; };
  tier(6, 1.05, 0.7);
  const w1 = walk(1.4, 2.2);
  tier(6, 1.05, 0.75);
  const w2 = walk(1.4, 2.2);
  tier(5, 1.05, 0.8);
  const topR = pr, topY = py;
  prof.push([topR + 3.2, topY]);
  prof.push([topR + 3.2, topY - 0.6]);
  B.lathe(prof.reverse().map(([a, b]) => [a, b]), M.seat, X, Y, Z, { seg: 96 });
  // vomitoria: dark doorways in the walls behind the walkways, and the aisles between the wedges
  for (const [wr, wy] of [[w1, seats[5][1]], [w2, seats[11][1]]]) {
    for (let k = 0; k < 16; k++) {
      const a = ((k + 0.5) / 16) * TAU, [x, z] = at(a, wr + 1.38), ux = Math.sin(a), uz = Math.cos(a);
      B.box(x, Y + wy + 0.5, z, 1.6, 1.2, 0.08, M.dark, { solid: false, ry: a, r: 0.02 });
      B.raw(new THREE.CircleGeometry(0.8, 10, 0, Math.PI), M.dark, mtx(x - ux * 0.05, Y + wy + 1.7, z - uz * 0.05, a + Math.PI));
      B.raw(GEO.torus(0.8, 0.12, Math.PI, 8), M.arch, mtx(x - ux * 0.06, Y + wy + 1.7, z - uz * 0.06, a));
    }
  }
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * TAU;
    if (nearGate(a, 0.1)) continue;
    for (const [s0, s1] of [[0, 5], [6, 11], [12, 16]]) {
      const [ra, ya] = seats[s0], [rb, yb] = seats[s1], [xa, za] = at(a, ra - 0.35), [xb, zb] = at(a, rb + 0.7);
      B.plank([xa, Y + ya - 0.3, za], [xb, Y + yb + 0.05, zb], 0.9, 0.4, M.stone);
    }
  }

  // ── the colonnade on top: arches against the sky, a cornice, masts with braziers ──
  const CN = 60, CR = topR + 1.4, CY = Y + topY, CH = 5.2, ar = Math.sin(Math.PI / CN) * CR - 0.55;
  for (let k = 0; k < CN; k++) {
    const a = (k / CN) * TAU, [x, z] = at(a, CR), [ax, az] = at(a + Math.PI / CN, CR);
    B.box(x, CY, z, 1.1, CH, 1.1, M.arch, { solid: false, ry: a });
    B.raw(GEO.torus(ar, 0.4, Math.PI, 10), M.arch, mtx(ax, CY + CH, az, a + Math.PI / CN));
  }
  B.lathe([[CR + 0.7, CH + ar + 0.3], [CR + 0.7, CH + ar + 1.6], [CR - 0.7, CH + ar + 1.6], [CR - 0.7, CH + ar + 0.3]].map(([a, b]) => [a, b]), M.wall, X, CY, Z, { seg: 96 });
  B.lathe([[CR + 1.8, CH + ar + 1.6], [CR + 1.8, CH + ar + 3.4], [CR + 0.7, CH + ar + 3.4], [CR + 0.7, CH + ar + 1.6]], M.wallD, X, CY, Z, { seg: 96 });
  for (let k = 0; k < 12; k++) {
    const a = ((k + 0.5) / 12) * TAU, [x, z] = at(a, CR + 1.2);
    B.cyl(x, CY + CH + ar + 3.4, z, 0.22, 5.5, M.iron, { seg: 6, solid: false });
    B.box(x + Math.cos(a) * 0.9, CY + CH + ar + 6.2, z - Math.sin(a) * 0.9, 1.7, 2.4, 0.08, M.red, { solid: false, ry: a + Math.PI / 2, r: 0.02 });
    brazier(x, CY + CH + ar + 8.9, z, 1.4);
  }

  // ── the columns on the floor: the only cover from the Sun ──
  for (let k = 0; k < 8; k++) {
    const a = ((k + 0.5) / 8) * TAU, [x, z] = at(a, 16);
    ARENA.pillars.push({ x, z, r: 1.7 });
    B.cyl(x, Y, z, 1.95, 0.6, M.stone, { rTop: 1.85, seg: 14, solid: false });
    B.cyl(x, Y + 0.6, z, 1.7, 8.1, M.pillar, { rTop: 1.5, seg: 14, solid: false });
    for (const [y, rr] of [[2.4, 1.64], [6.4, 1.56]]) B.raw(GEO.torus(rr, 0.13, TAU, 16), M.glow, mtx(x, Y + y, z, 0, 1, 1, 1, Math.PI / 2));
    B.cyl(x, Y + 8.7, z, 1.55, 0.55, M.stone, { rTop: 2.0, seg: 14, solid: false });
    B.cyl(x, Y + 9.25, z, 1.35, 0.7, M.bronze, { rTop: 1.7, seg: 12, solid: false });
    flame(x, Y + 9.6, z, 1.7);
    cylCollider(x, z, 1.85, Y - 0.5, Y + 10);
  }

  // ── out beyond the stands: volcanoes smoking on the horizon (the arena stands on a mesa in a lava sea, never seen from inside) ──
  const volcano = (a, d, h, w) => {
    const [x, z] = at(a, d), y0 = Y - 40;
    B.cone(x, y0, z, w, h, M.rock, { seg: 10, ry: r() * 3 });
    B.raw(GEO.torus(w * 0.13, w * 0.035, TAU, 12), M.glow, mtx(x, y0 + h * 0.87, z, 0, 1, 1, 1, Math.PI / 2));
    for (let i = 0; i < 6; i++) B.sphere(x + (r() - 0.5) * w * 0.3 + i * 2, y0 + h + 4 + i * 5, z + (r() - 0.5) * w * 0.3, w * 0.12 + i * 1.4, M.smoke, { seg: 8 });
  };
  for (let k = 0; k < 9; k++) volcano((k / 9) * TAU + r() * 0.4, 190 + r() * 110, 70 + r() * 70, 55 + r() * 35);

  // ── the crowd: Fire People packing the stands (one instanced mesh; they bob, and jump when they cheer) ──
  const crowdGeo = (() => {
    const part = (g, c) => {
      g = g.toNonIndexed();
      const col = new Float32Array(g.attributes.position.count * 3), cc = new THREE.Color(c);
      for (let i = 0; i < col.length; i += 3) col.set([cc.r, cc.g, cc.b], i);
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      g.deleteAttribute("uv");
      return g;
    };
    return mergeGeometries([
      part(new THREE.CylinderGeometry(0.22, 0.36, 0.8, 6).translate(0, 0.4, 0), 0x8a2a1a),
      part(new THREE.SphereGeometry(0.3, 6, 4).translate(0, 1.05, 0), 0xffa040),
      part(new THREE.ConeGeometry(0.2, 0.55, 5).translate(0, 1.5, -0.04), 0xffd860),
    ]);
  })();
  const spots = [];
  for (let i = 0; i < seats.length; i++) {
    const [sr, sy] = seats[i], n = Math.round((TAU * sr) / 0.95), fill = i < 6 ? 0.4 : i < 12 ? 0.3 : 0.22;
    for (let k = 0; k < n; k++) {
      const a = ((k + r() * 0.3) / n) * TAU;
      if (r() > fill || nearGate(a, 0.09) || nearBox(a, 0.13)) continue;
      spots.push([a, sr + (r() - 0.5) * 0.2, sy]);
    }
  }
  const crowdMat = toon(0xffffff, { vc: true, outline: false }).clone();
  const CU = { time: { value: 0 }, cheer: { value: 0 } };
  crowdMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = CU.time;
    sh.uniforms.uCheer = CU.cheer;
    sh.vertexShader = "uniform float uTime;\nuniform float uCheer;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  float ph = float(gl_InstanceID) * 1.618;\n  transformed.y += (0.05 + uCheer * 0.55) * max(0.0, sin(uTime * (4.0 + mod(ph, 3.0) + uCheer * 3.0) + ph));");
  };
  crowdMat.customProgramCacheKey = () => "crowd";
  noOutline(crowdMat);
  const crowd = new THREE.InstancedMesh(crowdGeo, crowdMat, spots.length);
  const TINT = [0xffffff, 0xffd0b0, 0xff9a80, 0xb0b0b0, 0x8a8a8a];
  const _m = new THREE.Matrix4(), _c = new THREE.Color();
  spots.forEach(([a, sr, sy], i) => {
    const [x, z] = at(a, sr), s = 0.62 + r() * 0.22;
    _m.compose(new THREE.Vector3(x - X, sy, z - Z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a + Math.PI, 0)), new THREE.Vector3(s, s, s));
    crowd.setMatrixAt(i, _m);
    crowd.setColorAt(i, _c.setHex(TINT[Math.floor(r() * TINT.length)]));
  });
  crowd.position.set(X, Y, Z);
  crowd.frustumCulled = false;
  grp.add(crowd);

  const flames = new THREE.Group();
  const flameMat = noOutline(new THREE.MeshBasicMaterial({ color: MOOD[0][0], fog: false }));
  const coreMat = noOutline(new THREE.MeshBasicMaterial({ color: MOOD[0][1], fog: false }));
  flames.add(new THREE.Mesh(mergeGeometries(flameGeo), flameMat), new THREE.Mesh(mergeGeometries(coreGeo), coreMat));
  grp.add(flames);
  // embers and ash rising all round, over the floor and out over the lava
  const EN = 260, ePos = new Float32Array(EN * 3), eCol = new Float32Array(EN * 3), ember = [];
  for (let i = 0; i < EN; i++) {
    const a = r() * TAU, d = i < 90 ? r() * 29 : 30 + r() * 70;
    ember.push({ x: Math.sin(a) * d, z: Math.cos(a) * d, y: r() * 45 - 5, v: 0.8 + r() * 1.8, ph: r() * TAU, c: r() < 0.25 ? 1 : r() < 0.3 ? 2 : 0 });
  }
  const eGeo = new THREE.BufferGeometry();
  eGeo.setAttribute("position", new THREE.BufferAttribute(ePos, 3).setUsage(THREE.DynamicDrawUsage));
  eGeo.setAttribute("color", new THREE.BufferAttribute(eCol, 3).setUsage(THREE.DynamicDrawUsage));
  const embers = new THREE.Points(eGeo, noOutline(new THREE.PointsMaterial({ size: 0.5, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
  embers.position.set(X, Y, Z);
  embers.frustumCulled = false;
  grp.add(embers);

  B.build();
  // from inside, nothing of the world below is drawn (it is far below the lava sea's haze anyway)
  W.sealed(X, Z, 140, Y - 60, Y + 160, 0);
  // the fight sets ARENA.fx.mood (0 a fire, 1 furious, 2 the blue flame): flames and embers shift toward
  // its colours; `flash` (0..1) flares every flame up for a moment; `cheer` (0..1) makes the crowd jump
  const cur = MOOD[0].map((c) => new THREE.Color(c)), _k = new THREE.Color();
  const EC = [new THREE.Color(0xff9a3a), new THREE.Color(0xffe08a), new THREE.Color(0x6a6060)];
  ARENA.fx = { mood: 0, flash: 0, cheer: 0 };
  let last = 0;
  W.tick((t, cam) => {
    grp.visible = !!cam && cam.y > Y - 160 && Math.hypot(cam.x - X, cam.z - Z) < 420;
    const dt = Math.min(0.1, Math.max(0, t - last));
    last = t;
    if (!grp.visible) return;
    const fx = ARENA.fx, k = 1 - Math.exp(-2 * dt);
    MOOD[fx.mood].forEach((c, i) => cur[i].lerp(_k.setHex(c), k));
    fx.flash = Math.max(0, fx.flash - dt * 2);
    fx.cheer = Math.max(0, fx.cheer - dt * 0.35);
    const flick = 0.85 + 0.1 * Math.sin(t * 9.1) + 0.05 * Math.sin(t * 23.7) + fx.flash * 0.6;
    flameMat.color.copy(cur[0]).multiplyScalar(flick);
    coreMat.color.copy(cur[1]).multiplyScalar(flick);
    CU.time.value = t;
    CU.cheer.value = Math.min(1, fx.cheer);
    EC[0].copy(cur[2]);
    for (let i = 0; i < EN; i++) {
      const m = ember[i];
      m.y += m.v * dt;
      if (m.y > 40) m.y -= 45;
      const f = Math.sin(((m.y + 5) / 45) * Math.PI) * (0.6 + 0.4 * Math.sin(t * 3 + m.ph)), c = EC[m.c];
      ePos.set([m.x + Math.sin(t * 0.7 + m.ph) * 0.8, m.y, m.z + Math.cos(t * 0.6 + m.ph) * 0.8], i * 3);
      eCol.set([c.r * f, c.g * f, c.b * f], i * 3);
    }
    eGeo.attributes.position.needsUpdate = true;
    eGeo.attributes.color.needsUpdate = true;
  });
}

/** The floor's inlay: rings of dark stone, the royal flame in the middle, rays of red out to the wall. */
function floorTexture() {
  const s = 1024, c = document.createElement("canvas");
  c.width = c.height = s;
  const x = c.getContext("2d"), h = s / 2, R = h - 4, rr = rng(3131);
  x.translate(h, h);
  x.lineCap = x.lineJoin = "round";
  const ring = (f, w, col) => { x.strokeStyle = col; x.lineWidth = w; x.beginPath(); x.arc(0, 0, R * f, 0, TAU); x.stroke(); };
  // sand scuffs
  for (let i = 0; i < 260; i++) {
    const a = rr() * TAU, d = Math.sqrt(rr()) * R;
    x.fillStyle = rr() < 0.5 ? "rgba(60,20,10,0.10)" : "rgba(255,220,170,0.08)";
    x.beginPath();
    x.ellipse(Math.cos(a) * d, Math.sin(a) * d, 6 + rr() * 22, 3 + rr() * 9, rr() * 3, 0, TAU);
    x.fill();
  }
  ring(0.985, 10, "rgba(40,12,8,0.55)");
  ring(0.94, 4, "rgba(40,12,8,0.45)");
  ring(0.47, 8, "rgba(40,12,8,0.5)");
  ring(0.43, 3, "rgba(255,140,40,0.75)");
  ring(0.26, 6, "rgba(40,12,8,0.5)");
  // rays out to the wall, between the columns
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU;
    x.strokeStyle = k % 2 ? "rgba(40,12,8,0.35)" : "rgba(170,30,20,0.5)";
    x.lineWidth = k % 2 ? 4 : 7;
    x.beginPath();
    x.moveTo(Math.sin(a) * R * 0.47, Math.cos(a) * R * 0.47);
    x.lineTo(Math.sin(a) * R * 0.94, Math.cos(a) * R * 0.94);
    x.stroke();
  }
  // the royal flame (the Fire Kingdom's emblem: a drop of fire with a crown), red and gold
  x.save();
  x.scale(R * 0.075, R * 0.075);
  const drop = new Path2D();
  drop.moveTo(0, 2.2);
  drop.bezierCurveTo(2.4, 2.2, 2.6, -0.4, 1.2, -1.4);
  drop.bezierCurveTo(1.6, -0.4, 0.9, -0.2, 0.6, -0.6);
  drop.bezierCurveTo(0.9, -1.8, 0.3, -2.6, 0, -3.2);
  drop.bezierCurveTo(-0.3, -2.6, -0.9, -1.8, -0.6, -0.6);
  drop.bezierCurveTo(-0.9, -0.2, -1.6, -0.4, -1.2, -1.4);
  drop.bezierCurveTo(-2.6, -0.4, -2.4, 2.2, 0, 2.2);
  x.fillStyle = "rgba(190,30,20,0.85)";
  x.fill(drop);
  x.lineWidth = 0.14;
  x.strokeStyle = "rgba(255,190,60,0.95)";
  x.stroke(drop);
  const hole = new Path2D();
  hole.moveTo(0, 1.5);
  hole.bezierCurveTo(1.3, 1.5, 1.2, 0, 0, -1.2);
  hole.bezierCurveTo(-1.2, 0, -1.3, 1.5, 0, 1.5);
  x.fillStyle = "rgba(255,170,50,0.9)";
  x.fill(hole);
  x.beginPath();
  x.moveTo(-1.6, 3.0); x.lineTo(1.6, 3.0); x.lineTo(1.8, 2.3); x.lineTo(1.0, 2.6); x.lineTo(0, 2.1); x.lineTo(-1.0, 2.6); x.lineTo(-1.8, 2.3); x.closePath();
  x.fillStyle = "rgba(255,200,70,0.95)";
  x.fill();
  x.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
