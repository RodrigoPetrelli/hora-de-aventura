// The Peppermint Butler's quest: five spirits got loose from his forbidden grimoire and hide around the
// Candy Kingdom (SPIRITS in candy.js). Once he has asked, each shows under a purple beam; walking into
// one catches it in his jar. With all five back he takes Finn and Jake to his Dark Lair for the fight
// (butler.js); once beaten, talking to him twice (the second time) starts a rematch. He only asks a hero
// who beat the Ice King (the Ice Crystal, crystals.js): before that he just sends Finn off to him.
// Progress lives in save.mint = { q, got, wins }: q is none | spirits | ready | won, got the indexes
// into SPIRITS already caught, wins how often Finn beat him.
import * as THREE from "three";
import { noOutline } from "./toon.js";
import { SPIRITS } from "./candy.js";
import { G, add, lathe, group, bake, decal, ellipse, BLACK } from "./shapes.js";
import { STR } from "./strings.js";

const BEAM_GEO = new THREE.CylinderGeometry(0.3, 0.3, 40, 8, 1, true);
const BEAM_MAT = noOutline(new THREE.MeshBasicMaterial({
  color: 0xc07aff, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
}));

/** A little ghost: a glowing lavender drop with a curling tail, round black eyes and an "o" of a mouth. */
function makeSpirit() {
  const root = new THREE.Group(), b = group(root, 0, 0, 0), C = 0xf4f0ff, E = { emissive: 0x6a5ab8 };
  const body = lathe(b, [[0.001, -0.18], [0.06, -0.08], [0.17, 0.08], [0.29, 0.25], [0.34, 0.48], [0.32, 0.72], [0.2, 0.9], [0.001, 0.95]], C, 0, 0, 0, { smooth: 20, seg: 16, ...E });
  const P = body.geometry.attributes.position; // curl the tail to one side
  for (let i = 0; i < P.count; i++) { const y = P.getY(i); if (y < 0.3) P.setX(i, P.getX(i) + 0.25 * ((0.3 - y) / 0.48) ** 2); }
  body.geometry.computeVertexNormals();
  for (const s of [-1, 1]) add(b, G.sph, C, s * 0.33, 0.5, 0.02, 0.08, 0.12, 0.07, { rz: s * 0.5, ...E });
  decal(body, [ellipse(0.045, 0.07, -0.1, 0.64), ellipse(0.045, 0.07, 0.1, 0.64)], BLACK, { lift: 0.004 });
  decal(body, ellipse(0.04, 0.05, 0, 0.47), 0x2a1a4a, { lift: 0.004 });
  bake(root);
  root.userData = { body: b };
  return root;
}

/**
 * api (main.js): save, writeSave(), player, toast(html, secs), sfx, burst(...), makeShadow(r),
 * enterLair() (off to the Dark Lair: main.js warps Finn and Jake there), locked() (no Ice Crystal yet).
 */
