// Combat effects: impact stars, shockwave rings, goo puddles, "!" over a slime that
// spots Finn, and the model of the hearts slimes drop. Each kind is a small pool of
// meshes made once and reused; an idle one is hidden, so it costs no draw call.
import * as THREE from "three";
import { noOutline, toon } from "./toon.js";

const basic = (color, o = {}) => noOutline(new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, ...o }));

/** Spiky comic-book star in the x,y plane (points = number of spikes). */
function starGeo(points, r0, r1, jag = 0) {
  const s = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2;
    const r = i % 2 ? r1 : r0 * (1 - jag * ((i * 7) % 3) / 3);
    i ? s.lineTo(Math.sin(a) * r, Math.cos(a) * r) : s.moveTo(0, r);
  }
  return new THREE.ShapeGeometry(s);
}
/** A lumpy splat: a circle with a wobbly edge and a few droplets around it. */
function splatGeo(seed) {
  let k = seed * 9301 + 49297;
  const rnd = () => ((k = (k * 9301 + 49297) % 233280) / 233280);
  const geos = [];
  const s = new THREE.Shape();
  const n = 16;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, r = 0.8 + rnd() * 0.35;
    i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(r, 0);
  }
  geos.push(new THREE.ShapeGeometry(s));
  for (let i = 0; i < 4; i++) {
    const a = rnd() * Math.PI * 2, d = 1.25 + rnd() * 0.5;
    const c = new THREE.CircleGeometry(0.1 + rnd() * 0.14, 8);
    c.translate(Math.cos(a) * d, Math.sin(a) * d, 0);
    geos.push(c);
  }
  const out = mergeFlat(geos);
  out.rotateX(-Math.PI / 2);
  return out;
}
function mergeFlat(geos) {
  const pos = [];
  for (const g of geos) {
    const ng = g.index ? g.toNonIndexed() : g;
    pos.push(...ng.attributes.position.array);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  return out;
}
/** The "!" a slime shows when it spots Finn: a yellow bubble with an inked mark. */
function alertTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d");
  x.lineJoin = "round";
  x.fillStyle = "#ffe14d";
  x.strokeStyle = "#1d2340";
  x.lineWidth = 10;
  x.beginPath();
  x.arc(64, 60, 46, 0, Math.PI * 2);
  x.moveTo(52, 102);
  x.lineTo(64, 124);
  x.lineTo(76, 102);
  x.fill();
  x.stroke();
  x.fillStyle = "#1d2340";
  x.beginPath();
  x.roundRect(55, 26, 18, 44, 8);
  x.arc(64, 84, 9, 0, Math.PI * 2);
  x.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/** Heart pickup: an extruded, bevelled heart, standing up (faces +z). */
export function heartGeo() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.42);
  s.bezierCurveTo(-0.08, -0.3, -0.5, -0.08, -0.5, 0.16);
  s.bezierCurveTo(-0.5, 0.4, -0.26, 0.5, -0.13, 0.46);
  s.bezierCurveTo(-0.05, 0.44, 0, 0.36, 0, 0.3);
  s.bezierCurveTo(0, 0.36, 0.05, 0.44, 0.13, 0.46);
  s.bezierCurveTo(0.26, 0.5, 0.5, 0.4, 0.5, 0.16);
  s.bezierCurveTo(0.5, -0.08, 0.08, -0.3, 0, -0.42);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 2, curveSegments: 7 });
  g.translate(0, 0, -0.06);
  return g;
}

