// The Caverna dos Ossos: the Lich's dimension (lich.js tells the story; this is the place). A dome
// of dark blue rock floating way up at CAVE.y, lit only by sick green fire: mountains of skulls all
// round (the heroes who tried to stop him, their swords and shields still in the heaps), the
// skeleton of a giant beast arching over the way in from the portal, a giant horned skull sunk in the
// far wall, glowing crystals in the rock, pools of ectoplasm, shafts of pale light from cracks in the
// ceiling. In the middle, on a heap of skulls inside a ritual circle, the Lich waits with the
// Enchiridion; souls drift out of the heaps and spiral into the book, green lightning crackles out of
// it, waves of light run along the cracks in the floor, skulls circle him with burning eyes.
// The light is faked: every static piece gets its colour baked from the lights near it (lit(): the
// Builder merges pieces that only differ in colour, so it costs nothing), the floor and the dome get
// it per vertex. It has its own Builder, drawn only near it; from inside, W.sealed hides the world.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Builder, mtx } from "./builder.js";
import { toon, noOutline } from "./toon.js";
import { ringCollider, cylCollider } from "./physics.js";
import { P, rng, smooth } from "./terrain.js";

const TAU = Math.PI * 2;
/**
 * y: the floor; r: the camera's ring (it stays inside); wall: the invisible wall round the floor;
 * spawnA: where Finn lands and the way out opens (angle round the middle, 0 = +z); portal: how far
 * from the middle the way out stands; top: the heap of skulls in the middle (where the Lich stands).
 * fx: book (where the Enchiridion is: lich.js keeps it up to date), flash (0..1: the circle blazes),
 * dark (0..1: the green fires, the cracks and the glows dim down: the Lich's "Fall", lichboss.js).
 * heaps: the mountains of skulls on the floor ({ x, z, R, H, tiers: the tops of their colliders, from
 * the ground up }): above the green fire of the fight (lichboss.js).
 */
export const CAVE = { x: P.lich.x, z: P.lich.z, y: 400, r: 25, wall: 27.5, spawnA: Math.PI, portal: 26.4, top: 1.2, fx: null, heaps: [] };
// the dome over the cave: [radius, height over the floor]
const DOME = [[40, -1], [38.5, 2], [36.5, 6], [34, 10], [30, 14], [24, 17.5], [16, 20], [8, 21.5], [0.5, 22]];
const domeY = (d) => {
  for (let i = DOME.length - 1; i > 0; i--) {
    const [r0, y0] = DOME[i], [r1, y1] = DOME[i - 1];
    if (d >= r0 && d <= r1) return y0 + ((d - r0) / (r1 - r0)) * (y1 - y0);
  }
  return DOME[DOME.length - 1][1];
};
const domeR = (h) => {
  for (let i = 1; i < DOME.length; i++) if (h <= DOME[i][1]) { const [r0, y0] = DOME[i - 1], [r1, y1] = DOME[i]; return r0 + ((h - y0) / (y1 - y0)) * (r1 - r0); }
  return 0;
};

/** How far inside the Lich's cave a point is (0..1): tints sky, fog and light (main.js). */
export function lichCaveAt(p) {
  return smooth(CAVE.y - 60, CAVE.y - 30, p.y) * (1 - smooth(45, 70, Math.hypot(p.x - CAVE.x, p.z - CAVE.z)));
}

// ── the faked light ──
const LIGHTS = [];
const light = (x, y, z, r, k, hex) => LIGHTS.push({ x, y, z, r, k, c: new THREE.Color(hex) });
const _c = new THREE.Color();
/** A colour as the green fire would light it at (x, y, z): dark far from everything, tinted near the lights. */
function litColor(hex, x, y, z, out = _c) {
  out.setHex(hex);
  const d = Math.hypot(x - CAVE.x, z - CAVE.z);
  const amb = 0.34 + 0.22 * (1 - smooth(6, 32, d)) - 0.16 * smooth(4, 20, y - CAVE.y);
  let gr = 0, gg = 0, gb = 0;
  for (const L of LIGHTS) {
    const dd = Math.hypot(x - L.x, y - L.y, z - L.z);
    if (dd >= L.r) continue;
    const f = (1 - dd / L.r) ** 2 * L.k;
    gr += L.c.r * f; gg += L.c.g * f; gb += L.c.b * f;
  }
  const q = (v) => Math.min(1, Math.round(v * 48) / 48), m = Math.max(gr, gg, gb), cap = m > 0.9 ? 0.9 / m : 1;
  return out.setRGB(q(out.r * (amb + gr * cap * 0.6)), q(out.g * (amb + gg * cap * 0.6)), q(out.b * (amb + gb * cap * 0.6)));
}
const litHex = (hex, x, y, z) => litColor(hex, x, y, z).getHex();

