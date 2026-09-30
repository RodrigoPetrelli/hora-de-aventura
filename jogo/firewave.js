// Finn's Fire Wave (F): the power the Flame Heart gives him once the Flame King is beaten. A forward
// cut sets his sword alight and sends a crescent of fire running along the floor at the foe ahead.
// It climbs steps and slopes, goes through every foe in its way (each takes the blow once) and dies
// against a wall, off a ledge, in water (a puff of steam) or at the end of its run. main.js starts the
// cut (swing 4 in SWING / ATK), launches the wave when the blade comes down, and says what it hits.
import * as THREE from "three";
import { noOutline } from "./toon.js";
import { FIRE_VS, FIRE_FS, NOISE, HOT } from "./flameking.js";
import { supportAt, resolveXZ } from "./physics.js";
import { waterInfo } from "./terrain.js";

// speed (u/s), run (u), crescent: radius and half-angle (rad), height; it grows along the run (grow);
// it climbs up to `climb` a step and dies off a drop deeper than `drop`
export const WAVE = { speed: 22, range: 17, start: 0.6, R: 2.8, arc: 0.8, h: 2.4, grow: 0.5, climb: 1.1, drop: 1.6 };
const FIRE = [0xff5a1a, 0xffb13b, 0xffe08a];
const STEAM = [0xffffff, 0xdfe8ee, 0xb8c6ce];
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// the crest: tongues of flame like the Flame King's walls (FIRE_FS), but faded by the instance
// colour's red (alpha, so it stays fire-coloured over bright grass) and frayed at the arc's tips
const WAVE_FS = `
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
  float n = vnoise(vec2(vUv.x * uRep, y * 3.0 - uTime * 3.4), uRep) * 0.6 + vnoise(vec2(vUv.x * uRep * 2.3, y * 7.0 - uTime * 5.2), uRep * 2.3) * 0.4;
  float tips = smoothstep(0.0, 0.16, vUv.x) * (1.0 - smoothstep(0.84, 1.0, vUv.x));
  float a = smoothstep(0.0, 0.05, y) * (1.0 - smoothstep(0.2 * tips, 1.0, y + (n - 0.5) * 0.7 + (1.0 - tips) * 0.4));
  a *= smoothstep(0.24, 0.56, n + 0.25 * (1.0 - y)) * smoothstep(0.05, 0.35, vRim);
  float heat = (1.0 - y) * 0.55 + vRim * 0.35 + (n - 0.5) * 0.5;
  vec3 c = mix(uEdge, uCore, smoothstep(0.4, 0.95, heat));
  gl_FragColor = vec4(c, clamp(a * vTint.r, 0.0, 1.0));
  #include <colorspace_fragment>
}`;

/**
 * api (main.js): burst(x, y, z, n, colors, speed, up, g, life), sfx, fx, foes() → [{ o, x, y, z, r }]
 * (what the wave can hit right now), hit(o, nx, nz, n) (n: foes this wave hit so far, this one included).
 */
