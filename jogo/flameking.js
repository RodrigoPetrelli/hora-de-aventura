// The Flame King fight in the Colosseum of Flames (ARENA in colosseum.js), where Flame Princess sends
// Finn and Jake through the flames (main.js). Her father is huge: he walks the arena in his copper
// armour, and every area attack marks its ground first (hazards.js):
//   fireball  Fireballs: he hurls them at Finn one after another, lobbed (a circle where each lands;
//             it leaves a patch of fire burning a moment: fire on the floor burns)
//   pillars   Pillars of Fire: circles on Finn one after another, then columns of flame shoot up out
//             of them (they burn while they stand); in the blue flame he cages Finn in a ring of them
//             first, with one more in the middle a moment later: stay in, then get out
//   stomp     Stomp: he lifts a foot and stamps (a circle round it) and a wall of fire runs out along
//             the floor from it: jump it
//   slam      Ground Punch: both fists into the floor; bands crack open toward Finn and lava erupts
//             along them; his fists stay stuck a moment (the time to hit him)
//   charge    Royal Charge: he lowers his head (a band to the wall) and runs it down, leaving fire
//             behind; charging into a column knocks him silly
//   leap      Royal Leap (from 60%): up into the air; a circle chases Finn, locks, he lands on it (a
//             wall of fire runs out from there too) and has to get up
//   meteor    Meteor Rain (from 60%): fireballs fall out of the sky all over the arena
//   sun       The King's Sun (below 30%, and the moment he gets there): he goes to the middle and
//             raises a giant fireball over his head, then brings it down onto the floor: the whole
//             arena burns but for the shade of the columns. Hide behind one.
// At 60% and 30% hp he flares up (a white-hot fire, then the blue flame) and drops a heart. From 60%
// on, pile too many blows on him at once and he answers with an Eruption round his feet. Beaten,
// his flame leaves the armour (it slumps, empty) and flies home to its lantern; the first time the
// Flame Heart is left floating (one more heart) and the gate opens: the way out. If Finn faints, the
// fight is over: he wakes up by Flame Princess in her throne room.
// Attack scripts are generators stepped with the physics dt (deterministic under __game.sim).
import * as THREE from "three";
import { makeNpc, poseNpc, FLAME_KING_FIRE } from "./npcs.js";
import { toon, noOutline } from "./toon.js";
import { ARENA } from "./colosseum.js";
import { glowTexture } from "./lair.js";
import { makeShadow } from "./characters.js";
import { heartGeo } from "./fx.js";
import { makeCrystal, orbitCrystal } from "./crystals.js";
import { createHazards, CIRCLE, BAND } from "./hazards.js";
import { STR } from "./strings.js";

// hp, sizes (world units) and timings (s); arrays are per phase (100–60%, 60–30%, below 30%)
export const K = {
  hp: 230, scale: 2.3, body: 1.9, tall: 7.4, reach: 25, walk: [5.8, 7, 8], turn: [2.6, 3.2, 3.9],
  phase2: 0.6, phase3: 0.3, heartEvery: 60,
  fireball: { n: [5, 6, 7], every: [0.5, 0.42, 0.37], warn: [1.09, 0.96, 0.87], r: 2.8, burn: 3, burnR: 1.7, spread: [0, 0, 1] },
  meteor: { n: [0, 14, 17], every: [0, 0.18, 0.15], warn: 1.05, r: 3.0, onFinn: 0.35 },
  pillars: { n: [6, 7, 7], every: [0.44, 0.37, 0.34], warn: [0.97, 0.87, 0.8], r: 2.6, h: 16, burn: 0.9, extra: [0, 2, 2], cage: [0, 0, 1] },
  stomp: { warn: [0.84, 0.74, 0.68], r: 6.5, reps: [1, 2, 3], wave: [12, 13, 14] },
  slam: { warn: [1.05, 0.92, 0.84], w: 2.4, bands: [1, 3, 3], spread: 0.42, stuck: [1.3, 1.15, 1.0] },
  charge: { warn: [0.97, 0.84, 0.76], w: 2.6, speed: [24, 27.5, 30.5], reps: [1, 2, 3], daze: [1.0, 0.8, 0.7], crash: 3.0 },
  leap: { follow: [1.55, 1.37, 1.2], lock: [0.67, 0.58, 0.52], r: 6, chase: [9, 10, 11], daze: [1.6, 1.35, 1.15], wave: 12 },
  sun: { warn: [3.8, 3.2], dmg: 3, off: 6, rest: 2.6, h: 17, size: 5.5 },
  wave: { w: 0.75, h: 0.85 }, // a wall of fire running along the floor: Finn's feet above h clear it
  counter: { dmg: 8, window: 2.5, warn: 0.72, r: 7.5, cd: 7 },
};
// what each phase draws from (the bag is shuffled; he never repeats the last one)
const ORDER = [
  ["fireball", "pillars", "stomp", "slam", "charge"],
  ["fireball", "pillars", "stomp", "slam", "charge", "leap", "meteor"],
  ["fireball", "pillars", "stomp", "slam", "charge", "leap", "meteor", "sun"],
];
const TAU = Math.PI * 2, A = ARENA;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const turnToward = (a, b, max) => a + clamp(wrap(b - a), -max, max);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const lerp = (a, b, k) => a + (b - a) * k;
const $ = (id) => document.getElementById(id);
const FIRE = [0xff5a1a, 0xffb13b, 0xffe08a];
const additive = (color, o = {}) => noOutline(new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, ...o }));
// his flames by phase (the model's colours: npcs.js), and the colours of every fire he makes
const TINT = [
  { red: [0xff5a1a, 0xa02a00], orange: [0xff9a26, 0xc04400], yellow: [0xffd24a, 0xc08000] },
  { red: [0xff7a1a, 0xc04000], orange: [0xffbe4a, 0xe06a00], yellow: [0xfff0a0, 0xe0b040] },
  { red: [0x2a6aff, 0x1030b0], orange: [0x5ab0ff, 0x1a5ad0], yellow: [0xd8f0ff, 0x80c0ff] },
];
export const HOT = [[0xffdc8a, 0xff5a10], [0xffeaa0, 0xff7a18], [0xd8ecff, 0x2a6aff]]; // fire core, fire edge

// ── shaders: flame columns and walls (instanced or not), the burning floor, the Sun ──
export const NOISE = `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p, float per) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float x0 = mod(i.x, per);
  float x1 = mod(i.x + 1.0, per);
  return mix(mix(hash(vec2(x0, i.y)), hash(vec2(x1, i.y)), f.x), mix(hash(vec2(x0, i.y + 1.0)), hash(vec2(x1, i.y + 1.0)), f.x), f.y);
}`;
// (also Finn's Fire Wave: firewave.js)
export const FIRE_VS = `
varying vec2 vUv;
varying vec3 vTint;
varying float vRim;
void main() {
  vUv = uv;
  vTint = vec3(1.0);
  vec4 p = vec4(position, 1.0);
  vec3 n = normal;
#ifdef USE_INSTANCING
  p = instanceMatrix * p;
  n = mat3(instanceMatrix) * n;
#endif
#ifdef USE_INSTANCING_COLOR
  vTint = instanceColor;
#endif
  vec4 mv = modelViewMatrix * p;
  // 1 where the surface faces the camera, 0 at the silhouette: soft edges, a hot middle
  vRim = abs(dot(normalize(normalMatrix * n), normalize(-mv.xyz)));
  gl_Position = projectionMatrix * mv;
}`;
export const FIRE_FS = `
uniform float uTime;
uniform float uRep;
uniform vec3 uCore;
uniform vec3 uEdge;
varying vec2 vUv;
varying vec3 vTint;
varying float vRim;
${NOISE}
void main() {
  float y = vUv.y;
  float n = vnoise(vec2(vUv.x * uRep, y * 3.0 - uTime * 2.8), uRep) * 0.6 + vnoise(vec2(vUv.x * uRep * 2.3, y * 7.0 - uTime * 4.6), uRep * 2.3) * 0.4;
  // tongues of flame: ragged at the top, gaps between them, hottest low down and in the middle
  float a = smoothstep(0.0, 0.05, y) * (1.0 - smoothstep(0.25, 1.0, y + (n - 0.5) * 0.7));
  a *= smoothstep(0.28, 0.62, n + 0.2 * (1.0 - y)) * smoothstep(0.08, 0.5, vRim);
  float heat = (1.0 - y) * 0.55 + vRim * 0.35 + (n - 0.5) * 0.5;
  vec3 c = mix(uEdge, uCore, smoothstep(0.45, 0.95, heat));
  gl_FragColor = vec4(c * vTint, clamp(a * 0.9, 0.0, 1.0));
  #include <colorspace_fragment>
}`;
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
uniform vec3 uCore;
uniform vec3 uEdge;
uniform vec3 uClip;
uniform vec2 uC;
uniform vec4 uOcc[8];
uniform float uOccN;
varying vec2 vW;
${NOISE}
void main() {
  if (length(vW - uClip.xy) > uClip.z) discard;
  vec2 q = vW - uC;
  float qd = length(q);
  for (int i = 0; i < 8; i++) {
    if (float(i) >= uOccN) break;
    vec2 p = uOcc[i].xy - uC;
    float pd = length(p);
    if (qd < pd || pd < 0.1) continue;
    if (acos(clamp(dot(p, q) / (pd * qd), -1.0, 1.0)) < asin(min(1.0, uOcc[i].z / pd))) discard;
  }
  float n = vnoise(vW * 0.35 + vec2(0.0, -uTime * 1.6), 1e4) * 0.6 + vnoise(vW * 0.9 + vec2(uTime * 0.7, -uTime * 2.3), 1e4) * 0.4;
  gl_FragColor = vec4(mix(uCore, uEdge, smoothstep(0.25, 0.85, n)), uFade * (0.3 + 0.7 * n));
  #include <colorspace_fragment>
}`;
const SUN_VS = `
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
const SUN_FS = `
uniform float uTime;
uniform vec3 uCore;
uniform vec3 uEdge;
varying vec3 vP;
varying vec3 vN;
varying vec3 vV;
${NOISE}
void main() {
  float n = vnoise(vP.xy * 2.5 + vec2(uTime * 0.9, -uTime * 1.7), 1e4) * 0.5 + vnoise(vP.zy * 3.3 + vec2(-uTime * 1.3, uTime * 0.6), 1e4) * 0.5;
  float rim = 1.0 - abs(dot(normalize(vN), normalize(vV)));
  vec3 c = mix(uCore, uEdge, clamp(rim * 1.2 + (n - 0.5) * 0.9, 0.0, 1.0));
  gl_FragColor = vec4(c * (1.1 + 0.4 * n), 1.0);
  #include <colorspace_fragment>
}`;

