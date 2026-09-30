// Finn, Jake and the slimes: models (built with shapes.js) and their per-frame
// animation. Every model faces +z. NPCs live in npcs.js.
import * as THREE from "three";
import { noOutline, toon } from "./toon.js";
import { OUT, G, BLACK, WHITE, GOLD, rbox, add, cap, lathe, blob, tube, group, bake, decal, ellipse, arc, ring, poly } from "./shapes.js";

// ── Finn ─────────────────────────────────────────────────────────────────────
// Rig: root (position, heading) > rig (pivot at the feet: lean, bank, squash) >
// spin (pivot at the belly: flips) > body (pelvis: height, hip twist) > legs
// (hip > knee > foot) and torso (waist) > arms (shoulder > elbow > sword), head
// (neck) and backpack.
const FLIP_Y = 0.8;
const LEG_T = 0.27, LEG_S = 0.225, SOLE = 0.095; // thigh, shin, ankle-to-sole
export function makeFinn() {
  const root = new THREE.Group();
  const rig = group(root, 0, 0, 0);
  const spin = group(rig, 0, FLIP_Y, 0);
  const body = group(spin, 0, -FLIP_Y, 0);
  const SKIN = 0xfdd6ba, SHIRT = 0x1ca4dc, SHORTS = 0x1f5ec6, BAG = 0x9bdc70, BAG_D = 0x4ea12f;
  const legs = [], arms = [];
  const shortsLeg = new THREE.CylinderGeometry(0.072, 0.087, 0.16, 18);
  for (const s of [-1, 1]) {
    const hip = group(body, s * 0.085, 0.58, 0);
    add(hip, shortsLeg, SHORTS, 0, -0.06, 0);
    cap(hip, [0, -0.1, 0], [0, -LEG_T, 0], 0.036, SKIN);
    const knee = group(hip, 0, -LEG_T, 0);
    cap(knee, [0, 0, 0], [0, -0.19, 0], 0.034, SKIN);
    blob(knee, [0.053, 0.036, 0.053], 2.4, WHITE, 0, -0.188, 0); // rolled-down sock
    const foot = group(knee, 0, -LEG_S, 0);
    blob(foot, [0.068, 0.05, 0.112], 2.3, BLACK, 0, -0.045, 0.036);
    legs.push({ hip, knee, foot });
  }
  // the shorts are a hair wider than the shirt so the tucked-in hem hides inside them
  blob(body, [0.158, 0.09, 0.108], 3, SHORTS, 0, 0.625, 0);
  const torso = group(body, 0, 0.64, 0);
  blob(torso, [0.152, 0.205, 0.102], 3.4, SHIRT, 0, 0.21, 0);
  for (const s of [-1, 1]) {
    const sh = group(torso, s * 0.172, 0.36, 0);
    sh.rotation.order = "YXZ"; // x raises the arm, then y sweeps it around the body
    blob(sh, [0.062, 0.078, 0.062], 2.4, SHIRT, 0, -0.035, 0); // short sleeve
    cap(sh, [0, -0.07, 0], [0, -0.2, 0], 0.027, SKIN);
    const el = group(sh, 0, -0.2, 0);
    cap(el, [0, 0, 0], [0, -0.15, 0], 0.026, SKIN);
    if (s > 0) {
      // left hand, open
      add(el, G.sph, SKIN, 0, -0.18, 0, 0.04, 0.046, 0.038);
      add(el, G.sph, SKIN, 0, -0.168, 0.03, 0.017); // thumb
    }
    arms.push({ sh, el });
  }
  // right hand: a fist closed around the middle of the grip (grip-local: the handle runs
  // along y, knuckles face +z, palm +x toward the body). The wrist takes part of the bend
  // between forearm and blade, the handle turns the rest inside the fist (applySkeleton).
  const grip = group(arms[0].el, 0, -0.18, 0);
  grip.rotation.x = Math.PI / 2;
  blob(grip, [0.03, 0.05, 0.038], 2.4, SKIN, -0.008, 0, 0.004);
  for (const y of [-0.033, -0.011, 0.011, 0.033]) {
    add(grip, G.sph, SKIN, -0.014, y, 0.036, 0.013); // knuckles
    add(grip, G.sph, SKIN, 0.022, y, 0.014, 0.012); // fingertips curled into the palm
  }
  cap(grip, [0.012, 0.035, -0.028], [0.026, 0.047, 0.006], 0.012, SKIN); // thumb over the top
  // the golden sword, and the Night Sword (the prize for beating the Peppermint Butler): setFinnSword() picks
  const swords = { gold: makeSword(grip), night: makeNightSword(grip) };
  // head: a tall rounded hood with the face drawn onto its front
  const head = group(torso, 0, 0.42, 0);
  const hat = blob(head, [0.185, 0.255, 0.165], 3.2, WHITE, 0, 0.2, 0, { ws: 32, hs: 24 });
  for (const s of [-1, 1]) add(head, G.sph, WHITE, s * 0.118, 0.43, 0, 0.052, 0.058, 0.046);
  blob(head, [0.16, 0.08, 0.05], 2.6, WHITE, 0, -0.02, -0.11); // hood flap over the back of the neck
  decal(hat, ring(0.132, 0.108, 0.011, 0, 0.225), BLACK, { lift: 0.003 });
  decal(hat, ellipse(0.1215, 0.0975, 0, 0.225, 40), SKIN, { lift: 0.003, edge: 0.05 });
  const eyes = decal(hat, [ellipse(0.0135, 0.0195, -0.046, 0.247), ellipse(0.0135, 0.0195, 0.046, 0.247)], BLACK, { lift: 0.006, pivot: [0, 0.247], keep: true });
  const smile = decal(hat, arc(0, 0.232, 0.036, 0.0085, Math.PI + 0.55, Math.PI * 2 - 0.55), BLACK, { lift: 0.006, keep: true });
  const grin = new THREE.Shape();
  grin.moveTo(-0.04, 0.214);
  grin.lineTo(0.04, 0.214);
  grin.absellipse(0, 0.214, 0.04, 0.036, 0, Math.PI, true);
  const mouthOpen = [
    decal(hat, grin, 0x6b1b2a, { lift: 0.006, pivot: [0, 0.214], keep: true }),
    decal(hat, ellipse(0.022, 0.012, 0, 0.19), 0xff7d8e, { lift: 0.008, pivot: [0, 0.214], keep: true }),
    decal(hat, poly([[-0.032, 0.2135], [0.032, 0.2135], [0.03, 0.205], [-0.03, 0.205]]), WHITE, { lift: 0.008, pivot: [0, 0.214], keep: true }),
  ];
  for (const m of mouthOpen) m.visible = false;
  // backpack: dark body, light flap on top
  const bag = group(torso, 0, 0.4, -0.13);
  blob(bag, [0.15, 0.17, 0.085], 2.6, BAG_D, 0, -0.15, -0.04);
  blob(bag, [0.157, 0.1, 0.093], 2.6, BAG, 0, -0.06, -0.042);
  // on ladders the sword rides in the backpack, hilt over the right shoulder
  const backs = { gold: makeSword(bag), night: makeNightSword(bag) };
  for (const sh of Object.values(backs)) {
    sh.position.set(-0.09, 0.1, -0.05);
    sh.rotation.set(-0.3, 0, Math.PI + 0.3); // tip tucked down into the pack and out of sight
    sh.scale.setScalar(0.85);
    sh.visible = false;
  }
  swords.night.visible = false;
  for (const s of [-1, 1]) add(torso, rbox(0.035, 0.3, 0.02, 0.01), BAG_D, s * 0.09, 0.26, 0.1);
  bake(root);
  const trail = makeTrail();
  root.add(trail.mesh);
  root.userData = { rig, spin, body, torso, head, bag, legs, arms, grip, swords, backs, sword: swords.gold, sheathed: backs.gold, trail, eyes, smile, mouthOpen, anim: null, blade: SWORD_KINDS.gold };
  return root;
}
// where the swoosh is sampled along each blade, and its colour
const SWORD_KINDS = { gold: { tip: 0.68, rgb: [1, 0.95, 0.75, 1, 0.98, 0.88] }, night: { tip: 0.76, rgb: [0.62, 0.35, 1, 0.85, 0.72, 1] } };
/** Finn's sword: "gold" or "night". */
export function setFinnSword(f, kind) {
  const u = f.userData;
  if (u.blade === SWORD_KINDS[kind]) return;
  u.sword.visible = u.sheathed.visible = false;
  u.sword = u.swords[kind];
  u.sheathed = u.backs[kind];
  u.sword.visible = true;
  u.blade = SWORD_KINDS[kind];
}
/** The golden sword: origin in the middle of the grip, blade along +y, edges facing ±z. */
function makeSword(parent) {
  const s = group(parent, 0, 0, 0);
  add(s, G.sph, GOLD, 0, -0.078, 0, 0.022); // pommel
  cap(s, [0, -0.06, 0], [0, 0.06, 0], 0.015, 0x6e3a1d); // leather grip
  add(s, rbox(0.04, 0.028, 0.17, 0.012), GOLD, 0, 0.076, 0); // cross-guard
  add(s, G.sph, 0xd8203a, 0, 0.076, 0, 0.024, 0.011, 0.016); // ruby set through the guard
  add(s, rbox(0.012, 0.5, 0.046, 0.005), GOLD, 0, 0.34, 0, 1, 1, 1, { emissive: 0x4a3200 });
  add(s, rbox(0.0135, 0.4, 0.009, 0.004), 0xc98f1c, 0, 0.31, 0, 1, 1, 1, { outline: false }); // fuller
  add(s, G.cone, GOLD, 0, 0.62, 0, 0.006, 0.06, 0.023, { emissive: 0x4a3200 });
  return s;
}

