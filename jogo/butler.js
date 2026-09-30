// The Peppermint Butler fight in the Dark Lair (LAIR in lair.js), where his dark magic brings Finn and
// Jake (main.js warps them in). He floats low enough for the sword and blinks about in puffs of shadow.
// Every area attack marks its ground first (hazards.js):
//   stakes  Rain of Stakes: circles on Finn one after another; a stake from his vampire-hunting kit
//           ("Stakes") slams into each and stays stuck in the floor a while, a post to go around
//   hands   Hands from Beyond (his ties to the Land of the Dead): bands fanned out from him toward
//           Finn; shadow hands burst up along them (behind him is safe)
//   hiss    Dark Hiss: he blinks up close and hisses like a cat ("Mortal Recoil"): a circle round him
//   summon  Summon Imps (the demons of "The Suitor"): little demons fly at Finn; close to him, or when
//           their time is up, they swell and pop (a small circle). One blow ends one.
//   shadow  Shadow Step: he sinks into the floor, his shadow chases Finn, locks, he bursts up out of it
//           and has to catch his breath (the time to hit him)
//   seal    Dark Seal (from 60% hp): the whole floor but one small circle of blessed light (the
//           exorcist's boundary of "Ghost Fly"), marked by a column of light: get in there
//   armor   Astral Armor (below 30%): his spirit body of "Nemesis", a giant knight, looms behind him and
//           sweeps its flaming sword (fans, one after another), then brings it straight down (a band)
// At 60% and 30% hp he drops his manners (the demon face, then the armor and a blood-red lair with
// lightning; shorter warnings, more of everything) and a heart. From 60% on, pile too many blows on him
// at once and he answers with a Dark Burst (a small circle round him: step back). Beaten, he drops the Night Sword (the first time) and a
// portal home opens. If Finn faints, the fight is over: he wakes up by the Butler in the castle.
// Attack scripts are generators stepped with the physics dt (deterministic under __game.sim).
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { makeNpc } from "./npcs.js";
import { toon, noOutline } from "./toon.js";
import { LAIR, ritualTex, glowTexture } from "./lair.js";
import { boltGeo, shapeBolt } from "./boss.js";
import { makeShadow, makeNightSword } from "./characters.js";
import { createHazards, CIRCLE, RING, SECTOR, BAND } from "./hazards.js";
import { G, add, cap, lathe, blob, group, bake, decal, poly } from "./shapes.js";
import { makeCrystal, orbitCrystal } from "./crystals.js";
import { STR } from "./strings.js";

// hp, sizes (world units) and timings (s); arrays are per phase (100–60%, 60–30%, below 30%)
export const K = {
  hp: 180, scale: 2.2, body: 0.72, hover: 0.55, glide: [9.5, 11, 13],
  phase2: 0.6, phase3: 0.3, heartEvery: 54,
  stakes: { n: [8, 9, 10], every: [0.37, 0.31, 0.27], warn: [0.8, 0.7, 0.63], r: 1.9, stuck: 4.5 },
  hands: { n: [5, 6, 7], spread: [0.42, 0.34, 0.3], warn: [0.87, 0.76, 0.69], w: 1.3, waves: [1, 2, 3] },
  hiss: { warn: [0.95, 0.83, 0.74], r: 6.6, reps: [1, 2, 2] },
  summon: { n: [4, 5, 6], speed: [5.9, 6.6, 7.2], fuse: 6.5, pop: 0.75, r: 2.2, max: 6 },
  shadow: { follow: [2.0, 1.65, 1.45], lock: [0.61, 0.54, 0.48], r: 3.2, chase: [8.5, 9.5, 10.5], daze: [1.65, 1.4, 1.15], reps: [1, 2, 2] },
  seal: { warn: [1.72, 1.54, 1.4], safe: 2.9, reps: [1, 2, 2] },
  armor: { warn: 0.78, r: 13, half: 0.85, swings: 5, slamWarn: 0.86, slamW: 2.4 },
  // the Dark Burst: `dmg` taken in a rush (it drains away at dmg/window per second) sets it off
  counter: { dmg: 5, window: 2.5, warn: 0.65, r: 3.6, cd: 7 },
};
// what each phase draws from (the bag is shuffled; he never repeats the last one)
const ORDER = [
  ["stakes", "hands", "hiss", "summon", "shadow"],
  ["stakes", "hands", "hiss", "summon", "shadow", "seal"],
  ["stakes", "hands", "hiss", "summon", "shadow", "seal", "armor", "armor"],
];
const TAU = Math.PI * 2, L = LAIR;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const turnToward = (a, b, max) => a + clamp(wrap(b - a), -max, max);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const lerp = (a, b, k) => a + (b - a) * k;
const $ = (id) => document.getElementById(id);
const DARK = [0x1a0a26, 0x6a2bd6, 0xb070ff];
const additive = (color, o = {}) => noOutline(new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, ...o }));

