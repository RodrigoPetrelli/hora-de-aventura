// Cartoon look: banded toon shading, ink outlines (via OutlineEffect's
// userData.outlineParameters) and procedural, world-space (triplanar) textures.
import * as THREE from "three";

// three light bands, like cel animation
const GRAD = (() => {
  const t = new THREE.DataTexture(new Uint8Array([150, 205, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
})();

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const g = (v) => `rgb(${v},${v},${v})`;
function canvasTex(size, draw, seed = 1) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  draw(ctx, size, rng(seed));
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// All patterns are near-white so they multiply the material colour subtly.
const DRAW = {
  grass(ctx, s, r) {
    ctx.fillStyle = g(238);
    ctx.fillRect(0, 0, s, s);
    ctx.lineCap = "round";
    for (let i = 0; i < 700; i++) {
      const x = r() * s, y = r() * s, l = 4 + r() * 9, a = -Math.PI / 2 + (r() - 0.5) * 0.9;
      ctx.strokeStyle = r() < 0.7 ? g(205 + ((r() * 20) | 0)) : g(255);
      ctx.lineWidth = 1.5 + r() * 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.stroke();
    }
  },
  wood(ctx, s, r) {
    const rows = 8, h = s / rows;
    for (let i = 0; i < rows; i++) {
      ctx.fillStyle = g(215 + ((r() * 30) | 0));
      ctx.fillRect(0, i * h, s, h);
      ctx.strokeStyle = g(195);
      ctx.lineWidth = 1;
      for (let k = 0; k < 3; k++) {
        const y = i * h + 5 + r() * (h - 10);
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= s; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.05 + k + i) * 1.5);
        ctx.stroke();
      }
      const joint = (r() * s) | 0;
      ctx.fillStyle = g(120);
      ctx.fillRect(joint, i * h, 2, h);
      ctx.fillStyle = g(90);
      for (const nx of [joint - 6, joint + 7]) {
        ctx.beginPath();
        ctx.arc((nx + s) % s, i * h + h / 2, 1.8, 0, 7);
        ctx.fill();
      }
      ctx.fillStyle = g(110);
      ctx.fillRect(0, i * h, s, 2);
    }
  },
  bark(ctx, s, r) {
    ctx.fillStyle = g(228);
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 26; i++) {
      let x = r() * s;
      ctx.strokeStyle = g(150 + ((r() * 50) | 0));
      ctx.lineWidth = 1.5 + r() * 2.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      for (let y = 0; y <= s; y += 12) {
        x += (r() - 0.5) * 5;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  },
  shingle(ctx, s, r) {
    ctx.fillStyle = g(235);
    ctx.fillRect(0, 0, s, s);
    const rows = 8, h = s / rows, w = s / 6;
    ctx.strokeStyle = g(140);
    ctx.lineWidth = 2;
    for (let i = 0; i < rows; i++) {
      const off = i % 2 ? w / 2 : 0;
      for (let x = -w; x < s + w; x += w) {
        ctx.fillStyle = g(215 + ((r() * 35) | 0));
        ctx.beginPath();
        ctx.moveTo(x + off, i * h);
        ctx.lineTo(x + off, i * h + h * 0.7);
        ctx.quadraticCurveTo(x + off + w / 2, i * h + h * 1.15, x + off + w, i * h + h * 0.7);
        ctx.lineTo(x + off + w, i * h);
        ctx.fill();
        ctx.stroke();
      }
    }
  },
  drape(ctx, s, r) {
    ctx.fillStyle = g(240);
    ctx.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 14 + r() * 10) {
      ctx.fillStyle = r() < 0.5 ? g(200) : g(218);
      const w = 5 + r() * 7;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      for (let y = 0; y <= s; y += 16) ctx.lineTo(x + Math.sin(y * 0.03 + x) * 2, y);
      for (let y = s; y >= 0; y -= 16) ctx.lineTo(x + w + Math.sin(y * 0.03 + x) * 2, y);
      ctx.fill();
    }
  },
  ice(ctx, s, r) {
    ctx.fillStyle = g(246);
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = g(212);
    ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      let x = r() * s, y = r() * s;
      ctx.moveTo(x, y);
      for (let k = 0; k < 3; k++) {
        x += (r() - 0.5) * 120;
        y += (r() - 0.5) * 120;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = g(255);
    ctx.lineWidth = 5;
    for (let i = 0; i < 5; i++) {
      const x = r() * s, y = r() * s;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 30, y - 30);
      ctx.stroke();
    }
  },
  rock(ctx, s, r) {
    ctx.fillStyle = g(228);
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = g(200 + ((r() * 30) | 0));
      ctx.beginPath();
      ctx.ellipse(r() * s, r() * s, 6 + r() * 20, 4 + r() * 12, r() * 3, 0, 7);
      ctx.fill();
    }
    ctx.strokeStyle = g(150);
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 10; i++) {
      let x = r() * s, y = r() * s;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        x += (r() - 0.5) * 40;
        y += r() * 30;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  },
  waffle(ctx, s) {
    ctx.fillStyle = g(240);
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = g(165);
    ctx.lineWidth = 5;
    for (let i = -s; i < s * 2; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + s, s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i, s);
      ctx.lineTo(i + s, 0);
      ctx.stroke();
    }
  },
  frosting(ctx, s, r) {
    ctx.fillStyle = g(245);
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = r() < 0.5 ? g(228) : g(255);
      ctx.beginPath();
      ctx.arc(r() * s, r() * s, 3 + r() * 10, 0, 7);
      ctx.fill();
    }
  },
  siding(ctx, s) {
    ctx.fillStyle = g(236);
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = g(175);
    for (let y = 0; y < s; y += 21) ctx.fillRect(0, y, s, 3);
  },
  stone(ctx, s, r) {
    ctx.fillStyle = g(170);
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 32) {
      for (let x = (y / 32) % 2 ? -16 : 0; x < s; x += 36) {
        ctx.fillStyle = g(215 + ((r() * 35) | 0));
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, 32, 28, 9);
        ctx.fill();
      }
    }
  },
  dots(ctx, s, r) {
    ctx.fillStyle = g(250);
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = g(215);
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      ctx.arc(r() * s, r() * s, 8 + r() * 8, 0, 7);
      ctx.fill();
    }
  },
  // patchwork floor boards of mixed tones (the Tree Fort floors)
  planks(ctx, s, r) {
    const rows = 10, h = s / rows;
    for (let i = 0; i < rows; i++) {
      let x = -r() * s * 0.5;
      while (x < s) {
        const w = s * (0.25 + r() * 0.45);
        ctx.fillStyle = g(188 + ((r() * 67) | 0));
        ctx.fillRect(x, i * h, w, h);
        for (const xx of [x, x + s]) {
          ctx.fillStyle = g(105);
          ctx.fillRect(xx - 1, i * h, 2, h);
          ctx.fillStyle = g(120);
          for (const dy of [0.3, 0.7]) ctx.fillRect(xx + 4, i * h + h * dy - 1, 3, 3);
        }
        ctx.strokeStyle = g(170);
        ctx.lineWidth = 1;
        ctx.beginPath();
        const gy = i * h + 4 + r() * (h - 8);
        ctx.moveTo(x + 6, gy);
        ctx.lineTo(x + w - 6, gy + (r() - 0.5) * 3);
        ctx.stroke();
        x += w;
      }
      ctx.fillStyle = g(100);
      ctx.fillRect(0, i * h, s, 2);
    }
  },
  checker(ctx, s) {
    const n = 8, q = s / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      ctx.fillStyle = (i + j) % 2 ? g(48) : g(252);
      ctx.fillRect(i * q, j * q, q, q);
    }
  },
  tiles(ctx, s, r) {
    const n = 4, q = s / n;
    ctx.fillStyle = g(165);
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      ctx.fillStyle = g(228 + ((r() * 27) | 0));
      ctx.beginPath();
      ctx.roundRect(i * q + 3, j * q + 3, q - 6, q - 6, 6);
      ctx.fill();
      ctx.fillStyle = g(255);
      ctx.fillRect(i * q + 10, j * q + 9, q * 0.25, 4);
    }
  },
  // faceted ice: tiling Voronoi cells in different tones with dark seams
  shards(ctx, s, r) {
    const pts = Array.from({ length: 22 }, () => [r() * s, r() * s, 165 + r() * 90]);
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      let d1 = 1e9, d2 = 1e9, tone = 0;
      for (const [px, py, t] of pts) {
        let dx = Math.abs(x - px), dy = Math.abs(y - py);
        if (dx > s / 2) dx = s - dx;
        if (dy > s / 2) dy = s - dy;
        const d = dx * dx + dy * dy;
        if (d < d1) { d2 = d1; d1 = d; tone = t; } else if (d < d2) d2 = d;
      }
      const v = Math.sqrt(d2) - Math.sqrt(d1) < 2.2 ? 105 : tone;
      const o = (y * s + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = v;
      img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  },
  // leopard print: dark blobs on white
  spots(ctx, s, r) {
    ctx.fillStyle = g(255);
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 26; i++) {
      const x = r() * s, y = r() * s, rad = 7 + r() * 8;
      ctx.fillStyle = g(70);
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * 6.28 + r();
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * rad * 0.6, y + Math.sin(a) * rad * 0.6, rad * 0.45, rad * 0.3, a, 0, 7);
        ctx.fill();
      }
      ctx.fillStyle = g(200);
      ctx.beginPath();
      ctx.arc(x, y, rad * 0.35, 0, 7);
      ctx.fill();
    }
  },
  // a heap of skulls: pale domes packed together, dark sockets, dark gaps between them (the Lich's cave)
  bones(ctx, s, r) {
    ctx.fillStyle = g(95);
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 46; i++) {
      const x = r() * s, y = r() * s, rad = 13 + r() * 9, tone = 205 + ((r() * 50) | 0), tilt = (r() - 0.5) * 0.8;
      for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) {
        const cx = x + ox, cy = y + oy;
        if (cx < -rad * 2 || cx > s + rad * 2 || cy < -rad * 2 || cy > s + rad * 2) continue;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(tilt);
        ctx.fillStyle = g(tone);
        ctx.beginPath();
        ctx.ellipse(0, 0, rad, rad * 0.9, 0, 0, 7);
        ctx.fill();
        ctx.fillRect(-rad * 0.45, rad * 0.5, rad * 0.9, rad * 0.45); // the jaw
        ctx.fillStyle = g(75);
        for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * rad * 0.38, rad * 0.05, rad * 0.24, rad * 0.28, 0, 0, 7); ctx.fill(); }
        ctx.beginPath();
        ctx.moveTo(0, rad * 0.3); ctx.lineTo(-rad * 0.1, rad * 0.48); ctx.lineTo(rad * 0.1, rad * 0.48);
        ctx.fill();
        ctx.fillStyle = g(130);
        for (let k = -1; k <= 1; k++) ctx.fillRect(k * rad * 0.22 - 1, rad * 0.62, 2, rad * 0.3);
        ctx.restore();
      }
    }
  },
};
let TEX = null;
function textures() {
  if (!TEX) {
    TEX = {};
    let seed = 3;
    for (const [k, fn] of Object.entries(DRAW)) TEX[k] = canvasTex(256, fn, seed++);
  }
  return TEX;
}

