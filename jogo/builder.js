// Static scenery builder: shapes are transformed and merged into one mesh per
// material (one draw call each), and can register colliders as they go.
// Plain toon materials that differ only in colour share one merged mesh: the
// colour goes into vertex colours. Two layers are culled by distance every frame:
// B.detail(fn) (small props, hidden far from the camera; 90-unit chunks) and B.inside(x, z, r, fn)
// (interiors, drawn only while the camera is within r of the building).
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { boxCollider, cylCollider } from "./physics.js";
import { toon } from "./toon.js";

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);
export function mtx(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
  _e.set(rx, ry, rz, "YXZ");
  _q.setFromEuler(_e);
  _p.set(x, y, z);
  _s.set(sx, sy, sz);
  return _m.compose(_p, _q, _s);
}
/** Matrix that maps a unit Y-axis shape of length 1 onto the segment a→b. */
export function segMtx(a, b, sx = 1, sz = 1) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = d.length();
  _q.setFromUnitVectors(Y, d.normalize());
  _p.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  _s.set(sx, len, sz);
  return _m.compose(_p, _q, _s);
}

const geoCache = new Map();
function cached(key, make) {
  let g = geoCache.get(key);
  if (!g) geoCache.set(key, (g = make()));
  return g;
}
const f2 = (v) => v.toFixed(2);
export const GEO = {
  rbox: (w, h, d, r) => cached(`rb${f2(w)},${f2(h)},${f2(d)},${f2(r)}`, () => {
    const rr = Math.max(0.001, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
    return new RoundedBoxGeometry(w, h, d, 2, rr);
  }),
  sphere: (seg = 12) => cached("s" + seg, () => new THREE.SphereGeometry(1, seg, Math.max(5, (seg * 0.7) | 0))),
  cyl: (rt, rb, seg = 16, open = false, ts = 0, tl = Math.PI * 2) =>
    cached(`c${f2(rt)},${f2(rb)},${seg},${open},${f2(ts)},${f2(tl)}`, () => new THREE.CylinderGeometry(rt, rb, 1, seg, 1, open, ts, tl)),
  cone: (seg = 16) => cached("k" + seg, () => new THREE.ConeGeometry(1, 1, seg)),
  capsule: (r, len, seg = 10) => cached(`p${f2(r)},${f2(len)},${seg}`, () => new THREE.CapsuleGeometry(r, len, seg > 8 ? 3 : 2, seg)),
  torus: (R, r, arc = Math.PI * 2, seg = 24) => cached(`t${f2(R)},${f2(r)},${f2(arc)},${seg}`, () => new THREE.TorusGeometry(R, r, 8, seg, arc)),
  circle: (seg = 24) => cached("o" + seg, () => new THREE.CircleGeometry(1, seg)),
};

/** The shared vertex-colour material standing in for a plain toon material (null: keep it as is). */
function mergedMat(mat) {
  const o = mat.userData.toon;
  return o && !o.vc ? toon(0xffffff, { ...o, vc: true }) : null;
}

export class Builder {
  constructor(scene) {
    this.scene = scene;
    this.groups = new Map();
    this.lay = null;
    this.pin = null;
    this.zones = 0;
    this.culled = []; // meshes shown by distance: userData.cull = { x, z, r, min?, zone? }
    this.statics = []; // everything else, with the centre of its 120-unit chunk
  }
  withLayer(lay, fn) {
    const prev = this.lay;
    this.lay = lay;
    try { fn(); } finally { this.lay = prev; }
  }
  /** Small props: hidden when the camera is farther than `far` from their 90-unit chunk. */
  detail(fn, far = 140) {
    this.withLayer({ far, cell: 90 }, fn);
  }
  /** Level of detail: near() is drawn within `d` of its chunk, far() beyond it (same chunks, no gaps). */
  near(fn, d = 130) {
    this.withLayer({ far: d, cell: 90, exact: true }, fn);
  }
  far(fn, d = 130) {
    this.withLayer({ min: d, cell: 90, exact: true }, fn);
  }
  /** An interior: drawn only while the camera is within r of (x, z). */
  inside(x, z, r, fn) {
    this.withLayer({ zone: { x, z, r }, id: ++this.zones }, fn);
  }
  /** Everything fn adds goes to the chunk of (x, z) (keeps a prop's near and far versions together). */
  pinned(x, z, fn) {
    const prev = this.pin;
    this.pin = [x, z];
    try { fn(); } finally { this.pin = prev; }
  }
  add(geo, mat, m) {
    // stay indexed: shared vertices are shaded once (the GPU's vertex work is the bottleneck here)
    const g = geo.clone();
    if (!g.index) g.setIndex(Array.from({ length: g.attributes.position.count }, (_, i) => i));
    g.applyMatrix4(m);
    const base = mergedMat(mat);
    // group by material AND by world cell (120 units, 60 for details), so off-screen chunks get culled
    const pos = g.attributes.position, lay = this.lay;
    let key = (base || mat).uuid, cell = null;
    if (lay?.zone) key += ":z" + lay.id;
    else {
      const px = this.pin ? this.pin[0] : pos.getX(0), pz = this.pin ? this.pin[1] : pos.getZ(0);
      const cs = lay?.cell ?? 120, cx = Math.floor(px / cs), cz = Math.floor(pz / cs);
      key += ":" + cs + ":" + cx + "," + cz + (lay ? `:${lay.far}:${lay.min}` : "");
      cell = { x: (cx + 0.5) * cs, z: (cz + 0.5) * cs, half: cs * 0.71, size: cs };
    }
    let e = this.groups.get(key);
    if (!e) this.groups.set(key, (e = { mat: base || mat, geos: [], lay, cell }));
    for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    if (base) {
      const c = mat.color, col = new Float32Array(pos.count * 3);
      for (let i = 0; i < col.length; i += 3) { col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b; }
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    }
    g.morphAttributes = {};
    g.clearGroups();
    e.geos.push(g);
  }
  build() {
    let n = 0;
    for (const { mat, geos, lay, cell } of this.groups.values()) {
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      if (lay?.zone) mesh.userData.cull = { x: lay.zone.x, z: lay.zone.z, r: lay.zone.r, zone: true };
      else if (lay) {
        // distances are measured to the chunk centre; plain details add the chunk's half diagonal
        const pad = lay.exact ? 0 : cell.half;
        mesh.userData.cull = { x: cell.x, z: cell.z, r: lay.far !== undefined ? lay.far + pad : Infinity, min: lay.min };
      }
      if (lay) this.culled.push(mesh);
      else {
        mesh.userData.cell = cell;
        this.statics.push(mesh);
      }
      this.scene.add(mesh);
      n++;
    }
    this.groups.clear();
    return n;
  }
  /** Show a mesh built elsewhere only while the camera is within r of (x, z). */
  cullNear(mesh, x, z, r) {
    mesh.userData.cull = { x, z, r, zone: true };
    this.culled.push(mesh);
    return mesh;
  }
  /**
   * Show / hide the distance-culled meshes for this camera position. `view`: how far the camera
   * can see from an enclosed place (Infinity outdoors, 0 in a room with no view outside): details
   * and trees beyond it are hidden, and so are fixed chunks farther than max(view, 30).
   */
  cull(cam, view = Infinity) {
    const v2 = view * view, s2 = Math.max(view, 30) ** 2;
    for (const m of this.culled) {
      const c = m.userData.cull, dx = cam.x - c.x, dz = cam.z - c.z, d2 = dx * dx + dz * dz;
      m.visible = (!!c.zone || d2 < v2) && d2 < c.r * c.r && (c.min === undefined || d2 >= c.min * c.min);
    }
    for (const m of this.statics) {
      const c = m.userData.cell, ex = Math.max(0, Math.abs(cam.x - c.x) - c.size / 2), ez = Math.max(0, Math.abs(cam.z - c.z) - c.size / 2);
      m.visible = view === Infinity || ex * ex + ez * ez < s2;
    }
  }

  // ── shapes. y is the BOTTOM for box/cyl/cone, the CENTRE for sphere ──
  box(x, y, z, w, h, d, mat, o = {}) {
    const r = o.r ?? Math.min(0.12, w * 0.2, h * 0.2, d * 0.2);
    const ry = o.ry || 0;
    this.add(GEO.rbox(w, h, d, r), mat, mtx(x, y + h / 2, z, ry, 1, 1, 1, o.rx || 0, o.rz || 0));
    if (o.solid !== false) {
      const swap = Math.abs(Math.sin(ry)) > 0.7;
      const hw = (swap ? d : w) / 2, hd = (swap ? w : d) / 2;
      boxCollider(x - hw, x + hw, y, y + h, z - hd, z + hd, o.cam ?? true);
    }
  }
  cyl(x, y, z, r, h, mat, o = {}) {
    const rTop = o.rTop ?? r;
    this.add(GEO.cyl(rTop, r, o.seg ?? 16, !!o.open, o.ts ?? 0, o.tl ?? Math.PI * 2), mat, mtx(x, y + h / 2, z, o.ry || 0, o.sx ?? 1, h, o.sz ?? 1, o.rx || 0, o.rz || 0));
    if (o.solid !== false) cylCollider(x, z, Math.max(r, rTop) * (o.cr ?? 1), y, y + h, o.cam ?? true);
  }
  cone(x, y, z, r, h, mat, o = {}) {
    this.add(GEO.cone(o.seg ?? 16), mat, mtx(x, y + h / 2, z, o.ry || 0, r, h, r * (o.sz ?? 1), o.rx || 0, o.rz || 0));
    if (o.solid) cylCollider(x, z, r * 0.7, y, y + h * 0.5, o.cam ?? true);
  }
  sphere(x, y, z, r, mat, o = {}) {
    this.add(GEO.sphere(o.seg ?? 12), mat, mtx(x, y, z, o.ry || 0, r * (o.sx ?? 1), r * (o.sy ?? 1), r * (o.sz ?? 1), o.rx || 0, o.rz || 0));
    if (o.solid) cylCollider(x, z, r * (o.sx ?? 1) * 0.85, y - r * (o.sy ?? 1), y + r * (o.sy ?? 1) * (o.top ?? 0.7), o.cam ?? false);
  }
  /** Capsule between two points a, b ([x,y,z]). */
  capsule(a, b, r, mat, seg = 10) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    this.add(GEO.capsule(r, Math.max(0.01, len), seg), mat, segMtx(a, b, 1, 1).multiply(new THREE.Matrix4().makeScale(1, 1 / Math.max(len, 0.01), 1)));
  }
  /** Rotated box between two points (planks, rails). w across, t thickness. */
  plank(a, b, w, t, mat, roll = 0) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const m = segMtx(a, b, 1, 1).multiply(new THREE.Matrix4().makeScale(1, 1 / Math.max(len, 0.01), 1));
    if (roll) m.multiply(new THREE.Matrix4().makeRotationY(roll));
    this.add(GEO.rbox(w, len, t, Math.min(0.05, t * 0.3)), mat, m);
  }
  tube(points, r, mat, o = {}) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
    this.add(new THREE.TubeGeometry(curve, o.seg ?? 24, r, o.radial ?? 10, !!o.closed), mat, new THREE.Matrix4());
    return curve;
  }
  /** Tapered tube: radius goes r0 → r1 along the curve. */
  branch(points, r0, r1, mat, seg = 20) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
    const geo = new THREE.TubeGeometry(curve, seg, 1, 10, false);
    const pos = geo.attributes.position, n = geo.attributes.normal;
    const ring = 11;
    for (let i = 0; i <= seg; i++) {
      const c = curve.getPointAt(i / seg), r = r0 + (r1 - r0) * (i / seg);
      for (let j = 0; j < ring; j++) {
        const k = i * ring + j;
        pos.setXYZ(k, c.x + n.getX(k) * r, c.y + n.getY(k) * r, c.z + n.getZ(k) * r);
      }
    }
    this.add(geo, mat, new THREE.Matrix4());
    return curve;
  }
  /** Lathe from [[radius, y], ...] around (x, y, z). */
  lathe(profile, mat, x, y, z, o = {}) {
    const geo = new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h)), o.seg ?? 24, o.ps ?? 0, o.pl ?? Math.PI * 2);
    this.add(geo, mat, mtx(x, y, z, o.ry || 0, o.sx ?? 1, o.sy ?? 1, o.sz ?? 1));
  }
  /** Extruded 2D shape lying flat (XZ), bottom at y. Shape Y maps to -Z. */
  slab(shape, depth, mat, x, y, z, ry = 0) {
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 20 });
    this.add(geo, mat, mtx(x, y, z, ry, 1, 1, 1, -Math.PI / 2));
  }
  /** Gable roof prism: ridge along local z, width w, height h, length l. */
  gable(x, y, z, w, h, l, mat, ry = 0) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(0, h);
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: l, bevelEnabled: false });
    geo.translate(0, 0, -l / 2);
    this.add(geo, mat, mtx(x, y, z, ry));
  }
  raw(geo, mat, m = new THREE.Matrix4()) {
    this.add(geo, mat, m);
  }
}