/**
 * The Night Sword (forged by the Peppermint Butler in "Marcy & Hunson"): a long, narrow purple blade
 * tapering to its point, a round guard with an eye on each face. Same frame as makeSword.
 */
export function makeNightSword(parent) {
  const s = group(parent, 0, 0, 0);
  const PURPLE = 0x6b2fd6, DEEP = 0x3a1780, LIGHT = 0xa979ff;
  add(s, G.sph, LIGHT, 0, -0.082, 0, 0.024); // pommel
  cap(s, [0, -0.062, 0], [0, 0.058, 0], 0.016, DEEP); // grip
  add(s, G.cyl, PURPLE, 0, 0.082, 0, 0.05, 0.03, 0.05, { rz: Math.PI / 2 }); // the guard, a disc facing ±x
  for (const e of [-1, 1]) add(s, G.cone, PURPLE, 0, 0.082, e * 0.066, 0.012, 0.04, 0.012, { rx: e * Math.PI / 2 });
  for (const e of [-1, 1]) {
    // an eye on each face: white, a glowing light-blue iris, a slit pupil
    add(s, G.sph, WHITE, e * 0.013, 0.082, 0, 0.012, 0.032, 0.032);
    add(s, G.sph, 0x7fe0ff, e * 0.022, 0.082, 0, 0.006, 0.019, 0.019, { emissive: 0x2a8ab0, outline: false });
    add(s, G.sph, BLACK, e * 0.026, 0.082, 0, 0.004, 0.013, 0.004, { outline: false });
  }
  const blade = new THREE.Shape();
  blade.moveTo(-0.028, 0);
  blade.lineTo(0.028, 0);
  blade.lineTo(0.004, 0.62);
  blade.lineTo(0, 0.66);
  blade.lineTo(-0.004, 0.62);
  blade.closePath();
  // the shape's width runs along z (the edges), its thickness along x
  add(s, new THREE.ExtrudeGeometry(blade, { depth: 0.012, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1 }), PURPLE, -0.006, 0.1, 0, 1, 1, 1, { ry: Math.PI / 2, emissive: 0x2a0a60 });
  add(s, rbox(0.022, 0.42, 0.009, 0.003), LIGHT, 0, 0.34, 0, 1, 1, 1, { outline: false, emissive: 0x3a1a80 }); // fuller
  return s;
}

// Sword swoosh: a ribbon between the blade's middle and its tip, sampled while
// the swing is fast and faded by age. Lives in Finn's root space.
const TRAIL_N = 64, TRAIL_LIFE = 0.12;
function makeTrail() {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TRAIL_N * 6), 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(TRAIL_N * 8), 4).setUsage(THREE.DynamicDrawUsage));
  const idx = [];
  for (let i = 0; i < TRAIL_N - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  g.setIndex(idx);
  const mesh = new THREE.Mesh(g, noOutline(new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  })));
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.renderOrder = 2;
  return { mesh, samples: [] };
}

// ── Finn's animation ──
// Every frame builds one pose (joint angles) out of layers: locomotion (idle ↔
// walk ↔ run), air, ladder, double-jump tuck, sword, hurt, then additive landing
// crouch. Layer weights and springs are smoothed per frame, so nothing snaps.
const PI = Math.PI;
const KEYS = ["pry", "prz", "tx", "ty", "tz", "hx", "hy", "hz",
  "l0h", "l0z", "l0k", "l0f", "l1h", "l1z", "l1k", "l1f",
  "a0x", "a0y", "a0z", "a0e", "a1x", "a1y", "a1z", "a1e", "swx", "swy", "swz"];
