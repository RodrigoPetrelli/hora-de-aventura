// The last fight of the game: the Lich in the Caverna dos Ossos (CAVE in lichcave.js), once Finn has
// talked to him there (lich.js starts it). Two bodies, 250 hp each; every area attack marks its ground
// first (hazards.js), and each body gets fiercer at 60% and 30% (shorter warnings, more of everything):
//  Form 0 — in Billy's skin (the hero's body he wore in "The Lich"): he runs Finn down and fights with
//  claws and feet burning with his green fire; little magic.
//   claw     Claws of the Lich: swipes in front of him (fans), one after another, stepping in
//   kick     The Hero's Kick (the kick Billy cast him down with, in "His Hero"): a band, and he flies down it
//   quake    Leap of the Tomb: up in the air, a circle chases Finn, locks, he lands on it and a ring of
//            green fire runs out along the floor (jump it)
//   spikes   Bones of the Earth: both fists into the floor; bands crack toward Finn and bone spikes burst
//            up along them; his fists stay stuck a moment (the time to hit him)
//   bolt     Green Flames (the fire of his hands): fireballs thrown at Finn, a patch burns where each lands
//   inferno  Green Fire of the Dead (below 30%, the moment he gets there and then in the draw): he leaps
//            onto the heap in the middle and sets the whole floor on fire; only the mountains of skulls
//            stand above it: climb one
//  When that body drops he tears Billy's skin off ("Escape from the Citadel") and floats up as the Lich.
//  Form 1 — the Lich himself: magic only.
//   orbs     Flames of Death: volleys of green fireballs
//   breath   Breath of Death (the black gas that killed Prismo, "Wake Up"): a cone of it; it lingers
//   stop     "Stop" (his spoken command, "The Lich"): the cave goes night-still, Finn can't move, the
//            circles marked on him are struck by lightning a moment after he's let go
//   raise    Necromancy (the corpses of his lair, "Mortal Folly"): skeletons climb out of the floor (5 hp)
//   blackfire Black Fire (the fire that ate the Citadel): the outer floor, then the middle
//   comet    Catalyst Comet (60%: the green comet he came to Earth in, "Evergreen"): a huge circle on Finn,
//            shards all over (below 30%)
//   sweep    Green Lightning (60%): bands wheeling round him, one after another
//   fall     "Fall" (below 30%: "Fall. You are alone, child", "Escape from the Citadel"): he rises to the
//            dome, the cave goes dark, souls pour into him; then everything he sees dies. Only the light
//            of the Enchiridion (floating over the heap in the middle) shelters: get to it.
// Both bodies answer too many blows at once with a burst round them (the counter, as the Butler's).
// Beaten, the Lich crumbles to dust ("Mortal Folly") and his spirit is sucked into the Enchiridion;
// the book comes down to Finn: the end of the adventure. If Finn faints, he wakes up at the way in.
// Attack scripts are generators stepped with the physics dt (deterministic under __game.sim).
import * as THREE from "three";
import { makeNpc } from "./npcs.js";
import { toon, noOutline } from "./toon.js";
import { CAVE } from "./lichcave.js";
import { glowTexture, ritualTex } from "./lair.js";
import { FIRE_VS, FIRE_FS, NOISE } from "./flameking.js";
import { boltGeo, shapeBolt } from "./boss.js";
import { makeShadow } from "./characters.js";
import { createHazards, CIRCLE, RING, SECTOR, BAND } from "./hazards.js";
import { G, add, cap, blob, group, bake, decal, ellipse, poly } from "./shapes.js";
import { STR } from "./strings.js";

// hp (per body), sizes (world units) and timings (s); arrays are per phase of each body (100–60%, 60–30%, below 30%)
export const K = {
  hp: [250, 250], phase2: 0.6, phase3: 0.3, heartEvery: 125, tearHearts: 2,
  // form 0: Billy's skin, on foot
  skin: { scale: 1.35, body: 0.85, tall: 4.4, walk: [8.6, 9.8, 11], turn: [6, 7.5, 9] },
  claw: { reps: [2, 3, 4], warn: [0.55, 0.47, 0.4], r: 4.0, half: 1.0, step: 2.4, rest: [0.75, 0.6, 0.5] },
  kick: { warn: [0.66, 0.57, 0.5], w: 1.5, len: 9, speed: 30, reps: [1, 2, 3] },
  quake: { follow: [1.25, 1.1, 0.95], lock: [0.6, 0.52, 0.45], r: 4.4, chase: [10, 11.5, 13], wave: [12, 13.5, 15], daze: [1.4, 1.2, 1.0] },
  spikes: { warn: [0.85, 0.74, 0.65], w: 1.5, bands: [1, 3, 5], spread: 0.4, stuck: [1.2, 1.0, 0.85] },
  bolt: { n: [3, 4, 5], every: [0.5, 0.42, 0.36], warn: [0.95, 0.85, 0.76], r: 2.5, burn: 2.6, burnR: 1.5 },
  inferno: { warn: [4.6, 3.9], safeY: 1.3, burn: 4.4, dmg: 3, rest: 2.2 },
  // form 1: the Lich, floating
  lich: { scale: 1.5, body: 0.95, tall: 5.2, hover: 0.6, glide: [9, 10.5, 12.5] },
  orbs: { n: [5, 7, 9], every: [0.38, 0.31, 0.26], warn: [0.9, 0.8, 0.72], r: 2.6, spread: [0, 1, 1], burn: 2.2, burnR: 1.4 },
  breath: { warn: [0.85, 0.75, 0.66], r: 11, half: 0.55, reps: [1, 2, 3], linger: 2.4 },
  stop: { hold: [1.05, 0.95, 0.85], after: [0.62, 0.55, 0.5], r: 3.2, n: [1, 3, 5] },
  raise: { n: [3, 4, 5], hp: 5, speed: [4.4, 5, 5.6], warn: [0.6, 0.52, 0.46], r: 2.4, max: 6 },
  blackfire: { warn: [1.45, 1.3, 1.15], inner: 8.5, mid: 7.2, gap: 0.55 },
  comet: { warn: [0, 2.0, 1.8], r: 6.8, shards: [0, 5, 10], shardR: 2.3 },
  sweep: { n: [0, 10, 14], every: [0, 0.15, 0.12], warn: 0.78, w: 1.25, step: 0.5 },
  fall: { warn: [6.2, 5.2], safe: 3.6, h: 12.5, rest: 3.2 },
  // the counter: `dmg` taken in a rush (it drains away at dmg/window per second) sets off a burst round him
  counter: { dmg: [7, 6, 5], window: 2.5, warn: 0.62, r: [4.2, 4.6], cd: 6.5 },
};
// what each phase of each body draws from (the bag is shuffled; he never repeats the last one)
const ORDER = [
  [["claw", "kick", "quake", "spikes", "bolt", "claw"], ["claw", "kick", "quake", "spikes", "bolt", "claw", "kick"], ["claw", "kick", "quake", "spikes", "bolt", "claw", "kick", "inferno"]],
  [["orbs", "breath", "stop", "raise", "blackfire"], ["orbs", "breath", "stop", "raise", "blackfire", "comet", "sweep"], ["orbs", "breath", "stop", "raise", "blackfire", "comet", "sweep", "fall"]],
];
const TAU = Math.PI * 2, C = CAVE;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const turnToward = (a, b, max) => a + clamp(wrap(b - a), -max, max);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const lerp = (a, b, k) => a + (b - a) * k;
const $ = (id) => document.getElementById(id);
const GREEN = [0x7dff5a, 0x3ad84a, 0xd8ffc0], DEATH = [0x0a140a, 0x3ad84a, 0x9dff5a], VOID = [0x0a0612, 0x6a2bd6, 0x3ad84a];
const HOT = [[0xb8ff90, 0x16902a], [0xc8ffa8, 0x1eb030], [0xe0ffd0, 0x0e7a1c]]; // green fire: core, edge (by phase)
const additive = (color, o = {}) => noOutline(new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, ...o }));

/** How high the floor is at (x, z) over CAVE.y: the top tier of a mountain of skulls it's on, or 0. */
export function heapTop(x, z) {
  let y = 0;
  for (const h of C.heaps) {
    const d = Math.hypot(x - h.x, z - h.z);
    if (d > h.R) continue;
    for (const t of h.tiers) if (d < t.r && t.y > y) y = t.y;
  }
  return y;
}

// ── models: a skeleton warrior (necromancy) ──
function makeSkeleton() {
  const root = new THREE.Group(), b = group(root, 0, 0, 0), BONE = 0xd6dcc4, RUST = 0x8a8070, DARK = 0x10140e;
  blob(b, [0.17, 0.08, 0.11], 2.2, BONE, 0, 0.95, 0); // pelvis
  cap(b, [0, 0.98, -0.04], [0, 1.52, -0.05], 0.035, BONE); // spine
  for (let i = 0; i < 4; i++) add(b, new THREE.TorusGeometry(0.15 - i * 0.012, 0.022, 4, 10), BONE, 0, 1.46 - i * 0.08, 0.01, 1, 0.75, 1, { rx: Math.PI / 2 });
  cap(b, [-0.21, 1.53, 0], [0.21, 1.53, 0], 0.03, BONE); // collarbones
  cap(b, [0, 1.54, 0], [0, 1.6, 0.01], 0.03, BONE);
  const sk = add(b, G.sph, BONE, 0, 1.72, 0.02, 0.135, 0.135, 0.15);
  add(b, G.sph, BONE, 0, 1.62, 0.07, 0.085, 0.05, 0.085); // the jaw
  // (a decal is drawn in the x, y plane of the skull's parent: the body, so at the skull's height)
  decal(sk, [ellipse(0.042, 0.045, -0.052, 1.73), ellipse(0.042, 0.045, 0.052, 1.73)], DARK, { lift: 0.004 });
  decal(sk, [ellipse(0.015, 0.016, -0.052, 1.73, 10), ellipse(0.015, 0.016, 0.052, 1.73, 10)], 0x9dff5a, { lift: 0.007, emissive: 0x5acc2a });
  decal(sk, poly([[-0.018, 1.69], [0.018, 1.69], [0, 1.66]]), DARK, { lift: 0.004 });
  const arms = [-1, 1].map((s) => {
    const A = group(b, s * 0.22, 1.51, 0);
    cap(A, [0, 0, 0], [0, -0.3, 0.02], 0.03, BONE);
    cap(A, [0, -0.3, 0.02], [0, -0.56, 0.13], 0.026, BONE);
    add(A, G.sph, BONE, 0, -0.6, 0.15, 0.045, 0.05, 0.045);
    if (s > 0) {
      // an old sword, rusty, pointing ahead
      add(A, new THREE.BoxGeometry(0.07, 0.02, 0.82), RUST, 0, -0.61, 0.6);
      add(A, new THREE.BoxGeometry(0.26, 0.05, 0.05), RUST, 0, -0.61, 0.18);
    }
    return A;
  });
  const legs = [-1, 1].map((s) => {
    const L = group(b, s * 0.09, 0.93, 0);
    cap(L, [0, 0, 0], [0, -0.45, 0.02], 0.032, BONE);
    cap(L, [0, -0.45, 0.02], [0, -0.88, -0.02], 0.028, BONE);
    blob(L, [0.05, 0.03, 0.09], 2, BONE, 0, -0.92, 0.04);
    return L;
  });
  bake(root);
  root.userData = { body: b, arms, legs };
  return root;
}

