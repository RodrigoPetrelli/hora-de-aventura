// The twist at the end of Billy's quest ("The Lich", season 4 finale): Billy was the Lich all along,
// wearing the old hero's body. Once Finn walks out of the temple with the Enchiridion, "Billy" asks to
// hold it; the book flies to his hand, the body tears open (npcs.js: `lich`, the same model gone
// rotten, skull and horns showing) and the Lich tells Finn the truth, opens a dark portal in front
// of the temple and steps through it with the book. The portal stays: it leads to his dimension, a
// cave far from everything (lichcave.js: CAVE, at P.lich, 400 u up: nobody walks there) with
// mountains of skulls all round, where he waits in the middle on a heap of them, the Enchiridion
// floating by his claw.
// Talking to him there starts the last fight (lichboss.js); beaten, he leaves an echo of green fire on
// the heap (talk to it twice: a rematch).
// Progress lives in save.lich = { q, wins }: none (Billy is still Billy) | portal (the twist happened, the
// portal is open) | cave (Finn has been in there) | won (the Lich is beaten, the book is Finn's).
import * as THREE from "three";
import { noOutline } from "./toon.js";
import { smooth } from "./terrain.js";
import { glowTexture } from "./lair.js";
import { CAVE } from "./lichcave.js";
import { TEMPLE, makeBook } from "./temple.js";
import { makeNpc, poseNpc } from "./npcs.js";
import { STR } from "./strings.js";

const TAU = Math.PI * 2;

/** The swirl of a dark portal: a black eye, green and violet arms turning into it, fading at the rim. */
let _swirl = null;
function swirlTexture() {
  if (_swirl) return _swirl;
  const s = 256, c = document.createElement("canvas");
  c.width = c.height = s;
  const x = c.getContext("2d"), g = x.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(0,0,0,1)");
  g.addColorStop(0.55, "rgba(6,18,10,1)");
  g.addColorStop(0.88, "rgba(18,60,26,0.95)");
  g.addColorStop(1, "rgba(60,200,80,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, s, s);
  x.lineCap = "round";
  for (let arm = 0; arm < 7; arm++) {
    x.strokeStyle = arm % 2 ? "rgba(120,70,220,0.45)" : "rgba(90,220,70,0.5)";
    x.lineWidth = 7;
    x.beginPath();
    for (let i = 0; i <= 50; i++) {
      const t = i / 50, a = arm * (TAU / 7) + t * 5, rad = (0.08 + t * 0.9) * s * 0.48;
      const px = s / 2 + Math.cos(a) * rad, py = s / 2 + Math.sin(a) * rad;
      i ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.stroke();
  }
  _swirl = new THREE.CanvasTexture(c);
  _swirl.colorSpace = THREE.SRGBColorSpace;
  return _swirl;
}

/** A dark portal (faces +z; stands on y = 0): the swirl, a green rim, a glow; grow it with `open` (0..1). */
function makePortal() {
  const g = new THREE.Group(), inner = new THREE.Group();
  inner.position.y = 2.9;
  inner.scale.set(1, 1.25, 1);
  g.add(inner);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(2.2, 40), noOutline(new THREE.MeshBasicMaterial({ map: swirlTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false })));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(2.25, 0.13, 8, 44), noOutline(new THREE.MeshBasicMaterial({ color: 0x7dff5a })));
  const glow = new THREE.Sprite(noOutline(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x3ad85a, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending })));
  glow.scale.set(6.5, 6.5, 1);
  inner.add(glow, disc, rim);
  g.userData = { disc, rim, inner, open: 0 };
  g.visible = false;
  return g;
}
function posePortal(g, open, time) {
  const u = g.userData;
  g.visible = open > 0.01;
  if (!g.visible) return;
  u.inner.scale.set(open, 1.25 * open, open);
  u.disc.rotation.z = -time * 1.8;
  u.rim.material.color.setHex(0x7dff5a).multiplyScalar(0.8 + 0.2 * Math.sin(time * 5));
}

/**
 * api (main.js): save, writeSave(), player, billy (Billy's npc record), bookTaken(), ground(x, z),
 * toast(html, secs), sfx, burst(...), shake(a), jakeSay(text), jakeJoin(), makeShadow(r),
 * talk(who, lines, after) (opens a dialog), talking(who), warp(to, done) (the green teleport),
 * place(x, y, z, tx, tz) (Finn there, facing (tx, tz)), face(x, y, z) (Finn and the camera turn to look at it), news() (the journal and the objective box),
 * fight() (the last fight starts: lichboss.js), fighting(), bossBook() (where the book floats while they fight, or null).
 */
