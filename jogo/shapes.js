// Modeling kit for the characters. Parts are primitives placed in groups and
// merged per material by bake(); faces and markings are decals: flat 2D shapes
// wrapped onto a part's surface by raycasting. Every model faces +z.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { toon } from "./toon.js";

export const OUT = 0.0055; // outline thickness for characters
export const mat = (c, o = {}) => toon(c, { thick: OUT, ...o });
export const BLACK = 0x1d1d24, WHITE = 0xffffff, GOLD = 0xf6c343;
export const G = {
  sph: new THREE.SphereGeometry(1, 16, 12),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 20),
  cone: new THREE.ConeGeometry(1, 1, 20),
};
const SPH_LO = new THREE.SphereGeometry(1, 8, 6);
const Y = new THREE.Vector3(0, 1, 0);
export const rbox = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, Math.min(w, h, d) < 0.1 ? 1 : 2, r);

function place(parent, m, x, y, z, o) {
  m.position.set(x, y, z);
  if (o.rx || o.ry || o.rz) m.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0);
  if (o.keep) m.userData.keep = true;
  parent.add(m);
  return m;
}
export function add(parent, geo, color, x, y, z, sx = 1, sy = sx, sz = sx, o = {}) {
  if (geo === G.sph && Math.max(sx, sy, sz) < 0.07) geo = SPH_LO; // tiny parts don't need detail
  const m = new THREE.Mesh(geo, o.material || mat(color, o));
  m.scale.set(sx, sy, sz);
  return place(parent, m, x, y, z, o);
}
/** Capsule from a to b. */
export function cap(parent, a, b, r, color, o = {}) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = Math.max(0.001, d.length());
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 3, r < 0.05 ? 8 : 12), o.material || mat(color, o));
  m.quaternion.setFromUnitVectors(Y, d.normalize());
  return place(parent, m, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, { ...o, rx: 0, ry: 0, rz: 0 });
}
/** Solid of revolution from [radius, height] pairs; o.smooth = n resamples them along a spline. */
export function lathe(parent, profile, color, x, y, z, o = {}) {
  let pts = profile.map(([r, h]) => new THREE.Vector2(r, h));
  if (o.smooth) pts = new THREE.SplineCurve(pts).getPoints(o.smooth);
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, o.seg || 28), o.material || mat(color, o));
  m.scale.set(o.sx || 1, 1, o.sz || 1);
  return place(parent, m, x, y, z, o);
}

const superCache = new Map();
/** Rounded-box blob |x/a|^n + |y/b|^n + |z/c|^n = 1 (n = 2 is an ellipsoid, higher is boxier). */
export function superGeo(a, b, c, n = 3, ws = 24, hs = 16) {
  const key = [a, b, c, n, ws, hs].join("|");
  let g = superCache.get(key);
  if (g) return g;
  g = new THREE.SphereGeometry(1, ws, hs);
  const P = g.attributes.position, N = g.attributes.normal;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const k = (Math.abs(x) ** n + Math.abs(y) ** n + Math.abs(z) ** n) ** (1 / n);
    const px = (x / k) * a, py = (y / k) * b, pz = (z / k) * c;
    P.setXYZ(i, px, py, pz);
    // analytic normal: the gradient of the implicit surface
    const nx = (Math.sign(px) * Math.abs(px / a) ** (n - 1)) / a;
    const ny = (Math.sign(py) * Math.abs(py / b) ** (n - 1)) / b;
    const nz = (Math.sign(pz) * Math.abs(pz / c) ** (n - 1)) / c;
    const l = Math.hypot(nx, ny, nz) || 1;
    N.setXYZ(i, nx / l, ny / l, nz / l);
  }
  superCache.set(key, g);
  return g;
}
export function blob(parent, [a, b, c], n, color, x, y, z, o = {}) {
  const m = new THREE.Mesh(superGeo(a, b, c, n, o.ws, o.hs), o.material || mat(color, o));
  return place(parent, m, x, y, z, o);
}

