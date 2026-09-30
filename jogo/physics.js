// Collision world: a spatial grid of simple colliders plus ladders.
// t:0 = axis-aligned box {x0,x1,y0,y1,z0,z1}; t:1 = vertical cylinder {x,z,r,y0,y1}
// `cam: false` colliders (small props) don't push the camera in.

export const STEP = 0.35; // ledges this high are walked onto, not blocked by

let groundFn = () => 0;
export function setGround(fn) {
  groundFn = fn;
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const GRID = 16;
const grid = new Map();
let stamp = 0;
const cellKey = (cx, cz) => (cx + 200) * 1000 + (cz + 200);

export function addCollider(c) {
  c.stamp = 0;
  if (c.cam === undefined) c.cam = true;
  const minx = c.t === 0 ? c.x0 : c.x - c.r, maxx = c.t === 0 ? c.x1 : c.x + c.r;
  const minz = c.t === 0 ? c.z0 : c.z - c.r, maxz = c.t === 0 ? c.z1 : c.z + c.r;
  for (let cx = Math.floor(minx / GRID); cx <= Math.floor(maxx / GRID); cx++) {
    for (let cz = Math.floor(minz / GRID); cz <= Math.floor(maxz / GRID); cz++) {
      const k = cellKey(cx, cz);
      let arr = grid.get(k);
      if (!arr) grid.set(k, (arr = []));
      arr.push(c);
    }
  }
  return c;
}
export const boxCollider = (x0, x1, y0, y1, z0, z1, cam = true) => addCollider({ t: 0, x0, x1, y0, y1, z0, z1, cam });
export const cylCollider = (x, z, r, y0, y1, cam = true) => addCollider({ t: 1, x, z, r, y0, y1, cam });

/** A ring wall of overlapping cylinders; `gaps` are [centerAngle, width] in radians (angle 0 = +z). */
export function ringCollider(cx, cz, radius, thick, y0, y1, gaps = [], cam = true) {
  const r = thick / 2 + 0.25;
  const n = Math.ceil((Math.PI * 2 * radius) / (r * 1.4));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    let skip = false;
    for (const [g, w] of gaps) {
      const d = Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g)));
      if (d < w / 2) skip = true;
    }
    if (!skip) cylCollider(cx + Math.sin(a) * radius, cz + Math.cos(a) * radius, r, y0, y1, cam);
  }
}

function query(x, z, r, out) {
  out.length = 0;
  stamp++;
  for (let cx = Math.floor((x - r) / GRID); cx <= Math.floor((x + r) / GRID); cx++) {
    for (let cz = Math.floor((z - r) / GRID); cz <= Math.floor((z + r) / GRID); cz++) {
      const arr = grid.get(cellKey(cx, cz));
      if (!arr) continue;
      for (let i = 0; i < arr.length; i++) {
        const c = arr[i];
        if (c.stamp !== stamp) {
          c.stamp = stamp;
          out.push(c);
        }
      }
    }
  }
  return out;
}

const _a = [], _b = [], _c = [], _d = [];
/** Push a vertical capsule (radius r, spanning feet..head) out of solid colliders. */
export function resolveXZ(p, r, feet, head, vel) {
  query(p.x, p.z, r + 1, _a);
  for (let iter = 0; iter < 2; iter++) {
    for (let i = 0; i < _a.length; i++) {
      const c = _a[i];
      if (c.y1 <= feet + STEP || c.y0 >= head) continue;
      let nx, nz, push;
      if (c.t === 1) {
        const dx = p.x - c.x, dz = p.z - c.z, min = r + c.r, d2 = dx * dx + dz * dz;
        if (d2 >= min * min) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          nx = dx / d; nz = dz / d; push = min - d;
        } else { nx = 1; nz = 0; push = min; }
      } else {
        const cx = clamp(p.x, c.x0, c.x1), cz = clamp(p.z, c.z0, c.z1);
        const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          nx = dx / d; nz = dz / d; push = r - d;
        } else {
          const l = p.x - c.x0, rr = c.x1 - p.x, b = p.z - c.z0, f = c.z1 - p.z;
          const m = Math.min(l, rr, b, f);
          if (m === l) { nx = -1; nz = 0; push = l + r; }
          else if (m === rr) { nx = 1; nz = 0; push = rr + r; }
          else if (m === b) { nx = 0; nz = -1; push = b + r; }
          else { nx = 0; nz = 1; push = f + r; }
        }
      }
      p.x += nx * push;
      p.z += nz * push;
      if (vel) {
        const vn = vel.x * nx + vel.z * nz;
        if (vn < 0) { vel.x -= vn * nx; vel.z -= vn * nz; }
      }
    }
  }
}

/** Highest walkable surface under (x,z) whose top is at or below maxTop. */
export function supportAt(x, z, r, maxTop) {
  let best = groundFn(x, z);
  query(x, z, r + 1, _b);
  const e = r * 0.5;
  for (let i = 0; i < _b.length; i++) {
    const c = _b[i];
    if (c.y1 > maxTop || c.y1 <= best) continue;
    if (c.t === 1) {
      const dx = x - c.x, dz = z - c.z, rr = c.r + e;
      if (dx * dx + dz * dz > rr * rr) continue;
    } else if (x < c.x0 - e || x > c.x1 + e || z < c.z0 - e || z > c.z1 + e) continue;
    best = c.y1;
  }
  return best;
}

/** Lowest collider bottom crossed when a head rises from fromY to toY. */
export function ceilingAt(x, z, r, fromY, toY) {
  let best = Infinity;
  query(x, z, r + 1, _c);
  const e = r * 0.4;
  for (let i = 0; i < _c.length; i++) {
    const c = _c[i];
    if (c.y0 < fromY - 0.01 || c.y0 > toY || c.y0 >= best) continue;
    if (c.t === 1) {
      const dx = x - c.x, dz = z - c.z, rr = c.r + e;
      if (dx * dx + dz * dz > rr * rr) continue;
    } else if (x < c.x0 - e || x > c.x1 + e || z < c.z0 - e || z > c.z1 + e) continue;
    best = c.y0;
  }
  return best;
}

/** Is this point inside the terrain or a camera-blocking collider? */
export function pointBlocked(x, y, z, pad = 0.25) {
  if (y < groundFn(x, z) + 0.3) return true;
  query(x, z, 1, _d);
  for (let i = 0; i < _d.length; i++) {
    const c = _d[i];
    if (!c.cam || y < c.y0 - pad || y > c.y1 + pad) continue;
    if (c.t === 1) {
      const dx = x - c.x, dz = z - c.z, rr = c.r + pad;
      if (dx * dx + dz * dz < rr * rr) return true;
    } else if (x > c.x0 - pad && x < c.x1 + pad && z > c.z0 - pad && z < c.z1 + pad) return true;
  }
  return false;
}

// ── ladders: {x, z, r, y0, y1, ex, ez} — (ex, ez) is the step-off direction at the top ──
export const ladders = [];
export function addLadder(l) {
  ladders.push({ r: 0.75, ...l });
}
export function ladderAt(x, feet, z) {
  for (const l of ladders) {
    if (feet < l.y0 - 0.3 || feet > l.y1 + 0.05) continue;
    const dx = x - l.x, dz = z - l.z;
    if (dx * dx + dz * dz < l.r * l.r) return l;
  }
  return null;
}
