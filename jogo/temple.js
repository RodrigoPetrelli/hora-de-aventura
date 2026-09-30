// The Temple of the Enchiridion, in the Grass Lands east of the Tree Fort: a stone plaza on three
// steps, a ring of old columns (two of them broken) and a round shrine with a green dome. Its only
// door faces west, a stone slab with three sockets for the boss diamonds (crystals.js) and an arch of
// small ones for the golden crystals (the treasures): each one Finn owns shines in its socket, and with
// all of them Billy (billy.js, waiting by the door) sinks the slab into the floor. Inside, on a pedestal, floats
// the Enchiridion, the book of heroes: taking it is the end of the adventure.
// Progress lives in save.temple = { open, book }: the door is open / the book was taken.
import * as THREE from "three";
import { toon, noOutline } from "./toon.js";
import { boxCollider, ringCollider } from "./physics.js";
import { P } from "./terrain.js";
import { CRYSTALS, makeCrystal } from "./crystals.js";
import { STR } from "./strings.js";

const TAU = Math.PI * 2;
// x, z: the centre; y: the floor (top step); wall: the shrine's radius (outer); door: the direction it faces
export const TEMPLE = { x: P.temple.x, z: P.temple.z, y: 0, wall: 4.4, inner: 3.9, h: 5.2, door: -Math.PI / 2, doorW: 2.6, doorH: 3.6 };

/** The static temple (W.ground sets its height). */
export function buildTemple(B, W) {
  const T = TEMPLE, g0 = W.ground(T.x, T.z), F = (T.y = g0 + 0.9);
  const M = {
    stone: toon(0xe6dcc6, { tex: "stone", scale: 0.35 }),
    step: toon(0xcfc3aa, { tex: "stone", scale: 0.35 }),
    inner: toon(0xd8ccb2, { tex: "stone", scale: 0.35, side: THREE.BackSide, outline: false }),
    tiles: toon(0x9fd8c8, { tex: "tiles", scale: 0.4 }),
    dome: toon(0x5fb89a, { tex: "shingle", scale: 0.5 }),
    gold: toon(0xffd23f, { emissive: 0x6a4a00 }),
    moss: toon(0x6fae4a),
  };
  // three steps up to the plaza (0.3 each: walked up, no jump)
  B.cyl(T.x, g0 - 0.5, T.z, 11.2, 0.8, M.step, { seg: 28 });
  B.cyl(T.x, g0, T.z, 10.3, 0.6, M.step, { seg: 28 });
  B.cyl(T.x, g0, T.z, 9.4, 0.9, M.stone, { seg: 28 });
  B.detail(() => {
    // a ring of tiles round the shrine, and moss creeping over the steps
    B.cyl(T.x, F, T.z, 6.4, 0.02, M.tiles, { seg: 28, solid: false });
    for (let k = 0; k < 9; k++) {
      const a = k * 2.4 + 0.3, r = 9.6 + (k % 3) * 0.5;
      B.sphere(T.x + Math.sin(a) * r, g0 + 0.35 + (k % 3) * 0.3, T.z + Math.cos(a) * r, 0.5, M.moss, { seg: 7, sy: 0.35 });
    }
  }, 160);

  // the ring of columns (none in front of the door); two have broken off, their tops lying about
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + Math.PI / 8, cx = T.x + Math.sin(a) * 7.6, cz = T.z + Math.cos(a) * 7.6;
    const broken = k === 2 || k === 5, h = broken ? 1.6 + (k % 2) * 0.6 : 3.8;
    B.box(cx, F, cz, 1.2, 0.4, 1.2, M.step);
    B.cyl(cx, F + 0.4, cz, 0.45, h, M.stone, { seg: 10, rTop: 0.4 });
    if (broken) {
      const fa = a + 0.9, fx = T.x + Math.sin(fa) * 8.6, fz = T.z + Math.cos(fa) * 8.6;
      B.cyl(fx, F + 0.42 - 0.9, fz, 0.42, 1.8, M.stone, { seg: 10, rz: Math.PI / 2, ry: fa, solid: false }); // (y is the bottom: centred 0.42 up)
    } else B.box(cx, F + 0.4 + h, cz, 1.2, 0.4, 1.2, M.step);
  }

  // the shrine: a thick round wall (outer and inner shell) with a gap for the door
  const gap = 2 * Math.asin((T.doorW / 2) / T.wall) + 0.04, ts = T.door + gap / 2, tl = TAU - gap;
  B.cyl(T.x, F, T.z, T.wall, T.h, M.stone, { open: true, seg: 28, ts, tl, solid: false });
  B.cyl(T.x, F, T.z, T.inner, T.h, M.inner, { open: true, seg: 28, ts, tl, solid: false });
  ringCollider(T.x, T.z, (T.wall + T.inner) / 2, T.wall - T.inner, F, F + T.h, [[T.door, 0.9]]);
  // the door frame (it also closes the wall's cut ends) and the lintel over the door
  const dx = Math.sin(T.door), dz = Math.cos(T.door), mid = (T.wall + T.inner) / 2;
  for (const s of [-1, 1]) B.box(T.x + dx * mid - dz * s * (T.doorW / 2 + 0.25), F, T.z + dz * mid + dx * s * (T.doorW / 2 + 0.25), 0.9, T.h, 0.7, M.step);
  B.box(T.x + dx * mid, F + T.doorH, T.z + dz * mid, 0.8, T.h - T.doorH, T.doorW + 0.2, M.step);
  // cornice and ceiling in one slab, the dome and its golden tip
  B.cyl(T.x, F + T.h, T.z, T.wall + 0.3, 0.4, M.step, { seg: 28, solid: false });
  const dome = [];
  for (let i = 0; i <= 8; i++) { const u = (i / 8) * (Math.PI / 2); dome.push([Math.max(0.001, 4.1 * Math.cos(u)), 3.1 * Math.sin(u)]); }
  B.lathe(dome, M.dome, T.x, F + T.h + 0.4, T.z, { seg: 24 });
  B.sphere(T.x, F + T.h + 3.7, T.z, 0.35, M.gold, { seg: 8 });
  B.cone(T.x, F + T.h + 3.9, T.z, 0.18, 1.0, M.gold, { seg: 6 });

  // inside: a green mosaic floor and the pedestal
  B.inside(T.x, T.z, 40, () => {
    B.cyl(T.x, F, T.z, T.inner - 0.05, 0.05, M.tiles, { seg: 24, solid: false });
    B.cyl(T.x, F, T.z, 0.95, 0.3, M.step, { seg: 12 });
    B.cyl(T.x, F + 0.3, T.z, 0.6, 0.8, M.stone, { seg: 12 });
    B.cyl(T.x, F + 1.1, T.z, 0.85, 0.2, M.step, { seg: 12 });
  });
}

