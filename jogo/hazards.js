// Area attacks shared by the bosses (boss.js, butler.js, flameking.js, lichboss.js). Each one marks its ground
// first in the boss's warning colour: a circle, a ring (safe only inside its hole), a fan or a band.
// The fill grows toward the far edge and the attack lands when it gets there; the hit is checked at
// that instant, on a slightly smaller shape than the one drawn. A circle can have occluders (`occ`:
// columns): the blast comes from its centre and their shade is left out, drawn and checked (a bit
// wider than drawn). Stepped with the physics dt.
import * as THREE from "three";
import { noOutline } from "./toon.js";

export const CIRCLE = 0, RING = 1, SECTOR = 2, BAND = 3;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// a flat quad whose shader draws the shape; uClip (x, z, r in world units, r 0 = off) cuts it to
// the arena so a ring as big as the whole floor doesn't hang out over the edge
const MARK_VS = `
varying vec2 vP;
varying vec2 vW;
void main() {
  vP = position.xz;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const MARK_FS = `
uniform vec3 uColor;
uniform float uShape;
uniform float uR;
uniform float uInner;
uniform float uHalf;
uniform float uProg;
uniform float uAlpha;
uniform float uFlash;
uniform float uTime;
uniform vec3 uClip;
uniform vec2 uC;
uniform vec4 uOcc[8];
uniform float uOccN;
varying vec2 vP;
varying vec2 vW;
void main() {
  if (uClip.z > 0.0 && length(vW - uClip.xy) > uClip.z) discard;
  // the shade of the columns (uOcc: x, z, radius), seen from the blast at uC: it glows pale (safe)
  float shadeEdge = 1e3;
  vec2 q = vW - uC;
  float qd = length(q);
  for (int i = 0; i < 8; i++) {
    if (float(i) >= uOccN) break;
    vec2 p = uOcc[i].xy - uC;
    float pd = length(p);
    if (qd < pd || pd < 0.1) continue;
    float s = (acos(clamp(dot(p, q) / (pd * qd), -1.0, 1.0)) - asin(min(1.0, uOcc[i].z / pd))) * qd;
    if (s < 0.0) {
      float glow = 0.2 + 0.1 * sin(uTime * 6.0) + 0.35 * (1.0 - smoothstep(0.0, 0.35, -s));
      gl_FragColor = vec4(vec3(0.8, 0.96, 1.0), glow * uAlpha * (1.0 - uFlash));
      #include <colorspace_fragment>
      return;
    }
    shadeEdge = min(shadeEdge, s);
  }
  float d = length(vP);
  float edge;
  float f;
  float len = uR;
  if (uShape > 2.5) {
    // a band: vP.x across (half-width uInner), vP.y along (half-length uR), filling from its start
    vec2 q = abs(vP);
    edge = min((1.0 - q.x) * uInner, (1.0 - q.y) * uR);
    f = (vP.y + 1.0) * 0.5;
    len = 2.0 * uR;
  } else {
    if (d > 1.0) discard;
    if (uShape < 0.5) {
      edge = min((1.0 - d) * uR, shadeEdge);
      f = d;
    } else if (uShape < 1.5) {
      if (d < uInner) discard;
      edge = min(1.0 - d, d - uInner) * uR;
      f = (d - uInner) / (1.0 - uInner);
    } else {
      float a = abs(atan(vP.x, vP.y));
      if (a > uHalf) discard;
      edge = min((1.0 - d) * uR, d * uR * sin(uHalf - a));
      f = d;
    }
  }
  float rim = 1.0 - smoothstep(0.1, 0.28, edge);
  float fill = step(f, uProg);
  float front = (1.0 - smoothstep(0.0, 0.1, abs(f - uProg) * len)) * step(0.001, uProg);
  float pulse = 0.72 + 0.28 * sin(uTime * (7.0 + 16.0 * uProg));
  float a = 0.1 + 0.24 * fill + rim * pulse + front * 0.45;
  vec3 c = mix(uColor, vec3(1.0, 0.93, 0.8), rim * 0.35 + uFlash);
  gl_FragColor = vec4(c, clamp(a + uFlash * 0.6, 0.0, 1.0) * uAlpha);
  #include <colorspace_fragment>
}`;

/**
 * o: player (main.js: pos, vel, heading, dead), y (the arena floor), center { x, z }, reach (how far
 * from the centre aimed and chasing markers may go), color (warning colour), clip (radius markers are
 * cut to, 0: none), high (Finn this far above the floor is jumping over it), n (markers in the pool),
 * live() (do hits count right now?), hit(h, nx, nz) (Finn is caught: knock him along nx, nz).
 * A hazard: { shape, x, z, r, inner (ring hole), half (fan), a (fan / band direction), w (band
 * half-width), warn, delay, follow + chase (it chases Finn for `follow` s, then locks), aim (a
 * function giving { x, z } when the marker appears), occ (a circle's occluders, up to 8 { x, z, r }),
 * harmless (only a warning: what hits comes after), y (its own floor: a marker up on a heap of skulls in
 * the Lich's cave; default o.y), high (its own jump-over height; default o.high), onFire(h) }. A band starts at (x, z), r long.
 */
export function createHazards(scene, o) {
  const pl = o.player.pos, list = [], marks = [], high = o.high ?? 3, C = o.center;
  const geo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  const base = new THREE.ShaderMaterial({
    vertexShader: MARK_VS, fragmentShader: MARK_FS, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    uniforms: {
      uColor: { value: new THREE.Color() }, uShape: { value: 0 }, uR: { value: 1 }, uInner: { value: 0 }, uHalf: { value: 0.5 },
      uProg: { value: 0 }, uAlpha: { value: 0 }, uFlash: { value: 0 }, uTime: { value: 0 }, uClip: { value: new THREE.Vector3() },
      uC: { value: new THREE.Vector2() }, uOcc: { value: [] }, uOccN: { value: 0 },
    },
  });
  for (let i = 0; i < (o.n || 16); i++) {
    const m = new THREE.Mesh(geo, noOutline(base.clone()));
    m.material.uniforms.uOcc.value = Array.from({ length: 8 }, () => new THREE.Vector4());
    m.material.uniforms.uColor.value.setHex(o.color);
    m.material.uniforms.uClip.value.set(C.x, C.z, o.clip || 0);
    m.visible = false;
    m.renderOrder = 2;
    m.frustumCulled = false;
    scene.add(m);
    marks.push({ m, used: false });
  }
  function clampIn(x, z, r) {
    const dx = x - C.x, dz = z - C.z, d = Math.hypot(dx, dz);
    return d > r ? { x: C.x + (dx / d) * r, z: C.z + (dz / d) * r } : { x, z };
  }
  /** Unit vector from (x, z) to Finn (standing right on it: behind where he faces). */
  function away(x, z) {
    const dx = pl.x - x, dz = pl.z - z, d = Math.hypot(dx, dz);
    if (d > 0.05) return [dx / d, dz / d];
    const hd = o.player.heading + Math.PI;
    return [Math.sin(hd), Math.cos(hd)];
  }
  function add(p) {
    const h = { shape: CIRCLE, r: 2, inner: 0, half: 0.5, a: 0, w: 1, warn: 1, delay: 0, follow: 0, chase: 0, aim: null, t: 0, fired: false, after: 0, mark: null, x: 0, z: 0, ...p };
    list.push(h);
    return h;
  }
  function takeMark() {
    const k = marks.find((m) => !m.used);
    if (k) k.used = true;
    return k || null;
  }
  /** Is Finn in the shade of one of h.occ from the blast at h's centre? (His body counts: a bit wider than drawn.) */
  function shaded(h) {
    const dx = pl.x - h.x, dz = pl.z - h.z, d = Math.hypot(dx, dz);
    for (const c of h.occ) {
      const px = c.x - h.x, pz = c.z - h.z, pd = Math.hypot(px, pz);
      if (d < pd || pd < c.r + 0.1) continue;
      if (Math.abs(wrap(Math.atan2(dx, dz) - Math.atan2(px, pz))) < Math.asin(Math.min(1, (c.r + 0.3) / pd))) return true;
    }
    return false;
  }
  function inside(h) {
    const dx = pl.x - h.x, dz = pl.z - h.z, d = Math.hypot(dx, dz);
    if (pl.y > (h.y ?? o.y) + (h.high ?? high)) return false;
    if (h.shape === CIRCLE) return d < h.r - 0.1 && !(h.occ && shaded(h));
    if (h.shape === RING) return d > h.inner + 0.1;
    if (h.shape === BAND) {
      const along = dx * Math.sin(h.a) + dz * Math.cos(h.a), across = dx * Math.cos(h.a) - dz * Math.sin(h.a);
      return along > -0.2 && along < h.r - 0.1 && Math.abs(across) < h.w - 0.1;
    }
    if (d < 0.8) return true;
    return d < h.r - 0.1 && Math.abs(wrap(Math.atan2(dx, dz) - h.a)) < h.half - 0.04;
  }
  /** Which way a blow from h throws Finn: out of the circle, into the ring's hole, along the fan, off the band's side. */
  function push(h) {
    const [ox, oz] = away(h.x, h.z);
    if (h.shape === RING) return [-ox, -oz];
    if (h.shape === SECTOR) return [Math.sin(h.a), Math.cos(h.a)];
    if (h.shape === BAND) {
      const cx = Math.cos(h.a), cz = -Math.sin(h.a), s = (pl.x - h.x) * cx + (pl.z - h.z) * cz >= 0 ? 1 : -1;
      return [cx * s, cz * s];
    }
    return [ox, oz];
  }
  function release(i) {
    const h = list[i];
    if (h.mark) h.mark.used = false;
    list.splice(i, 1);
  }
  function step(dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const h = list[i];
      if (!h) continue; // a hit that made Finn faint called everything off (the list emptied under us)
      h.t += dt;
      if (h.t < h.delay) continue;
      if (!h.mark && !h.fired) {
        h.mark = takeMark();
        if (h.aim) { const q = h.aim(); h.x = q.x; h.z = q.z; }
      }
      const t = h.t - h.delay;
      if (h.chase && t < h.follow) {
        // the marker chases Finn until it locks
        const dx = pl.x - h.x, dz = pl.z - h.z, d = Math.hypot(dx, dz), st = Math.min(d, h.chase * dt);
        if (d > 0.01) { h.x += (dx / d) * st; h.z += (dz / d) * st; }
        const q = clampIn(h.x, h.z, o.reach);
        h.x = q.x;
        h.z = q.z;
      }
      if (!h.fired && t >= h.follow + h.warn) {
        h.fired = true;
        if (!h.harmless && o.live() && o.player.dead <= 0 && inside(h)) {
          const [nx, nz] = push(h);
          o.hit(h, nx, nz);
        }
        if (h.onFire) h.onFire(h);
      }
      if (h.fired) {
        h.after += dt;
        if (h.after > 0.3) release(i);
      }
    }
  }
  function draw(t) {
    for (const k of marks) k.m.visible = false;
    for (const h of list) {
      if (!h.mark) continue;
      const m = h.mark.m, u = m.material.uniforms, lt = h.t - h.delay, band = h.shape === BAND;
      m.visible = true;
      m.rotation.y = h.shape === SECTOR || band ? h.a : 0;
      if (band) {
        m.position.set(h.x + Math.sin(h.a) * h.r * 0.5, (h.y ?? o.y) + 0.08, h.z + Math.cos(h.a) * h.r * 0.5);
        m.scale.set(h.w, 1, h.r * 0.5);
        u.uR.value = h.r * 0.5;
        u.uInner.value = h.w;
      } else {
        m.position.set(h.x, (h.y ?? o.y) + 0.08, h.z);
        m.scale.set(h.r, 1, h.r);
        u.uR.value = h.r;
        u.uInner.value = h.inner / h.r;
      }
      u.uShape.value = h.shape;
      u.uOccN.value = h.occ ? Math.min(8, h.occ.length) : 0;
      if (h.occ) {
        u.uC.value.set(h.x, h.z);
        for (let i = 0; i < u.uOccN.value; i++) u.uOcc.value[i].set(h.occ[i].x, h.occ[i].z, h.occ[i].r, 1);
      }
      u.uHalf.value = h.half;
      u.uTime.value = t;
      u.uProg.value = lt < h.follow ? 0 : clamp((lt - h.follow) / h.warn, 0, 1);
      u.uFlash.value = h.fired ? Math.max(0, 1 - h.after / 0.12) : 0;
      u.uAlpha.value = h.fired ? Math.max(0, 1 - h.after / 0.3) : clamp(lt / 0.12, 0, 1) * (lt < h.follow ? 0.75 : 1);
    }
  }
  return {
    list, add, step, draw, away, clampIn, shaded,
    /** Everything called off at once (the fight ended). */
    cancel() {
      for (const h of list) if (h.mark) h.mark.used = false;
      list.length = 0;
    },
    /** One hazard called off before it lands (what cast it is gone). */
    remove(h) {
      const i = list.indexOf(h);
      if (i >= 0) release(i);
    },
  };
}