/**
 * Canvas-painted pictures (paintings, posters, signs) sharing one texture and one mesh.
 * items: { x, y, z, ry, w, h, draw(ctx, pw, ph) }: a w × h plane centred at (x, y, z) facing ry
 * (0 = +z). Transparent pixels are cut out (alphaTest), so signs can be letters only.
 */
export function pictures(items, px = 384) {
  const rows = items.map((it) => Math.max(16, Math.round((px * it.h) / it.w)));
  const H = rows.reduce((a, b) => a + b, 0);
  const c = document.createElement("canvas");
  c.width = px;
  c.height = H;
  const ctx = c.getContext("2d");
  const geos = [];
  let y0 = 0;
  items.forEach((it, i) => {
    ctx.save();
    ctx.translate(0, y0);
    ctx.beginPath();
    ctx.rect(0, 0, px, rows[i]);
    ctx.clip();
    it.draw(ctx, px, rows[i]);
    ctx.restore();
    const p = new THREE.PlaneGeometry(it.w, it.h);
    const uv = p.attributes.uv, v0 = 1 - (y0 + rows[i]) / H, v1 = 1 - y0 / H;
    for (let k = 0; k < uv.count; k++) uv.setY(k, uv.getY(k) > 0.5 ? v1 : v0);
    p.rotateY(it.ry);
    p.translate(it.x, it.y, it.z);
    geos.push(p);
    y0 += rows[i];
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const m = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5 });
  m.userData.outlineParameters = { visible: false };
  return new THREE.Mesh(mergeGeometries(geos, false), m);
}

/** A flat circular floor with an optional square hatch (hx, hz, size). */
export function discShape(r, hatch) {
  const s = new THREE.Shape();
  s.absarc(0, 0, r, 0, Math.PI * 2, false);
  if (hatch) {
    const [hx, hz, hs] = hatch;
    const h = new THREE.Path();
    const x0 = hx - hs / 2, x1 = hx + hs / 2, y0 = -hz - hs / 2, y1 = -hz + hs / 2;
    h.moveTo(x0, y0);
    h.lineTo(x0, y1);
    h.lineTo(x1, y1);
    h.lineTo(x1, y0);
    h.closePath();
    s.holes.push(h);
  }
  return s;
}
export function ringShape(r0, r1) {
  const s = new THREE.Shape();
  s.absarc(0, 0, r1, 0, Math.PI * 2, false);
  const h = new THREE.Path();
  h.absarc(0, 0, r0, 0, Math.PI * 2, true);
  s.holes.push(h);
  return s;
}