/** Tube along a smooth curve through pts, radius r(t) (default tapering r0 → r1), with round ends. */
export function tube(parent, pts, r0, r1, color, o = {}) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const segs = o.segs || 12, rad = o.radial || 8;
  const geo = new THREE.TubeGeometry(curve, segs, 1, rad, false);
  const P = geo.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
  const rOf = o.r || ((t) => r0 + (r1 - r0) * t);
  for (let i = 0; i <= segs; i++) {
    curve.getPointAt(i / segs, c);
    const r = rOf(i / segs);
    for (let j = 0; j <= rad; j++) {
      const k = i * (rad + 1) + j;
      v.fromBufferAttribute(P, k).sub(c).multiplyScalar(r).add(c);
      P.setXYZ(k, v.x, v.y, v.z);
    }
  }
  const material = o.material || mat(color, o);
  const m = place(parent, new THREE.Mesh(geo, material), 0, 0, 0, o);
  if (o.caps !== false) {
    const e0 = curve.getPointAt(0), e1 = curve.getPointAt(1);
    for (const [e, r] of [[e0, rOf(0)], [e1, rOf(1)]]) if (r > 0.004) add(parent, G.sph, color, e.x, e.y, e.z, r, r, r, { material, keep: o.keep });
  }
  return m;
}

export const group = (parent, x, y, z) => {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
};

/** Merge static child meshes that share a material (fewer draw calls). Groups stay (they animate). */
export function bake(obj) {
  for (const c of [...obj.children]) if (!c.isMesh && c.children.length) bake(c);
  const byMat = new Map();
  for (const c of obj.children) {
    if (!c.isMesh || c.userData.keep) continue;
    if (!byMat.has(c.material)) byMat.set(c.material, []);
    byMat.get(c.material).push(c);
  }
  for (const [m, list] of byMat) {
    if (list.length < 2) continue;
    const geos = list.map((mesh) => {
      mesh.updateMatrix();
      const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      g.applyMatrix4(mesh.matrix);
      for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") g.deleteAttribute(k);
      if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      return g;
    });
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    list.forEach((mesh) => obj.remove(mesh));
    obj.add(new THREE.Mesh(merged, m));
  }
  return obj;
}

