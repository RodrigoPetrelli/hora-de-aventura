// Model studio. With the game open at /?debug=1, in the page console:
//   const E = await import("/debug/estudio.js");
//   E.ver("jake")      six angles of one character (finn, jake, slime or an NPC id)
//   E.poses("finn")    animation poses (finn, jake, slime or npc:<id>)
//   E.elenco()         everyone side by side, to compare sizes
//   E.cidadaos()       the Candy People (citizens.js), every kind side by side;
//                      E.ver("cidadao:gumdrop") shows one of them from six angles
// It freezes the game loop (reload the page to play again), builds fresh copies of
// the models above the map and paints the shots in a grid over the page. It never
// steps the physics, so the player's save is untouched.
import * as THREE from "three";
import { makeFinn, poseFinn, makeJake, poseJake, makeSlime, poseSlime, SLIME_COLORS } from "../characters.js";
import { makeNpc, poseNpc } from "../npcs.js";
import { makeCitizen } from "../citizens.js";

const NPCS = ["pb", "iceking", "flame", "marceline", "lsp", "bmo", "gunter", "banana", "pepbut", "pepbutBoss", "flameKing"];
const KINDS = ["gumdrop", "candycorn", "marshmallow", "jellybean", "cupcake", "cinnamon", "strawberry", "icecream"];
const SPOT = new THREE.Vector3();
let frozen = false;
const made = new Map();
let clock = 0;

function game() {
  const G = window.__game;
  if (!G) throw new Error("abra o jogo com ?debug=1");
  if (!frozen) {
    // the sky dome stays centred where the camera was on the last live frame: shoot there
    frozen = true;
    G.renderer.setAnimationLoop(null);
    SPOT.copy(G.camera.position).y += 4;
  }
  for (const id of ["hud", "menu", "dialog"]) document.getElementById(id).hidden = true;
  G.finn.visible = false;
  return G;
}
function model(id) {
  const G = game();
  if (!made.has(id)) {
    const m = id === "finn" ? makeFinn() : id === "jake" ? makeJake() : id === "slime" ? makeSlime(SLIME_COLORS.grass)
      : id.startsWith("cidadao:") ? makeCitizen(id.slice(8)) : makeNpc(id);
    G.scene.add(m);
    made.set(id, m);
  }
  const m = made.get(id);
  m.position.copy(SPOT);
  m.rotation.set(0, 0, 0);
  for (const [k, o] of made) o.visible = k === id;
  return m;
}
const EV = { jump: 0, jump2: 0, land: 0, landV: 0, attack: 0, atkKind: 0, hit: 0, hurt: 0, snap: 0 };
function finnFrames(m, s, n) {
  for (let i = 0; i < n; i++) poseFinn(m, { speed: 0, vy: 0, ground: true, airT: 0, climb: false, climbV: 0, heading: 0, time: (clock += 1 / 60), mantle: 0, ev: EV, ...s }, 1 / 60);
}
function jakeFrames(m, s, n) {
  for (let i = 0; i < n; i++) poseJake(m, { speed: 0, heading: 0, time: (clock += 1 / 60), wait: false, look: 0, lookUp: 0, talk: false, ...s }, 1 / 60);
}
function slimeFrames(m, s, n) {
  const e = { st: "idle", stT: 0, onGround: true, vx: 0, vy: 0, vz: 0, face: 0, hopCd: 1, flash: 0, hp: 3, maxHp: 3, landN: 0, hitN: 0, tumble: 0, hx: 0, ...s };
  for (let i = 0; i < n; i++) poseSlime(m, e, 1 / 60, (clock += 1 / 60));
}
function npcFrames(m, s, n) {
  for (let i = 0; i < n; i++) poseNpc(m, { time: (clock += 1 / 60), near: 20, talking: false, ...s }, 1 / 60);
}
/** Height of the model's bounding box, for framing. */
function height(m) {
  return new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3()).y;
}
function shot(m, label, yaw, pitch, dist, h) {
  const G = game(), a = m.rotation.y + yaw, p = m.position;
  G.camera.position.set(p.x + Math.sin(a) * Math.cos(pitch) * dist, p.y + h + Math.sin(pitch) * dist, p.z + Math.cos(a) * Math.cos(pitch) * dist);
  G.camera.lookAt(p.x, p.y + h, p.z);
  G.effect.render(G.scene, G.camera);
  const cv = G.renderer.domElement, w = cv.width, hh = cv.height, cw = Math.round(hh * 0.75);
  const c = document.createElement("canvas");
  c.width = cw;
  c.height = hh;
  const x = c.getContext("2d");
  x.drawImage(cv, (w - cw) / 2, 0, cw, hh, 0, 0, cw, hh);
  x.fillStyle = "#000";
  x.font = `${Math.round(hh / 18)}px sans-serif`;
  x.fillText(label, 8, Math.round(hh / 14));
  return c.toDataURL("image/jpeg", 0.9);
}
function grid(imgs, per = 6) {
  let g = document.getElementById("estudio");
  if (!g) {
    g = document.createElement("div");
    g.id = "estudio";
    g.style.cssText = "position:fixed;inset:0;z-index:9999;background:#222;display:flex;flex-wrap:wrap;align-content:flex-start";
    document.body.appendChild(g);
  }
  const rows = Math.ceil(imgs.length / per);
  g.innerHTML = imgs.map((s) => `<img src="${s}" style="width:${100 / per}vw;height:${100 / rows}vh;object-fit:cover">`).join("");
  return `${imgs.length} imagens`;
}