const UPPER = KEYS.filter((k) => k[0] !== "l"), LOWER = KEYS.filter((k) => k[0] === "l");
const LK = [["l0h", "l0z", "l0k", "l0f"], ["l1h", "l1z", "l1k", "l1f"]]; // hip x, hip z, knee, foot
const AK = [["a0x", "a0y", "a0z", "a0e"], ["a1x", "a1y", "a1z", "a1e"]]; // shoulder x/y/z, elbow; arm 0 holds the sword
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const clamp01 = (v) => clamp(v, 0, 1);
const smooth01 = (u) => u * u * (3 - 2 * u);
const easeOut = (u) => 1 - (1 - u) * (1 - u);
function newPose() {
  const p = {};
  for (const k of KEYS) p[k] = 0;
  p.swx = PI / 2;
  return p;
}
function setLeg(p, i, h, k, f, z) {
  const n = LK[i];
  p[n[0]] = h; p[n[1]] = z; p[n[2]] = k; p[n[3]] = f;
}
function setArm(p, i, x, y, z, e) {
  const n = AK[i];
  p[n[0]] = x; p[n[1]] = y; p[n[2]] = z; p[n[3]] = e;
}
function blend(o, a, b, w, keys = KEYS) {
  for (const k of keys) o[k] = a[k] + (b[k] - a[k]) * w;
}
function mix(o, b, w, keys = KEYS) {
  if (w > 0) for (const k of keys) o[k] += (b[k] - o[k]) * w;
}
/** Damped spring toward target (w = stiffness in rad/s, z = damping ratio), substepped for stability. */
function spring(s, target, w, z, dt) {
  const n = Math.ceil(dt * 120), h = dt / n;
  for (let i = 0; i < n; i++) {
    s.v += (-(s.x - target) * w * w - 2 * z * w * s.v) * h;
    s.x += s.v * h;
  }
}
/** Named pose; legs are [hip x, hip z, knee] with the foot kept flat on the ground. */
function kf(o) {
  const p = newPose();
  for (const k of ["pry", "prz", "tx", "ty", "tz", "hx", "hy", "hz"]) p[k] = o[k] || 0;
  setArm(p, 0, ...o.a0);
  setArm(p, 1, ...o.a1);
  [p.swx, p.swy, p.swz] = o.sw || [PI / 2, 0, 0];
  for (const i of [0, 1]) {
    const [h, z, k] = o[i ? "l1" : "l0"];
    setLeg(p, i, h, k, o.feet ?? -(h + k), z);
  }
  return p;
}
// knees to the chest for the double-jump flip
const TUCK = kf({
  tx: 0.55, hx: 0.3, a0: [-0.95, 0.25, -0.25, -1.5], a1: [-0.95, -0.25, 0.25, -1.6],
  l0: [-2.0, -0.12, 2.35], l1: [-2.0, 0.12, 2.35], feet: 0.4,
});
// knocked back
const HURT = kf({
  tx: -0.4, hx: -0.35, a0: [-1.9, 0, -0.85, -0.5], a1: [-1.9, 0, 0.85, -0.5],
  l0: [-0.55, -0.08, 0.7], l1: [0.35, 0.08, 0.45],
});
// sword swings: the ground combo (forehand, backhand, overhead chop), the spin in the air and
// the Fire Wave's cut (F). Each is wind-up, strike end, follow-through.
const ATK = [
  [
    kf({ pry: -0.2, tx: -0.04, ty: -0.5, tz: 0.05, hy: 0.45, a0: [-2.1, -1.4, -0.2, -1.4], a1: [-1.1, 0.35, 0.15, -0.35], sw: [PI * 0.75, 0, 0], l0: [0.22, -0.08, 0.28], l1: [-0.3, 0.08, 0.35] }),
    kf({ pry: 0.25, tx: 0.18, ty: 0.5, tz: -0.05, hy: -0.4, a0: [-1.5, 0.95, 0, -0.12], a1: [0.35, 0, 0.35, -1.1], sw: [PI * 0.92, 0, 0], l0: [0.42, -0.08, 0.3], l1: [-0.6, 0.1, 0.75] }),
    kf({ pry: 0.3, tx: 0.14, ty: 0.62, tz: -0.05, hy: -0.45, a0: [-1.25, 1.4, 0, -0.45], a1: [0.3, 0, 0.3, -1.0], sw: [PI * 0.85, 0, 0], l0: [0.4, -0.08, 0.3], l1: [-0.55, 0.1, 0.7] }),
  ],
  [
    kf({ pry: 0.2, tx: -0.02, ty: 0.5, tz: -0.04, hy: -0.4, a0: [-2.0, 1.35, 0.1, -1.5], a1: [0.2, 0, 0.3, -0.9], sw: [PI * 0.75, 0, 0], l0: [-0.3, -0.08, 0.35], l1: [0.2, 0.08, 0.28] }),
    kf({ pry: -0.25, tx: 0.18, ty: -0.5, tz: 0.05, hy: 0.4, a0: [-1.5, -1.25, -0.1, -0.1], a1: [-0.9, 0.3, 0.3, -0.4], sw: [PI * 0.92, 0, 0], l0: [-0.6, -0.1, 0.75], l1: [0.42, 0.08, 0.3] }),
    kf({ pry: -0.3, tx: 0.14, ty: -0.6, hy: 0.45, a0: [-1.3, -1.65, -0.1, -0.4], a1: [-0.8, 0.3, 0.3, -0.4], sw: [PI * 0.85, 0, 0], l0: [-0.55, -0.1, 0.7], l1: [0.4, 0.08, 0.3] }),
  ],
  [
    kf({ tx: -0.2, ty: -0.15, hx: 0.15, hy: 0.15, a0: [-3.0, -0.25, -0.1, -1.5], a1: [-2.6, 0.3, 0.2, -1.2], sw: [PI * 0.8, 0, 0], l0: [0.15, -0.1, 0.25], l1: [-0.25, 0.1, 0.3] }),
    kf({ tx: 0.45, ty: 0.05, hx: -0.35, a0: [-1.05, 0.15, -0.05, -0.1], a1: [-0.6, 0, 0.35, -0.6], sw: [PI * 0.95, 0, 0], l0: [0.45, -0.1, 0.4], l1: [-0.7, 0.12, 1.0] }),
    kf({ tx: 0.4, hx: -0.3, a0: [-0.85, 0.15, -0.05, -0.3], a1: [-0.3, 0, 0.35, -0.7], sw: [PI * 0.9, 0, 0], l0: [0.42, -0.1, 0.4], l1: [-0.65, 0.12, 0.95] }),
  ],
  [
    // coiled, sword across the chest; then a full turn with the blade held straight out
    kf({ pry: -0.5, tx: 0.25, ty: -0.45, a0: [-1.3, -1.3, -0.3, -1.4], a1: [-0.7, 0.4, 0.5, -1.3], sw: [PI * 0.8, 0, 0], l0: [-1.3, -0.1, 1.7], l1: [-0.7, 0.1, 1.5], feet: 0.2 }),
    kf({ pry: -0.5 + 2 * PI * 0.9, tx: 0.1, ty: 0.3, a0: [-1.45, 1.4, 0, -0.06], a1: [-0.4, 0, 1.2, -0.4], sw: [PI * 0.96, 0, 0], l0: [-0.9, -0.2, 1.2], l1: [-0.3, 0.2, 0.9], feet: 0.2 }),
    kf({ pry: 2 * PI + 0.15, tx: 0.05, ty: 0.35, a0: [-1.35, 1.5, 0, -0.3], a1: [-0.3, 0, 1.0, -0.5], sw: [PI * 0.9, 0, 0], l0: [-0.8, -0.2, 1.1], l1: [-0.3, 0.2, 0.9], feet: 0.2 }),
  ],
  [
    // the Fire Wave: arched back, the burning sword raised behind his head in both hands; then down
    // into the floor ahead in a deep lunge (the wave runs out from there), and held a moment
    kf({ tx: -0.38, ty: -0.2, hx: 0.28, hy: 0.15, a0: [-3.1, -0.3, -0.15, -1.75], a1: [-2.8, 0.35, 0.25, -1.4], sw: [PI * 0.72, 0, 0], l0: [0.3, -0.12, 0.35], l1: [-0.5, 0.12, 0.6] }),
    kf({ tx: 0.58, ty: 0.08, hx: -0.48, a0: [-1.1, 0.12, -0.05, -0.05], a1: [0.55, 0.2, 0.6, -0.35], sw: [PI * 0.97, 0, 0], l0: [0.6, -0.12, 0.35], l1: [-0.95, 0.14, 1.35] }),
    kf({ tx: 0.5, ty: 0.06, hx: -0.4, a0: [-1.2, 0.12, -0.05, -0.2], a1: [0.4, 0.2, 0.55, -0.45], sw: [PI * 0.93, 0, 0], l0: [0.55, -0.12, 0.35], l1: [-0.9, 0.14, 1.3] }),
  ],
];
// timeline of each swing (s): wind-up ends, strike ends, follow-through ends, back to normal.
// The physics (SWING in main.js) lands the hit inside the strike.
const ATL = [[0.07, 0.15, 0.25, 0.45], [0.07, 0.15, 0.25, 0.45], [0.12, 0.2, 0.32, 0.58], [0.05, 0.3, 0.36, 0.5], [0.2, 0.28, 0.5, 0.78]];
const TRAIL_T = [[0.05, 0.27], [0.05, 0.27], [0.1, 0.34], [0.04, 0.34], [0.18, 0.38]];
const FIRE_TRAIL = [1, 0.3, 0.05, 1, 0.62, 0.18]; // the Fire Wave's swoosh (swing 4), whatever the sword
const COMBO = 0.62; // without the physics' swing kind (the studio), the combo advances within this
function attackPose(p, a, t) {
  const K = ATK[a.atkKind], [t1, t2, t3] = ATL[a.atkKind];
  if (t < t1) blend(p, a.k0, K[0], smooth01(t / t1));
  else if (t < t2) blend(p, K[0], K[1], smooth01((t - t1) / (t2 - t1)));
  else if (t < t3) blend(p, K[1], K[2], easeOut((t - t2) / (t3 - t2)));
  else blend(p, K[2], K[2], 0);
  if (a.atkKind === 3) p.pry = Math.atan2(Math.sin(p.pry), Math.cos(p.pry)); // a whole turn ends where it began
}
function attackWeight(a) {
  const [, , t3, t4] = ATL[a.atkKind], t = a.atkT;
  return t < t3 ? 1 : t < t4 ? 1 - smooth01((t - t3) / (t4 - t3)) : 0;
}

function locomotion(o, a, t) {
  const I = a.pI, br = Math.sin(t * 2.4), sway = Math.sin(t * 0.9);
  // idle: breathing, weight shift, looking around, sword at the ready
  I.pry = 0.04 * sway; I.prz = 0.025 * sway;
  I.tx = 0.03 + 0.015 * br; I.ty = -0.05 * sway; I.tz = -0.02 * sway;
  I.hx = -0.02 * br; I.hy = 0.14 * Math.sin(t * 0.37) + 0.06 * Math.sin(t * 0.93) + 0.05 * sway; I.hz = 0.04 * Math.sin(t * 1.7);
  setLeg(I, 0, -0.05, 0.12, -0.07, -0.05);
  setLeg(I, 1, 0.03, 0.1, -0.13, 0.06);
  setArm(I, 0, -0.12 + 0.03 * br, 0, -0.16, -0.45); // sword held low, pointing ahead
  setArm(I, 1, 0.05 - 0.03 * br, 0, 0.12, -0.25);
  I.swx = 2.35; I.swy = 0; I.swz = 0;
  if (a.move < 0.002) return blend(o, I, I, 0);
  // phase p: leg 0 is furthest forward at sin(p) = 1
  const W = a.pW, R = a.pR, p = a.ph, s = Math.sin(p), c = Math.cos(p);
  for (let i = 0; i < 2; i++) {
    const q = p + i * PI, sq = Math.sin(q), cq = Math.cos(q), side = i ? 1 : -1;
    // walk: knee folds while the leg swings through, heel strike, toe-off
    let h = -0.62 * sq;
    let k = 0.1 + 0.95 * Math.max(0, Math.cos(q + 0.25)) ** 1.5 + 0.12 * Math.max(0, -cq);
    setLeg(W, i, h, k, -(h + k) + 0.4 * Math.max(0, cq) - 0.15 * Math.max(0, sq) ** 4 + 0.3 * Math.max(0, -sq) ** 4, side * 0.03);
    // run: longer reach forward, heel kicks up to the seat after toe-off
    h = -0.12 - 0.92 * sq;
    k = 0.2 + 1.85 * Math.max(0, Math.cos(q + 0.5)) ** 1.6 + 0.3 * Math.max(0, -cq);
    const sw = Math.max(0, Math.cos(q + 0.3));
    setLeg(R, i, h, k, -(h + k) * (1 - sw) + 0.55 * sw, side * 0.04);
  }
  const sp = Math.max(0, s), sn = Math.max(0, -s);
  // arms swing against the legs; shoulders twist against the hips; the head stays on target
  setArm(W, 0, 0.35 * s, 0, -0.12, -0.55 - 0.3 * sn);
  setArm(W, 1, -0.5 * s, 0, 0.1, -0.2 - 0.4 * sp);
  W.pry = 0.12 * s; W.prz = 0.03 * c; W.tx = 0.07; W.ty = -0.22 * s; W.tz = 0;
  W.hx = -0.035 + 0.02 * Math.cos(2 * p); W.hy = 0.08 * s; W.hz = 0;
  W.swx = 2.3; W.swy = 0; W.swz = 0;
  setArm(R, 0, -0.35 + 0.25 * s, 0.1, -0.2, -0.55 - 0.1 * sn); // sword arm steady, blade leveled ahead
  setArm(R, 1, -0.85 * s - 0.15, -0.2 * sp, 0.12, -1.35 - 0.3 * sp);
  R.pry = 0.2 * s; R.prz = 0.04 * c; R.tx = 0.3; R.ty = -0.4 * s; R.tz = 0;
  R.hx = -0.2 + 0.03 * Math.cos(2 * p); R.hy = 0.16 * s; R.hz = 0;
  R.swx = 2.45; R.swy = 0; R.swz = 0;
  blend(a.tmp, W, R, a.run);
  blend(o, I, a.tmp, a.move);
}

