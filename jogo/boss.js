// The Ice King fight on the Ice Crown (CROWN in ice.js), the arena on top of his mountain. He floats
// low enough for the sword (feet ~1.2 off the floor) and gets hit like anyone. Every area attack
// marks its ground first in red-orange; the fill grows toward the edge and it hits when it gets
// there (the hit is checked at that instant, on a slightly smaller shape than the one drawn):
//   bolt   Ice Lightning: circles drop on Finn one after another; each bolt leaves an ice pillar
//   breath Frost Breath: he dips low and breathes a cone ahead of him (circle behind him to hit)
//   nova   Blizzard, out: a circle around him (get away)       } shouted differently; from 60% hp
//   donut  Blizzard, in: a ring with him in the middle (get in) } on, one follows the other
//   dive   Beard Dive: out of reach, his shadow chases Finn, locks, he crashes and sits dazed
// At 60% and 30% hp he gets angrier (shorter warnings, combos, lightning with everything) and drops
// a heart. Losing knocks his crown off, as in the pilot. If Finn faints the fight starts over and
// Finn wakes on the last ledge by the gate (main.js); the gate is sealed while they fight.
// Attack scripts are generators stepped with the physics dt (deterministic under __game.sim).
import * as THREE from "three";
import { makeNpc } from "./npcs.js";
import { toon, noOutline } from "./toon.js";
import { cylCollider } from "./physics.js";
import { CROWN } from "./ice.js";
import { makeShadow } from "./characters.js";
import { heartGeo } from "./fx.js";
import { makeCrystal, orbitCrystal } from "./crystals.js";
import { createHazards, CIRCLE, RING, SECTOR } from "./hazards.js";
import { STR } from "./strings.js";

// hp, sizes (world units) and timings (s); arrays are per phase (100–60%, 60–30%, below 30%)
export const K = {
  hp: 145, scale: 1.4, body: 0.85, hover: 1.2, glide: [10.5, 12, 13.5],
  phase2: 0.6, phase3: 0.3, heartEvery: 43, // a heart drops out of him every heartEvery hp he loses
  bolt: { n: [8, 9, 10], every: [0.39, 0.33, 0.28], warn: [0.88, 0.78, 0.7], r: 2.1, pillar: 3.5 },
  breath: { warn: [0.93, 0.81, 0.74], r: 11, half: 0.55 },
  nova: { warn: [1.24, 1.08, 0.97], r: 6.5 },
  donut: { warn: [1.4, 1.21, 1.09], r0: 4.4 },
  dive: { follow: [1.85, 1.62, 1.45], lock: [0.7, 0.62, 0.58], r: 3.2, daze: [1.8, 1.55, 1.4], high: 7.5 },
};
const ORDER = ["bolt", "breath", "blizzard", "dive"];
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const turnToward = (a, b, max) => a + clamp(wrap(b - a), -max, max);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const $ = (id) => document.getElementById(id);

/** Zigzag lightning: two crossed ribbons from (x, y0, z) down to (x, y1, z). */
const BOLT_SEG = 12;
export function boltGeo() {
  const g = new THREE.BufferGeometry(), idx = [];
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(2 * (BOLT_SEG + 1) * 2 * 3), 3));
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < BOLT_SEG; i++) {
      const a = r * (BOLT_SEG + 1) * 2 + i * 2;
      idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
  }
  g.setIndex(idx);
  return g;
}
export function shapeBolt(g, x, y0, y1, z) {
  const P = g.attributes.position;
  let jx = 0, jz = 0;
  for (let i = 0; i <= BOLT_SEG; i++) {
    const t = i / BOLT_SEG, y = y0 + (y1 - y0) * t, w = 0.42 * (1 - 0.6 * t) + 0.08;
    if (i > 0 && i < BOLT_SEG) { jx = (Math.random() - 0.5) * 1.4; jz = (Math.random() - 0.5) * 1.4; } else jx = jz = 0;
    for (let r = 0; r < 2; r++) {
      const k = (r * (BOLT_SEG + 1) + i) * 2, ox = r ? 0 : w, oz = r ? w : 0;
      P.setXYZ(k, x + jx - ox, y, z + jz - oz);
      P.setXYZ(k + 1, x + jx + ox, y, z + jz + oz);
    }
  }
  P.needsUpdate = true;
}

/**
 * api (main.js): player, hurt(n, nx, nz, kind), burst(x, y, z, n, colors, speed, up, g, life), fx,
 * sfx, shake, freeze, dropHeart(x, y, z), onStart() (Jake joins), onWin(first), onReward().
 */