/** A scorch mark: a black blotch with cracks glowing orange out of the middle. */
function scorchTexture() {
  const s = 256, c = document.createElement("canvas");
  c.width = c.height = s;
  const x = c.getContext("2d"), h = s / 2, g = x.createRadialGradient(h, h, 4, h, h, h);
  g.addColorStop(0, "rgba(10,4,2,0.9)");
  g.addColorStop(0.55, "rgba(30,10,4,0.6)");
  g.addColorStop(1, "rgba(30,10,4,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, s, s);
  x.strokeStyle = "rgba(255,150,40,0.95)";
  x.shadowColor = "#ff8a20";
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
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/** A crack in the floor, lava glowing in it: runs along v (the band's length). */
function crackTexture() {
  const w = 64, hh = 512, c = document.createElement("canvas");
  c.width = w;
  c.height = hh;
  const x = c.getContext("2d");
  x.lineCap = x.lineJoin = "round";
  for (const [lw, col, blur] of [[16, "rgba(20,6,2,0.85)", 0], [7, "rgba(255,120,30,1)", 12], [2.5, "rgba(255,240,170,1)", 6]]) {
    x.strokeStyle = col;
    x.lineWidth = lw;
    x.shadowColor = "#ff7a20";
    x.shadowBlur = blur;
    x.beginPath();
    for (let y = 0, px = w / 2; y <= hh; y += 24) {
      px = clamp(px + (Math.sin(y * 0.37) + Math.sin(y * 0.11)) * 7, 14, w - 14);
      y ? x.lineTo(px, y) : x.moveTo(px, y);
    }
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function portalTexture() {
  const s = 256, c = document.createElement("canvas");
  c.width = c.height = s;
  const x = c.getContext("2d"), g = x.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,250,220,1)");
  g.addColorStop(0.25, "rgba(255,170,60,0.95)");
  g.addColorStop(0.85, "rgba(160,30,10,0.9)");
  g.addColorStop(1, "rgba(80,10,0,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, s, s);
  x.lineCap = "round";
  for (let arm = 0; arm < 5; arm++) {
    x.strokeStyle = arm % 2 ? "rgba(255,255,220,0.6)" : "rgba(255,120,30,0.75)";
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

/**
 * api (main.js): player, hurt(n, nx, nz, kind), burst(x, y, z, n, colors, speed, up, g, life), fx, sfx,
 * shake, freeze, dropHeart(x, y, z), onStart() (Jake says so), onSun() (the first Sun: Jake shouts
 * where to hide), onWin() (true the first time), onReward() (the Flame Heart), leave() (Finn walked
 * into the gate).
 */
export function createFlameKing(scene, api) {
  const pl = api.player.pos, S = K.scale;
  // ── the Flame King (his own materials: he flashes white when hit, and his fire changes colour) ──
  const model = makeNpc("flameKing");
  model.scale.setScalar(S);
  const own = new Map(), fireMats = [];
  const FIRE_OF = Object.fromEntries(Object.entries(FLAME_KING_FIRE).map(([k, v]) => [v, k]));
  model.traverse((o) => {
    if (!o.isMesh) return;
    let m = own.get(o.material);
    if (!m) {
      m = o.material.clone();
      m.userData = { ...o.material.userData };
      if (o.material.onBeforeCompile) m.onBeforeCompile = o.material.onBeforeCompile;
      own.set(o.material, m);
      const kind = FIRE_OF[o.material.color.getHex()];
      if (kind && m.emissive) fireMats.push({ m, kind });
    }
    o.material = m;
  });
  const mats = [...own.values()].filter((m) => m.emissive);
  const baseEm = mats.map((m) => m.emissive.clone());
  const U = model.userData;
  model.visible = false;
  scene.add(model);
  const shadow = makeShadow(1.6);
  shadow.visible = false;
  scene.add(shadow);
  // a bubble of fire while he's untouchable (flaring up between phases)
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), additive(0xff7a1a, { opacity: 0.26, side: THREE.DoubleSide }));
  bubble.visible = false;
  scene.add(bubble);
  // Flame Princess, watching from the royal box
  const fp = makeNpc("flame");
  fp.scale.setScalar(1.3);
  fp.visible = false;
  scene.add(fp);

  // ── fire: flame columns (instanced: two instances each, the flame and its core), walls of fire, the burning floor ──
  const FT = { value: 0 }, FC = { value: new THREE.Color(HOT[0][0]) }, FE = { value: new THREE.Color(HOT[0][1]) };
  const fireMat = (rep) => noOutline(new THREE.ShaderMaterial({
    vertexShader: FIRE_VS, fragmentShader: FIRE_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: FT, uRep: { value: rep }, uCore: FC, uEdge: FE },
  }));
  const FN = 200, colGeo = new THREE.CylinderGeometry(0.62, 1, 1, 18, 1, true).translate(0, 0.5, 0);
  const colMesh = new THREE.InstancedMesh(colGeo, fireMat(7), FN * 2);
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
  for (let i = 0; i < FN * 2; i++) { colMesh.setMatrixAt(i, _m4.makeScale(0, 0, 0)); colMesh.setColorAt(i, _c.setRGB(0, 0, 0)); }
  colMesh.frustumCulled = false;
  colMesh.visible = false;
  colMesh.renderOrder = 5;
  scene.add(colMesh);
  const cols = [];
  for (let i = 0; i < FN; i++) cols.push({ on: false, shown: false, t: 0, life: 1, x: 0, z: 0, r: 1, h: 1, rise: 0.12, hot: 1 });
  let colNext = 0;
  /** A column of flame r wide, h tall, standing `life` s after `delay` (hot: brightness). */
  function flameCol(x, z, r, h, life, delay = 0, hot = 1, rise = 0.12) {
    for (let n = 0; n < FN; n++) {
      const c = cols[colNext];
      colNext = (colNext + 1) % FN;
      if (c.on) continue;
      Object.assign(c, { on: true, t: -delay, life, x, z, r, h, rise, hot });
      return c;
    }
    return null;
  }
  // walls of fire running out along the floor (jump them): open cylinders growing from where they start
  const WN = 5, waves = [];
  const waveGeo = new THREE.CylinderGeometry(1, 1, 1, 72, 1, true).translate(0, 0.5, 0);
  for (let i = 0; i < WN; i++) {
    const m = new THREE.Mesh(waveGeo, fireMat(24));
    m.visible = false;
    m.frustumCulled = false;
    m.renderOrder = 5;
    scene.add(m);
    waves.push({ on: false, m, x: 0, z: 0, r: 0, pr: 0, speed: 12, max: 60, hit: false, t: 0 });
  }
  /** A wall of fire running out from (x, z), starting r0 out, `delay` s from now (a moment to see it and jump). */
  function wave(x, z, r0, speed, delay = 0.3) {
    const w = waves.find((k) => !k.on) || waves[0];
    Object.assign(w, { on: true, x, z, r: r0, pr: r0, speed, max: A.floor + Math.hypot(x - A.x, z - A.z) + 1, hit: false, t: -delay });
    later(delay, () => api.sfx("whoosh"));
  }
  // the burning floor after the Sun: flat fire everywhere but the columns' shade
  const seaMat = noOutline(new THREE.ShaderMaterial({
    vertexShader: SEA_VS, fragmentShader: SEA_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: FT, uFade: { value: 0 }, uCore: FC, uEdge: FE, uClip: { value: new THREE.Vector3(A.x, A.z, A.floor - 0.2) }, uC: { value: new THREE.Vector2() }, uOcc: { value: A.pillars.slice(0, 8).map((p) => new THREE.Vector4(p.x, p.z, p.r, 1)) }, uOccN: { value: Math.min(8, A.pillars.length) } },
  }));
  const sea = new THREE.Mesh(new THREE.CircleGeometry(A.floor, 64).rotateX(-Math.PI / 2), seaMat);
  sea.position.set(A.x, A.y + 0.12, A.z);
  sea.visible = false;
  sea.renderOrder = 4;
  scene.add(sea);
  const SEA = { t: 9, life: 2.2 };

  // ── fireballs (instanced: the flame and its core) and the Sun ──
  const BN = 28, ballMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), additive(0xffffff, { opacity: 0.85 }), BN * 2);
  for (let i = 0; i < BN * 2; i++) ballMesh.setMatrixAt(i, _m4.makeScale(0, 0, 0));
  ballMesh.frustumCulled = false;
  ballMesh.visible = false;
  ballMesh.renderOrder = 5;
  scene.add(ballMesh);
  ballMesh.setColorAt(0, _c.setRGB(1, 1, 1));
  const balls = [];
  for (let i = 0; i < BN; i++) balls.push({ on: false, shown: false, t: 0, dur: 1, x0: 0, y0: 0, z0: 0, x1: 0, z1: 0, arc: 6, s: 1, fall: false, x: 0, y: 0, z: 0 });
  /** A fireball from (x0, y0, z0) landing on (x1, z1) in `dur` s (lobbed over `arc`, or falling straight from the sky). */
  function ball(x0, y0, z0, x1, z1, dur, arc, s = 1, fall = false) {
    const b = balls.find((k) => !k.on);
    if (b) Object.assign(b, { on: true, t: 0, dur, x0, y0, z0, x1, z1, arc, s, fall, x: x0, y: y0, z: z0 });
  }
  const sunMat = noOutline(new THREE.ShaderMaterial({ vertexShader: SUN_VS, fragmentShader: SUN_FS, fog: false, uniforms: { uTime: FT, uCore: FC, uEdge: FE } }));
  const sun = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 22), sunMat);
  const corona = new THREE.Sprite(noOutline(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff8a2a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
  sun.visible = corona.visible = false;
  sun.renderOrder = corona.renderOrder = 6;
  scene.add(sun, corona);
  const SUN = { on: false, t: 0, warn: 4, x: 0, z: 0, fall: false, ft: 0, y: 0, k: 0 };

  // ── glow: soft additive motes in one Points mesh (embers off him, fireball trails, sparks) ──
  const GN = 700, gPos = new Float32Array(GN * 3), gCol = new Float32Array(GN * 3), motes = [];
  for (let i = 0; i < GN; i++) motes.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0, g: 0, b: 0, drag: 0 });
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
  function glow(x, y, z, color, vx = 0, vy = 0, vz = 0, life = 0.8, drag = 1.5) {
    const m = motes[gNext];
    gNext = (gNext + 1) % GN;
    _gc.setHex(color);
    Object.assign(m, { life, max: life, x, y, z, vx, vy, vz, r: _gc.r, g: _gc.g, b: _gc.b, drag });
    gAny = true;
  }
  function glowBurst(x, y, z, n, colors, speed = 4, life = 0.8, up = 0) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, e = Math.random() * 2 - 1, c = Math.sqrt(1 - e * e), v = speed * (0.4 + Math.random() * 0.6);
      glow(x, y, z, colors[i % colors.length], Math.cos(a) * c * v, e * v * 0.6 + up, Math.sin(a) * c * v, life * (0.6 + Math.random() * 0.6));
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
  // ── scorch marks and cracks in the floor, fading away ──
  const scGeo = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), scTex = scorchTexture(), scorches = [];
  for (let i = 0; i < 24; i++) {
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
    const q = clampIn(x, z, A.floor - 0.8);
    Object.assign(s, { t: 0, life });
    s.m.position.set(q.x, A.y + 0.05, q.z);
    s.m.rotation.y = Math.random() * TAU;
    s.m.scale.set(r, 1, r);
  }
  const crGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5), crTex = crackTexture(), cracks = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(crGeo, noOutline(new THREE.MeshBasicMaterial({ map: crTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })));
    m.visible = false;
    m.renderOrder = 1.6;
    scene.add(m);
    cracks.push({ m, t: 0, life: 0 });
  }
  let crNext = 0;
  function crack(x, z, a, len, w, life = 3.5) {
    const c = cracks[crNext];
    crNext = (crNext + 1) % cracks.length;
    Object.assign(c, { t: 0, life });
    c.m.position.set(x, A.y + 0.06, z);
    c.m.rotation.y = a;
    c.m.scale.set(w, 1, len);
  }
  // the heat at the edge of the screen (only in the arena): redder as he gets angrier, blue in the blue flame
  const heat = $("heat"), HEAT = { o: -1, c: "" };
  function heatFlash() {
    heat.classList.remove("flash");
    void heat.offsetWidth; // restart the animation
    heat.classList.add("flash");
  }

  // ── the prize (the Flame Heart and the Fire Crystal, floating where he fell) and the way out (a portal of fire in the far gate) ──
  const prize = new THREE.Mesh(heartGeo(), toon(0xff4a1a, { emissive: 0xaa2200, thick: 0.004 }));
  prize.scale.setScalar(1.6);
  prize.visible = false;
  scene.add(prize);
  const gem = makeCrystal("fire");
  gem.visible = false;
  scene.add(gem);
  const reward = { on: false, t: 0, x: 0, z: 0 };
  const portal = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.3, 8, 30), toon(0x8a3a1a, { emissive: 0x5a1a00 }));
  const swirl = new THREE.Mesh(new THREE.CircleGeometry(2.2, 32), noOutline(new THREE.MeshBasicMaterial({ map: portalTexture(), transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false })));
  portal.add(ring, swirl);
  const PT = { on: false, k: 0, x: A.x + Math.sin(A.portalA) * 28, z: A.z + Math.cos(A.portalA) * 28 };
  portal.position.set(PT.x, A.y + 2.6, PT.z);
  portal.rotation.y = A.portalA;
  portal.visible = false;
  scene.add(portal);
  // his flame leaving the empty armour for home
  const SOUL = { on: false, t: 0, x: 0, y: 0, z: 0 };

  // ── HUD: name, hp bar, cast bar, speech (shared with the other bosses) ──
  let sayTimer = 0;
  function say(text, secs = 3) {
    const el = $("bossSay");
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(sayTimer);
    sayTimer = setTimeout(() => el.classList.remove("show"), secs * 1000);
  }
  function hud(on) {
    if (on) $("bossName").textContent = STR.names.flameKing;
    $("boss").hidden = !on;
    document.body.classList.toggle("bossOn", on);
    document.body.classList.toggle("bossFire", on);
    if (!on) { $("bossSay").classList.remove("show"); $("bossCast").hidden = true; }
  }
  let hpShown = -1;
  function hudHp() {
    const f = Math.max(0, B.hp / K.hp);
    if (f === hpShown) return;
    hpShown = f;
    $("bossHp").style.width = f * 100 + "%";
    $("bossLag").style.width = f * 100 + "%";
    $("bossPhase").textContent = STR.fire.phase[B.phase];
  }

  // ── state ──
  // st: off (not in the arena) | intro (Finn just arrived) | fight | gloat (Finn fainted) | down (just
  // lost) | rest (after losing: his armour sits empty, the gate is open)
  const B = {
    isBoss: true, active: true, dead: true, model, floor: A.y,
    st: "off", x: A.x, y: A.y, z: A.z, px: A.x, py: A.y, pz: A.z, air: 0, vx: 0, vz: 0, kx: 0, kz: 0, face: 0, pface: 0,
    goal: { on: false, x: A.x, z: A.z }, speed: 5, faceLock: null, dash: null, crashed: false, stride: 0,
    hp: K.hp, dropAcc: 0, phase: 0, nextPhase: 0, armor: false, empty: false, flash: 0, hurtT: 0, voice: 0, saidT: 0,
    pose: "idle", poseT: 0, foot: 1, throwN: 0, throwT: 9, cast: null, script: null, heat: 0, counterCd: 0, suns: 0,
    only: null, // debug: always this attack
  };
  const HZ = createHazards(scene, {
    player: api.player, y: A.y, center: A, reach: A.r, color: 0xff3a1a, clip: A.floor - 0.1, n: 56, high: 3.6, // no jumping over fire
    live: () => B.st === "fight",
    hit(h, nx, nz) {
      api.hurt(h.dmg || 1, nx, nz, "fire");
      api.burst(pl.x, pl.y + 1, pl.z, 10, FIRE, 4, 5);
    },
  });
  const hazard = HZ.add, clampIn = HZ.clampIn, away = HZ.away;
  const timers = [];
  const later = (s, fn) => timers.push({ t: s, fn });
  const say2 = (key) => say(pick(STR.fire.shout[key]), 2.2);
  const setPose = (p) => { if (B.pose !== p) { B.pose = p; B.poseT = 0; } };
  function castBar(key, dur) {
    B.cast = { name: STR.fire.cast[key], t: 0, dur };
    $("bossCastName").textContent = B.cast.name;
    $("bossCast").hidden = false;
  }
  const inArena = (p = pl) => Math.hypot(p.x - A.x, p.z - A.z) < A.wall + 1 && p.y > A.y - 2 && p.y < A.y + 24;
  const hittable = () => B.st === "fight" && !B.armor && B.air < 2 && B.hp > 0;
  const toFinn = (x = B.x, z = B.z) => Math.atan2(pl.x - x, pl.z - z);
  const distFinn = () => Math.hypot(pl.x - B.x, pl.z - B.z);
  /** Where Finn will be in `s` seconds (inside the floor). */
  function lead(s, r = A.r) {
    const v = api.player.vel;
    return clampIn(pl.x + v.x * s, pl.z + v.z * s, r);
  }
  /** A spot on the floor, not inside a column. */
  function anywhere(r = A.r - 1) {
    for (;;) {
      const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * r, x = A.x + Math.sin(a) * d, z = A.z + Math.cos(a) * d;
      if (A.pillars.every((p) => Math.hypot(x - p.x, z - p.z) > p.r + 1)) return { x, z };
    }
  }
  /** Is (x, z) in the shade of a column from a blast at (cx, cz)? */
  function inShade(cx, cz, x, z) {
    const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz);
    for (const c of A.pillars) {
      const px = c.x - cx, pz = c.z - cz, pd = Math.hypot(px, pz);
      if (d < pd || pd < c.r + 0.1) continue;
      if (Math.abs(wrap(Math.atan2(dx, dz) - Math.atan2(px, pz))) < Math.asin(Math.min(1, c.r / pd))) return true;
    }
    return false;
  }
  /** How far a band from (x, z) heading `a` runs before it meets the wall. */
  function bandLen(x, z, a, R = A.floor - 0.6) {
    const dx = x - A.x, dz = z - A.z, ux = Math.sin(a), uz = Math.cos(a);
    const b = dx * ux + dz * uz, c = dx * dx + dz * dz - R * R;
    return Math.max(2, -b + Math.sqrt(Math.max(0, b * b - c)));
  }
  /** Where a charge from (x, z) heading `a` stops: at the wall, or against the first column in the way. */
  function chargePath(x, z, a) {
    const ux = Math.sin(a), uz = Math.cos(a);
    let len = bandLen(x, z, a, K.reach + 0.5), pillar = null;
    for (const p of A.pillars) {
      const ox = x - p.x, oz = z - p.z, R = p.r + K.body * 0.8, b = ox * ux + oz * uz, c = ox * ox + oz * oz - R * R, disc = b * b - c;
      if (disc <= 0) continue;
      const t = -b - Math.sqrt(disc);
      if (t > 0.5 && t < len) { len = t; pillar = p; }
    }
    return { len: Math.max(1, len), pillar };
  }
  /** A point in front of him (fwd) and to his side (side: + is his left... his right hand is -x of his facing). */
  function fromHim(fwd, side = 0) {
    const f = B.face, ux = Math.sin(f), uz = Math.cos(f);
    return { x: B.x + ux * fwd + uz * side, z: B.z + uz * fwd - ux * side };
  }
  /** Where the hand of `side` (-1 / 1) is while it throws (about: the release point over his shoulder). */
  function handAt(side) {
    const q = fromHim(0.6, side * 1.9);
    return { x: q.x, y: A.y + B.air + 7.2, z: q.z };
  }

  // ── fire that burns while it stands (patches, pillars, eruptions, the charge's trail) ──
  const burns = [];
  function burn(x, z, r, life, delay = 0) {
    burns.push({ x, z, r, t: -delay, life });
  }
  function stepBurns(dt) {
    for (let i = burns.length - 1; i >= 0; i--) {
      const z = burns[i];
      if (!z) continue; // a burn that made Finn faint cleared them all (finnDown)
      z.t += dt;
      if (z.t > z.life) { burns.splice(i, 1); continue; }
      if (z.t < 0 || B.st !== "fight" || api.player.dead > 0 || pl.y > A.y + 1.2) continue;
      const dx = pl.x - z.x, dz = pl.z - z.z, d = Math.hypot(dx, dz);
      if (d < z.r + 0.3) api.hurt(1, dx / (d || 1), dz / (d || 1), "fire");
    }
  }
  /** A patch of fire on the floor: flames standing over it for `life` s, and it burns. */
  function patch(x, z, r, life, delay = 0) {
    burn(x, z, r, life, delay);
    flameCol(x, z, r * 0.95, 1.5 + r * 0.4, life, delay, 0.8, 0.2);
  }

  // ── what each attack does when it lands ──
  function fireballHit(h) {
    api.fx.ring(h.x, A.y, h.z, h.r + 1, 0xffb13b, 0.35);
    api.burst(h.x, A.y + 0.4, h.z, 16, FIRE, 7, 6, 1, 0.7);
    glowBurst(h.x, A.y + 0.6, h.z, 18, [0xffe08a, 0xff8a2a, 0xff4a1a], 6, 0.6, 2);
    flameCol(h.x, h.z, h.r * 0.8, 4.5, 0.45, 0, 1.2, 0.06);
    patch(h.x, h.z, K.fireball.burnR, K.fireball.burn, 0.15);
    scorch(h.x, h.z, h.r * 0.9, 4);
    api.sfx("fireHit");
    api.shake(0.15);
  }
  function meteorHit(h) {
    api.fx.ring(h.x, A.y, h.z, h.r + 1.4, 0xffb13b, 0.4);
    api.burst(h.x, A.y + 0.5, h.z, 20, FIRE.concat(0x3a2020), 8, 7, 1, 0.8);
    glowBurst(h.x, A.y + 0.8, h.z, 22, [0xffe08a, 0xff8a2a], 7, 0.7, 2.5);
    flameCol(h.x, h.z, h.r * 0.85, 6, 0.5, 0, 1.3, 0.06);
    scorch(h.x, h.z, h.r, 4.5);
    api.sfx("fireHit");
    api.shake(0.2);
  }
  function pillarHit(h) {
    flameCol(h.x, h.z, h.r * 0.95, K.pillars.h, K.pillars.burn + 0.25, 0, 1.3, 0.1);
    flameCol(h.x, h.z, h.r * 0.5, K.pillars.h * 1.15, K.pillars.burn + 0.2, 0, 1.6, 0.08);
    burn(h.x, h.z, h.r * 0.85, K.pillars.burn);
    api.fx.ring(h.x, A.y, h.z, h.r + 1.2, 0xffd23f, 0.35);
    glowBurst(h.x, A.y + 3, h.z, 24, [0xffe08a, 0xff8a2a, 0xffffff], 6, 0.9, 7);
    scorch(h.x, h.z, h.r, 3.5);
    api.sfx("eruption");
    api.shake(0.18);
  }
  function stompHit(h) {
    wave(h.x, h.z, h.r - 0.3, K.stomp.wave[B.phase]);
    api.fx.ring(h.x, A.y, h.z, h.r + 2, 0xffb13b, 0.5);
    api.fx.star(h.x, A.y + 0.8, h.z, 2.2, 0xff8a2a);
    api.burst(h.x, A.y + 0.3, h.z, 30, [0x6a4a3a, 0x3a2a2a, 0xff8a2a], 9, 6, 1, 0.8);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; flameCol(h.x + Math.sin(a) * h.r * 0.6, h.z + Math.cos(a) * h.r * 0.6, 1.2, 3.2, 0.4, 0.02, 1, 0.06); }
    scorch(h.x, h.z, h.r * 0.8, 4);
    api.sfx("stomp");
    api.shake(0.55);
    api.freeze(0.07);
  }
  function slamHit(h) {
    const ux = Math.sin(h.a), uz = Math.cos(h.a);
    crack(h.x, h.z, h.a, h.r, h.w * 1.4, 3.5);
    for (let d = 1.2; d < h.r; d += 1.7) {
      const x = h.x + ux * d + (Math.random() - 0.5) * 0.6, z = h.z + uz * d + (Math.random() - 0.5) * 0.6, del = d * 0.022;
      flameCol(x, z, 1.25, 4 + Math.random() * 2.5, 0.75, del, 1.2, 0.08);
      burn(x, z, 1.1, 0.7, del);
      later(del, () => api.burst(x, A.y + 0.4, z, 5, [0x5a3a2a, 0xff8a2a, 0xffd23f], 5, 7, 1, 0.6));
    }
    api.fx.star(h.x + ux * 1.5, A.y + 1, h.z + uz * 1.5, 2.2, 0xff8a2a);
    api.sfx("eruption");
    api.shake(0.45);
  }
  function landHit(h) {
    B.x = B.px = h.x;
    B.z = B.pz = h.z;
    B.air = 0;
    wave(h.x, h.z, h.r - 0.3, K.leap.wave);
    api.fx.ring(h.x, A.y, h.z, h.r + 3, 0xffb13b, 0.55);
    api.fx.star(h.x, A.y + 1, h.z, 2.6, 0xffd23f);
    api.burst(h.x, A.y + 0.4, h.z, 36, [0x6a4a3a, 0x3a2a2a, 0xff8a2a, 0xffd23f], 11, 8, 1, 0.9);
    glowBurst(h.x, A.y + 1, h.z, 40, [0xffe08a, 0xff8a2a, 0xffffff], 8, 0.9, 3);
    for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; flameCol(h.x + Math.sin(a) * h.r * 0.8, h.z + Math.cos(a) * h.r * 0.8, 1.4, 4.5, 0.5, 0.03, 1.1, 0.06); }
    scorch(h.x, h.z, h.r, 5);
    api.sfx("stomp");
    api.sfx("boom");
    api.shake(0.8);
    api.freeze(0.1);
  }
  function eruptionHit(h) {
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; flameCol(h.x + Math.sin(a) * h.r * 0.7, h.z + Math.cos(a) * h.r * 0.7, 1.8, 7, 0.55, 0, 1.3, 0.06); }
    flameCol(h.x, h.z, h.r * 0.6, 9, 0.5, 0, 1.2, 0.06);
    api.fx.ring(h.x, A.y, h.z, h.r + 1.5, 0xff5a1a, 0.4);
    glowBurst(h.x, A.y + 1.5, h.z, 36, [0xffe08a, 0xff5a1a], 8, 0.8, 4);
    scorch(h.x, h.z, h.r * 0.8, 3.5);
    api.sfx("eruption");
    api.shake(0.4);
  }
  function sunHit(h) {
    SUN.on = false;
    A.fx.flash = 1;
    A.fx.cheer = 1;
    SEA.t = 0;
    seaMat.uniforms.uC.value.set(h.x, h.z);
    // columns of flame burst up everywhere the blast reaches (the shade is left alone), from the middle out
    for (let i = 0; i < 46; i++) {
      const q = anywhere(A.floor - 1.5);
      if (inShade(h.x, h.z, q.x, q.z)) continue;
      const d = Math.hypot(q.x - h.x, q.z - h.z);
      flameCol(q.x, q.z, 1.6 + Math.random() * 1.4, 6 + Math.random() * 9, 0.9 + Math.random() * 0.5, d * 0.012, 1.1, 0.1);
    }
    flameCol(h.x, h.z, 7, 26, 1.2, 0, 1.4, 0.1);
    flameCol(h.x, h.z, 3.5, 32, 1.1, 0, 1.8, 0.1);
    for (let i = 0; i < 3; i++) later(i * 0.12, () => api.fx.ring(h.x, A.y + 0.2, h.z, 12 + i * 12, i % 2 ? 0xffd23f : 0xff5a1a, 0.7));
    glowBurst(h.x, A.y + 3, h.z, 160, [0xffffff, 0xffe08a, 0xff8a2a, 0xff4a1a], 22, 1.3, 4);
    for (let i = 0; i < 10; i++) { const q = anywhere(); if (!inShade(h.x, h.z, q.x, q.z)) scorch(q.x, q.z, 2 + Math.random() * 2, 6); }
    scorch(h.x, h.z, 8, 7);
    heatFlash();
    api.sfx("megaBoom");
    api.shake(1.2);
    api.freeze(0.2);
  }

  // ── the fight, as scripts ──
  function* wait(s) {
    for (let t = 0; t < s; ) t += yield;
  }
  /** Walks toward (x, z) until within `near`, for up to `max` s. */
  function* walkTo(x, z, near = 0.8, max = 3) {
    const q = clampIn(x, z, K.reach);
    Object.assign(B.goal, { on: true, x: q.x, z: q.z });
    B.speed = K.walk[B.phase];
    for (let t = 0; t < max && B.goal.on && Math.hypot(B.goal.x - B.x, B.goal.z - B.z) > near; ) t += yield;
    B.goal.on = false;
  }
  /** Walks after Finn until he's within `dist`, for up to `max` s. */
  function* approach(dist, max) {
    B.speed = K.walk[B.phase];
    for (let t = 0; t < max && distFinn() > dist; ) {
      const q = clampIn(pl.x, pl.z, K.reach);
      Object.assign(B.goal, { on: true, x: q.x, z: q.z });
      t += yield;
    }
    B.goal.on = false;
  }
  /** A lobbed fireball from his hand to (x, z), and the circle where it lands (in `warn` s). */
  function lob(x, z, warn, side) {
    const q = clampIn(x, z, A.r), hnd = handAt(side), d = Math.hypot(q.x - hnd.x, q.z - hnd.z);
    hazard({ shape: CIRCLE, x: q.x, z: q.z, r: K.fireball.r, warn, onFire: fireballHit });
    ball(hnd.x, hnd.y, hnd.z, q.x, q.z, warn, 3 + d * 0.22, 1.05);
  }
  function firePillar(x, z, warn, r = K.pillars.r, delay = 0) {
    const q = clampIn(x, z, A.r);
    hazard({ shape: CIRCLE, x: q.x, z: q.z, r, warn, delay, onFire: pillarHit });
  }
  function meteorAt(x, z, warn) {
    hazard({ shape: CIRCLE, x, z, r: K.meteor.r, warn, onFire: meteorHit });
    const fall = 0.55;
    later(Math.max(0, warn - fall), () => { if (B.st === "fight") ball(x + 4, A.y + 34, z - 3, x, z, fall, 0, 1.5, true); });
  }
  const ATTACKS = {
    *fireball() {
      const P = B.phase, n = K.fireball.n[P], every = K.fireball.every[P], warn = K.fireball.warn[P];
      B.goal.on = false;
      setPose("throw");
      say2("fireball");
      castBar("fireball", n * every + warn);
      for (let i = 0; i < n; i++) {
        B.faceLock = toFinn();
        B.throwN++;
        B.throwT = 0;
        yield* wait(0.2); // the wind-up: the ball leaves his hand at the release
        const side = B.throwN % 2 ? 1 : -1, q = lead(0.35);
        lob(q.x, q.z, warn, side);
        if (K.fireball.spread[P]) {
          const a = toFinn(), d = Math.hypot(q.x - B.x, q.z - B.z);
          for (const o of [-0.4, 0.4]) lob(B.x + Math.sin(a + o) * d, B.z + Math.cos(a + o) * d, warn, side);
        }
        api.sfx("fireball");
        yield* wait(Math.max(0.05, every - 0.2));
      }
      yield* wait(warn * 0.7);
      B.faceLock = null;
      setPose("idle");
      yield* wait(0.5);
    },
    *meteor() {
      const P = B.phase, n = K.meteor.n[P], every = K.meteor.every[P], warn = K.meteor.warn;
      B.goal.on = false;
      setPose("sky");
      say2("meteor");
      castBar("meteor", 0.5 + n * every + warn);
      api.sfx("roar");
      yield* wait(0.5);
      for (let i = 0; i < n; i++) {
        const q = Math.random() < K.meteor.onFinn ? lead(0.4) : anywhere();
        meteorAt(q.x, q.z, warn);
        yield* wait(every);
      }
      yield* wait(warn);
      setPose("idle");
      yield* wait(0.5);
    },
    *pillars() {
      const P = B.phase, n = K.pillars.n[P], every = K.pillars.every[P], warn = K.pillars.warn[P];
      B.goal.on = false;
      setPose("summon");
      say2("pillars");
      api.sfx("roar");
      if (K.pillars.cage[P]) {
        // a ring of them round Finn; as it erupts, one in the middle: stay in, then get out
        const c = clampIn(pl.x, pl.z, A.r - 5.5), w1 = warn * 1.3, w2 = 1.6;
        castBar("pillars", w1 + w2);
        for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU; firePillar(c.x + Math.sin(a) * 5.2, c.z + Math.cos(a) * 5.2, w1, 2.3); }
        firePillar(c.x, c.z, w2, 2.9, w1);
        yield* wait(w1 + w2 + 0.3);
      }
      castBar("pillars", n * every + warn);
      for (let i = 0; i < n; i++) {
        const q = lead(0.3);
        firePillar(q.x, q.z, warn);
        if (i < K.pillars.extra[P]) { const e = anywhere(); firePillar(e.x, e.z, warn * 1.1); }
        yield* wait(every);
      }
      yield* wait(warn + 0.2);
      setPose("idle");
      yield* wait(0.4);
    },
    *stomp() {
      const P = B.phase, reps = K.stomp.reps[P];
      yield* approach(8, 2.4);
      for (let rep = 0; rep < reps; rep++) {
        const warn = K.stomp.warn[P] * (rep ? 0.88 : 1), side = rep % 2 ? 1 : -1;
        B.faceLock = toFinn();
        B.foot = side;
        setPose("stompUp");
        if (!rep) say2("stomp");
        castBar("stomp", warn);
        const f = fromHim(1.0, side * 0.7);
        hazard({ shape: CIRCLE, x: f.x, z: f.z, r: K.stomp.r, warn, onFire: stompHit });
        yield* wait(warn);
        setPose("stompGo");
        yield* wait(0.5);
        if (rep + 1 < reps) yield* approach(7, 0.7);
      }
      B.faceLock = null;
      setPose("idle");
      yield* wait(0.6);
    },
    *slam() {
      const P = B.phase, warn = K.slam.warn[P], nb = K.slam.bands[P];
      yield* approach(11, 2.2);
      const aim = toFinn();
      B.faceLock = aim;
      setPose("slamUp");
      say2("slam");
      castBar("slam", warn);
      api.sfx("charge");
      for (let i = 0; i < nb; i++) {
        const a = aim + (i - (nb - 1) / 2) * K.slam.spread, x = B.x + Math.sin(a) * 2.2, z = B.z + Math.cos(a) * 2.2;
        hazard({ shape: BAND, x, z, a, r: bandLen(x, z, a), w: K.slam.w, warn, onFire: slamHit });
      }
      yield* wait(warn - 0.15);
      setPose("slamGo");
      yield* wait(0.15);
      api.sfx("stomp");
      yield* wait(K.slam.stuck[P]); // fists stuck in the floor: open to a counter
      B.faceLock = null;
      setPose("idle");
      yield* wait(0.4);
    },
    *charge() {
      const P = B.phase, reps = K.charge.reps[P];
      B.goal.on = false;
      for (let rep = 0; rep < reps; rep++) {
        const warn = K.charge.warn[P] * (rep ? 0.8 : 1), a = toFinn(), path = chargePath(B.x, B.z, a);
        B.faceLock = a;
        setPose("chargeWind");
        if (!rep) say2("charge");
        castBar("charge", warn);
        api.sfx("roar");
        hazard({ shape: BAND, x: B.x, z: B.z, a, r: path.len + K.body, w: K.charge.w, warn, harmless: true });
        yield* wait(warn);
        setPose("charge");
        B.dash = { ux: Math.sin(a), uz: Math.cos(a), left: path.len, speed: K.charge.speed[P], hit: false, pillar: path.pillar, trail: 0 };
        while (B.dash) yield;
        if (B.crashed) {
          B.crashed = false;
          setPose("dazed");
          say(pick(STR.fire.crash), 2);
          yield* wait(K.charge.crash);
          break;
        }
        setPose("idle");
        yield* wait(K.charge.daze[P]);
      }
      B.faceLock = null;
      setPose("idle");
      yield* wait(0.3);
    },
    *leap() {
      const P = B.phase, follow = K.leap.follow[P], lock = K.leap.lock[P];
      B.goal.on = false;
      B.faceLock = null;
      setPose("crouch");
      say2("leap");
      yield* wait(0.45);
      castBar("leap", follow + lock);
      const h = hazard({ shape: CIRCLE, x: B.x, z: B.z, r: K.leap.r, follow, chase: K.leap.chase[P], warn: lock, onFire: landHit });
      setPose("air");
      api.sfx("whoosh");
      api.shake(0.3);
      api.burst(B.x, A.y + 0.4, B.z, 24, [0x6a4a3a, 0xff8a2a], 8, 5, 1, 0.7);
      const x0 = B.x, z0 = B.z, T = follow + lock;
      for (let t = 0; !h.fired; ) {
        t += yield;
        const u = Math.min(1, t / T), e = u * u * (3 - 2 * u), q = clampIn(h.x, h.z, K.reach);
        B.x = lerp(x0, q.x, e);
        B.z = lerp(z0, q.z, e);
        B.air = 4 * 16 * u * (1 - u);
        B.faceLock = toFinn();
      }
      B.air = 0;
      setPose("land");
      yield* wait(K.leap.daze[P]);
      B.faceLock = null;
      setPose("idle");
      yield* wait(0.3);
    },
    *sun() {
      const n = B.suns++, warn = K.sun.warn[Math.min(1, n)];
      B.goal.on = false;
      B.faceLock = null;
      // off to the middle, in one leap if he's far from it
      if (Math.hypot(B.x - A.x, B.z - A.z) > 3) {
        setPose("crouch");
        yield* wait(0.35);
        setPose("air");
        api.sfx("whoosh");
        const x0 = B.x, z0 = B.z;
        for (let t = 0; t < 1.1; ) {
          t += yield;
          const u = Math.min(1, t / 1.1), e = u * u * (3 - 2 * u);
          B.x = lerp(x0, A.x, e);
          B.z = lerp(z0, A.z, e);
          B.air = 4 * 9 * u * (1 - u);
        }
        B.air = 0;
        api.shake(0.6);
        api.sfx("stomp");
        api.fx.ring(B.x, A.y, B.z, 9, 0xffb13b, 0.5);
        api.burst(B.x, A.y + 0.4, B.z, 30, [0x6a4a3a, 0xff8a2a], 9, 6, 1, 0.8);
      }
      // the Sun grows over his head, then he brings it down on (x, z): the first time right in the middle
      const off = n ? Math.random() * K.sun.off : 0, oa = Math.random() * TAU, x = A.x + Math.sin(oa) * off, z = A.z + Math.cos(oa) * off;
      setPose("sun");
      say(pick(STR.fire.shout.sun), 3);
      castBar("sun", warn);
      api.sfx("roar");
      api.sfx("megaCharge");
      if (!n) api.onSun();
      A.fx.cheer = 1;
      Object.assign(SUN, { on: true, t: 0, warn, x, z, fall: false, ft: 0, k: 0 });
      hazard({ shape: CIRCLE, x, z, r: A.floor + 12, occ: A.pillars, dmg: K.sun.dmg, warn, onFire: sunHit });
      yield* wait(warn - 0.55);
      setPose("sunThrow");
      SUN.fall = true;
      yield* wait(0.75);
      setPose("dazed");
      say(pick(STR.fire.dazed), 2);
      yield* wait(K.sun.rest);
      setPose("idle");
    },
  };
  function* rage() {
    B.phase = B.nextPhase;
    B.armor = true;
    B.goal.on = false;
    B.faceLock = null;
    A.fx.mood = B.phase;
    A.fx.flash = 1;
    A.fx.cheer = 1;
    setPose("roar");
    say(B.phase === 1 ? STR.fire.phase2 : STR.fire.phase3, 3.4);
    api.sfx("roar");
    api.sfx("eruption");
    api.shake(0.6);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; flameCol(B.x + Math.sin(a) * 4.5, B.z + Math.cos(a) * 4.5, 1.3, 8, 1.4, i * 0.03, 1.2, 0.15); }
    glowBurst(B.x, A.y + 5, B.z, 90, B.phase === 2 ? [0x8ad0ff, 0xffffff, 0x3a8aff] : [0xffe08a, 0xffffff, 0xff8a2a], 11, 1.3, 2);
    for (let i = 0; i < 3; i++) later(0.25 + i * 0.35, () => api.fx.ring(B.x, A.y, B.z, 7 + i * 5, B.phase === 2 ? 0x6ab8ff : 0xffb13b, 0.6));
    heatFlash();
    hpShown = -1;
    yield* wait(2.2);
    api.dropHeart(A.x + (B.x - A.x) * 0.5, A.y + 3, A.z + (B.z - A.z) * 0.5);
    B.armor = false;
    setPose("idle");
    if (B.phase === 2) yield* ATTACKS.sun(); // the blue flame starts with the Sun
  }
  function* fight() {
    let bag = [], last = "";
    for (;;) {
      if (B.nextPhase > B.phase) {
        yield* rage();
        bag = []; // the new phase's attacks, right away
        if (B.phase === 2) last = "sun";
      }
      if (!bag.length) {
        bag = [...ORDER[B.phase]].sort(() => Math.random() - 0.5);
        if (bag[0] === last) bag.push(bag.shift());
      }
      const next = B.only || bag.shift();
      last = next;
      yield* ATTACKS[next]();
      B.cast = null;
      $("bossCast").hidden = true;
      // between attacks he stalks toward Finn a little
      if (distFinn() > 12) yield* approach(10, 0.8);
      else yield* wait(0.2);
    }
  }
  function* intro() {
    setPose("idle");
    yield* wait(0.8);
    hud(true);
    say(STR.fire.intro, 4.6);
    setPose("roar");
    api.sfx("roar");
    A.fx.cheer = 1;
    A.fx.flash = 0.7;
    yield* wait(2.2);
    setPose("idle");
    yield* wait(0.8);
    B.st = "fight";
    api.onStart();
    yield* fight();
  }
  function* lost() {
    // the last blow: down on one knee; then his flame leaves the armour and flies off home to its lantern
    B.armor = true;
    B.cast = null;
    B.faceLock = null;
    B.dash = null;
    B.air = 0;
    B.goal.on = false;
    SUN.on = false;
    $("bossCast").hidden = true;
    setPose("down");
    A.fx.mood = 0;
    A.fx.flash = 1;
    A.fx.cheer = 1;
    say(STR.fire.defeat, 4.5);
    api.sfx("bossHurt");
    api.freeze(0.15);
    api.shake(0.6);
    api.burst(B.x, A.y + 4, B.z, 36, FIRE.concat(0xffffff), 9, 8, 1, 1);
    glowBurst(B.x, A.y + 5, B.z, 100, [0xffffff, 0xffe08a, 0xff8a2a], 9, 1.5, 1);
    heatFlash();
    yield* wait(2.6);
    B.empty = true;
    setPose("empty");
    Object.assign(SOUL, { on: true, t: 0, x: B.x, y: A.y + 2.9 * S, z: B.z });
    api.sfx("whoosh");
    glowBurst(B.x, A.y + 6.5, B.z, 50, [0xffe08a, 0xff8a2a], 6, 1, 3);
    yield* wait(1.3);
    const first = api.onWin();
    if (first) {
      const q = clampIn(B.x + (A.x - B.x) * 0.35, B.z + (A.z - B.z) * 0.35, 20);
      Object.assign(reward, { on: true, t: 0, x: q.x, z: q.z });
      api.sfx("ready");
    }
    PT.on = true;
    api.sfx("portal");
    B.st = "rest";
    A.fx.cheer = 1;
    yield* wait(1.0);
    say(first ? STR.fire.gift : STR.fire.again, 4.5);
    yield* wait(3);
    if (B.st === "rest") hud(false);
  }

  // ── starting, stopping ──
  /** Finn and Jake just arrived (main.js sends them): he waits in the middle, then it starts. */
  function enter() {
    reset();
    B.st = "intro";
    B.hp = K.hp;
    B.dropAcc = 0;
    B.phase = B.nextPhase = 0;
    hpShown = -1;
    fpWave = 1;
    B.script = intro();
    B.script.next();
  }
  function reset() {
    B.script = null;
    B.cast = null;
    B.faceLock = null;
    B.dash = null;
    B.crashed = B.armor = B.empty = false;
    B.goal.on = false;
    HZ.cancel();
    timers.length = 0;
    burns.length = 0;
    for (const c of cols) c.on = false;
    for (const b of balls) b.on = false;
    for (const w of waves) w.on = false;
    for (const m of motes) m.life = 0;
    for (const s of scorches) s.t = s.life;
    for (const c of cracks) c.t = c.life;
    SUN.on = SOUL.on = reward.on = PT.on = false;
    SEA.t = 9;
    A.fx.mood = 0;
    B.heat = B.counterCd = 0;
    B.suns = 0;
    B.air = 0;
    B.x = B.px = A.x;
    B.z = B.pz = A.z;
    B.y = B.py = A.y;
    B.vx = B.vz = B.kx = B.kz = 0;
    B.face = B.pface = A.spawnA;
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
    B.throwT += dt;
    B.flash -= dt;
    B.hurtT -= dt;
    B.saidT += dt;
    B.counterCd -= dt;
    B.heat = Math.max(0, B.heat - dt * (K.counter.dmg / K.counter.window));
    if (B.cast) B.cast.t += dt;
    for (let i = timers.length - 1; i >= 0; i--) {
      const k = timers[i];
      if (!k || (k.t -= dt) > 0) continue;
      timers.splice(i, 1);
      k.fn();
    }
    if (B.script && B.script.next(dt).done) B.script = null;
    // the charge: straight down its band, fire left along the way; he tramples Finn once
    let moved = 0;
    if (B.dash) {
      const D = B.dash, st = Math.min(D.left, D.speed * dt);
      B.x += D.ux * st;
      B.z += D.uz * st;
      D.left -= st;
      moved = st;
      D.trail += st;
      if (D.trail > 1.6) { D.trail = 0; patch(B.x - D.ux * 1.5, B.z - D.uz * 1.5, 1.1, 1.6); }
      if (Math.random() < dt * 30) api.burst(B.x - D.ux * 1.5, A.y + 0.3, B.z - D.uz * 1.5, 3, [0x6a4a3a, 0xff8a2a], 3, 3, 1, 0.5);
      const dx = pl.x - B.x, dz = pl.z - B.z;
      if (!D.hit && B.st === "fight" && Math.hypot(dx, dz) < K.charge.w - 0.15 && pl.y < A.y + 4) { // (inside the band he warned of)
        D.hit = true;
        const s = dx * D.uz - dz * D.ux >= 0 ? 1 : -1; // thrown off to the side he was on
        api.hurt(1, D.uz * s * 0.8 + D.ux * 0.6, -D.ux * s * 0.8 + D.uz * 0.6, "fire");
      }
      if (D.left <= 0) {
        B.dash = null;
        if (D.pillar) {
          B.crashed = true;
          api.sfx("boom");
          api.shake(0.9);
          api.freeze(0.12);
          api.fx.star(B.x + D.ux * K.body, A.y + 4, B.z + D.uz * K.body, 2.6, 0xffd23f);
          api.burst(D.pillar.x, A.y + 4, D.pillar.z, 30, [0x4a3a3a, 0x7a6a60, 0xff8a2a], 9, 6, 1, 0.9);
        } else {
          api.shake(0.35);
          api.burst(B.x, A.y + 0.4, B.z, 20, [0x6a4a3a, 0x3a2a2a], 7, 5, 1, 0.7);
        }
      }
    } else {
      // walking toward the goal, easing in and out
      let want = 0, wx = 0, wz = 0;
      if (B.goal.on) {
        const dx = B.goal.x - B.x, dz = B.goal.z - B.z, d = Math.hypot(dx, dz);
        if (d > 0.3) { want = Math.min(B.speed, d * 2.5); wx = dx / d; wz = dz / d; } else B.goal.on = false;
      }
      const f = Math.min(1, 4 * dt);
      B.vx += (wx * want - B.vx) * f;
      B.vz += (wz * want - B.vz) * f;
      B.kx *= Math.max(0, 1 - 6 * dt);
      B.kz *= Math.max(0, 1 - 6 * dt);
      B.x += (B.vx + B.kx) * dt;
      B.z += (B.vz + B.kz) * dt;
      moved = Math.hypot(B.vx, B.vz) * dt;
    }
    // he goes round the columns and stays inside the arena
    for (const p of A.pillars) {
      const dx = B.x - p.x, dz = B.z - p.z, d = Math.hypot(dx, dz), R = p.r + K.body;
      if (d < R && d > 1e-3 && B.air < 9) { B.x = p.x + (dx / d) * R; B.z = p.z + (dz / d) * R; }
    }
    const q = clampIn(B.x, B.z, K.reach);
    B.x = q.x;
    B.z = q.z;
    B.stride += moved;
    B.y = A.y + B.air;
    const moving = !B.dash && Math.hypot(B.vx, B.vz) > 1;
    const faceTo = B.faceLock ?? (moving ? Math.atan2(B.vx, B.vz) : B.st === "rest" || B.st === "down" ? B.face : toFinn());
    B.face = turnToward(B.face, faceTo, (B.faceLock !== null ? 8 : K.turn[B.phase]) * dt);
    B.dead = !hittable();
    HZ.step(dt);
    stepBurns(dt);
    for (const w of waves) {
      if (!w.on) continue;
      w.pr = w.r;
      if ((w.t += dt) < 0) continue;
      w.r += w.speed * dt;
      if (w.r > w.max) { w.on = false; continue; }
      // the wall of fire sweeps past: Finn on the floor where it went by is caught
      const dx = pl.x - w.x, dz = pl.z - w.z, d = Math.hypot(dx, dz);
      if (!w.hit && B.st === "fight" && api.player.dead <= 0 && pl.y < A.y + K.wave.h && d > w.pr - K.wave.w - 0.3 && d < w.r + K.wave.w * 0.5) {
        w.hit = true;
        api.hurt(1, dx / (d || 1), dz / (d || 1), "fire");
      }
    }
    // Finn can't walk through him (but once trampled by the charge he isn't carried along with it)
    const px = pl.x - B.x, pz = pl.z - B.z, pd = Math.hypot(px, pz), R = K.body + 0.42;
    if (!B.empty && !(B.dash && B.dash.hit) && pd < R && pl.y < B.y + K.tall && pl.y + 1.6 > B.y) {
      const [ux, uz] = away(B.x, B.z);
      pl.x = B.x + ux * R;
      pl.z = B.z + uz * R;
    }
    // a fight can't go on without Finn in the arena (a debug teleport)
    if ((B.st === "fight" || B.st === "intro") && !inArena() && api.player.dead <= 0) off();
    // the Flame Heart, the way out
    if (reward.on) {
      reward.t += dt;
      if (reward.t > 0.8 && Math.hypot(pl.x - reward.x, pl.z - reward.z) < 1.8 && pl.y < A.y + 3.5 && api.player.dead <= 0) {
        reward.on = false;
        api.burst(reward.x, A.y + 1.6, reward.z, 34, [0xff4a1a, 0xffffff, 0xffd23f], 6, 6, 0.5, 1);
        api.onReward();
      }
    }
    PT.k += ((PT.on ? 1 : 0) - PT.k) * Math.min(1, 2 * dt);
    if (PT.on && PT.k > 0.8 && Math.hypot(pl.x - PT.x, pl.z - PT.z) < 2.2 && pl.y < A.y + 3.5 && api.player.dead <= 0) {
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
    if (!B.dash) { B.kx += nx * (n > 1 ? 1 : 0.4); B.kz += nz * (n > 1 ? 1 : 0.4); }
    api.sfx(n > 1 ? "hitBig" : "hit");
    if (++B.voice % 3 === 0 || n > 1) api.sfx("bossHurt");
    if (B.saidT > 5 && Math.random() < 0.3) { B.saidT = 0; say(pick(STR.fire.hurt), 1.6); }
    api.burst(B.x, B.y + 2, B.z, 5 + 3 * n, [0xffffff, 0xff8a2a, 0xd2703a], 4, 4);
    glowBurst(B.x, B.y + 2.2, B.z, 4 + 2 * n, [0xffffff, 0xffb13b], 3, 0.4);
    if (n > 1) A.fx.cheer = Math.max(A.fx.cheer, 0.6);
    // too many blows at once (from 60% on, not while he's knocked silly or stuck): an Eruption round his feet
    B.heat += n;
    if (B.heat >= K.counter.dmg && B.phase > 0 && B.counterCd <= 0 && B.pose !== "dazed" && B.hp > n) {
      B.heat = 0;
      B.counterCd = K.counter.cd;
      say(pick(STR.fire.shout.counter), 1.6);
      api.sfx("roar");
      castBar("counter", K.counter.warn);
      hazard({ shape: CIRCLE, x: B.x, z: B.z, r: K.counter.r, warn: K.counter.warn, onFire: eruptionHit });
      glowBurst(B.x, A.y + 1, B.z, 30, [0xff5a1a, 0xffe08a], 3, 0.7);
    }
    // Finn doesn't heal on his own in the fight: every so many blows a heart falls out of him
    B.dropAcc += n;
    if (B.dropAcc >= K.heartEvery && B.hp > 0) {
      B.dropAcc -= K.heartEvery;
      const q = clampIn(B.x + (A.x - B.x) * 0.3 + (pl.x - B.x) * 0.3, B.z + (A.z - B.z) * 0.3 + (pl.z - B.z) * 0.3, 24);
      api.dropHeart(q.x, A.y + 2.5, q.z);
      api.sfx("ready");
      if (B.saidT > 2) { B.saidT = 0; say(pick(STR.fire.dropped), 1.8); }
    }
    const f = B.hp / K.hp;
    if (B.nextPhase < 1 && f <= K.phase2) B.nextPhase = 1;
    if (B.nextPhase < 2 && f <= K.phase3) B.nextPhase = 2;
    if (B.hp <= 0) {
      HZ.cancel();
      timers.length = 0;
      burns.length = 0;
      for (const w of waves) w.on = false;
      B.st = "down";
      B.dead = true;
      B.script = lost();
      B.script.next();
      return true;
    }
    return false;
  }
  B.hurt = hurt;
  /** The sword swing sw (main.js SWING) from Finn: true if it hit him. */
  function swordHit(sw, heading) {
    if (!hittable()) return false;
    const dx = B.x - pl.x, dz = B.z - pl.z, d = Math.hypot(dx, dz);
    if (d > sw.range + K.body || pl.y + 2.3 < B.y || pl.y > B.y + K.tall) return false;
    if (Math.abs(wrap(Math.atan2(dx, dz) - heading)) > sw.arc && d > K.body + 1.2) return false;
    const nx = dx / (d || 1), nz = dz / (d || 1);
    api.fx.star(B.x - nx * K.body * 0.85, clamp(pl.y + 1.1, B.y + 0.6, B.y + 5), B.z - nz * K.body * 0.85, sw.heavy ? 1.35 : 0.95, sw.spark);
    hurt(sw.dmg, nx, nz);
    return true;
  }

  // ── every rendered frame ──
  // arm poses: [shoulder x, y, z, elbow] (s: -1 his left, +1 his right)
  const ARMS = {
    idle: (s, t) => [0.08 + 0.04 * Math.sin(t * 1.5 + s), 0, s * 0.28, -0.35],
    walk: (s, t, ph) => [0.05 - s * Math.sin(ph) * 0.4, 0, s * 0.3, -0.45],
    throw: (s, t) => {
      const mine = (B.throwN % 2 ? 1 : -1) === s, u = B.throwT;
      if (!mine) return [-0.5, 0, s * 0.55, -0.9];
      return u < 0.2 ? [-2.9, 0, s * 0.35, -1.3] : u < 0.5 ? [-0.7, 0, s * 0.25, -0.15] : [-0.3, 0, s * 0.3, -0.5];
    },
    sky: (s, t) => [-2.9, 0, s * 0.35, -0.2 + 0.12 * Math.sin(t * 10 + s)],
    summon: (s, t) => (s > 0 ? [-2.8, 0, 0.3, -0.25 + 0.1 * Math.sin(t * 12)] : [-1.0, 0, -0.7, -0.4]),
    slamUp: (s) => [-3.0, 0, s * 0.18, -1.3],
    slamGo: (s) => [-1.25, 0, s * 0.12, -0.1],
    stompUp: (s, t) => [-0.35, 0, s * 1.0, -0.6 + 0.05 * Math.sin(t * 8)],
    stompGo: (s) => [-0.2, 0, s * 0.8, -0.4],
    chargeWind: (s, t) => [0.7, 0, s * 0.45, -1.0 + 0.1 * Math.sin(t * 14)],
    charge: (s, t) => [0.9 + 0.35 * Math.sin(t * 16 + (s > 0 ? Math.PI : 0)), 0, s * 0.4, -1.2],
    crouch: (s) => [0.6, 0, s * 0.45, -0.7],
    air: (s) => [-2.6, 0, s * 0.55, -0.35],
    land: (s) => [-0.9, 0, s * 0.85, -0.3],
    sun: (s, t) => [-2.95, 0, s * 0.3, -0.55 + 0.05 * Math.sin(t * 20)],
    sunThrow: (s) => [-1.05, 0, s * 0.3, -0.1],
    roar: (s, t) => [-1.6, 0, s * 1.25, -0.9 + 0.3 * Math.sin(t * 20 + s)],
    dazed: (s, t) => [0.2, 0, s * (0.9 + 0.1 * Math.sin(t * 3)), -0.3],
    down: (s) => [0.35, 0, s * 0.45, -0.25],
    empty: (s) => [0.55, 0, s * 0.12, -0.05],
    gloat: (s, t) => [-0.3, 0.2 * s, s * 1.05, -2.2 + 0.05 * Math.sin(t * 16)],
  };
  // legs: [hip, knee] per side (the same s)
  const LEGS = {
    stompUp: (s) => (s === B.foot ? [-1.25, 1.5] : [0.05, 0.1]),
    stompGo: (s) => (s === B.foot ? [-0.4, 0.3] : [0.2, 0.25]),
    crouch: () => [-0.85, 1.55],
    land: () => [-0.8, 1.45],
    air: () => [-0.9, 1.6],
    dazed: (s, t) => [-0.15 + 0.08 * Math.sin(t * 3 + s), 0.3],
    down: (s) => (s > 0 ? [-1.45, 1.55] : [0.35, 1.75]),
    empty: (s) => (s > 0 ? [-1.5, 1.6] : [0.35, 1.8]),
    chargeWind: (s) => (s > 0 ? [-0.5, 0.6] : [0.45, 0.3]),
    slamGo: () => [-0.45, 0.8],
    sunThrow: () => [-0.35, 0.6],
  };
  const LEAN = { throw: 0.05, slamUp: -0.15, slamGo: 0.6, chargeWind: 0.4, charge: 0.5, crouch: 0.3, land: 0.35, sun: -0.12, sunThrow: 0.4, roar: -0.2, dazed: -0.1, down: 0.45, empty: 0.75, gloat: -0.15, sky: -0.18 };
  const ROAR = { roar: 1, sun: 1, sky: 1, charge: 1, chargeWind: 1, gloat: 1, slamUp: 1, summon: 1 };
  const cur = { red: new THREE.Color(), orange: new THREE.Color(), yellow: new THREE.Color() }, curE = { red: new THREE.Color(), orange: new THREE.Color(), yellow: new THREE.Color() };
  for (const k in cur) { cur[k].setHex(TINT[0][k][0]); curE[k].setHex(TINT[0][k][1]); }
  const _t1 = new THREE.Color(), _t2 = new THREE.Color(), _hc = new THREE.Color(), _he = new THREE.Color();
  const reach = (h, k) => 0.4 * Math.cos(h) + 0.4 * Math.cos(h + k) + 0.09;
  let fpWave = 0;
  function pose(dt, t) {
    const k = 1 - Math.exp(-12 * dt), p = B.pose, fn = ARMS[p] || ARMS.idle;
    const hk = Math.max(0, B.hurtT / 0.25), speed = Math.hypot(B.vx, B.vz), walking = p === "idle" && speed > 0.6;
    const ph = (B.stride / (1.1 * S)) * Math.PI, sw = Math.min(1, speed / 3);
    U.arms.forEach((Am, i) => {
      const s = i ? 1 : -1, [x, y, z, e] = walking ? ARMS.walk(s, t, ph) : fn(s, t);
      Am.sh.rotation.set(lerp(Am.sh.rotation.x, x - 0.3 * hk, k), lerp(Am.sh.rotation.y, y, k), lerp(Am.sh.rotation.z, z + s * 0.4 * hk, k));
      Am.el.rotation.x = lerp(Am.el.rotation.x, e, k);
    });
    let lowest = 0;
    U.legs.forEach((L, i) => {
      const s = i ? 1 : -1, lf = LEGS[p];
      let [hx, kx] = lf ? lf(s, t) : [0, 0.05];
      if (!lf && (walking || p === "charge")) {
        const q = p === "charge" ? (t * 11 + (s > 0 ? Math.PI : 0)) : ph + (s > 0 ? Math.PI : 0), amp = p === "charge" ? 0.8 : 0.5 * sw;
        hx = -Math.sin(q) * amp;
        kx = Math.max(0, Math.cos(q)) * amp * 1.3 + 0.05;
      }
      L.hip.rotation.x = lerp(L.hip.rotation.x, hx, k);
      L.knee.rotation.x = lerp(L.knee.rotation.x, kx, k);
      lowest = Math.max(lowest, reach(L.hip.rotation.x, L.knee.rotation.x));
    });
    // the body sits on whichever leg reaches lowest
    model.userData.drop = 0.89 - lowest;
    U.body.rotation.x = lerp(U.body.rotation.x, (LEAN[p] ?? (walking ? 0.08 : 0)) - 0.12 * hk, 1 - Math.exp(-8 * dt));
    U.body.rotation.z = p === "dazed" ? 0.06 * Math.sin(t * 3) : p === "roar" ? 0.03 * Math.sin(t * 30) : 0;
    const dizzy = p === "dazed" || p === "down";
    U.head.rotation.set(
      (p === "roar" || p === "sun" || p === "sky" ? -0.3 : p === "down" ? 0.3 : 0.03 * Math.sin(t * 0.8)) - 0.25 * hk,
      dizzy ? 0.25 * Math.sin(t * 3.5) : 0.08 * Math.sin(t * 0.5),
      dizzy ? 0.18 * Math.cos(t * 3.5) : 0,
    );
    U.head.visible = !B.empty;
    for (const hd of U.hands) hd.visible = !B.empty;
    const mouth = !!ROAR[p] || hk > 0.3;
    U.frown.visible = !mouth;
    for (const m of U.roar) m.visible = mouth;
    U.eyes.scale.y = dizzy ? 0.4 : 1;
    // his fire flickers, grows with his anger and changes colour (orange, white-hot, blue)
    const grow = 1 + 0.1 * B.phase;
    U.flames.forEach((f, i) => { f.scale.y = grow * (1 + Math.sin(t * 11 + i * 1.7) * 0.08 + Math.sin(t * 17 + i) * 0.04); f.scale.x = f.scale.z = 1 + 0.04 * Math.sin(t * 9 + i); });
    for (const hd of U.hands) hd.scale.setScalar((hd.userData.s0 ??= hd.scale.x) * grow * (1 + 0.08 * Math.sin(t * 13 + hd.id)));
    const tint = TINT[B.phase], tk = 1 - Math.exp(-2.5 * dt);
    for (const key in cur) { cur[key].lerp(_t1.setHex(tint[key][0]), tk); curE[key].lerp(_t2.setHex(tint[key][1]), tk); }
    for (const { m, kind } of fireMats) { m.color.copy(cur[kind]); m.emissive.copy(curE[kind]); }
    for (let i = 0; i < mats.length; i++) {
      if (B.flash > 0) mats[i].emissive.setRGB(1, 1, 1);
      else if (!fireMats.some((f) => f.m === mats[i])) mats[i].emissive.copy(baseEm[i]);
    }
    // every fire he makes takes his colour too
    FC.value.copy(_hc.setHex(HOT[B.phase][0]));
    FE.value.copy(_he.setHex(HOT[B.phase][1]));
  }
  const _v = new THREE.Vector3(), _w = new THREE.Vector3();
  const AURA = [0xff8a2a, 0xffc04a, 0x6ab8ff];
  function effects(dt, t, camera, near, show) {
    const busy = B.st === "fight" || B.st === "intro" || B.st === "down";
    if (show && !B.empty) {
      // embers rising off him and his hands
      const mp = model.position, col = AURA[B.phase];
      for (let k = count(14 + 10 * B.phase, dt); k > 0; k--) {
        const a = Math.random() * TAU, r = 0.6 + Math.random() * 1.4;
        glow(mp.x + Math.sin(a) * r, mp.y + 4.5 + Math.random() * 4, mp.z + Math.cos(a) * r, col, 0, 1.5 + Math.random() * 1.5, 0, 0.9, 0.5);
      }
      for (const hd of U.hands) {
        hd.getWorldPosition(_w);
        for (let k = count(10, dt); k > 0; k--) glow(_w.x, _w.y, _w.z, Math.random() < 0.5 ? 0xffe08a : col, (Math.random() - 0.5) * 1.5, 1 + Math.random() * 1.5, (Math.random() - 0.5) * 1.5, 0.4, 2);
      }
    }
    // his flame flying off home
    if (SOUL.on) {
      SOUL.t += dt;
      SOUL.y += (6 + SOUL.t * 18) * dt;
      SOUL.x += 3 * dt;
      for (let k = count(90, dt); k > 0; k--) glow(SOUL.x + (Math.random() - 0.5) * 1.2, SOUL.y + (Math.random() - 0.5) * 1.2, SOUL.z + (Math.random() - 0.5) * 1.2, Math.random() < 0.4 ? 0xffe08a : 0xff8a2a, 0, -1, 0, 0.6, 1);
      if (SOUL.t > 2.2) SOUL.on = false;
    }
    // sparks all along the walls of fire as they run
    for (const w of waves) {
      if (!w.on || !near || w.t < 0) continue;
      for (let k = count(Math.min(260, w.r * 9), dt); k > 0; k--) {
        const a = Math.random() * TAU, x = w.x + Math.sin(a) * w.r, z = w.z + Math.cos(a) * w.r;
        if (Math.hypot(x - A.x, z - A.z) < A.floor - 0.5) glow(x, A.y + 0.2 + Math.random() * 0.8, z, Math.random() < 0.5 ? 0xffe08a : AURA[B.phase], Math.sin(a) * 3, 1.5 + Math.random() * 2, Math.cos(a) * 3, 0.45, 2);
      }
    }
    // fireballs trail sparks
    for (const b of balls) {
      if (!b.on) continue;
      for (let k = count(b.fall ? 60 : 40, dt); k > 0; k--) glow(b.x + (Math.random() - 0.5) * 0.6, b.y + (Math.random() - 0.5) * 0.6, b.z + (Math.random() - 0.5) * 0.6, Math.random() < 0.5 ? 0xffb13b : 0xff5a1a, 0, 0.5, 0, 0.45, 1.5);
    }
    // the Sun sheds flames as it grows
    if (sun.visible) for (let k = count(60, dt); k > 0; k--) {
      const a = Math.random() * TAU, e = Math.random() * 2 - 1, r = sun.scale.x * 1.05, c = Math.sqrt(1 - e * e);
      glow(sun.position.x + Math.cos(a) * c * r, sun.position.y + e * r, sun.position.z + Math.sin(a) * c * r, Math.random() < 0.5 ? 0xffe08a : AURA[B.phase], Math.cos(a) * c * 2, e * 2 + 1, Math.sin(a) * c * 2, 0.7, 1);
    }
    for (const s of scorches) {
      s.t += dt;
      s.m.visible = near && s.t < s.life;
      if (s.m.visible) s.m.material.opacity = Math.min(1, s.t / 0.08) * Math.min(1, (s.life - s.t) / 1.5);
    }
    for (const c of cracks) {
      c.t += dt;
      c.m.visible = near && c.t < c.life;
      if (c.m.visible) c.m.material.opacity = Math.min(1, c.t / 0.1) * Math.min(1, (c.life - c.t) / 1.2);
    }
    stepGlow(dt);
    // the heat at the screen's edge: only with the camera in the arena; hotter as he gets angrier
    const cam = camera.position, inside = near && cam.y > A.y - 30 && Math.hypot(cam.x - A.x, cam.z - A.z) < 60;
    const o = inside ? (busy ? 0.85 : 0.45) : 0, c = inside && busy ? "p" + B.phase : "";
    if (o !== HEAT.o) { HEAT.o = o; heat.style.opacity = o; }
    if (c !== HEAT.c) { HEAT.c = c; heat.classList.remove("p0", "p1", "p2"); if (c) heat.classList.add(c); }
  }
  function update(dt, alpha, t, camera) {
    const near = B.st !== "off" && camera.position.distanceTo(_v.set(A.x, A.y, A.z)) < 200;
    FT.value = t;
    model.visible = shadow.visible = near;
    if (near) {
      model.rotation.y = B.pface + wrap(B.face - B.pface) * alpha;
      pose(dt, t);
      model.position.set(lerp(B.px, B.x, alpha), lerp(B.py, B.y, alpha) - (model.userData.drop || 0) * S, lerp(B.pz, B.z, alpha));
      shadow.position.set(model.position.x, A.y + 0.07, model.position.z);
      shadow.scale.setScalar(1.6 * clamp(1 - B.air / 20, 0.4, 1));
    }
    bubble.visible = near && B.armor && B.st === "fight";
    if (bubble.visible) {
      bubble.position.set(model.position.x, model.position.y + 4, model.position.z);
      bubble.scale.setScalar(5.2 + 0.2 * Math.sin(t * 6));
      bubble.material.color.setHex(AURA[B.phase]);
    }
    // Flame Princess in the royal box: she waves when Finn arrives and cheers him on
    fp.visible = near && !!A.box;
    if (fp.visible) {
      fp.position.set(A.box.x, A.box.y, A.box.z);
      fp.rotation.y = turnToward(fp.rotation.y, Math.atan2(pl.x - A.box.x, pl.z - A.box.z), 2 * dt);
      poseNpc(fp, { time: t, near: fpWave > 0 ? 3 : 30, talking: A.fx.cheer > 0.35 }, dt);
      fpWave = Math.max(0, fpWave - dt);
    }
    HZ.draw(t);
    // flame columns: they shoot up, stand flickering and die down
    let any = false;
    for (let i = 0; i < FN; i++) {
      const c = cols[i];
      if (c.on) {
        c.t += dt;
        if (c.t >= c.life) c.on = false;
      }
      if (!c.on || c.t < 0) {
        if (c.shown) { colMesh.setMatrixAt(i * 2, _m4.makeScale(0, 0, 0)); colMesh.setMatrixAt(i * 2 + 1, _m4.makeScale(0, 0, 0)); c.shown = false; }
        continue;
      }
      any = c.shown = true;
      const up = c.t < c.rise ? 1 - (1 - c.t / c.rise) ** 3 : 1, fade = Math.min(1, (c.life - c.t) / 0.3), h = c.h * up * (0.92 + 0.08 * Math.sin(t * 23 + i)) * (0.6 + 0.4 * fade);
      _q.identity();
      colMesh.setMatrixAt(i * 2, _m4.compose(_p.set(c.x, A.y, c.z), _q, _s.set(c.r * (0.8 + 0.2 * fade), Math.max(0.01, h), c.r * (0.8 + 0.2 * fade))));
      colMesh.setMatrixAt(i * 2 + 1, _m4.compose(_p, _q, _s.set(c.r * 0.5, Math.max(0.01, h * 0.75), c.r * 0.5)));
      colMesh.setColorAt(i * 2, _c.setScalar(c.hot * fade * 0.85));
      colMesh.setColorAt(i * 2 + 1, _c.setScalar(c.hot * fade));
    }
    colMesh.visible = any && near;
    if (any) { colMesh.instanceMatrix.needsUpdate = true; colMesh.instanceColor.needsUpdate = true; }
    // walls of fire running out along the floor
    for (const w of waves) {
      w.m.visible = near && w.on && w.t >= 0;
      if (!w.m.visible) continue;
      const r = lerp(w.pr, w.r, alpha);
      w.m.position.set(w.x, A.y, w.z);
      w.m.scale.set(r, 1.8 + 0.15 * Math.sin(t * 20), r);
      w.m.material.uniforms.uRep.value = Math.max(8, Math.round(r * 1.6));
    }
    // the burning floor after the Sun
    SEA.t += dt;
    sea.visible = near && SEA.t < SEA.life;
    if (sea.visible) seaMat.uniforms.uFade.value = Math.min(1, SEA.t / 0.1) * Math.min(1, (SEA.life - SEA.t) / 1.2);
    // fireballs: lobbed (a parabola) or falling from the sky
    any = false;
    for (let i = 0; i < BN; i++) {
      const b = balls[i];
      if (b.on) {
        b.t += dt;
        const u = Math.min(1, b.t / b.dur);
        b.x = lerp(b.x0, b.x1, u);
        b.z = lerp(b.z0, b.z1, u);
        b.y = b.fall ? lerp(b.y0, A.y, u * u) : lerp(b.y0, A.y + 0.5, u) + 4 * b.arc * u * (1 - u);
        if (u >= 1) b.on = false;
      }
      if (!b.on) {
        if (b.shown) { ballMesh.setMatrixAt(i * 2, _m4.makeScale(0, 0, 0)); ballMesh.setMatrixAt(i * 2 + 1, _m4.makeScale(0, 0, 0)); b.shown = false; }
        continue;
      }
      any = b.shown = true;
      _q.identity();
      const s = b.s * (0.95 + 0.08 * Math.sin(t * 30 + i));
      ballMesh.setMatrixAt(i * 2, _m4.compose(_p.set(b.x, b.y, b.z), _q, _s.set(s, s, s)));
      ballMesh.setMatrixAt(i * 2 + 1, _m4.compose(_p, _q, _s.set(s * 0.55, s * 0.55, s * 0.55)));
      ballMesh.setColorAt(i * 2, _c.setHex(AURA[B.phase]));
      ballMesh.setColorAt(i * 2 + 1, _c.setHex(0xfff4c0));
    }
    ballMesh.visible = any && near;
    if (any) { ballMesh.instanceMatrix.needsUpdate = true; ballMesh.instanceColor.needsUpdate = true; }
    // the Sun: born between his hands, it swells over his head; then down it comes
    if (SUN.on) {
      SUN.t += dt;
      const g = clamp(SUN.t / (SUN.warn * 0.8), 0, 1), size = K.sun.size * (0.15 + 0.85 * (1 - (1 - g) ** 2)), hy = A.y + 9 + g * (K.sun.h - 9);
      if (SUN.fall) {
        SUN.ft += dt;
        const u = Math.min(1, SUN.ft / 0.55);
        sun.position.set(lerp(B.x, SUN.x, u), lerp(hy, A.y + 1, u * u), lerp(B.z, SUN.z, u));
      } else sun.position.set(model.position.x, hy, model.position.z);
      sun.scale.setScalar(size * (1 + 0.03 * Math.sin(t * 17)));
    }
    sun.visible = corona.visible = near && SUN.on;
    if (sun.visible) {
      corona.position.copy(sun.position);
      corona.scale.setScalar(sun.scale.x * 4.2);
      corona.material.color.setHex(AURA[B.phase]);
    }
    // the Flame Heart spins in the air where he fell; the gate's portal swirls open
    prize.visible = gem.visible = reward.on;
    if (reward.on) {
      prize.position.set(reward.x, A.y + 1.6 + Math.sin(t * 2.5) * 0.2, reward.z);
      orbitCrystal(gem, reward.x, A.y + 1.6, reward.z, t, 1.6);
      prize.rotation.set(0, t * 2, 0);
      if (Math.random() < dt * 10) glow(reward.x + (Math.random() - 0.5), A.y + 1.2, reward.z + (Math.random() - 0.5), 0xffb13b, 0, 1.5, 0, 0.8, 0.5);
    }
    portal.visible = near && PT.k > 0.02;
    if (portal.visible) {
      portal.scale.setScalar(PT.k);
      swirl.rotation.z = -t * 2.5;
      if (PT.on && Math.random() < dt * 10) api.burst(PT.x, A.y + 2.4, PT.z, 2, [0xff8a2a, 0xffffff], 2, 2, 0.1, 0.7);
    }
    effects(dt, t, camera, near, near);
    if (B.cast) $("bossCastFill").style.width = clamp(B.cast.t / B.cast.dur, 0, 1) * 100 + "%";
    if (B.st === "fight" || B.st === "down" || B.st === "intro") hudHp();
  }

  return {
    B, K, hazards: HZ.list, waves, burns,
    /** The Flame King as a target for the sword's aim, Jake's punches and the giant fist (null: not now). */
    foe: () => (hittable() ? B : null),
    fighting: () => B.st === "fight" || B.st === "down" || B.st === "intro",
    /** Is (a point) in the Colosseum of Flames? (The camera stays inside its wall there.) */
    holds: (p) => inArena(p),
    swordHit,
    step,
    update,
    enter,
    off,
    /** Finn fainted: he gloats; main.js takes Finn back to the palace and calls off(). */
    finnDown: () => {
      if (!(B.st === "fight" || B.st === "intro")) return;
      say(STR.fire.finnDown, 3);
      B.script = null;
      HZ.cancel();
      timers.length = 0;
      burns.length = 0;
      B.dash = null;
      B.goal.on = false;
      SUN.on = false;
      for (const w of waves) w.on = false;
      B.st = "gloat";
      B.dead = true;
      setPose("gloat");
    },
    say,
  };
}