// ── decals ──
const decalMats = new Map();
/** Toon material without outline, pulled toward the camera so it never fights the surface below. */
export function decalMat(color, emissive = 0) {
  const key = color + "|" + emissive;
  let m = decalMats.get(key);
  if (!m) {
    m = toon(color, { outline: false, emissive }).clone();
    delete m.userData.toon; // its own material: the Builder must not swap it for a merged one
    m.polygonOffset = true;
    m.polygonOffsetFactor = -2;
    m.polygonOffsetUnits = -4;
    decalMats.set(key, m);
  }
  return m;
}
export function ellipse(rx, ry, cx = 0, cy = 0, seg = 28) {
  const s = new THREE.Shape();
  s.absellipse(cx, cy, rx, ry, 0, Math.PI * 2, false);
  s.userData = { seg };
  return s;
}
/** Elliptical outline of thickness t (outside edge rx, ry). */
export function ring(rx, ry, t, cx = 0, cy = 0, seg = 40) {
  const s = ellipse(rx, ry, cx, cy, seg);
  const h = new THREE.Path();
  h.absellipse(cx, cy, rx - t, ry - t, 0, Math.PI * 2, true);
  s.holes.push(h);
  return s;
}
export function roundRect(w, h, r, cx = 0, cy = 0) {
  const s = new THREE.Shape(), x = cx - w / 2, y = cy - h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  s.userData = { seg: 4 };
  return s;
}
/** A band along an arc (angles from +x, counter-clockwise): smiles, brows, lids. */
export function arc(cx, cy, r, thick, a0, a1, seg = 14) {
  const s = new THREE.Shape();
  for (let i = 0; i <= seg; i++) {
    const a = a0 + ((a1 - a0) * i) / seg, rr = r + thick / 2;
    i ? s.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : s.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  for (let i = seg; i >= 0; i--) {
    const a = a0 + ((a1 - a0) * i) / seg, rr = r - thick / 2;
    s.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  return s;
}
export function poly(points) {
  const s = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  return s;
}
/** Triangulate a shape and subdivide it evenly (no T-junctions) until no edge exceeds maxEdge. */
function flatGeo(shape, maxEdge) {
  let g = new THREE.ShapeGeometry(shape, shape.userData?.seg || 12);
  g = g.index ? g.toNonIndexed() : g;
  let P = Array.from(g.attributes.position.array);
  for (let pass = 0; pass < 4; pass++) {
    let longest = 0;
    for (let i = 0; i < P.length; i += 9)
      for (const [p, q] of [[0, 3], [3, 6], [6, 0]]) longest = Math.max(longest, Math.hypot(P[i + p] - P[i + q], P[i + p + 1] - P[i + q + 1]));
    if (longest <= maxEdge) break;
    const out = [];
    for (let i = 0; i < P.length; i += 9) {
      const a = P.slice(i, i + 3), b = P.slice(i + 3, i + 6), c = P.slice(i + 6, i + 9);
      const m = (u, v) => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2, 0];
      const ab = m(a, b), bc = m(b, c), ca = m(c, a);
      out.push(...a, ...ab, ...ca, ...ab, ...b, ...bc, ...ca, ...bc, ...c, ...ab, ...bc, ...ca);
    }
    P = out;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  return geo;
}
const _rc = new THREE.Raycaster(), _o = new THREE.Vector3(), _d = new THREE.Vector3(), _n = new THREE.Vector3();
const _nm = new THREE.Matrix3(), _inv = new THREE.Matrix4();
/**
 * Wrap a 2D shape onto `target`'s surface, seen from the front (+z) of target's parent, or from
 * its side with o.side = "x" | "-x". Shape coordinates are the parent's (x, y) (for "x", shape x
 * runs toward -z so markings read correctly). o.lift: gap above the surface; o.pivot: [x, y] of
 * the shape that becomes the mesh origin (for scaling it in place, e.g. blinking).
 */
export function decal(target, shapes, color, o = {}) {
  const parent = target.parent;
  target.updateWorldMatrix(true, false);
  _inv.copy(parent.matrixWorld).invert();
  _nm.getNormalMatrix(target.matrixWorld);
  const geos = (Array.isArray(shapes) ? shapes : [shapes]).map((s) => flatGeo(s, o.edge ?? 0.025));
  const geo = geos.length > 1 ? mergeGeometries(geos, false) : geos[0];
  const P = geo.attributes.position, N = new Float32Array(P.count * 3);
  const lift = o.lift ?? 0.003;
  const map = (sx, sy) => (o.side === "x" ? [[3, sy, -sx], [-1, 0, 0]] : o.side === "-x" ? [[-3, sy, sx], [1, 0, 0]] : [[sx, sy, 3], [0, 0, -1]]);
  let last = null;
  for (let i = 0; i < P.count; i++) {
    const [org, dir] = map(P.getX(i), P.getY(i));
    _o.set(...org).applyMatrix4(parent.matrixWorld);
    _d.set(...dir).transformDirection(parent.matrixWorld);
    _rc.set(_o, _d);
    const hit = _rc.intersectObject(target, false)[0];
    if (hit) {
      _n.copy(hit.normal).applyMatrix3(_nm).normalize(); // world
      const p = hit.point.clone().addScaledVector(_n, lift).applyMatrix4(_inv);
      _n.transformDirection(_inv);
      last = [p, _n.clone()];
    }
    if (last) {
      P.setXYZ(i, last[0].x, last[0].y, last[0].z);
      N.set([last[1].x, last[1].y, last[1].z], i * 3);
    }
  }
  geo.setAttribute("normal", new THREE.BufferAttribute(N, 3));
  const mesh = new THREE.Mesh(geo, o.material || decalMat(color, o.emissive));
  if (o.pivot) {
    // re-centre on the projected pivot so the decal can scale in place
    const [org, dir] = map(o.pivot[0], o.pivot[1]);
    _o.set(...org).applyMatrix4(parent.matrixWorld);
    _rc.set(_o, _d.set(...dir).transformDirection(parent.matrixWorld));
    const hit = _rc.intersectObject(target, false)[0];
    const c = hit ? hit.point.applyMatrix4(_inv) : new THREE.Vector3(o.pivot[0], o.pivot[1], 0);
    geo.translate(-c.x, -c.y, -c.z);
    mesh.position.copy(c);
  }
  if (o.keep) mesh.userData.keep = true;
  parent.add(mesh);
  return mesh;
}