/** Rising (knee up, arm reaching), apex (spread) and falling (legs reach down, arms up), by vertical speed. */
function airPose(o, a, s) {
  let v = clamp(a.vy / 10, -1, 1);
  if (s.mantle > 0) v += (0.7 - v) * s.mantle;
  const up = Math.max(0, v), dn = Math.max(0, -v), mid = 1 - up - dn;
  const L = a.lead, Tr = 1 - L, sp = 0.6 + 0.4 * clamp01(s.speed / 9);
  const fl = clamp01((a.fallT - 0.45) / 0.3), w1 = Math.sin(s.time * 13), w2 = Math.sin(s.time * 11); // long falls: flail
  setLeg(o, L, (-1.1 * up - 0.8 * mid - 0.5 * dn) * sp + 0.35 * fl * w2, 1.55 * up + 1.35 * mid + 0.55 * dn,
    0.35 * up + 0.3 * mid + 0.05 * dn, L ? 0.08 : -0.08);
  setLeg(o, Tr, (0.5 * up + 0.05 * mid - 0.05 * dn) * sp - 0.35 * fl * w2, 0.95 * up + 1.1 * mid + 0.8 * dn,
    0.45 * up + 0.4 * mid + 0.15 * dn, Tr ? 0.08 : -0.08);
  setArm(o, 1, -2.5 * up - 1.4 * mid - 2.1 * dn + 0.5 * fl * w1, 0, 0.3 * up + 0.95 * mid + 0.75 * dn + 0.2 * fl * Math.cos(s.time * 13),
    -0.35 * up - 0.45 * mid - 0.5 * dn);
  setArm(o, 0, 0.45 * up - 0.8 * mid - 1.7 * dn - 0.5 * fl * w1, 0, -0.45 * up - 0.95 * mid - 0.75 * dn, -0.7 * up - 0.6 * mid - 0.55 * dn);
  o.pry = (L ? -0.12 : 0.12) * up; o.prz = 0;
  o.tx = -0.08 * up + 0.04 * mid + 0.1 * dn; o.ty = 0; o.tz = 0;
  o.hx = -0.18 * up + 0.12 * dn; o.hy = 0; o.hz = 0;
  o.swx = PI / 2; o.swy = 0; o.swz = 0;
}

/** Hand over hand: right hand reaches up with the left foot; the cycle advances with the climb. */
function climbPose(o, a, t) {
  const c = Math.sin(a.cp), br = Math.sin(t * 2.4);
  setArm(o, 0, -2.4 - 0.4 * c, 0, -0.18, -0.6 + 0.5 * c);
  setArm(o, 1, -2.4 + 0.4 * c, 0, 0.18, -0.6 - 0.5 * c);
  for (const i of [0, 1]) {
    const cc = i ? -c : c, h = -0.8 + 0.45 * cc, k = 1.1 - 0.5 * cc;
    setLeg(o, i, h, k, -(h + k) * 0.8, i ? 0.08 : -0.08);
  }
  o.pry = 0.07 * c; o.prz = 0;
  o.tx = 0.03 + 0.01 * br; o.ty = -0.05 * c; o.tz = 0.03 * c;
  o.hx = -0.25; o.hy = 0.1 * c; o.hz = 0;
  o.swx = PI / 2; o.swy = 0; o.swz = 0;
}

function newAnim(ev) {
  return {
    ev: { ...ev }, clock: 0,
    ph: 0, cp: 0, move: 0, run: 0, air: 0, climb: 0, lead: 0, vy: 0, fallT: 0, sinceJump: 9, flip: 1,
    atkT: 9, atkKind: 0, atkAt: -9, atkW: 0, atkLW: 0, hurtT: 9, blink: 2.5, mouth: 0,
    crouch: { x: 0, v: 0 }, stretch: { x: 0, v: 0 }, bag: { x: 0, v: 0 },
    bank: 0, lean: 0, accel: 0, heading: null, speed: 0,
    out: newPose(), stage: newPose(), k0: newPose(),
    pI: newPose(), pW: newPose(), pR: newPose(), pA: newPose(), pC: newPose(), pK: newPose(), pK2: newPose(), tmp: newPose(),
  };
}

/** How far the sole reaches below the hip for this leg pose. */
function legReach(o, i) {
  const n = LK[i], h = o[n[0]], k = o[n[2]];
  return (LEG_T * Math.cos(h) + LEG_S * Math.cos(h + k)) * Math.cos(o[n[1]]) + SOLE + 0.1 * Math.abs(Math.sin(h + k + o[n[3]]));
}

function applySkeleton(u, o) {
  u.body.rotation.set(0, o.pry, o.prz);
  u.torso.rotation.set(o.tx, o.ty, o.tz);
  u.head.rotation.set(o.hx, o.hy, o.hz);
  for (let i = 0; i < 2; i++) {
    const L = u.legs[i], n = LK[i];
    L.hip.rotation.set(o[n[0]], 0, o[n[1]]);
    L.knee.rotation.x = o[n[2]];
    L.foot.rotation.x = o[n[3]];
    const A = u.arms[i], m = AK[i];
    A.sh.rotation.set(o[m[0]], o[m[1]], o[m[2]]);
    A.el.rotation.x = o[m[3]];
  }
  // swx: angle of the blade to the forearm (pi/2 = square to it). The wrist takes 45% of the
  // bend away from that and the handle turns the rest inside the fist.
  const bend = o.swx - PI / 2;
  u.grip.rotation.x = PI / 2 + 0.45 * bend;
  u.sword.rotation.set(0.55 * bend, o.swy, o.swz);
}

/**
 * s: { speed (horizontal), vy, ground, airT (s since ground), climb, climbV, heading (rendered),
 *      time, mantle 0..1 (stepping off a ladder top), ev (event counters from the physics) }
 * Call after setting f's position and rotation for this frame.
 */