export function createFireWave(scene, api) {
  const TIME = { value: 0 };
  const flameMat = (fs, core, edge, blending, rep) => noOutline(new THREE.ShaderMaterial({
    vertexShader: FIRE_VS, fragmentShader: fs, transparent: true, depthWrite: false, blending, side: THREE.DoubleSide,
    uniforms: { uTime: TIME, uRep: { value: rep }, uCore: { value: new THREE.Color(core) }, uEdge: { value: new THREE.Color(edge) } },
  }));
  // the crescents: an arc of open cylinder facing +z, leaning back a little as it runs. Each wave is
  // a red-orange flame and, just behind it, a lower white-hot core that glows (additive)
  const N = 3;
  const geo = new THREE.CylinderGeometry(0.82, 1, 1, 20, 1, true, -WAVE.arc, 2 * WAVE.arc).translate(0, 0.5, 0);
  const CRESTS = [
    { mesh: new THREE.InstancedMesh(geo, flameMat(WAVE_FS, 0xffb030, 0xd8300a, THREE.NormalBlending, 6), N), r: 1, h: 1, a: 1 },
    { mesh: new THREE.InstancedMesh(geo, flameMat(WAVE_FS, 0xfff0b0, 0xff6a10, THREE.AdditiveBlending, 5), N), r: 0.9, h: 0.68, a: 1.2 },
  ];
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _o = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _y = new THREE.Vector3(0, 1, 0);
  for (const { mesh } of CRESTS) {
    for (let i = 0; i < N; i++) { mesh.setMatrixAt(i, _m4.makeScale(0, 0, 0)); mesh.setColorAt(i, _c.setRGB(0, 0, 0)); }
    mesh.frustumCulled = false;
    mesh.visible = false;
    mesh.renderOrder = 5;
    scene.add(mesh);
  }
  // the floor glowing under it: a flat band of the same arc, brightest at the front (one mesh per wave: its opacity fades it)
  const floorGeo = new THREE.RingGeometry(0.4, 1.02, 20, 1, -Math.PI / 2 - WAVE.arc, 2 * WAVE.arc).rotateX(-Math.PI / 2);
  const fp = floorGeo.attributes.position, fcol = new Float32Array(fp.count * 4);
  for (let i = 0; i < fp.count; i++) fcol.set([1, 0.42, 0.08, 0.6 * smooth(0.4, 1.02, Math.hypot(fp.getX(i), fp.getZ(i))) ** 1.5], i * 4);
  floorGeo.setAttribute("color", new THREE.BufferAttribute(fcol, 4));
  const floors = [];
  for (let i = 0; i < N; i++) {
    const m = new THREE.Mesh(floorGeo, noOutline(new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -4,
    })));
    m.visible = false;
    m.renderOrder = 4;
    scene.add(m);
    floors.push(m);
  }
  const waves = [];
  for (let i = 0; i < N; i++) waves.push({ on: false, fade: 0, t: 0, ox: 0, oz: 0, dx: 0, dz: 1, dist: 0, pdist: 0, y: 0, py: 0, hits: [] });

  // the sword catching fire: a sleeve of flame round the blade, growing from the guard
  const sleeves = [];
  const sleeveGeo = new THREE.CylinderGeometry(0.03, 0.075, 0.72, 10, 1, true).translate(0, 0.36, 0);
  const sleeveMat = flameMat(FIRE_FS, HOT[0][0], HOT[0][1], THREE.AdditiveBlending, 3);
  function attach(finn) {
    for (const s of Object.values(finn.userData.swords)) {
      const m = new THREE.Mesh(sleeveGeo, sleeveMat);
      m.position.y = 0.08;
      m.visible = false;
      m.renderOrder = 5;
      s.add(m);
      sleeves.push(m);
    }
  }
  /** How much the sword burns (0..1). */
  function sword(k) {
    for (const m of sleeves) {
      m.visible = k > 0.01;
      m.scale.set(0.6 + 0.4 * k, k, 0.6 + 0.4 * k);
    }
  }

  const grow = (dist) => 1 + WAVE.grow * Math.min(1, dist / WAVE.range);
  /** A wave running from (x, z) (Finn's feet, at height y) along (dx, dz). */
  function launch(x, y, z, dx, dz) {
    const w = waves.find((k) => !k.on && k.fade <= 0) || waves.find((k) => !k.on) || waves[0];
    const d = WAVE.start, fx = x + dx * d, fz = z + dz * d, gy = supportAt(fx, fz, 0.3, y + 0.6);
    Object.assign(w, { on: true, fade: 0, t: 0, ox: x, oz: z, dx, dz, dist: d, pdist: d, y: gy, py: gy });
    w.hits.length = 0;
    api.burst(fx, gy + 0.3, fz, 22, FIRE.concat(0xffffff), 7, 5, 0.4, 0.7);
  }
  /** Where the middle of the crescent's front is (dist along the run). */
  const front = (w, dist) => _p.set(w.ox + w.dx * dist, 0, w.oz + w.dz * dist);
  function end(w, why) {
    w.on = false;
    w.fade = 0.2;
    w.why = why; // (for debug/: out, wall, drop, water)
    const p = front(w, w.dist);
    if (why === "water") {
      api.burst(p.x, w.y + 0.4, p.z, 24, STEAM, 4, 6, -0.25, 1.1);
      api.sfx("fizzle");
    } else if (why === "wall") {
      api.burst(p.x - w.dx * 0.3, w.y + 0.8, p.z - w.dz * 0.3, 18, FIRE.concat(0xffffff), 6, 5, 0.3, 0.6);
      api.fx.star(p.x - w.dx * 0.4, w.y + 0.9, p.z - w.dz * 0.4, 1.2, 0xff8a2a);
      api.sfx("fireHit");
    } else api.burst(p.x, w.y + 0.5, p.z, 12, FIRE, 3, 4, -0.3, 0.8);
  }

  // ── physics (every fixed step) ──
  function step(dt) {
    for (const w of waves) {
      if (w.fade > 0) w.fade -= dt;
      if (!w.on) continue;
      w.t += dt;
      w.pdist = w.dist;
      w.py = w.y;
      const dist = w.dist + WAVE.speed * dt, p = front(w, dist), nx = p.x, nz = p.z;
      // steps and slopes it climbs; a wall, a cliff or a drop ends it; water puts it out
      const sup = supportAt(nx, nz, 0.3, w.y + WAVE.climb);
      if (sup > w.y + WAVE.climb) { end(w, "wall"); continue; }
      if (sup < w.y - WAVE.drop) { end(w, "drop"); continue; }
      p.y = 0;
      resolveXZ(p, 0.3, sup, sup + 1.4, null);
      if (Math.hypot(p.x - nx, p.z - nz) > 0.02) { end(w, "wall"); continue; }
      const wi = waterInfo(nx, nz);
      if (wi.d < 0 && sup < wi.L) { end(w, "water"); continue; }
      w.dist = dist;
      w.y = sup;
      // whatever the crescent's front swept over since the last step (the arc lags at its tips)
      const R = WAVE.R * grow(w.dist), half = R * Math.sin(WAVE.arc);
      for (const f of api.foes()) {
        if (w.hits.includes(f.o)) continue;
        const rx = f.x - w.ox, rz = f.z - w.oz, along = rx * w.dx + rz * w.dz, side = Math.abs(rx * w.dz - rz * w.dx);
        if (side > half + f.r || f.y < w.y - 1.6 || f.y > w.y + 3.5) continue;
        const lag = R - Math.sqrt(R * R - Math.min(side, half) ** 2);
        if (along > w.dist - lag + f.r || along < w.pdist - lag - 0.9 - f.r) continue;
        w.hits.push(f.o);
        api.hit(f.o, w.dx, w.dz, w.hits.length);
      }
      // embers off its crest
      const a = (Math.random() * 2 - 1) * WAVE.arc, cx = nx - w.dx * R, cz = nz - w.dz * R;
      const ex = cx + R * (Math.sin(a) * w.dz + Math.cos(a) * w.dx), ez = cz + R * (-Math.sin(a) * w.dx + Math.cos(a) * w.dz);
      api.burst(ex, w.y + 0.4 + Math.random() * WAVE.h * 0.6, ez, 1, FIRE, 1.5, 2.5, -0.35, 0.6);
      if (w.dist >= WAVE.range) end(w, "out");
    }
  }

  // ── every rendered frame ──
  function update(dt, alpha, time) {
    TIME.value = time;
    let any = false;
    for (let i = 0; i < N; i++) {
      const w = waves[i], shown = w.on || w.fade > 0;
      any ||= shown;
      floors[i].visible = shown;
      if (!shown) {
        for (const c of CRESTS) c.mesh.setMatrixAt(i, _m4.makeScale(0, 0, 0));
        continue;
      }
      const dist = w.on ? w.pdist + (w.dist - w.pdist) * alpha : w.dist, y = w.on ? w.py + (w.y - w.py) * alpha : w.y;
      // it rises out of the floor, and sinks back into it at the end of its run (or when it dies)
      const k = Math.min(1, w.t / 0.06) * (w.on ? 1 - smooth(WAVE.range * 0.82, WAVE.range, dist) * 0.7 : Math.max(0, w.fade / 0.2));
      const R = WAVE.R * grow(dist), f = front(w, dist);
      _q.setFromAxisAngle(_y, Math.atan2(w.dx, w.dz));
      _o.set(f.x - w.dx * R, y - 0.05, f.z - w.dz * R);
      for (const c of CRESTS) {
        c.mesh.setMatrixAt(i, _m4.compose(_o, _q, _s.set(R * c.r, WAVE.h * c.h * (0.35 + 0.65 * k), R * c.r)));
        c.mesh.setColorAt(i, _c.setRGB(c.a * k, 0, 0));
      }
      const fl = floors[i];
      fl.position.set(_o.x, y + 0.12, _o.z);
      fl.quaternion.copy(_q);
      fl.scale.set(R, 1, R);
      fl.material.opacity = k;
    }
    for (const { mesh } of CRESTS) {
      mesh.visible = any;
      if (!any) continue;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    }
  }

  const reset = () => { for (const w of waves) { w.on = false; w.fade = 0; } };
  return { WAVE, waves, launch, step, update, attach, sword, reset, busy: () => waves.some((w) => w.on) };
}