/** The Enchiridion: a thick book bound in brown leather, gold corners and clasp, a green gem on the cover. */
export function makeBook() {
  const root = new THREE.Group();
  const cover = toon(0x7a4a26), pages = toon(0xfff4d6), gold = toon(0xffd23f, { emissive: 0x6a4a00 }), gem = toon(0x5fe07a, { emissive: 0x1a6a2a, flat: true });
  const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); root.add(m); return m; };
  box(0.95, 0.07, 1.25, cover, 0, 0.19, 0);
  box(0.95, 0.07, 1.25, cover, 0, -0.19, 0);
  box(0.12, 0.45, 1.25, cover, -0.47, 0, 0);
  box(0.84, 0.31, 1.17, pages, 0.03, 0, 0);
  for (const sz of [-1, 1]) box(0.16, 0.08, 0.16, gold, 0.42, 0.21, sz * 0.56);
  box(0.1, 0.36, 0.2, gold, 0.5, 0, 0);
  const g = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), gem);
  g.scale.set(1, 0.45, 1.25);
  g.position.set(0.05, 0.24, 0);
  root.add(g);
  return root;
}

const GLOW_MAT = noOutline(new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));

/**
 * api (main.js): save, writeSave(), player, has(id) (owns that boss diamond), gems() / totalGems (golden
 * crystals found / there are), toast(html, secs), sfx, burst(...),
 * shake(a), onOpen() (the door opened), onBook() (Finn took the Enchiridion).
 */