export function createFx(scene) {
  // impact stars: a coloured burst behind a white one, always drawn on top, facing the camera
  const STAR_A = starGeo(8, 1, 0.45, 0.35), STAR_B = starGeo(8, 0.62, 0.3);
  const stars = [];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group();
    const outer = new THREE.Mesh(STAR_A, basic(0xffd23f, { depthTest: false }));
    const inner = new THREE.Mesh(STAR_B, basic(0xffffff, { depthTest: false }));
    inner.position.z = 0.01;
    outer.renderOrder = inner.renderOrder = 5;
    g.add(outer, inner);
    g.visible = false;
    scene.add(g);
    stars.push({ g, outer, inner, t: 1, life: 0.16, size: 1, spin: 0 });
  }
  // shockwaves on the ground
  const RING = new THREE.RingGeometry(0.82, 1, 48).rotateX(-Math.PI / 2);
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(RING, basic(0xffffff, { polygonOffset: true, polygonOffsetFactor: -3 }));
    m.visible = false;
    m.renderOrder = 3;
    scene.add(m);
    rings.push({ m, t: 1, life: 0.5, r0: 0.5, r1: 5 });
  }
  // goo splats left where a slime pops
  const SPLATS = [0, 1, 2].map(splatGeo);
  const puddles = [];
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(SPLATS[i % 3], basic(0xffffff, { polygonOffset: true, polygonOffsetFactor: -2 }));
    m.visible = false;
    scene.add(m);
    puddles.push({ m, t: 99, life: 7, r: 1 });
  }
  // "!" over a slime's head
  const alertMat = new THREE.SpriteMaterial({ map: alertTexture(), transparent: true, depthWrite: false });
  const alerts = [];
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Sprite(alertMat.clone());
    s.visible = false;
    s.renderOrder = 4;
    scene.add(s);
    alerts.push({ s, t: 9, life: 0.9, follow: null, h: 2 });
  }
  let si = 0, ri = 0, pi = 0, ai = 0;
  const _c = new THREE.Vector3();

  return {
    /** Impact flash at (x, y, z); size in world units, color of the outer burst. */
    star(x, y, z, size = 1, color = 0xffd23f) {
      const s = stars[si];
      si = (si + 1) % stars.length;
      s.g.position.set(x, y, z);
      s.outer.material.color.setHex(color);
      s.t = 0;
      s.size = size;
      s.spin = Math.random() * Math.PI;
      s.g.visible = true;
    },
    ring(x, y, z, r1 = 5, color = 0xffffff, life = 0.5) {
      const r = rings[ri];
      ri = (ri + 1) % rings.length;
      r.m.position.set(x, y + 0.08, z);
      r.m.material.color.setHex(color);
      r.t = 0;
      r.life = life;
      r.r1 = r1;
      r.m.visible = true;
    },
    puddle(x, y, z, r = 1, color = 0x6fdc6f) {
      const p = puddles[pi];
      pi = (pi + 1) % puddles.length;
      p.m.position.set(x, y + 0.03, z);
      p.m.rotation.y = Math.random() * Math.PI * 2;
      p.m.material.color.setHex(color).multiplyScalar(0.85);
      p.t = 0;
      p.r = r;
      p.m.visible = true;
    },
    /** "!" riding above `obj` (anything with a position) at height h. */
    alert(obj, h = 2) {
      const a = alerts[ai];
      ai = (ai + 1) % alerts.length;
      a.follow = obj;
      a.h = h;
      a.t = 0;
      a.s.visible = true;
    },
    update(dt, camera) {
      for (const s of stars) {
        if (!s.g.visible) continue;
        s.t += dt / s.life;
        if (s.t >= 1) { s.g.visible = false; continue; }
        // pops out fast, then shrinks away
        const k = s.t < 0.3 ? s.t / 0.3 : 1 - (s.t - 0.3) / 0.7;
        s.g.quaternion.copy(camera.quaternion);
        s.g.rotateZ(s.spin + s.t * 0.6);
        s.g.scale.setScalar(s.size * (0.35 + 0.85 * k));
        s.outer.material.opacity = s.inner.material.opacity = Math.min(1, 2.2 * (1 - s.t));
      }
      for (const r of rings) {
        if (!r.m.visible) continue;
        r.t += dt / r.life;
        if (r.t >= 1) { r.m.visible = false; continue; }
        const e = 1 - (1 - r.t) ** 3;
        r.m.scale.setScalar(r.r0 + (r.r1 - r.r0) * e);
        r.m.material.opacity = 0.9 * (1 - r.t);
      }
      for (const p of puddles) {
        if (!p.m.visible) continue;
        p.t += dt;
        if (p.t >= p.life) { p.m.visible = false; continue; }
        // splats out with a little overshoot, then soaks into the ground
        const u = Math.min(1, p.t / 0.18);
        p.m.scale.setScalar(p.r * (u < 1 ? 1.15 * Math.sin(u * Math.PI * 0.5) : 1 + 0.15 * Math.max(0, 1 - (p.t - 0.18) / 0.25)));
        p.m.material.opacity = 0.85 * Math.min(1, (p.life - p.t) / 2.5);
      }
      for (const a of alerts) {
        if (!a.s.visible) continue;
        a.t += dt;
        if (a.t >= a.life || !a.follow) { a.s.visible = false; continue; }
        const u = a.t / 0.14;
        const pop = u < 1 ? 1.25 * Math.sin(u * Math.PI * 0.5) : 1 + 0.25 * Math.max(0, 1 - (a.t - 0.14) / 0.12);
        _c.copy(a.follow.position);
        a.s.position.set(_c.x, _c.y + a.h + 0.15 * Math.sin(Math.min(1, a.t / 0.3) * Math.PI), _c.z);
        a.s.scale.setScalar(0.85 * pop);
        a.s.material.opacity = Math.min(1, (a.life - a.t) / 0.15);
      }
    },
  };
}

const HEART = heartGeo();
/** A heart pickup mesh: toon red with an ink outline. */
export function makeHeartPickup() {
  const m = new THREE.Mesh(HEART, toon(0xff4d6d, { thick: 0.006, emissive: 0x5a0a1a }));
  m.scale.setScalar(0.55);
  return m;
}