// ── textures ──
function canvasTex(s, draw) {
  const c = document.createElement("canvas");
  c.width = c.height = s;
  draw(c.getContext("2d"), s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/** A scorch mark: a dark blotch with cracks glowing green out of the middle. */
const scorchTexture = () => canvasTex(256, (x, s) => {
  const h = s / 2, g = x.createRadialGradient(h, h, 4, h, h, h);
  g.addColorStop(0, "rgba(4,10,4,0.92)");
  g.addColorStop(0.55, "rgba(8,20,8,0.6)");
  g.addColorStop(1, "rgba(8,20,8,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, s, s);
  x.strokeStyle = "rgba(140,255,110,0.95)";
  x.shadowColor = "#6aff4a";
  x.shadowBlur = 10;
  x.lineCap = x.lineJoin = "round";
  for (let k = 0; k < 7; k++) {
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
});
/** A puff of smoke (soft, white: tinted per point). */
const smokeTexture = () => canvasTex(64, (x, s) => {
  for (let i = 0; i < 6; i++) {
    const px = s / 2 + (Math.random() - 0.5) * s * 0.3, py = s / 2 + (Math.random() - 0.5) * s * 0.3, r = s * (0.22 + Math.random() * 0.2);
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, "rgba(255,255,255,0.5)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, s, s);
  }
});

// ── shaders: the burning floor (green fire), the dark orb of "Fall", smoke ──
const SEA_VS = `
varying vec2 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const SEA_FS = `
uniform float uTime;
uniform float uFade;
uniform float uWarn;
uniform vec3 uCore;
uniform vec3 uEdge;
uniform vec3 uClip;
varying vec2 vW;
${NOISE}
void main() {
  float d = length(vW - uClip.xy);
  if (d > uClip.z) discard;
  float n = vnoise(vW * 0.35 + vec2(0.0, -uTime * 1.6), 1e4) * 0.6 + vnoise(vW * 0.9 + vec2(uTime * 0.7, -uTime * 2.3), 1e4) * 0.4;
  // the warning: veins of green light creeping over the floor; the fire: flat flames everywhere
  float veins = smoothstep(0.46, 0.5, n) * (1.0 - smoothstep(0.5, 0.56, n));
  vec3 warn = uEdge * veins * (0.6 + 0.4 * sin(uTime * 9.0)) * uWarn;
  vec3 fire = mix(uEdge * 0.8, uCore, smoothstep(0.62, 0.95, n)) * (0.18 + 0.55 * n) * uFade;
  gl_FragColor = vec4(warn + fire, 1.0);
  #include <colorspace_fragment>
}`;
const ORB_VS = `
varying vec3 vP;
varying vec3 vN;
varying vec3 vV;
void main() {
  vP = position;
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const ORB_FS = `
uniform float uTime;
varying vec3 vP;
varying vec3 vN;
varying vec3 vV;
${NOISE}
void main() {
  // a ball of nothing: black in the middle, a rim of sick green fire swirling round it
  float n = vnoise(vP.xy * 3.0 + vec2(uTime * 1.3, -uTime * 2.1), 1e4) * 0.5 + vnoise(vP.zy * 4.0 + vec2(-uTime * 1.7, uTime * 0.9), 1e4) * 0.5;
  float rim = 1.0 - abs(dot(normalize(vN), normalize(vV)));
  float k = smoothstep(0.35, 1.0, rim + (n - 0.5) * 0.5);
  vec3 c = mix(vec3(0.0), vec3(0.35, 1.0, 0.3), k) + vec3(0.8, 1.0, 0.7) * pow(k, 5.0);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;
const SMOKE_VS = `
attribute float alpha;
attribute float size;
attribute vec3 tint;
uniform float uH;
varying float vA;
varying vec3 vC;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vA = alpha;
  vC = tint;
  gl_PointSize = size * projectionMatrix[1][1] * uH / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const SMOKE_FS = `
uniform sampler2D map;
varying float vA;
varying vec3 vC;
void main() {
  float a = texture2D(map, gl_PointCoord).a * vA;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vC, a);
}`;

/**
 * api (main.js): player, hurt(n, nx, nz, kind), kill() (Finn dies on the spot: "Fall"), burst(x, y, z,
 * n, colors, speed, up, g, life), fx, sfx, shake, freeze, dropHeart(x, y, z), onStart() (Jake says so),
 * onInferno() / onFall() (the first time: Jake shouts where to go), onWin() (true the first time),
 * onBook() (Finn took the Enchiridion back: the end).
 */
export function createLichBoss(scene, api) {
  const pl = api.player.pos, Y = C.y;
  // ── his two bodies (their own materials: they flash white when hit) ──
  function own(model) {
    const map = new Map();
    model.traverse((o) => {
      if (!o.isMesh) return;
      let m = map.get(o.material);
      if (!m) {
        m = o.material.clone();
        m.userData = { ...o.material.userData };
        if (o.material.onBeforeCompile) m.onBeforeCompile = o.material.onBeforeCompile;
        map.set(o.material, m);
      }
      o.material = m;
    });
    const mats = [...map.values()].filter((m) => m.emissive);
    return { mats, base: mats.map((m) => m.emissive.clone()) };
  }
  const skin = makeNpc("lich"), lich = makeNpc("lichTrue");
  skin.scale.setScalar(K.skin.scale);
  lich.scale.setScalar(K.lich.scale);
  const skinM = own(skin), lichM = own(lich);
  skin.visible = lich.visible = false;
  scene.add(skin, lich);
  const shadow = makeShadow(1.0);
  shadow.visible = false;
  scene.add(shadow);
  // a bubble of green fire while he's untouchable (raging between phases, tearing the skin off)
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), additive(0x4aff4a, { opacity: 0.22, side: THREE.DoubleSide }));
  bubble.visible = false;
  scene.add(bubble);
  // green fire in his hands while he works magic
  const handGlow = new THREE.SphereGeometry(1, 10, 8), handMat = additive(0x8dff5a, { opacity: 0.9 });
  const hands = [skin, lich].map((m) => m.userData.arms.map((A) => {
    const g = new THREE.Mesh(handGlow, handMat);
    g.position.set(0, m === skin ? -0.72 : -0.72, 0.06);
    g.scale.setScalar(0.001);
    A.el.add(g);
    return g;
  }));

  // ── green fire: flame columns (instanced: the flame and its core), rings of fire, the burning floor ──
  const FT = { value: 0 }, FC = { value: new THREE.Color(HOT[0][0]) }, FE = { value: new THREE.Color(HOT[0][1]) };
  const fireMat = (rep) => noOutline(new THREE.ShaderMaterial({
    vertexShader: FIRE_VS, fragmentShader: FIRE_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: FT, uRep: { value: rep }, uCore: FC, uEdge: FE },
  }));
  const FN = 180, colMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.62, 1, 1, 16, 1, true).translate(0, 0.5, 0), fireMat(7), FN * 2);
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _e = new THREE.Euler();
  for (let i = 0; i < FN * 2; i++) { colMesh.setMatrixAt(i, _m4.makeScale(0, 0, 0)); colMesh.setColorAt(i, _c.setRGB(0, 0, 0)); }
  colMesh.frustumCulled = false;
  colMesh.visible = false;
  colMesh.renderOrder = 5;
  scene.add(colMesh);
  const cols = [];
  for (let i = 0; i < FN; i++) cols.push({ on: false, shown: false, t: 0, life: 1, x: 0, y: 0, z: 0, r: 1, h: 1, rise: 0.12, hot: 1 });
  let colNext = 0;
  /** A column of green flame r wide, h tall, standing `life` s after `delay` (on the floor, or at y). */
  function flameCol(x, z, r, h, life, delay = 0, hot = 1, rise = 0.12, y = Y) {
    for (let n = 0; n < FN; n++) {
      const c = cols[colNext];
      colNext = (colNext + 1) % FN;
      if (c.on) continue;
      Object.assign(c, { on: true, t: -delay, life, x, y, z, r, h, rise, hot });
      return c;
    }
    return null;
  }
  const WN = 4, waves = [];
  const waveGeo = new THREE.CylinderGeometry(1, 1, 1, 72, 1, true).translate(0, 0.5, 0);
  for (let i = 0; i < WN; i++) {
    const m = new THREE.Mesh(waveGeo, fireMat(24));
    m.visible = false;
    m.frustumCulled = false;
    m.renderOrder = 5;
    scene.add(m);
    waves.push({ on: false, m, x: 0, z: 0, r: 0, pr: 0, speed: 12, max: 60, hit: false, t: 0 });
  }
  /** A ring of green fire running out along the floor from (x, z) (jump it; up on a heap is safe). */
  function wave(x, z, r0, speed, delay = 0.25) {
    const w = waves.find((k) => !k.on) || waves[0];
    Object.assign(w, { on: true, x, z, r: r0, pr: r0, speed, max: C.wall + Math.hypot(x - C.x, z - C.z) + 1, hit: false, t: -delay });
    later(delay, () => api.sfx("whoosh"));
  }
  const seaMat = noOutline(new THREE.ShaderMaterial({
    vertexShader: SEA_VS, fragmentShader: SEA_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uTime: FT, uFade: { value: 0 }, uWarn: { value: 0 }, uCore: FC, uEdge: FE, uClip: { value: new THREE.Vector3(C.x, C.z, C.wall + 0.5) } },
  }));
  const sea = new THREE.Mesh(new THREE.CircleGeometry(C.wall + 0.5, 72).rotateX(-Math.PI / 2), seaMat);
  sea.position.set(C.x, Y + 0.1, C.z);
  sea.visible = false;
  sea.renderOrder = 4;
  scene.add(sea);
  const SEA = { warn: 0, t: 9, life: 4 }; // warn: 0..1 while the inferno is coming; t: since it caught

  // ── fireballs (instanced: the flame and its core), the comet, bone spikes ──
  const BN = 30, ballMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 9), additive(0xffffff, { opacity: 0.9 }), BN * 2);
  for (let i = 0; i < BN * 2; i++) { ballMesh.setMatrixAt(i, _m4.makeScale(0, 0, 0)); ballMesh.setColorAt(i, _c.setRGB(0, 0, 0)); }
  ballMesh.frustumCulled = false;
  ballMesh.visible = false;
  ballMesh.renderOrder = 5;
  scene.add(ballMesh);
  const balls = [];
  for (let i = 0; i < BN; i++) balls.push({ on: false, shown: false, t: 0, dur: 1, x0: 0, y0: 0, z0: 0, x1: 0, y1: 0, z1: 0, arc: 6, s: 1, x: 0, y: 0, z: 0 });
  /** A green fireball from (x0, y0, z0) landing on (x1, y1, z1) in `dur` s, lobbed over `arc` (0: straight). */
  function ball(x0, y0, z0, x1, y1, z1, dur, arc, s = 1) {
    const b = balls.find((k) => !k.on);
    if (b) Object.assign(b, { on: true, t: 0, dur, x0, y0, z0, x1, y1, z1, arc, s, x: x0, y: y0, z: z0 });
  }
  const SPN = 140, spikeMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(0.3, 1.9, 5).translate(0, 0.95, 0), toon(0xdfe4cf, { flat: true, outline: false }), SPN);
  for (let i = 0; i < SPN; i++) spikeMesh.setMatrixAt(i, _m4.makeScale(0, 0, 0));
  spikeMesh.frustumCulled = false;
  spikeMesh.visible = false;
  scene.add(spikeMesh);
  const spikes = [];
  for (let i = 0; i < SPN; i++) spikes.push({ on: false, shown: false, t: 0, life: 1, x: 0, y: 0, z: 0, s: 1, rx: 0, rz: 0, ry: 0, k: 0 });
  let spNext = 0;
  function spike(x, z, s, life, delay = 0) {
    for (let n = 0; n < SPN; n++) {
      const k = spikes[spNext];
      spNext = (spNext + 1) % SPN;
      if (k.on) continue;
      const q = clampIn(x, z, C.wall - 0.6);
      Object.assign(k, { on: true, t: -delay, life, x: q.x, y: Y + heapTop(q.x, q.z), z: q.z, s, ry: Math.random() * TAU, rx: (Math.random() - 0.5) * 0.6, rz: (Math.random() - 0.5) * 0.6, k: 0 });
      return k;
    }
    return null;
  }
  // the Catalyst Comet: a green ball of fire with a long tail, falling out of the dome
  const comet = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), noOutline(new THREE.ShaderMaterial({ vertexShader: ORB_VS, fragmentShader: ORB_FS, fog: false, uniforms: { uTime: FT } })));
  const cometGlow = new THREE.Sprite(noOutline(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x6aff4a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
  comet.visible = cometGlow.visible = false;
  comet.renderOrder = cometGlow.renderOrder = 6;
  scene.add(comet, cometGlow);
  const COMET = { on: false, t: 0, dur: 1, x0: 0, y0: 0, z0: 0, x: 0, z: 0 };

  // ── glow: soft additive motes in one Points mesh; smoke: dark puffs (the gas, the black fire) ──
  const GN = 800, gPos = new Float32Array(GN * 3), gCol = new Float32Array(GN * 3), motes = [];
  for (let i = 0; i < GN; i++) motes.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0, g: 0, b: 0, drag: 0, tx: null });
  const gGeo = new THREE.BufferGeometry();
  gGeo.setAttribute("position", new THREE.BufferAttribute(gPos, 3).setUsage(THREE.DynamicDrawUsage));
  gGeo.setAttribute("color", new THREE.BufferAttribute(gCol, 3).setUsage(THREE.DynamicDrawUsage));
  const gPts = new THREE.Points(gGeo, noOutline(new THREE.PointsMaterial({ size: 0.8, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
  gPts.frustumCulled = false;
  gPts.visible = false;
  gPts.renderOrder = 6;
  scene.add(gPts);
  let gNext = 0, gAny = false;
  const _gc = new THREE.Color();
  /** One mote at (x, y, z) drifting (vx, vy, vz), slowed by `drag`, fading out over `life` s. */
  function glow(x, y, z, color, vx = 0, vy = 0, vz = 0, life = 0.8, drag = 1.5) {
    const m = motes[gNext];
    gNext = (gNext + 1) % GN;
    _gc.setHex(color);
    Object.assign(m, { life, max: life, x, y, z, vx, vy, vz, r: _gc.r, g: _gc.g, b: _gc.b, drag, tx: null });
    gAny = true;
    return m;
  }
  /** A mote pulled toward `to` (a Vector3) until it gets there (souls flowing into him). */
  function soul(x, y, z, color, to, life = 2) {
    const m = glow(x, y, z, color, 0, 2, 0, life, 0);
    m.tx = to;
  }
  function glowBurst(x, y, z, n, colors, speed = 4, life = 0.8, up = 0) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, e = Math.random() * 2 - 1, c = Math.sqrt(1 - e * e), v = speed * (0.4 + Math.random() * 0.6);
      glow(x, y, z, colors[i % colors.length], Math.cos(a) * c * v, e * v * 0.6 + up, Math.sin(a) * c * v, life * (0.6 + Math.random() * 0.6));
    }
  }
  /** Motes shot outward along the floor from a ring of radius r round (x, z). */
  function glowRing(x, z, r, n, colors, y = Y) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, s = 3 + Math.random() * 3;
      glow(x + Math.sin(a) * r * 0.3, y + 0.4 + Math.random() * 0.6, z + Math.cos(a) * r * 0.3, colors[i % colors.length], Math.sin(a) * s * r * 0.25, 0.5 + Math.random(), Math.cos(a) * s * r * 0.25, 0.7, 2.2);
    }
  }
  const count = (rate, dt) => Math.floor(rate * dt + Math.random());
  function stepGlow(dt) {
    if (!gAny) { gPts.visible = false; return; }
    let live = false;
    for (let i = 0; i < GN; i++) {
      const m = motes[i], k = i * 3;
      if (m.life <= 0) { if (gCol[k] || gCol[k + 1] || gCol[k + 2]) gCol.fill(0, k, k + 3); continue; }
      m.life -= dt;
      if (m.tx) {
        // pulled in, faster and faster, spiralling a little
        const dx = m.tx.x - m.x, dy = m.tx.y - m.y, dz = m.tx.z - m.z, d = Math.hypot(dx, dy, dz) || 1, sp = 4 + (1 - m.life / m.max) * 26;
        m.vx += ((dx / d) * sp - m.vx) * Math.min(1, 4 * dt) + (-dz / d) * 6 * dt;
        m.vy += ((dy / d) * sp - m.vy) * Math.min(1, 4 * dt);
        m.vz += ((dz / d) * sp - m.vz) * Math.min(1, 4 * dt) + (dx / d) * 6 * dt;
        if (d < 0.6) m.life = 0;
      } else {
        const d = Math.max(0, 1 - m.drag * dt);
        m.vx *= d; m.vy *= d; m.vz *= d;
      }
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
  const SN = 260, sPos = new Float32Array(SN * 3), sA = new Float32Array(SN), sSize = new Float32Array(SN), sTint = new Float32Array(SN * 3), puffs = [];
  for (let i = 0; i < SN; i++) puffs.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s0: 1, s1: 2, a: 0.6 });
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3).setUsage(THREE.DynamicDrawUsage));
  sGeo.setAttribute("alpha", new THREE.BufferAttribute(sA, 1).setUsage(THREE.DynamicDrawUsage));
  sGeo.setAttribute("size", new THREE.BufferAttribute(sSize, 1).setUsage(THREE.DynamicDrawUsage));
  sGeo.setAttribute("tint", new THREE.BufferAttribute(sTint, 3).setUsage(THREE.DynamicDrawUsage));
  const smokeMat = noOutline(new THREE.ShaderMaterial({ vertexShader: SMOKE_VS, fragmentShader: SMOKE_FS, transparent: true, depthWrite: false, fog: false, uniforms: { map: { value: smokeTexture() }, uH: { value: 500 } } }));
  const sPts = new THREE.Points(sGeo, smokeMat);
  sPts.frustumCulled = false;
  sPts.visible = false;
  sPts.renderOrder = 5;
  scene.add(sPts);
  let sNext = 0, sAny = false;
  /** A puff of dark smoke at (x, y, z), growing from s0 to s1 wide over `life` s. */
  function smoke(x, y, z, vx, vy, vz, life, s0, s1, a = 0.6, hex = 0x0c0a10) {
    const i = sNext;
    sNext = (i + 1) % SN;
    Object.assign(puffs[i], { life, max: life, x, y, z, vx, vy, vz, s0, s1, a });
    _gc.setHex(hex);
    sTint.set([_gc.r, _gc.g, _gc.b], i * 3);
    sAny = true;
  }
  function stepSmoke(dt) {
    if (!sAny) { sPts.visible = false; return; }
    let live = false;
    for (let i = 0; i < SN; i++) {
      const p = puffs[i];
      if (p.life <= 0) { sA[i] = 0; continue; }
      p.life -= dt;
      const d = Math.max(0, 1 - 1.2 * dt);
      p.vx *= d; p.vy *= d; p.vz *= d;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const u = 1 - p.life / p.max;
      sPos[i * 3] = p.x; sPos[i * 3 + 1] = p.y; sPos[i * 3 + 2] = p.z;
      sSize[i] = lerp(p.s0, p.s1, Math.sqrt(u));
      sA[i] = p.a * Math.min(1, u * 6) * (1 - u);
      live = true;
    }
    sAny = live;
    sPts.visible = live;
    for (const k of ["position", "alpha", "size", "tint"]) sGeo.attributes[k].needsUpdate = true;
  }

  // ── lightning: ribbons turned to the camera (a bright core, a faint halo) from a point to a point ──
  const ARCS = 10, SEG = 10, arcs = [];
  const arcGeo = () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(ARCS * SEG * 6 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    return g;
  };
  const arcCore = new THREE.Mesh(arcGeo(), additive(0xe0ffd0, { side: THREE.DoubleSide }));
  const arcHalo = new THREE.Mesh(arcGeo(), additive(0x3aff4a, { opacity: 0.5, side: THREE.DoubleSide }));
  for (const m of [arcCore, arcHalo]) { m.frustumCulled = false; m.renderOrder = 6; m.visible = false; scene.add(m); }
  for (let i = 0; i < ARCS; i++) arcs.push({ t: 1, life: 0, a: new THREE.Vector3(), b: new THREE.Vector3(), j: 0.6, re: 0, pts: [...Array(SEG + 1)].map(() => new THREE.Vector3()), w: 1 });
  /** A crackling bolt from a to b for `life` s (jitter j), `w` its width. */
  function zap(a, b, life = 0.3, j = 0.7, w = 1) {
    const z = arcs.find((k) => k.t >= k.life) || arcs[0];
    z.a.copy(a);
    z.b.copy(b);
    Object.assign(z, { t: 0, life, j, re: 0, w });
  }
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _v = new THREE.Vector3(), _w = new THREE.Vector3();
  function drawArcs(dt, cam) {
    let any = false;
    const A1 = arcCore.geometry.attributes.position, A2 = arcHalo.geometry.attributes.position;
    let o = 0;
    for (const z of arcs) {
      z.t += dt;
      const on = z.t < z.life;
      if (on) {
        any = true;
        if ((z.re -= dt) <= 0) {
          z.re = 0.05;
          for (let i = 0; i <= SEG; i++) {
            const t = i / SEG, k = Math.sin(t * Math.PI) * z.j;
            z.pts[i].lerpVectors(z.a, z.b, t).add(_v.set((Math.random() - 0.5) * k, (Math.random() - 0.5) * k, (Math.random() - 0.5) * k));
          }
        }
      }
      for (let i = 0; i < SEG; i++) {
        for (const [attr, w] of [[A1, 0.06], [A2, 0.28]]) {
          const arr = attr.array;
          if (!on) { arr.fill(0, o, o + 18); continue; }
          _a.copy(z.pts[i]);
          _b.copy(z.pts[i + 1]);
          _w.subVectors(_b, _a).cross(_v.subVectors(cam, _a)).normalize().multiplyScalar(w * z.w * (1 - (z.t / z.life) * 0.5));
          const q = [_a.x - _w.x, _a.y - _w.y, _a.z - _w.z, _a.x + _w.x, _a.y + _w.y, _a.z + _w.z, _b.x + _w.x, _b.y + _w.y, _b.z + _w.z, _b.x - _w.x, _b.y - _w.y, _b.z - _w.z];
          let p = o;
          for (const k of [0, 1, 2, 0, 2, 3]) { arr[p++] = q[k * 3]; arr[p++] = q[k * 3 + 1]; arr[p++] = q[k * 3 + 2]; }
        }
        o += 18;
      }
    }
    arcCore.visible = arcHalo.visible = any;
    if (any) A1.needsUpdate = A2.needsUpdate = true;
  }
  // bolts of green lightning straight down out of the dark ("Stop")
  const skyBolts = [0, 1, 2, 3, 4].map(() => {
    const m = new THREE.Mesh(boltGeo(), additive(0xd8ffc0, { side: THREE.DoubleSide }));
    m.visible = false;
    m.frustumCulled = false;
    scene.add(m);
    return { m, t: 1 };
  });
  let boltNext = 0;
  function skyBolt(x, z, y = Y) {
    const b = skyBolts[boltNext];
    boltNext = (boltNext + 1) % skyBolts.length;
    shapeBolt(b.m.geometry, x, y, Y + 19, z);
    b.t = 0;
  }

  // ── sigils (spinning ritual circles), scorch marks ──
  const sigGeo = new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2);
  const sigMat = () => noOutline(new THREE.MeshBasicMaterial({ map: ritualTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  const sigils = [];
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(sigGeo, sigMat());
    m.visible = false;
    m.renderOrder = 1.6;
    scene.add(m);
    sigils.push({ m, t: 0, life: 0, r: 1, spin: 2 });
  }
  function sigilAt(x, z, r, life, color, y = Y, spin = 2) {
    const s = sigils.find((k) => k.t >= k.life) || sigils[0];
    Object.assign(s, { t: 0, life, r, spin });
    s.m.position.set(x, y + 0.07, z);
    s.m.material.color.setHex(color);
    return s;
  }
  const bossSigil = new THREE.Mesh(sigGeo, sigMat());
  bossSigil.visible = false;
  bossSigil.renderOrder = 1.6;
  scene.add(bossSigil);
  const SIG = { k: 0 };
  const scGeo = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), scTex = scorchTexture(), scorches = [];
  for (let i = 0; i < 18; i++) {
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
    const q = clampIn(x, z, C.wall - 0.5);
    Object.assign(s, { t: 0, life });
    s.m.position.set(q.x, Y + 0.04 + heapTop(q.x, q.z), q.z);
    s.m.rotation.y = Math.random() * TAU;
    s.m.scale.set(r, 1, r);
  }

  // ── "Fall": the dark orb over his hands, the shock of it, the Enchiridion's light; the words on screen ──
  const orb = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), noOutline(new THREE.ShaderMaterial({ vertexShader: ORB_VS, fragmentShader: ORB_FS, fog: false, uniforms: { uTime: FT } })));
  const orbGlow = new THREE.Sprite(noOutline(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x4aff3a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
  orb.visible = orbGlow.visible = false;
  orb.renderOrder = orbGlow.renderOrder = 7;
  scene.add(orb, orbGlow);
  const shock = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 18), additive(0x3aff4a, { opacity: 0.5, side: THREE.DoubleSide }));
  const shockDark = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 18), noOutline(new THREE.MeshBasicMaterial({ color: 0x020402, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.BackSide, fog: false })));
  shock.visible = shockDark.visible = false;
  shock.renderOrder = 7;
  shockDark.renderOrder = 6.5;
  scene.add(shock, shockDark);
  const bigSigil = new THREE.Mesh(new THREE.CircleGeometry(C.wall + 1, 72).rotateX(-Math.PI / 2), noOutline(new THREE.MeshBasicMaterial({ map: ritualTex(), color: 0x3aff4a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
  bigSigil.position.set(C.x, Y + 0.09, C.z);
  bigSigil.visible = false;
  bigSigil.renderOrder = 1.7;
  scene.add(bigSigil);
  // the Enchiridion's light: a dome of gold over the heap in the middle, a column up to the dome
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, 0, TAU, 0, Math.PI / 2), additive(0xffe8a0, { opacity: 0.25, side: THREE.DoubleSide }));
  const column = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 24, 1, true).translate(0, 0.5, 0), additive(0xfff0c0, { opacity: 0.18, side: THREE.DoubleSide }));
  const holyRing = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 56).rotateX(-Math.PI / 2), additive(0xffe08a, { opacity: 0.9, side: THREE.DoubleSide }));
  dome.visible = column.visible = holyRing.visible = false;
  dome.renderOrder = column.renderOrder = holyRing.renderOrder = 6;
  scene.add(dome, column, holyRing);
  const FALL = { on: false, t: 0, warn: 5, x: 0, z: 0, k: 0, dark: 0, blast: 9, word: false };
  const HOLY = { k: 0, flash: 0 };
  const word = $("lichWord"), flashEl = $("lichFlash"), stopEl = $("lichStop");
  function screenFlash(kind) {
    flashEl.className = "";
    void flashEl.offsetWidth; // restart the animation
    flashEl.className = kind;
  }
  function showWord(text, kind = "") {
    word.textContent = text;
    word.className = "";
    void word.offsetWidth;
    word.className = "show " + kind;
  }

  // ── skeletons (necromancy) ──
  const skels = [];
  for (let i = 0; i < K.raise.max; i++) {
    const m = makeSkeleton();
    m.visible = false;
    scene.add(m);
    const sh = makeShadow(0.45);
    sh.visible = false;
    scene.add(sh);
    const e = { on: false, dead: true, active: true, isBoss: false, st: "rise", t: 0, x: 0, y: Y, z: 0, px: 0, py: Y, pz: 0, face: 0, pface: 0, flash: 0, hp: K.raise.hp, hz: null, model: m, shadow: sh, seed: i * 1.7, floor: Y, kx: 0, kz: 0, stride: 0 };
    e.hurt = (n, nx, nz) => hurtSkel(e, n, nx, nz);
    skels.push(e);
  }

  // ── the Enchiridion, won back ──
  const reward = { on: false, t: 0, x: C.x, y: Y + 1.4, z: C.z };

  // ── HUD: name, hp bar, cast bar, speech (shared by all the bosses) ──
  let sayTimer = 0;
  function say(text, secs = 3) {
    const el = $("bossSay");
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(sayTimer);
    sayTimer = setTimeout(() => el.classList.remove("show"), secs * 1000);
  }
  function hud(on) {
    if (on) $("bossName").textContent = STR.lich.boss[B.form];
    $("boss").hidden = !on;
    document.body.classList.toggle("bossOn", on);
    document.body.classList.toggle("bossLich", on);
    if (!on) { $("bossSay").classList.remove("show"); $("bossCast").hidden = true; }
  }
  let hpShown = -1, hpFill = 1;
  function hudHp(dt) {
    let f = Math.max(0, B.hp / K.hp[B.form]);
    if (B.refill) f = hpFill = Math.min(f, hpFill + dt * 0.8); // the new body's bar fills up
    if (f === hpShown) return;
    hpShown = f;
    $("bossHp").style.width = f * 100 + "%";
    $("bossLag").style.width = f * 100 + "%";
    $("bossPhase").textContent = STR.lich.phase[B.form][B.phase];
  }

  // ── state ──
  // st: off (not fighting) | intro (Finn talked to him) | fight | gloat (Finn fainted) | down (just
  // lost: crumbling) | rest (after losing: the book waits for Finn)
  // form: 0 in Billy's skin, 1 the Lich. air: form 0 in the air (jumps); h: form 1's hover height.
  const B = {
    isBoss: true, active: true, dead: true, model: skin, floor: Y,
    st: "off", form: 0, x: C.x, y: Y, z: C.z, px: C.x, py: Y, pz: C.z, air: 0, h: 0, goalH: 0, hRate: 4, vx: 0, vz: 0, kx: 0, kz: 0, face: 0, pface: 0,
    goal: { on: false, x: C.x, z: C.z }, speed: 8, faceLock: null, dash: null, stride: 0, side: 1, jump: false,
    hp: K.hp[0], dropAcc: 0, phase: 0, nextPhase: 0, armor: false, hidden: false, flash: 0, hurtT: 0, voice: 0, saidT: 0,
    pose: "idle", poseT: 0, cast: null, script: null, heat: 0, counterCd: 0, infernos: 0, falls: 0, stopT: 0, refill: false, tearT: 0,
    only: null, // debug: always this attack
  };
  const HZ = createHazards(scene, {
    player: api.player, y: Y, center: C, reach: C.r, color: 0xff3a3a, clip: C.wall - 0.2, n: 60, high: 5.5, // (up on a heap is no way out)
    live: () => B.st === "fight",
    hit(h, nx, nz) {
      api.hurt(h.dmg || 1, nx, nz, "dark");
      api.burst(pl.x, pl.y + 1, pl.z, 10, DEATH, 4, 5);
    },
  });
  const hazard = HZ.add, clampIn = HZ.clampIn, away = HZ.away;
  const timers = [];
  const later = (s, fn) => timers.push({ t: s, fn });
  const say2 = (key) => say(pick(STR.lich.shout[key]), 2.2);
  const setPose = (p) => { if (B.pose !== p) { B.pose = p; B.poseT = 0; } };
  function castBar(key, dur) {
    B.cast = { name: STR.lich.cast[key], t: 0, dur };
    $("bossCastName").textContent = B.cast.name;
    $("bossCast").hidden = false;
  }
  const inCave = (p = pl) => Math.hypot(p.x - C.x, p.z - C.z) < C.wall + 1 && p.y > Y - 3 && p.y < Y + 25;
  const hittable = () => B.st === "fight" && !B.armor && !B.hidden && B.hp > 0 && B.air < 2.5 && B.h < 2.2;
  const toFinn = (x = B.x, z = B.z) => Math.atan2(pl.x - x, pl.z - z);
  const distFinn = () => Math.hypot(pl.x - B.x, pl.z - B.z);
  const finnFloor = () => Y + heapTop(pl.x, pl.z); // (a marker on Finn up a heap is drawn up there)
  const tall = () => (B.form ? K.lich.tall : K.skin.tall);
  const bodyR = () => (B.form ? K.lich.body : K.skin.body);
  /** Where Finn will be in `s` seconds (inside the floor). */
  function lead(s, r = C.r) {
    const v = api.player.vel;
    return clampIn(pl.x + v.x * s, pl.z + v.z * s, r);
  }
  /** A spot on the floor (not up a heap). */
  function anywhere(r = C.r - 1) {
    for (let n = 0; n < 40; n++) {
      const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * r, x = C.x + Math.sin(a) * d, z = C.z + Math.cos(a) * d;
      if (heapTop(x, z) === 0) return { x, z };
    }
    return { x: C.x + 6, z: C.z };
  }
  /** How long a band from (x, z) heading `a` runs before it meets the wall. */
  function bandLen(x, z, a, R = C.wall - 0.6) {
    const dx = x - C.x, dz = z - C.z, ux = Math.sin(a), uz = Math.cos(a);
    const b = dx * ux + dz * uz, c = dx * dx + dz * dz - R * R;
    return Math.max(2, -b + Math.sqrt(Math.max(0, b * b - c)));
  }
  /** A point in front of him (fwd) and to his side. */
  function fromHim(fwd, side = 0) {
    const f = B.face, ux = Math.sin(f), uz = Math.cos(f);
    return { x: B.x + ux * fwd + uz * side, z: B.z + uz * fwd - ux * side };
  }
  /** Where his hand (side -1 / 1) is, about (the release point of what he throws). */
  function handAt(side) {
    if (!B.model.visible) { const q = fromHim(0.6, -side * 0.9); return new THREE.Vector3(q.x, B.y + tall() * 0.7, q.z); } // (not drawn: about there)
    const A = B.model.userData.arms[side > 0 ? 1 : 0];
    B.model.updateMatrixWorld(true);
    return A.el.localToWorld(new THREE.Vector3(0, -0.72, 0.06));
  }
  const puff = (x, y, z, n = 18) => {
    api.burst(x, y, z, n, DEATH, 5, 4, 0.3, 0.8);
    api.fx.ring(x, Y + heapTop(x, z), z, 3, 0x6aff4a, 0.35);
  };

  // ── fire that burns while it stands (patches, the gas, the burning floor after the inferno) ──
  const burns = [];
  function burn(x, z, r, life, delay = 0, kind = "fire") {
    burns.push({ x, z, r, t: -delay, life, kind, y: Y + heapTop(x, z) });
  }
  function stepBurns(dt) {
    for (let i = burns.length - 1; i >= 0; i--) {
      const z = burns[i];
      if (!z) continue; // a burn that made Finn faint cleared them all (finnDown)
      z.t += dt;
      if (z.t > z.life) { burns.splice(i, 1); continue; }
      if (z.t < 0 || B.st !== "fight" || api.player.dead > 0 || pl.y > z.y + (z.kind === "gas" ? 2.2 : 1.2) || pl.y < z.y - 0.5) continue;
      const dx = pl.x - z.x, dz = pl.z - z.z, d = Math.hypot(dx, dz);
      if (d < z.r + 0.3) api.hurt(1, dx / (d || 1), dz / (d || 1), "dark");
    }
  }
  function patch(x, z, r, life, delay = 0) {
    burn(x, z, r, life, delay);
    flameCol(x, z, r * 0.95, 1.3 + r * 0.4, life, delay, 0.75, 0.2, Y + heapTop(x, z));
  }

  // ── what each attack does when it lands ──
  function clawHit(h) {
    for (let i = 0; i <= 10; i++) {
      // a green arc of the claw's path
      const a = h.a + (i / 10 - 0.5) * 2 * h.half * B.side, r = h.r * 0.7;
      glow(h.x + Math.sin(a) * r, (h.y ?? Y) + 1.3 + Math.random() * 0.8, h.z + Math.cos(a) * r, i % 3 ? 0x7dff5a : 0xeaffd0, Math.sin(a) * 3, 0.5, Math.cos(a) * 3, 0.45, 2);
    }
    api.fx.ring(h.x, h.y ?? Y, h.z, h.r, 0x7dff5a, 0.3);
    api.sfx("slash");
    api.shake(0.18);
  }
  function kickLand() {
    api.fx.ring(B.x, B.y, B.z, 4, 0x7dff5a, 0.35);
    api.burst(B.x, B.y + 0.3, B.z, 18, [0x3a4a3a, 0x7dff5a], 7, 5, 1, 0.7);
    glowBurst(B.x, B.y + 0.5, B.z, 16, GREEN, 5, 0.6, 2);
    scorch(B.x, B.z, 1.8, 3.5);
    api.sfx("stomp");
    api.shake(0.35);
  }
  function quakeHit(h) {
    B.x = B.px = h.x;
    B.z = B.pz = h.z;
    B.jump = false;
    B.air = heapTop(h.x, h.z);
    const y = Y + heapTop(h.x, h.z);
    wave(h.x, h.z, h.r - 0.3, K.quake.wave[B.phase]);
    api.fx.ring(h.x, y, h.z, h.r + 3, 0x7dff5a, 0.55);
    api.fx.star(h.x, y + 1, h.z, 2.6, 0x9dff5a);
    api.burst(h.x, y + 0.4, h.z, 36, [0x3a4a3a, 0x2a2a2a, 0x7dff5a, 0xd8ffc0], 11, 8, 1, 0.9);
    glowBurst(h.x, y + 1, h.z, 40, GREEN, 8, 0.9, 3);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; spike(h.x + Math.sin(a) * h.r * 0.75, h.z + Math.cos(a) * h.r * 0.75, 0.8 + Math.random() * 0.4, 1.0, 0.03); }
    scorch(h.x, h.z, h.r, 5);
    api.sfx("stomp");
    api.sfx("boom");
    api.shake(0.8);
    api.freeze(0.1);
  }
  function spikesHit(h) {
    const ux = Math.sin(h.a), uz = Math.cos(h.a), cx = uz, cz = -ux;
    for (let d = 1; d < h.r; d += 0.9) {
      const del = d * 0.02;
      for (const s of [-0.5, 0.5]) spike(h.x + ux * d + cx * s * (0.8 + Math.random() * 0.4), h.z + uz * d + cz * s * (0.8 + Math.random() * 0.4), 0.9 + Math.random() * 0.5, 1.3, del);
      if (d % 3 < 0.9) later(del, () => { const x = h.x + ux * d, z = h.z + uz * d; api.burst(x, Y + 0.4, z, 5, [0xdfe4cf, 0x7dff5a], 5, 6, 1, 0.6); glowBurst(x, Y + 0.6, z, 5, GREEN, 3, 0.5, 2); });
    }
    for (let d = 2; d < h.r; d += 4) scorch(h.x + ux * d, h.z + uz * d, 1.7, 3.5);
    api.sfx("crack");
    api.sfx("stake");
    api.shake(0.4);
  }
  function boltHit(h) {
    const y = h.y ?? Y;
    api.fx.ring(h.x, y, h.z, h.r + 1, 0x7dff5a, 0.35);
    api.burst(h.x, y + 0.4, h.z, 14, GREEN.concat(0x0a140a), 7, 6, 1, 0.7);
    glowBurst(h.x, y + 0.6, h.z, 18, GREEN, 6, 0.6, 2);
    flameCol(h.x, h.z, h.r * 0.8, 4.5, 0.45, 0, 1.2, 0.06, y);
    patch(h.x, h.z, h.burnR, h.burn, 0.15);
    scorch(h.x, h.z, h.r * 0.9, 4);
    api.sfx("fireHit");
    api.shake(0.15);
  }
  function infernoHit() {
    SEA.t = 0;
    SEA.warn = 0;
    SEA.life = K.inferno.burn;
    C.fx.flash = 1;
    // green flames burst up all over the floor (not up the heaps), from the middle out
    for (let i = 0; i < 70; i++) {
      const q = anywhere(C.wall - 1);
      flameCol(q.x, q.z, 1.4 + Math.random() * 1.3, 4 + Math.random() * 7, K.inferno.burn * (0.4 + Math.random() * 0.6), Math.hypot(q.x - C.x, q.z - C.z) * 0.012, 1.1, 0.12);
    }
    for (let i = 0; i < 3; i++) later(i * 0.12, () => api.fx.ring(C.x, Y + 0.2, C.z, 10 + i * 9, i % 2 ? 0xd8ffc0 : 0x3aff4a, 0.7));
    glowBurst(C.x, Y + 3, C.z, 160, [0xffffff, 0xd8ffc0, 0x7dff5a, 0x3aff4a], 20, 1.3, 4);
    for (let i = 0; i < 10; i++) { const q = anywhere(); scorch(q.x, q.z, 2 + Math.random() * 2, 7); }
    screenFlash("green");
    api.sfx("megaBoom");
    api.sfx("eruption");
    api.shake(1.1);
    api.freeze(0.18);
    // caught on the floor (not up a mountain of skulls)
    if (B.st === "fight" && api.player.dead <= 0 && pl.y < Y + K.inferno.safeY) {
      const [ux, uz] = away(C.x, C.z);
      api.hurt(K.inferno.dmg, ux, uz, "dark");
    }
  }
  function breathHit(h) {
    // the black gas: a cloud over the cone, and it lingers (it burns where it stays)
    for (let i = 0; i < 46; i++) {
      const a = h.a + (Math.random() - 0.5) * 2 * h.half, r = 1 + Math.random() * (h.r - 1);
      smoke(h.x + Math.sin(a) * r, Y + 0.4 + Math.random() * 1.6, h.z + Math.cos(a) * r, Math.sin(a) * 2, 0.4, Math.cos(a) * 2, K.breath.linger * (0.7 + Math.random() * 0.4), 1.6, 4.5, 0.75, i % 4 ? 0x0c0a10 : 0x1a3a1a);
    }
    for (let d = 2.2; d < h.r - 0.8; d += 2.3) {
      const n = Math.max(1, Math.round((d * h.half * 2) / 2.4));
      for (let k = 0; k < n; k++) { const a = h.a + ((k + 0.5) / n - 0.5) * 2 * h.half * 0.8; burn(h.x + Math.sin(a) * d, h.z + Math.cos(a) * d, 1.15, K.breath.linger, 0, "gas"); }
    }
    glowBurst(h.x + Math.sin(h.a) * 3, Y + 1.2, h.z + Math.cos(h.a) * 3, 20, [0x3aff4a, 0x0a3a0a], 6, 0.9);
    api.sfx("breath");
    api.sfx("hiss");
    api.shake(0.25);
  }
  function stopHit(h) {
    const y = h.y ?? Y;
    skyBolt(h.x, h.z, y);
    zap(_a.set(h.x, Y + 18, h.z), _b.set(h.x, y + 0.2, h.z), 0.3, 1.4, 1.6);
    api.fx.ring(h.x, y, h.z, h.r + 1.2, 0xd8ffc0, 0.4);
    api.burst(h.x, y + 0.5, h.z, 16, GREEN, 8, 7, 1, 0.7);
    glowBurst(h.x, y + 1, h.z, 22, [0xffffff, 0x9dff5a], 7, 0.6, 3);
    scorch(h.x, h.z, h.r * 0.9, 4);
    api.sfx("zap");
    api.shake(0.3);
  }
  function blackHit(h) {
    // black fire: dark smoke and green flames over the ring (or the circle)
    const r0 = h.shape === RING ? h.inner : 0, r1 = h.shape === RING ? C.wall - 0.5 : h.r;
    for (let i = 0; i < 44; i++) {
      const a = Math.random() * TAU, d = r0 + 0.5 + Math.random() * (r1 - r0 - 0.5), x = h.x + Math.sin(a) * d, z = h.z + Math.cos(a) * d;
      if (Math.hypot(x - C.x, z - C.z) > C.wall - 0.5) continue;
      flameCol(x, z, 1.2 + Math.random(), 3 + Math.random() * 4, 0.7 + Math.random() * 0.4, (d - r0) * 0.015, 0.9, 0.1, Y + heapTop(x, z));
      if (i % 2) smoke(x, Y + 1 + Math.random() * 2, z, 0, 2 + Math.random() * 2, 0, 1.4, 2, 5, 0.7);
    }
    api.fx.ring(h.x, Y, h.z, h.shape === RING ? h.inner : h.r, 0x7dff5a, 0.5);
    glowRing(h.x, h.z, h.shape === RING ? h.inner + 2 : h.r * 0.5, 40, [0x3aff4a, 0x0a3a0a, 0xd8ffc0]);
    api.sfx("darkBoom");
    api.sfx("eruption");
    api.shake(0.55);
    api.freeze(0.06);
  }
  function cometHit(h) {
    COMET.on = false;
    C.fx.flash = 1;
    const y = h.y ?? Y;
    api.fx.ring(h.x, y, h.z, h.r + 3, 0xd8ffc0, 0.6);
    api.fx.ring(h.x, y, h.z, h.r + 7, 0x3aff4a, 0.8);
    api.fx.star(h.x, y + 1.5, h.z, 3.2, 0x9dff5a);
    api.burst(h.x, y + 0.6, h.z, 46, [0x2a3a2a, 0x7dff5a, 0xd8ffc0, 0x0a140a], 14, 10, 1, 1);
    glowBurst(h.x, y + 1.5, h.z, 90, [0xffffff, 0xd8ffc0, 0x7dff5a], 14, 1.2, 4);
    flameCol(h.x, h.z, h.r * 0.7, 14, 0.9, 0, 1.4, 0.08, y);
    flameCol(h.x, h.z, h.r * 0.35, 20, 0.8, 0, 1.8, 0.08, y);
    for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; flameCol(h.x + Math.sin(a) * h.r * 0.85, h.z + Math.cos(a) * h.r * 0.85, 1.3, 5, 0.7, 0.04, 1.1, 0.08, y); }
    for (let i = 0; i < 16; i++) { const a = Math.random() * TAU; smoke(h.x + Math.sin(a) * 2, y + 1, h.z + Math.cos(a) * 2, Math.sin(a) * 6, 3 + Math.random() * 3, Math.cos(a) * 6, 2, 2.5, 7, 0.7); }
    burn(h.x, h.z, h.r * 0.45, 2.5);
    scorch(h.x, h.z, h.r, 7);
    screenFlash("green");
    api.sfx("megaBoom");
    api.shake(1.0);
    api.freeze(0.14);
  }
  function shardHit(h) {
    const y = h.y ?? Y;
    api.fx.ring(h.x, y, h.z, h.r + 1, 0x9dff5a, 0.35);
    api.burst(h.x, y + 0.4, h.z, 12, GREEN, 7, 6, 1, 0.6);
    flameCol(h.x, h.z, h.r * 0.8, 5, 0.5, 0, 1.2, 0.06, y);
    scorch(h.x, h.z, h.r, 4);
    api.sfx("fireHit");
    api.shake(0.2);
  }
  function sweepHit(h) {
    const ux = Math.sin(h.a), uz = Math.cos(h.a), end = _b.set(h.x + ux * h.r, Y + 0.6, h.z + uz * h.r);
    zap(_a.set(h.x, Y + 1.2, h.z), end, 0.32, 1.2, 1.5);
    zap(_a.set(h.x, Y + 0.5, h.z), end, 0.25, 2, 0.8);
    for (let d = 1.5; d < h.r; d += 1.4) glow(h.x + ux * d, Y + 0.5, h.z + uz * d, d % 2.8 < 1.4 ? 0xd8ffc0 : 0x7dff5a, (Math.random() - 0.5) * 2, 2 + Math.random() * 2, (Math.random() - 0.5) * 2, 0.5, 1.5);
    for (let d = 3; d < h.r; d += 5) scorch(h.x + ux * d, h.z + uz * d, 1.4, 3);
    api.sfx("zap");
    api.shake(0.2);
  }
  function counterHit(h) {
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; flameCol(h.x + Math.sin(a) * h.r * 0.7, h.z + Math.cos(a) * h.r * 0.7, 1.5, 5, 0.5, 0, 1.3, 0.06, h.y ?? Y); }
    api.fx.ring(h.x, h.y ?? Y, h.z, h.r + 1.5, 0x3aff4a, 0.45);
    glowRing(h.x, h.z, h.r, 40, [0x3aff4a, 0xd8ffc0], h.y ?? Y);
    if (B.form) for (let i = 0; i < 14; i++) { const a = Math.random() * TAU; smoke(h.x + Math.sin(a) * 1.5, (h.y ?? Y) + 1, h.z + Math.cos(a) * 1.5, Math.sin(a) * 7, 1.5, Math.cos(a) * 7, 1.1, 2, 5, 0.7); }
    scorch(h.x, h.z, h.r * 0.8, 3.5);
    api.sfx("darkBoom");
    api.shake(0.45);
  }

  // ── skeletons ──
  function spawnSkel(x, z) {
    const e = skels.find((k) => !k.on);
    if (!e || B.st !== "fight") return;
    Object.assign(e, { on: true, dead: false, st: "rise", t: 0, x, y: Y - 1.9, z, face: toFinn(x, z), flash: 0, hp: K.raise.hp, hz: null, kx: 0, kz: 0 });
    e.px = e.x; e.py = e.y; e.pz = e.z; e.pface = e.face;
    api.burst(x, Y + 0.3, z, 14, [0x3a3a2a, 0xdfe4cf, 0x7dff5a], 5, 5, 1, 0.8);
    glowBurst(x, Y + 0.3, z, 14, GREEN, 3, 0.8, 3);
    api.sfx("bones");
  }
  const skelsAlive = () => skels.filter((e) => e.on).length;
  function hurtSkel(e, n, nx = 0, nz = 0) {
    if (!e.on || e.st === "rise") return false;
    e.hp -= n;
    e.flash = 0.12;
    e.kx += nx * 7;
    e.kz += nz * 7;
    api.sfx(n > 1 ? "hitBig" : "hit");
    api.burst(e.x, e.y + 1.3, e.z, 5 + n * 2, [0xdfe4cf, 0xffffff], 4, 4, 1, 0.5);
    if (e.hp <= 0) return killSkel(e, nx, nz);
    if (e.st === "walk" || e.st === "recover") { e.st = "stagger"; e.t = 0; }
    return false;
  }
  function killSkel(e, nx = 0, nz = 0) {
    if (!e.on) return false;
    e.on = false;
    e.dead = true;
    if (e.hz) { HZ.remove(e.hz); e.hz = null; }
    // it falls apart: a spray of bones, its green soul going out
    api.burst(e.x, e.y + 1.1, e.z, 22, [0xdfe4cf, 0xc4c8b0, 0x8a8070], 6 + Math.hypot(nx, nz) * 2, 6, 1, 0.9);
    for (let i = 0; i < 6; i++) glow(e.x, e.y + 1.7, e.z, 0x9dff5a, (Math.random() - 0.5), 1.5 + Math.random(), (Math.random() - 0.5), 1.2, 0.4);
    api.sfx("bones");
    return true;
  }
  function stepSkels(dt) {
    for (const e of skels) {
      if (!e.on) continue;
      e.px = e.x; e.py = e.y; e.pz = e.z; e.pface = e.face;
      e.t += dt;
      e.flash -= dt;
      const dx = pl.x - e.x, dz = pl.z - e.z, d = Math.hypot(dx, dz) || 1, P = B.phase;
      e.kx *= Math.max(0, 1 - 7 * dt);
      e.kz *= Math.max(0, 1 - 7 * dt);
      let vx = e.kx, vz = e.kz;
      if (e.st === "rise") {
        e.y = lerp(Y - 1.9, Y, Math.min(1, e.t / 0.8));
        if (Math.random() < dt * 20) api.burst(e.x + (Math.random() - 0.5), Y + 0.1, e.z + (Math.random() - 0.5), 1, [0x3a3a2a, 0x5a5a4a], 2, 3, 1, 0.5);
        if (e.t > 0.8) { e.st = "walk"; e.t = 0; }
        continue;
      }
      if (e.st === "walk") {
        const sp = K.raise.speed[P];
        vx += (dx / d) * sp;
        vz += (dz / d) * sp;
        for (const o of skels) {
          if (o === e || !o.on) continue;
          const ox = e.x - o.x, oz = e.z - o.z, od = Math.hypot(ox, oz);
          if (od < 1.3 && od > 1e-3) { vx += (ox / od) * 3; vz += (oz / od) * 3; }
        }
        e.stride += Math.hypot(vx, vz) * dt;
        e.face = turnToward(e.face, Math.atan2(dx, dz), 7 * dt);
        if (d < 2.3 && api.player.dead <= 0 && pl.y < e.y + 2.5) {
          e.st = "wind";
          e.t = 0;
          e.hz = hazard({ shape: SECTOR, x: e.x, z: e.z, y: e.y, r: K.raise.r, half: 0.85, a: Math.atan2(dx, dz), warn: K.raise.warn[P], high: 1.6, onFire: () => { e.hz = null; e.st = "swing"; e.t = 0; api.sfx("slash"); } });
        }
      } else if (e.st === "wind") {
        vx = vz = 0;
      } else if (e.st === "swing") {
        if (e.t > 0.3) { e.st = "recover"; e.t = 0; }
      } else if (e.st === "recover") {
        if (e.t > 0.75) { e.st = "walk"; e.t = 0; }
      } else if (e.st === "stagger") {
        if (e.t > 0.35) { e.st = "walk"; e.t = 0; }
      }
      // round the heaps, inside the floor
      let nx = e.x + vx * dt, nz = e.z + vz * dt;
      for (const h of C.heaps) {
        const t0 = h.tiers[0], ox = nx - h.x, oz = nz - h.z, od = Math.hypot(ox, oz), R = t0.r + 0.4;
        if (od < R && od > 1e-3) { nx = h.x + (ox / od) * R; nz = h.z + (oz / od) * R; }
      }
      const q = clampIn(nx, nz, C.wall - 1);
      e.x = q.x;
      e.z = q.z;
      e.y = Y;
      // Finn can't walk through them
      const px = pl.x - e.x, pz = pl.z - e.z, pd = Math.hypot(px, pz), R = 0.75;
      if (pd < R && pl.y < e.y + 1.9 && pl.y + 1.6 > e.y) { const [ux, uz] = away(e.x, e.z); pl.x = e.x + ux * R; pl.z = e.z + uz * R; }
    }
  }
  function clearSkels() { for (const e of skels) if (e.on) killSkel(e); }

  // ── the fight, as scripts ──
  function* wait(s) {
    for (let t = 0; t < s; ) t += yield;
  }
  /** Walks (form 0) or glides (form 1) toward (x, z) until within `near`, for up to `max` s. */
  function* moveTo(x, z, near = 0.8, max = 3) {
    const q = clampIn(x, z, C.r - 1);
    Object.assign(B.goal, { on: true, x: q.x, z: q.z });
    B.speed = B.form ? K.lich.glide[B.phase] : K.skin.walk[B.phase];
    for (let t = 0; t < max && B.goal.on && Math.hypot(B.goal.x - B.x, B.goal.z - B.z) > near; ) t += yield;
    B.goal.on = false;
  }
  /** Runs after Finn until he's within `dist`, for up to `max` s. */
  function* approach(dist, max) {
    B.speed = B.form ? K.lich.glide[B.phase] : K.skin.walk[B.phase];
    for (let t = 0; t < max && distFinn() > dist; ) {
      const q = clampIn(pl.x, pl.z, C.r - 1);
      Object.assign(B.goal, { on: true, x: q.x, z: q.z });
      t += yield;
    }
    B.goal.on = false;
  }
  /** A leap (form 0) from where he is to (x, z), peaking `top` up, over `dur` s; he lands on what's there. */
  function* leap(x, z, top, dur) {
    B.goal.on = false;
    setPose("crouch");
    yield* wait(0.3);
    setPose("air");
    api.sfx("whoosh");
    B.jump = true;
    const x0 = B.x, z0 = B.z, y0 = B.y - Y;
    for (let t = 0; t < dur; ) {
      t += yield;
      const u = Math.min(1, t / dur), e = u * u * (3 - 2 * u);
      B.x = lerp(x0, x, e);
      B.z = lerp(z0, z, e);
      B.air = lerp(y0, heapTop(x, z), u) + 4 * top * u * (1 - u);
    }
    B.air = heapTop(x, z);
    B.jump = false;
    api.shake(0.5);
    api.sfx("stomp");
    api.fx.ring(B.x, Y + B.air, B.z, 6, 0x7dff5a, 0.45);
    api.burst(B.x, Y + B.air + 0.3, B.z, 24, [0x3a4a3a, 0x7dff5a], 8, 5, 1, 0.7);
  }
  /** He vanishes in green fire and turns up at (x, z), hovering at h (form 1). */
  function* blink(p, h = K.lich.hover) {
    const q = clampIn(p.x, p.z, C.r - 2);
    puff(B.x, B.y + 2, B.z);
    for (let i = 0; i <= 18; i++) {
      const t = i / 18, y = lerp(B.y, Y + h, t) + 2 + Math.sin(t * Math.PI) * 2;
      glow(lerp(B.x, q.x, t), y, lerp(B.z, q.z, t), i % 2 ? 0x7dff5a : 0x2aa03a, (Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5), 0.35 + t * 0.3, 2);
    }
    api.sfx("blink");
    B.hidden = true;
    yield* wait(0.3);
    B.x = B.px = q.x;
    B.z = B.pz = q.z;
    B.h = B.goalH = h;
    B.y = B.py = Y + h;
    B.face = B.pface = toFinn();
    B.vx = B.vz = 0;
    B.hidden = false;
    puff(B.x, B.y + 2, B.z);
    glowBurst(B.x, B.y + 2, B.z, 18, [0x7dff5a, 0xffffff], 4, 0.5);
    yield* wait(0.15);
  }
  function lob(x, z, warn, side, r = K.bolt.r, burnR = K.bolt.burnR, life = K.bolt.burn) {
    const q = clampIn(x, z, C.r), y = Y + heapTop(q.x, q.z), hnd = handAt(side), d = Math.hypot(q.x - hnd.x, q.z - hnd.z);
    hazard({ shape: CIRCLE, x: q.x, z: q.z, y, r, warn, burnR, burn: life, onFire: boltHit });
    ball(hnd.x, hnd.y, hnd.z, q.x, y, q.z, warn, 2.5 + d * 0.2, 0.9);
  }
  function harass(n, gap, warn, delay = 0.2) {
    for (let i = 0; i < n; i++) later(delay + i * gap, () => { if (B.st === "fight") { const q = lead(0.3); stopAt(q.x, q.z, warn); } });
  }
  function stopAt(x, z, warn, delay = 0) {
    const q = clampIn(x, z, C.r);
    hazard({ shape: CIRCLE, x: q.x, z: q.z, y: Y + heapTop(q.x, q.z), r: K.stop.r, warn, delay, onFire: stopHit });
  }
  const ATTACKS = {
    // ── form 0 ──
    *claw() {
      const P = B.phase, reps = K.claw.reps[P];
      yield* approach(3.4, 2.6);
      for (let rep = 0; rep < reps; rep++) {
        const warn = K.claw.warn[P] * (rep ? 0.85 : 1), a = toFinn();
        B.side = rep % 2 ? -1 : 1;
        B.faceLock = a;
        setPose("clawWind");
        if (!rep) say2("claw");
        castBar("claw", warn);
        hazard({ shape: SECTOR, x: B.x, z: B.z, y: B.y, r: K.claw.r, half: K.claw.half, a, warn, high: 2.6, onFire: clawHit });
        yield* wait(warn);
        setPose("claw");
        yield* wait(0.18);
        if (rep + 1 < reps) {
          // a step in after him
          const q = clampIn(B.x + Math.sin(toFinn()) * K.claw.step, B.z + Math.cos(toFinn()) * K.claw.step, C.r - 1);
          Object.assign(B.goal, { on: true, x: q.x, z: q.z });
          B.speed = 14;
          yield* wait(0.16);
          B.goal.on = false;
        }
      }
      B.faceLock = null;
      setPose("idle");
      yield* wait(K.claw.rest[P]); // spent: open to a counter
    },
    *kick() {
      const P = B.phase, reps = K.kick.reps[P];
      B.goal.on = false;
      for (let rep = 0; rep < reps; rep++) {
        if (distFinn() > K.kick.len + 2) yield* approach(K.kick.len - 1, 1.2);
        const warn = K.kick.warn[P] * (rep ? 0.85 : 1), a = toFinn(), len = Math.min(bandLen(B.x, B.z, a, C.r), K.kick.len);
        B.faceLock = a;
        setPose("kickWind");
        if (!rep) say2("kick");
        castBar("kick", warn);
        api.sfx("charge");
        hazard({ shape: BAND, x: B.x, z: B.z, a, r: len + K.skin.body, w: K.kick.w, warn, harmless: true });
        yield* wait(warn);
        setPose("kick");
        B.dash = { ux: Math.sin(a), uz: Math.cos(a), left: len, speed: K.kick.speed, hit: false, trail: 0 };
        api.sfx("whoosh");
        while (B.dash) yield;
        kickLand();
        yield* wait(0.25);
        setPose("idle");
        yield* wait(0.3);
      }
      B.faceLock = null;
      yield* wait(0.35);
    },
    *quake() {
      const P = B.phase, follow = K.quake.follow[P], lock = K.quake.lock[P];
      B.goal.on = false;
      B.faceLock = null;
      setPose("crouch");
      say2("quake");
      yield* wait(0.4);
      castBar("quake", follow + lock);
      const h = hazard({ shape: CIRCLE, x: B.x, z: B.z, y: B.y, r: K.quake.r, follow, chase: K.quake.chase[P], warn: lock, onFire: quakeHit });
      setPose("air");
      api.sfx("whoosh");
      api.shake(0.3);
      api.burst(B.x, B.y + 0.4, B.z, 24, [0x3a4a3a, 0x7dff5a], 8, 5, 1, 0.7);
      const x0 = B.x, z0 = B.z, T = follow + lock, y0 = B.y - Y;
      B.jump = true;
      for (let t = 0; !h.fired; ) {
        t += yield;
        h.y = Y + heapTop(h.x, h.z); // (the circle follows Finn up and down the heaps)
        const u = Math.min(1, t / T), e = u * u * (3 - 2 * u);
        B.x = lerp(x0, h.x, e);
        B.z = lerp(z0, h.z, e);
        B.air = lerp(y0, h.y - Y, u) + 4 * 12 * u * (1 - u);
        B.faceLock = toFinn();
      }
      setPose("land");
      yield* wait(K.quake.daze[P]);
      B.faceLock = null;
      setPose("idle");
      yield* wait(0.3);
    },
    *spikes() {
      const P = B.phase, warn = K.spikes.warn[P], nb = K.spikes.bands[P];
      yield* approach(9, 2.0);
      const aim = toFinn();
      B.goal.on = false;
      B.faceLock = aim;
      setPose("punchUp");
      say2("spikes");
      castBar("spikes", warn);
      api.sfx("charge");
      for (let i = 0; i < nb; i++) {
        const a = aim + (i - (nb - 1) / 2) * K.spikes.spread, x = B.x + Math.sin(a) * 1.4, z = B.z + Math.cos(a) * 1.4;
        hazard({ shape: BAND, x, z, a, r: bandLen(x, z, a), w: K.spikes.w, warn, onFire: spikesHit });
      }
      yield* wait(warn - 0.15);
      setPose("punchGo");
      yield* wait(0.15);
      api.sfx("stomp");
      api.fx.ring(B.x, B.y, B.z, 3.5, 0x7dff5a, 0.4);
      yield* wait(K.spikes.stuck[P]); // fists stuck in the floor: open to a counter
      B.faceLock = null;
      setPose("idle");
      yield* wait(0.3);
    },
    *bolt() {
      const P = B.phase, n = K.bolt.n[P], every = K.bolt.every[P], warn = K.bolt.warn[P];
      B.goal.on = false;
      say2("bolt");
      castBar("bolt", n * every + warn);
      for (let i = 0; i < n; i++) {
        B.faceLock = toFinn();
        B.side = i % 2 ? 1 : -1;
        setPose("cast");
        B.poseT = 0;
        yield* wait(0.18);
        const q = lead(0.35);
        lob(q.x, q.z, warn, B.side);
        api.sfx("fireball");
        yield* wait(Math.max(0.05, every - 0.18));
      }
      yield* wait(warn * 0.6);
      B.faceLock = null;
      setPose("idle");
      yield* wait(0.4);
    },
    *inferno() {
      const n = B.infernos++, warn = K.inferno.warn[Math.min(1, n)];
      B.faceLock = null;
      // onto the heap in the middle, in one leap
      yield* leap(C.x, C.z, 5, 1.0);
      setPose("inferno");
      say(pick(STR.lich.shout.inferno), 3);
      castBar("inferno", warn);
      api.sfx("roar");
      api.sfx("megaCharge");
      if (!n) api.onInferno();
      // the floor starts to glow; the heaps' tops are marked safe (pale rings)
      SEA.warn = 0.001;
      hazard({ shape: CIRCLE, x: C.x, z: C.z, r: C.wall + 2, warn, harmless: true, onFire: infernoHit });
      for (const h of C.heaps) {
        if (h.mid || Math.hypot(h.x - C.x, h.z - C.z) > C.wall + 2) continue;
        const t = h.tiers[0].y > K.inferno.safeY ? h.tiers[0] : h.tiers[1];
        sigilAt(h.x, h.z, t.r * 0.9, warn + 0.4, 0xfff0b0, Y + t.y, 0.8);
      }
      for (let t = 0; t < warn - 0.5; ) {
        t += yield;
        if (Math.random() < 0.3) { const q = anywhere(); glow(q.x, Y + 0.2, q.z, 0x7dff5a, 0, 2 + Math.random() * 3, 0, 0.9, 0.3); }
      }
      setPose("infernoGo");
      yield* wait(0.5);
      yield* wait(K.inferno.rest);
      setPose("idle");
      // down off the heap, toward Finn
      const q = clampIn(lerp(C.x, pl.x, 0.6), lerp(C.z, pl.z, 0.6), C.r - 3);
      yield* leap(q.x, q.z, 3, 0.7);
      setPose("idle");
    },
    // ── form 1 ──
    *orbs() {
      const P = B.phase, n = K.orbs.n[P], every = K.orbs.every[P], warn = K.orbs.warn[P];
      const a = Math.random() * TAU;
      yield* blink({ x: pl.x + Math.sin(a) * 7.5, z: pl.z + Math.cos(a) * 7.5 }, 1.0);
      setPose("cast");
      say2("orbs");
      castBar("orbs", n * every + warn);
      for (let i = 0; i < n; i++) {
        B.faceLock = toFinn();
        B.side = i % 2 ? 1 : -1;
        const q = lead(0.3);
        lob(q.x, q.z, warn, B.side, K.orbs.r, K.orbs.burnR, K.orbs.burn);
        if (K.orbs.spread[P] && i % 2 === 0) {
          const aa = toFinn(), d = Math.hypot(q.x - B.x, q.z - B.z);
          for (const o of [-0.45, 0.45]) lob(B.x + Math.sin(aa + o) * d, B.z + Math.cos(aa + o) * d, warn, -B.side, K.orbs.r, K.orbs.burnR, K.orbs.burn);
        }
        api.sfx("fireball");
        yield* wait(every);
      }
      yield* wait(warn * 0.7);
      B.faceLock = null;
      setPose("idle");
      B.goalH = K.lich.hover;
      yield* wait(0.5);
    },
    *breath() {
      const P = B.phase, reps = K.breath.reps[P];
      for (let rep = 0; rep < reps; rep++) {
        const warn = K.breath.warn[P] * (rep ? 0.85 : 1), a0 = Math.random() * TAU;
        yield* blink({ x: pl.x + Math.sin(a0) * 5.5, z: pl.z + Math.cos(a0) * 5.5 }, K.lich.hover);
        const a = toFinn();
        B.faceLock = a;
        setPose("breathIn");
        if (!rep) say2("breath");
        castBar("breath", warn);
        api.sfx("breath");
        hazard({ shape: SECTOR, x: B.x, z: B.z, r: K.breath.r, half: K.breath.half, a, warn, onFire: breathHit });
        yield* wait(warn);
        setPose("breath");
        yield* wait(rep + 1 < reps ? 0.4 : 1.0); // spent after the last: open to a counter
      }
      B.faceLock = null;
      setPose("idle");
    },
    *stop() {
      const P = B.phase, hold = K.stop.hold[P], after = K.stop.after[P], n = K.stop.n[P];
      if (distFinn() > 14) yield* blink(clampIn(lerp(pl.x, B.x, 0.5), lerp(pl.z, B.z, 0.5), C.r - 3), 1.2);
      B.goal.on = false;
      B.faceLock = toFinn();
      setPose("stop");
      castBar("stop", hold + after);
      showWord(STR.lich.stopWord, "stop");
      say(STR.lich.stopSay, 2);
      api.sfx("stopTime");
      api.shake(0.3);
      B.stopT = hold;
      stopAt(pl.x, pl.z, hold + after);
      for (let i = 1; i < n; i++) {
        const a = (i / (n - 1)) * TAU + Math.random(), d = 4.5 + Math.random() * 2;
        stopAt(pl.x + Math.sin(a) * d, pl.z + Math.cos(a) * d, hold + after + i * 0.12);
      }
      yield* wait(hold + after + 0.3);
      B.faceLock = null;
      setPose("idle");
      yield* wait(0.45);
    },
    *raise() {
      const P = B.phase, a = Math.random() * TAU;
      yield* blink({ x: C.x + Math.sin(a) * 6, z: C.z + Math.cos(a) * 6 }, 1.4);
      setPose("summon");
      say2("raise");
      castBar("raise", 1.8);
      api.sfx("summon");
      const n = Math.min(K.raise.n[P], K.raise.max - skelsAlive()), o = toFinn(C.x, C.z);
      for (let i = 0; i < n; i++) {
        const t = o + ((i - (n - 1) / 2) / Math.max(1, n)) * 2.4, q = (() => { for (let k = 0; k < 12; k++) { const d = 7 + Math.random() * 8, x = C.x + Math.sin(t + (Math.random() - 0.5) * 0.5) * d, z = C.z + Math.cos(t + (Math.random() - 0.5) * 0.5) * d; if (heapTop(x, z) === 0 && Math.hypot(x - pl.x, z - pl.z) > 3) return { x, z }; } return anywhere(); })();
        later(0.15 + i * 0.12, () => { sigilAt(q.x, q.z, 1.6, 1.4, 0x7dff5a); api.fx.ring(q.x, Y, q.z, 2.2, 0x7dff5a, 0.5); api.burst(q.x, Y + 0.2, q.z, 8, [0x3a3a2a, 0x7dff5a], 3, 3, 1, 0.6); });
        later(0.8 + i * 0.2, () => spawnSkel(q.x, q.z));
      }
      yield* wait(1.8);
      setPose("idle");
      B.goalH = K.lich.hover;
      yield* wait(0.3);
    },
    *blackfire() {
      const P = B.phase, warn = K.blackfire.warn[P];
      yield* blink({ x: C.x + Math.sin(toFinn(C.x, C.z)) * 3.5, z: C.z + Math.cos(toFinn(C.x, C.z)) * 3.5 }, 1.0); // by the middle: the one safe spot at first
      setPose("castUp");
      say2("blackfire");
      castBar("blackfire", warn * 2 + K.blackfire.gap);
      api.sfx("summon");
      hazard({ shape: RING, x: C.x, z: C.z, inner: K.blackfire.inner, r: C.wall + 1, warn, onFire: blackHit });
      if (P === 2) harass(2, 0.45, 1.0, 0.35);
      yield* wait(warn + 0.1);
      setPose("summon");
      hazard({ shape: CIRCLE, x: C.x, z: C.z, r: K.blackfire.mid, warn: warn * 0.9 + K.blackfire.gap, onFire: blackHit });
      yield* wait(warn * 0.9 + K.blackfire.gap + 0.2);
      setPose("idle");
      const a = Math.random() * TAU;
      yield* blink({ x: C.x + Math.sin(a) * 9, z: C.z + Math.cos(a) * 9 }, K.lich.hover);
    },
    *comet() {
      const P = B.phase, warn = K.comet.warn[P];
      B.goal.on = false;
      B.goalH = 1.0;
      setPose("comet");
      say2("comet");
      castBar("comet", warn);
      api.sfx("megaCharge");
      const q = lead(0.5), y = Y + heapTop(q.x, q.z);
      hazard({ shape: CIRCLE, x: q.x, z: q.z, y, r: K.comet.r, warn, onFire: cometHit });
      const a = Math.random() * TAU;
      Object.assign(COMET, { on: true, t: 0, dur: warn, x0: q.x + Math.sin(a) * 18, y0: Y + 21, z0: q.z + Math.cos(a) * 18, x: q.x, y, z: q.z });
      for (let i = 0; i < K.comet.shards[P]; i++) {
        later(warn * 0.45 + i * 0.1, () => {
          if (B.st !== "fight") return;
          const s = Math.random() < 0.3 ? lead(0.4) : anywhere();
          hazard({ shape: CIRCLE, x: s.x, z: s.z, y: Y + heapTop(s.x, s.z), r: K.comet.shardR, warn: 0.9, onFire: shardHit });
          ball(COMET.x0, COMET.y0, COMET.z0, s.x, Y + heapTop(s.x, s.z), s.z, 0.9, 0, 0.7);
        });
      }
      yield* wait(warn * 0.8);
      setPose("cometGo");
      yield* wait(warn * 0.2 + 0.9);
      B.goalH = K.lich.hover;
      setPose("idle");
      yield* wait(0.4);
    },
    *sweep() {
      const P = B.phase, n = K.sweep.n[P], every = K.sweep.every[P], warn = K.sweep.warn;
      yield* blink({ x: C.x + (Math.random() - 0.5) * 6, z: C.z + (Math.random() - 0.5) * 6 }, 1.1);
      setPose("castUp");
      say2("sweep");
      castBar("sweep", n * every + warn);
      api.sfx("zap");
      let a = toFinn() - Math.PI * 0.6, dir = Math.random() < 0.5 ? -1 : 1;
      a = toFinn() - dir * Math.PI * 0.55;
      for (let i = 0; i < n; i++) {
        hazard({ shape: BAND, x: B.x, z: B.z, a, r: bandLen(B.x, B.z, a), w: K.sweep.w, warn, onFire: sweepHit });
        B.faceLock = a;
        a += dir * K.sweep.step;
        yield* wait(every);
      }
      yield* wait(warn);
      B.faceLock = null;
      setPose("spent");
      yield* wait(1.0);
      setPose("idle");
    },
    *fall() {
      const n = B.falls++, warn = K.fall.warn[Math.min(1, n)];
      B.faceLock = null;
      B.goal.on = false;
      // away from the book, up under the dome
      const a = toFinn(C.x, C.z) + Math.PI * (0.6 + Math.random() * 0.8);
      yield* blink({ x: C.x + Math.sin(a) * 15, z: C.z + Math.cos(a) * 15 }, 1.5);
      B.goalH = K.fall.h;
      B.hRate = 1.6;
      B.armor = true;
      setPose("fall");
      say(STR.lich.fallSay[0], 3);
      castBar("fall", warn);
      api.sfx("roar");
      api.sfx("fallCharge");
      if (!n) api.onFall();
      Object.assign(FALL, { on: true, t: 0, warn, x: B.x, z: B.z, blast: 9, word: false });
      hazard({ shape: RING, x: C.x, z: C.z, inner: K.fall.safe, r: C.wall + 2, warn, harmless: true });
      later(warn * 0.45, () => { if (FALL.on) say(STR.lich.fallSay[1], 2.5); });
      yield* wait(warn - 0.7);
      FALL.word = true;
      showWord(STR.lich.fallWord, "fall");
      api.sfx("fallWord");
      api.shake(0.6);
      yield* wait(0.7);
      fallHit();
      yield* wait(0.9);
      B.armor = false;
      B.goalH = K.lich.hover;
      B.hRate = 1.2;
      setPose("spent");
      say(pick(STR.lich.spent), 2);
      yield* wait(K.fall.rest); // spent: the time to hit him
      B.hRate = 4;
      setPose("idle");
    },
  };
  /** "Fall": everything the Lich sees dies, but for the Enchiridion's light. */
  function fallHit() {
    FALL.on = false;
    FALL.blast = 0;
    HOLY.flash = 1;
    C.fx.flash = 1;
    const x = B.x, y = B.y + 2.5, z = B.z;
    // black fire and green flames over the whole floor, from under him out
    for (let i = 0; i < 90; i++) {
      const q = anywhere(C.wall - 0.8);
      if (Math.hypot(q.x - C.x, q.z - C.z) < K.fall.safe + 0.4) continue;
      flameCol(q.x, q.z, 1.4 + Math.random() * 1.6, 5 + Math.random() * 10, 1 + Math.random() * 0.8, Math.hypot(q.x - x, q.z - z) * 0.012, 1.3, 0.1);
    }
    for (const h of C.heaps) if (!h.mid) for (let i = 0; i < 3; i++) { const a = Math.random() * TAU, d = Math.random() * h.tiers[1].r; flameCol(h.x + Math.sin(a) * d, h.z + Math.cos(a) * d, 1.2, 5 + Math.random() * 5, 1.2, 0.2, 1.2, 0.1, Y + h.tiers[1].y); }
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * TAU, d = K.fall.safe + 1 + Math.random() * (C.wall - K.fall.safe - 1);
      smoke(C.x + Math.sin(a) * d, Y + 1 + Math.random() * 4, C.z + Math.cos(a) * d, Math.sin(a) * 3, 3 + Math.random() * 3, Math.cos(a) * 3, 2.4, 3, 6.5, 0.8);
    }
    for (let i = 0; i < 5; i++) later(i * 0.1, () => api.fx.ring(C.x, Y + 0.2, C.z, 8 + i * 7, i % 2 ? 0xd8ffc0 : 0x3aff4a, 0.8));
    glowBurst(x, y, z, 200, [0xffffff, 0xd8ffc0, 0x7dff5a, 0x3aff4a], 26, 1.5, 0);
    glowBurst(C.x, Y + 2, C.z, 60, [0xffffff, 0xffe8a0], 6, 1.2, 3); // the light holds
    for (let i = 0; i < 12; i++) { const q = anywhere(); if (Math.hypot(q.x - C.x, q.z - C.z) > K.fall.safe + 1) scorch(q.x, q.z, 2.4 + Math.random() * 2, 8); }
    for (let i = 0; i < 5; i++) later(0.05 + i * 0.07, () => { const q = anywhere(); skyBolt(q.x, q.z); });
    screenFlash("fall");
    api.sfx("fallBoom");
    api.sfx("megaBoom");
    api.shake(1.6);
    api.freeze(0.35);
    // outside the book's light: dead (however high up: jumping off a heap is no way out)
    const safe = Math.hypot(pl.x - C.x, pl.z - C.z) < K.fall.safe + 0.2;
    if (B.st === "fight" && api.player.dead <= 0 && !safe) api.kill();
  }
  function* rage() {
    // at 60% and 30% of a body: he gets fiercer
    B.phase = B.nextPhase;
    B.armor = true;
    B.goal.on = false;
    B.faceLock = null;
    B.dash = null;
    setPose("rage");
    say(STR.lich.rage[B.form][B.phase - 1], 3.2);
    api.sfx("roar");
    api.sfx("darkBoom");
    api.shake(0.6);
    C.fx.flash = 1;
    glowBurst(B.x, B.y + 2.5, B.z, 90, [0xffffff, 0x9dff5a, 0x3aff4a], 11, 1.3, 1);
    glowRing(B.x, B.z, 10, 60, [0x3aff4a, 0xd8ffc0], Y);
    for (let i = 0; i < 3; i++) later(0.25 + i * 0.35, () => api.fx.ring(B.x, Y, B.z, 6 + i * 4, i % 2 ? 0xd8ffc0 : 0x3aff4a, 0.6));
    screenFlash("green");
    hpShown = -1;
    yield* wait(1.8);
    B.armor = false;
    setPose("idle");
    // below 30% the first thing is his big one
    if (B.phase === 2) yield* ATTACKS[B.form ? "fall" : "inferno"]();
  }
  function* tear() {
    // Billy's body is spent: the Lich tears the skin off and rises out of it
    B.armor = true;
    B.goal.on = false;
    B.faceLock = null;
    B.dash = null;
    B.air = 0;
    B.cast = null;
    $("bossCast").hidden = true;
    HZ.cancel();
    timers.length = 0;
    clearSkels();
    SEA.warn = 0;
    setPose("tear");
    say(STR.lich.tear[0], 3);
    api.sfx("roar");
    api.freeze(0.15);
    api.shake(0.6);
    glowBurst(B.x, B.y + 2.5, B.z, 80, [0xffffff, 0x9dff5a], 8, 1.2);
    yield* wait(1.4);
    // the skin splits: green light bursting out of the cracks, the two bodies flickering
    say(STR.lich.tear[1], 3);
    api.sfx("charge");
    for (let t = 0; t < 1.6; ) {
      t += yield;
      B.tearT = t;
      if (Math.random() < 0.5) glow(B.x + (Math.random() - 0.5) * 1.6, B.y + 1 + Math.random() * 3.5, B.z + (Math.random() - 0.5) * 1.6, pick(GREEN), (Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.5) * 6, 0.6, 1);
      if (Math.random() < 0.15) zap(_a.set(B.x, B.y + 2.5, B.z), _b.set(B.x + (Math.random() - 0.5) * 5, B.y + Math.random() * 4.5, B.z + (Math.random() - 0.5) * 5), 0.15, 0.8, 0.7);
    }
    B.form = 1;
    B.model = lich;
    B.tearT = 0;
    B.h = 0;
    B.goalH = K.lich.hover;
    B.hRate = 1.5;
    B.hp = K.hp[1];
    B.phase = B.nextPhase = 0;
    B.heat = 0;
    B.refill = true;
    hpFill = 0;
    hpShown = -1;
    hud(true);
    // the rags of Billy fly off every which way
    api.burst(B.x, B.y + 2.5, B.z, 60, [0x86a096, 0x4d6660, 0x5e3c20, 0xe8eee8, 0x7dff5a], 12, 9, 1, 1.4);
    glowBurst(B.x, B.y + 2.5, B.z, 140, [0xffffff, 0xd8ffc0, 0x7dff5a, 0x3aff4a], 14, 1.4, 1);
    for (let i = 0; i < 4; i++) later(i * 0.15, () => api.fx.ring(B.x, Y, B.z, 5 + i * 5, i % 2 ? 0xd8ffc0 : 0x3aff4a, 0.7));
    screenFlash("fall");
    showWord(STR.lich.boss[1], "name");
    api.onTear();
    api.sfx("fallBoom");
    api.sfx("roar");
    api.shake(1.2);
    api.freeze(0.25);
    C.fx.flash = 1;
    setPose("rage");
    yield* wait(1.2);
    say(STR.lich.tear[2], 4);
    for (let i = 0; i < K.tearHearts; i++) {
      const a = toFinn() + (i - 0.5) * 0.8, q = clampIn(B.x + Math.sin(a) * 3.5, B.z + Math.cos(a) * 3.5, C.r - 2);
      api.dropHeart(q.x, Y + 3 + heapTop(q.x, q.z), q.z);
    }
    yield* wait(2.2);
    B.refill = false;
    B.armor = false;
    B.hRate = 4;
    setPose("idle");
    yield* fight();
  }
  function* fight() {
    let bag = [], last = "";
    for (;;) {
      if (B.nextPhase > B.phase) {
        yield* rage();
        bag = []; // the new phase's attacks, right away
        if (B.phase === 2) last = B.form ? "fall" : "inferno";
      }
      if (!bag.length) {
        bag = [...ORDER[B.form][B.phase]].sort(() => Math.random() - 0.5);
        if (bag[0] === last) bag.push(bag.shift());
      }
      const next = B.only && ORDER[B.form][2].includes(B.only) ? B.only : bag.shift();
      if (next === "raise" && !B.only && skelsAlive() >= 3) continue; // enough of them about already
      last = next;
      yield* ATTACKS[next]();
      B.cast = null;
      $("bossCast").hidden = true;
      // between attacks: form 0 closes in on Finn; form 1 drifts down toward him (the time to hit him)
      if (!B.form && distFinn() > 7) yield* approach(5, 0.6);
      else if (B.form) {
        B.goalH = K.lich.hover;
        if (distFinn() > 5) yield* approach(3.5, 1.1);
        else yield* wait(0.6);
      } else yield* wait(0.15);
    }
  }
  function* intro() {
    setPose("idle");
    hud(true);
    say(STR.lich.intro, 4.5);
    api.sfx("cackle");
    C.fx.flash = 1;
    yield* wait(1.2);
    setPose("rage");
    api.sfx("roar");
    api.shake(0.4);
    glowBurst(B.x, B.y + 2.5, B.z, 50, GREEN, 8, 1, 1);
    yield* wait(1.3);
    // down off his heap, at Finn
    const q = clampIn(lerp(C.x, pl.x, 0.45), lerp(C.z, pl.z, 0.45), C.r - 4);
    yield* leap(q.x, q.z, 3, 0.8);
    setPose("idle");
    B.st = "fight";
    api.onStart();
    yield* fight();
  }
  function* lost() {
    // the last blow: he shrieks, green light out of every crack of him, and crumbles to dust; his
    // spirit is pulled into the Enchiridion
    B.armor = true;
    B.cast = null;
    B.faceLock = null;
    B.goal.on = false;
    B.goalH = 1.2;
    FALL.on = false;
    COMET.on = false;
    B.stopT = 0;
    SEA.warn = 0;
    $("bossCast").hidden = true;
    setPose("down");
    say(STR.lich.defeat[0], 3.5);
    api.sfx("roar");
    api.freeze(0.2);
    api.shake(0.8);
    C.fx.flash = 1;
    for (let t = 0; t < 2.6; ) {
      t += yield;
      B.tearT = t;
      if (Math.random() < 0.6) zap(_a.set(B.x, B.y + 3, B.z), _b.set(B.x + (Math.random() - 0.5) * 8, B.y + Math.random() * 6, B.z + (Math.random() - 0.5) * 8), 0.15, 1, 0.8);
      if (Math.random() < 0.5) glow(B.x + (Math.random() - 0.5) * 2, B.y + 1 + Math.random() * 4, B.z + (Math.random() - 0.5) * 2, pick(GREEN), (Math.random() - 0.5) * 8, Math.random() * 5, (Math.random() - 0.5) * 8, 0.7, 1);
    }
    B.hidden = true;
    B.tearT = 0;
    api.burst(B.x, B.y + 2.5, B.z, 70, [0xe4ead8, 0xc4c8b0, 0x56663a, 0x74ae7c, 0xa8963c], 10, 6, 1, 1.6);
    for (let i = 0; i < 40; i++) { const a = Math.random() * TAU; smoke(B.x + Math.sin(a), B.y + 1 + Math.random() * 4, B.z + Math.cos(a), Math.sin(a) * 3, 1 + Math.random() * 2, Math.cos(a) * 3, 2.5, 2, 6, 0.6, 0xb8b8a0); }
    screenFlash("fall");
    api.sfx("fallBoom");
    api.shake(1.1);
    // his spirit, a wail of green light, drawn into the book
    const book = C.fx.book;
    for (let i = 0; i < 120; i++) later(i * 0.012, () => soul(B.x + (Math.random() - 0.5) * 2, B.y + 2 + Math.random() * 3, B.z + (Math.random() - 0.5) * 2, i % 3 ? 0x7dff5a : 0xd8ffc0, book, 2.2));
    say(STR.lich.defeat[1], 4);
    yield* wait(2.4);
    HOLY.flash = 1;
    glowBurst(book.x, book.y, book.z, 80, [0xffffff, 0xffe8a0], 7, 1.3, 1);
    api.sfx("win");
    yield* wait(1.0);
    const first = api.onWin();
    Object.assign(reward, { on: true, t: 0 });
    B.st = "rest";
    yield* wait(3);
    if (B.st === "rest") hud(false);
    return first;
  }

  // ── starting, stopping ──
  /** Finn talked to him in his cave: he's up on the heap in the middle, and it starts. */
  function enter() {
    reset();
    B.st = "intro";
    B.form = 0;
    B.model = skin;
    B.hp = K.hp[0];
    B.dropAcc = 0;
    B.phase = B.nextPhase = 0;
    B.air = heapTop(C.x, C.z);
    B.y = B.py = Y + B.air;
    B.face = B.pface = toFinn();
    hpShown = -1;
    B.script = intro();
    B.script.next();
  }
  function reset() {
    B.script = null;
    B.cast = null;
    B.faceLock = null;
    B.dash = null;
    B.armor = B.hidden = B.refill = B.jump = false;
    B.goal.on = false;
    B.form = 0;
    B.model = skin;
    HZ.cancel();
    timers.length = 0;
    burns.length = 0;
    clearSkels();
    for (const c of cols) c.on = false;
    for (const b of balls) b.on = false;
    for (const w of waves) w.on = false;
    for (const s of spikes) s.on = false;
    for (const m of motes) m.life = 0;
    for (const p of puffs) p.life = 0;
    for (const s of sigils) s.t = s.life;
    for (const s of scorches) s.t = s.life;
    for (const z of arcs) z.t = z.life;
    FALL.on = COMET.on = reward.on = false;
    FALL.blast = 9;
    SEA.t = 9;
    SEA.warn = 0;
    B.heat = B.counterCd = 0;
    B.infernos = B.falls = 0;
    B.stopT = B.tearT = 0;
    B.air = B.h = B.goalH = 0;
    B.hRate = 4;
    B.x = B.px = C.x;
    B.z = B.pz = C.z;
    B.y = B.py = Y + heapTop(C.x, C.z);
    B.vx = B.vz = B.kx = B.kz = 0;
    B.face = B.pface = C.spawnA;
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
    B.counterCd -= dt;
    B.stopT = Math.max(0, B.stopT - dt);
    B.heat = Math.max(0, B.heat - dt * (K.counter.dmg[B.phase] / K.counter.window));
    if (B.cast) B.cast.t += dt;
    for (let i = timers.length - 1; i >= 0; i--) {
      const k = timers[i];
      if (!k || (k.t -= dt) > 0) continue;
      timers.splice(i, 1);
      k.fn();
    }
    if (B.script && B.script.next(dt).done) B.script = null;
    let moved = 0;
    if (B.dash) {
      // the Hero's Kick: straight down its band, green fire along the way; it hits Finn once
      const D = B.dash, st = Math.min(D.left, D.speed * dt);
      B.x += D.ux * st;
      B.z += D.uz * st;
      D.left -= st;
      moved = st;
      D.trail += st;
      if (D.trail > 1.5) { D.trail = 0; flameCol(B.x - D.ux, B.z - D.uz, 0.9, 2.2, 0.6, 0, 0.9, 0.1); }
      for (let k = count(40, dt); k > 0; k--) glow(B.x, B.y + 1.2 + Math.random() * 1.5, B.z, pick(GREEN), -D.ux * 4, Math.random(), -D.uz * 4, 0.4, 2);
      const dx = pl.x - B.x, dz = pl.z - B.z;
      if (!D.hit && B.st === "fight" && Math.hypot(dx, dz) < K.kick.w + 0.2 && pl.y < B.y + 3) {
        D.hit = true;
        const s = dx * D.uz - dz * D.ux >= 0 ? 1 : -1;
        api.hurt(1, D.uz * s * 0.7 + D.ux * 0.7, -D.ux * s * 0.7 + D.uz * 0.7, "dark");
      }
      if (D.left <= 0) B.dash = null;
    } else {
      let want = 0, wx = 0, wz = 0;
      if (B.goal.on) {
        const dx = B.goal.x - B.x, dz = B.goal.z - B.z, d = Math.hypot(dx, dz);
        if (d > 0.3) { want = Math.min(B.speed, d * 3); wx = dx / d; wz = dz / d; } else B.goal.on = false;
      }
      const f = Math.min(1, (B.form ? 5 : 6) * dt);
      B.vx += (wx * want - B.vx) * f;
      B.vz += (wz * want - B.vz) * f;
      B.kx *= Math.max(0, 1 - 6 * dt);
      B.kz *= Math.max(0, 1 - 6 * dt);
      B.x += (B.vx + B.kx) * dt;
      B.z += (B.vz + B.kz) * dt;
      moved = Math.hypot(B.vx, B.vz) * dt;
    }
    // on foot he goes round the heaps (a tier higher than he stands blocks him; off the edge he drops);
    // up in a leap, or floating, he passes over
    if (!B.form && !B.jump) {
      for (const h of C.heaps) {
        const dx = B.x - h.x, dz = B.z - h.z, d = Math.hypot(dx, dz);
        for (const t of h.tiers) {
          const R = t.r + K.skin.body * 0.8;
          if (t.y > B.air + 0.5 && d < R && d > 1e-3) { B.x = h.x + (dx / d) * R; B.z = h.z + (dz / d) * R; break; }
        }
      }
    }
    const q = clampIn(B.x, B.z, C.r - 0.5);
    B.x = q.x;
    B.z = q.z;
    B.stride += moved;
    if (B.form) {
      B.h += (B.goalH - B.h) * Math.min(1, B.hRate * dt);
      B.y = Y + Math.max(B.h, heapTop(B.x, B.z) + 0.4);
    } else {
      if (!B.jump) B.air = heapTop(B.x, B.z);
      B.y = Y + B.air;
    }
    const moving = !B.dash && Math.hypot(B.vx, B.vz) > 1;
    const faceTo = B.faceLock ?? (moving && !B.form ? Math.atan2(B.vx, B.vz) : B.st === "rest" || B.st === "down" ? B.face : toFinn());
    B.face = turnToward(B.face, faceTo, (B.faceLock !== null ? 12 : B.form ? 5 : K.skin.turn[B.phase]) * dt);
    B.dead = !hittable();
    HZ.step(dt);
    stepBurns(dt);
    stepSkels(dt);
    for (const s of spikes) {
      if (!s.on) continue;
      s.t += dt;
      if (s.t >= s.life) s.on = false;
    }
    for (const w of waves) {
      if (!w.on) continue;
      w.pr = w.r;
      if ((w.t += dt) < 0) continue;
      w.r += w.speed * dt;
      if (w.r > w.max) { w.on = false; continue; }
      // the ring of green fire sweeps past: Finn on the floor where it went by is caught
      const dx = pl.x - w.x, dz = pl.z - w.z, d = Math.hypot(dx, dz);
      if (!w.hit && B.st === "fight" && api.player.dead <= 0 && pl.y < Y + 0.85 && d > w.pr - 0.8 && d < w.r + 0.4) {
        w.hit = true;
        api.hurt(1, dx / (d || 1), dz / (d || 1), "dark");
      }
    }
    // the burning floor after the inferno: on the floor, it burns
    SEA.t += dt;
    if (SEA.warn > 0) SEA.warn = Math.min(1, SEA.warn + dt / 1.2);
    if (SEA.t < SEA.life && B.st === "fight" && api.player.dead <= 0 && pl.y < Y + 0.9 && Math.hypot(pl.x - C.x, pl.z - C.z) < C.wall) {
      const [ux, uz] = away(C.x, C.z);
      api.hurt(1, ux * 0.3, uz * 0.3, "dark");
    }
    // the comet falls
    if (COMET.on) COMET.t += dt;
    // Finn can't walk through him
    const px = pl.x - B.x, pz = pl.z - B.z, pd = Math.hypot(px, pz), R = bodyR() + 0.42;
    if (!B.hidden && B.st !== "rest" && pd < R && pl.y < B.y + tall() && pl.y + 1.6 > B.y) {
      const [ux, uz] = away(B.x, B.z);
      pl.x = B.x + ux * R;
      pl.z = B.z + uz * R;
    }
    // a fight can't go on without Finn in the cave (a debug teleport)
    if ((B.st === "fight" || B.st === "intro") && !inCave() && api.player.dead <= 0) off();
    // the Enchiridion, back to the hero
    if (reward.on) {
      reward.t += dt;
      reward.y = Y + 1.3 + Math.max(0, 2.3 - reward.t * 1.1);
      if (reward.t > 2 && Math.hypot(pl.x - reward.x, pl.z - reward.z) < 2 && Math.abs(pl.y - (Y + 1.2)) < 2.6 && api.player.dead <= 0) {
        reward.on = false;
        api.burst(reward.x, reward.y, reward.z, 40, [0xffe8a0, 0xffffff, 0x7dff5a], 6, 6, 0.5, 1.2);
        B.st = "off";
        hud(false);
        api.onBook();
      }
    }
  }

  // ── what the sword, Jake and main.js ask of him ──
  function hurt(n, nx, nz) {
    if (!hittable()) return false;
    B.hp = Math.max(0, B.hp - n);
    B.flash = 0.1;
    B.hurtT = 0.25;
    if (!B.dash) { B.kx += nx * (n > 1 ? 1.6 : 0.7); B.kz += nz * (n > 1 ? 1.6 : 0.7); }
    api.sfx(n > 1 ? "hitBig" : "hit");
    if (++B.voice % 3 === 0 || n > 1) api.sfx("bossHurt");
    if (B.saidT > 5 && Math.random() < 0.3) { B.saidT = 0; say(pick(STR.lich.hurt), 1.6); }
    api.burst(B.x, B.y + 2, B.z, 5 + 3 * n, [0xffffff, 0x7dff5a, B.form ? 0xe4ead8 : 0x86a096], 4, 4);
    glowBurst(B.x, B.y + 2.2, B.z, 4 + 2 * n, [0xffffff, 0x9dff5a], 3, 0.4);
    // too many blows at once (not while he's catching his breath): a burst round him
    B.heat += n;
    if (B.heat >= K.counter.dmg[B.phase] && B.counterCd <= 0 && B.pose !== "spent" && B.pose !== "land" && B.hp > n) {
      B.heat = 0;
      B.counterCd = K.counter.cd;
      say(pick(STR.lich.shout.counter), 1.6);
      api.sfx("hiss");
      castBar(B.form ? "dark" : "counter", K.counter.warn);
      hazard({ shape: CIRCLE, x: B.x, z: B.z, y: B.y, r: K.counter.r[B.form], warn: K.counter.warn, onFire: counterHit });
      glowBurst(B.x, B.y + 1.5, B.z, 30, [0x3aff4a, 0xd8ffc0], 2.5, 0.7);
    }
    // Finn doesn't heal on his own in the fight: every so many blows a heart falls out of him
    B.dropAcc += n;
    if (B.dropAcc >= K.heartEvery && B.hp > 0) {
      B.dropAcc -= K.heartEvery;
      const q = clampIn(B.x + (pl.x - B.x) * 0.4, B.z + (pl.z - B.z) * 0.4, C.r - 2);
      api.dropHeart(q.x, Y + 2.5 + heapTop(q.x, q.z), q.z);
      api.sfx("ready");
      if (B.saidT > 2) { B.saidT = 0; say(pick(STR.lich.dropped), 1.8); }
    }
    const f = B.hp / K.hp[B.form];
    if (B.nextPhase < 1 && f <= K.phase2) B.nextPhase = 1;
    if (B.nextPhase < 2 && f <= K.phase3) B.nextPhase = 2;
    if (B.hp <= 0) {
      HZ.cancel();
      timers.length = 0;
      burns.length = 0;
      for (const w of waves) w.on = false;
      FALL.on = false;
      B.stopT = 0;
      if (B.form === 0) {
        B.script = tear();
        B.script.next();
      } else {
        clearSkels();
        B.st = "down";
        B.dead = true;
        B.script = lost();
        B.script.next();
      }
      return true;
    }
    return false;
  }
  B.hurt = hurt;
  /** The sword swing sw (main.js SWING) from Finn: true if it hit him or a skeleton. */
  function swordHit(sw, heading) {
    let n = 0;
    for (const e of skels) {
      if (!e.on || e.st === "rise") continue;
      const dx = e.x - pl.x, dz = e.z - pl.z, d = Math.hypot(dx, dz);
      if (d > sw.range + 0.6 || Math.abs(e.y - pl.y) > 2.2) continue;
      if (Math.abs(wrap(Math.atan2(dx, dz) - heading)) > sw.arc && d > 1.3) continue;
      api.fx.star(e.x - (dx / (d || 1)) * 0.4, e.y + 1.2, e.z - (dz / (d || 1)) * 0.4, 0.95, sw.spark);
      hurtSkel(e, sw.dmg, dx / (d || 1), dz / (d || 1));
      n++;
    }
    if (hittable()) {
      const dx = B.x - pl.x, dz = B.z - pl.z, d = Math.hypot(dx, dz), R = bodyR();
      if (d <= sw.range + R && pl.y + 2.3 >= B.y && pl.y <= B.y + tall() && (Math.abs(wrap(Math.atan2(dx, dz) - heading)) <= sw.arc || d <= R + 1.2)) {
        const nx = dx / (d || 1), nz = dz / (d || 1);
        api.fx.star(B.x - nx * R * 0.85, clamp(pl.y + 1.1, B.y + 0.6, B.y + 4), B.z - nz * R * 0.85, sw.heavy ? 1.35 : 0.95, sw.spark);
        hurt(sw.dmg, nx, nz);
        n++;
      }
    }
    return n > 0;
  }

  // ── every rendered frame ──
  // arm poses: [shoulder x, y, z, elbow] (s: -1 his left, +1 his right); legs (form 0): hip x
  const mine = (s) => s === B.side;
  const SKIN_ARMS = {
    idle: (s, t) => [-0.45 + 0.05 * Math.sin(t * 2 + s), 0, s * 0.32, -0.75],
    walk: (s, t, ph) => [-0.35 + s * Math.sin(ph) * 0.6, 0, s * 0.28, -0.95],
    clawWind: (s) => (mine(s) ? [-2.0, 0, s * 1.25, -0.4] : [-0.6, 0, s * 0.4, -1.0]),
    claw: (s) => (mine(s) ? [-1.2, 0, -s * 0.55, -0.15] : [-0.3, 0, s * 0.55, -0.6]),
    kickWind: (s) => [-0.9, 0, s * 0.95, -0.6],
    kick: (s) => [0.45, 0, s * 1.15, -0.2],
    crouch: (s) => [0.5, 0, s * 0.6, -0.6],
    air: (s) => [-2.6, 0, s * 0.45, -0.3],
    land: (s) => [-0.3, 0, s * 0.95, -0.2],
    punchUp: (s, t) => [-2.9 + 0.08 * Math.sin(t * 22), 0, s * 0.2, -0.5],
    punchGo: (s) => [-0.6, 0, s * 0.18, -0.1],
    cast: (s) => (mine(s) ? [-1.65, 0, s * 0.15, -0.15] : [-0.5, 0, s * 0.5, -1.2]),
    inferno: (s, t) => [-2.8 + 0.1 * Math.sin(t * 25 + s), 0, s * 0.7, -0.3],
    infernoGo: (s) => [-0.4, 0, s * 0.3, -0.1],
    rage: (s, t) => [-2.2, 0, s * 1.0, -1.0 + 0.4 * Math.sin(t * 22 + s)],
    tear: (s, t) => [-1.0 + 0.2 * Math.sin(t * 30 + s), 0, s * 1.4, -1.6 + 0.3 * Math.sin(t * 26)],
    gloat: (s) => [-2.4, 0, s * 0.6, -0.6],
  };
  const SKIN_LEGS = {
    walk: (s, t, ph) => s * Math.sin(ph) * 0.65,
    kickWind: (s) => (s > 0 ? 0.9 : -0.1),
    kick: (s) => (s > 0 ? -1.55 : 0.35),
    crouch: (s) => -0.5,
    air: (s) => (s > 0 ? -0.9 : -0.3),
    land: (s) => (s > 0 ? -0.6 : 0.2),
    tear: () => -1.2,
    infernoGo: () => -0.5,
  };
  const SKIN_LEAN = { clawWind: -0.1, claw: 0.35, kickWind: 0.25, kick: -0.3, crouch: 0.45, land: 0.5, punchUp: -0.2, punchGo: 0.65, inferno: -0.25, infernoGo: 0.7, rage: -0.15, tear: 0.55, gloat: -0.2 };
  const LICH_ARMS = {
    idle: (s, t) => [-0.55 + 0.06 * Math.sin(t * 1.7 + s), 0, s * 0.38, -0.95],
    cast: (s, t) => (mine(s) ? [-1.55, 0, s * 0.2, -0.25 + 0.1 * Math.sin(t * 14)] : [-1.2, 0, s * 0.45, -0.6]),
    castUp: (s, t) => [-2.9, 0, s * 0.35, -0.2 + 0.1 * Math.sin(t * 12 + s)],
    breathIn: (s) => [0.3, 0, s * 0.85, -0.5],
    breath: (s) => [0.45, 0, s * 1.05, -0.2],
    stop: (s) => (s > 0 ? [-1.6, 0, 0.12, -0.05] : [-0.4, 0, -0.4, -0.9]),
    summon: (s, t) => [-0.2, 0, s * (1.15 + 0.05 * Math.sin(t * 8)), -0.2],
    comet: (s) => (s > 0 ? [-3.0, 0, 0.2, -0.1] : [-0.6, 0, -0.5, -0.8]),
    cometGo: (s) => (s > 0 ? [-1.0, 0, 0.2, -0.1] : [-0.6, 0, -0.5, -0.8]),
    fall: (s, t) => [-2.6, 0, s * (1.25 + 0.05 * Math.sin(t * 6)), -0.3],
    spent: (s) => [0.1, 0, s * 0.3, -0.2],
    rage: (s, t) => [-2.3, 0, s * 1.1, -0.8 + 0.4 * Math.sin(t * 20 + s)],
    down: (s, t) => [-2.0 + 0.3 * Math.sin(t * 24 + s), 0, s * 1.3, -0.4],
    gloat: (s) => [-2.2, 0, s * 0.8, -0.5],
  };
  const LICH_LEAN = { cast: -0.05, castUp: -0.2, breathIn: -0.25, breath: 0.35, stop: 0.1, summon: 0.2, comet: -0.2, cometGo: 0.3, fall: -0.3, spent: 0.4, rage: -0.2, down: -0.3 };
  const CHARGE = { cast: 1, castUp: 1, stop: 0.7, summon: 1, comet: 1, fall: 1, rage: 0.6, inferno: 1, punchUp: 0.8, breathIn: 0.3, kickWind: 0.6, clawWind: 0.7 };
  function pose(dt, t) {
    const m = B.model, U = m.userData, k = 1 - Math.exp(-14 * dt), p = B.pose, hk = Math.max(0, B.hurtT / 0.25);
    const moving = !B.form && Math.hypot(B.vx, B.vz) > 1.2 && B.air < 0.3;
    const key = moving && p === "idle" ? "walk" : p;
    const TBL = B.form ? LICH_ARMS : SKIN_ARMS, fn = TBL[key] || TBL.idle, ph = B.stride * 1.25;
    U.arms.forEach((A, i) => {
      const s = i ? 1 : -1, [x, y, z, e] = fn(s, t, ph);
      A.sh.rotation.set(lerp(A.sh.rotation.x, x - 0.5 * hk, k), lerp(A.sh.rotation.y, y, k), lerp(A.sh.rotation.z, z + s * 0.6 * hk, k));
      A.el.rotation.x = lerp(A.el.rotation.x, e, k);
    });
    if (U.legs) U.legs.forEach((L, i) => {
      const s = i ? 1 : -1, f = SKIN_LEGS[key];
      L.hip.rotation.x = lerp(L.hip.rotation.x, f ? f(s, t, ph) : 0, k);
    });
    const lean = (B.form ? LICH_LEAN : SKIN_LEAN)[key] ?? (moving ? 0.25 : 0);
    m.rotation.x = lerp(m.rotation.x, lean, 1 - Math.exp(-8 * dt));
    U.head.rotation.set((p === "breath" ? 0.35 : p === "breathIn" ? -0.3 : p === "spent" ? 0.3 : 0.04 * Math.sin(t * 0.8)) - 0.4 * hk,
      0.1 * Math.sin(t * 0.5), (p === "rage" || p === "tear" || p === "down" ? 0.08 * Math.sin(t * 40) : 0));
    // his true form's jaw drops open while he casts, breathes and roars
    if (U.jaw) {
      const open = p === "rage" || p === "fall" || p === "down" ? 0.5 + 0.08 * Math.sin(t * 30) : p === "breath" ? 0.55 : CHARGE[p] ? 0.28 + 0.05 * Math.sin(t * 9) : p === "spent" ? 0.18 : 0.04 + 0.03 * Math.sin(t * 1.3);
      U.jaw.rotation.x = lerp(U.jaw.rotation.x, open + 0.3 * hk, k);
    }
    U.body.scale.y = 1 + 0.015 * Math.sin(t * 2.1) + (p === "crouch" ? -0.08 : 0);
    // kneeling while he tears the skin off (and the drop of his legs)
    U.body.position.y = lerp(U.body.position.y, p === "tear" ? -0.35 : p === "crouch" ? -0.12 : 0, k);
    const ch = (CHARGE[p] || 0) * Math.min(1, B.poseT / 0.35);
    for (const g of hands[B.form]) g.scale.setScalar(0.001 + ch * (0.075 + 0.02 * Math.sin(t * 25)));
    const M = B.form ? lichM : skinM;
    for (let i = 0; i < M.mats.length; i++) {
      if (B.flash > 0) M.mats[i].emissive.setRGB(1, 1, 1);
      else M.mats[i].emissive.copy(M.base[i]).addScalar(B.phase * 0.02);
    }
  }
  const AURA = [0x6aff4a, 0x9dff5a, 0xd8ffc0];
  function effects(dt, t, camera, near, show) {
    // his aura: green motes drifting up off him (dark smoke too, in his true form)
    if (show && B.st !== "rest") {
      const mp = B.model.position;
      for (let k = count(14 + 10 * B.phase, dt); k > 0; k--) {
        const a = Math.random() * TAU, r = 0.5 + Math.random() * 0.8;
        glow(mp.x + Math.sin(a) * r, mp.y + Math.random() * tall(), mp.z + Math.cos(a) * r, AURA[B.phase], 0, 1 + Math.random() * 1.2, 0, 0.9, 0.5);
      }
      if (B.form && Math.random() < dt * 6) smoke(mp.x + (Math.random() - 0.5), mp.y + 0.3, mp.z + (Math.random() - 0.5), 0, 0.5, 0, 1.6, 1, 3, 0.35);
      if (CHARGE[B.pose]) for (const g of hands[B.form]) {
        g.getWorldPosition(_w);
        for (let k = count(24, dt); k > 0; k--) glow(_w.x, _w.y, _w.z, Math.random() < 0.5 ? 0xffffff : 0x7dff5a, (Math.random() - 0.5) * 3, Math.random() * 2.5, (Math.random() - 0.5) * 3, 0.35, 3);
      }
      // his eyes burn: two little flames off the sockets of his true form
      if (B.form && Math.random() < dt * 30) {
        B.model.userData.head.getWorldPosition(_w);
        glow(_w.x + (Math.random() - 0.5) * 0.4, _w.y + 0.1, _w.z + (Math.random() - 0.5) * 0.4, 0x9dff5a, 0, 1.5, 0, 0.4, 0.5);
      }
    }
    // the tear: light pouring out of him
    if (B.tearT > 0) for (let k = count(90, dt); k > 0; k--) glow(B.x + (Math.random() - 0.5) * 1.4, B.y + Math.random() * 4.5, B.z + (Math.random() - 0.5) * 1.4, Math.random() < 0.5 ? 0xffffff : 0x7dff5a, (Math.random() - 0.5) * 7, Math.random() * 5, (Math.random() - 0.5) * 7, 0.5, 1.5);
    // a little ritual circle under him while he works magic
    SIG.k += ((near && show && CHARGE[B.pose] && B.st === "fight" ? 1 : 0) - SIG.k) * (1 - Math.exp(-8 * dt));
    bossSigil.visible = SIG.k > 0.02;
    if (bossSigil.visible) {
      bossSigil.position.set(B.model.position.x, Y + heapTop(B.x, B.z) + 0.07, B.model.position.z);
      bossSigil.scale.setScalar((2.2 + 0.15 * Math.sin(t * 6)) * SIG.k);
      bossSigil.rotation.y = t * 1.6;
      bossSigil.material.color.setHex(0x4aff4a).multiplyScalar(SIG.k * (0.8 + 0.2 * Math.sin(t * 12)));
    }
    for (const s of sigils) {
      s.t += dt;
      s.m.visible = near && s.t < s.life;
      if (!s.m.visible) continue;
      const pop = Math.min(1, s.t / 0.25), fade = Math.min(1, (s.life - s.t) / 0.3);
      s.m.scale.setScalar(s.r * (0.3 + 0.7 * pop) * (1 + 0.05 * Math.sin(t * 8)));
      s.m.rotation.y = -t * s.spin;
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
    // embers off the skeletons' eyes
    for (const e of skels) if (e.on && Math.random() < dt * 5) glow(e.model.position.x, e.model.position.y + 1.72, e.model.position.z, 0x9dff5a, 0, 1, 0, 0.5, 0.5);
    drawArcs(dt, camera.position);
    stepGlow(dt);
    stepSmoke(dt);
  }
  function update(dt, alpha, t, camera) {
    const near = B.st !== "off" && camera.position.distanceTo(_v.set(C.x, Y, C.z)) < 150;
    FT.value = t;
    const hk = HOT[B.form ? Math.min(2, B.phase + 1) : B.phase];
    FC.value.setHex(hk[0]);
    FE.value.setHex(hk[1]);
    smokeMat.uniforms.uH.value = innerHeight * Math.min(devicePixelRatio, 1.5) * 0.5;
    // his bodies: the skin, the Lich; while the skin tears they flicker
    const show = near && !B.hidden;
    const flick = B.tearT > 0 && B.form === 0 && B.tearT > 0.4 && Math.floor(B.tearT * 12) % 2 === 0;
    skin.visible = show && (B.form === 0) && !flick;
    lich.visible = show && (B.form === 1 || flick);
    shadow.visible = show;
    if (show) {
      for (const m of [skin, lich]) {
        if (!m.visible) continue;
        const bob = m === lich && B.st !== "down" ? Math.sin(t * 2.1) * 0.15 : 0;
        m.position.set(lerp(B.px, B.x, alpha), lerp(B.py, B.y, alpha) + bob, lerp(B.pz, B.z, alpha));
        m.rotation.y = B.pface + wrap(B.face - B.pface) * alpha;
      }
      if (B.form === 0 || !flick) pose(dt, t);
      const g = Y + heapTop(B.x, B.z);
      shadow.position.set(B.model.position.x, g + 0.07, B.model.position.z);
      shadow.scale.setScalar(1.1 * clamp(1 - (B.y - g) / 14, 0.4, 1));
    }
    bubble.visible = near && show && B.armor && (B.st === "fight") && !FALL.on && FALL.blast > 1;
    if (bubble.visible) {
      bubble.position.set(B.model.position.x, B.model.position.y + tall() * 0.5, B.model.position.z);
      bubble.scale.setScalar(tall() * 0.6 + 0.1 * Math.sin(t * 6));
    }
    HZ.draw(t);
    // flame columns
    let any = false;
    for (let i = 0; i < FN; i++) {
      const c = cols[i];
      if (c.on) { c.t += dt; if (c.t >= c.life) c.on = false; }
      if (!c.on || c.t < 0) {
        if (c.shown) { colMesh.setMatrixAt(i * 2, _m4.makeScale(0, 0, 0)); colMesh.setMatrixAt(i * 2 + 1, _m4.makeScale(0, 0, 0)); c.shown = false; }
        continue;
      }
      any = c.shown = true;
      const up = c.t < c.rise ? 1 - (1 - c.t / c.rise) ** 3 : 1, fade = Math.min(1, (c.life - c.t) / 0.3), h = c.h * up * (0.92 + 0.08 * Math.sin(t * 23 + i)) * (0.6 + 0.4 * fade);
      _q.identity();
      colMesh.setMatrixAt(i * 2, _m4.compose(_p.set(c.x, c.y, c.z), _q, _s.set(c.r * (0.8 + 0.2 * fade), Math.max(0.01, h), c.r * (0.8 + 0.2 * fade))));
      colMesh.setMatrixAt(i * 2 + 1, _m4.compose(_p, _q, _s.set(c.r * 0.5, Math.max(0.01, h * 0.75), c.r * 0.5)));
      colMesh.setColorAt(i * 2, _c.setScalar(c.hot * fade * 0.85));
      colMesh.setColorAt(i * 2 + 1, _c.setScalar(c.hot * fade));
    }
    colMesh.visible = any && near;
    if (any) { colMesh.instanceMatrix.needsUpdate = true; colMesh.instanceColor.needsUpdate = true; }
    for (const w of waves) {
      w.m.visible = near && w.on && w.t >= 0;
      if (!w.m.visible) continue;
      const r = lerp(w.pr, w.r, alpha);
      w.m.position.set(w.x, Y, w.z);
      w.m.scale.set(r, 1.6 + 0.15 * Math.sin(t * 20), r);
      w.m.material.uniforms.uRep.value = Math.max(8, Math.round(r * 1.6));
    }
    // the floor: glowing veins while the inferno is coming, then flat green fire
    sea.visible = near && (SEA.warn > 0 || SEA.t < SEA.life);
    if (sea.visible) {
      seaMat.uniforms.uWarn.value = SEA.warn;
      seaMat.uniforms.uFade.value = SEA.t < SEA.life ? Math.min(1, SEA.t / 0.1) * Math.min(1, (SEA.life - SEA.t) / 1.2) : 0;
      if (SEA.t < SEA.life) for (let k = count(40, dt); k > 0; k--) { const q = anywhere(C.wall - 1); glow(q.x, Y + 0.3, q.z, Math.random() < 0.3 ? 0xd8ffc0 : 0x3aff4a, 0, 2 + Math.random() * 3, 0, 0.8, 0.3); }
    }
    // fireballs (lobbed) and their trails
    any = false;
    for (let i = 0; i < BN; i++) {
      const b = balls[i];
      if (b.on) {
        b.t += dt;
        const u = Math.min(1, b.t / b.dur);
        b.x = lerp(b.x0, b.x1, u);
        b.z = lerp(b.z0, b.z1, u);
        b.y = lerp(b.y0, b.y1 + 0.4, u) + 4 * b.arc * u * (1 - u);
        if (Math.random() < dt * 40) glow(b.x, b.y, b.z, Math.random() < 0.5 ? 0x7dff5a : 0xd8ffc0, (Math.random() - 0.5), 0.5, (Math.random() - 0.5), 0.4, 1);
        if (u >= 1) b.on = false;
      }
      if (!b.on) {
        if (b.shown) { ballMesh.setMatrixAt(i * 2, _m4.makeScale(0, 0, 0)); ballMesh.setMatrixAt(i * 2 + 1, _m4.makeScale(0, 0, 0)); b.shown = false; }
        continue;
      }
      any = b.shown = true;
      _q.identity();
      const s = b.s * (0.95 + 0.1 * Math.sin(t * 30 + i));
      ballMesh.setMatrixAt(i * 2, _m4.compose(_p.set(b.x, b.y, b.z), _q, _s.set(s * 0.6, s * 0.6, s * 0.6)));
      ballMesh.setColorAt(i * 2, _c.setHex(0x3aff4a));
      ballMesh.setMatrixAt(i * 2 + 1, _m4.compose(_p, _q, _s.set(s * 0.32, s * 0.32, s * 0.32)));
      ballMesh.setColorAt(i * 2 + 1, _c.setHex(0xeaffd0));
    }
    ballMesh.visible = any && near;
    if (any) { ballMesh.instanceMatrix.needsUpdate = true; ballMesh.instanceColor.needsUpdate = true; }
    // bone spikes: they burst up and sink back
    any = false;
    for (let i = 0; i < SPN; i++) {
      const s = spikes[i];
      if (!s.on || s.t < 0) {
        if (s.shown) { spikeMesh.setMatrixAt(i, _m4.makeScale(0, 0, 0)); s.shown = false; }
        continue;
      }
      any = s.shown = true;
      const rise = 0.12, u = s.t < rise ? s.t / rise : 1, kk = s.t < rise ? 1 + 2.2 * (u - 1) ** 3 + 1.2 * (u - 1) ** 2 : s.t > s.life - 0.3 ? Math.max(0, (s.life - s.t) / 0.3) : 1;
      _e.set(s.rx, s.ry, s.rz);
      _q.setFromEuler(_e);
      spikeMesh.setMatrixAt(i, _m4.compose(_p.set(s.x, s.y - 0.2, s.z), _q, _s.set(s.s, Math.max(0.001, s.s * kk), s.s)));
    }
    spikeMesh.visible = any && near;
    if (any) spikeMesh.instanceMatrix.needsUpdate = true;
    // the comet
    comet.visible = cometGlow.visible = near && COMET.on;
    if (comet.visible) {
      const u = clamp(COMET.t / COMET.dur, 0, 1), e = u * u;
      comet.position.set(lerp(COMET.x0, COMET.x, e), lerp(COMET.y0, COMET.y + 0.8, e), lerp(COMET.z0, COMET.z, e));
      comet.scale.setScalar(1.1 + u * 1.3);
      cometGlow.position.copy(comet.position);
      cometGlow.scale.setScalar(7 + u * 6);
      for (let k = count(90, dt); k > 0; k--) glow(comet.position.x + (Math.random() - 0.5), comet.position.y + (Math.random() - 0.5), comet.position.z + (Math.random() - 0.5), Math.random() < 0.4 ? 0xd8ffc0 : 0x3aff4a, (COMET.x0 - COMET.x) * 0.15 + (Math.random() - 0.5) * 2, 1 + Math.random() * 2, (COMET.z0 - COMET.z) * 0.15 + (Math.random() - 0.5) * 2, 0.7, 1);
    }
    // skeletons
    for (const e of skels) {
      e.model.visible = e.shadow.visible = near && e.on;
      if (!e.model.visible) continue;
      const m = e.model, u = m.userData;
      m.position.set(lerp(e.px, e.x, alpha), lerp(e.py, e.y, alpha), lerp(e.pz, e.z, alpha));
      m.rotation.y = e.pface + wrap(e.face - e.pface) * alpha;
      const ph = e.stride * 2.4, walk = e.st === "walk";
      u.legs.forEach((L, i) => (L.rotation.x = walk ? (i ? 1 : -1) * Math.sin(ph) * 0.6 : 0));
      u.arms.forEach((A, i) => {
        let x = walk ? (i ? -1 : 1) * Math.sin(ph) * 0.5 : -0.2;
        if (i === 1 && e.st === "wind") x = -2.4 - 0.1 * Math.sin(t * 30);
        if (i === 1 && e.st === "swing") x = lerp(-2.4, 0.4, Math.min(1, e.t / 0.12));
        A.rotation.x = lerp(A.rotation.x, x, 1 - Math.exp(-18 * dt));
      });
      u.body.rotation.z = e.st === "stagger" ? 0.25 * Math.sin(t * 30) : 0.04 * Math.sin(t * 5 + e.seed);
      u.body.rotation.x = e.st === "wind" ? -0.15 : e.st === "swing" ? 0.3 : 0.05;
      e.shadow.position.set(m.position.x, Y + 0.06, m.position.z);
    }
    // "Fall": the dark comes down, souls pour out of every heap into the orb over his hands
    const fk = FALL.on ? clamp(FALL.t / (FALL.warn * 0.4), 0, 1) : 0;
    if (FALL.on) {
      FALL.t += dt;
      _w.set(B.model.position.x, B.model.position.y + tall() + 1.2, B.model.position.z);
      const g = clamp(FALL.t / (FALL.warn * 0.9), 0, 1);
      orb.position.copy(_w);
      orb.scale.setScalar(0.3 + g * 2.6 + 0.08 * Math.sin(t * 17));
      orbGlow.position.copy(_w);
      orbGlow.scale.setScalar(4 + g * 12);
      for (let k = count(70 + 90 * g, dt); k > 0; k--) {
        const h = C.heaps[Math.floor(Math.random() * C.heaps.length)], a = Math.random() * TAU, d = Math.random() * h.R * 0.8;
        soul(h.x + Math.sin(a) * d, Y + Math.random() * h.H, h.z + Math.cos(a) * d, Math.random() < 0.7 ? 0x7dff5a : 0xd8ffc0, orb.position, 1.6 + Math.random());
      }
      if (Math.random() < dt * 6) { const q = anywhere(); zap(_a.copy(orb.position), _b.set(q.x, Y + 0.2, q.z), 0.18, 1.6, 1); }
      if (Math.random() < dt * 10) smoke(orb.position.x + (Math.random() - 0.5) * 3, orb.position.y + (Math.random() - 0.5) * 3, orb.position.z + (Math.random() - 0.5) * 3, 0, 0, 0, 1.2, 2, 5, 0.5);
    }
    orb.visible = orbGlow.visible = near && FALL.on;
    FALL.dark += ((FALL.on ? 1 : 0) - FALL.dark) * (1 - Math.exp(-(FALL.on ? 1.5 : 0.8) * dt));
    C.fx.dark = FALL.dark;
    bigSigil.visible = near && FALL.on;
    if (bigSigil.visible) {
      bigSigil.rotation.y = -t * (0.3 + fk * 1.2);
      bigSigil.material.color.setHex(0x3aff4a).multiplyScalar(fk * (0.5 + 0.3 * Math.sin(t * 9)));
    }
    // the blast: a sphere of green light racing out of him, a dark wave behind it
    FALL.blast += dt;
    shock.visible = shockDark.visible = near && FALL.blast < 1.1;
    if (shock.visible) {
      const u = FALL.blast / 1.1, r = 2 + (1 - (1 - u) ** 3) * 55;
      shock.position.set(B.x, B.y + 2, B.z);
      shockDark.position.copy(shock.position);
      shock.scale.setScalar(r);
      shockDark.scale.setScalar(r * 0.92);
      shock.material.opacity = 0.6 * (1 - u);
      shockDark.material.opacity = 0.7 * (1 - u);
    }
    // the Enchiridion's light (form 1: it glows; while "Fall" comes, it shelters)
    const holyOn = near && B.form === 1 && (B.st === "fight" || B.st === "down");
    HOLY.k += ((holyOn ? (FALL.on ? 1 : 0.25) : 0) - HOLY.k) * (1 - Math.exp(-3 * dt));
    HOLY.flash = Math.max(0, HOLY.flash - dt * 1.2);
    dome.visible = column.visible = holyRing.visible = HOLY.k > 0.02;
    if (dome.visible) {
      const R = K.fall.safe, yb = Y + heapTop(C.x, C.z) * 0.5;
      dome.position.set(C.x, Y, C.z);
      dome.scale.set(R, R * 0.9 * (0.4 + 0.6 * HOLY.k), R);
      dome.material.opacity = (0.08 + 0.3 * HOLY.k + HOLY.flash * 0.6) * (0.9 + 0.1 * Math.sin(t * 7));
      column.position.set(C.x, yb, C.z);
      column.scale.set(R * 0.35, 20 * HOLY.k, R * 0.35);
      column.material.opacity = 0.05 + 0.2 * HOLY.k + HOLY.flash * 0.3;
      holyRing.position.set(C.x, Y + 0.12, C.z);
      holyRing.scale.setScalar(R);
      holyRing.material.opacity = 0.3 + 0.6 * HOLY.k;
      for (let k = count(10 + 60 * HOLY.k, dt); k > 0; k--) {
        const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * R;
        glow(C.x + Math.sin(a) * r, Y + 0.3 + Math.random() * 1.5, C.z + Math.cos(a) * r, Math.random() < 0.6 ? 0xffe8a0 : 0xffffff, 0, 1.5 + Math.random() * 2, 0, 1, 0.3);
      }
    }
    // the Enchiridion won back: it comes down, spinning, gold
    if (reward.on && near && Math.random() < dt * 20) glow(reward.x + (Math.random() - 0.5) * 1.5, reward.y + (Math.random() - 0.5), reward.z + (Math.random() - 0.5) * 1.5, Math.random() < 0.6 ? 0xffe8a0 : 0xffffff, 0, 1.5, 0, 0.9, 0.5);
    // "Stop": the cave goes still, night-grey
    const stopping = near && B.stopT > 0;
    document.body.classList.toggle("lichStop", stopping);
    effects(dt, t, camera, near, show);
    if (B.cast) $("bossCastFill").style.width = clamp(B.cast.t / B.cast.dur, 0, 1) * 100 + "%";
    if (B.st === "fight" || B.st === "down" || B.st === "intro") hudHp(dt);
  }
  return {
    B, K, hazards: HZ.list, burns, waves, skels,
    /** The Lich as a target for the sword's aim, Jake's punches and the giant fist (null: not now). */
    foe: () => (hittable() ? B : null),
    /** His skeletons, for Jake to punch (and the sword's aim). */
    minions: () => skels.filter((e) => e.on && e.st !== "rise"),
    fighting: () => B.st === "fight" || B.st === "down" || B.st === "intro",
    /** Finn is held by "Stop": he can't move. */
    rooted: () => B.stopT > 0 && B.st === "fight",
    /** Where the Enchiridion floats while they fight (null: not fighting; lich.js keeps it there). */
    book: () => (B.st === "off" ? null : reward.on ? reward : { x: C.x, y: Y + 3.4, z: C.z }),
    /** How dark "Fall" has made the cave (0..1), for the sky and the fog. */
    dark: () => FALL.dark,
    swordHit,
    step,
    update,
    enter,
    off,
    /** Finn fainted: he gloats; main.js takes Finn back to the way in and calls off(). */
    finnDown: () => {
      if (!(B.st === "fight" || B.st === "intro")) return;
      say(pick(STR.lich.finnDown), 3);
      B.script = null;
      HZ.cancel();
      timers.length = 0;
      burns.length = 0;
      clearSkels();
      FALL.on = COMET.on = false;
      B.stopT = 0;
      SEA.warn = 0;
      B.st = "gloat";
      B.dead = true;
      B.armor = true;
      setPose("gloat");
    },
    say,
  };
}
