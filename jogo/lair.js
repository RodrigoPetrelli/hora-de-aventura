// The Dark Lair: the Peppermint Butler's pocket of the dark arts, where he fights Finn (butler.js).
// A round stone floor floats high over Ooo in a purple void, out of reach of anyone who walks: he
// teleports Finn and Jake up here. On the floor, a glowing ritual circle (a seven-pointed star, runes
// and a peppermint swirl in the middle); round the rim, a parapet with tall black candles burning
// green and chunks of amber (like the amber prison of the Lich, the lair he uses in "The Suitor").
// Round it: floating rocks, a huge amber shard, wandering spirits, a big moon, stars, and the
// abyss swirling far below. It has its own Builder: its meshes are drawn only near it (and from up
// here W.sealed hides the world below).
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Builder, GEO, mtx } from "./builder.js";
import { toon, noOutline } from "./toon.js";
import { ringCollider } from "./physics.js";
import { P, rng, smooth } from "./terrain.js";

const TAU = Math.PI * 2;

/**
 * y: the floor; r: how far from the middle bosses, markers and summons stay; wall: the invisible
 * ring round the walkable floor; spawnA / portalA: where Finn lands and where the way out opens
 * (angles round the middle, 0 = +z). fx: materials the fight tints as it goes (butler.js).
 */
export const LAIR = { x: P.lair.x, z: P.lair.z, y: 400, r: 13.4, wall: 15.4, spawnA: Math.PI, portalA: 0, fx: null };

// colours by mood: ritual circle, candle flames, their cores, the abyss tint
const MOOD = [
  [0xa070ff, 0x7dff6a, 0xeaffc8, 0xffffff],
  [0xd35cff, 0x4dffc4, 0xe0fff4, 0xffd0ff],
  [0xff2a44, 0xff5a24, 0xffe2a0, 0xff9090],
];

/** How far inside the Dark Lair a point is (0..1): tints sky, fog and light (main.js). */
export function lairAt(p) {
  return smooth(LAIR.y - 70, LAIR.y - 40, p.y) * (1 - smooth(70, 100, Math.hypot(p.x - LAIR.x, p.z - LAIR.z)));
}