export function poseFinn(f, s, dt) {
  const u = f.userData;
  const a = u.anim || (u.anim = newAnim(s.ev));
  const k = (rate) => 1 - Math.exp(-rate * dt);
  a.clock += dt;

  // ── events since the last frame ──
  const e = s.ev, seen = a.ev;
  if (e.jump !== seen.jump) {
    a.stretch.v += 30;
    a.sinceJump = 0;
    a.lead = Math.sin(a.ph) > 0 ? 0 : 1; // the leg already in front leads the jump
    a.flip = 1;
    if (a.air < 0.3) a.vy = s.vy; // off the ground: nothing to blend from
  }
  if (e.jump2 !== seen.jump2) {
    a.flip = 0;
    a.stretch.v += 18;
    a.sinceJump = 0;
  }
  if (e.land !== seen.land && !s.climb && e.landV > 2) {
    const hard = clamp01((e.landV - 3) / 20);
    a.crouch.v += 35 * (0.12 + 0.75 * hard);
    a.bag.v += 6 * hard;
  }
  if (e.attack !== seen.attack) {
    a.atkKind = e.atkKind ?? (a.clock - a.atkAt < COMBO ? (a.atkKind + 1) % 3 : 0);
    a.atkAt = a.clock;
    a.atkT = 0;
    blend(a.k0, a.stage, a.stage, 0); // swing starts from wherever the arm was
  }
  if (e.hurt !== seen.hurt) a.hurtT = 0;
  if (e.hit !== undefined && e.hit !== seen.hit) a.crouch.v += a.atkKind === 4 ? 12 : a.atkKind === 2 ? 9 : 4; // the blade bites: a little dip
  Object.assign(seen, e);

  // ── layer weights, phases, timers ──
  const spd = s.speed;
  a.sinceJump += dt;
  const airborne = !s.ground && !s.climb && (s.airT > 0.07 || a.sinceJump < 0.3);
  const airTarget = Math.max(airborne ? 1 : 0, s.mantle);
  a.air += (airTarget - a.air) * k(airTarget > a.air ? 14 : 16);
  // the air pose follows a smoothed vertical speed, held on touchdown (the physics zeroes it there)
  if (!s.ground && !s.climb) a.vy += (s.vy - a.vy) * k(15);
  a.climb += ((s.climb ? 1 : 0) - a.climb) * k(12);
  if (s.ground || s.climb) {
    a.move += (clamp01(spd / 9) - a.move) * k(10);
    a.run += (clamp01((spd - 9.3) / 3.5) - a.run) * k(6);
  }
  // cadence climbs with speed: ~2.7 strides/s walking, ~3.4 sprinting
  const hz = (1 + 0.19 * spd) * (1 - a.run) + (1.3 + 0.15 * spd) * a.run;
  if (s.ground) a.ph = (a.ph + dt * 2 * PI * hz * Math.min(1, spd / 1.5)) % (2 * PI);
  if (s.climb) a.cp += s.climbV * dt * ((2 * PI) / 1.1);
  a.fallT = !s.ground && s.vy < -2 ? a.fallT + dt : 0;
  if (a.flip < 1) a.flip = Math.min(1, a.flip + (dt / 0.5) * (s.ground || s.climb ? 4 : 1));
  const atkPrev = a.atkT;
  a.atkT += dt;
  a.hurtT += dt;

  // ── pose layers ──
  const o = a.out;
  locomotion(o, a, s.time);
  if (a.air > 0.001) { airPose(a.pA, a, s); mix(o, a.pA, a.air); }
  if (a.climb > 0.001) { climbPose(a.pC, a, s.time); mix(o, a.pC, a.climb); }
  const tuck = a.flip < 1 ? smooth01(clamp01(a.flip / 0.25)) * (1 - smooth01(clamp01((a.flip - 0.6) / 0.4))) : 0;
  mix(o, TUCK, tuck);
  a.atkW = attackWeight(a);
  // the legs step into ground swings (the physics lunges too), and tuck up for the air spin
  a.atkLW = a.atkKind === 3 ? a.atkW : a.atkW * (1 - a.air) * (1 - a.climb) * (1 - a.run * a.move);
  if (a.atkW > 0) {
    attackPose(a.pK, a, a.atkT);
    mix(o, a.pK, a.atkW, UPPER);
    mix(o, a.pK, a.atkLW, LOWER);
  }
  blend(a.stage, o, o, 0);
  const hw = a.hurtT < 0.07 ? a.hurtT / 0.07 : 1 - smooth01(clamp01((a.hurtT - 0.07) / 0.4));
  mix(o, HURT, 0.85 * hw);
  spring(a.crouch, 0, 13, 1, dt);
  const c = Math.max(0, a.crouch.x) * (1 - a.climb);
  if (c > 0.001) {
    for (const n of LK) { o[n[0]] -= 0.55 * c; o[n[2]] += 1.1 * c; o[n[3]] -= 0.55 * c; }
    o.tx += 0.3 * c; o.hx -= 0.22 * c;
    o.a0x -= 0.25 * c; o.a1x -= 0.25 * c; o.a0z -= 0.25 * c; o.a1z += 0.25 * c;
  }

  // ── whole body: height, squash, lean, bank, flip ──
  // plant the lower foot (walk, idle, crouch); the run adds its own bounce with flight phases
  const gnd = (1 - a.air) * (1 - a.climb);
  let by = (Math.max(legReach(o, 0), legReach(o, 1)) - (LEG_T + LEG_S + SOLE)) * gnd * (1 - 0.7 * a.run * a.move);
  by += a.move * a.run * gnd * (0.075 * Math.abs(Math.sin(a.ph)) - 0.02);
  spring(a.stretch, 0, 17, 0.45, dt);
  const sy = 1 + a.stretch.x * 0.13 - c * 0.1 + Math.min(1, Math.abs(a.vy) / 20) * 0.05 * a.air * (1 - tuck);
  const sxz = 1 / Math.sqrt(sy);
  if (a.heading === null) a.heading = s.heading;
  const dh = Math.atan2(Math.sin(s.heading - a.heading), Math.cos(s.heading - a.heading));
  a.heading = s.heading;
  const turn = dt > 0 ? dh / dt : 0;
  a.bank += (clamp(-turn * spd * 0.0035, -0.28, 0.28) * gnd - a.bank) * k(8);
  a.accel += ((dt > 0 ? (spd - a.speed) / dt : 0) - a.accel) * k(8);
  a.speed = spd;
  a.lean += (clamp(a.accel * 0.004, -0.16, 0.16) * gnd - a.lean) * k(10);
  spring(a.bag, 0.12 * a.move + 0.25 * a.run * a.move + 0.08 * Math.sin(2 * a.ph) * a.move * gnd + clamp(-s.vy * 0.02, -0.3, 0.35) * a.air, 13, 0.3, dt);

  u.rig.rotation.set(a.lean, 0, a.bank);
  u.rig.scale.set(sxz, sy, sxz);
  u.spin.rotation.x = a.flip < 1 ? 2 * PI * (0.5 * easeOut(a.flip) + 0.5 * smooth01(a.flip)) : 0;
  u.body.position.y = -FLIP_Y + by;
  u.bag.rotation.x = a.bag.x;
  const stowed = a.climb > 0.5 && a.atkW === 0;
  u.sword.visible = !stowed;
  u.sheathed.visible = stowed;
  // face: blink now and then; the mouth opens with effort (swing, jump, flip, hurt, long fall)
  a.blink -= dt;
  if (a.blink < -0.12) a.blink = 2 + Math.random() * 3;
  u.eyes.scale.y = a.blink < 0 ? 0.12 : 1;
  const effort = Math.max(a.atkT < ATL[a.atkKind][2] ? a.atkW : 0, tuck, hw, a.air * (a.sinceJump < 0.45 ? 1 : clamp01((a.fallT - 0.5) / 0.3)));
  a.mouth += (effort - a.mouth) * k(effort > a.mouth ? 25 : 8);
  u.smile.visible = a.mouth <= 0.3;
  for (const m of u.mouthOpen) {
    m.visible = a.mouth > 0.3;
    m.scale.y = 0.5 + 0.5 * a.mouth;
  }
  applySkeleton(u, o);
  updateTrail(f, a, atkPrev);
}

const _tp = new THREE.Vector3(), _inv = new THREE.Matrix4();
/** Samples the blade between last frame's swing time and this one's, then redraws the ribbon. */
function updateTrail(f, a, t0) {
  const u = f.userData, tr = u.trail, S = tr.samples, t1 = a.atkT;
  const [TRAIL_FROM, TRAIL_TO] = TRAIL_T[a.atkKind];
  const from = Math.max(t0, TRAIL_FROM), to = Math.min(t1, TRAIL_TO);
  if (to > from) {
    f.updateMatrixWorld(true);
    _inv.copy(f.matrixWorld).invert();
    const n = Math.ceil((to - from) / 0.004);
    for (let i = t0 < TRAIL_FROM ? 0 : 1; i <= n; i++) {
      const ts = from + ((to - from) * i) / n;
      if (ts < t1 - 1e-6) {
        // same pose as this frame, but with the swing rewound to ts
        attackPose(a.pK2, a, ts);
        for (const key of UPPER) a.tmp[key] = a.out[key] + (a.pK2[key] - a.pK[key]) * a.atkW;
        for (const key of LOWER) a.tmp[key] = a.out[key] + (a.pK2[key] - a.pK[key]) * a.atkLW;
        applySkeleton(u, a.tmp);
      } else applySkeleton(u, a.out);
      u.sword.updateMatrixWorld(true);
      const b = u.sword.localToWorld(_tp.set(0, 0.28, 0)).applyMatrix4(_inv);
      const smp = { t: a.clock - (t1 - ts), bx: b.x, by: b.y, bz: b.z, tx: 0, ty: 0, tz: 0 };
      const tip = u.sword.localToWorld(_tp.set(0, u.blade.tip, 0)).applyMatrix4(_inv);
      smp.tx = tip.x; smp.ty = tip.y; smp.tz = tip.z;
      S.push(smp);
    }
    applySkeleton(u, a.out);
  }
  while (S.length && (a.clock - S[0].t > TRAIL_LIFE || S.length > TRAIL_N)) S.shift();
  if (S.length < 2) { tr.mesh.visible = false; return; }
  const g = tr.mesh.geometry, P = g.attributes.position.array, C = g.attributes.color.array;
  for (let i = 0; i < S.length; i++) {
    const q = S[i], al = clamp01(1 - (a.clock - q.t) / TRAIL_LIFE) ** 1.5 * 0.85;
    P.set([q.bx, q.by, q.bz, q.tx, q.ty, q.tz], i * 6);
    const c = a.atkKind === 4 ? FIRE_TRAIL : u.blade.rgb;
    C.set([c[0], c[1], c[2], al * 0.08, c[3], c[4], c[5], al], i * 8);
  }
  g.attributes.position.needsUpdate = true;
  g.attributes.color.needsUpdate = true;
  g.setDrawRange(0, (S.length - 1) * 6);
  tr.mesh.visible = true;
}