export function createBoss(scene, api) {
  const C = CROWN, pl = api.player.pos;
  const waitSpot = () => {
    const a = C.gate[0] + Math.PI;
    return { x: C.x + Math.sin(a) * 6, z: C.z + Math.cos(a) * 6 };
  };

  // ── the Ice King (his own materials: he flashes white when hit) ──
  const model = makeNpc("iceking");
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
  const shadow = makeShadow(0.95);
  shadow.visible = false;
  scene.add(shadow);
  // ice magic glowing in his hands while he gathers a spell
  const additive = (color, o = {}) => noOutline(new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, ...o }));
  const glowGeo = new THREE.SphereGeometry(1, 10, 8), glowMat = additive(0xbff4ff, { opacity: 0.9 });
  const glows = U.arms.map((A) => {
    const m = new THREE.Mesh(glowGeo, glowMat);
    m.position.set(0, -0.36, 0.02);
    m.scale.setScalar(0.001);
    A.el.add(m);
    return m;
  });
  // a bubble of ice while he's untouchable (the rage in between phases)
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), additive(0x9fe6ff, { opacity: 0.3, side: THREE.DoubleSide }));
  bubble.visible = false;
  scene.add(bubble);
  // the crown he loses: a copy that flies off his head
  const flyCrown = U.crown.clone();
  flyCrown.visible = false;
  scene.add(flyCrown);
  const crown = { on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, spin: 0, rest: false };
  // little stars circling his head while he's dazed
  const starC = document.createElement("canvas");
  starC.width = starC.height = 64;
  {
    const x = starC.getContext("2d");
    x.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU - Math.PI / 2, r = i % 2 ? 12 : 28;
      x.lineTo(32 + Math.cos(a) * r, 34 + Math.sin(a) * r);
    }
    x.closePath();
    x.fillStyle = "#ffe14d";
    x.strokeStyle = "#1d2340";
    x.lineWidth = 5;
    x.lineJoin = "round";
    x.fill();
    x.stroke();
  }
  const starTex = new THREE.CanvasTexture(starC);
  starTex.colorSpace = THREE.SRGBColorSpace;
  const dizzyStars = new THREE.Group(), starMat = new THREE.SpriteMaterial({ map: starTex, transparent: true, depthWrite: false });
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Sprite(starMat);
    s.scale.setScalar(0.14);
    dizzyStars.add(s);
  }
  dizzyStars.position.set(0, 0.46, 0);
  dizzyStars.visible = false;
  U.head.add(dizzyStars);

  // ── pools: spikes (one instanced mesh), lightning bolts, the breath ──
  const SP = 300;
  const spikeMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 5).translate(0, 0.5, 0), toon(0xc4ecff, { flat: true, outline: false, emissive: 0x0a2438 }), SP);
  spikeMesh.frustumCulled = false;
  spikeMesh.visible = false;
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  for (let i = 0; i < SP; i++) spikeMesh.setMatrixAt(i, _m4.makeScale(0, 0, 0));
  scene.add(spikeMesh);
  const spikes = [];
  for (let i = 0; i < SP; i++) spikes.push({ on: false, shown: false, t: 0, life: 1, x: 0, z: 0, r: 1, h: 1, rx: 0, rz: 0, ry: 0, solid: false, k: 0 });
  let spikeNext = 0;
  const boltMat = additive(0xe4f9ff, { side: THREE.DoubleSide });
  const bolts = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(boltGeo(), boltMat.clone());
    noOutline(m.material);
    m.visible = false;
    m.frustumCulled = false;
    scene.add(m);
    bolts.push({ m, t: 1 });
  }
  let boltNext = 0;
  const breathMesh = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 18, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 0.5),
    additive(0xffffff, { opacity: 0, side: THREE.DoubleSide, blending: THREE.NormalBlending }));
  breathMesh.visible = false;
  scene.add(breathMesh);
  const breath = { t: 9, x: 0, y: 0, z: 0, a: 0 };

  // ── the gate: an ice wall rises in the gap of the crown band while they fight ──
  const gate = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), toon(0xb0e2ff, { flat: true, tex: "shards", scale: 0.2 }));
  const gateCols = [];
  let gateK = 0, gateShut = false;
  function placeGate() {
    const [a, w] = C.gate, R = C.wall;
    gate.position.set(C.x + Math.sin(a) * R, C.y - 0.1, C.z + Math.cos(a) * R);
    gate.rotation.y = a;
    gate.scale.set(2 * R * Math.sin(w / 2) - 1.2, 0.001, 0.9);
    for (const f of [-0.66, -0.33, 0, 0.33, 0.66]) {
      const b = a + (f * w) / 2;
      gateCols.push(cylCollider(C.x + Math.sin(b) * R, C.z + Math.cos(b) * R, 0.6, -1e4, -1e4, false));
    }
  }
  gate.visible = false;
  scene.add(gate);
  function shutGate(on) {
    gateShut = on;
    for (const c of gateCols) { c.y0 = on ? C.y - 1 : -1e4; c.y1 = on ? C.y + 4.4 : -1e4; }
  }

  // ── the reward: the Ice Heart (a sixth heart) and the Ice Crystal, floating in the middle after the first win ──
  const prize = new THREE.Mesh(heartGeo(), toon(0x8fe3ff, { thick: 0.006, emissive: 0x0a3a5a }));
  prize.scale.setScalar(1.1);
  prize.visible = false;
  scene.add(prize);
  const gem = makeCrystal("ice");
  gem.visible = false;
  scene.add(gem);
  const reward = { on: false, t: 0 };

  // ── HUD: name, hp bar, cast bar, speech ──
  let sayTimer = 0;
  function say(text, secs = 3) {
    const el = $("bossSay");
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(sayTimer);
    sayTimer = setTimeout(() => el.classList.remove("show"), secs * 1000);
  }
  function hud(on) {
    if (on) $("bossName").textContent = STR.names.iceking;
    $("boss").hidden = !on;
    document.body.classList.toggle("bossOn", on);
    if (!on) { $("bossSay").classList.remove("show"); $("bossCast").hidden = true; }
  }
  let hpShown = -1;
  function hudHp() {
    const f = Math.max(0, B.hp / K.hp);
    if (f === hpShown) return;
    hpShown = f;
    $("bossHp").style.width = f * 100 + "%";
    $("bossLag").style.width = f * 100 + "%";
    $("bossPhase").textContent = STR.ice.phase[B.phase];
  }

  // ── state ──
  // st: off (not in the arena yet) | wait (floats there for Finn) | fight | gloat (Finn fainted) |
  // down (just lost) | rest (after losing: talk to him for a rematch)
  const B = {
    isBoss: true, active: true, dead: true, model, floor: C.y,
    st: "off", x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0, h: K.hover, vx: 0, vz: 0, kx: 0, kz: 0, face: 0, pface: 0,
    goal: { x: 0, z: 0, h: K.hover }, hRate: 4, faceLock: null,
    hp: K.hp, dropAcc: 0, phase: 0, nextPhase: 0, armor: false, flash: 0, hurtT: 0, hitN: 0, voice: 0, saidT: 0,
    pose: "idle", poseT: 0, spin: 0, cast: null, script: null, nearSaid: false, wins: 0,
    only: null, // debug: always this attack
  };
  const say2 = (key) => say(pick(STR.ice.shout[key]), 2.2);
  const setPose = (p) => { if (B.pose !== p) { B.pose = p; B.poseT = 0; } };
  function castBar(key, dur) {
    B.cast = { name: STR.ice.cast[key], t: 0, dur };
    $("bossCastName").textContent = B.cast.name;
    $("bossCast").hidden = false;
  }
  const inArena = (p = pl) => Math.hypot(p.x - C.x, p.z - C.z) < C.wall + 0.3 && p.y > C.y - 1 && p.y < C.y + 9;
  const hittable = () => B.st === "fight" && !B.armor && B.hp > 0;
  function clampIn(x, z, r) {
    const dx = x - C.x, dz = z - C.z, d = Math.hypot(dx, dz);
    return d > r ? { x: C.x + (dx / d) * r, z: C.z + (dz / d) * r } : { x, z };
  }
  function goTo(p, h = K.hover) {
    const q = clampIn(p.x, p.z, 11.5);
    B.goal.x = q.x;
    B.goal.z = q.z;
    B.goal.h = h;
    B.hRate = 4;
  }
  /** Where Finn will be in `s` seconds (inside the arena). */
  function lead(s, r = 12.6) {
    const v = api.player.vel;
    return clampIn(pl.x + v.x * s, pl.z + v.z * s, r);
  }

  // ── hazards: what the markers mark (hazards.js) ──
  const HZ = createHazards(scene, {
    player: api.player, y: C.y, center: C, reach: 12.6, color: 0xff4a1c,
    live: () => B.st === "fight",
    hit(h, nx, nz) {
      api.hurt(1, nx, nz, "ice");
      api.burst(pl.x, pl.y + 1, pl.z, 10, [0xffffff, 0xbfeaff, 0x8fd8ff], 4, 5);
    },
  });
  const hazards = HZ.list, hazard = HZ.add, away = HZ.away, cancelHazards = HZ.cancel;

  // ── spikes ──
  function spike(x, z, r, h, life, o = {}) {
    for (let n = 0; n < SP; n++) {
      const s = spikes[spikeNext];
      spikeNext = (spikeNext + 1) % SP;
      if (s.on) continue;
      Object.assign(s, { on: true, t: -(o.delay || 0), life, x, z, r, h, rx: (Math.random() - 0.5) * 0.5, rz: (Math.random() - 0.5) * 0.5, ry: Math.random() * TAU, solid: !!o.solid, k: 0 });
      return s;
    }
    return null;
  }
  function stepSpikes(dt) {
    for (const s of spikes) {
      if (!s.on) continue;
      s.t += dt;
      if (s.t < 0) continue;
      const rise = 0.12;
      if (s.t < rise) { const u = s.t / rise; s.k = 1 + 2.2 * (u - 1) ** 3 + 1.2 * (u - 1) ** 2; } // eases out, overshooting
      else s.k = s.t > s.life - 0.22 ? Math.max(0, (s.life - s.t) / 0.22) : 1;
      if (s.t >= s.life) {
        s.on = false;
        if (s.solid || Math.random() < 0.25) api.burst(s.x, C.y + s.h * 0.4, s.z, s.solid ? 10 : 3, [0xffffff, 0xc4ecff], 3, 3, 1, 0.5);
      }
    }
  }
  /** Everything shatters at once (the fight ended). */
  function clearSpikes() {
    for (const s of spikes) {
      if (s.on && s.t > 0) s.t = Math.max(s.t, s.life - 0.22);
      else s.on = false;
    }
  }
  /** Spikes filling the circle / ring (a, b radii) around (x, z), from the middle out. */
  function spikeField(x, z, a, b, life, gap = 1.7) {
    for (let r = Math.max(a, 0.6); r <= b; r += gap) {
      const n = Math.max(5, Math.round((TAU * r) / gap)), o = Math.random() * TAU;
      for (let i = 0; i < n; i++) {
        const t = o + (i / n) * TAU + (Math.random() - 0.5) * 0.2, rr = r + (Math.random() - 0.5) * 0.6;
        const q = clampIn(x + Math.sin(t) * rr, z + Math.cos(t) * rr, 13.9);
        spike(q.x, q.z, 0.35 + Math.random() * 0.25, 1.2 + Math.random() * 1.6, life, { delay: (r - a) * 0.012 });
      }
    }
  }

  // ── what each attack does when it lands ──
  function boltHit(h) {
    const b = bolts[boltNext];
    boltNext = (boltNext + 1) % bolts.length;
    shapeBolt(b.m.geometry, h.x, C.y + 22, C.y + 0.2, h.z);
    b.t = 0;
    // the bolt turns to ice where it strikes: a pillar that blocks the way for a few seconds
    spike(h.x, h.z, 0.8, 2.6, K.bolt.pillar, { solid: true });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + Math.random();
      spike(h.x + Math.sin(a) * 0.9, h.z + Math.cos(a) * 0.9, 0.35, 1.2 + Math.random(), K.bolt.pillar - 0.3);
    }
    api.fx.ring(h.x, C.y, h.z, h.r + 0.8, 0xdff7ff, 0.35);
    api.burst(h.x, C.y + 0.6, h.z, 12, [0xffffff, 0xbfeaff, 0x8fd8ff], 6, 6, 1, 0.6);
    api.sfx("zap");
    api.shake(0.12);
  }
  function breathHit(h) {
    Object.assign(breath, { t: 0, x: h.x, y: B.y + 1.95, z: h.z, a: h.a });
    for (let r = 2; r <= h.r; r += 1.8) {
      const n = Math.max(2, Math.round((2 * h.half * r) / 1.8));
      for (let i = 0; i < n; i++) {
        const a = h.a + (n === 1 ? 0 : (i / (n - 1) - 0.5) * 2 * (h.half - 0.08)), rr = r + (Math.random() - 0.5) * 0.8;
        const q = clampIn(h.x + Math.sin(a) * rr, h.z + Math.cos(a) * rr, 13.9);
        spike(q.x, q.z, 0.3 + Math.random() * 0.2, 0.8 + Math.random() * 1.1, 1.1, { delay: r * 0.025 });
      }
    }
    api.sfx("breath");
    api.shake(0.2);
  }
  function novaHit(h) {
    spikeField(h.x, h.z, 1.2, h.r - 0.3, 1.1);
    api.fx.ring(h.x, C.y, h.z, h.r + 1.5, 0xffffff, 0.5);
    api.fx.ring(h.x, C.y, h.z, h.r * 0.6, 0xbfeaff, 0.35);
    api.burst(h.x, C.y + 1, h.z, 30, [0xffffff, 0xbfeaff, 0x8fd8ff], 10, 7, 1, 0.8);
    api.sfx("crack");
    api.sfx("boom");
    api.shake(0.45);
    api.freeze(0.06);
  }
  function donutHit(h) {
    spikeField(h.x, h.z, h.inner + 0.5, 13.6, 1.2, 1.8);
    api.fx.ring(h.x, C.y, h.z, 14, 0xffffff, 0.5);
    api.burst(h.x, C.y + 1, h.z, 24, [0xffffff, 0xbfeaff], 12, 6, 1, 0.8);
    api.sfx("crack");
    api.sfx("boom");
    api.shake(0.45);
  }
  function diveHit(h) {
    B.x = B.px = h.x;
    B.z = B.pz = h.z;
    B.h = 0;
    spikeField(h.x, h.z, h.r + 0.2, h.r + 1.2, 0.9, 1.1);
    api.fx.ring(h.x, C.y, h.z, h.r + 2.5, 0xffffff, 0.5);
    api.fx.star(h.x, C.y + 0.6, h.z, 2.2, 0x8fe3ff);
    api.burst(h.x, C.y + 0.3, h.z, 30, [0xffffff, 0xd9f2ff, 0x1d3fd8], 10, 7, 1, 0.9);
    api.sfx("boom");
    api.shake(0.65);
    api.freeze(0.1);
  }

  // ── the fight, as scripts ──
  function* wait(s) {
    for (let t = 0; t < s; ) t += yield;
  }
  function* glide(max) {
    for (let t = 0; t < max && Math.hypot(B.goal.x - B.x, B.goal.z - B.z) > 0.6; ) t += yield;
  }
  /** Lightning on Finn that doesn't hold the script up (the angry phases add it to everything). */
  function harass(n, gap, warn, delay = 0.2) {
    for (let i = 0; i < n; i++) hazard({ shape: CIRCLE, r: K.bolt.r, warn, delay: delay + i * gap, aim: () => lead(0.25), onFire: boltHit });
  }
  const ATTACKS = {
    *bolt() {
      const P = B.phase, a = Math.atan2(pl.x - C.x, pl.z - C.z) + Math.PI + (Math.random() - 0.5) * 1.6;
      goTo({ x: C.x + Math.sin(a) * 9, z: C.z + Math.cos(a) * 9 }, 2.6);
      setPose("fly");
      yield* glide(1.3);
      const n = K.bolt.n[P], every = K.bolt.every[P], warn = K.bolt.warn[P];
      setPose("bolt");
      say2("bolt");
      castBar("bolt", n * every + warn);
      for (let i = 0; i < n; i++) {
        const q = lead(0.25);
        hazard({ shape: CIRCLE, x: q.x, z: q.z, r: K.bolt.r, warn, onFire: boltHit });
        if (P === 2 && i % 2) { const r = Math.random() * 11, t = Math.random() * TAU; hazard({ shape: CIRCLE, x: C.x + Math.sin(t) * r, z: C.z + Math.cos(t) * r, r: K.bolt.r, warn, onFire: boltHit }); }
        api.sfx("freeze");
        yield* wait(every);
      }
      yield* wait(warn);
      setPose("idle");
      yield* wait(0.5);
    },
    *breath() {
      const P = B.phase, dx = B.x - pl.x, dz = B.z - pl.z, d = Math.hypot(dx, dz) || 1;
      goTo({ x: pl.x + (dx / d) * 5.5, z: pl.z + (dz / d) * 5.5 }, 0.5);
      setPose("fly");
      yield* glide(1.3);
      const warn = K.breath.warn[P], a = Math.atan2(pl.x - B.x, pl.z - B.z);
      B.faceLock = a;
      setPose("breath");
      say2("breath");
      castBar("breath", warn);
      hazard({ shape: SECTOR, x: B.x, z: B.z, r: K.breath.r, half: K.breath.half, a, warn, onFire: breathHit });
      if (P >= 1) harass(P === 2 ? 3 : 2, 0.45, 1.0, 0.25);
      yield* wait(warn);
      setPose("breathGo");
      yield* wait(0.6);
      B.faceLock = null;
      setPose("idle");
      yield* wait(0.5); // still low: his back is open
    },
    *blizzard() {
      const P = B.phase, first = Math.random() < 0.5 ? "nova" : "donut";
      const parts = P === 0 ? [first] : [first, first === "nova" ? "donut" : "nova"];
      for (let i = 0; i < parts.length; i++) {
        const warn = K[parts[i]].warn[P];
        if (parts[i] === "nova") {
          // he swoops down next to Finn: get away
          if (i === 0) {
            const dx = B.x - pl.x, dz = B.z - pl.z, d = Math.hypot(dx, dz) || 1;
            goTo({ x: pl.x + (dx / d) * 2.2, z: pl.z + (dz / d) * 2.2 }, 0.9);
            setPose("fly");
            yield* glide(1.2);
          }
          setPose("nova");
          say2("nova");
          castBar("nova", warn);
          hazard({ shape: CIRCLE, x: B.x, z: B.z, r: K.nova.r, warn, onFire: novaHit });
          if (P === 2) harass(2, 0.5, 1.0, 0.3);
          yield* wait(warn);
          setPose("novaGo");
          yield* wait(i + 1 < parts.length ? 0.35 : 0.9);
        } else {
          // from the middle: only the hole around him is safe
          goTo({ x: C.x, z: C.z }, 1.4);
          setPose("fly");
          yield* glide(i === 0 ? 1.3 : 0.8);
          setPose("donut");
          say2("donut");
          castBar("donut", warn);
          hazard({ shape: RING, x: C.x, z: C.z, r: 14.4, inner: K.donut.r0, warn, onFire: donutHit });
          yield* wait(warn);
          setPose("novaGo");
          yield* wait(i + 1 < parts.length ? 0.35 : 0.8);
        }
      }
      setPose("idle");
    },
    *dive() {
      const P = B.phase;
      for (let rep = 0; rep < (P === 2 ? 2 : 1); rep++) {
        const follow = K.dive.follow[P] * (rep ? 0.7 : 1), lock = K.dive.lock[P];
        setPose("rise");
        if (!rep) say2("dive");
        api.sfx("whoosh");
        goTo({ x: B.x, z: B.z }, K.dive.high);
        castBar("dive", follow + lock);
        const h = hazard({ shape: CIRCLE, x: pl.x, z: pl.z, r: K.dive.r, follow, chase: [6.5, 7.5, 8.5][P], warn: lock, onFire: diveHit });
        // up there he rides along with his shadow; at the end he tucks in and drops on it
        for (let t = 0; !h.fired; ) {
          t += yield;
          B.goal.x = h.x;
          B.goal.z = h.z;
          if (t > follow + lock - 0.3) { setPose("dive"); B.goal.h = 0; B.hRate = 26; }
        }
        setPose("dazed");
        B.goal.h = 0;
        say(pick(STR.ice.dazed), 2);
        yield* wait(K.dive.daze[P] * (rep ? 0.5 : 1));
      }
      setPose("idle");
      goTo({ x: B.x, z: B.z }, K.hover);
      yield* wait(0.4);
    },
  };
  function* rage() {
    B.phase = B.nextPhase;
    B.armor = true;
    goTo({ x: C.x, z: C.z }, K.hover + 1.6);
    setPose("rage");
    say(B.phase === 1 ? STR.ice.phase2 : STR.ice.phase3, 3.2);
    api.sfx("roar");
    api.shake(0.5);
    api.burst(B.x, B.y + 2, B.z, 30, [0xffffff, 0xbfeaff, 0xd81f2a], 9, 7, 0.6, 1);
    hpShown = -1;
    yield* wait(1.9);
    api.dropHeart(C.x, C.y + 3, C.z);
    B.armor = false;
    setPose("idle");
  }
  function* fight() {
    setPose("intro");
    goTo({ x: C.x, z: C.z }, K.hover + 1.2);
    say(STR.ice.intro, 3.4);
    api.sfx("roar");
    api.shake(0.3);
    yield* wait(2.6);
    let bag = [], last = "";
    for (;;) {
      if (B.nextPhase > B.phase) yield* rage();
      if (!bag.length) {
        bag = [...ORDER].sort(() => Math.random() - 0.5);
        if (bag[0] === last) bag.push(bag.shift());
      }
      last = B.only || bag.shift();
      yield* ATTACKS[last]();
      B.cast = null;
      $("bossCast").hidden = true;
    }
  }
  function* lost() {
    // the last blow knocks his crown off and he drops out of the air
    B.armor = true;
    B.cast = null;
    $("bossCast").hidden = true;
    setPose("down");
    goTo({ x: B.x, z: B.z }, 0);
    B.hRate = 10;
    const cw = new THREE.Vector3();
    U.crown.getWorldPosition(cw);
    Object.assign(crown, { on: true, rest: false, x: cw.x, y: cw.y, z: cw.z, vx: (Math.random() - 0.5) * 4, vy: 8, vz: (Math.random() - 0.5) * 4, spin: 0 });
    U.crown.visible = false;
    say(STR.ice.defeat, 4);
    api.sfx("roar");
    api.freeze(0.15);
    api.shake(0.6);
    api.burst(B.x, B.y + 2, B.z, 36, [0xffffff, 0xbfeaff, 0xf6c343], 9, 8, 1, 1);
    yield* wait(2.8);
    B.wins++;
    shutGate(false);
    const first = B.wins === 1;
    api.onWin(first);
    if (first) { reward.on = true; reward.t = 0; }
    B.st = "rest";
    setPose("rest");
    goTo(waitSpot(), 0.4);
    setTimeout(() => { if (B.st !== "fight") hud(false); }, 2500);
  }

  // ── starting, stopping ──
  function begin() {
    B.st = "fight";
    B.hp = K.hp;
    B.dropAcc = 0;
    B.phase = B.nextPhase = 0;
    B.armor = false;
    hpShown = -1;
    hud(true);
    shutGate(true);
    api.sfx("gate");
    B.script = fight();
    B.script.next();
    api.onStart();
  }
  function park(st) {
    B.st = st;
    B.script = null;
    B.cast = null;
    B.faceLock = null;
    B.armor = false;
    B.nearSaid = false;
    cancelHazards();
    clearSpikes();
    const w = waitSpot();
    B.x = B.px = B.goal.x = w.x;
    B.z = B.pz = B.goal.z = w.z;
    B.h = B.goal.h = st === "rest" ? 0.4 : K.hover;
    B.y = B.py = C.y + B.h;
    B.face = B.pface = C.gate[0];
    setPose(st === "rest" ? "rest" : "idle");
    if (st === "wait") { U.crown.visible = true; crown.on = false; flyCrown.visible = false; }
  }

  // ── physics step ──
  function step(dt) {
    if (B.st === "off") return;
    B.px = B.x; B.py = B.y; B.pz = B.z; B.pface = B.face;
    B.poseT += dt;
    B.flash -= dt;
    B.hurtT -= dt;
    B.saidT += dt;
    if (B.cast) B.cast.t += dt;
    if (B.st === "wait") {
      const near = Math.hypot(pl.x - C.landing.x, pl.z - C.landing.z) < 9 || inArena();
      if (near && !B.nearSaid && api.player.dead <= 0) { B.nearSaid = true; say(STR.ice.near, 3); }
      if (Math.hypot(pl.x - C.x, pl.z - C.z) < C.r - 0.8 && inArena() && api.player.dead <= 0) begin();
    }
    if (B.script && B.script.next(dt).done) B.script = null;
    // glide toward the goal, easing in; hover height follows on its own
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
    B.y = C.y + B.h;
    const want = B.faceLock ?? (B.st === "wait" && !inArena() ? C.gate[0] : Math.atan2(pl.x - B.x, pl.z - B.z));
    B.face = turnToward(B.face, want, (B.faceLock !== null ? 14 : 5) * dt);
    B.dead = !hittable();
    HZ.step(dt);
    stepSpikes(dt);
    // Finn can't walk through him, nor through the lightning's ice pillars
    const px = pl.x - B.x, pz = pl.z - B.z, pd = Math.hypot(px, pz), R = K.body + 0.42;
    if (pd < R && pl.y < B.y + 2.6 && pl.y + 1.6 > B.y) {
      const [ux, uz] = away(B.x, B.z);
      pl.x = B.x + ux * R;
      pl.z = B.z + uz * R;
    }
    for (const s of spikes) {
      if (!s.on || !s.solid || s.k < 0.5 || pl.y > C.y + s.h) continue;
      const sr = s.r + 0.42;
      if (Math.hypot(pl.x - s.x, pl.z - s.z) < sr) { const [ux, uz] = away(s.x, s.z); pl.x = s.x + ux * sr; pl.z = s.z + uz * sr; }
    }
    // a fight can't go on without Finn in the arena (a debug teleport)
    if (B.st === "fight" && !inArena() && api.player.dead <= 0) { park("wait"); shutGate(false); hud(false); }
    // the Ice Heart
    if (reward.on) {
      reward.t += dt;
      if (reward.t > 0.8 && Math.hypot(pl.x - C.x, pl.z - C.z) < 1.5 && pl.y < C.y + 3.5 && api.player.dead <= 0) {
        reward.on = false;
        api.burst(C.x, C.y + 1.6, C.z, 30, [0x8fe3ff, 0xffffff, 0xff4d6d], 6, 6, 0.5, 1);
        api.onReward();
      }
    }
  }

  // ── what the sword, Jake and main.js ask of him ──
  function hurt(n, nx, nz) {
    if (!hittable()) return false;
    B.hp = Math.max(0, B.hp - n);
    B.flash = 0.1;
    B.hurtT = 0.25;
    B.hitN++;
    B.kx += nx * (n > 1 ? 3 : 1.4);
    B.kz += nz * (n > 1 ? 3 : 1.4);
    api.sfx(n > 1 ? "hitBig" : "hit");
    if (++B.voice % 3 === 0 || n > 1) api.sfx("bossHurt");
    if (B.saidT > 5 && Math.random() < 0.3) { B.saidT = 0; say(pick(STR.ice.hurt), 1.6); }
    api.burst(B.x, B.y + 1.6, B.z, 5 + 3 * n, [0xffffff, 0xbfeaff, 0x1d3fd8], 4, 4);
    // Finn doesn't heal on his own in the fight: every so many blows a heart falls out of the King
    B.dropAcc += n;
    if (B.dropAcc >= K.heartEvery && B.hp > 0) {
      B.dropAcc -= K.heartEvery;
      const q = clampIn(B.x + (C.x - B.x) * 0.35, B.z + (C.z - B.z) * 0.35, 11);
      api.dropHeart(q.x, B.y + 1.8, q.z);
      api.sfx("ready");
      if (B.saidT > 2) { B.saidT = 0; say(pick(STR.ice.dropped), 1.8); }
    }
    const f = B.hp / K.hp;
    if (B.nextPhase < 1 && f <= K.phase2) B.nextPhase = 1;
    if (B.nextPhase < 2 && f <= K.phase3) B.nextPhase = 2;
    if (B.hp <= 0) {
      cancelHazards();
      clearSpikes();
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
    if (d > sw.range + K.body || pl.y + 2.3 < B.y || pl.y > B.y + 2.9) return false;
    if (Math.abs(wrap(Math.atan2(dx, dz) - heading)) > sw.arc && d > 1.6) return false;
    const nx = dx / (d || 1), nz = dz / (d || 1);
    api.fx.star(B.x - nx * 0.8, clamp(pl.y + 1.1, B.y + 0.4, B.y + 2.4), B.z - nz * 0.8, sw.heavy ? 1.35 : 0.95, sw.spark);
    hurt(sw.dmg, nx, nz);
    return true;
  }

  // ── every rendered frame ──
  const _v = new THREE.Vector3();
  let blink = 2;
  const lerp = (a, b, k) => a + (b - a) * k;
  const ARMS = {
    idle: (s, t) => [0.15 + 0.08 * Math.sin(t * 2.2), 0, s * 0.45, -0.35],
    fly: (s) => [0.75, 0, s * 0.55, -0.15],
    intro: (s, t) => [-2.6, 0, s * 0.6, -0.5 + 0.25 * Math.sin(t * 10)],
    bolt: (s, t) => [-2.95, 0, s * 0.3, -0.2 + 0.18 * Math.sin(t * 14 + s)],
    breath: (s) => [-1.7, 0, -s * 0.2, -1.9],
    breathGo: (s) => [-0.6, 0, s * 0.9, -0.3],
    nova: (s, t) => [-1.3, 0, -s * 0.85, -1.8 + 0.05 * Math.sin(t * 30)],
    novaGo: (s) => [-0.4, 0, s * 1.7, -0.1],
    donut: (s) => [-0.6, 0, s * 2.1, -0.3],
    rise: (s) => [-3.0, 0, s * 0.2, 0],
    dive: (s) => [-2.9, 0, s * 0.15, 0],
    dazed: (s, t) => [-0.35, 0, s * (1.2 + 0.1 * Math.sin(t * 3)), -0.2],
    rage: (s, t) => [-2.4, 0, s * 0.9, -1.0 + 0.45 * Math.sin(t * 22 + s)],
    down: (s) => [-0.2, 0, s * 1.3, -0.2],
    rest: (s) => [-1.25, 0, -s * 0.8, -1.75],
  };
  const LEAN = { fly: 0.3, rise: -0.25, dive: 1.1, dazed: -0.3, down: -0.4, breath: -0.12, breathGo: 0.28, novaGo: -0.1, rage: -0.15 };
  const CHARGE = { bolt: 1, breath: 1, nova: 1, donut: 1, intro: 0.5, rage: 0.8 };
  function pose(dt, t) {
    const k = 1 - Math.exp(-14 * dt), p = B.pose, fn = ARMS[p] || ARMS.idle;
    const hk = Math.max(0, B.hurtT / 0.25); // flinching from a blow
    U.arms.forEach((A, i) => {
      const s = i ? 1 : -1, [x, y, z, e] = fn(s, t);
      A.sh.rotation.set(lerp(A.sh.rotation.x, x - 0.5 * hk, k), lerp(A.sh.rotation.y, y, k), lerp(A.sh.rotation.z, z + s * 0.8 * hk, k));
      A.el.rotation.x = lerp(A.el.rotation.x, e, k);
    });
    // leaning, the head, the beard beating like wings
    const lean = LEAN[p] ?? (Math.hypot(B.vx, B.vz) > 3 ? 0.22 : 0);
    model.rotation.x = lerp(model.rotation.x, lean, 1 - Math.exp(-8 * dt));
    const dizzy = p === "dazed" || p === "down";
    U.head.rotation.set(
      (p === "breath" ? -0.25 : p === "breathGo" ? 0.3 : p === "rest" ? 0.15 : 0.04 * Math.sin(t * 0.8)) - 0.45 * hk,
      dizzy ? 0.25 * Math.sin(t * 3.5) : p === "rest" ? 0.5 : 0.1 * Math.sin(t * 0.5),
      (dizzy ? 0.2 * Math.cos(t * 3.5) : 0) + (p === "rage" ? 0.08 * Math.sin(t * 40) : 0),
    );
    const flying = B.h > 0.25 && !dizzy && p !== "rest";
    const fast = p === "fly" || p === "rise" || p === "dive" || p === "rage";
    const flap = flying ? (fast ? 0.42 : 0.16) * (0.5 + 0.5 * Math.sin(t * (fast ? 17 : 7))) : 0;
    U.beard.rotation.x = lerp(U.beard.rotation.x, -0.05 - flap, 1 - Math.exp(-30 * dt));
    U.beard.scale.x = 1 + (flying ? 0.1 * Math.sin(t * (fast ? 17 : 7) + 1) : 0);
    U.body.scale.y = 1 + 0.015 * Math.sin(t * 2.1) + (p === "nova" ? -0.05 : dizzy ? -0.12 : 0);
    dizzyStars.visible = dizzy;
    if (dizzy) dizzyStars.children.forEach((s, i) => { const a = t * 4.5 + (i * TAU) / 3; s.position.set(Math.sin(a) * 0.26, 0.04 * Math.sin(t * 9 + i), Math.cos(a) * 0.26); });
    blink -= dt;
    if (blink < -0.12) blink = 2 + Math.random() * 3;
    U.eyes.scale.y = dizzy ? 0.35 : blink < 0 ? 0.12 : p === "rage" ? 1.25 : 1;
    // spell light in his hands
    const ch = (CHARGE[p] || 0) * Math.min(1, B.poseT / 0.4);
    for (const g of glows) g.scale.setScalar(0.001 + ch * (0.11 + 0.03 * Math.sin(t * 25)));
    // hit flash; a cold glow when he's angry
    for (let i = 0; i < mats.length; i++) {
      if (B.flash > 0) mats[i].emissive.setRGB(1, 1, 1);
      else mats[i].emissive.copy(baseEm[i]).addScalar(B.phase * 0.035);
    }
  }
  function update(dt, alpha, t, camera) {
    const show = B.st !== "off" && camera.position.distanceTo(_v.set(C.x, C.y, C.z)) < 220;
    model.visible = shadow.visible = show;
    if (show) {
      const bob = B.h > 0.25 && B.pose !== "rest" ? Math.sin(t * 2.3) * 0.14 : 0;
      model.position.set(lerp(B.px, B.x, alpha), lerp(B.py, B.y, alpha) + bob, lerp(B.pz, B.z, alpha));
      if (B.pose === "donut") B.spin += dt * 9 * Math.min(1, B.poseT);
      else B.spin = wrap(B.spin) * Math.exp(-8 * dt);
      model.rotation.y = B.pface + wrap(B.face - B.pface) * alpha + B.spin;
      pose(dt, t);
      shadow.position.set(model.position.x, C.y + 0.07, model.position.z);
      shadow.scale.setScalar(0.95 * clamp(1 - B.h / 12, 0.4, 1));
      bubble.visible = B.armor && B.st === "fight";
      if (bubble.visible) {
        bubble.position.set(model.position.x, model.position.y + 1.4, model.position.z);
        bubble.scale.setScalar(2.1 + 0.08 * Math.sin(t * 6));
      }
    } else bubble.visible = false;
    HZ.draw(t);
    // spikes
    let any = false;
    for (let i = 0; i < SP; i++) {
      const s = spikes[i];
      if (!s.on || s.t < 0) {
        if (s.shown) { spikeMesh.setMatrixAt(i, _m4.makeScale(0, 0, 0)); s.shown = false; }
        continue;
      }
      any = true;
      s.shown = true;
      _e.set(s.rx, s.ry, s.rz);
      _q.setFromEuler(_e);
      _p.set(s.x, C.y - 0.2, s.z);
      _s.set(s.r, Math.max(0.001, (s.h + 0.2) * s.k), s.r);
      spikeMesh.setMatrixAt(i, _m4.compose(_p, _q, _s));
    }
    spikeMesh.visible = any;
    if (any) spikeMesh.instanceMatrix.needsUpdate = true;
    // bolts flicker out
    for (const b of bolts) {
      b.t += dt;
      b.m.visible = b.t < 0.22;
      if (b.m.visible) b.m.material.opacity = (b.t < 0.06 ? 1 : 0.35 + 0.65 * Math.random()) * (1 - b.t / 0.22);
    }
    // the breath: a white cone of frost, snow blowing along it
    breath.t += dt;
    breathMesh.visible = breath.t < 0.55;
    if (breathMesh.visible) {
      const u = breath.t / 0.55, len = K.breath.r * Math.min(1, breath.t / 0.14), w = len * Math.tan(K.breath.half);
      breathMesh.position.set(breath.x, breath.y, breath.z);
      breathMesh.rotation.set(0, breath.a, 0);
      breathMesh.scale.set(w, w * 0.35, len);
      breathMesh.material.opacity = 0.55 * (1 - u);
      if (Math.random() < 0.8) {
        const a = breath.a + (Math.random() - 0.5) * 2 * K.breath.half, r = Math.random() * len;
        api.burst(breath.x + Math.sin(a) * r, C.y + 0.4 + Math.random() * 1.2, breath.z + Math.cos(a) * r, 3, [0xffffff, 0xdff5ff], 2, 1.5, 0.2, 0.6);
      }
    }
    // the gate rises or sinks
    gateK += ((gateShut ? 1 : 0) - gateK) * (1 - Math.exp(-5 * dt));
    gate.visible = gateK > 0.02;
    gate.scale.y = 4.6 * gateK;
    // the knocked-off crown tumbles and lands; he gets it back for a rematch
    flyCrown.visible = crown.on;
    if (crown.on && !crown.rest) {
      crown.vy -= 25 * dt;
      crown.x += crown.vx * dt; crown.y += crown.vy * dt; crown.z += crown.vz * dt;
      crown.spin += dt * 9;
      const q = clampIn(crown.x, crown.z, 13.5);
      crown.x = q.x;
      crown.z = q.z;
      if (crown.y < C.y + 0.05 && crown.vy < 0) {
        crown.y = C.y + 0.05;
        if (crown.vy < -3) { crown.vy *= -0.35; crown.vx *= 0.6; crown.vz *= 0.6; } else crown.rest = true;
      }
    }
    if (crown.on) {
      flyCrown.position.set(crown.x, crown.y, crown.z);
      flyCrown.rotation.set(crown.rest ? 0.25 : crown.spin * 0.7, crown.spin, crown.rest ? 0 : crown.spin * 0.4);
      flyCrown.scale.setScalar(K.scale);
    }
    // the Ice Heart bobs in the middle, the Ice Crystal circling it
    prize.visible = gem.visible = reward.on;
    if (reward.on) {
      prize.position.set(C.x, C.y + 1.6 + Math.sin(t * 2.5) * 0.2, C.z);
      orbitCrystal(gem, C.x, C.y + 1.6, C.z, t);
      prize.rotation.y = t * 2;
      if (Math.random() < dt * 6) api.burst(C.x, C.y + 1.6, C.z, 2, [0xffffff, 0x8fe3ff], 2, 2, 0.1, 0.8);
    }
    // cast bar
    if (B.cast) $("bossCastFill").style.width = clamp(B.cast.t / B.cast.dur, 0, 1) * 100 + "%";
    if (B.st === "fight" || B.st === "down") hudHp();
  }

  placeGate();
  return {
    B, K, hazards,
    /** The boss as a target for the sword's aim, Jake's punches and the giant fist (null: not now). */
    foe: () => (hittable() ? B : null),
    fighting: () => B.st === "fight" || B.st === "down",
    /** Is (a point) on the Ice Crown? (Jake climbs up there too; the camera stays inside.) */
    holds: (p) => inArena(p),
    /** He's talkable after losing: { x, y, z } or null. */
    talker: () => (B.st === "rest" ? B : null),
    swordHit,
    step,
    update,
    /** The quest sends him up to the crown (quest.js). */
    arm: () => park("wait"),
    rest: () => { park("rest"); U.crown.visible = false; Object.assign(crown, { on: true, rest: true, x: C.x + 2, y: C.y + 0.05, z: C.z - 1, spin: 0.6 }); B.wins = Math.max(B.wins, 1); },
    /** Talked into a rematch: he puts his crown back on and it starts. */
    rematch: () => { park("wait"); begin(); },
    /** Finn fainted: he gloats, then waits for him again. */
    finnDown: () => {
      if (B.st !== "fight") return;
      say(STR.ice.finnDown, 3);
      park("gloat");
      setPose("rage");
      shutGate(false);
      setTimeout(() => { if (B.st !== "fight") hud(false); }, 1200);
    },
    afterFaint: () => { if (B.st === "gloat") park("wait"); },
    /** New game: he's back in his hall (quest.js), nothing up here. */
    off: () => {
      park("wait");
      B.st = "off";
      B.dead = true;
      reward.on = false;
      shutGate(false);
      hud(false);
    },
    say,
  };
}
