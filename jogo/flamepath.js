// Flame Princess's quest, the Path of Flames: by the old law of fire, her father the Flame King
// (locked in his lantern in her throne room) may challenge the crown to a duel in the Colosseum of
// Flames, and he has; she can't fight him without losing control of her flame, so Finn is her
// champion. But the colosseum only opens once the champion himself has carried the Royal Flame along
// the Path of Flames: five braziers round the Fire Palace (BRAZIERS in kingdoms.js), lit in order,
// against the clock. She hands Finn the flame; it floats over his shoulder and dies down as the
// seconds run out (he's a wet human: it doesn't last). Each brazier lit gives it a fresh start for the
// next stretch; if it goes out, the last brazier lit (or Flame Princess herself) relights it. With all
// five burning she sends Finn and Jake through the flames to the fight (flameking.js); once her
// father is beaten, talking to her twice (the second time) starts a rematch.
// Progress lives in save.fire = { q, lit, wins }: q is none | path | ready | won, lit how many of the
// braziers burn, wins how often Finn beat him.
import * as THREE from "three";
import { noOutline } from "./toon.js";
import { BRAZIERS } from "./kingdoms.js";
import { cylCollider } from "./physics.js";
import { G, add, lathe, group, bake } from "./shapes.js";
import { STR } from "./strings.js";

const TAU = Math.PI * 2;
const BEAM_GEO = new THREE.CylinderGeometry(0.35, 0.35, 40, 8, 1, true);
const BEAM_MAT = noOutline(new THREE.MeshBasicMaterial({
  color: 0xff8a2a, transparent: true, opacity: 0.34, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
}));
const FLAME = 0xffa53b, CORE = 0xfff08a;
const FLAME_MAT = noOutline(new THREE.MeshBasicMaterial({ color: FLAME })), CORE_MAT = noOutline(new THREE.MeshBasicMaterial({ color: CORE }));

/** A brazier of the path: a stone pedestal, a bronze bowl of coals, a fire (hidden until it's lit). */
function makeBrazier() {
  const root = new THREE.Group();
  lathe(root, [[0.001, 0], [0.55, 0], [0.55, 0.12], [0.34, 0.25], [0.28, 0.8], [0.42, 0.95], [0.001, 0.95]], 0x5a4848, 0, 0, 0, { seg: 10 });
  lathe(root, [[0.001, 0.9], [0.4, 0.95], [0.72, 1.3], [0.76, 1.42], [0.62, 1.38], [0.001, 1.32]], 0xb8742e, 0, 0, 0, { seg: 14, emissive: 0x2a1000 });
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; add(root, G.sph, 0x2a1a18, Math.sin(a) * 0.3, 1.36, Math.cos(a) * 0.3, 0.16, 0.1, 0.16); }
  const fire = group(root, 0, 1.3, 0);
  const cone = (x, z, r, h, m) => { const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7).translate(0, h / 2, 0), m); c.position.set(x, 0, z); fire.add(c); };
  cone(0, 0, 0.55, 1.9, FLAME_MAT); cone(0.3, 0.1, 0.25, 1.1, FLAME_MAT); cone(-0.28, -0.15, 0.25, 1.3, FLAME_MAT); cone(0.05, -0.3, 0.22, 0.9, FLAME_MAT); cone(0, 0, 0.3, 1.1, CORE_MAT);
  bake(root);
  fire.visible = false;
  root.userData = { fire };
  return root;
}
/** The Royal Flame Finn carries: a little fire floating over his shoulder. */
function makeRoyalFlame() {
  const root = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.62, 8).translate(0, 0.25, 0), noOutline(new THREE.MeshBasicMaterial({ color: FLAME })));
  const inner = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.36, 7).translate(0, 0.14, 0), noOutline(new THREE.MeshBasicMaterial({ color: CORE })));
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), noOutline(new THREE.MeshBasicMaterial({ color: FLAME })));
  root.add(ball, outer, inner);
  root.userData = { outer, inner };
  return root;
}

/**
 * api (main.js): save, writeSave(), player, flame (Flame Princess's npc record: she relights the flame),
 * toast(html, secs), sfx, burst(...), jakeSay(text), enterColosseum() (off to the Colosseum of Flames),
 * locked() (no Night Crystal yet: she won't send a champion who hasn't beaten the Peppermint Butler).
 */
