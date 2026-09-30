// The Ice King's quest: his penguins ran off across the Ice Kingdom (PENGUINS in ice.js). He asks
// Finn to bring them back; walking up to one rescues it (they only show, each under a blue beam,
// once he has asked). With all five home he challenges Finn and flies up to the Ice Crown, where
// the fight is (boss.js); after losing he stays up there, and talking to him starts a rematch.
// He only asks once Billy has sent Finn after the crystals (billy.js): before that he sends him to Billy.
// Progress lives in save.ice = { q, pengs, wins }: q is none | penguins | rescued | boss | won,
// pengs the indexes into PENGUINS already rescued, wins how often Finn beat him.
import * as THREE from "three";
import { makeNpc, poseNpc } from "./npcs.js";
import { noOutline } from "./toon.js";
import { PENGUINS, CROWN } from "./ice.js";
import { STR } from "./strings.js";

const BEAM_GEO = new THREE.CylinderGeometry(0.3, 0.3, 40, 8, 1, true);
const BEAM_MAT = noOutline(new THREE.MeshBasicMaterial({
  color: 0x8fe3ff, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
}));

/**
 * api (main.js): save, writeSave(), player, king (the Ice King's npc record in his hall), boss,
 * toast(html, secs), sfx, burst(...), makeShadow(r), locked() (Billy hasn't sent Finn yet).
 */
export function createQuest(scene, api) {
  const S = api.save.ice, pl = api.player.pos, total = PENGUINS.length;
  const pengs = PENGUINS.map((p, i) => {
    const model = makeNpc("gunter"), shadow = api.makeShadow(0.4), beam = new THREE.Mesh(BEAM_GEO, BEAM_MAT);
    model.scale.setScalar(1.3);
    model.position.set(p.x, p.y, p.z);
    model.rotation.y = p.yaw;
    shadow.position.set(p.x, p.y + 0.03, p.z);
    beam.position.set(p.x, p.y + 20.5, p.z);
    scene.add(model, shadow, beam);
    return { ...p, i, model, shadow, beam, saved: S.pengs.includes(i), hop: -1 };
  });
  const left = () => pengs.filter((p) => !p.saved).length;

  function goal() {
    const el = document.getElementById("quest");
    const text = S.q === "penguins" ? STR.ice.goalPengs(total - left(), total) : S.q === "rescued" ? STR.ice.goalBack : S.q === "boss" ? STR.ice.goalCrown : "";
    el.hidden = !text;
    document.getElementById("questText").textContent = text;
  }
  function flyOff() {
    // off to the crown in a puff of snow
    const k = api.king;
    api.burst(k.x, k.y + 1.2, k.z, 40, [0xffffff, 0xbfeaff, 0x1d3fd8], 7, 9, 0.4, 1.2);
    api.sfx("whoosh");
    k.hidden = true;
  }
  // where the story was left off
  if (S.q === "boss") { api.king.hidden = true; api.boss.arm(); }
  if (S.q === "won") { api.king.hidden = true; api.boss.rest(); }
  goal();

  function rescue(p) {
    p.saved = true;
    p.hop = 0;
    if (!S.pengs.includes(p.i)) S.pengs.push(p.i);
    const n = total - left();
    api.sfx("wenk");
    api.burst(p.x, p.y + 0.6, p.z, 18, [0xffffff, 0xbfeaff, 0x1b2530], 4, 5, 0.6, 0.8);
    api.toast(STR.ice.rescued(n, total));
    if (n === total) {
      S.q = "rescued";
      setTimeout(() => api.toast(STR.ice.allRescued, 5), 1800);
    }
    api.writeSave();
    goal();
  }

  return {
    /** What the Ice King says in his hall, by quest step. */
    lines() {
      if (S.q === "none") return api.locked() ? STR.ice.locked : STR.ice.offer;
      if (S.q === "penguins") return [STR.ice.progress(left()), STR.ice.pengHint, ...STR.dialog.iceking.slice(1)];
      if (S.q === "rescued") return STR.ice.challenge;
      return STR.dialog.iceking;
    },
    /** After a talk with him in his hall: the quest moves on. */
    afterTalk() {
      if (S.q === "none") {
        if (api.locked()) return;
        S.q = "penguins";
        api.toast(STR.ice.accepted, 5);
      } else if (S.q === "rescued") {
        S.q = "boss";
        flyOff();
        api.boss.arm();
        setTimeout(() => api.toast(STR.ice.flewOff, 5), 700);
      } else return;
      api.writeSave();
      goal();
    },
    /** Beaten on the crown (boss.js). */
    won() {
      S.q = "won";
      S.wins = (S.wins || 0) + 1;
      api.writeSave();
      goal();
    },
    /** New game: everything back where it started. */
    reset() {
      for (const p of pengs) { p.saved = false; p.hop = -1; }
      api.king.hidden = false;
      goal();
    },
    step(dt) {
      if (S.q !== "penguins" || api.player.dead > 0) return;
      for (const p of pengs) {
        if (p.saved) continue;
        const dx = pl.x - p.x, dz = pl.z - p.z;
        if (dx * dx + dz * dz < 1.7 * 1.7 && Math.abs(pl.y - p.y) < 2) rescue(p);
      }
    },
    update(dt, time, cam, sealed) {
      for (const p of pengs) {
        let show = S.q === "penguins" && (!p.saved || p.hop >= 0) && !sealed;
        const d = Math.hypot(cam.x - p.x, cam.z - p.z);
        p.beam.visible = show && !p.saved;
        show = show && d < 110;
        p.model.visible = p.shadow.visible = show;
        if (!show) continue;
        if (p.hop >= 0) {
          // a happy hop and a spin, then off home in a puff
          p.hop += dt;
          const u = Math.min(1, p.hop / 0.75);
          p.model.position.y = p.y + Math.sin(Math.PI * u) * 1.3;
          p.model.rotation.y += dt * 14;
          p.model.scale.setScalar(1.3 * (u > 0.8 ? (1 - u) / 0.2 : 1));
          if (u >= 1) {
            p.hop = -1;
            api.burst(p.x, p.y + 0.8, p.z, 14, [0xffffff, 0xdff5ff], 4, 4, 0.5, 0.7);
          }
          continue;
        }
        p.model.position.y = p.y + Math.abs(Math.sin(time * 3 + p.i)) * 0.08;
        poseNpc(p.model, { time, near: Math.hypot(pl.x - p.x, pl.z - p.z), talking: false }, dt);
      }
    },
    /** Dots for the minimap: fn(x, z, color). */
    dots(fn) {
      if (S.q === "penguins") for (const p of pengs) if (!p.saved) fn(p.x, p.z, "#8fe3ff");
      if (S.q === "boss") fn(CROWN.x, CROWN.z, "#8fe3ff");
    },
  };
}