export function createSpirits(scene, api) {
  const S = api.save.mint, pl = api.player.pos, total = SPIRITS.length;
  const list = SPIRITS.map((p, i) => {
    const model = makeSpirit(), shadow = api.makeShadow(0.35), beam = new THREE.Mesh(BEAM_GEO, BEAM_MAT);
    model.scale.setScalar(1.25);
    shadow.position.set(p.x, p.y + 0.03, p.z);
    beam.position.set(p.x, p.y + 20.5, p.z);
    scene.add(model, shadow, beam);
    return { ...p, i, model, shadow, beam, caught: S.got.includes(i), fly: -1 };
  });
  const left = () => list.filter((p) => !p.caught).length;
  let lostOnce = false, rematch = false; // this session: he's been beaten once (retry lines) / he offered a rematch

  function goal() {
    const el = document.getElementById("quest2");
    const text = S.q === "spirits" ? STR.mint.goalSpirits(total - left(), total) : S.q === "ready" ? STR.mint.goalBack : "";
    el.hidden = !text;
    document.getElementById("quest2Text").textContent = text;
  }
  goal();

  function catchIt(p) {
    p.caught = true;
    p.fly = 0;
    if (!S.got.includes(p.i)) S.got.push(p.i);
    const n = total - left();
    api.sfx("spirit");
    api.burst(p.x, p.y + 1.2, p.z, 18, [0xe6ddff, 0xb070ff, 0xffffff], 4, 5, 0.3, 0.8);
    api.toast(STR.mint.caught(n, total));
    if (n === total) {
      S.q = "ready";
      setTimeout(() => api.toast(STR.mint.allCaught, 5), 1800);
    }
    api.writeSave();
    goal();
  }

  return {
    /** What the Butler says in the castle, by quest step. */
    lines() {
      if (S.q === "none") return api.locked() ? STR.mint.locked : STR.mint.offer;
      if (S.q === "spirits") return [STR.mint.progress(left()), STR.mint.hint, ...STR.dialog.pepbut.slice(2)];
      if (S.q === "ready") return lostOnce ? STR.mint.retry : STR.mint.challenge;
      return rematch ? STR.mint.rematch : STR.mint.after;
    },
    /** After a talk with him: the quest moves on (or it's off to the Dark Lair). */
    afterTalk() {
      if (S.q === "none") {
        if (api.locked()) return;
        S.q = "spirits";
        api.toast(STR.mint.accepted, 5);
        api.writeSave();
        goal();
      } else if (S.q === "ready" || (S.q === "won" && rematch)) {
        rematch = false;
        api.enterLair();
      } else if (S.q === "won") rematch = true;
    },
    /** Beaten in the Dark Lair (butler.js): true the first time. */
    won() {
      S.q = "won";
      S.wins = (S.wins || 0) + 1;
      api.writeSave();
      goal();
      return S.wins === 1;
    },
    /** Finn fainted in the Dark Lair. */
    lost() { lostOnce = true; },
    /** New game: everything back where it started. */
    reset() {
      for (const p of list) { p.caught = false; p.fly = -1; }
      lostOnce = rematch = false;
      goal();
    },
    step() {
      if (S.q !== "spirits" || api.player.dead > 0) return;
      for (const p of list) {
        if (p.caught) continue;
        const dx = pl.x - p.x, dz = pl.z - p.z;
        if (dx * dx + dz * dz < 1.8 * 1.8 && pl.y - p.y > -1 && pl.y - p.y < 2.6) catchIt(p);
      }
    },
    update(dt, time, cam, sealed) {
      for (const p of list) {
        let show = S.q === "spirits" && (!p.caught || p.fly >= 0) && !sealed;
        p.beam.visible = show && !p.caught;
        show = show && Math.hypot(cam.x - p.x, cam.z - p.z) < 110;
        p.model.visible = p.shadow.visible = show;
        if (!show) continue;
        const m = p.model;
        if (p.fly >= 0) {
          // sucked off into the Butler's jar: a spin up and away
          p.fly += dt;
          const u = Math.min(1, p.fly / 0.8);
          m.position.set(p.x, p.y + 1 + u * 3, p.z);
          m.rotation.y += dt * 18;
          m.scale.setScalar(1.25 * (1 - u));
          if (u >= 1) { p.fly = -1; api.burst(p.x, p.y + 4, p.z, 12, [0xe6ddff, 0xb070ff], 4, 3, 0.2, 0.6); }
          continue;
        }
        // drifting round its hiding place, bobbing, swaying its tail
        const a = time * 0.7 + p.i * 1.3;
        m.position.set(p.x + Math.sin(a) * 0.5, p.y + 1 + Math.sin(time * 2.2 + p.i) * 0.2, p.z + Math.cos(a) * 0.5);
        m.rotation.y = a + Math.PI / 2;
        m.userData.body.rotation.z = 0.12 * Math.sin(time * 3 + p.i);
        p.shadow.position.set(m.position.x, p.y + 0.03, m.position.z);
      }
    },
    /** Dots for the minimap: fn(x, z, color). */
    dots(fn) {
      if (S.q === "spirits") for (const p of list) if (!p.caught) fn(p.x, p.z, "#c07aff");
    },
  };
}