/** Six angles of one character; `close` = framing of the face shot as a fraction of the height. */
export function ver(id, close = 0.82) {
  const m = model(id);
  if (id === "finn") finnFrames(m, {}, 30);
  else if (id === "jake") jakeFrames(m, {}, 30);
  else if (id !== "slime" && !id.startsWith("cidadao:")) npcFrames(m, {}, 30);
  const H = height(m), d = H * 1.75 + 0.6;
  const views = [["frente", 0, 0.05], ["3/4", 0.7, 0.1], ["lado", 1.57, 0.05], ["costas", 2.6, 0.15], ["de cima", 0.5, 0.6]];
  const imgs = views.map(([l, y, p]) => shot(m, `${id} ${l}`, y, p, d, H * 0.5));
  imgs.push(shot(m, `${id} rosto`, 0.3, 0.08, H * 0.55 + 0.4, H * close));
  return grid(imgs);
}

/** Animation poses. */
export function poses(id) {
  const m = model(id.replace("npc:", ""));
  const H = height(m), side = [1.57, 0.05, H * 1.8 + 0.6, H * 0.5], tq = [0.8, 0.15, H * 1.8 + 0.6, H * 0.5];
  const list = [];
  if (id === "finn") {
    // ev: an event counter to bump first; "attack:k" starts swing k (0-2 the combo, 3 the air spin, 4 the Fire Wave)
    const at = (l, s, n, cam = side, ev) => list.push([l, () => {
      if (ev?.startsWith("attack:")) { EV.atkKind = Number(ev.slice(7)); EV.attack++; } else if (ev) EV[ev]++;
      finnFrames(m, s, n);
    }, cam]);
    at("parado", {}, 60, tq); at("andar", { speed: 9 }, 60); at("andar 2", { speed: 9 }, 5); at("correr", { speed: 14 }, 60); at("correr 2", { speed: 14 }, 4);
    at("pulo", { ground: false, vy: 11 }, 5, side, "jump"); at("queda", { ground: false, vy: -9, airT: 0.6 }, 20);
    at("mortal", { ground: false, vy: 9 }, 8, side, "jump2"); at("pouso", { ground: true, vy: 0 }, 4, side, "land");
    at("golpe", {}, 9, tq, "attack:0"); at("golpe 2", {}, 9, tq, "attack:1"); at("golpe 3 preparo", {}, 6, tq, "attack:2"); at("golpe 3", {}, 12, tq);
    at("giro", { ground: false, vy: 1 }, 8, tq, "attack:3"); at("giro 2", { ground: false, vy: 1 }, 6, tq);
    at("fogo preparo", {}, 12, side, "attack:4"); at("fogo", {}, 5, side); at("fogo depois", {}, 10, tq);
    at("escada", { climb: true, climbV: 4.5, ground: false }, 40, [2.4, 0.1, H * 1.8 + 0.6, H * 0.5]);
    EV.landV = 14;
  } else if (id === "jake") {
    const at = (l, s, n, cam = side) => list.push([l, () => jakeFrames(m, s, n), cam]);
    at("parado", {}, 60, tq); at("andar", { speed: 9 }, 60); at("andar 2", { speed: 9 }, 5); at("andar frente", { speed: 9 }, 5, [0.1, 0.1, H * 1.8 + 0.6, H * 0.5]);
    at("correr", { speed: 16 }, 90); at("correr 2", { speed: 16 }, 3); at("correr 3/4", { speed: 16 }, 3, tq);
    at("sentado", {}, 240, tq); at("esperando", { wait: true, lookUp: 1 }, 120, tq); at("falando", { talk: true }, 40, tq); at("falando 2", { talk: true }, 7, tq);
    at("virando", { speed: 9, heading: 0.8 }, 20, [0.1, 0.1, H * 1.8 + 0.6, H * 0.5]);
    // powers: the fist goes to a point 2 u ahead (punch) or on the ground 3 u ahead (slam)
    const P = m.position, act = (kind, t, arm, dx, dy, dz) => ({ act: { kind, t, arm, x: P.x + dx, y: P.y + dy, z: P.z + dz } });
    const wide = [1.35, 0.1, 7, 0.5], giant = [1.1, 0.12, 14, 2.3];
    at("soco preparo", act("punch", 0.1, 0, 0.3, 0.55, 2), 2, tq); at("soco", act("punch", 0.27, 0, 0.3, 0.55, 2), 2, wide);
    at("soco volta", act("punch", 0.42, 0, 0.3, 0.55, 2), 2, wide);
    at("crescendo", act("slam", 0.2, 0, 0, 0.35, 3), 2, giant); at("punho no alto", act("slam", 0.55, 0, 0, 0.35, 3), 2, giant);
    at("descendo", act("slam", 0.67, 0, 0, 0.35, 3), 2, giant); at("pancada", act("slam", 0.75, 0, 0, 0.35, 3), 2, giant);
    at("encolhendo", act("slam", 1.4, 0, 0, 0.35, 3), 2, giant);
  } else if (id === "slime") {
    const at = (l, s, n, cam = tq) => list.push([l, () => slimeFrames(m, s, n), cam]);
    at("parado", {}, 30); at("juntando", { hopCd: 0.05 }, 30); at("subindo", { onGround: false, vy: 6, vz: 5 }, 30);
    at("caindo", { onGround: false, vy: -7, vz: 5 }, 30); at("preparando", { st: "windup", stT: 0.45 }, 40);
    at("bote", { st: "lunge", onGround: false, vy: 7, vz: 9 }, 30); at("tonta", { st: "recover", stT: 0.15 }, 1);
    at("golpe", { st: "hurt", flash: 0.1, hitN: 1 }, 3); at("voando", { st: "hurt", onGround: false, vy: 4, vz: -12, tumble: 12 }, 8);
    at("meia vida", { hp: 1 }, 60); at("estourando", { st: "dying", stT: 0.18, hp: 0 }, 30);
  } else {
    const at = (l, s, n, cam = tq) => list.push([l, () => npcFrames(m, s, n), cam]);
    at("parado", {}, 60); at("acenando", { near: 5 }, 30); at("acenando 2", { near: 5 }, 8); at("falando", { near: 5, talking: true }, 90); at("falando 2", { near: 5, talking: true }, 8); at("piscando", { near: 20 }, 1);
  }
  return grid(list.map(([l, fn, cam]) => { fn(); return shot(m, l, ...cam); }));
}