// ── Jake ─────────────────────────────────────────────────────────────────────
// Rig: root (position, heading) > rig (pivot at the feet: bank, growing giant) >
// hips (height follows the legs) > legs (hip > knee > foot; stretchy: the segment
// meshes scale) and body (the bean: lean, twist, waddle) > eyes, mouth, ears, arms
// (shoulder > elbow > paw; a punch stretches the arm into one long noodle), tail.
const J_T = 0.13, J_S = 0.12, J_SOLE = 0.04;
const J_UP = 0.13, J_PAW = 0.125, J_ARM = J_UP + J_PAW; // shoulder to elbow, elbow to paw centre, whole arm
// open tube hanging from its top (y 0 to -1): scaled along y it reaches from the shoulder to the paw
const NOODLE = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true).translate(0, -0.5, 0);
export function makeJake() {
  const root = new THREE.Group();
  const rig = group(root, 0, 0, 0);
  const hips = group(rig, 0, J_T + J_S + J_SOLE, 0);
  const body = group(hips, 0, 0, 0);
  const Yc = 0xf7ae1f, EAR = 0xe59814, NOSE = 0x241c1c;
  lathe(body, [[0.001, -0.135], [0.15, -0.125], [0.235, -0.08], [0.27, 0.01], [0.275, 0.15], [0.285, 0.3], [0.31, 0.42],
    [0.328, 0.52], [0.322, 0.62], [0.29, 0.7], [0.215, 0.752], [0.11, 0.772], [0.001, 0.778]], Yc, 0, 0, 0, { smooth: 48, sz: 0.86, seg: 32 });
  // big eyes bulging from the top of the head, black lids along their upper rims
  const eyes = [];
  for (const s of [-1, 1]) {
    add(body, G.sph, BLACK, s * 0.158, 0.676, 0.172, 0.114, 0.113, 0.095);
    const e = group(body, s * 0.15, 0.66, 0.19);
    add(e, G.sph, WHITE, 0, 0, 0, 0.11, 0.11, 0.095);
    add(e, G.sph, BLACK, -s * 0.026, -0.03, 0.074, 0.059, 0.063, 0.03, { outline: false });
    add(e, G.sph, WHITE, -s * 0.01, -0.01, 0.1, 0.016, 0.016, 0.008, { outline: false });
    eyes.push(e);
  }
  // muzzle: two jowls, the bridge under the nose, a big black nose
  for (const s of [-1, 1]) blob(body, [0.125, 0.1, 0.11], 2, Yc, s * 0.085, 0.43, 0.215);
  add(body, G.sph, Yc, 0, 0.475, 0.25, 0.1, 0.07, 0.09);
  blob(body, [0.07, 0.048, 0.055], 2.2, NOSE, 0, 0.51, 0.3);
  add(body, G.sph, WHITE, -0.022, 0.535, 0.348, 0.018, 0.01, 0.008, { outline: false });
  const mouth = group(body, 0, 0.34, 0.245);
  add(mouth, G.sph, 0x5c1422, 0, 0, 0, 0.07, 0.045, 0.03, { outline: false });
  add(mouth, G.sph, 0xff7d8e, 0, -0.018, 0.014, 0.045, 0.02, 0.02, { outline: false });
  mouth.visible = false;
  // floppy ears hanging from the sides of the head
  const ears = [];
  for (const s of [-1, 1]) {
    const ear = group(body, s * 0.27, 0.71, -0.03);
    blob(ear, [0.06, 0.145, 0.034], 2.2, EAR, s * 0.045, -0.12, 0, { rz: s * 0.32 });
    ears.push(ear);
  }
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = group(body, s * 0.285, 0.32, 0.03);
    sh.rotation.order = "YXZ";
    cap(sh, [0, 0, 0], [0, -J_UP, 0], 0.027, Yc);
    const noodle = add(sh, NOODLE, Yc, 0, 0, 0, 0.03, 1, 0.03, { keep: true });
    noodle.visible = false;
    const el = group(sh, 0, -J_UP, 0);
    cap(el, [0, 0, 0], [0, -0.1, 0], 0.026, Yc);
    // the paw is its own group so a punch can blow it up into a big fist
    const paw = group(el, 0, -J_PAW, 0.005);
    add(paw, G.sph, Yc, 0, 0, 0, 0.042, 0.04, 0.038);
    add(paw, G.sph, Yc, -s * 0.02, -0.027, 0.015, 0.016);
    for (const k of [-1, 0, 1]) add(paw, G.sph, Yc, k * 0.021, -0.031, 0.008, 0.015); // knuckles: blown up, it reads as a fist
    arms.push({ sh, el, paw, noodle });
  }
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = group(hips, s * 0.12, 0, 0);
    const thigh = cap(hip, [0, 0, 0], [0, -J_T, 0], 0.05, Yc, { keep: true });
    const knee = group(hip, 0, -J_T, 0);
    const shin = cap(knee, [0, 0, 0], [0, -J_S, 0], 0.046, Yc, { keep: true });
    const foot = group(knee, 0, -J_S, 0);
    blob(foot, [0.062, 0.036, 0.088], 2.3, Yc, 0, -0.004, 0.032);
    legs.push({ hip, knee, foot, thigh, shin });
  }
  const tail = group(body, 0, -0.02, -0.215);
  tube(tail, [[0, 0, 0], [0, 0.02, -0.07], [0, 0.09, -0.12], [0, 0.17, -0.12]], 0.026, 0.016, Yc, { segs: 10, radial: 7 });
  bake(root);
  root.userData = { rig, hips, body, legs, arms, ears, tail, eyes, mouth, anim: null, giant: 1 };
  return root;
}

// ── Jake's animation ──
// Same idea as Finn's: idle ↔ waddle ↔ stretchy-legged run by speed, then sitting
// (when he stops for a while or waits for Finn), talking; springs for ears.
const JK = ["bx", "by", "bz", "l0h", "l0k", "l0f", "l1h", "l1k", "l1f", "a0x", "a0y", "a0z", "a0e", "a1x", "a1y", "a1z", "a1e", "tx", "ty"];
const JL = [["l0h", "l0k", "l0f"], ["l1h", "l1k", "l1f"]], JA = [["a0x", "a0y", "a0z", "a0e"], ["a1x", "a1y", "a1z", "a1e"]];
function jPose() {
  const p = {};
  for (const k of JK) p[k] = 0;
  return p;
}
function jLeg(p, i, h, k, f) {
  const n = JL[i];
  p[n[0]] = h; p[n[1]] = k; p[n[2]] = f;
}
function jArm(p, i, x, y, z, e) {
  const n = JA[i];
  p[n[0]] = x; p[n[1]] = y; p[n[2]] = z; p[n[3]] = e;
}
function jakeIdle(p, t) {
  const br = Math.sin(t * 2.2);
  p.bx = 0.02 + 0.012 * br; p.by = 0; p.bz = 0.02 * Math.sin(t * 0.8);
  for (const i of [0, 1]) jLeg(p, i, -0.04, 0.08, -0.04);
  // paws held up in front of the belly
  jArm(p, 0, -0.45 + 0.04 * br, 0.3, -0.1, -1.1);
  jArm(p, 1, -0.45 + 0.04 * br, -0.3, 0.1, -1.1);
  p.tx = 0.25; p.ty = 0.45 * Math.sin(t * 5);
}
function jakeWalk(p, ph, t) {
  const s = Math.sin(ph), c = Math.cos(ph);
  for (const i of [0, 1]) {
    const q = ph + i * Math.PI, cq = Math.cos(q);
    const h = -0.55 * Math.sin(q), k = 0.1 + 1.0 * Math.max(0, Math.cos(q + 0.3)) ** 1.5 + 0.1 * Math.max(0, -cq);
    jLeg(p, i, h, k, -(h + k) + 0.35 * Math.max(0, cq));
  }
  // waddle: roll onto the standing leg, twist against the stride
  p.bx = 0.1; p.by = -0.1 * s; p.bz = 0.13 * c;
  jArm(p, 0, 0.55 * s, 0.1, -0.15, -0.5 - 0.3 * Math.max(0, -s));
  jArm(p, 1, -0.55 * s, -0.1, 0.15, -0.5 - 0.3 * Math.max(0, s));
  p.tx = 0.45; p.ty = 0.6 * Math.sin(t * 9);
}
function jakeRun(p, ph, t) {
  const s = Math.sin(ph), c = Math.cos(ph);
  for (const i of [0, 1]) {
    const q = ph + i * Math.PI, cq = Math.cos(q);
    const h = -0.15 - 1.0 * Math.sin(q), k = 0.2 + 1.7 * Math.max(0, Math.cos(q + 0.5)) ** 1.6 + 0.25 * Math.max(0, -cq);
    const sw = Math.max(0, Math.cos(q + 0.3));
    jLeg(p, i, h, k, -(h + k) * (1 - sw) + 0.5 * sw);
  }
  p.bx = 0.32; p.by = -0.15 * s; p.bz = 0.05 * c;
  // arms flung back, flapping in the wind
  jArm(p, 0, 1.1 + 0.25 * Math.sin(ph * 2), 0, -0.45, -0.25);
  jArm(p, 1, 1.1 + 0.25 * Math.sin(ph * 2 + 1), 0, 0.45, -0.25);
  p.tx = -0.9; p.ty = 0.15 * Math.sin(t * 14);
}
function jakeSit(p, t, up) {
  for (const i of [0, 1]) jLeg(p, i, -1.2, 0, 0.9); // on his bottom, stubby legs stuck out in front
  p.bx = -0.12 - 0.3 * up; p.by = 0; p.bz = 0;
  jArm(p, 0, -0.35, 0.15, -0.15, -0.9);
  jArm(p, 1, -0.35, -0.15, 0.15, -0.9);
  p.tx = -0.5; p.ty = 0.7 * Math.sin(t * (up > 0.3 ? 11 : 5)); // tail sweeps the ground, faster when excited
}
function jakeReach(p, i, L) {
  const n = JL[i], h = p[n[0]], k = p[n[1]];
  return L * (J_T * Math.cos(h) + J_S * Math.cos(h + k)) + J_SOLE + 0.03 * Math.abs(Math.sin(h + k + p[n[2]]));
}