export function createTemple(scene, api) {
  const T = TEMPLE, S = api.save.temple, pl = api.player.pos, F = T.y;
  const dx = Math.sin(T.door), dz = Math.cos(T.door), mid = (T.wall + T.inner) / 2;
  const doorX = T.x + dx * mid, doorZ = T.z + dz * mid;
  // the slab, with its three sockets and the crystals that shine in them
  const door = new THREE.Group();
  door.position.set(doorX, F, doorZ);
  door.rotation.y = T.door;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(T.doorW + 0.1, T.doorH, 0.4), toon(0xb8ab90, { tex: "stone", scale: 0.35 }));
  slab.position.y = T.doorH / 2;
  door.add(slab);
  const gems = CRYSTALS.map((c, i) => {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 10).rotateX(Math.PI / 2), toon(0x3a3228));
    s.position.set((i - 1) * 0.8, 2.3, 0.2);
    door.add(s);
    const m = makeCrystal(c.id);
    m.scale.setScalar(0.55);
    m.position.set((i - 1) * 0.8, 2.3, 0.3);
    door.add(m);
    return { id: c.id, m };
  });
  // the arch of golden crystal sockets over the diamonds: lit gold once found, dark stone until then
  const archN = api.totalGems, arch = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.09, 0), toon(0xffffff, { flat: true, outline: false }), archN);
  const _m = new THREE.Matrix4(), _c = new THREE.Color();
  for (let i = 0; i < archN; i++) {
    const a = -1.3 + (2.6 * i) / Math.max(1, archN - 1);
    arch.setMatrixAt(i, _m.makeTranslation(Math.sin(a) * 1.1, 2.45 + Math.cos(a) * 0.95, 0.24));
    arch.setColorAt(i, _c.set(0x3a3228));
  }
  door.add(arch);
  let archLit = -1;
  scene.add(door);
  const col = boxCollider(doorX - 0.3, doorX + 0.3, F, F + T.doorH, doorZ - T.doorW / 2 - 0.1, doorZ + T.doorW / 2 + 0.1);
  const book = makeBook();
  const glow = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), GLOW_MAT);
  scene.add(book, glow);
  // sink: how far the slab has gone down (0 shut .. 1 gone); near: Finn was at the door last step
  let sink = S.open ? 1 : 0, near = false;
  const shut = () => { col.y0 = F; col.y1 = F + T.doorH; };
  const gone = () => { col.y0 = col.y1 = -1e4; };
  if (S.open) gone();
  const missing = () => CRYSTALS.filter((c) => !api.has(c.id));
  const gemsLeft = () => api.totalGems - api.gems();

  function open() {
    S.open = true;
    api.writeSave();
    api.sfx("gate");
    api.sfx("portal");
    api.shake(0.5);
    api.burst(doorX + dx * 0.5, F + 2.3, doorZ + dz * 0.5, 40, [0xffffff, 0xfff2b0, 0x8fe8ff, 0xc98cff, 0xff8a3a], 5, 5, 0.3, 1);
    api.onOpen();
  }

  return {
    /** New game: shut again, the book back on its pedestal. */
    reset() { sink = 0; shut(); },
    /** Billy sets the three crystals in their sockets: the slab sinks. */
    open() { if (!S.open) open(); },
    step(dt) {
      if (api.player.dead > 0) return;
      // at the door (outside it): told what's missing, or (with all three) to talk to Billy
      const d = Math.hypot(pl.x - (doorX + dx * 1.2), pl.z - (doorZ + dz * 1.2));
      const at = !S.open && d < 3.2 && Math.abs(pl.y - F) < 2;
      if (at && !near) {
        const m = missing();
        if (!m.length && !gemsLeft()) api.toast(STR.temple.billy, 5);
        else api.toast(STR.temple.need(m.map((c) => STR.crystals.names[c.id]), gemsLeft()), 5);
      }
      near = at;
      if (S.open && sink < 1) sink = Math.min(1, sink + dt / 2.4);
      if (sink > 0.35) gone();
      // the Enchiridion
      if (S.open && !S.book && Math.hypot(pl.x - T.x, pl.z - T.z) < 1.6 && pl.y - F > -0.5 && pl.y - F < 2.6) {
        S.book = true;
        api.writeSave();
        api.burst(T.x, F + 1.9, T.z, 40, [0xffd23f, 0xffffff, 0x5fe07a], 7, 7, 0.5, 1.2);
        api.onBook();
      }
    },
    update(dt, time, cam) {
      const far = Math.hypot(cam.x - T.x, cam.z - T.z) > 150;
      door.visible = !far && sink < 1;
      if (door.visible) {
        door.position.y = F - sink * (T.doorH + 0.2) + (sink > 0 && sink < 1 ? (Math.random() - 0.5) * 0.04 : 0);
        const lit = api.gems();
        if (lit !== archLit) {
          archLit = lit;
          for (let i = 0; i < archN; i++) arch.setColorAt(i, _c.set(i < lit ? 0xffd23f : 0x3a3228));
          arch.instanceColor.needsUpdate = true;
        }
        for (const g of gems) {
          g.m.visible = api.has(g.id);
          g.m.rotation.y = time * 1.5;
        }
      }
      book.visible = glow.visible = !far && !S.book;
      if (book.visible) {
        book.position.set(T.x, F + 1.9 + Math.sin(time * 2) * 0.12, T.z);
        book.rotation.set(0.25, time * 0.6, 0);
        glow.position.copy(book.position);
        glow.scale.setScalar(1.1 + Math.sin(time * 3) * 0.08);
        if (S.open && Math.random() < dt * 6) api.burst(T.x + (Math.random() - 0.5), F + 1.6, T.z + (Math.random() - 0.5), 1, [0xfff2b0, 0x5fe07a], 0.6, 1.5, -0.3, 0.9);
      }
    },
    /** Dots for the minimap: fn(x, z, color). */
    dots(fn) {
      if (!S.book) fn(T.x, T.z, "#fff2b0");
    },
  };
}