export function buildLair(W) {
  const X = LAIR.x, Z = LAIR.z, Y = LAIR.y, r = rng(6606);
  const grp = new THREE.Group();
  W.scene.add(grp);
  const B = new Builder(grp);
  const M = {
    floor: toon(0x4b3e5e, { tex: "stone", scale: 0.32 }),
    inlay: toon(0x2f2640, { tex: "tiles", scale: 0.3, outline: false }),
    rock: toon(0x33283f, { tex: "rock", scale: 0.1, flat: true }),
    rim: toon(0x5f4c74, { tex: "stone", scale: 0.55 }),
    wax: toon(0x28212f),
    wick: toon(0x111014),
    amber: toon(0xffa53a, { emissive: 0x7a3200, flat: true }),
    amberD: toon(0xd86a12, { emissive: 0x4a1800, flat: true }),
  };
  const at = (a, d) => [X + Math.sin(a) * d, Z + Math.cos(a) * d];

  // ── the floor: a thick stone disc (its collider is the floor), a dark inlaid ring, the rock underneath ──
  B.cyl(X, Y - 2.2, Z, 18, 2.2, M.floor, { seg: 44 });
  B.raw(GEO.circle(48), M.inlay, mtx(X, Y + 0.02, Z, 0, 14.9, 14.9, 1, -Math.PI / 2));
  B.cyl(X, Y - 17, Z, 2.6, 14.9, M.rock, { rTop: 17.8, seg: 13, solid: false });
  for (let k = 0; k < 14; k++) {
    const a = r() * TAU, d = 3 + r() * 12, [x, z] = at(a, d), h = 3 + r() * 6 * (1 - d / 17);
    B.cone(x, Y - 2.2 - h - (17 - d) * 0.75 + 1, z, 0.9 + r() * 1.3, h, M.rock, { rx: Math.PI, seg: 5 });
  }
  // ── the rim: a parapet, and a wall no jump clears (not for the camera: main.js keeps it inside) ──
  B.lathe([[16.5, -0.2], [16.5, 0.85], [16.2, 1.15], [15.3, 1.15], [15.0, 0.85], [15.0, 0.02]], M.rim, X, Y, Z, { seg: 56 });
  ringCollider(X, Z, LAIR.wall, 1.2, Y - 0.5, Y + 7, [], false);

  // ── tall black candles on the parapet, green flames (one mesh per colour; they flicker in brightness) ──
  const flameGeo = [], coreGeo = [];
  const flame = (x, y, z, s) => {
    flameGeo.push(new THREE.ConeGeometry(0.28 * s, 0.95 * s, 7).translate(x, y + 0.45 * s, z));
    coreGeo.push(new THREE.ConeGeometry(0.14 * s, 0.5 * s, 6).translate(x, y + 0.24 * s, z));
  };
  const candle = (x, y, z, rad, h) => {
    B.cyl(x, y, z, rad, h, M.wax, { seg: 10, solid: false });
    for (let i = 0; i < 5; i++) {
      const a = r() * TAU, len = 0.3 + r() * 0.9;
      B.capsule([x + Math.sin(a) * rad * 0.95, y + h - 0.05, z + Math.cos(a) * rad * 0.95], [x + Math.sin(a) * rad * 1.02, y + h - len, z + Math.cos(a) * rad * 1.02], 0.09 * rad * 2, M.wax, 5);
    }
    B.cyl(x, y + h, z, 0.04, 0.18, M.wick, { seg: 4, solid: false });
    flame(x, y + h + 0.1, z, rad * 1.9);
  };
  for (let k = 0; k < 12; k++) {
    const a = ((k + 0.5) / 12) * TAU, [x, z] = at(a, 15.75), h = 1.6 + (k % 3) * 0.8 + r() * 0.4;
    candle(x, Y + 1.12, z, 0.42 + (k % 2) * 0.1, h);
    if (k % 2) { const [x2, z2] = at(a + 0.07, 15.95); candle(x2, Y + 1.12, z2, 0.22, 0.7 + r() * 0.5); }
  }
  // ── amber: clusters of glowing shards on the outer ledge, between the candles ──
  const shard = (x, y, z, h, w, tilt, ry, m) => B.raw(new THREE.OctahedronGeometry(1, 0), m, mtx(x, y + h * 0.5, z, ry, w, h, w * 0.8, tilt, 0));
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU, [x, z] = at(a, 17.2);
    shard(x, Y - 0.6, z, 2.4 + r() * 1.6, 0.55, 0.25, a, M.amber);
    const [x2, z2] = at(a + 0.08, 17.5);
    shard(x2, Y - 0.6, z2, 1.3 + r(), 0.35, 0.5, a + 0.8, M.amberD);
  }

  // ── the ritual circle on the floor: its own glowing, turning disc (tinted by the fight) ──
  const circleMat = noOutline(new THREE.MeshBasicMaterial({ map: ritualTex(), color: 0xa070ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  const circle = new THREE.Mesh(new THREE.CircleGeometry(13.9, 64).rotateX(-Math.PI / 2), circleMat);
  circle.position.set(X, Y + 0.05, Z);
  circle.renderOrder = 1;
  grp.add(circle);

  // ── out in the void: floating rocks (some with candles), a huge amber shard, the moon, stars, the abyss ──
  for (let k = 0; k < 11; k++) {
    const a = (k / 11) * TAU + r() * 0.4, d = 25 + r() * 17, [x, z] = at(a, d), y = Y - 7 + r() * 16, s = 1.2 + r() * 2.4;
    B.sphere(x, y, z, s, M.rock, { sx: 1.3, sy: 0.55, sz: 1.1, seg: 7, ry: r() * 3 });
    B.cone(x, y - s * 0.4 - s, z, s * 0.9, s * 1.6, M.rock, { rx: Math.PI, seg: 5 });
    if (k % 3 === 0) candle(x + 0.3, y + s * 0.45, z, 0.3, 0.9 + r() * 0.6);
    if (k % 3 === 1) shard(x, y + s * 0.3, z, 1.6 + r(), 0.4, 0.3, a, M.amber);
  }
  {
    const [x, z] = at(Math.PI / 2 + 0.4, 52);
    for (let i = 0; i < 5; i++) shard(x + (r() - 0.5) * 5, Y - 4 + r() * 3, z + (r() - 0.5) * 5, 7 + r() * 8, 1.6 + r(), (r() - 0.5) * 0.7, r() * 3, i ? M.amberD : M.amber);
    B.sphere(x, Y - 5, z, 5, M.rock, { sx: 1.4, sy: 0.5, seg: 8 });
  }
  const flames = new THREE.Group();
  const flameMat = noOutline(new THREE.MeshBasicMaterial({ color: 0x7dff6a, fog: false }));
  const coreMat = noOutline(new THREE.MeshBasicMaterial({ color: 0xeaffc8, fog: false }));
  flames.add(new THREE.Mesh(mergeGeometries(flameGeo), flameMat), new THREE.Mesh(mergeGeometries(coreGeo), coreMat));
  grp.add(flames);

  const moon = new THREE.Sprite(noOutline(new THREE.SpriteMaterial({ map: moonTexture(), fog: false, depthWrite: false })));
  moon.position.set(X - 60, Y + 75, Z - 190);
  moon.scale.setScalar(95);
  moon.renderOrder = -5;
  grp.add(moon);
  {
    const n = 700, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = r() * TAU, v = r() * 1.4 - 0.45, d = 190 + r() * 80;
      pos.set([X + Math.cos(u) * Math.cos(v) * d, Y + Math.sin(v) * d, Z + Math.sin(u) * Math.cos(v) * d], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(geo, noOutline(new THREE.PointsMaterial({ color: 0xe8d8ff, size: 2.4, transparent: true, opacity: 0.8, depthWrite: false, fog: false })));
    stars.frustumCulled = false;
    grp.add(stars);
  }
  const abyssMat = noOutline(new THREE.MeshBasicMaterial({ map: abyssTexture(), transparent: true, depthWrite: false, fog: false }));
  const abyss = new THREE.Mesh(new THREE.CircleGeometry(150, 48).rotateX(-Math.PI / 2), abyssMat);
  abyss.position.set(X, Y - 75, Z);
  abyss.renderOrder = -4;
  grp.add(abyss);
  // lost spirits drifting round and round
  const wisps = new THREE.Group(), wispMat = noOutline(new THREE.MeshBasicMaterial({ color: 0xc8b8ff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  const wispGeo = new THREE.SphereGeometry(0.45, 8, 6).scale(1, 1, 2.6);
  for (let k = 0; k < 7; k++) {
    const m = new THREE.Mesh(wispGeo, wispMat);
    m.userData = { a: (k / 7) * TAU, d: 22 + (k % 3) * 7, y: 3 + (k % 4) * 2.5, s: 0.18 + (k % 3) * 0.06 };
    wisps.add(m);
  }
  wisps.position.set(X, Y, Z);
  grp.add(wisps);
  // embers of dark magic rising out of the abyss all round the floor, and drifting up over it
  const MN = 170, mPos = new Float32Array(MN * 3), mCol = new Float32Array(MN * 3), mote = [];
  for (let i = 0; i < MN; i++) {
    const a = r() * TAU, d = i < 50 ? 2 + r() * 13 : 17 + r() * 26;
    mote.push({ x: Math.sin(a) * d, z: Math.cos(a) * d, y: -25 + r() * 50, v: 0.6 + r() * 1.4, ph: r() * TAU, c: new THREE.Color(r() < 0.35 ? 0x7dff9a : r() < 0.5 ? 0xff8a3a : 0xb58aff) });
  }
  const mGeo = new THREE.BufferGeometry();
  mGeo.setAttribute("position", new THREE.BufferAttribute(mPos, 3).setUsage(THREE.DynamicDrawUsage));
  mGeo.setAttribute("color", new THREE.BufferAttribute(mCol, 3).setUsage(THREE.DynamicDrawUsage));
  const motes = new THREE.Points(mGeo, noOutline(new THREE.PointsMaterial({ size: 0.55, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
  motes.position.set(X, Y, Z);
  motes.frustumCulled = false;
  grp.add(motes);

  B.build();
  // from inside, nothing of the world below is drawn (it is lost in the dark fog anyway)
  W.sealed(X, Z, 80, Y - 90, Y + 90, 0);
  // the fight sets LAIR.fx.mood (0 calm, 1 angry, 2 furious): the circle, the flames and the abyss
  // shift toward its colours; `flash` (0..1) makes the circle blaze for a moment, `sky` (0..1) lights
  // the sky up (a lightning flash: main.js)
  const cur = MOOD[0].map((c) => new THREE.Color(c)), _c = new THREE.Color();
  LAIR.fx = { mood: 0, flash: 0, sky: 0 };
  let last = 0;
  W.tick((t, cam) => {
    grp.visible = !!cam && cam.y > Y - 120 && Math.hypot(cam.x - X, cam.z - Z) < 200;
    const dt = Math.min(0.1, Math.max(0, t - last));
    last = t;
    if (!grp.visible) return;
    const fx = LAIR.fx, k = 1 - Math.exp(-2 * dt);
    MOOD[fx.mood].forEach((c, i) => cur[i].lerp(_c.setHex(c), k));
    fx.flash = Math.max(0, fx.flash - dt * 2.5);
    fx.sky = Math.max(0, fx.sky - dt * 4);
    const flick = 0.85 + 0.1 * Math.sin(t * 9.1) + 0.05 * Math.sin(t * 23.7);
    circle.rotation.y = t * (0.06 + 0.1 * fx.mood);
    circleMat.color.copy(cur[0]).multiplyScalar(0.75 + 0.25 * Math.sin(t * (1.7 + fx.mood)) + fx.flash * 1.5);
    flameMat.color.copy(cur[1]).multiplyScalar(flick);
    coreMat.color.copy(cur[2]).multiplyScalar(flick);
    abyssMat.color.copy(cur[3]);
    abyss.rotation.y = -t * (0.12 + 0.1 * fx.mood);
    for (const m of wisps.children) {
      const u = m.userData, a = u.a + t * u.s;
      m.position.set(Math.sin(a) * u.d, u.y + Math.sin(t * 1.3 + u.a * 3) * 1.2, Math.cos(a) * u.d);
      m.rotation.y = a + Math.PI / 2;
    }
    // the embers rise, sway, fade in and out, and start over at the bottom (faster when he's angry)
    const up = 1 + 0.6 * fx.mood;
    for (let i = 0; i < MN; i++) {
      const m = mote[i];
      m.y += m.v * up * dt;
      if (m.y > 25) m.y -= 50;
      const f = Math.sin(((m.y + 25) / 50) * Math.PI) * (0.6 + 0.4 * Math.sin(t * 3 + m.ph));
      mPos.set([m.x + Math.sin(t * 0.8 + m.ph) * 0.6, m.y, m.z + Math.cos(t * 0.7 + m.ph) * 0.6], i * 3);
      mCol.set([m.c.r * f, m.c.g * f, m.c.b * f], i * 3);
    }
    mGeo.attributes.position.needsUpdate = true;
    mGeo.attributes.color.needsUpdate = true;
  });
}

let _ritual = null, _glow = null;
/** The ritual circle's texture (shared: the Butler draws small ones under himself while he casts). */
export const ritualTex = () => (_ritual ||= ritualTexture());
/** A soft round glow for additive points (the lair's embers, the fight's sparkles). */
export function glowTexture() {
  if (_glow) return _glow;
  const s = 64, c = document.createElement("canvas");
  c.width = c.height = s;
  const x = c.getContext("2d"), g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, s, s);
  _glow = new THREE.CanvasTexture(c);
  return _glow;
}

/** The ritual circle: rings, runes (shapes, not letters), a seven-pointed star and a peppermint swirl. */
function ritualTexture() {
  const s = 1024, c = document.createElement("canvas");
  c.width = c.height = s;
  const x = c.getContext("2d"), R = s / 2 - 10, rr = rng(4242);
  x.translate(s / 2, s / 2);
  x.strokeStyle = x.fillStyle = "#ffffff";
  x.lineCap = x.lineJoin = "round";
  x.shadowColor = "#ffffff";
  x.shadowBlur = 16;
  const ringAt = (f, w) => { x.lineWidth = w; x.beginPath(); x.arc(0, 0, R * f, 0, TAU); x.stroke(); };
  ringAt(0.985, 8);
  ringAt(0.895, 4);
  ringAt(0.6, 6);
  ringAt(0.545, 3);
  ringAt(0.21, 5);
  // runes: little stroke glyphs between the two outer rings
  for (let i = 0; i < 30; i++) {
    x.save();
    x.rotate((i / 30) * TAU);
    x.translate(0, -R * 0.94);
    x.lineWidth = 4;
    x.beginPath();
    const n = 2 + Math.floor(rr() * 3);
    for (let k = 0; k < n; k++) {
      const x0 = (rr() - 0.5) * 22, y0 = (rr() - 0.5) * 22;
      if (rr() < 0.3) { x.moveTo(x0 + 5, y0); x.arc(x0, y0, 5, 0, TAU); }
      else { x.moveTo(x0, y0); x.lineTo(x0 + (rr() - 0.5) * 26, y0 + (rr() - 0.5) * 26); }
    }
    x.stroke();
    x.restore();
  }
  // the star {7/3}, with a little circle at each point
  x.lineWidth = 6;
  x.beginPath();
  for (let i = 0; i <= 7; i++) {
    const a = ((i * 3) / 7) * TAU, px = Math.sin(a) * R * 0.895, py = -Math.cos(a) * R * 0.895;
    i ? x.lineTo(px, py) : x.moveTo(px, py);
  }
  x.stroke();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    x.lineWidth = 4;
    x.beginPath();
    x.arc(Math.sin(a) * R * 0.75, -Math.cos(a) * R * 0.75, R * 0.055, 0, TAU);
    x.stroke();
  }
  // the peppermint swirl in the middle
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU, pt = (f, da) => [Math.cos(a + da) * R * f, Math.sin(a + da) * R * f];
    x.beginPath();
    x.moveTo(...pt(0.03, 0));
    x.quadraticCurveTo(...pt(0.12, 0.35), ...pt(0.19, 0.85));
    x.quadraticCurveTo(...pt(0.1, 0.55), ...pt(0.03, 0));
    x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function moonTexture() {
  const s = 256, c = document.createElement("canvas");
  c.width = c.height = s;
  const x = c.getContext("2d"), h = s / 2, rr = rng(99);
  const halo = x.createRadialGradient(h, h, h * 0.35, h, h, h);
  halo.addColorStop(0, "rgba(240,220,255,0.55)");
  halo.addColorStop(1, "rgba(160,110,220,0)");
  x.fillStyle = halo;
  x.fillRect(0, 0, s, s);
  x.fillStyle = "#f4ecd8";
  x.beginPath();
  x.arc(h, h, h * 0.42, 0, TAU);
  x.fill();
  x.fillStyle = "rgba(170,150,190,0.45)";
  for (let i = 0; i < 9; i++) {
    const a = rr() * TAU, d = rr() * h * 0.3;
    x.beginPath();
    x.arc(h + Math.cos(a) * d, h + Math.sin(a) * d, 4 + rr() * 12, 0, TAU);
    x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/** The abyss far below: violet and blood-red arms turning into a black middle, fading at the rim. */
function abyssTexture() {
  const s = 256, c = document.createElement("canvas");
  c.width = c.height = s;
  const x = c.getContext("2d"), g = x.createRadialGradient(s / 2, s / 2, 4, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(4,0,8,1)");
  g.addColorStop(0.6, "rgba(30,6,50,0.95)");
  g.addColorStop(1, "rgba(40,10,60,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, s, s);
  x.lineCap = "round";
  for (let arm = 0; arm < 6; arm++) {
    x.strokeStyle = arm % 2 ? "rgba(200,40,90,0.45)" : "rgba(150,100,255,0.5)";
    x.lineWidth = 8;
    x.beginPath();
    for (let i = 0; i <= 60; i++) {
      const t = i / 60, a = arm * (TAU / 6) + t * 6, rad = t * s * 0.47;
      const px = s / 2 + Math.cos(a) * rad, py = s / 2 + Math.sin(a) * rad;
      i ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