const easeOutBack = (u) => 1 + 2.7 * (u - 1) ** 3 + 1.7 * (u - 1) ** 2;
const toward = (o, key, v, w) => { o[key] += (v - o[key]) * w; };
const wrapA = (x) => Math.atan2(Math.sin(x), Math.cos(x));
/**
 * Jake's powers, as a layer over the rest of his pose: `giant` scale, which arm reaches
 * (aimArm), how much of that arm the reach owns (aimW), where it points (mix: 0 = straight up
 * over his head, `lift` back; 1 = the target), how far along it is stretched (reach 0..1), the
 * fist's size and its squash on impact. Same timeline as the physics in main.js — punch:
 * wind-up 0-0.14, stretch 0.14-0.26 (hit), hold, snap back 0.32-0.5; slam: grow 0-0.35 while
 * the arm shoots up into a huge fist, hold it up, swing it down 0.6-0.72 (hit), hold, back
 * 1.0-1.25, shrink by 1.6.
 */
function powerPose(o, act, P) {
  const t = act.t;
  P.giant = 1; P.aimArm = -1; P.aimW = 0; P.reach = 0; P.mix = 1; P.lift = 0; P.fist = 1; P.squash = 0; P.otherFist = 1;
  if (act.kind === "punch") {
    const i = act.arm, side = i ? 1 : -1, n = JA[i];
    const wind = smooth01(clamp01(t / 0.1)) * (1 - smooth01(clamp01((t - 0.12) / 0.06)));
    // wind-up: paw cocked back by the ear, body twisted away
    toward(o, n[0], 0.9, wind); toward(o, n[1], 0, wind); toward(o, n[3], -1.9, wind);
    o.by -= side * 0.45 * wind;
    o.bx -= 0.08 * wind;
    const u = clamp01((t - 0.14) / 0.12), r = clamp01((t - 0.32) / 0.18);
    P.aimArm = i;
    P.aimW = smooth01(clamp01((t - 0.12) / 0.05)) * (1 - smooth01(clamp01((r - 0.7) / 0.3)));
    P.reach = t < 0.26 ? easeOut(u) : 1 - smooth01(r);
    P.fist = 1 + 1.4 * (t < 0.26 ? u : 1 - r);
    P.squash = t >= 0.26 ? Math.max(0, 1 - (t - 0.26) / 0.08) : 0;
    o.by += side * 0.4 * P.aimW;
    o.bx += 0.18 * P.aimW;
    return P;
  }
  // slam: grow giant, shoot one arm up into a huge fist, swing it down in an arc
  P.giant = t < 0.35 ? 1 + 1.6 * easeOutBack(t / 0.35) : t < 1.25 ? 2.6 : 1 + 1.6 * (1 - easeOut(clamp01((t - 1.25) / 0.35)));
  const raise = smooth01(clamp01((t - 0.08) / 0.25)), lean = smooth01(clamp01((t - 0.35) / 0.25));
  const u = clamp01((t - 0.6) / 0.12), r = clamp01((t - 1.0) / 0.25);
  toward(o, "a1x", -1.1, raise); toward(o, "a1e", -1.9, raise); // the other paw clenched at the chest
  P.aimArm = 0;
  P.aimW = smooth01(clamp01((t - 0.06) / 0.12)) * (1 - smooth01(clamp01((r - 0.7) / 0.3)));
  P.mix = u * u;
  P.lift = 0.3 * lean; // pulled back a little before the blow
  P.reach = t < 1 ? raise : 1 - smooth01(r);
  P.fist = 1 + 2.4 * raise * (1 - smooth01(r)) + 0.15 * Math.sin(t * 30) * lean * (1 - u);
  P.otherFist = 1 + 0.4 * raise * (1 - r);
  P.squash = t >= 0.72 ? Math.max(0, 1 - (t - 0.72) / 0.14) : 0;
  const smash = u * (1 - r);
  o.bx += -0.22 * lean * (1 - smash) + 0.4 * smash;
  o.by += 0.25 * smash;
  return P;
}
// where a slamming arm points before the blow: high over his head (body space)
const J_RAISED = new THREE.Vector3(-0.3, 1.55, -0.15);
const _up = new THREE.Vector3(), _dir = new THREE.Vector3();
const _aim = new THREE.Vector3();

/**
 * s: { speed, heading, time, wait (Finn is up somewhere), look (yaw to Finn), lookUp 0..1, talk,
 *      act: null | { kind: "punch" | "slam", t (s since it began), arm, x, y, z (world point for the fist's centre) } }
 */
export function poseJake(j, s, dt) {
  const u = j.userData;
  const a = u.anim || (u.anim = {
    ph: 0, move: 0, run: 0, sit: 0, still: 0, talk: 0, blink: 2, heading: s.heading, bank: 0,
    ears: [0, 1].map(() => ({ x: { x: 0, v: 0 }, z: { x: 0, v: 0 } })),
    o: jPose(), pI: jPose(), pW: jPose(), pR: jPose(), pS: jPose(), tmp: jPose(),
    pw: { giant: 1, aimArm: -1, aimW: 0, reach: 0, mix: 1, lift: 0, fist: 1, squash: 0, otherFist: 1 },
  });
  const k = (rate) => 1 - Math.exp(-rate * dt);
  const spd = s.speed, t = s.time;
  a.move += (clamp01(spd / 9) - a.move) * k(8);
  a.run += (clamp01((spd - 10) / 5) - a.run) * k(5);
  a.still = spd < 0.3 ? a.still + dt : 0;
  const sitT = s.wait || a.still > 2.2 ? 1 : 0;
  a.sit += (sitT - a.sit) * k(sitT > a.sit ? 3.5 : 8);
  a.talk += ((s.talk ? 1 : 0) - a.talk) * k(10);
  const hz = (1.1 + 0.21 * spd) * (1 - a.run) + (1.4 + 0.11 * spd) * a.run;
  a.ph = (a.ph + dt * 2 * Math.PI * hz * Math.min(1, spd / 1.5)) % (2 * Math.PI);

  const o = a.o;
  jakeIdle(a.pI, t);
  jakeWalk(a.pW, a.ph, t);
  jakeRun(a.pR, a.ph, t);
  blend(a.tmp, a.pW, a.pR, a.run, JK);
  blend(o, a.pI, a.tmp, a.move, JK);
  if (a.sit > 0.001) { jakeSit(a.pS, t, s.lookUp); mix(o, a.pS, a.sit * (1 - a.move), JK); }
  o.by += clamp(s.look, -0.6, 0.6) * 0.8 * (1 - a.move); // turn toward Finn when not walking
  if (a.talk > 0.01) {
    const w = a.talk * (1 - 0.7 * a.move);
    o.a1x += (-1.3 + 0.25 * Math.sin(t * 4) - o.a1x) * w;
    o.a1z += (0.35 - o.a1z) * w;
    o.a1e += (-1.1 + 0.3 * Math.sin(t * 5) - o.a1e) * w;
    o.bx += 0.04 * Math.sin(t * 7) * w;
  }
  const P = a.pw;
  if (s.act) powerPose(o, s.act, P);
  else { P.giant = 1; P.aimArm = -1; P.aimW = 0; P.fist = 1; P.squash = 0; P.otherFist = 1; }

  // stretchy legs: longer strides the faster he goes
  const L = 1 + 0.9 * a.run * a.move;
  for (let i = 0; i < 2; i++) {
    const g = u.legs[i], n = JL[i];
    g.thigh.scale.y = L; g.thigh.position.y = (-J_T * L) / 2; g.knee.position.y = -J_T * L;
    g.shin.scale.y = L; g.shin.position.y = (-J_S * L) / 2; g.foot.position.y = -J_S * L;
    g.hip.rotation.x = o[n[0]]; g.knee.rotation.x = o[n[1]]; g.foot.rotation.x = o[n[2]];
  }
  u.hips.position.y = Math.max(jakeReach(o, 0, L), jakeReach(o, 1, L)) + 0.05 * a.run * a.move * Math.abs(Math.sin(a.ph));
  u.body.rotation.set(o.bx, o.by, o.bz);
  u.body.scale.y = 1 + 0.015 * Math.sin(t * 2.2) * (1 - a.move) + 0.05 * a.run;
  u.tail.rotation.set(o.tx, o.ty, 0);
  const dh = Math.atan2(Math.sin(s.heading - a.heading), Math.cos(s.heading - a.heading));
  a.heading = s.heading;
  a.bank += (clamp(dt > 0 ? (-dh / dt) * spd * 0.004 : 0, -0.3, 0.3) - a.bank) * k(8);
  u.rig.rotation.z = a.bank;
  u.rig.scale.setScalar(P.giant);
  u.giant = P.giant;
  // arms last: a reaching arm aims its shoulder straight at the target (in the body's space,
  // so it follows every lean and twist above) and stretches until the paw gets there
  if (P.aimW > 0) j.updateMatrixWorld(true);
  for (let i = 0; i < 2; i++) {
    const A = u.arms[i], m = JA[i];
    let x = o[m[0]], y = o[m[1]], z = o[m[2]], e = o[m[3]], len = J_ARM, sq = 0;
    const f = i === P.aimArm ? P.fist : P.otherFist;
    if (i === P.aimArm && P.aimW > 0) {
      u.body.worldToLocal(_aim.set(s.act.x, s.act.y, s.act.z)).sub(A.sh.position);
      let D = _aim.length() || 1;
      _dir.copy(_aim).divideScalar(D);
      if (P.mix < 1) {
        // swing from overhead to the target: blend the direction and the length, so the fist sweeps an arc
        _up.copy(J_RAISED).setZ(J_RAISED.z - P.lift).sub(A.sh.position);
        const Du = _up.length();
        _dir.lerpVectors(_up.divideScalar(Du), _dir, P.mix).normalize();
        D = Du + (D - Du) * P.mix;
      }
      const w = P.aimW;
      // YXZ order: the arm (hanging along -y) points along dir for x = -acos(-dir.y), y = atan2(dir.x, dir.z)
      x += (-Math.acos(clamp(-_dir.y, -1, 1)) - x) * w;
      y += wrapA(Math.atan2(_dir.x, _dir.z) - y) * w;
      z -= z * w;
      e -= e * w;
      len = J_ARM + Math.max(0, D - J_ARM) * P.reach * w;
      sq = P.squash;
    }
    A.sh.rotation.set(x, y, z);
    A.el.rotation.x = e;
    A.el.position.y = -(len - J_PAW);
    A.noodle.visible = len > J_ARM + 0.02;
    if (A.noodle.visible) A.noodle.scale.y = len - 0.02;
    A.paw.scale.set(f * (1 + 0.25 * sq), f * (1 - 0.3 * sq), f * (1 + 0.25 * sq));
  }
  // ears flop with the bounce and stream back at speed
  for (let i = 0; i < 2; i++) {
    const e = a.ears[i], side = i ? 1 : -1;
    spring(e.x, 0.1 + 1.1 * a.run * a.move + 0.25 * Math.sin(2 * a.ph) * a.move * (1 - a.run) - 0.2 * a.sit * s.lookUp, 11, 0.28, dt);
    spring(e.z, side * (0.05 + 0.25 * a.run * a.move), 11, 0.28, dt);
    u.ears[i].rotation.set(e.x.x, 0, e.z.x);
  }
  a.blink -= dt;
  if (a.blink < -0.12) a.blink = 1.8 + Math.random() * 3.5;
  for (const e of u.eyes) e.scale.y = a.blink < 0 ? 0.12 : 1;
  u.mouth.visible = a.talk > 0.05;
  if (u.mouth.visible) u.mouth.scale.y = 0.15 + 0.85 * a.talk * Math.abs(Math.sin(t * 9)) * (0.6 + 0.4 * Math.sin(t * 2.3));
}