function triplanar(m, tex, scale) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.triMap = { value: tex };
    sh.uniforms.triScale = { value: scale };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vTriPos;\nvarying vec3 vTriN;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvTriPos = (modelMatrix * vec4(position, 1.0)).xyz;\nvTriN = normalize(mat3(modelMatrix) * normal);",
      );
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform sampler2D triMap;\nuniform float triScale;\nvarying vec3 vTriPos;\nvarying vec3 vTriN;")
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        vec3 tw = pow(abs(normalize(vTriN)), vec3(4.0));
        tw /= (tw.x + tw.y + tw.z);
        vec3 tc = texture2D(triMap, vTriPos.zy * triScale).rgb * tw.x
                + texture2D(triMap, vTriPos.xz * triScale).rgb * tw.y
                + texture2D(triMap, vTriPos.xy * triScale).rgb * tw.z;
        diffuseColor.rgb *= tc;`,
      );
  };
  m.customProgramCacheKey = () => "tri_" + tex.uuid + "_" + scale;
}

const cache = new Map();
/**
 * Toon material. o: { tex, scale, emissive, flat, side, outline:false, thick, vc, opacity }
 */
export function toon(color, o = {}) {
  const key = [color, o.emissive || 0, o.tex || "", o.scale || 0, o.flat ? 1 : 0, o.side || 0, o.outline === false ? 0 : 1, o.thick || 0, o.vc ? 1 : 0, o.opacity ?? 1].join("|");
  let m = cache.get(key);
  if (m) return m;
  const opacity = o.opacity ?? 1;
  m = new THREE.MeshToonMaterial({
    color, gradientMap: GRAD, emissive: o.emissive || 0, flatShading: !!o.flat, vertexColors: !!o.vc,
    side: o.side || THREE.FrontSide, transparent: opacity < 1, opacity,
  });
  if (o.tex) triplanar(m, textures()[o.tex], o.scale || 0.25);
  m.userData.outlineParameters = o.outline === false
    ? { visible: false }
    : { thickness: o.thick || 0.0032, color: [0.09, 0.06, 0.11], alpha: 1, visible: true };
  // the Builder merges scenery by these options and bakes the colour into vertex colours
  m.userData.toon = { ...o };
  cache.set(key, m);
  return m;
}
export function basic(color, o = {}) {
  const m = new THREE.MeshBasicMaterial({ color, ...o });
  m.userData.outlineParameters = { visible: false };
  return m;
}
export function noOutline(m) {
  m.userData.outlineParameters = { visible: false };
  return m;
}

/** Animated lava texture (colour, used on MeshBasicMaterial). */
export function lavaTexture() {
  return canvasTex(256, (ctx, s, r) => {
    ctx.fillStyle = "#ff5a1a";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = r() < 0.5 ? "#ffb13b" : "#ff7a2a";
      ctx.beginPath();
      ctx.ellipse(r() * s, r() * s, 8 + r() * 26, 4 + r() * 12, r() * 3, 0, 7);
      ctx.fill();
    }
    ctx.fillStyle = "#fff0a0";
    for (let i = 0; i < 25; i++) {
      ctx.beginPath();
      ctx.arc(r() * s, r() * s, 2 + r() * 4, 0, 7);
      ctx.fill();
    }
  }, 77);
}
/**
 * Water textures (colour, used on MeshBasicMaterial): "flow" — blue with lighter streaks and white
 * ripples along v, for streams and ponds; "fall" — the pale falling sheet, streaked down v.
 */
export function waterTexture(kind = "flow") {
  // every shape is drawn on the tile's neighbours too, so it wraps without seams
  const wrap = (s, fn) => { for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) fn(ox, oy); };
  return canvasTex(256, (ctx, s, r) => {
    if (kind === "fall") {
      ctx.fillStyle = "#86d3f2";
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 70; i++) {
        const x = r() * s, y = r() * s, w = 3 + r() * 10, h = 40 + r() * 120;
        ctx.fillStyle = ["#b5e6fa", "#ffffff", "#69c3ea", "#d8f3ff"][i % 4];
        wrap(s, (ox, oy) => { ctx.beginPath(); ctx.ellipse(x + ox, y + oy, w / 2, h / 2, 0, 0, 7); ctx.fill(); });
      }
      return;
    }
    ctx.fillStyle = "#4db4e4";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 46; i++) {
      const x = r() * s, y = r() * s, rx = 3 + r() * 7, ry = 14 + r() * 34;
      ctx.fillStyle = r() < 0.55 ? "#62c2ec" : "#3fa6da";
      wrap(s, (ox, oy) => { ctx.beginPath(); ctx.ellipse(x + ox, y + oy, rx, ry, 0, 0, 7); ctx.fill(); });
    }
    ctx.strokeStyle = "#e6f7ff";
    ctx.lineCap = "round";
    for (let i = 0; i < 30; i++) {
      const x = r() * s, y = r() * s, l = 10 + r() * 20;
      ctx.lineWidth = 2 + r() * 2.5;
      wrap(s, (ox, oy) => { ctx.beginPath(); ctx.moveTo(x + ox - l / 2, y + oy); ctx.quadraticCurveTo(x + ox, y + oy - 4, x + ox + l / 2, y + oy); ctx.stroke(); });
    }
  }, kind === "fall" ? 92 : 91);
}
/** Small canvas-painted decal (signs, carvings, pictures). */
export function decalTexture(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