/** A little bat wing in the x-y plane, reaching out along +x (s = -1: along -x). */
function batWing(s, w, h) {
  const sh = new THREE.Shape(), P = (x, y) => [s * x * w, y * h];
  sh.moveTo(...P(0, 0.1));
  sh.quadraticCurveTo(...P(0.5, 0.6), ...P(1, 0.45));
  sh.lineTo(...P(0.92, -0.05));
  sh.quadraticCurveTo(...P(0.75, 0), ...P(0.62, -0.45));
  sh.quadraticCurveTo(...P(0.45, -0.2), ...P(0.3, -0.6));
  sh.quadraticCurveTo(...P(0.15, -0.2), ...P(0, -0.25));
  sh.closePath();
  return new THREE.ShapeGeometry(sh, 5);
}
/** An imp: a round little demon with horns, yellow eyes, a fanged grin and flapping bat wings. */
function makeImp() {
  const root = new THREE.Group(), b = group(root, 0, 0, 0), RED = 0xb0142c, SKIN = 0x2a1238;
  const body = blob(b, [0.34, 0.36, 0.31], 2.3, SKIN, 0, 0, 0, { ws: 16, hs: 12 });
  for (const s of [-1, 1]) add(b, G.cone, RED, s * 0.17, 0.36, 0, 0.07, 0.28, 0.07, { rz: -s * 0.4 });
  add(b, G.cone, SKIN, 0, -0.2, -0.36, 0.06, 0.34, 0.06, { rx: -2.2 }); // the tail
  decal(body, [poly([[-0.2, 0.2], [-0.06, 0.1], [-0.02, 0.14]]), poly([[0.2, 0.2], [0.06, 0.1], [0.02, 0.14]])], 0x0d0610, { lift: 0.004 }); // angry brows
  const eyes = decal(body, [poly([[-0.17, 0.08], [-0.05, 0.05], [-0.07, 0.0], [-0.15, 0.02]]), poly([[0.17, 0.08], [0.05, 0.05], [0.07, 0.0], [0.15, 0.02]])], 0xffe14d, { lift: 0.005, emissive: 0x8a6a00, keep: true, pivot: [0, 0.04] });
  decal(body, poly([[-0.14, -0.08], [0.14, -0.08], [0.08, -0.17], [-0.08, -0.17]]), 0x4a0818, { lift: 0.004 });
  decal(body, [poly([[-0.1, -0.08], [-0.05, -0.08], [-0.075, -0.13]]), poly([[0.1, -0.08], [0.05, -0.08], [0.075, -0.13]])], 0xffffff, { lift: 0.007 });
  const wings = [-1, 1].map((s) => {
    const w = group(b, s * 0.2, 0.12, -0.18);
    add(w, batWing(s, 0.5, 0.4), RED, 0, 0, 0, 1, 1, 1, { side: THREE.DoubleSide });
    return w;
  });
  bake(root);
  root.userData = { body: b, wings, eyes };
  return root;
}
/** His spirit body ("Nemesis"): a ghostly knight with a pointed helm, a T visor and a flaming sword. */
function makeArmor() {
  const root = new THREE.Group();
  const ghost = additive(0x6f52ff, { opacity: 0.4 }), dark = additive(0x3a24b0, { opacity: 0.55 });
  const visorM = additive(0xffe060, { opacity: 0.95 }), blade = additive(0xe8dcff, { opacity: 0.85 }), fire = additive(0xff6a1a, { opacity: 0.6 });
  lathe(root, [[0.001, 0], [0.12, 0.25], [0.3, 0.55], [0.42, 0.95], [0.45, 1.25], [0.001, 1.3]], 0, 0, 0.1, 0, { material: ghost, seg: 14 }); // a ghostly body, tapering off below
  add(root, G.sph, 0, 0, 1.45, 0, 0.5, 0.36, 0.34, { material: dark }); // breastplate
  for (const s of [-1, 1]) add(root, G.sph, 0, s * 0.52, 1.62, 0, 0.26, 0.16, 0.26, { material: dark }); // pauldrons
  lathe(root, [[0.001, 0], [0.25, 0], [0.27, 0.12], [0.23, 0.34], [0.12, 0.56], [0.001, 0.66]], 0, 0, 1.72, 0, { material: dark, seg: 14 }); // pointed helm
  add(root, new THREE.BoxGeometry(0.34, 0.05, 0.05), 0, 0, 1.92, 0.25, 1, 1, 1, { material: visorM });
  add(root, new THREE.BoxGeometry(0.06, 0.2, 0.05), 0, 0, 1.83, 0.25, 1, 1, 1, { material: visorM });
  cap(root, [-0.52, 1.55, 0], [-0.62, 0.95, 0.1], 0.1, 0, { material: ghost });
  // the sword arm: hangs along -y from the shoulder; the blade goes on past the gauntlet
  const arm = group(root, 0.52, 1.55, 0);
  arm.rotation.order = "YXZ";
  cap(arm, [0, 0, 0], [0, -0.95, 0], 0.11, 0, { material: ghost });
  add(arm, G.sph, 0, 0, -1.0, 0, 0.14, 0.14, 0.14, { material: dark });
  add(arm, new THREE.BoxGeometry(0.34, 0.06, 0.08), 0, 0, -1.12, 0, 1, 1, 1, { material: dark }); // cross-guard
  add(arm, new THREE.BoxGeometry(0.2, 2.8, 0.05), 0, 0, -2.55, 0, 1, 1, 1, { material: blade });
  add(arm, G.cone, 0, 0, -4.1, 0, 0.1, 0.3, 0.025, { material: blade, rz: Math.PI });
  for (let i = 0; i < 7; i++) add(arm, G.cone, 0, (i % 2 ? 0.1 : -0.1), -1.35 - i * 0.42, 0, 0.22, 0.75, 0.08, { material: fire, rz: Math.PI + (i % 2 ? -0.35 : 0.35) });
  return { root, arm };
}
/** A wooden stake, point down: y 0 is the tip. */
function stakeGeo() {
  const shaft = new THREE.CylinderGeometry(0.26, 0.2, 3.2, 7).translate(0, 2.6, 0);
  const tip = new THREE.ConeGeometry(0.2, 1, 7).rotateX(Math.PI).translate(0, 0.5, 0);
  const band = new THREE.CylinderGeometry(0.3, 0.3, 0.22, 7).translate(0, 3.7, 0);
  return mergeGeometries([shaft, tip, band].map((g) => g.toNonIndexed()));
}
/** A shadow hand reaching up out of the floor: forearm, palm, three clawed fingers. */
function handGeo() {
  const parts = [new THREE.CylinderGeometry(0.16, 0.22, 1.1, 6).translate(0, 0.55, 0), new THREE.SphereGeometry(0.26, 6, 5).scale(1, 0.8, 0.55).translate(0, 1.2, 0)];
  for (const [x, rz] of [[-0.16, 0.35], [0, 0], [0.16, -0.35]]) parts.push(new THREE.ConeGeometry(0.07, 0.55, 5).translate(0, 0.27, 0).rotateZ(rz).rotateX(0.35).translate(x, 1.35, 0.05));
  return mergeGeometries(parts.map((g) => g.toNonIndexed()));
}
function portalTexture() {
  const s = 256, c = document.createElement("canvas");
  c.width = c.height = s;
  const x = c.getContext("2d"), g = x.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,240,255,1)");
  g.addColorStop(0.25, "rgba(150,90,255,0.95)");
  g.addColorStop(0.85, "rgba(40,10,80,0.9)");
  g.addColorStop(1, "rgba(20,0,40,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, s, s);
  x.lineCap = "round";
  for (let arm = 0; arm < 5; arm++) {
    x.strokeStyle = arm % 2 ? "rgba(255,255,255,0.55)" : "rgba(190,140,255,0.7)";
    x.lineWidth = 9;
    x.beginPath();
    for (let i = 0; i <= 50; i++) {
      const t = i / 50, a = arm * (TAU / 5) + t * 4.5, rad = t * s * 0.46;
      i ? x.lineTo(s / 2 + Math.cos(a) * rad, s / 2 + Math.sin(a) * rad) : x.moveTo(s / 2, s / 2);
    }
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A scorch mark: a dark blotch with cracks glowing violet out of the middle. */
function scorchTexture() {
  const s = 256, c = document.createElement("canvas");
  c.width = c.height = s;
  const x = c.getContext("2d"), h = s / 2, g = x.createRadialGradient(h, h, 4, h, h, h);
  g.addColorStop(0, "rgba(8,0,16,0.9)");
  g.addColorStop(0.55, "rgba(20,4,34,0.6)");
  g.addColorStop(1, "rgba(20,4,34,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, s, s);
  x.strokeStyle = "rgba(200,130,255,0.95)";
  x.shadowColor = "#c080ff";
  x.shadowBlur = 10;
  x.lineCap = x.lineJoin = "round";
  for (let k = 0; k < 7; k++) {
    // each crack thins out as it runs from the middle
    let a = (k / 7) * TAU + Math.random() * 0.5, r = 8, px = h, py = h, w = 4.5;
    while (r < h * 0.85) {
      r += 10 + Math.random() * 16;
      a += (Math.random() - 0.5) * 0.7;
      const nx = h + Math.cos(a) * r, ny = h + Math.sin(a) * r;
      x.lineWidth = w;
      x.beginPath();
      x.moveTo(px, py);
      x.lineTo(nx, ny);
      x.stroke();
      px = nx;
      py = ny;
      w = Math.max(1, w - 0.5);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * api (main.js): player, hurt(n, nx, nz, kind), burst(x, y, z, n, colors, speed, up, g, life), fx, sfx,
 * shake, freeze, dropHeart(x, y, z), onStart() (Jake says so), onWin() (true the first time),
 * onReward() (the Night Sword), leave() (Finn stepped into the portal).
 */
export function createButler(scene, api) {
  const pl = api.player.pos;
  // ── the Butler (his own materials: he flashes white when hit) ──
  const model = makeNpc("pepbutBoss");
  model.scale.setScalar(K.scale);
  const own = new Map();
  model.traverse((o) => {
    if (!o.isMesh) return;
    let m = own.get(o.material);
    if (!m) {
      m = o.material.clone();
      m.userData = { ...o.material.userData };
      if (o.material.onBeforeCompile) m.onBeforeCompile = o.material.onBeforeCompile;
      own.set(o.material, m);
    }
    o.material = m;
  });
  const mats = [...own.values()].filter((m) => m.emissive);
  const baseEm = mats.map((m) => m.emissive.clone());
  const U = model.userData;
  model.visible = false;
  scene.add(model);
  const shadow = makeShadow(0.9);
  shadow.visible = false;
  scene.add(shadow);
  // dark magic in his hands while he casts; a bubble while he's untouchable (the rage between phases)
  const glowGeo = new THREE.SphereGeometry(1, 10, 8), glowMat = additive(0xb070ff, { opacity: 0.9 });
  const glows = U.arms.map((A) => {
    const m = new THREE.Mesh(glowGeo, glowMat);
    m.position.set(0, -0.17, 0.02);
    m.scale.setScalar(0.001);
    A.el.add(m);
    return m;
  });
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), additive(0x9a50ff, { opacity: 0.28, side: THREE.DoubleSide }));
  bubble.visible = false;
  scene.add(bubble);
  // the pool of shadow he moves in while sunk into the floor
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2), noOutline(new THREE.MeshBasicMaterial({ color: 0x07020c, transparent: true, opacity: 0.8, depthWrite: false })));
  pool.visible = false;
  pool.renderOrder = 3;
  scene.add(pool);
  // the astral armor
  const armor = makeArmor();
  armor.root.visible = false;
  scene.add(armor.root);
  const AR = { k: 0, on: false, mode: "rest", t: 0, dur: 1, dir: 1 };
  // the column of blessed light over the safe circle of the Dark Seal
  const blessed = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 24, 1, true).translate(0, 0.5, 0), additive(0xfff0b0, { opacity: 0.3, side: THREE.DoubleSide }));
  blessed.visible = false;
  scene.add(blessed);
  const BL = { t: 0, x: 0, z: 0 };

  // ── pools: stakes and shadow hands (instanced), the imps ──
  const SK = 20, stakeMesh = new THREE.InstancedMesh(stakeGeo(), toon(0x9a6438, { flat: true, outline: false }), SK);
  const HN = 260, handMesh = new THREE.InstancedMesh(handGeo(), toon(0x2a1238, { flat: true, outline: false, emissive: 0x2a0a4a }), HN);
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  for (const [mesh, n] of [[stakeMesh, SK], [handMesh, HN]]) {
    for (let i = 0; i < n; i++) mesh.setMatrixAt(i, _m4.makeScale(0, 0, 0));
    mesh.frustumCulled = false;
    mesh.visible = false;
    scene.add(mesh);
  }
  const stakes = [], hands = [];
  for (let i = 0; i < SK; i++) stakes.push({ on: false, shown: false, t: 0, life: 1, x: 0, z: 0, ry: 0, tilt: 0 });
  for (let i = 0; i < HN; i++) hands.push({ on: false, shown: false, t: 0, life: 1, x: 0, z: 0, s: 1, ry: 0, rx: 0, rz: 0, k: 0 });
  let handNext = 0;
  const STAKE_FALL = 0.26; // a stake lands this long after it starts to fall
  const imps = [];
  for (let i = 0; i < K.summon.max; i++) {
    const m = makeImp();
    m.visible = false;
    scene.add(m);
    const sh = makeShadow(0.4);
    sh.visible = false;
    scene.add(sh);
    const e = { on: false, dead: true, active: true, isBoss: false, st: "rise", t: 0, x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0, face: 0, flash: 0, hz: null, model: m, shadow: sh, seed: i * 1.7, floor: L.y };
    e.hurt = (n, nx, nz) => killImp(e, nx, nz);
    imps.push(e);
  }

  // ── glow: soft additive motes in one Points mesh (his aura, blink streaks, the armor's fire, sparkles) ──
  const GN = 600, gPos = new Float32Array(GN * 3), gCol = new Float32Array(GN * 3), motes = [];
  for (let i = 0; i < GN; i++) motes.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0, g: 0, b: 0, drag: 0 });
  const gGeo = new THREE.BufferGeometry();
  gGeo.setAttribute("position", new THREE.BufferAttribute(gPos, 3).setUsage(THREE.DynamicDrawUsage));
  gGeo.setAttribute("color", new THREE.BufferAttribute(gCol, 3).setUsage(THREE.DynamicDrawUsage));
  const gPts = new THREE.Points(gGeo, noOutline(new THREE.PointsMaterial({ size: 0.75, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
  gPts.frustumCulled = false;
  gPts.visible = false;
  gPts.renderOrder = 4;
  scene.add(gPts);
  let gNext = 0, gAny = false;
  const _gc = new THREE.Color();
  /** One mote at (x, y, z) drifting (vx, vy, vz), slowed by `drag`, fading out over `life` s. */
  function glow(x, y, z, color, vx = 0, vy = 0, vz = 0, life = 0.8, drag = 1.5) {
    const m = motes[gNext];
    gNext = (gNext + 1) % GN;
    _gc.setHex(color);
    Object.assign(m, { life, max: life, x, y, z, vx, vy, vz, r: _gc.r, g: _gc.g, b: _gc.b, drag });
    gAny = true;
  }
  /** n motes flying out of (x, y, z) every which way at up to `speed` (plus `up`). */
  function glowBurst(x, y, z, n, colors, speed = 4, life = 0.8, up = 0) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, e = Math.random() * 2 - 1, c = Math.sqrt(1 - e * e), v = speed * (0.4 + Math.random() * 0.6);
      glow(x, y, z, colors[i % colors.length], Math.cos(a) * c * v, e * v * 0.6 + up, Math.sin(a) * c * v, life * (0.6 + Math.random() * 0.6));
    }
  }
  /** How many to emit this frame for `rate` per second (the fraction carried by chance). */
  const count = (rate, dt) => Math.floor(rate * dt + Math.random());
  function stepGlow(dt) {
    if (!gAny) { gPts.visible = false; return; }
    let live = false;
    for (let i = 0; i < GN; i++) {
      const m = motes[i], k = i * 3;
      if (m.life <= 0) { if (gCol[k] || gCol[k + 1] || gCol[k + 2]) gCol.fill(0, k, k + 3); continue; }
      m.life -= dt;
      const d = Math.max(0, 1 - m.drag * dt);
      m.vx *= d; m.vy *= d; m.vz *= d;
      m.x += m.vx * dt; m.y += m.vy * dt; m.z += m.vz * dt;
      const a = Math.max(0, m.life / m.max) * Math.min(1, 0.3 + (m.max - m.life) / 0.08);
      gPos[k] = m.x; gPos[k + 1] = m.y; gPos[k + 2] = m.z;
      gCol[k] = m.r * a; gCol[k + 1] = m.g * a; gCol[k + 2] = m.b * a;
      live = true;
    }
    gAny = live;
    gPts.visible = live;
    gGeo.attributes.position.needsUpdate = true;
    gGeo.attributes.color.needsUpdate = true;
  }
  // ── sigils: a small spinning ritual circle under him while he casts, and where he summons or blesses ──
  const sigGeo = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
  const sigMat = () => noOutline(new THREE.MeshBasicMaterial({ map: ritualTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  const bossSigil = new THREE.Mesh(sigGeo, sigMat());
  bossSigil.visible = false;
  bossSigil.renderOrder = 1.6;
  scene.add(bossSigil);
  const SIG = { k: 0 }, SIG_COL = [0xc080ff, 0xe060ff, 0xff3048];
  const sigils = [];
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(sigGeo, sigMat());
    m.visible = false;
    m.renderOrder = 1.6;
    scene.add(m);
    sigils.push({ m, t: 0, life: 0, r: 1 });
  }
  function sigilAt(x, z, r, life, color) {
    const s = sigils.find((k) => k.t >= k.life) || sigils[0];
    Object.assign(s, { t: 0, life, r });
    s.m.position.set(x, L.y + 0.07, z);
    s.m.material.color.setHex(color);
  }
  // ── scorch marks: dark blotches with glowing cracks where the big blows land, fading away ──
  const scGeo = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), scTex = scorchTexture(), scorches = [];
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(scGeo, noOutline(new THREE.MeshBasicMaterial({ map: scTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })));
    m.visible = false;
    m.renderOrder = 1.5;
    scene.add(m);
    scorches.push({ m, t: 0, life: 0 });
  }
  let scNext = 0;
  function scorch(x, z, r, life = 4) {
    const s = scorches[scNext];
    scNext = (scNext + 1) % scorches.length;
    const q = clampIn(x, z, L.wall - 0.5);
    Object.assign(s, { t: 0, life });
    s.m.position.set(q.x, L.y + 0.04, q.z);
    s.m.rotation.y = Math.random() * TAU;
    s.m.scale.set(r, 1, r);
  }
  // ── lightning in the void once he's angry: a far bolt, the sky lit up for an instant ──
  const skyBolts = [0, 1].map(() => {
    const m = new THREE.Mesh(boltGeo(), additive(0xe0c8ff, { side: THREE.DoubleSide }));
    m.visible = false;
    m.frustumCulled = false;
    m.scale.set(4, 4.5, 4);
    scene.add(m);
    return { m, t: 1 };
  });
  let skyNext = 0;
  function lightning() {
    const b = skyBolts[skyNext], a = Math.random() * TAU, d = 32 + Math.random() * 30;
    skyNext ^= 1;
    shapeBolt(b.m.geometry, 0, 22, 0, 0);
    b.m.position.set(L.x + Math.sin(a) * d, L.y - 36, L.z + Math.cos(a) * d);
    b.m.material.color.setHex(B.phase === 2 ? 0xffb8b0 : 0xe0c8ff);
    b.t = 0;
    L.fx.sky = 1;
    L.fx.flash = Math.max(L.fx.flash, 0.5);
    api.sfx("zap");
  }
  const vig = $("vignette"), VIG = { o: -1, c: "" };
  function vigFlash() {
    vig.classList.remove("flash");
    void vig.offsetWidth; // restart the animation
    vig.classList.add("flash");
  }

  // ── the prize (the Night Sword and the Night Crystal, floating where he fell) and the portal home ──
  const prize = new THREE.Group();
  makeNightSword(prize);
  bake(prize);
  prize.scale.setScalar(2.6);
  prize.visible = false;
  scene.add(prize);
  const gem = makeCrystal("mint");
  gem.visible = false;
  scene.add(gem);
  const reward = { on: false, t: 0, x: 0, z: 0 };
  const portal = new THREE.Group(), portalTex = portalTexture();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.24, 8, 28), toon(0x3a1a5a, { emissive: 0x3a0a6a }));
  const swirl = new THREE.Mesh(new THREE.CircleGeometry(1.6, 32), noOutline(new THREE.MeshBasicMaterial({ map: portalTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false })));
  portal.add(ring, swirl);
  const PT = { on: false, k: 0, x: L.x + Math.sin(L.portalA) * 12.3, z: L.z + Math.cos(L.portalA) * 12.3 };
  portal.position.set(PT.x, L.y + 1.95, PT.z);
  portal.rotation.y = L.portalA;
  portal.visible = false;
  scene.add(portal);

  // ── HUD: name, hp bar, cast bar, speech (shared with the Ice King: boss.js) ──
  let sayTimer = 0;
  function say(text, secs = 3) {
    const el = $("bossSay");
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(sayTimer);
    sayTimer = setTimeout(() => el.classList.remove("show"), secs * 1000);
  }
  function hud(on) {
    if (on) $("bossName").textContent = STR.names.pepbut;
    $("boss").hidden = !on;
    document.body.classList.toggle("bossOn", on);
    document.body.classList.toggle("bossMint", on);
    if (!on) { $("bossSay").classList.remove("show"); $("bossCast").hidden = true; }
  }
  let hpShown = -1;
  function hudHp() {
    const f = Math.max(0, B.hp / K.hp);
    if (f === hpShown) return;
    hpShown = f;
    $("bossHp").style.width = f * 100 + "%";
    $("bossLag").style.width = f * 100 + "%";
    $("bossPhase").textContent = STR.mint.phase[B.phase];
  }

  // ── state ──
  // st: off (not in the lair) | intro (Finn just arrived) | fight | gloat (Finn fainted) | down (just
  // lost) | rest (after losing: the portal is open)
  const B = {
    isBoss: true, active: true, dead: true, model, floor: L.y,
    st: "off", x: L.x, y: L.y, z: L.z, px: L.x, py: L.y, pz: L.z, h: K.hover, vx: 0, vz: 0, kx: 0, kz: 0, face: 0, pface: 0,
    goal: { x: L.x, z: L.z, h: K.hover }, hRate: 4, faceLock: null,
    hp: K.hp, dropAcc: 0, phase: 0, nextPhase: 0, armor: false, hidden: false, sunk: false, flash: 0, hurtT: 0, voice: 0, saidT: 0,
    pose: "idle", poseT: 0, demonT: 0, cast: null, script: null, heat: 0, counterCd: 0, boltT: 3,
    only: null, // debug: always this attack
  };
  const HZ = createHazards(scene, {
    player: api.player, y: L.y, center: L, reach: L.r, color: 0xff3a2a, clip: L.wall - 0.4, n: 40,
    live: () => B.st === "fight",
    hit(h, nx, nz) {
      api.hurt(1, nx, nz, "dark");
      api.burst(pl.x, pl.y + 1, pl.z, 10, DARK, 4, 5);
    },
  });
  const hazard = HZ.add, clampIn = HZ.clampIn, away = HZ.away;
  const timers = [];
  const later = (s, fn) => timers.push({ t: s, fn });
  const say2 = (key) => say(pick(STR.mint.shout[key]), 2.2);
  const setPose = (p) => { if (B.pose !== p) { B.pose = p; B.poseT = 0; } };
  function castBar(key, dur) {
    B.cast = { name: STR.mint.cast[key], t: 0, dur };
    $("bossCastName").textContent = B.cast.name;
    $("bossCast").hidden = false;
  }
  const inLair = (p = pl) => Math.hypot(p.x - L.x, p.z - L.z) < L.wall + 1 && p.y > L.y - 2 && p.y < L.y + 14;
  const hittable = () => B.st === "fight" && !B.armor && !B.hidden && !B.sunk && B.hp > 0;
  const toFinn = (x = B.x, z = B.z) => Math.atan2(pl.x - x, pl.z - z);
  function goTo(p, h = K.hover) {
    const q = clampIn(p.x, p.z, 11.5);
    B.goal.x = q.x;
    B.goal.z = q.z;
    B.goal.h = h;
    B.hRate = 4;
  }
  /** Where Finn will be in `s` seconds (inside the floor). */
  function lead(s, r = L.r) {
    const v = api.player.vel;
    return clampIn(pl.x + v.x * s, pl.z + v.z * s, r);
  }
  /** How long a band from (x, z) heading `a` runs before it meets the wall. */
  function bandLen(x, z, a) {
    const dx = x - L.x, dz = z - L.z, ux = Math.sin(a), uz = Math.cos(a), R = L.wall - 0.6;
    const b = dx * ux + dz * uz, c = dx * dx + dz * dz - R * R;
    return Math.max(2, -b + Math.sqrt(Math.max(0, b * b - c)));
  }
  const puff = (x, y, z, n = 18) => {
    api.burst(x, y, z, n, DARK, 5, 4, 0.3, 0.8);
    api.fx.ring(x, L.y, z, 3, 0xb070ff, 0.35);
  };

  // ── stakes, hands ──
  function dropStake(x, z, delay) {
    const s = stakes.find((k) => !k.on);
    if (!s) return;
    Object.assign(s, { on: true, t: -delay, life: STAKE_FALL + K.stakes.stuck, x, z, ry: Math.random() * TAU, tilt: (Math.random() - 0.5) * 0.25 });
  }
  const stakeSolid = (s) => s.on && s.t >= STAKE_FALL && s.t < s.life - 0.25;
  function hand(x, z, s, life, delay = 0) {
    for (let n = 0; n < HN; n++) {
      const h = hands[handNext];
      handNext = (handNext + 1) % HN;
      if (h.on) continue;
      const q = clampIn(x, z, L.wall - 0.7);
      Object.assign(h, { on: true, t: -delay, life, x: q.x, z: q.z, s, ry: Math.random() * TAU, rx: (Math.random() - 0.5) * 0.5, rz: (Math.random() - 0.5) * 0.5, k: 0 });
      return h;
    }
    return null;
  }
  /** Shadow hands over the circle / ring (radii a..b) round (x, z), from the middle out. */
  function handField(x, z, a, b, life, gap = 1.7, skip = null) {
    for (let r = Math.max(a, 0.6); r <= b; r += gap) {
      const n = Math.max(5, Math.round((TAU * r) / gap)), o = Math.random() * TAU;
      for (let i = 0; i < n; i++) {
        const t = o + (i / n) * TAU + (Math.random() - 0.5) * 0.2, rr = r + (Math.random() - 0.5) * 0.6;
        const hx = x + Math.sin(t) * rr, hz = z + Math.cos(t) * rr;
        if (Math.hypot(hx - L.x, hz - L.z) > L.wall - 0.7 || (skip && skip(hx, hz))) continue;
        hand(hx, hz, 0.7 + Math.random() * 0.5, life, (r - a) * 0.012);
      }
    }
  }
  function stepProps(dt) {
    for (const s of stakes) {
      if (!s.on) continue;
      s.t += dt;
      if (s.t >= s.life) { s.on = false; api.burst(s.x, L.y + 1, s.z, 6, [0x9a6438, 0x5a3418], 3, 3, 1, 0.5); }
    }
    for (const h of hands) {
      if (!h.on) continue;
      h.t += dt;
      if (h.t < 0) continue;
      const rise = 0.14;
      if (h.t < rise) { const u = h.t / rise; h.k = 1 + 2.2 * (u - 1) ** 3 + 1.2 * (u - 1) ** 2; }
      else h.k = h.t > h.life - 0.25 ? Math.max(0, (h.life - h.t) / 0.25) : 1;
      if (h.t >= h.life) h.on = false;
    }
  }
  function clearProps() {
    for (const s of stakes) if (s.on && s.t > 0) s.t = Math.max(s.t, s.life - 0.25); else s.on = false;
    for (const h of hands) if (h.on && h.t > 0) h.t = Math.max(h.t, h.life - 0.25); else h.on = false;
  }

  // ── imps ──
  function spawnImp(x, z) {
    const e = imps.find((k) => !k.on);
    if (!e || B.st !== "fight") return;
    Object.assign(e, { on: true, dead: false, st: "rise", t: 0, x, y: L.y - 0.4, z, face: toFinn(x, z), flash: 0, hz: null });
    e.px = e.x; e.py = e.y; e.pz = e.z;
    puff(x, L.y + 0.5, z, 14);
    glowBurst(x, L.y + 0.3, z, 14, [0xff3a5a, 0xffe14d], 3, 0.7, 2.5);
    api.sfx("imp");
  }
  const impsAlive = () => imps.filter((e) => e.on).length;
  function killImp(e, nx = 0, nz = 0) {
    if (!e.on) return false;
    e.on = false;
    e.dead = true;
    if (e.hz) { HZ.remove(e.hz); e.hz = null; }
    api.burst(e.x, e.y, e.z, 16, [0x2a1238, 0xb0142c, 0xffe14d], 5 + Math.hypot(nx, nz) * 2, 4, 1, 0.7);
    for (let i = 0; i < 7; i++) glow(e.x, e.y, e.z, 0xe6ddff, (Math.random() - 0.5) * 0.8, 1.2 + Math.random() * 1.2, (Math.random() - 0.5) * 0.8, 1.3, 0.4); // its little soul floats off
    api.sfx("impPop");
    return true;
  }
  function stepImps(dt) {
    for (const e of imps) {
      if (!e.on) continue;
      e.px = e.x; e.py = e.y; e.pz = e.z;
      e.t += dt;
      e.flash -= dt;
      const dx = pl.x - e.x, dz = pl.z - e.z, d = Math.hypot(dx, dz) || 1;
      if (e.st === "rise") {
        e.y = lerp(L.y - 0.4, L.y + 1.1, Math.min(1, e.t / 0.5));
        if (e.t > 0.5) { e.st = "fly"; e.t = 0; }
      } else if (e.st === "fly") {
        // straight at Finn, keeping out of each other's way
        let vx = (dx / d) * K.summon.speed[B.phase], vz = (dz / d) * K.summon.speed[B.phase];
        for (const o of imps) {
          if (o === e || !o.on) continue;
          const ox = e.x - o.x, oz = e.z - o.z, od = Math.hypot(ox, oz);
          if (od < 1.6 && od > 1e-3) { vx += (ox / od) * 3; vz += (oz / od) * 3; }
        }
        const q = clampIn(e.x + vx * dt, e.z + vz * dt, L.r);
        e.x = q.x;
        e.z = q.z;
        e.y = L.y + 1.1 + Math.sin(e.t * 5 + e.seed) * 0.15;
        e.face = turnToward(e.face, Math.atan2(dx, dz), 8 * dt);
        if ((d < 2.3 && api.player.dead <= 0) || e.t > K.summon.fuse) {
          // it swells up and pops
          e.st = "swell";
          e.t = 0;
          e.hz = hazard({ shape: CIRCLE, x: e.x, z: e.z, r: K.summon.r, warn: K.summon.pop, onFire: () => impBoom(e) });
          api.sfx("charge");
        }
      } else if (e.st === "swell") {
        e.flash = Math.sin(e.t * 30) > 0 ? 0.05 : 0;
        e.face = turnToward(e.face, Math.atan2(dx, dz), 8 * dt);
      }
    }
  }
  function impBoom(e) {
    e.hz = null;
    if (!e.on) return;
    e.on = false;
    e.dead = true;
    api.burst(e.x, e.y, e.z, 26, [0x2a1238, 0xb0142c, 0xffe14d, 0xff6a1a], 8, 6, 1, 0.8);
    api.fx.ring(e.x, L.y, e.z, K.summon.r + 1, 0xff6a1a, 0.35);
    scorch(e.x, e.z, K.summon.r * 0.8, 3.5);
    glowBurst(e.x, e.y, e.z, 22, [0xff6a1a, 0xffe14d, 0xb0142c], 6, 0.6);
    api.sfx("darkBoom");
    api.shake(0.25);
  }
  function clearImps() { for (const e of imps) if (e.on) killImp(e); }

  // ── what each attack does when it lands ──
  function stakeHit(h) {
    api.fx.ring(h.x, L.y, h.z, h.r + 0.8, 0xe8c8a0, 0.3);
    api.burst(h.x, L.y + 0.3, h.z, 12, [0x9a6438, 0x5a3418, 0x6a2bd6], 6, 5, 1, 0.6);
    scorch(h.x, h.z, 1.3, 3);
    glowBurst(h.x, L.y + 0.3, h.z, 10, [0xffc070, 0xb070ff], 5, 0.5, 1.5);
    api.sfx("stake");
    api.shake(0.12);
  }
  function handsHit(h) {
    const ux = Math.sin(h.a), uz = Math.cos(h.a), cx = uz, cz = -ux;
    for (let d = 0.8; d < h.r; d += 1.25) {
      for (const s of [-0.45, 0.45]) {
        const o = s + (Math.random() - 0.5) * 0.3;
        hand(h.x + ux * d + cx * o, h.z + uz * d + cz * o, 0.8 + Math.random() * 0.4, 1.1, d * 0.02);
      }
    }
    api.burst(h.x + ux * 3, L.y + 0.5, h.z + uz * 3, 8, DARK, 4, 4, 1, 0.6);
    for (let d = 2; d < h.r; d += 3) later(d * 0.02, () => glowBurst(h.x + ux * d, L.y + 0.8, h.z + uz * d, 6, [0xb070ff, 0x6a2bd6], 3, 0.7, 2));
    api.sfx("claw");
    api.shake(0.2);
  }
  function hissHit(h) {
    handField(h.x, h.z, h.r - 1.2, h.r - 0.4, 1.0, 1.4);
    api.fx.ring(h.x, L.y, h.z, h.r + 1.5, 0xb070ff, 0.5);
    api.fx.ring(h.x, L.y, h.z, h.r * 0.6, 0xff3a5a, 0.35);
    api.burst(h.x, L.y + 1, h.z, 30, DARK, 10, 6, 1, 0.8);
    scorch(h.x, h.z, h.r * 0.7, 4);
    glowRing(h.x, h.z, h.r, 40, [0xb070ff, 0xff3a5a]);
    api.sfx("darkBoom");
    api.shake(0.45);
    api.freeze(0.06);
  }
  /** Motes shot outward along the floor from a ring of radius r round (x, z). */
  function glowRing(x, z, r, n, colors) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, s = 3 + Math.random() * 3;
      glow(x + Math.sin(a) * r * 0.3, L.y + 0.4 + Math.random() * 0.6, z + Math.cos(a) * r * 0.3, colors[i % colors.length], Math.sin(a) * s * r * 0.25, 0.5 + Math.random(), Math.cos(a) * s * r * 0.25, 0.7, 2.2);
    }
  }
  function shadowHit(h) {
    // he bursts up out of his shadow
    B.x = B.px = B.goal.x = h.x;
    B.z = B.pz = B.goal.z = h.z;
    B.sunk = false;
    B.goal.h = K.hover;
    B.hRate = 18;
    handField(h.x, h.z, h.r + 0.2, h.r + 1.2, 0.9, 1.1);
    api.fx.ring(h.x, L.y, h.z, h.r + 2.5, 0xb070ff, 0.5);
    api.fx.star(h.x, L.y + 0.8, h.z, 2.2, 0xb070ff);
    api.burst(h.x, L.y + 0.4, h.z, 30, DARK, 10, 8, 1, 0.9);
    scorch(h.x, h.z, h.r, 5);
    glowBurst(h.x, L.y + 1, h.z, 40, [0xb070ff, 0xffffff, 0x6a2bd6], 7, 1, 3);
    api.sfx("darkBoom");
    api.shake(0.6);
    api.freeze(0.1);
  }
  function repelHit(h) {
    handField(h.x, h.z, h.r - 1, h.r - 0.3, 0.8, 1.2);
    api.fx.ring(h.x, L.y, h.z, h.r + 1.2, 0xff3a5a, 0.4);
    api.burst(h.x, L.y + 1, h.z, 20, DARK, 8, 5, 1, 0.7);
    scorch(h.x, h.z, h.r * 0.8, 3);
    glowRing(h.x, h.z, h.r, 30, [0xff3a5a, 0xb070ff]);
    api.sfx("darkBoom");
    api.shake(0.35);
  }
  function sealHit(h) {
    const safe = (x, z) => Math.hypot(x - h.x, z - h.z) < h.inner + 0.5;
    handField(L.x, L.z, 0.6, L.wall - 0.8, 1.1, 2.3, safe);
    L.fx.flash = 1;
    api.burst(L.x, L.y + 1, L.z, 40, DARK, 14, 6, 1, 0.9);
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * TAU, d = 3 + Math.random() * 10, x = L.x + Math.sin(a) * d, z = L.z + Math.cos(a) * d;
      if (safe(x, z)) continue;
      scorch(x, z, 1.6 + Math.random(), 4);
      glowBurst(x, L.y + 0.6, z, 10, [0xff3a5a, 0xb070ff], 4, 0.8, 2.5);
    }
    glowBurst(h.x, L.y + 1, h.z, 24, [0xffe8a0, 0xffffff], 4, 1, 2); // the blessed light holds
    api.sfx("darkBoom");
    api.sfx("boom");
    api.shake(0.55);
    api.freeze(0.08);
  }
  function sweepHit(h) {
    for (let i = 0; i <= 8; i++) {
      const a = h.a + (i / 8 - 0.5) * 2 * h.half, r = h.r * (0.45 + Math.random() * 0.5);
      api.burst(h.x + Math.sin(a) * r, L.y + 0.6, h.z + Math.cos(a) * r, 5, [0xff6a1a, 0xffd23f, 0x6f52ff], 4, 5, 0.6, 0.6);
    }
    for (let i = 0; i < 40; i++) {
      // a sheet of flame left along the sword's path
      const a = h.a + (Math.random() - 0.5) * 2 * h.half, r = 2 + Math.random() * (h.r - 2);
      glow(h.x + Math.sin(a) * r, L.y + 0.3 + Math.random() * 1.5, h.z + Math.cos(a) * r, i % 3 ? 0xff7a2a : 0xffd23f, 0, 2 + Math.random() * 2, 0, 0.5 + Math.random() * 0.4, 1);
    }
    api.fx.ring(h.x, L.y, h.z, h.r, 0xff8a3a, 0.4);
    api.sfx("slash");
    api.shake(0.35);
  }
  function slamHit(h) {
    const ux = Math.sin(h.a), uz = Math.cos(h.a);
    for (let d = 1; d < h.r; d += 1.5) later(d * 0.015, () => api.burst(h.x + ux * d, L.y + 0.4, h.z + uz * d, 6, [0xff6a1a, 0xffd23f, 0xffffff], 5, 6, 0.8, 0.6));
    for (let d = 1; d < h.r; d += 1.1) hand(h.x + ux * d + (Math.random() - 0.5) * 2, h.z + uz * d + (Math.random() - 0.5) * 2, 0.6, 0.8, d * 0.015);
    api.fx.star(h.x + ux * h.r * 0.5, L.y + 1, h.z + uz * h.r * 0.5, 2.4, 0xff8a3a);
    for (let d = 2; d < h.r; d += 4) scorch(h.x + ux * d, h.z + uz * d, 2.2, 4);
    for (let d = 1; d < h.r; d += 0.7) glow(h.x + ux * d + (Math.random() - 0.5) * 2, L.y + 0.4, h.z + uz * d + (Math.random() - 0.5) * 2, d % 2 < 1 ? 0xff7a2a : 0xffd23f, 0, 3 + Math.random() * 3, 0, 0.7, 1.2);
    api.sfx("boom");
    api.sfx("slash");
    api.shake(0.7);
    api.freeze(0.12);
  }

  // ── the fight, as scripts ──
  function* wait(s) {
    for (let t = 0; t < s; ) t += yield;
  }
  function* glide(max) {
    for (let t = 0; t < max && Math.hypot(B.goal.x - B.x, B.goal.z - B.z) > 0.6; ) t += yield;
  }
  /** He vanishes in a puff of shadow and turns up somewhere else. */
  function* blink(p, h = K.hover) {
    const q = clampIn(p.x, p.z, 11.5);
    puff(B.x, B.y + 1.2, B.z);
    for (let i = 0; i <= 18; i++) {
      const t = i / 18, y = lerp(B.y, L.y + h, t) + 1.2 + Math.sin(t * Math.PI) * 1.5;
      glow(lerp(B.x, q.x, t), y, lerp(B.z, q.z, t), i % 2 ? 0xb070ff : 0x6a2bd6, (Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5), 0.35 + t * 0.3, 2);
    }
    api.sfx("blink");
    B.hidden = true;
    yield* wait(0.32);
    B.x = B.px = B.goal.x = q.x;
    B.z = B.pz = B.goal.z = q.z;
    B.h = B.goal.h = h;
    B.y = B.py = L.y + h;
    B.face = B.pface = toFinn();
    B.vx = B.vz = 0;
    B.hidden = false;
    puff(B.x, B.y + 1.2, B.z);
    glowBurst(B.x, B.y + 1.2, B.z, 18, [0xb070ff, 0xffffff], 4, 0.5);
    yield* wait(0.18);
  }
  /** Stakes on Finn that don't hold the script up (the angry phases add them to everything). */
  function harass(n, gap, warn, delay = 0.2) {
    for (let i = 0; i < n; i++) later(delay + i * gap, () => { if (B.st === "fight") { const q = lead(0.3); stakeAt(q.x, q.z, warn); } });
  }
  function stakeAt(x, z, warn) {
    hazard({ shape: CIRCLE, x, z, r: K.stakes.r, warn, onFire: stakeHit });
    dropStake(x, z, warn - STAKE_FALL);
  }
  const ATTACKS = {
    *stakes() {
      const P = B.phase, a = toFinn(L.x, L.z) + Math.PI + (Math.random() - 0.5) * 1.4;
      yield* blink({ x: L.x + Math.sin(a) * 9, z: L.z + Math.cos(a) * 9 }, 1.8);
      const n = K.stakes.n[P], every = K.stakes.every[P], warn = K.stakes.warn[P];
      setPose("cast");
      say2("stakes");
      castBar("stakes", n * every + warn);
      for (let i = 0; i < n; i++) {
        const q = lead(0.3);
        stakeAt(q.x, q.z, warn);
        if (P === 2 && i % 2) { const r = Math.random() * 11, t = Math.random() * TAU; stakeAt(L.x + Math.sin(t) * r, L.z + Math.cos(t) * r, warn); }
        api.sfx("whoosh");
        yield* wait(every);
      }
      yield* wait(warn);
      setPose("idle");
      goTo(B, K.hover);
      yield* wait(0.5);
    },
    *hands() {
      const P = B.phase, t = toFinn(L.x, L.z) + Math.PI + (Math.random() - 0.5) * 2;
      yield* blink({ x: L.x + Math.sin(t) * 7, z: L.z + Math.cos(t) * 7 }, 0.9);
      const warn = K.hands.warn[P], waves = K.hands.waves[P], n = K.hands.n[P], sp = K.hands.spread[P];
      setPose("slam");
      say2("hands");
      castBar("hands", warn + (waves - 1) * 0.7);
      for (let w = 0; w < waves; w++) {
        const aim = toFinn();
        B.faceLock = aim;
        for (let i = 0; i < n; i++) {
          const a = aim + (i - (n - 1) / 2) * sp + (w % 2 ? sp / 2 : 0), x = B.x + Math.sin(a) * 0.9, z = B.z + Math.cos(a) * 0.9;
          hazard({ shape: BAND, x, z, a, r: bandLen(x, z, a), w: K.hands.w, warn: w ? warn * 0.85 : warn, onFire: handsHit });
        }
        api.sfx("summon");
        yield* wait(w + 1 < waves ? 0.7 : warn);
      }
      setPose("slamGo");
      yield* wait(0.5);
      B.faceLock = null;
      setPose("idle");
      yield* wait(0.5);
    },
    *hiss() {
      // (angry, he blinks up close again and hisses a second time)
      const P = B.phase, reps = K.hiss.reps[P];
      for (let rep = 0; rep < reps; rep++) {
        const a = Math.random() * TAU, warn = K.hiss.warn[P] * (rep ? 0.85 : 1);
        yield* blink({ x: pl.x + Math.sin(a) * 2.4, z: pl.z + Math.cos(a) * 2.4 }, 0.5);
        setPose("hiss");
        B.demonT = warn + 0.9;
        if (!rep) say2("hiss");
        api.sfx("hiss");
        castBar("hiss", warn);
        hazard({ shape: CIRCLE, x: B.x, z: B.z, r: K.hiss.r, warn, onFire: hissHit });
        if (P >= 1 && !rep) harass(2, 0.5, 1.0, 0.3);
        yield* wait(warn);
        setPose("hissGo");
        yield* wait(rep + 1 < reps ? 0.35 : 1.0); // spent after the last: open to a counter
      }
      setPose("idle");
    },
    *summon() {
      const P = B.phase, a = Math.random() * TAU;
      yield* blink({ x: L.x + Math.sin(a) * 2.5, z: L.z + Math.cos(a) * 2.5 }, 1.5);
      setPose("chant");
      say2("summon");
      castBar("summon", 1.9);
      api.sfx("summon");
      const n = Math.min(K.summon.n[P], K.summon.max - impsAlive()), o = Math.random() * TAU;
      for (let i = 0; i < n; i++) {
        const t = o + (i / n) * TAU, x = L.x + Math.sin(t) * 9.5, z = L.z + Math.cos(t) * 9.5;
        later(0.2 + i * 0.12, () => { sigilAt(x, z, 1.7, 1.3, 0xff3a5a); api.fx.ring(x, L.y, z, 2.2, 0xff3a5a, 0.5); api.burst(x, L.y + 0.2, z, 8, DARK, 3, 3, 1, 0.6); });
        later(0.9 + i * 0.25, () => spawnImp(x, z));
      }
      yield* wait(1.9);
      setPose("idle");
      goTo(B, K.hover);
      yield* wait(0.3);
    },
    *shadow() {
      const P = B.phase;
      for (let rep = 0; rep < K.shadow.reps[P]; rep++) {
        const follow = K.shadow.follow[P] * (rep ? 0.7 : 1), lock = K.shadow.lock[P];
        setPose("sink");
        if (!rep) say2("shadow");
        api.sfx("sink");
        B.goal.h = -2.6;
        B.hRate = 7;
        yield* wait(0.45);
        B.sunk = true;
        castBar("shadow", follow + lock);
        const h = hazard({ shape: CIRCLE, x: B.x, z: B.z, r: K.shadow.r, follow, chase: K.shadow.chase[P], warn: lock, onFire: shadowHit });
        for (; !h.fired; ) {
          yield;
          B.x = B.goal.x = h.x;
          B.z = B.goal.z = h.z;
        }
        setPose("dazed");
        say(pick(STR.mint.dazed), 2);
        yield* wait(K.shadow.daze[P] * (rep ? 0.5 : 1));
      }
      setPose("idle");
      yield* wait(0.4);
    },
    *seal() {
      const P = B.phase, reps = K.seal.reps[P];
      yield* blink({ x: L.x, z: L.z }, 2.4);
      setPose("chant");
      say2("seal");
      api.sfx("summon");
      let a = toFinn(L.x, L.z) + (Math.random() < 0.5 ? -1 : 1) * Math.PI * (0.45 + Math.random() * 0.35);
      for (let i = 0; i < reps; i++) {
        const warn = K.seal.warn[P] * (i ? 0.85 : 1), d = 8.5 + Math.random() * 2.5;
        if (i) a += (Math.random() < 0.5 ? -1 : 1) * (1.2 + Math.random() * 0.6);
        const sx = L.x + Math.sin(a) * d, sz = L.z + Math.cos(a) * d;
        castBar("seal", warn);
        hazard({ shape: RING, x: sx, z: sz, inner: K.seal.safe, r: Math.hypot(sx - L.x, sz - L.z) + L.wall, warn, onFire: sealHit });
        Object.assign(BL, { t: warn + 0.35, x: sx, z: sz });
        sigilAt(sx, sz, K.seal.safe, warn + 0.35, 0xffe8a0);
        L.fx.flash = 0.6;
        yield* wait(warn + 0.4);
      }
      setPose("idle");
      goTo(B, K.hover);
      yield* wait(0.6);
    },
    *armor() {
      const P = B.phase;
      setPose("chant");
      say2("armor");
      api.sfx("cackle");
      Object.assign(AR, { on: true, mode: "rest", t: 0 });
      goTo(B, 1.0);
      yield* wait(0.8);
      for (let i = 0; i < K.armor.swings; i++) {
        const warn = K.armor.warn * (i ? 0.85 : 1), a = toFinn();
        B.faceLock = a;
        Object.assign(AR, { mode: "sweep", t: 0, dur: warn, dir: i % 2 ? -1 : 1 });
        castBar("armor", warn);
        hazard({ shape: SECTOR, x: B.x, z: B.z, r: K.armor.r, half: K.armor.half, a, warn, onFire: sweepHit });
        yield* wait(warn + 0.25);
      }
      // the finishing blow, straight down on Finn
      const a = toFinn(), w = K.armor.slamWarn;
      B.faceLock = a;
      Object.assign(AR, { mode: "slam", t: 0, dur: w });
      castBar("slam", w);
      hazard({ shape: BAND, x: B.x, z: B.z, a, r: bandLen(B.x, B.z, a), w: K.armor.slamW, warn: w, onFire: slamHit });
      if (P === 2) harass(2, 0.4, 1.0, 0.2);
      yield* wait(w + 0.5);
      B.faceLock = null;
      AR.on = false;
      setPose("dazed"); // the armor takes it out of him
      say(pick(STR.mint.dazed), 2);
      goTo(B, K.hover);
      yield* wait(1.6);
      setPose("idle");
    },
  };
  function* rage() {
    B.phase = B.nextPhase;
    B.armor = true;
    yield* blink({ x: L.x, z: L.z }, K.hover + 1.4);
    L.fx.mood = B.phase;
    L.fx.flash = 1;
    setPose("rage");
    B.demonT = 99;
    say(B.phase === 1 ? STR.mint.phase2 : STR.mint.phase3, 3.4);
    api.sfx("cackle");
    api.shake(0.5);
    api.burst(B.x, B.y + 2, B.z, 34, DARK.concat(0xff3a5a), 9, 7, 0.6, 1);
    glowBurst(B.x, B.y + 1.5, B.z, 90, [0xb070ff, 0xffffff, B.phase === 2 ? 0xff3048 : 0xe060ff], 11, 1.3);
    glowRing(B.x, B.z, 10, 60, [0xb070ff, 0xff3a5a]);
    for (let i = 0; i < 3; i++) later(0.25 + i * 0.35, () => api.fx.ring(B.x, L.y, B.z, 6 + i * 4, i % 2 ? 0xff3a5a : 0xb070ff, 0.6));
    vigFlash();
    lightning();
    hpShown = -1;
    yield* wait(2.0);
    api.dropHeart(L.x, L.y + 3, L.z);
    B.armor = false;
    setPose("idle");
  }
  function* fight() {
    let bag = [], last = "";
    for (;;) {
      if (B.nextPhase > B.phase) yield* rage();
      if (!bag.length) {
        bag = [...ORDER[B.phase]].sort(() => Math.random() - 0.5);
        if (bag[0] === last) bag.push(bag.shift());
      }
      const next = B.only || bag.shift();
      if (next === "summon" && !B.only && impsAlive() >= 2) continue; // enough of them about already
      last = next;
      yield* ATTACKS[next]();
      B.cast = null;
      $("bossCast").hidden = true;
      yield* wait(0.2);
    }
  }
  function* intro() {
    setPose("idle");
    yield* wait(0.9);
    hud(true);
    say(STR.mint.intro, 4.2);
    api.sfx("cackle");
    yield* wait(2.8);
    B.st = "fight";
    api.onStart();
    yield* fight();
  }
  function* lost() {
    // the last blow: the dark magic goes out of him and he drops to the floor
    B.armor = true;
    B.cast = null;
    B.faceLock = null;
    B.hidden = B.sunk = false;
    B.demonT = 0;
    AR.on = false;
    $("bossCast").hidden = true;
    setPose("down");
    goTo(B, 0.1);
    B.hRate = 8;
    L.fx.mood = 0;
    L.fx.flash = 1;
    say(STR.mint.defeat, 4.5);
    api.sfx("bossHurt");
    api.freeze(0.15);
    api.shake(0.6);
    api.burst(B.x, B.y + 2, B.z, 36, DARK.concat(0xffffff), 9, 8, 1, 1);
    glowBurst(B.x, B.y + 1.5, B.z, 110, [0xffffff, 0xb070ff, 0xe8d8ff], 9, 1.6, 1);
    vigFlash();
    yield* wait(2.8);
    const first = api.onWin();
    if (first) {
      const q = clampIn(B.x + (L.x - B.x) * 0.3, B.z + (L.z - B.z) * 0.3, 10);
      Object.assign(reward, { on: true, t: 0, x: q.x, z: q.z });
      api.sfx("ready");
    }
    PT.on = true;
    api.sfx("portal");
    B.st = "rest";
    setPose("rest");
    yield* wait(1.2);
    say(first ? STR.mint.gift : STR.mint.again, 4.5);
    yield* wait(2.5);
    if (B.st === "rest") hud(false);
  }

  // ── starting, stopping ──
  /** Finn and Jake just arrived (main.js warps them in): he waits in the middle, then it starts. */
  function enter() {
    reset();
    B.st = "intro";
    B.hp = K.hp;
    B.dropAcc = 0;
    B.phase = B.nextPhase = 0;
    hpShown = -1;
    B.script = intro();
    B.script.next();
  }
  function reset() {
    B.script = null;
    B.cast = null;
    B.faceLock = null;
    B.armor = B.hidden = B.sunk = false;
    B.demonT = 0;
    HZ.cancel();
    timers.length = 0;
    clearProps();
    clearImps();
    AR.on = false;
    BL.t = 0;
    reward.on = false;
    PT.on = false;
    L.fx.mood = 0;
    for (const m of motes) m.life = 0;
    for (const s of sigils) s.t = s.life;
    for (const s of scorches) s.t = s.life;
    SIG.k = 0;
    B.heat = B.counterCd = 0;
    B.boltT = 3;
    B.x = B.px = B.goal.x = L.x;
    B.z = B.pz = B.goal.z = L.z;
    B.h = B.goal.h = K.hover;
    B.y = B.py = L.y + B.h;
    B.vx = B.vz = B.kx = B.kz = 0;
    B.face = B.pface = L.spawnA;
    setPose("idle");
  }
  function off() {
    reset();
    B.st = "off";
    B.dead = true;
    hud(false);
  }

  // ── physics step ──
  function step(dt) {
    if (B.st === "off") return;
    B.px = B.x; B.py = B.y; B.pz = B.z; B.pface = B.face;
    B.poseT += dt;
    B.flash -= dt;
    B.hurtT -= dt;
    B.saidT += dt;
    B.demonT -= dt;
    B.counterCd -= dt;
    B.heat = Math.max(0, B.heat - dt * (K.counter.dmg / K.counter.window));
    if (B.cast) B.cast.t += dt;
    // once he's angry, lightning cracks in the void now and then
    if (B.st === "fight" && B.phase > 0 && (B.boltT -= dt) <= 0) {
      B.boltT = 2.5 + Math.random() * 4 - B.phase * 0.6;
      lightning();
    }
    for (let i = timers.length - 1; i >= 0; i--) {
      const k = timers[i];
      if ((k.t -= dt) > 0) continue;
      timers.splice(i, 1);
      k.fn();
    }
    if (B.script && B.script.next(dt).done) B.script = null;
    // glide toward the goal, easing in; the height follows on its own
    const dx = B.goal.x - B.x, dz = B.goal.z - B.z, d = Math.hypot(dx, dz);
    const v = Math.min(K.glide[B.phase], d * 3.2), f = Math.min(1, 5 * dt);
    B.vx += ((d > 1e-3 ? (dx / d) * v : 0) - B.vx) * f;
    B.vz += ((d > 1e-3 ? (dz / d) * v : 0) - B.vz) * f;
    B.kx *= Math.max(0, 1 - 6 * dt);
    B.kz *= Math.max(0, 1 - 6 * dt);
    const q = clampIn(B.x + (B.vx + B.kx) * dt, B.z + (B.vz + B.kz) * dt, 12);
    B.x = q.x;
    B.z = q.z;
    B.h += (B.goal.h - B.h) * Math.min(1, B.hRate * dt);
    B.y = L.y + B.h;
    const want = B.faceLock ?? (B.st === "rest" || B.st === "down" ? B.face : toFinn());
    B.face = turnToward(B.face, want, (B.faceLock !== null ? 14 : 5) * dt);
    B.dead = !hittable();
    HZ.step(dt);
    stepProps(dt);
    stepImps(dt);
    AR.t += dt;
    BL.t -= dt;
    AR.k += ((AR.on ? 1 : 0) - AR.k) * Math.min(1, 4 * dt);
    // Finn can't walk through him, nor through the stakes stuck in the floor
    const px = pl.x - B.x, pz = pl.z - B.z, pd = Math.hypot(px, pz), R = K.body + 0.42;
    if (!B.hidden && !B.sunk && pd < R && pl.y < B.y + 2.4 && pl.y + 1.6 > B.y) {
      const [ux, uz] = away(B.x, B.z);
      pl.x = B.x + ux * R;
      pl.z = B.z + uz * R;
    }
    for (const s of stakes) {
      if (!stakeSolid(s) || pl.y > L.y + 3.2) continue;
      const sr = 0.28 + 0.42;
      if (Math.hypot(pl.x - s.x, pl.z - s.z) < sr) { const [ux, uz] = away(s.x, s.z); pl.x = s.x + ux * sr; pl.z = s.z + uz * sr; }
    }
    // a fight can't go on without Finn in the lair (a debug teleport)
    if ((B.st === "fight" || B.st === "intro") && !inLair() && api.player.dead <= 0) off();
    // the Night Sword, the portal home
    if (reward.on) {
      reward.t += dt;
      if (reward.t > 0.8 && Math.hypot(pl.x - reward.x, pl.z - reward.z) < 1.6 && pl.y < L.y + 3.5 && api.player.dead <= 0) {
        reward.on = false;
        api.burst(reward.x, L.y + 1.6, reward.z, 34, [0x6b2fd6, 0xffffff, 0x7fe0ff], 6, 6, 0.5, 1);
        api.onReward();
      }
    }
    PT.k += ((PT.on ? 1 : 0) - PT.k) * Math.min(1, 2 * dt);
    if (PT.on && PT.k > 0.8 && Math.hypot(pl.x - PT.x, pl.z - PT.z) < 1.5 && pl.y < L.y + 3 && api.player.dead <= 0) {
      PT.on = false;
      api.sfx("warp");
      api.leave();
    }
  }

  // ── what the sword, Jake and main.js ask of him ──
  function hurt(n, nx, nz) {
    if (!hittable()) return false;
    B.hp = Math.max(0, B.hp - n);
    B.flash = 0.1;
    B.hurtT = 0.25;
    B.kx += nx * (n > 1 ? 3 : 1.4);
    B.kz += nz * (n > 1 ? 3 : 1.4);
    api.sfx(n > 1 ? "hitBig" : "hit");
    if (++B.voice % 3 === 0 || n > 1) api.sfx("bossHurt");
    if (B.saidT > 5 && Math.random() < 0.3) { B.saidT = 0; say(pick(STR.mint.hurt), 1.6); }
    api.burst(B.x, B.y + 1.4, B.z, 5 + 3 * n, [0xffffff, 0xe8303a, 0x1f1f2a], 4, 4);
    glowBurst(B.x, B.y + 1.4, B.z, 4 + 2 * n, [0xffffff, 0xb070ff], 3, 0.4);
    // too many blows at once (from 60% on, not while he's catching his breath): the Dark Burst
    B.heat += n;
    if (B.heat >= K.counter.dmg && B.phase > 0 && B.counterCd <= 0 && B.pose !== "dazed" && B.hp > n) {
      B.heat = 0;
      B.counterCd = K.counter.cd;
      say(pick(STR.mint.shout.repel), 1.6);
      api.sfx("hiss");
      hazard({ shape: CIRCLE, x: B.x, z: B.z, r: K.counter.r, warn: K.counter.warn, onFire: repelHit });
      glowBurst(B.x, B.y + 1.2, B.z, 30, [0xff3a5a, 0xb070ff], 2.5, 0.7);
    }
    // Finn doesn't heal on his own in the fight: every so many blows a heart falls out of him
    B.dropAcc += n;
    if (B.dropAcc >= K.heartEvery && B.hp > 0) {
      B.dropAcc -= K.heartEvery;
      const q = clampIn(B.x + (L.x - B.x) * 0.35, B.z + (L.z - B.z) * 0.35, 11);
      api.dropHeart(q.x, B.y + 1.8, q.z);
      api.sfx("ready");
      if (B.saidT > 2) { B.saidT = 0; say(pick(STR.mint.dropped), 1.8); }
    }
    const f = B.hp / K.hp;
    if (B.nextPhase < 1 && f <= K.phase2) B.nextPhase = 1;
    if (B.nextPhase < 2 && f <= K.phase3) B.nextPhase = 2;
    if (B.hp <= 0) {
      HZ.cancel();
      timers.length = 0;
      clearProps();
      clearImps();
      B.st = "down";
      B.dead = true;
      B.script = lost();
      B.script.next();
      return true;
    }
    return false;
  }
  B.hurt = hurt;
  /** The sword swing sw (main.js SWING) from Finn: true if it hit him or an imp. */
  function swordHit(sw, heading) {
    let n = 0;
    for (const e of imps) {
      if (!e.on) continue;
      const dx = e.x - pl.x, dz = e.z - pl.z, d = Math.hypot(dx, dz);
      if (d > sw.range + 0.6 || Math.abs(e.y - pl.y - 1) > 2) continue;
      if (Math.abs(wrap(Math.atan2(dx, dz) - heading)) > sw.arc && d > 1.3) continue;
      api.fx.star(e.x - (dx / (d || 1)) * 0.4, e.y, e.z - (dz / (d || 1)) * 0.4, 0.95, sw.spark);
      killImp(e, dx / (d || 1), dz / (d || 1));
      n++;
    }
    if (hittable()) {
      const dx = B.x - pl.x, dz = B.z - pl.z, d = Math.hypot(dx, dz);
      if (d <= sw.range + K.body && pl.y + 2.3 >= B.y && pl.y <= B.y + 2.9 && (Math.abs(wrap(Math.atan2(dx, dz) - heading)) <= sw.arc || d <= 1.6)) {
        const nx = dx / (d || 1), nz = dz / (d || 1);
        api.fx.star(B.x - nx * 0.7, clamp(pl.y + 1.1, B.y + 0.4, B.y + 2.2), B.z - nz * 0.7, sw.heavy ? 1.35 : 0.95, sw.spark);
        hurt(sw.dmg, nx, nz);
        n++;
      }
    }
    return n > 0;
  }

  // ── every rendered frame ──
  let blink2 = 2;
  // arm poses: [shoulder x, y, z, elbow] (s: -1 left, +1 right)
  const ARMS = {
    idle: (s, t) => [-0.55 + 0.05 * Math.sin(t * 2), 0, s * 0.3, -1.5], // hands folded in front, as a butler does
    fly: (s) => [0.6, 0, s * 0.5, -0.3],
    cast: (s, t) => (s > 0 ? [-2.9, 0, 0.25, -0.2 + 0.15 * Math.sin(t * 12)] : [-1.2, 0, -0.7, -0.6]),
    slam: (s, t) => [-2.7 + 0.1 * Math.sin(t * 20), 0, s * 0.4, -0.4],
    slamGo: (s) => [-0.9, 0, s * 0.35, -0.1],
    hiss: (s, t) => [-1.4, 0, s * 1.2, -1.3 + 0.1 * Math.sin(t * 30)],
    hissGo: (s) => [-0.6, 0, s * 1.4, -0.5],
    chant: (s, t) => [-2.85, 0, s * (0.45 + 0.1 * Math.sin(t * 9 + s)), -0.35],
    sink: (s) => [-2.9, 0, s * 0.2, 0],
    dazed: (s, t) => [-0.3, 0, s * (1.0 + 0.1 * Math.sin(t * 3)), -0.3],
    rage: (s, t) => [-2.4, 0, s * 0.9, -1.0 + 0.45 * Math.sin(t * 22 + s)],
    down: (s) => [-0.2, 0, s * 1.2, -0.2],
    rest: (s) => [-0.55, 0, s * 0.3, -1.5],
  };
  const LEAN = { fly: 0.3, slam: -0.2, slamGo: 0.35, hiss: 0.35, hissGo: 0.15, sink: 0.1, dazed: -0.25, down: -0.5, rage: -0.15, chant: -0.12 };
  const CHARGE = { cast: 1, slam: 1, hiss: 0.6, chant: 1, sink: 0.6, rage: 0.8 };
  const OPEN = { cast: 1, slam: 1, hiss: 1, chant: 1, rage: 1, fly: 0.6, sink: 0.4, slamGo: 0.7, hissGo: 0.7 };
  function pose(dt, t) {
    const k = 1 - Math.exp(-14 * dt), p = B.pose, fn = ARMS[p] || ARMS.idle;
    const hk = Math.max(0, B.hurtT / 0.25);
    U.arms.forEach((A, i) => {
      const s = i ? 1 : -1, [x, y, z, e] = fn(s, t);
      A.sh.rotation.set(lerp(A.sh.rotation.x, x - 0.5 * hk, k), lerp(A.sh.rotation.y, y, k), lerp(A.sh.rotation.z, z + s * 0.8 * hk, k));
      A.el.rotation.x = lerp(A.el.rotation.x, e, k);
    });
    model.rotation.x = lerp(model.rotation.x, LEAN[p] ?? (Math.hypot(B.vx, B.vz) > 3 ? 0.22 : 0), 1 - Math.exp(-8 * dt));
    const dizzy = p === "dazed" || p === "down";
    U.head.rotation.set(
      (p === "hiss" ? 0.25 : p === "rest" ? 0.2 : 0.04 * Math.sin(t * 0.8)) - 0.45 * hk,
      dizzy ? 0.25 * Math.sin(t * 3.5) : 0.1 * Math.sin(t * 0.5),
      (dizzy ? 0.22 * Math.cos(t * 3.5) : 0) + (p === "rage" || p === "hiss" ? 0.08 * Math.sin(t * 40) : 0),
    );
    // the cape opens into bat wings when he works magic, and beats
    const open = OPEN[p] || 0, beat = open * 0.18 * Math.sin(t * (p === "rage" ? 16 : 8));
    U.wings.forEach((w, i) => {
      const s = i ? 1 : -1;
      w.rotation.z = lerp(w.rotation.z, s * (lerp(-1.25, 0.2, open) + beat), 1 - Math.exp(-10 * dt));
      w.rotation.y = s * 0.3 * open;
    });
    U.body.scale.y = 1 + 0.015 * Math.sin(t * 2.1) + (p === "hiss" ? -0.06 : dizzy ? -0.1 : 0);
    // the demon face: from the second phase on, and while he hisses
    const demon = B.demonT > 0 || B.phase > 0;
    for (const m of U.demon) m.visible = demon;
    for (const m of U.grin) m.visible = demon && p !== "rest";
    U.eyes.visible = !demon;
    U.smile.visible = !demon;
    blink2 -= dt;
    if (blink2 < -0.12) blink2 = 2 + Math.random() * 3;
    U.eyes.scale.y = dizzy ? 0.35 : blink2 < 0 ? 0.12 : 1;
    for (const m of U.demon) m.scale.setScalar(p === "rage" ? 1.2 + 0.1 * Math.sin(t * 20) : 1);
    const ch = (CHARGE[p] || 0) * Math.min(1, B.poseT / 0.4);
    for (const g of glows) g.scale.setScalar(0.001 + ch * (0.07 + 0.02 * Math.sin(t * 25)));
    for (let i = 0; i < mats.length; i++) {
      if (B.flash > 0) mats[i].emissive.setRGB(1, 1, 1);
      else mats[i].emissive.copy(baseEm[i]).addScalar(B.phase * 0.02);
    }
  }
  const _v = new THREE.Vector3(), _w = new THREE.Vector3();
  const AURA = [0xa070ff, 0xd060ff, 0xff3048];
  /** Everything that only glows and drifts: his aura, sparks in his hands, the armor's fire, the blessed
   * light, the imps' embers, the sigils, the scorch marks, the lightning, the vignette. */
  function effects(dt, t, camera, near, show) {
    const busy = B.st === "fight" || B.st === "intro" || B.st === "down";
    if (show && B.st !== "rest") {
      const mp = model.position, col = AURA[B.phase];
      for (let k = count(16 + 12 * B.phase, dt); k > 0; k--) {
        const a = Math.random() * TAU, r = 0.5 + Math.random() * 0.7;
        glow(mp.x + Math.sin(a) * r, mp.y + Math.random() * 2.2, mp.z + Math.cos(a) * r, col, 0, 1 + Math.random() * 1.2, 0, 0.9, 0.5);
      }
      if (CHARGE[B.pose]) for (const g of glows) {
        g.getWorldPosition(_w);
        for (let k = count(22, dt); k > 0; k--) glow(_w.x, _w.y, _w.z, Math.random() < 0.5 ? 0xffffff : 0xb070ff, (Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3, 0.35, 3);
      }
    }
    // while sunk, shadowy wisps curl up round the pool's edge
    if (near && B.sunk) for (let k = count(40, dt); k > 0; k--) {
      const a = Math.random() * TAU;
      glow(B.x + Math.sin(a) * 1.3, L.y + 0.2, B.z + Math.cos(a) * 1.3, 0x6a2bd6, 0, 1.5 + Math.random() * 1.5, 0, 0.6, 0.5);
    }
    // the armor: ghostly motes off its body, and fire streaming off the blade while it swings
    if (armor.root.visible) {
      const ar = armor.root.position;
      for (let k = count(14, dt); k > 0; k--) glow(ar.x + (Math.random() - 0.5) * 3, ar.y + 2 + Math.random() * 5, ar.z + (Math.random() - 0.5) * 3, 0x8a6bff, 0, 1 + Math.random(), 0, 1, 0.6);
      const u = AR.t / AR.dur, swinging = (AR.mode === "sweep" && u > 0.7 && u < 1.25) || (AR.mode === "slam" && u > 0.75 && u < 1.25);
      armor.root.updateMatrixWorld(true);
      for (const j of swinging ? [1.5, 2.1, 2.7, 3.3, 3.9] : [2.2, 3.6]) {
        armor.arm.localToWorld(_w.set(0, -j, 0));
        if (swinging || Math.random() < dt * 20) glow(_w.x, _w.y, _w.z, j > 3 ? 0xffd23f : 0xff6a1a, (Math.random() - 0.5) * 2, 0.5 + Math.random() * 1.5, (Math.random() - 0.5) * 2, swinging ? 0.45 : 0.35, 2);
      }
    }
    // gold sparkles rising in the column of blessed light
    if (blessed.visible) for (let k = count(45, dt); k > 0; k--) {
      const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * K.seal.safe;
      glow(BL.x + Math.sin(a) * r, L.y + 0.2, BL.z + Math.cos(a) * r, Math.random() < 0.6 ? 0xffe8a0 : 0xffffff, 0, 2.5 + Math.random() * 2.5, 0, 1.1, 0.3);
    }
    // embers trailing off the imps (hot and fast when they swell)
    for (const e of imps) {
      if (!e.on) continue;
      const sw = e.st === "swell";
      for (let k = count(sw ? 40 : 9, dt); k > 0; k--) glow(e.model.position.x + (Math.random() - 0.5) * 0.6, e.model.position.y + (Math.random() - 0.5) * 0.6, e.model.position.z + (Math.random() - 0.5) * 0.6, sw ? 0xffa040 : 0xb0142c, (Math.random() - 0.5) * (sw ? 4 : 1), 0.6 + Math.random(), (Math.random() - 0.5) * (sw ? 4 : 1), 0.5, 1.5);
    }
    // a little ritual circle spins under him while he works magic; the ones where he summons or blesses
    SIG.k += ((near && show && CHARGE[B.pose] && B.st === "fight" ? 1 : 0) - SIG.k) * (1 - Math.exp(-8 * dt));
    bossSigil.visible = SIG.k > 0.02;
    if (bossSigil.visible) {
      bossSigil.position.set(model.position.x, L.y + 0.07, model.position.z);
      bossSigil.scale.setScalar((1.9 + 0.15 * Math.sin(t * 6)) * SIG.k * (B.h > 1.3 ? 1.35 : 1));
      bossSigil.rotation.y = t * 1.6;
      bossSigil.material.color.setHex(SIG_COL[B.phase]).multiplyScalar(SIG.k * (0.8 + 0.2 * Math.sin(t * 12)));
    }
    for (const s of sigils) {
      s.t += dt;
      s.m.visible = near && s.t < s.life;
      if (!s.m.visible) continue;
      const pop = Math.min(1, s.t / 0.25), fade = Math.min(1, (s.life - s.t) / 0.3);
      s.m.scale.setScalar(s.r * (0.3 + 0.7 * pop) * (1 + 0.05 * Math.sin(t * 8)));
      s.m.rotation.y = -t * 2;
      s.m.material.opacity = pop * fade;
    }
    for (const s of scorches) {
      s.t += dt;
      s.m.visible = near && s.t < s.life;
      if (s.m.visible) s.m.material.opacity = Math.min(1, s.t / 0.08) * Math.min(1, (s.life - s.t) / 1.5);
    }
    for (const b of skyBolts) {
      b.t += dt;
      b.m.visible = near && b.t < 0.3;
      if (b.m.visible) b.m.material.opacity = (b.t < 0.06 ? 1 : 0.3 + 0.7 * Math.random()) * (1 - b.t / 0.3);
    }
    stepGlow(dt);
    // the vignette: only with the camera up in the lair; red and pulsing when he's furious
    const cam = camera.position, inside = near && cam.y > L.y - 30 && Math.hypot(cam.x - L.x, cam.z - L.z) < 40;
    const o = inside ? (busy ? 0.9 : 0.5) : 0, c = inside && busy ? "p" + B.phase : "";
    if (o !== VIG.o) { VIG.o = o; vig.style.opacity = o; }
    if (c !== VIG.c) { VIG.c = c; vig.classList.remove("p0", "p1", "p2"); if (c) vig.classList.add(c); }
  }
  function update(dt, alpha, t, camera) {
    const near = B.st !== "off" && camera.position.distanceTo(_v.set(L.x, L.y, L.z)) < 150;
    const show = near && !B.hidden && !(B.sunk && B.h < -2);
    model.visible = shadow.visible = show;
    if (show) {
      const bob = B.h > 0.2 && B.pose !== "down" ? Math.sin(t * 2.3) * 0.12 : 0;
      model.position.set(lerp(B.px, B.x, alpha), lerp(B.py, B.y, alpha) + bob, lerp(B.pz, B.z, alpha));
      model.rotation.y = B.pface + wrap(B.face - B.pface) * alpha;
      pose(dt, t);
      shadow.position.set(model.position.x, L.y + 0.07, model.position.z);
      shadow.scale.setScalar(0.9 * clamp(1 - B.h / 10, 0.4, 1));
    }
    bubble.visible = near && B.armor && B.st === "fight" && !B.hidden;
    if (bubble.visible) {
      bubble.position.set(model.position.x, model.position.y + 1.2, model.position.z);
      bubble.scale.setScalar(1.9 + 0.08 * Math.sin(t * 6));
    }
    pool.visible = near && B.sunk;
    if (pool.visible) {
      pool.position.set(B.x, L.y + 0.1, B.z);
      pool.scale.setScalar(1.3 + 0.1 * Math.sin(t * 7));
    }
    HZ.draw(t);
    // stakes fall from the dark and stick in the floor; shadow hands rise and sink
    let any = false;
    for (let i = 0; i < SK; i++) {
      const s = stakes[i];
      if (!s.on || s.t < 0) {
        if (s.shown) { stakeMesh.setMatrixAt(i, _m4.makeScale(0, 0, 0)); s.shown = false; }
        continue;
      }
      any = s.shown = true;
      const u = Math.min(1, s.t / STAKE_FALL), sink = s.t > s.life - 0.25 ? (s.t - (s.life - 0.25)) / 0.25 : 0;
      _e.set(s.tilt, s.ry, s.tilt * 0.5);
      _q.setFromEuler(_e);
      _p.set(s.x, L.y - 0.7 + (1 - u * u) * 13 - sink * 3.5, s.z);
      stakeMesh.setMatrixAt(i, _m4.compose(_p, _q, _s.set(1, 1, 1)));
    }
    stakeMesh.visible = any;
    if (any) stakeMesh.instanceMatrix.needsUpdate = true;
    any = false;
    for (let i = 0; i < HN; i++) {
      const h = hands[i];
      if (!h.on || h.t < 0) {
        if (h.shown) { handMesh.setMatrixAt(i, _m4.makeScale(0, 0, 0)); h.shown = false; }
        continue;
      }
      any = h.shown = true;
      _e.set(h.rx, h.ry, h.rz);
      _q.setFromEuler(_e);
      _p.set(h.x, L.y - 0.3, h.z);
      handMesh.setMatrixAt(i, _m4.compose(_p, _q, _s.set(h.s, Math.max(0.001, h.s * h.k), h.s)));
    }
    handMesh.visible = any;
    if (any) handMesh.instanceMatrix.needsUpdate = true;
    // imps
    for (const e of imps) {
      e.model.visible = e.shadow.visible = e.on;
      if (!e.on) continue;
      const m = e.model, u = m.userData;
      m.position.set(lerp(e.px, e.x, alpha), lerp(e.py, e.y, alpha), lerp(e.pz, e.z, alpha));
      m.rotation.y = e.face;
      const sw = e.st === "swell" ? 1 + 0.5 * Math.min(1, e.t / K.summon.pop) : e.st === "rise" ? Math.min(1, e.t / 0.4) : 1;
      m.scale.setScalar(sw);
      u.wings.forEach((w, i) => (w.rotation.y = (i ? -1 : 1) * (0.2 + 0.7 * Math.abs(Math.sin(t * 16 + e.seed)))));
      u.body.rotation.z = e.st === "swell" ? 0.15 * Math.sin(t * 40) : 0.1 * Math.sin(t * 3 + e.seed);
      u.eyes.scale.setScalar(e.flash > 0 ? 1.4 : 1);
      e.shadow.position.set(m.position.x, L.y + 0.06, m.position.z);
    }
    // the astral armor looms up behind him and swings its flaming sword
    armor.root.visible = near && AR.k > 0.02;
    if (armor.root.visible) {
      const f = model.rotation.y, ox = -Math.sin(f) * 2.3, oz = -Math.cos(f) * 2.3;
      armor.root.position.set(B.x + ox, L.y + 0.2 + Math.sin(t * 1.5) * 0.2, B.z + oz);
      armor.root.rotation.y = f;
      armor.root.scale.setScalar(3.1 * (0.6 + 0.4 * AR.k));
      const u = clamp(AR.t / AR.dur, 0, 1), a = armor.arm;
      let rx = -0.4, ry = 0;
      if (AR.mode === "sweep") {
        // wound back, then across in the last quarter, as the fan lands
        const w = Math.min(1, u / 0.75), s = clamp((u - 0.75) / 0.25, 0, 1);
        rx = -1.5;
        ry = AR.dir * lerp(lerp(0, 1.5, w), -1.4, s);
      } else if (AR.mode === "slam") {
        rx = u < 0.8 ? lerp(-0.4, -3.0, Math.min(1, u / 0.5)) : lerp(-3.0, -0.6, Math.min(1, (u - 0.8) / 0.2));
      }
      a.rotation.x = lerp(a.rotation.x, rx, 1 - Math.exp(-20 * dt));
      a.rotation.y = lerp(a.rotation.y, ry, 1 - Math.exp(-20 * dt));
    }
    // blessed light over the safe circle
    blessed.visible = near && BL.t > 0;
    if (blessed.visible) {
      blessed.position.set(BL.x, L.y, BL.z);
      blessed.scale.set(K.seal.safe, 7 + Math.sin(t * 5) * 0.3, K.seal.safe);
      blessed.material.opacity = 0.22 + 0.1 * Math.sin(t * 9);
    }
    // the Night Sword spins in the air where he fell; the portal swirls open
    prize.visible = gem.visible = reward.on;
    if (reward.on) {
      prize.position.set(reward.x, L.y + 1.4 + Math.sin(t * 2.5) * 0.2, reward.z);
      orbitCrystal(gem, reward.x, L.y + 1.6, reward.z, t, 1.6);
      prize.rotation.set(0, t * 2, 0.35);
      if (Math.random() < dt * 8) api.burst(reward.x, L.y + 1.6, reward.z, 2, [0xb070ff, 0x7fe0ff], 2, 2, 0.1, 0.8);
    }
    portal.visible = near && PT.k > 0.02;
    if (portal.visible) {
      portal.scale.setScalar(PT.k);
      swirl.rotation.z = -t * 2.5;
      if (PT.on && Math.random() < dt * 10) api.burst(PT.x, L.y + 1.9, PT.z, 2, [0xb070ff, 0xffffff], 2, 2, 0.1, 0.7);
    }
    effects(dt, t, camera, near, show);
    if (B.cast) $("bossCastFill").style.width = clamp(B.cast.t / B.cast.dur, 0, 1) * 100 + "%";
    if (B.st === "fight" || B.st === "down" || B.st === "intro") hudHp();
  }

  return {
    B, K, hazards: HZ.list, imps,
    /** The Butler as a target for the sword's aim, Jake's punches and the giant fist (null: not now). */
    foe: () => (hittable() ? B : null),
    /** His imps, for Jake to punch (and the sword's aim). */
    minions: () => imps.filter((e) => e.on && e.st !== "rise"),
    fighting: () => B.st === "fight" || B.st === "down" || B.st === "intro",
    /** Is (a point) in the Dark Lair? (The camera stays inside its rim there.) */
    holds: (p) => inLair(p),
    swordHit,
    step,
    update,
    enter,
    off,
    /** Finn fainted: he gloats; main.js takes Finn back to the castle and calls off(). */
    finnDown: () => {
      if (!(B.st === "fight" || B.st === "intro")) return;
      say(STR.mint.finnDown, 3);
      B.script = null;
      HZ.cancel();
      timers.length = 0;
      clearImps();
      AR.on = false;
      B.st = "gloat";
      B.dead = true;
      setPose("rage");
    },
    say,
  };
}