/** Everyone side by side at the same scale. */
export function elenco() {
  const G = game(), ids = ["finn", "jake", ...NPCS, "slime"];
  ids.forEach((id, i) => {
    const m = model(id);
    m.position.set(SPOT.x + (i - (ids.length - 1) / 2) * 1.15, SPOT.y, SPOT.z);
    if (id === "finn") finnFrames(m, {}, 20);
    else if (id === "jake") jakeFrames(m, {}, 20);
    else if (id !== "slime") npcFrames(m, {}, 20);
  });
  for (const o of made.values()) o.visible = true;
  G.camera.position.set(SPOT.x, SPOT.y + 1.6, SPOT.z + 11);
  G.camera.lookAt(SPOT.x, SPOT.y + 0.9, SPOT.z);
  G.effect.render(G.scene, G.camera);
  let g = document.getElementById("estudio");
  if (g) g.remove();
  return ids.join(", ");
}

/** The Candy People side by side, next to Finn for scale. */
export function cidadaos() {
  const G = game(), ids = ["finn", ...KINDS.map((k) => "cidadao:" + k)];
  ids.forEach((id, i) => {
    const m = model(id);
    m.position.set(SPOT.x + (i - (ids.length - 1) / 2) * 1.3, SPOT.y, SPOT.z);
    if (id === "finn") finnFrames(m, {}, 20);
  });
  for (const [k, o] of made) o.visible = ids.includes(k);
  G.camera.position.set(SPOT.x, SPOT.y + 1.5, SPOT.z + 9);
  G.camera.lookAt(SPOT.x, SPOT.y + 0.8, SPOT.z);
  G.effect.render(G.scene, G.camera);
  let g = document.getElementById("estudio");
  if (g) g.remove();
  return ids.join(", ");
}