export function createFlamePath(scene, api) {
  const S = api.save.fire, pl = api.player.pos, total = BRAZIERS.length;
  const list = BRAZIERS.map((p, i) => {
    const model = makeBrazier(), beam = new THREE.Mesh(BEAM_GEO, BEAM_MAT);
    model.scale.setScalar(p.small ? 1.0 : 1.3);
    model.position.set(p.x, p.y, p.z);
    beam.position.set(p.x, p.y + 20.5, p.z);
    beam.visible = false;
    scene.add(model, beam);
    if (!p.small) cylCollider(p.x, p.z, 0.85, p.y, p.y + 1.8);
    return { ...p, i, model, beam };
  });
  const flame = makeRoyalFlame();
  flame.visible = false;
  scene.add(flame);
  // the run: carried (Finn has the flame), left (s before it dies), leg (the brazier it's headed for)
  const R = { carried: false, left: 0, warned: false, shown: -1 };
  let lostOnce = false, rematch = false; // this session: Finn fainted in the arena (retry lines) / she offered a rematch

  /** Where the flame is relit when it's out: the last brazier lit, or Flame Princess (none yet). */
  const relight = () => (S.lit > 0 ? list[S.lit - 1] : null);
  function goal() {
    const el = document.getElementById("quest3");
    let text = "";
    if (S.q === "path") {
      if (R.carried) text = STR.fire.goalRun(S.lit, total, Math.ceil(R.left));
      else text = S.lit > 0 ? STR.fire.goalRelight(S.lit) : STR.fire.goalFlame;
    } else if (S.q === "ready") text = STR.fire.goalBack;
    el.hidden = !text;
    document.getElementById("quest3Text").textContent = text;
    el.classList.toggle("hurry", R.carried && R.left < 5);
  }
  const touching = (p, r = 2.2) => Math.hypot(pl.x - p.x, pl.z - p.z) < r && pl.y - p.y > -1 && pl.y - p.y < 3;

  function take() {
    R.carried = true;
    R.left = list[S.lit].time;
    R.warned = false;
    api.sfx("ember");
    api.burst(pl.x, pl.y + 2, pl.z, 16, [0xffd24a, 0xff8a2a, 0xffffff], 4, 4, 0.3, 0.7);
    goal();
  }
  function lightNext() {
    const b = list[S.lit];
    S.lit++;
    b.model.userData.fire.visible = true;
    api.sfx("eruption");
    api.sfx("ready");
    api.burst(b.x, b.y + 2, b.z, 30, [0xffd24a, 0xff8a2a, 0xffffff], 7, 7, 0.5, 1);
    if (S.lit === total) {
      S.q = "ready";
      R.carried = false;
      api.toast(STR.fire.allLit, 5);
    } else {
      R.left = list[S.lit].time;
      R.warned = false;
      api.toast(STR.fire.lit(S.lit, total), 2.4);
    }
    api.writeSave();
    goal();
  }
  function goOut(quiet = false) {
    if (!R.carried) return;
    R.carried = false;
    if (!quiet) {
      api.sfx("hiss");
      api.burst(flame.position.x, flame.position.y, flame.position.z, 14, [0x4a4040, 0x8a8080, 0xff8a2a], 3, 3, 0.2, 0.9);
      api.toast(S.lit > 0 ? STR.fire.outRelight : STR.fire.outFlame, 4);
    }
    goal();
  }
  function showLit() {
    list.forEach((b, i) => (b.model.userData.fire.visible = S.q !== "none" && i < S.lit));
  }
  showLit();
  goal();

  return {
    /** What Flame Princess says in her throne room, by quest step. */
    lines() {
      if (S.q === "none") return api.locked() ? STR.fire.locked : STR.fire.offer;
      if (S.q === "path") return [STR.fire.progress(total - S.lit), STR.fire.where[S.lit], ...STR.dialog.flame.slice(1)];
      if (S.q === "ready") return lostOnce ? STR.fire.retry : STR.fire.challenge;
      return rematch ? STR.fire.rematch : STR.fire.after;
    },
    /** After a talk with her: the run starts (she hands Finn the flame), or it's off to the Colosseum of Flames. */
    afterTalk() {
      if (S.q === "none") {
        if (api.locked()) return;
        S.q = "path";
        S.lit = 0;
        api.toast(STR.fire.accepted, 5);
        api.writeSave();
        take();
      } else if (S.q === "path" && !R.carried && S.lit === 0) take();
      else if (S.q === "ready" || (S.q === "won" && rematch)) {
        rematch = false;
        api.enterColosseum();
      } else if (S.q === "won") rematch = true;
    },
    /** Beaten in the Colosseum of Flames (flameking.js): true the first time. */
    won() {
      S.q = "won";
      S.wins = (S.wins || 0) + 1;
      api.writeSave();
      goal();
      return S.wins === 1;
    },
    /** Finn fainted in the arena. */
    lost() { lostOnce = true; },
    /** Finn fainted anywhere: the flame goes out with him. */
    fainted() { goOut(true); },
    /** New game: everything back where it started. */
    reset() {
      R.carried = false;
      lostOnce = rematch = false;
      showLit();
      goal();
    },
    step(dt) {
      if (S.q !== "path" || api.player.dead > 0) return;
      if (R.carried) {
        R.left -= dt;
        if (!R.warned && R.left < 4) { R.warned = true; api.jakeSay(STR.jake.hurry); }
        if (R.left <= 0) { goOut(); return; }
        if (Math.ceil(R.left) !== R.shown) { R.shown = Math.ceil(R.left); goal(); }
        if (touching(list[S.lit])) lightNext();
      } else {
        // relit by the last brazier that burns, or by Flame Princess when none does yet
        const at = relight(), fp = api.flame;
        if (at ? touching(at) : Math.hypot(pl.x - fp.x, pl.z - fp.z) < 3.5 && Math.abs(pl.y - fp.y) < 2) take();
      }
    },
    update(dt, time, cam, sealed) {
      const run = S.q === "path";
      // the beam over where to go: the next brazier while the flame burns, the one to relight it at when it's out
      const target = !run ? null : R.carried ? list[S.lit] : relight();
      for (const b of list) {
        b.beam.visible = run && b === target && !sealed;
        const f = b.model.userData.fire;
        b.model.visible = !sealed && Math.hypot(cam.x - b.x, cam.z - b.z) < 150;
        if (!f.visible || !b.model.visible) continue;
        f.scale.set(1 + 0.05 * Math.sin(time * 7 + b.i), 1 + 0.16 * Math.sin(time * 11 + b.i) + 0.07 * Math.sin(time * 23 + b.i), 1 + 0.05 * Math.cos(time * 8 + b.i));
        if (Math.random() < dt * 5) api.burst(b.x, b.y + (b.small ? 2.2 : 3.2), b.z, 1, [0xffd24a, 0xff8a2a], 1, 2, 0.1, 0.9);
      }
      // the Royal Flame over Finn's shoulder: it shrinks as it runs out, and flickers at the end
      flame.visible = run && R.carried && api.player.dead <= 0;
      if (flame.visible) {
        const h = api.player.heading, k = Math.max(0.35, Math.min(1, R.left / 8));
        const tx = pl.x + Math.cos(h) * -0.7 - Math.sin(h) * 0.3, tz = pl.z - Math.sin(h) * -0.7 - Math.cos(h) * 0.3, ty = pl.y + 2.3 + Math.sin(time * 3) * 0.12;
        flame.position.x += (tx - flame.position.x) * Math.min(1, dt * 10);
        flame.position.y += (ty - flame.position.y) * Math.min(1, dt * 10);
        flame.position.z += (tz - flame.position.z) * Math.min(1, dt * 10);
        flame.scale.setScalar(k * (1 + 0.1 * Math.sin(time * 17)));
        flame.userData.outer.scale.y = 1 + 0.2 * Math.sin(time * 13);
        if (R.left < 3 && Math.floor(time * 8) % 2) flame.scale.multiplyScalar(0.6);
        if (Math.random() < dt * 12) api.burst(flame.position.x, flame.position.y + 0.3, flame.position.z, 1, [0xffd24a, 0xff8a2a], 0.6, 1.2, 0, 0.5);
      } else flame.position.set(pl.x, pl.y + 2.3, pl.z);
    },
    /** Dots for the minimap: fn(x, z, color). */
    dots(fn) {
      if (S.q !== "path") return;
      const t = R.carried ? list[S.lit] : relight();
      if (t) fn(t.x, t.z, "#ff8a2a");
    },
  };
}