// ── textures ──
function canvas(s, draw) {
  const c = document.createElement("canvas");
  c.width = c.height = s;
  draw(c.getContext("2d"), s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
let _glow = null;
/** A soft round glow (additive sprites). */
export const glowTex = () => (_glow ||= canvas(64, (x, s) => {
  const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.5)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, s, s);
}));
/** Cracks running out from the middle, branching (white on black: added as light). */
function crackTexture(r) {
  return canvas(1024, (x, s) => {
    x.fillStyle = "#000";
    x.fillRect(0, 0, s, s);
    x.strokeStyle = "#fff";
    x.lineCap = x.lineJoin = "round";
    x.shadowColor = "#fff";
    x.shadowBlur = 6;
    const crack = (px, py, a, len, w, depth) => {
      x.lineWidth = w;
      x.beginPath();
      x.moveTo(px, py);
      for (let i = 0; i < len; i++) {
        a += (r() - 0.5) * 0.7;
        px += Math.cos(a) * 9;
        py += Math.sin(a) * 9;
        x.lineTo(px, py);
        if (depth < 2 && r() < 0.06) {
          x.stroke();
          crack(px, py, a + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.6), len * 0.45, w * 0.6, depth + 1);
          x.lineWidth = w;
          x.beginPath();
          x.moveTo(px, py);
        }
      }
      x.stroke();
    };
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * TAU + r() * 0.3, d0 = s * 0.1;
      crack(s / 2 + Math.cos(a) * d0, s / 2 + Math.sin(a) * d0, a, 30 + r() * 22, 3.2, 0);
    }
  });
}
/** The ritual circle round the middle heap: rings, runes, a nine-pointed star, little skull glyphs. */
function circleTexture(r) {
  return canvas(1024, (x, s) => {
    const R = s / 2 - 10;
    x.translate(s / 2, s / 2);
    x.strokeStyle = x.fillStyle = "#fff";
    x.lineCap = x.lineJoin = "round";
    x.shadowColor = "#fff";
    x.shadowBlur = 14;
    const ringAt = (f, w) => { x.lineWidth = w; x.beginPath(); x.arc(0, 0, R * f, 0, TAU); x.stroke(); };
    ringAt(0.98, 8); ringAt(0.9, 3); ringAt(0.62, 5); ringAt(0.57, 2);
    for (let i = 0; i < 36; i++) {
      x.save();
      x.rotate((i / 36) * TAU);
      x.translate(0, -R * 0.94);
      x.lineWidth = 4;
      x.beginPath();
      for (let k = 0; k < 3; k++) {
        const x0 = (r() - 0.5) * 18, y0 = (r() - 0.5) * 18;
        if (r() < 0.3) { x.moveTo(x0 + 4, y0); x.arc(x0, y0, 4, 0, TAU); } else { x.moveTo(x0, y0); x.lineTo(x0 + (r() - 0.5) * 22, y0 + (r() - 0.5) * 22); }
      }
      x.stroke();
      x.restore();
    }
    x.lineWidth = 5;
    x.beginPath();
    for (let i = 0; i <= 9; i++) {
      const a = ((i * 4) / 9) * TAU, px = Math.sin(a) * R * 0.9, py = -Math.cos(a) * R * 0.9;
      i ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.stroke();
    // a little skull at each point of the star
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU, px = Math.sin(a) * R * 0.76, py = -Math.cos(a) * R * 0.76;
      x.save();
      x.translate(px, py);
      x.rotate(a);
      x.beginPath(); x.arc(0, 0, 22, 0, TAU); x.fill();
      x.fillRect(-11, 14, 22, 14);
      x.globalCompositeOperation = "destination-out";
      x.beginPath(); x.arc(-8, -2, 7, 0, TAU); x.arc(8, -2, 7, 0, TAU); x.fill();
      x.globalCompositeOperation = "source-over";
      x.restore();
    }
  });
}
/** Ectoplasm: bright green swirls and bubbles on dark green. */
function oozeTexture(r) {
  const t = canvas(256, (x, s) => {
    x.fillStyle = "#1d7a2a";
    x.fillRect(0, 0, s, s);
    for (let i = 0; i < 60; i++) {
      const px = r() * s, py = r() * s, rad = 6 + r() * 26;
      const g = x.createRadialGradient(px, py, 0, px, py, rad);
      g.addColorStop(0, r() < 0.5 ? "rgba(190,255,150,0.9)" : "rgba(90,230,90,0.8)");
      g.addColorStop(1, "rgba(40,160,50,0)");
      x.fillStyle = g;
      for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) x.fillRect(px + ox - rad, py + oy - rad, rad * 2, rad * 2);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
/** Soft blobs of mist (white on black, added). */
function mistTexture(r) {
  const t = canvas(256, (x, s) => {
    x.fillStyle = "#000";
    x.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i++) {
      const px = r() * s, py = r() * s, rad = 20 + r() * 50;
      const g = x.createRadialGradient(px, py, 0, px, py, rad);
      g.addColorStop(0, `rgba(255,255,255,${0.25 + r() * 0.3})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = g;
      for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) x.fillRect(px + ox - rad, py + oy - rad, rad * 2, rad * 2);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ── glowing points (sizes in world units, some flicker like fire) ──
const GLOW_VS = `
attribute float size;
attribute float flick;
attribute float phase;
attribute vec3 tint;
uniform float time;
uniform float uH;
varying vec3 vCol;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float f = 1.0 + flick * (0.18 * sin(time * 9.0 + phase) + 0.08 * sin(time * 23.0 + phase * 3.0));
  vCol = tint * f * 0.7;
  gl_PointSize = size * f * projectionMatrix[1][1] * uH / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const GLOW_FS = `
uniform sampler2D map;
varying vec3 vCol;
void main() {
  float a = texture2D(map, gl_PointCoord).a;
  gl_FragColor = vec4(vCol * a, 1.0);
}`;
function glowPoints(n) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), tint = new Float32Array(n * 3), size = new Float32Array(n), flick = new Float32Array(n), phase = new Float32Array(n);
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("tint", new THREE.BufferAttribute(tint, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("size", new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("flick", new THREE.BufferAttribute(flick, 1));
  geo.setAttribute("phase", new THREE.BufferAttribute(phase, 1));
  const mat = noOutline(new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, uH: { value: 500 }, map: { value: glowTex() } },
    vertexShader: GLOW_VS, fragmentShader: GLOW_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  let used = 0;
  return {
    pts, pos, tint, size, flick, phase, mat,
    /** A fixed glow; returns its index. */
    add(x, y, z, s, hex, fl = 0) {
      const i = used++;
      pos.set([x, y, z], i * 3);
      _c.setHex(hex);
      tint.set([_c.r, _c.g, _c.b], i * 3);
      size[i] = s;
      flick[i] = fl;
      phase[i] = i * 2.39;
      return i;
    },
    set(i, x, y, z, s, r, g, b) {
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      tint[i * 3] = r; tint[i * 3 + 1] = g; tint[i * 3 + 2] = b;
      size[i] = s;
    },
    done() { geo.setDrawRange(0, used); for (const k of ["position", "tint", "size", "flick", "phase"]) geo.attributes[k].needsUpdate = true; },
  };
}

export function buildLichCave(W) {
  const X = CAVE.x, Z = CAVE.z, Y = CAVE.y, r = rng(6660);
  const grp = new THREE.Group();
  W.scene.add(grp);
  const B = new Builder(grp);
  const at = (a, d) => [X + Math.sin(a) * d, Z + Math.cos(a) * d];
  const off = (a) => Math.abs(Math.atan2(Math.sin(a - CAVE.spawnA), Math.cos(a - CAVE.spawnA)));
  // the way in (from the portal to the middle, under the beast's ribs) stays clear
  const clear = (a, d, w = 0.33) => off(a) < w && d < 27;
  CAVE.fx = { book: new THREE.Vector3(X, Y + 3.4, Z), flash: 0, dark: 0 };
  const BOOK = CAVE.fx.book;

  // ── the layout first (everything that gives light), then the lights, then the stone and bones ──
  const torches = [];
  for (let k = 0; k < 8; k++) {
    const a = ((k + 0.5) / 8) * TAU, [x, z] = at(a, 7.5);
    torches.push({ a, x, z });
  }
  const crystals = [];
  for (let k = 0; k < 11; k++) {
    const a = (k / 11) * TAU + 0.2 + (r() - 0.5) * 0.25;
    if (off(a) < 0.25 || off(a) > Math.PI - 0.3) continue; // (not behind the portal, nor over the giant skull)
    const h = 2 + r() * 9, d = domeR(h) - 1.2, [x, z] = at(a, d);
    crystals.push({ a, x, z, y: Y + h, d, purple: k % 4 === 2 });
  }
  const heapA = [...Array(8)].map((_, k) => (k / 8) * TAU + 0.35 + (r() - 0.5) * 0.3);
  const pools = [];
  for (const k of [1, 2, 5, 6]) {
    const a = (heapA[k] + heapA[(k + 1) % 8] + (k === 7 ? TAU : 0)) / 2, d = 15 + r() * 3;
    if (clear(a, d, 0.55)) continue;
    const [x, z] = at(a, d);
    pools.push({ x, z, r: 1.3 + r() * 0.8 });
  }
  const shafts = [{ x: X, z: Z, r0: 1.6, r1: 4.2, k: 0.9 }, ...pools.slice(0, 2).map((p) => ({ x: p.x, z: p.z, r0: 0.9, r1: 2.6, k: 0.55 }))];
  const skullA = CAVE.spawnA + Math.PI, [gsx, gsz] = at(skullA, 33.5), gsy = Y + 6.5, GS = 7;
  const gsYaw = skullA + Math.PI, gsF = [Math.sin(gsYaw), 0, Math.cos(gsYaw)], gsR = [Math.cos(gsYaw), 0, -Math.sin(gsYaw)];
  const gso = (a2, b, c) => [gsx + (gsF[0] * a2 + gsR[0] * b) * GS, gsy + c * GS, gsz + (gsF[2] * a2 + gsR[2] * b) * GS];
  const [hx, hz] = at(CAVE.spawnA, CAVE.portal);

  light(BOOK.x, BOOK.y, BOOK.z, 14, 0.8, 0x6dff5a);
  for (const t of torches) light(t.x, Y + 3, t.z, 5.5, 0.6, 0x7dff5a);
  for (const c of crystals) light(c.x, c.y, c.z, 7, 0.6, c.purple ? 0xa070ff : 0x5dff7a);
  for (const p of pools) light(p.x, Y + 0.5, p.z, 5 + p.r * 2, 0.6, 0x7dff5a);
  for (const s of [-1, 1]) light(...gso(1.05, s * 0.36, 0.02), 10, 0.7, 0x6dff4a);
  light(hx, Y + 3, hz, 6, 0.5, 0x7dff5a);
  for (const s of shafts.slice(1)) light(s.x, Y + 1, s.z, 7, 0.4, 0xcfffe8);

  const M = (hex, x, y, z, o = {}) => toon(litHex(hex, x, y, z), o);
  const ROCK = 0x2c3a4e, BONE = 0xc4cfda, HEAP = 0x7d8ea4;
  const SOCKET = toon(0x080c10, { outline: false });

  // ── the floor and the dome: meshes of their own, lit per vertex ──
  const vertexLit = (geo, hex) => {
    const p = geo.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      litColor(hex, p.getX(i), p.getY(i), p.getZ(i));
      col.set([_c.r, _c.g, _c.b], i * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  };
  {
    const geo = new THREE.RingGeometry(0.3, 44, 72, 34).rotateX(-Math.PI / 2).translate(X, Y, Z);
    vertexLit(geo, 0x263246);
    grp.add(new THREE.Mesh(geo, toon(0xffffff, { tex: "rock", scale: 0.12, vc: true, outline: false })));
    cylCollider(X, Z, 44, Y - 3, Y);
  }
  {
    const geo = new THREE.LatheGeometry(DOME.map(([rr, h]) => new THREE.Vector2(rr, h)), 56);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(x, z);
      // (periodic in the angle: the seam closes)
      const k = 1 + 0.06 * Math.sin(3 * a + y * 0.6) + 0.04 * Math.sin(8 * a - y * 1.1) + 0.03 * Math.sin(13 * a + y * 2.3);
      p.setXYZ(i, X + x * k, Y + y + 0.6 * Math.sin(5 * a + x * 0.2), Z + z * k);
    }
    geo.computeVertexNormals();
    vertexLit(geo, 0x2a3a52);
    grp.add(new THREE.Mesh(geo, toon(0xffffff, { tex: "stone", scale: 0.14, side: THREE.BackSide, outline: false, flat: true, vc: true })));
  }
  ringCollider(X, Z, CAVE.wall, 1.2, Y - 0.5, Y + 30, [], false);
  // boulders round the foot of the wall, stalagmites, and stalactites hanging from the dome
  for (let k = 0; k < 30; k++) {
    const a = (k / 30) * TAU + r() * 0.2, d = 34 + r() * 3, [x, z] = at(a, d), s = 2.4 + r() * 2.4;
    B.sphere(x, Y + s * 0.3, z, s, M(ROCK, x, Y + 1, z, { tex: "rock", scale: 0.1, flat: true }), { sx: 1.2, sy: 0.7 + r() * 0.6, seg: 7, ry: r() * 3 });
  }
  for (let k = 0; k < 20; k++) {
    const a = r() * TAU, d = 29 + r() * 4, [x, z] = at(a, d), h = 2.5 + r() * 5;
    if (off(a) < 0.3) continue;
    B.cone(x, Y - 0.2, z, 0.8 + r() * 0.7, h, M(ROCK, x, Y + h * 0.4, z, { tex: "rock", scale: 0.1, flat: true }), { seg: 6, ry: r() * 3 });
  }
  for (let k = 0; k < 44; k++) {
    const a = r() * TAU, d = 7 + r() * 25, [x, z] = at(a, d), top = domeY(d), len = Math.min(1.5 + r() * 4.5, top - 16);
    if (len < 1) continue;
    B.cone(x, Y + top - len, z, 0.3 + r() * 0.6, len + 1.2, M(ROCK, x, Y + top - len, z, { tex: "rock", scale: 0.1, flat: true }), { rx: Math.PI, seg: 6 });
  }

  // ── skulls, bones, the gear of fallen heroes ──
  const skull = (px, py, pz, s, yaw, pitch, jaw) => {
    B.sphere(px, py, pz, s, M(BONE, px, py, pz), { seg: 6, sx: 0.9, sy: 0.85, ry: yaw, rx: pitch });
    const cp = Math.cos(pitch), sp = Math.sin(pitch), sy = Math.sin(yaw), cy = Math.cos(yaw);
    const f = [sy * cp, -sp, cy * cp], rt = [cy, 0, -sy], up = [sy * sp, cp, cy * sp];
    const o = (a, b, c) => [px + (f[0] * a + rt[0] * b + up[0] * c) * s, py + (f[1] * a + rt[1] * b + up[1] * c) * s, pz + (f[2] * a + rt[2] * b + up[2] * c) * s];
    for (const side of [-1, 1]) B.sphere(...o(0.62, side * 0.34, 0.06), s * 0.31, SOCKET, { seg: 4, sy: 1.1 });
    B.sphere(...o(0.84, 0, -0.26), s * 0.1, SOCKET, { seg: 3, sy: 1.4 }); // the nose hole
    if (jaw || s > 0.5) B.sphere(...o(0.45, 0, -0.62), s * 0.55, M(BONE, px, py, pz), { seg: 5, sx: 0.75, sy: 0.35, sz: 0.65, ry: yaw, rx: pitch });
  };
  const bone = (a, b, t) => {
    const m = M(BONE, a[0], a[1], a[2]);
    B.capsule(a, b, t, m, 5);
    for (const e of [a, b]) for (const side of [-1, 1]) B.sphere(e[0] + side * t * 0.8, e[1], e[2], t * 1.4, m, { seg: 5 });
  };
  // a sword stuck in (tip at `tip`, pointing along `dir` out of the ground or the heap)
  const sword = (tip, dir, len) => {
    const [tx, ty, tz] = tip, hilt = [tx + dir[0] * len, ty + dir[1] * len, tz + dir[2] * len];
    const side = [dir[2], 0, -dir[0]], sl = Math.hypot(side[0], side[2]) || 1;
    side[0] /= sl; side[2] /= sl;
    B.plank(tip, hilt, 0.16, 0.05, M(0x9aa4ac, ...hilt));
    const g0 = [hilt[0] - side[0] * 0.32, hilt[1], hilt[2] - side[2] * 0.32], g1 = [hilt[0] + side[0] * 0.32, hilt[1], hilt[2] + side[2] * 0.32];
    B.capsule(g0, g1, 0.05, M(0xb08a3a, ...hilt), 5);
    const grip = [hilt[0] + dir[0] * 0.4, hilt[1] + dir[1] * 0.4, hilt[2] + dir[2] * 0.4];
    B.capsule(hilt, grip, 0.05, M(0x4a2e1a, ...hilt), 5);
    B.sphere(grip[0], grip[1], grip[2], 0.08, M(0xb08a3a, ...grip), { seg: 5 });
  };
  const shield = (x, z, yaw, tilt, s) => {
    const y = Y + s * 0.9;
    B.cyl(x, y - 0.05, z, s, 0.1, M(0x6a4428, x, y, z, { tex: "planks", scale: 0.8 }), { seg: 12, rx: tilt, ry: yaw, solid: false });
    const n = [Math.sin(yaw) * Math.sin(tilt), Math.cos(tilt), Math.cos(yaw) * Math.sin(tilt)]; // the shield's face
    B.sphere(x + n[0] * 0.08, y + n[1] * 0.08, z + n[2] * 0.08, s * 0.22, M(0x9aa4ac, x, y, z), { seg: 6, sy: 0.6, rx: tilt, ry: yaw });
    B.raw(new THREE.TorusGeometry(s, 0.05, 5, 16), M(0x8a949c, x, y, z), mtx(x, y, z, yaw, 1, 1, 1, tilt - Math.PI / 2, 0));
  };
  const helmet = (x, z, yaw) => {
    B.sphere(x, Y + 0.05, z, 0.42, M(0x8a949c, x, Y + 0.3, z), { seg: 8, sy: 0.9, ry: yaw, rx: 0.3 });
    for (const s of [-1, 1]) B.cone(x + Math.cos(yaw) * s * 0.38, Y + 0.25, z - Math.sin(yaw) * s * 0.38, 0.09, 0.45, M(0xd8ccaa, x, Y + 0.4, z), { rz: -s * 0.9, ry: yaw, seg: 5 });
  };
  // a mountain of skulls: a heap (painted with skulls) covered with bigger ones, bones and swords
  // sticking out; tiers of colliders, so it can be climbed with jumps
  const heap = (x, z, R, H, n, s0, swords = 0) => {
    B.sphere(x, Y, z, R, M(HEAP, x, Y + H * 0.5, z, { tex: "bones", scale: 0.32 }), { sy: H / R, seg: 14 });
    const surf = (a, e) => {
      const ce = Math.cos(e), se = Math.sin(e), nx = (ce * Math.sin(a)) / R, ny = se / H, nz = (ce * Math.cos(a)) / R, nl = Math.hypot(nx, ny, nz);
      return [x + Math.sin(a) * ce * R, Y + se * H, z + Math.cos(a) * ce * R, nx / nl, ny / nl, nz / nl];
    };
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, e = Math.asin(Math.pow(r(), 0.8)) * 0.98, s = s0 * (0.7 + r() * 0.6);
      const [px, py, pz, nx, ny, nz] = surf(a, e);
      if (py < Y + s * 0.3) continue;
      skull(px + nx * s * 0.35, py + ny * s * 0.35, pz + nz * s * 0.35, s, a + (r() - 0.5) * 1.6, -Math.asin(ny) * 0.7 + (r() - 0.5) * 0.6, r() < 0.3);
    }
    for (let i = 0; i < n / 5; i++) {
      const a = r() * TAU, e = r() * 1.2, [bx, by, bz] = surf(a, e);
      const la = a + (r() - 0.5) * 1.5, len = 0.9 + r() * 1.2, tilt = 0.3 + r() * 0.9;
      bone([bx, by, bz], [bx + Math.sin(la) * Math.cos(tilt) * len, by + Math.sin(tilt) * len, bz + Math.cos(la) * Math.cos(tilt) * len], 0.09 + r() * 0.05);
    }
    for (let i = 0; i < swords; i++) {
      const a = r() * TAU, e = 0.4 + r() * 0.7, [sx, sy, sz, nx, ny, nz] = surf(a, e);
      const d = [nx * 0.5 + (r() - 0.5) * 0.4, ny * 0.5 + 0.6, nz * 0.5 + (r() - 0.5) * 0.4], dl = Math.hypot(...d);
      sword([sx - nx * 0.4, sy - ny * 0.4, sz - nz * 0.4], d.map((v) => v / dl), 1.3 + r() * 0.4);
    }
    const tiers = [0.4, 0.7, 0.92].map((k) => ({ r: R * Math.sqrt(1 - k * k) * 0.98, y: H * k }));
    for (const t of tiers) cylCollider(x, z, t.r, Y - 1, Y + t.y);
    return { x, z, R, H, surf, tiers };
  };
  const heaps = [];
  // the heap in the middle, where the Lich stands
  const mid = heap(X, Z, 3.2, CAVE.top / 0.92, 46, 0.42);
  // mountains between the middle and the wall (a wider gap for the beast's ribs)
  heapA.forEach((a) => {
    const d = 13 + r() * 6;
    if (clear(a, d, 0.6)) return;
    const [x, z] = at(a, d), R = 3.2 + r() * 2.2, H = 2.4 + r() * 2.6;
    heaps.push(heap(x, z, R, H, Math.round(R * R * 3.2), 0.45, 2));
  });
  // and great ones against the wall, rising into the dark
  for (let k = 0; k < 13; k++) {
    const a = (k / 13) * TAU + (r() - 0.5) * 0.2, d = 31 + r() * 2;
    if (off(a) < 0.45 || off(a) > Math.PI - 0.22) continue;
    const [x, z] = at(a, d), R = 5.5 + r() * 2.5, H = 6 + r() * 6;
    heaps.push(heap(x, z, R, H, Math.round(R * R * 2.2), 0.7, 1));
  }
  // loose skulls, bones, shields and helmets all over the floor
  for (let i = 0; i < 80; i++) {
    const a = r() * TAU, d = 4.5 + r() * 21;
    if (clear(a, d, 0.25) && d > 5) continue;
    if (pools.some((p) => Math.hypot(at(a, d)[0] - p.x, at(a, d)[1] - p.z) < p.r + 0.6)) continue;
    const [x, z] = at(a, d);
    if (i % 3) skull(x, Y + 0.2, z, 0.28 + r() * 0.12, r() * TAU, -0.3 + r() * 0.2, r() < 0.4);
    else { const la = r() * TAU, len = 0.8 + r() * 0.8; bone([x, Y + 0.08, z], [x + Math.sin(la) * len, Y + 0.08, z + Math.cos(la) * len], 0.07); }
  }
  for (const h of heaps.slice(0, 7)) {
    const a = Math.atan2(X - h.x, Z - h.z) + (r() - 0.5) * 0.8, x = h.x + Math.sin(a) * (h.R + 0.2), z = h.z + Math.cos(a) * (h.R + 0.2);
    if (Math.hypot(x - X, z - Z) > 25) continue;
    if (r() < 0.6) shield(x, z, a, -1.1, 0.6 + r() * 0.2);
    else helmet(x, z, r() * TAU);
  }
  for (let i = 0; i < 6; i++) {
    const a = r() * TAU, d = 5.5 + r() * 18;
    if (clear(a, d, 0.3)) continue;
    const [x, z] = at(a, d);
    sword([x, Y - 0.3, z], [(r() - 0.5) * 0.5, 1, (r() - 0.5) * 0.5].map((v, k, arr) => v / Math.hypot(...arr)), 1.4);
  }

  // ── the skeleton of a giant beast, its ribs arching over the way in, its neck sunk in the floor ──
  {
    const u = [Math.sin(CAVE.spawnA), Math.cos(CAVE.spawnA)], v = [u[1], -u[0]];
    const pt = (d, lat, h) => [X + u[0] * d + v[0] * lat, Y + h, Z + u[1] * d + v[1] * lat];
    const spineH = (d) => 7.4 + Math.sin(((d - 10) / 11) * Math.PI) * 1.2;
    const spine = [];
    for (let d = 9; d <= 20.5; d += 0.5) spine.push(pt(d, 0, d < 10.5 ? spineH(10.5) * (d - 9) / 1.5 : spineH(d)));
    // the neck swings off to the side, down to the beast's skull lying on the floor
    const neck = [pt(20.5, 0, spineH(20.5)), pt(21.1, 2.4, 5.6), pt(21.2, 4.8, 2.8), pt(20.8, 6.3, 1.3)];
    B.branch(spine, 0.34, 0.26, M(BONE, ...pt(15, 0, 7)), 36);
    B.branch(neck, 0.3, 0.26, M(BONE, ...pt(21, 3, 4)), 12);
    {
      // the beast's skull: long, with a jaw full of fangs and two swept-back horns
      const [bx, by, bz] = pt(20.4, 7.6, 1.3), yaw = Math.atan2(-u[0], -u[1]);
      B.sphere(bx, by, bz, 1.5, M(BONE, bx, by + 1, bz), { seg: 10, sx: 0.9, sy: 0.75, sz: 1.5, ry: yaw });
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      for (const side of [-1, 1]) {
        B.sphere(bx + fx * 0.9 + fz * side * 0.55, by + 0.35, bz + fz * 0.9 - fx * side * 0.55, 0.38, SOCKET, { seg: 6 });
        B.cone(bx - fx * 0.9 + fz * side * 0.5, by + 0.6, bz - fz * 0.9 - fx * side * 0.5, 0.25, 1.8, M(0xc8b27a, bx, by + 1, bz), { rx: -1.1, ry: yaw, seg: 6 });
      }
      for (let i = 0; i < 6; i++) B.cone(bx + fx * (0.6 + i * 0.25), by - 0.6, bz + fz * (0.6 + i * 0.25), 0.07, 0.35, M(BONE, bx, by, bz), { rx: Math.PI, seg: 4 });
      cylCollider(bx, bz, 1.4, Y, Y + 2.2);
    }
    for (let i = 0; i < spine.length; i += 2) {
      const p = spine[i];
      B.sphere(p[0], p[1] + 0.25, p[2], 0.42, M(BONE, ...p), { seg: 6, sy: 0.7 });
      B.cone(p[0], p[1] + 0.3, p[2], 0.14, 0.9, M(BONE, ...p), { seg: 5 });
    }
    for (let k = 0; k < 6; k++) {
      const d = 19.6 - k * 1.75, H = spineH(d), s = 1 - k * 0.05;
      for (const side of [-1, 1]) {
        const rib = [[0, H - 0.1], [2.4, H - 0.5], [3.9, H - 2.6], [4.4, H - 5.0], [4.1, 1.0], [3.6, -0.2]].map(([l, h]) => pt(d + k * 0.05, side * l * s, h));
        B.branch(rib, 0.28 * s, 0.15, M(BONE, ...pt(d, side * 3.5, 4)), 16);
        const base = pt(d, side * 4.0 * s, 0);
        cylCollider(base[0], base[2], 0.5, Y, Y + 3.5);
      }
    }
  }

  // ── the giant skull sunk in the far wall: horns like the Lich's, candles on its brow, green fire in its eyes ──
  const flameGeo = [], coreGeo = [];
  const flame = (x, y, z, s) => {
    flameGeo.push(new THREE.ConeGeometry(0.3 * s, 1.0 * s, 7).translate(x, y + 0.5 * s, z));
    coreGeo.push(new THREE.ConeGeometry(0.15 * s, 0.55 * s, 6).translate(x, y + 0.27 * s, z));
  };
  const glows = glowPoints(160);
  const candle = (x, y, z, rad, h) => {
    B.cyl(x, y, z, rad, h, M(0x3a3a30, x, y + h, z), { seg: 7, solid: false });
    B.sphere(x, y + h - 0.02, z, rad * 1.05, M(0x3a3a30, x, y + h, z), { seg: 6, sy: 0.35 });
    flame(x, y + h + 0.05, z, rad * 2.2);
    glows.add(x, y + h + 0.3, z, rad * 7, 0x5dff4a, 1);
  };
  {
    B.sphere(gsx, gsy, gsz, GS, M(BONE, ...gso(0.9, 0, 0.2)), { seg: 16, sx: 0.95, sy: 0.85, ry: gsYaw });
    for (const side of [-1, 1]) {
      B.sphere(...gso(0.7, side * 0.36, 0.02), GS * 0.27, SOCKET, { seg: 10, sy: 1.1 });
      glows.add(...gso(0.95, side * 0.36, 0.02), 7, 0x4dff3a, 0.6);
      glows.add(...gso(0.97, side * 0.36, 0.02), 2.5, 0xdfffc0, 0.4);
      // a ram's horn curling out of each temple
      const horn = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10, a = t * 4.2, rad = GS * 0.55 * (1 - t * 0.5);
        const c = gso(0.1 - Math.sin(a) * 0.35 * (1 - t * 0.4), side * (0.75 + t * 0.35), 0.45 + Math.cos(a) * 0.1);
        horn.push([c[0], c[1] + Math.sin(a) * rad * 0.5, c[2]]);
      }
      B.branch(horn, 1.3, 0.25, M(0xc8b27a, ...gso(0.3, side * 0.9, 0.6)), 20);
    }
    B.sphere(...gso(0.84, 0, -0.28), GS * 0.1, SOCKET, { seg: 6, sy: 1.3 });
    for (let i = -3; i <= 3; i++) B.box(...gso(0.78 - Math.abs(i) * 0.03, i * 0.1, -0.62), GS * 0.08, GS * 0.14, GS * 0.06, M(BONE, ...gso(0.8, 0, -0.6)), { ry: gsYaw, solid: false });
    for (let i = -2; i <= 2; i++) { const c = gso(0.62, i * 0.16, 0.42); candle(c[0], c[1] - 0.3, c[2], 0.16 + (i % 2 ? 0 : 0.05), 0.5 + ((i + 2) % 3) * 0.3); }
  }
  // skull torches on long bones round the middle heap
  for (const t of torches) {
    const { x, z, a } = t;
    B.capsule([x, Y, z], [x, Y + 2.4, z], 0.1, M(BONE, x, Y + 1.5, z), 6);
    skull(x, Y + 2.65, z, 0.36, a + Math.PI, -0.1, true);
    cylCollider(x, z, 0.3, Y, Y + 2.8, false);
    flame(x, Y + 2.95, z, 0.9);
    glows.add(x, Y + 3.3, z, 2.2, 0x4dff3a, 1);
  }
  // candles on the tops of the mountains
  for (const h of heaps) {
    if (h.H > 6) continue;
    for (let i = 0; i < 3; i++) {
      const [cx, cy, cz] = h.surf(r() * TAU, 1.25 + r() * 0.2);
      candle(cx, cy - 0.15, cz, 0.12 + r() * 0.06, 0.35 + r() * 0.4);
    }
  }
  const flameMat = noOutline(new THREE.MeshBasicMaterial({ color: 0x7dff5a }));
  const coreMat = noOutline(new THREE.MeshBasicMaterial({ color: 0xe6ffd0 }));
  grp.add(new THREE.Mesh(mergeGeometries(flameGeo), flameMat), new THREE.Mesh(mergeGeometries(coreGeo), coreMat));

  // ── crystals growing out of the rock ──
  const crysG = toon(0x5dff7a, { emissive: 0x1a8a2a, flat: true }), crysP = toon(0xb08aff, { emissive: 0x4a2a9a, flat: true });
  for (const c of crystals) {
    const m = c.purple ? crysP : crysG, n = 4 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const h = 1.2 + r() * 1.8, w = 0.25 + r() * 0.2, tilt = 0.4 + r() * 0.7, ry = c.a + Math.PI + (r() - 0.5) * 1.6;
      B.raw(new THREE.OctahedronGeometry(1, 0), m, mtx(c.x + (r() - 0.5) * 1.2, c.y + (r() - 0.5) * 1.2, c.z + (r() - 0.5) * 1.2, ry, w, h, w, tilt, 0));
    }
    glows.add(c.x - Math.sin(c.a) * 0.8, c.y, c.z - Math.cos(c.a) * 0.8, 6, c.purple ? 0x6a3ad8 : 0x2acc4a, 0.15);
  }

  // ── pools of ectoplasm, stones round their rims, bubbles ──
  const ooze = oozeTexture(r);
  const oozeMat = noOutline(new THREE.MeshBasicMaterial({ map: ooze }));
  const poolGeo = [];
  for (const p of pools) {
    poolGeo.push(new THREE.CircleGeometry(p.r, 24).rotateX(-Math.PI / 2).translate(p.x, Y + 0.06, p.z));
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + r() * 0.3, x = p.x + Math.sin(a) * (p.r + 0.15), z = p.z + Math.cos(a) * (p.r + 0.15);
      B.sphere(x, Y + 0.05, z, 0.3 + r() * 0.2, M(ROCK, x, Y + 0.2, z, { tex: "rock", scale: 0.1, flat: true }), { seg: 5, sy: 0.6 });
    }
    glows.add(p.x, Y + 0.4, p.z, p.r * 3, 0x2a9a30, 0.2);
  }
  grp.add(new THREE.Mesh(mergeGeometries(poolGeo), oozeMat));

  // ── cracks in the floor with waves of light running out along them, the ritual circle ──
  const crackMat = noOutline(new THREE.ShaderMaterial({
    uniforms: { map: { value: crackTexture(r) }, time: { value: 0 }, pulse: { value: 0 }, col: { value: new THREE.Color(0x4dff4a) } },
    vertexShader: "varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform sampler2D map;
uniform float time;
uniform float pulse;
uniform vec3 col;
varying vec2 vUv;
void main() {
  float c = texture2D(map, vUv).r;
  float d = length(vUv - 0.5) * 60.0;
  float w = pow(0.5 + 0.5 * sin(d * 0.45 - time * 2.2), 4.0);
  float k = c * (0.18 + 0.8 * w + pulse) * (1.0 - smoothstep(20.0, 29.0, d));
  gl_FragColor = vec4(col * k, 1.0);
}`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  const cracks = new THREE.Mesh(new THREE.CircleGeometry(30, 64).rotateX(-Math.PI / 2), crackMat);
  cracks.position.set(X, Y + 0.03, Z);
  cracks.renderOrder = 1;
  grp.add(cracks);
  const circleMat = noOutline(new THREE.MeshBasicMaterial({ map: circleTexture(r), color: 0x4dff4a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const circle = new THREE.Mesh(new THREE.CircleGeometry(6.6, 64).rotateX(-Math.PI / 2), circleMat);
  circle.position.set(X, Y + 0.05, Z);
  circle.renderOrder = 2;
  grp.add(circle);
  // a ring of light that runs out across the floor now and then, like a heartbeat
  const pulseMat = noOutline(new THREE.MeshBasicMaterial({ color: 0x4dff4a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  const pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 72).rotateX(-Math.PI / 2), pulseMat);
  pulseRing.position.set(X, Y + 0.08, Z);
  pulseRing.renderOrder = 2;
  grp.add(pulseRing);

  // ── shafts of pale light through cracks in the ceiling ──
  const shaftMat = noOutline(new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, col: { value: new THREE.Color(0x9fe8c0) } },
    vertexShader: `varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`,
    fragmentShader: `uniform vec3 col;
uniform float time;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
void main() {
  float edge = pow(abs(dot(normalize(vN), normalize(vV))), 2.2);
  float v = vUv.y;
  float grad = smoothstep(0.0, 0.2, v) * (0.3 + 0.7 * v);
  float band = 0.8 + 0.2 * sin(v * 16.0 - time * 1.3 + vUv.x * 25.0);
  gl_FragColor = vec4(col * edge * grad * band * 0.32, 1.0);
}`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }));
  for (const s of shafts) {
    const top = domeY(Math.hypot(s.x - X, s.z - Z)) + 0.5;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(s.r0, s.r1, top, 20, 1, true), shaftMat);
    m.position.set(s.x, Y + top / 2, s.z);
    m.scale.set(1, 1, 1);
    m.renderOrder = 3;
    m.userData.k = s.k;
    grp.add(m);
    glows.add(s.x, Y + top - 0.5, s.z, s.r0 * 5, 0x6a9a80, 0);
  }
  glows.done();
  grp.add(glows.pts);

  // ── mist creeping over the floor (two layers drifting different ways) ──
  const mistTex = mistTexture(r);
  const mists = [0.4, 1.1].map((h, i) => {
    const t = mistTex.clone();
    t.needsUpdate = true;
    t.repeat.set(2.2 + i, 2.2 + i);
    const m = new THREE.Mesh(new THREE.CircleGeometry(34, 48).rotateX(-Math.PI / 2), noOutline(new THREE.MeshBasicMaterial({ map: t, color: i ? 0x0e241a : 0x163826, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    m.position.set(X, Y + h, Z);
    m.renderOrder = 4;
    grp.add(m);
    return m;
  });

  // ── things that move: motes of dead magic rising, bubbles, dust in the light, souls, skulls circling the Lich ──
  const MN = 170, mPos = new Float32Array(MN * 3), mCol = new Float32Array(MN * 3), mote = [];
  for (let i = 0; i < MN; i++) {
    const kind = i < 110 ? 0 : i < 140 ? 1 : 2; // 0 motes, 1 bubbles in the pools, 2 dust in the shafts
    let x = 0, z = 0;
    if (kind === 0) { const a = r() * TAU, d = i < 40 ? r() * 6 : 6 + r() * 22; x = Math.sin(a) * d; z = Math.cos(a) * d; }
    else if (kind === 1 && pools.length) { const p = pools[i % pools.length], a = r() * TAU, d = Math.sqrt(r()) * p.r * 0.85; x = p.x - X + Math.sin(a) * d; z = p.z - Z + Math.cos(a) * d; }
    else { const s = shafts[i % shafts.length], a = r() * TAU, d = Math.sqrt(r()) * s.r1 * 0.8; x = s.x - X + Math.sin(a) * d; z = s.z - Z + Math.cos(a) * d; }
    mote.push({ kind, x, z, y: r() * (kind === 1 ? 0.6 : 18), v: kind === 1 ? 0.3 + r() * 0.4 : kind === 2 ? -0.15 - r() * 0.2 : 0.4 + r() * 0.9, ph: r() * TAU,
      c: new THREE.Color(kind === 2 ? 0xcfe8d8 : kind === 1 ? 0xb8ff9a : r() < 0.75 ? 0x7dff6a : 0xb58aff) });
  }
  const mGeo = new THREE.BufferGeometry();
  mGeo.setAttribute("position", new THREE.BufferAttribute(mPos, 3).setUsage(THREE.DynamicDrawUsage));
  mGeo.setAttribute("color", new THREE.BufferAttribute(mCol, 3).setUsage(THREE.DynamicDrawUsage));
  const motes = new THREE.Points(mGeo, noOutline(new THREE.PointsMaterial({ size: 0.4, map: glowTex(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  motes.position.set(X, Y, Z);
  motes.frustumCulled = false;
  grp.add(motes);
  // souls: pale wisps leaving the heaps and spiralling into the book, each with a fading trail
  const SOULS = 9, TRAIL = 12, souls = glowPoints(SOULS * TRAIL + 12);
  const soul = [...Array(SOULS)].map((_, i) => ({ t: -i * 0.9, dur: 5, s: new THREE.Vector3(), a: 0, hist: [] }));
  const launch = (o) => {
    const h = heaps[Math.floor(r() * heaps.length)];
    const [x, y, z] = h ? h.surf(r() * TAU, 0.6 + r() * 0.8) : [X + 10, Y + 2, Z];
    o.s.set(x, y + 0.5, z);
    o.a = r() * TAU;
    o.dur = 4.5 + r() * 3;
    o.t = 0;
    o.hist.length = 0;
  };
  for (let i = 0; i < SOULS * TRAIL + 12; i++) souls.add(0, -1000, 0, 0, 0x000000);
  souls.done();
  grp.add(souls.pts);
  // skulls circling the Lich, eyes burning
  const orbit = new THREE.Group();
  orbit.position.set(X, Y, Z);
  const oskMat = toon(0xa8c8b8), sockMat = toon(0x080c10, { outline: false });
  const orbiters = [0, 1, 2].map((i) => {
    const g = new THREE.Group(), s = 0.36;
    const cr = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), oskMat);
    cr.scale.set(s * 0.9, s * 0.85, s);
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), oskMat);
    jaw.scale.set(s * 0.45, s * 0.2, s * 0.4);
    jaw.position.set(0, -s * 0.6, s * 0.45);
    g.add(cr, jaw);
    for (const side of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 5), sockMat);
      e.scale.setScalar(s * 0.3);
      e.position.set(side * s * 0.34, s * 0.05, s * 0.62);
      g.add(e);
    }
    orbit.add(g);
    return g;
  });
  grp.add(orbit);
  // green lightning crackling out of the book: ribbons turned to the camera (a bright core, a faint halo)
  const ARCS = 4, SEG = 10;
  const arcGeo = (w) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(ARCS * SEG * 6 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    return g;
  };
  const arcCore = new THREE.Mesh(arcGeo(), noOutline(new THREE.MeshBasicMaterial({ color: 0xd8ffc0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })));
  const arcHalo = new THREE.Mesh(arcGeo(), noOutline(new THREE.MeshBasicMaterial({ color: 0x3aff4a, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })));
  for (const m of [arcCore, arcHalo]) { m.frustumCulled = false; m.renderOrder = 5; m.visible = false; grp.add(m); }
  const arcPts = [...Array(ARCS)].map(() => [...Array(SEG + 1)].map(() => new THREE.Vector3()));
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Vector3(), _v = new THREE.Vector3();
  function makeArcs() {
    for (const pts of arcPts) {
      // down to the ritual circle, or out to a torch's skull
      const tt = r() < 0.4 ? torches[Math.floor(r() * torches.length)] : null;
      if (tt) _e.set(tt.x, Y + 2.7, tt.z);
      else { const a = r() * TAU, d = 4 + r() * 2.5; _e.set(X + Math.sin(a) * d, Y + 0.1, Z + Math.cos(a) * d); }
      for (let i = 0; i <= SEG; i++) {
        const t = i / SEG, j = Math.sin(t * Math.PI) * 0.55;
        pts[i].lerpVectors(BOOK, _e, t).add(_v.set((r() - 0.5) * j, (r() - 0.5) * j + Math.sin(t * Math.PI) * 0.8, (r() - 0.5) * j));
      }
    }
  }
  function ribbon(mesh, w, cam) {
    const p = mesh.geometry.attributes.position, A = p.array;
    let o = 0;
    for (const pts of arcPts) for (let i = 0; i < SEG; i++) {
      _a.copy(pts[i]); _b.copy(pts[i + 1]);
      _s.subVectors(_b, _a).cross(_v.subVectors(cam, _a)).normalize().multiplyScalar(w * (1 - (i / SEG) * 0.6));
      const q = [_a.x - _s.x, _a.y - _s.y, _a.z - _s.z, _a.x + _s.x, _a.y + _s.y, _a.z + _s.z, _b.x + _s.x, _b.y + _s.y, _b.z + _s.z, _b.x - _s.x, _b.y - _s.y, _b.z - _s.z];
      for (const k of [0, 1, 2, 0, 2, 3]) { A[o++] = q[k * 3]; A[o++] = q[k * 3 + 1]; A[o++] = q[k * 3 + 2]; }
    }
    p.needsUpdate = true;
  }

  CAVE.heaps = [mid, ...heaps].map(({ x, z, R, H, tiers }) => ({ x, z, R, H, tiers, mid: x === X && z === Z }));
  B.build();
  // from inside, nothing of the world below is drawn
  W.sealed(X, Z, 60, Y - 60, Y + 60, 0);
  // the green edge of the screen while the camera is in here (index.html: #lichvig)
  const vig = document.getElementById("lichvig");
  let last = 0, arcT = 2, arcOn = 0, arcRe = 0, pulseT = 3, vigO = -1;
  W.tick((t, cam) => {
    const inside = !!cam && lichCaveAt(cam);
    grp.visible = !!cam && cam.y > Y - 100 && Math.hypot(cam.x - X, cam.z - Z) < 150;
    const vo = Math.round((inside || 0) * 20) / 20;
    if (vig && vo !== vigO) { vigO = vo; vig.style.opacity = vo; }
    const dt = Math.min(0.1, Math.max(0, t - last));
    last = t;
    if (!grp.visible) return;
    const fx = CAVE.fx;
    fx.flash = Math.max(0, fx.flash - dt * 2);
    const dim = 1 - 0.8 * fx.dark; // ("Fall": the fires go down)
    const flick = (0.85 + 0.1 * Math.sin(t * 8.3) + 0.05 * Math.sin(t * 21.1)) * dim;
    flameMat.color.setHex(0x7dff5a).multiplyScalar(flick);
    coreMat.color.setHex(0xe6ffd0).multiplyScalar(flick);
    glows.mat.uniforms.time.value = souls.mat.uniforms.time.value = t;
    glows.mat.uniforms.uH.value = souls.mat.uniforms.uH.value = innerHeight * Math.min(devicePixelRatio, 1.5) * 0.5;
    crackMat.uniforms.time.value = t;
    crackMat.uniforms.pulse.value = fx.flash * 0.8 - fx.dark * 0.15;
    circle.rotation.y = t * 0.08;
    circleMat.color.setHex(0x4dff4a).multiplyScalar((0.55 + 0.25 * Math.sin(t * 1.6)) * dim + fx.flash * 1.2);
    shaftMat.uniforms.time.value = t;
    ooze.offset.set(Math.sin(t * 0.3) * 0.2, t * 0.05);
    mists[0].material.map.offset.set(t * 0.012, t * 0.006);
    mists[1].material.map.offset.set(-t * 0.009, t * 0.011);
    // the heartbeat: a ring of light runs out from the middle
    pulseT -= dt;
    if (pulseT < 0) { pulseT = 6.5; fx.flash = Math.max(fx.flash, 0.6); }
    const pk = Math.min(1, (6.5 - pulseT) / 2.6);
    pulseRing.scale.setScalar(3 + pk * 25);
    pulseMat.opacity = (1 - pk) * 0.7;
    pulseRing.visible = pk < 1;
    // motes rise, bubbles pop, dust sinks through the light
    for (let i = 0; i < MN; i++) {
      const m = mote[i];
      m.y += m.v * dt;
      let f;
      if (m.kind === 1) { if (m.y > 0.6) m.y -= 0.6; f = Math.sin((m.y / 0.6) * Math.PI) * 1.2; }
      else if (m.kind === 2) { if (m.y < 0) m.y += 16; f = 0.35 * Math.sin((m.y / 16) * Math.PI) * (0.6 + 0.4 * Math.sin(t * 2 + m.ph)); }
      else { if (m.y > 18) m.y -= 18; f = Math.sin((m.y / 18) * Math.PI) * (0.6 + 0.4 * Math.sin(t * 3 + m.ph)); }
      const sw = m.kind === 1 ? 0 : 0.5;
      mPos.set([m.x + Math.sin(t * 0.7 + m.ph) * sw, m.y, m.z + Math.cos(t * 0.6 + m.ph) * sw], i * 3);
      mCol.set([m.c.r * f, m.c.g * f, m.c.b * f], i * 3);
    }
    mGeo.attributes.position.needsUpdate = true;
    mGeo.attributes.color.needsUpdate = true;
    // souls spiral in; when one reaches the book, the circle blazes
    soul.forEach((o, si) => {
      o.t += dt / o.dur;
      if (o.t >= 1) { fx.flash = Math.max(fx.flash, 0.5); launch(o); }
      const e = Math.max(0, o.t), k = e * e * (3 - 2 * e), rad = (1 - k) * 2.2, a = o.a + k * 9;
      _v.lerpVectors(o.s, BOOK, k);
      _v.x += Math.sin(a) * rad; _v.z += Math.cos(a) * rad; _v.y += Math.sin(k * Math.PI) * 2.5;
      if (o.t >= 0) { o.hist.unshift(_v.clone()); if (o.hist.length > TRAIL) o.hist.pop(); }
      const fade = Math.min(1, e * 6) * (1 - smooth(0.85, 1, e));
      for (let j = 0; j < TRAIL; j++) {
        const h = o.hist[j], idx = si * TRAIL + j;
        if (!h) { souls.set(idx, 0, -1000, 0, 0, 0, 0, 0); continue; }
        const f = fade * (1 - j / TRAIL);
        souls.set(idx, h.x, h.y, h.z, (j ? 0.7 : 1.1) * (1 - j / TRAIL * 0.6), 0.55 * f, 0.9 * f, 0.75 * f);
      }
    });
    // the skulls circling him (and their eyes)
    orbiters.forEach((g, i) => {
      const a = t * 0.7 + (i / 3) * TAU, y = 4.1 + Math.sin(t * 1.8 + i * 2) * 0.35;
      g.position.set(Math.sin(a) * 3.1, y, Math.cos(a) * 3.1);
      g.rotation.set(0.15 * Math.sin(t * 2 + i), a + Math.PI / 2, 0);
      const fw = a + Math.PI / 2, ex = X + g.position.x + Math.sin(fw) * 0.22, ez = Z + g.position.z + Math.cos(fw) * 0.22;
      const f = 0.8 + 0.2 * Math.sin(t * 11 + i * 3);
      const rx = Math.cos(fw) * 0.12, rz = -Math.sin(fw) * 0.12;
      souls.set(SOULS * TRAIL + i * 2, ex + rx, Y + y + 0.02, ez + rz, 0.7, 0.35 * f, 1 * f, 0.3 * f);
      souls.set(SOULS * TRAIL + i * 2 + 1, ex - rx, Y + y + 0.02, ez - rz, 0.7, 0.35 * f, 1 * f, 0.3 * f);
    });
    souls.pts.geometry.attributes.position.needsUpdate = souls.pts.geometry.attributes.tint.needsUpdate = souls.pts.geometry.attributes.size.needsUpdate = true;
    // lightning: bursts now and then, re-drawn every few frames while they last
    arcT -= dt;
    if (arcT < 0) { arcT = 1.4 + r() * 2.2; arcOn = 0.3 + r() * 0.3; fx.flash = Math.max(fx.flash, 0.7); }
    arcOn -= dt;
    arcCore.visible = arcHalo.visible = arcOn > 0;
    if (arcOn > 0) {
      arcRe -= dt;
      if (arcRe < 0) { arcRe = 0.06; makeArcs(); }
      ribbon(arcCore, 0.045, cam);
      ribbon(arcHalo, 0.22, cam);
    }
  });
}
