// Render cost from any viewpoint, without touching Finn or the save. With the game open at
// /?debug=1, in the page console:
//   const M = await import("/debug/medir.js");
//   M.medir([[x, y, z, yaw, pitch], ...])   draw calls, triangles and ms per view
//   M.pesados(x, y, z, yaw, pitch)          the heaviest meshes seen from there
// yaw/pitch follow __game.cam: the camera looks toward -(sin yaw, cos yaw) and down by pitch.
import * as THREE from "three";

function view(G, x, y, z, yaw, pitch) {
  const c = G.camera.clone();
  c.position.set(x, y, z);
  c.lookAt(x - Math.sin(yaw) * Math.cos(pitch), y - Math.sin(pitch), z - Math.cos(yaw) * Math.cos(pitch));
  c.updateMatrixWorld();
  return c;
}
function game() {
  const G = window.__game;
  if (!G) throw new Error("abra o jogo com ?debug=1");
  return G;
}

export function medir(views) {
  const G = game(), R = G.renderer;
  const out = views.map(([x, y, z, yaw = 0, pitch = 0.2]) => {
    const c = view(G, x, y, z, yaw, pitch);
    G.world.update(0, c.position);
    R.info.reset();
    const t = performance.now();
    G.effect.render(G.scene, c);
    R.getContext().finish();
    const ms = performance.now() - t;
    return { onde: [x, y, z].map((v) => +v.toFixed(0)).join(","), fechado: G.world.state.sealed, draws: R.info.render.calls, tris: Math.round(R.info.render.triangles / 1000) + "k", ms: +ms.toFixed(1) };
  });
  G.world.update(0, G.camera.position);
  return out;
}

/** Free camera for a screenshot: renders from (x, y, z) looking at (tx, ty, tz) for `ms`, then gives the view back. */
export function foto(x, y, z, tx, ty, tz, ms = 2500) {
  const G = game(), c = G.camera.clone();
  c.position.set(x, y, z);
  c.lookAt(tx, ty, tz);
  c.updateMatrixWorld();
  const e = G.effect, orig = e.__render || e.render;
  e.__render = orig;
  e.render = function (scene) {
    G.world.update(performance.now() / 1000, c.position);
    orig.call(this, scene, c);
  };
  clearTimeout(e.__fotoT);
  e.__fotoT = setTimeout(() => { e.render = orig; delete e.__render; }, ms);
  return "ok";
}

export function pesados(x, y, z, yaw = 0, pitch = 0.2, n = 15) {
  const G = game(), c = view(G, x, y, z, yaw, pitch);
  G.world.update(0, c.position);
  const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse));
  const list = [];
  G.scene.traverseVisible((o) => {
    if (!o.isMesh) return;
    if (o.frustumCulled) {
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      if (!fr.intersectsSphere(o.geometry.boundingSphere.clone().applyMatrix4(o.matrixWorld))) return;
    }
    const tris = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
    const ink = o.material.userData?.outlineParameters?.visible !== false ? 2 : 1;
    const t = o.material.userData?.toon, cu = o.userData.cull;
    const kind = o.userData.cell ? "fixo" : cu ? (cu.zone ? "interior" : cu.min !== undefined ? "longe" : "perto") : "outro";
    o.geometry.computeBoundingBox();
    const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    list.push({ k: Math.round((tris * ink) / 100) / 10 + "k", tipo: kind, mat: t ? (t.tex || "liso") + (t.vc ? "" : "*") : o.material.type, x: [b.min.x, b.max.x].map(Math.round).join(".."), z: [b.min.z, b.max.z].map(Math.round).join(".."), n: tris * ink });
  });
  G.world.update(0, G.camera.position);
  list.sort((a, b) => b.n - a.n);
  const total = list.reduce((s, a) => s + a.n, 0);
  return { total: Math.round(total / 1000) + "k", malhas: list.length, top: list.slice(0, n).map(({ n: _, ...r }) => r) };
}