export function createLich(scene, api) {
  const S = api.save.lich, pl = api.player.pos, bn = api.billy, T = TEMPLE;
  const model = makeNpc("lich"), shadow = api.makeShadow(0.5);
  model.visible = shadow.visible = false;
  scene.add(model, shadow);
  // his echo, after he lost: his true form in ghostly green fire, flickering on the heap
  const echo = makeNpc("lichTrue"), echoMat = noOutline(new THREE.MeshBasicMaterial({ color: 0x4aff5a, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  echo.traverse((o) => { if (o.isMesh) o.material = echoMat; });
  echo.scale.setScalar(1.2);
  echo.visible = false;
  scene.add(echo);
  let echoN = 0;
  const who = { id: "lich", name: STR.names.lich };
  // the Enchiridion, now his, with a sickly green glow round it
  const book = makeBook();
  book.scale.setScalar(0.6);
  const glow = new THREE.Sprite(noOutline(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x6dff4a, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending })));
  glow.scale.setScalar(2);
  book.visible = glow.visible = false;
  scene.add(book, glow);
  // the portal in front of the temple (it faces the door) and the one out of the cave
  const out = makePortal(), home = makePortal();
  const ox = T.x - 15.5, oz = T.z + 2.6;
  out.position.set(ox, api.ground(ox, oz), oz);
  out.rotation.y = Math.PI / 2;
  const ha = CAVE.spawnA, hx = CAVE.x + Math.sin(ha) * CAVE.portal, hz = CAVE.z + Math.cos(ha) * CAVE.portal;
  home.position.set(hx, CAVE.y, hz);
  home.rotation.y = ha + Math.PI;
  home.userData.open = 1;
  home.userData.shut = false;
  scene.add(out, home);
  // where he stands in his cave: on the heap in the middle, facing the way in
  const lair = { x: CAVE.x, y: CAVE.y + CAVE.top, z: CAVE.z, yaw: CAVE.spawnA };

  // the cutscene at the temple: ask (Billy asks for the book) → fly (it flies to his hand) → morph
  // (the body tears open) → speech (the Lich talks) → cast (the portal opens, he walks into it) → idle
  // show: his model is up at the temple (it flickers with Billy's while the body tears open)
  const R = { st: "idle", t: 0, from: new THREE.Vector3(), x: 0, y: 0, z: 0, yaw: 0, fade: 1, show: false, morphed: false };
  let inCave = false, near = null, talked = false;
  const set = (st) => { R.st = st; R.t = 0; };
  const busy = () => R.st !== "idle";
  const place = (x, y, z) => { R.x = x; R.y = y; R.z = z; };
  if (S.q !== "none") { bn.hidden = true; out.userData.open = 1; }

  function morph() {
    // Billy's body tears open: the Lich shows through
    R.morphed = R.show = true;
    bn.hidden = true;
    api.burst(bn.x, bn.y + 2.4, bn.z, 50, [0x7dff5a, 0x1a2a1a, 0xb58aff, 0xe6ead8], 7, 7, 0.4, 1.3);
    api.sfx("darkBoom");
    api.sfx("roar");
    api.shake(0.7);
  }

  return {
    busy,
    /** Finn is in the cave (for the camera ring, Jake and the minimap). */
    holds: (p) => p.y > CAVE.y - 10 && Math.hypot(p.x - CAVE.x, p.z - CAVE.z) < CAVE.wall + 3,
    /** The Lich (or his echo) in his cave, when Finn is in there to talk to him. */
    talker: () => (inCave && !api.fighting() ? lair : null),
    who,
    /** Who Finn is talking to (the Lich, or his echo after he lost). */
    name: () => (S.q === "won" ? STR.names.lichEcho : STR.names.lich),
    lines() {
      if (S.q === "won") return ++echoN >= 2 ? [STR.lich.echoFight] : STR.lich.echo;
      if (!talked) { talked = true; return STR.lich.cave; }
      return [STR.lich.again[Math.floor(Math.random() * STR.lich.again.length)]];
    },
    /** Once the talk is over: the fight (after he lost, only the second time Finn talks to his echo). */
    afterTalk() {
      if (S.q === "won" && echoN < 2) return;
      echoN = 0;
      api.fight();
    },
    /** What's next (the objective box and the journal). */
    goal: () => STR.lich.goal[S.q] || "",
    next: () => STR.lich.next[S.q],
    reset() {
      set("idle");
      R.show = inCave = false;
      out.userData.open = 0;
      bn.hidden = false;
      talked = false;
      echoN = 0;
    },
    step(dt) {
      R.t += dt;
      const p = api.player;
      // Finn walks out of the temple with the book, and "Billy" is waiting by the door
      if (R.st === "idle" && S.q === "none" && api.bookTaken() && !bn.hidden && p.dead <= 0 && !api.dialogOpen() &&
        Math.hypot(pl.x - T.x, pl.z - T.z) > T.wall + 0.8 && Math.hypot(pl.x - bn.x, pl.z - bn.z) < 14 && Math.abs(pl.y - bn.y) < 4) {
        set("ask");
        api.face(bn.x, bn.y, bn.z);
        api.talk(bn, STR.lich.ask, () => {
          set("fly");
          R.from.set(pl.x, pl.y + 1.3, pl.z);
          api.sfx("whoosh");
        });
      }
      if (R.st === "fly" && R.t > 1.0) {
        set("morph");
        R.morphed = false;
        place(bn.x, bn.y, bn.z);
        model.rotation.y = bn.model.rotation.y;
        api.toast(STR.lich.morph, 3);
        api.sfx("charge");
      }
      if (R.st === "morph") {
        // he shudders, green light bursting out of him; the two faces flicker; then the Lich
        if (Math.random() < dt * 14) api.burst(bn.x + (Math.random() - 0.5) * 1.5, bn.y + 1 + Math.random() * 2.5, bn.z + (Math.random() - 0.5) * 1.5, 3, [0x7dff5a, 0x2a4a2a], 3, 3, 0.2, 0.7);
        if (R.t < 1.8) bn.hidden = R.show = R.t > 0.9 && Math.floor(R.t * 9) % 2 === 0;
        else if (!R.morphed) morph();
        if (R.t > 3.2) {
          set("speech");
          api.face(bn.x, bn.y, bn.z);
          api.talk(who, STR.lich.reveal, () => {
            set("cast");
            api.sfx("summon");
          });
        }
      }
      if (R.st === "cast") {
        // arms up: the portal tears open behind him; then he walks into it with the book
        out.userData.open = smooth(0.6, 2.2, R.t);
        if (R.t > 0.6 && R.t - dt <= 0.6) { api.sfx("portal"); api.shake(0.5); }
        if (Math.random() < dt * 20 && R.t < 2.4) api.burst(ox, out.position.y + 2.9, oz, 3, [0x7dff5a, 0xb58aff, 0x0a140a], 4, 4, 0.1, 0.8);
        if (R.t > 2.6) {
          const k = Math.min(1, (R.t - 2.6) / 1.8);
          R.yaw = Math.atan2(ox - bn.x, oz - bn.z);
          R.x = bn.x + (ox - bn.x) * k;
          R.z = bn.z + (oz - bn.z) * k;
          R.fade = 1 - smooth(0.75, 1, k);
        }
        if (R.t > 4.5) {
          S.q = "portal";
          R.show = false;
          api.writeSave();
          api.burst(ox, out.position.y + 2.9, oz, 30, [0x7dff5a, 0xb58aff], 5, 5, 0.2, 1);
          api.sfx("warp");
          api.toast(STR.lich.portal, 8);
          api.news();
          setTimeout(() => api.jakeSay(STR.jake.lichReveal), 1500);
          set("idle");
        }
      }
      // through a portal: in (from the temple) or out (from the cave)
      if (R.st === "idle" && p.dead <= 0 && !api.dialogOpen()) {
        const inOut = S.q !== "none" && Math.hypot(pl.x - ox, pl.z - oz) < 1.2 && Math.abs(pl.y - out.position.y) < 3;
        const inHome = inCave && !api.fighting() && home.userData.open > 0.9 && Math.hypot(pl.x - hx, pl.z - hz) < 1.5 && Math.abs(pl.y - CAVE.y) < 3;
        if (inOut) {
          const first = S.q === "portal";
          api.warp(() => {
            const d = 22, a = CAVE.spawnA;
            api.place(CAVE.x + Math.sin(a) * d, CAVE.y, CAVE.z + Math.cos(a) * d, CAVE.x, CAVE.z);
            S.q = "cave";
            api.writeSave();
            inCave = true;
          }, () => {
            api.jakeJoin();
            api.toast(first ? STR.lich.enter : STR.lich.back, 6);
            setTimeout(() => api.jakeSay(STR.jake.lichCave), 2500);
            api.news();
          });
        } else if (inHome) {
          api.warp(() => {
            inCave = false;
            api.place(ox + 3, out.position.y, oz, T.x, T.z);
          });
        }
      }
    },
    update(dt, time, cam) {
      // his model: at the temple during the cutscene, in the cave afterwards
      const here = Math.hypot(cam.x - CAVE.x, cam.z - CAVE.z) < 60 && cam.y > CAVE.y - 20, fight = api.fighting();
      if (R.show || busy()) model.visible = R.show;
      else {
        model.visible = S.q !== "none" && S.q !== "won" && !fight && here;
        place(lair.x, lair.y, lair.z);
        R.fade = 1;
      }
      if (model.visible) {
        model.position.set(R.x, R.y, R.z);
        model.scale.setScalar(R.fade);
        const d = Math.hypot(pl.x - R.x, pl.z - R.z);
        const target = R.st === "cast" && R.t > 2.6 ? R.yaw : Math.atan2(pl.x - R.x, pl.z - R.z);
        model.rotation.y += Math.atan2(Math.sin(target - model.rotation.y), Math.cos(target - model.rotation.y)) * Math.min(1, 3 * dt);
        poseNpc(model, { time, near: d, talking: api.talking(who) }, dt);
        const u = model.userData;
        if (R.st === "cast" && R.t < 2.8) {
          // both arms raised to the sky
          const k = smooth(0, 0.5, R.t);
          u.arms.forEach((A, i) => { A.sh.rotation.x += (-2.7 - A.sh.rotation.x) * k; A.sh.rotation.z += ((i ? 0.35 : -0.35) - A.sh.rotation.z) * k; A.el.rotation.x = -0.3 * k; });
        }
      }
      shadow.visible = model.visible;
      if (shadow.visible) { shadow.position.set(R.x, R.y + 0.03, R.z); shadow.scale.setScalar(R.fade); }
      // his echo on the heap, flickering
      echo.visible = S.q === "won" && !fight && here;
      if (echo.visible) {
        echo.position.set(lair.x, lair.y + 0.3 + Math.sin(time * 1.3) * 0.15, lair.z);
        echo.rotation.y = turn(echo.rotation.y, Math.atan2(pl.x - lair.x, pl.z - lair.z), dt);
        echoMat.opacity = 0.22 + 0.1 * Math.sin(time * 7) + (Math.random() < 0.05 ? 0.15 : 0);
        poseNpc(echo, { time, near: Math.hypot(pl.x - lair.x, pl.z - lair.z), talking: api.talking(who) }, dt);
      }
      // the Enchiridion: flying to him, then floating by his bony hand (in the fight: over the heap in the middle)
      const fb = api.bossBook();
      book.visible = glow.visible = R.st === "fly" || !!fb || (model.visible && R.fade > 0.2);
      if (book.visible) {
        if (fb) {
          book.position.set(fb.x, fb.y + Math.sin(time * 2) * 0.12, fb.z);
          book.rotation.set(0.25, time * 0.8, 0);
          book.scale.setScalar(0.85);
          if (CAVE.fx) CAVE.fx.book.copy(book.position);
        } else if (R.st === "fly") {
          const k = smooth(0, 1, R.t / 1.0);
          book.position.lerpVectors(R.from, _v.set(bn.x, bn.y + 2.6, bn.z), k);
          book.position.y += Math.sin(k * Math.PI) * 1.6;
          book.rotation.set(0.3, time * 8, 0);
        } else {
          model.userData.arms[0].el.localToWorld(book.position.set(0, -1.15, 0.2));
          book.position.y += Math.sin(time * 2) * 0.1;
          book.rotation.set(0.25, time * 0.8, 0);
          book.scale.setScalar(0.6 * R.fade);
        }
        glow.position.copy(book.position);
        if (!R.show && CAVE.fx) CAVE.fx.book.copy(book.position); // (the souls and the lightning go to it: lichcave.js)
        glow.scale.setScalar(1.8 + Math.sin(time * 3) * 0.25);
      }
      // the portals
      posePortal(out, out.userData.open, time);
      if (Math.hypot(cam.x - ox, cam.z - oz) > 170 || cam.y > 200) out.visible = false;
      // the way out closes while they fight (no running away from the Lich) and opens again once he's beaten
      const hu = home.userData, shut = api.fighting();
      if (shut !== hu.shut && Math.hypot(cam.x - hx, cam.z - hz) < 70 && cam.y > CAVE.y - 20) {
        api.burst(hx, CAVE.y + 2.9, hz, 30, [0x7dff5a, 0xb58aff, 0x0a140a], 5, 5, 0.2, 1);
        api.sfx(shut ? "darkBoom" : "portal");
        if (shut) setTimeout(() => api.toast(STR.lich.sealed, 3.5), 400);
      }
      hu.shut = shut;
      hu.open += ((shut ? 0 : 1) - hu.open) * Math.min(1, (shut ? 5 : 1.5) * dt);
      posePortal(home, hu.open, time);
      if (!(cam.y > CAVE.y - 20 && Math.hypot(cam.x - hx, cam.z - hz) < 70)) home.visible = false;
      if (out.visible && out.userData.open > 0.9 && Math.random() < dt * 5)
        api.burst(ox + (Math.random() - 0.5) * 0.5, out.position.y + 1 + Math.random() * 4, oz + (Math.random() - 0.5) * 3, 1, [0x7dff5a, 0xb58aff], 0.8, 1.5, -0.3, 0.8);
    },
    /** The portal on the minimap: fn(x, z, color). */
    dots(fn) {
      if (S.q !== "none") fn(ox, oz, "#7dff5a");
    },
  };
}
const _v = new THREE.Vector3();
const turn = (a, b, dt) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * Math.min(1, 3 * dt);