// ── enemies ──────────────────────────────────────────────────────────────────
const SPH_MID = new THREE.SphereGeometry(1, 12, 9);
export const SLIME_COLORS = { grass: 0x6fdc6f, candy: 0xff7ac8, ice: 0x8fe3ff, fire: 0xff7a2a, dark: 0x9b6bff };
/** A jelly drop: wide at the base, glossy, angry. userData.skin is its own material (it flashes when hit). */
export function makeSlime(color) {
  const root = new THREE.Group();
  const spin = group(root, 0, 0.5, 0); // tumbles about its middle when sent flying
  const body = group(spin, 0, -0.5, 0); // squashes and leans from its base
  const skin = toon(color, { thick: OUT });
  const own = skin.clone();
  own.userData = { outlineParameters: skin.userData.outlineParameters };
  lathe(body, [[0.001, 0], [0.6, 0.015], [0.79, 0.12], [0.82, 0.3], [0.74, 0.58], [0.52, 0.86], [0.26, 1.02], [0.001, 1.06]], color, 0, 0, 0,
    { smooth: 18, seg: 20, material: own, keep: true });
  // gloss: a big soft highlight and a small sharp one
  add(body, G.sph, WHITE, 0.33, 0.84, 0.39, 0.16, 0.08, 0.1, { outline: false, rx: -0.5, rz: -0.55 });
  add(body, G.sph, WHITE, 0.5, 0.64, 0.5, 0.045, 0.03, 0.03, { outline: false });
  // one group, few materials: there are dozens of slimes, each draw call counts
  for (const s of [-1, 1]) {
    add(body, SPH_MID, WHITE, s * 0.24, 0.62, 0.62, 0.15, 0.15, 0.12);
    add(body, SPH_MID, BLACK, s * 0.2, 0.6, 0.72, 0.075, 0.08, 0.04, { outline: false });
    add(body, G.sph, WHITE, s * 0.18, 0.63, 0.755, 0.02, 0.02, 0.01, { outline: false });
    add(body, rbox(0.22, 0.05, 0.05, 0.02), BLACK, s * 0.24, 0.79, 0.66, 1, 1, 1, { rz: s * -0.4, outline: false }); // angry brows
  }
  add(body, rbox(0.3, 0.06, 0.05, 0.02), BLACK, 0, 0.4, 0.79, 1, 1, 1, { outline: false });
  add(body, G.cone, WHITE, 0.08, 0.36, 0.8, 0.03, 0.06, 0.02, { rx: Math.PI, outline: false }); // a little fang
  bake(root);
  root.userData = { spin, body, skin: own, base: own.color.clone(), anim: null };
  return root;
}

/**
 * The jelly's animation. e is the slime's state from main.js: st (idle | alert | chase | windup |
 * lunge | recover | hurt | dying), stT (s in that state), onGround, vx, vy, vz, face, hopCd, flash,
 * hp, maxHp, landN / hitN (counters: landed, got hit), tumble (spin rate when sent flying), hx (a seed).
 * It gathers itself before a hop, stretches in flight, wobbles after landing, shrinks as it loses
 * hp, crouches and trembles glowing red before it pounces, reels when dazed and swells up to pop.
 */
export function poseSlime(m, e, dt, t) {
  const u = m.userData;
  const a = u.anim || (u.anim = { jig: 0, jigV: 0, land: e.landN, hit: e.hitN, size: 1, spin: 0 });
  const k = (rate) => 1 - Math.exp(-rate * dt);
  const st = e.st, stT = e.stT;
  if (e.landN !== a.land) { a.land = e.landN; a.jigV -= st === "idle" || st === "chase" ? 6 : 9; }
  if (e.hitN !== a.hit) { a.hit = e.hitN; a.jigV -= 11; }
  let gather = 0;
  if (st === "windup") gather = -0.36 * smooth01(clamp01(stT / 0.3));
  else if (e.onGround && (st === "idle" || st === "chase")) gather = -0.3 * clamp01(1 - e.hopCd / 0.2);
  for (let n = Math.ceil(dt * 120), h = dt / n, i = 0; i < n; i++) {
    a.jigV += (-(a.jig - gather) * 180 - 5 * a.jigV) * h;
    a.jig += a.jigV * h;
  }
  let ys = 1 + a.jig + (e.onGround ? 0 : clamp(e.vy / 8, -0.5, 1) * (st === "lunge" ? 0.3 : 0.16)) + Math.sin(t * 5 + e.hx) * 0.03;
  let xs = 1 / Math.sqrt(Math.max(0.2, ys));
  if (st === "dying") {
    const d = smooth01(clamp01(stT / 0.2));
    xs *= 1 + 0.45 * d;
    ys *= 1 - 0.3 * d;
  }
  a.size += (0.7 + 0.3 * clamp01(e.hp / e.maxHp) - a.size) * k(12);
  m.scale.setScalar(a.size);
  u.body.scale.set(xs, ys, xs);
  // leans back taking off and forward coming down; tumbles when knocked flying
  const fwd = e.vx * Math.sin(e.face) + e.vz * Math.cos(e.face);
  u.body.rotation.x = e.onGround ? 0 : -clamp(e.vy / 10, -1, 1) * clamp(fwd / 8, -1, 1) * 0.35;
  if (!e.onGround && e.tumble) a.spin += e.tumble * dt;
  else a.spin = Math.atan2(Math.sin(a.spin), Math.cos(a.spin)) * (1 - k(14));
  u.spin.rotation.x = a.spin;
  u.body.rotation.z = st === "recover" ? Math.sin(stT * 16) * 0.2 * Math.max(0, 1 - stT / 0.7) : 0;
  u.body.position.x = st === "windup" ? Math.sin(t * 70) * 0.035 * smooth01(clamp01(stT / 0.25)) : 0;
  // white flash when hit; flushing red, pulsing faster, as the pounce comes
  const angry = st === "windup" ? smooth01(clamp01(stT / 0.2)) * (0.55 + 0.3 * Math.sin(stT * (18 + 30 * stT))) : 0;
  u.skin.color.copy(u.base).lerp(ANGRY, angry);
  if (e.flash > 0) u.skin.emissive.setRGB(1, 1, 1);
  else u.skin.emissive.setRGB(0.25 * angry, 0, 0);
}
const ANGRY = new THREE.Color(0xff2a2a);

const shadowGeo = new THREE.CircleGeometry(1, 20);
const shadowMat = noOutline(new THREE.MeshBasicMaterial({
  color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
}));
export function makeShadow(r) {
  const m = new THREE.Mesh(shadowGeo, shadowMat);
  m.rotation.x = -Math.PI / 2;
  m.scale.setScalar(r);
  return m;
}
