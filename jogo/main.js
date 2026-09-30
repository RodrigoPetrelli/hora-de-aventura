// Hora de Aventura — Terra de Ooo. Single-player 3D open-world platformer.
import * as THREE from "three";
import { OutlineEffect } from "three/addons/effects/OutlineEffect.js";
import { buildWorld } from "./world.js";
import { groundHeight, areaAt, LAVA, P, WORLD, paintMinimap, rng, biomeWeights, BIOMES, smooth, lumpyAt } from "./terrain.js";
import { supportAt, resolveXZ, ceilingAt, STEP, pointBlocked, ladderAt } from "./physics.js";
import { noOutline } from "./toon.js";
import { makeFinn, poseFinn, setFinnSword, makeJake, poseJake, makeSlime, poseSlime, SLIME_COLORS, makeShadow } from "./characters.js";
import { createFx, makeHeartPickup } from "./fx.js";
import { makeNpc, poseNpc } from "./npcs.js";
import { spawnCitizens } from "./citizens.js";
import { createBoss } from "./boss.js";
import { createQuest } from "./quest.js";
import { CROWN } from "./ice.js";
import { createButler } from "./butler.js";
import { createSpirits } from "./spirits.js";
import { LAIR, lairAt } from "./lair.js";
import { createFlameKing } from "./flameking.js";
import { createFlamePath } from "./flamepath.js";
import { ARENA, colosseumAt } from "./colosseum.js";
import { createFireWave } from "./firewave.js";
import { CRYSTALS, hasCrystal, crystalCount } from "./crystals.js";
import { createTemple } from "./temple.js";
import { createBilly, billyOpen } from "./billy.js";
import { createLich } from "./lich.js";
import { CAVE, lichCaveAt } from "./lichcave.js";
import { createLichBoss } from "./lichboss.js";
import { Input } from "./input.js";
import { sfx, unlockAudio, setSound } from "./audio.js";
import { STR } from "./strings.js";

// ── tuning: agency metrics are frozen (the platform layouts are built on them) ──
const T = {
  walk: 9, run: 14, accelGround: 70, accelAir: 28,
  gravity: 30, jumpV: 11, jump2V: 9.5, fallMax: 40, lowJumpExtra: 32,
  coyote: 0.1, buffer: 0.12, radius: 0.42, height: 1.6, climb: 4.5,
  heartsMax: 5, invuln: 1.2, regenDelay: 6, regenEvery: 4, heartLife: 15,
  slimeAggro: 18, slimeLeash: 45, slimeHop: 7, slimeSpeed: 5.5, slimeHp: 3, slimeRespawn: 40,
  slimePounce: 4.5, slimeWindup: 0.55, slimeRecover: 0.7, slimeAttackers: 2,
  jakeReach: 7.5, jakePunchCd: 1.7, jakePowerCd: 7, jakeSlamR: 4.5, jakeSlamReach: 16,
  fireCd: 6, fireBoss: 5, // Finn's Fire Wave: recharge (s), damage to a boss (a slime it always pops)
  camDist: 9, camMin: 4, camMax: 18, sensMouse: 0.0028, sensPad: 2.6,
};
// Sword swings; the animation (ATL in characters.js) runs on the same clock. On the ground
// presses chain a combo (forehand, backhand, overhead chop); the first swing in the air is a
// spin that hits all around. hit: when the blade lands; next: when the next swing may start;
// end: swing over; kb/up: knockback (short on the first two, so the chop still reaches); lunge:
// step forward (toward the target, if any; at lungeAt s into the swing, if it has one). The last one
// is the Fire Wave's cut (F, once the Flame Heart is Finn's): the blade comes down at `hit` and,
// instead of cutting, sends the wave out (firewave.js).
const SWING = [
  { hit: 0.12, next: 0.22, end: 0.3, dmg: 1, kb: 4.5, up: 3.5, range: 2.7, arc: 1.2, lunge: 5 },
  { hit: 0.12, next: 0.22, end: 0.3, dmg: 1, kb: 4.5, up: 3.5, range: 2.7, arc: 1.2, lunge: 5 },
  { hit: 0.17, next: 0.5, end: 0.5, dmg: 2, kb: 15, up: 9, range: 3, arc: 1, lunge: 8, heavy: true },
  { hit: 0.14, next: 0.38, end: 0.38, dmg: 1, kb: 10, up: 6, range: 2.9, arc: 3.2, lunge: 0 },
  { hit: 0.26, next: 0.5, end: 0.56, dmg: 0, kb: 0, up: 0, range: 0, arc: 0, lunge: 7, lungeAt: 0.19, fire: true },
];
// the Night Sword (the prize for beating the Peppermint Butler): twice the damage (the chop 1.5x), longer reach
const NIGHT = SWING.map((w) => ({ ...w, dmg: w.heavy ? 3 : 2, range: w.range + 0.45, spark: 0xc080ff }));
const DT = 1 / 60;
const SAVE_KEY = "ooo:save:v2";
const DEBUG = new URLSearchParams(location.search).has("debug");
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const turnToward = (a, b, max) => a + clamp(Math.atan2(Math.sin(b - a), Math.cos(b - a)), -max, max);
const $ = (id) => document.getElementById(id);

// ── save ──
// ice: the Ice King's quest and fight (quest.js); mint: the Peppermint Butler's (spirits.js); fire:
// Flame Princess's (the Path of Flames), and her father's fight (flamepath.js; wave: Finn was told about
// the Fire Wave); temple: the Temple of the Enchiridion (temple.js: the door is open, the book taken);
// clues: the treasures someone told Finn about; billy: Billy's quest (billy.js: his test, then the
// crystals); lich: the twist after the book (lich.js: Billy was the Lich, his portal, his cave). The
// boss crystals (crystals.js) come from the wins.
const iceSave = (o) => ({ q: o?.q || "none", pengs: Array.isArray(o?.pengs) ? o.pengs : [], wins: o?.wins || 0 });
const mintSave = (o) => ({ q: o?.q || "none", got: Array.isArray(o?.got) ? o.got : [], wins: o?.wins || 0 });
const fireSave = (o) => ({ q: o?.q || "none", lit: o?.lit || 0, wins: o?.wins || 0, wave: !!o?.wave });
const templeSave = (o) => ({ open: !!o?.open, book: !!o?.book });
const billySave = (o) => ({ q: o?.q || "none", kills: o?.kills || 0 });
const lichSave = (o) => ({ q: o?.q || "none", wins: o?.wins || 0 });
function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (s && Array.isArray(s.found)) {
      const out = { found: s.found, won: !!s.won, opts: s.opts || {}, ice: iceSave(s.ice), mint: mintSave(s.mint), fire: fireSave(s.fire), temple: templeSave(s.temple), billy: billySave(s.billy), lich: lichSave(s.lich), clues: Array.isArray(s.clues) ? s.clues : [] };
      // a save from before Billy, already on the bosses' trail: he's waiting at the temple
      if (!s.billy && (out.ice.q !== "none" || crystalCount(out))) out.billy.q = out.temple.open ? "won" : "crystals";
      return out;
    }
  } catch {
    /* private mode / blocked storage: play without saving */
  }
  return { found: [], won: false, opts: {}, ice: iceSave(), mint: mintSave(), fire: fireSave(), temple: templeSave(), billy: billySave(), lich: lichSave(), clues: [] };
}
const save = loadSave();
// one more heart for each boss heart: the Ice Heart (beating the Ice King), the Flame Heart (the Flame
// King; it also gives Finn the Fire Wave)
let iceHeart = save.ice.wins > 0, flameHeart = save.fire.wins > 0;
const setHeartsMax = () => { T.heartsMax = 5 + (iceHeart ? 1 : 0) + (flameHeart ? 1 : 0); };
setHeartsMax();
let hasNight = save.mint.wins > 0; // the Night Sword, the prize for beating the Peppermint Butler
const blades = () => (hasNight ? NIGHT : SWING);
const sensOpt = (v) => (Number.isFinite(v) ? clamp(v, 0.25, 3) : 1); // camera sensitivity multiplier
const opts = { sound: save.opts.sound !== false, shake: save.opts.shake !== false, big: !!save.opts.big,
  sensMouse: sensOpt(save.opts.sensMouse), sensPad: sensOpt(save.opts.sensPad) };
function writeSave() {
  save.opts = opts;
  if (DEBUG && window.__game?.noSave) return; // a debug session that must not count (debug/combate.js)
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    /* ignore */
  }
}

// ── static text ──
$("mTitle").textContent = STR.title;
$("mSub").textContent = STR.subtitle;
$("loading").textContent = STR.loading;
$("btnPlay").textContent = save.found.length ? STR.resume : STR.play;
$("btnNew").textContent = STR.newGame;
$("btnNew").hidden = save.found.length === 0;
$("lSound").textContent = STR.sound;
$("lShake").textContent = STR.shake;
$("lBig").textContent = STR.bigText;
$("lSens").textContent = STR.sens;
$("lSensMouse").textContent = STR.sensMouse;
$("lSensPad").textContent = STR.sensPad;
$("bJump").textContent = STR.jump;
$("bAtk").textContent = STR.attack;
$("bTalk").textContent = STR.talk;
$("bJake").textContent = STR.jakeBtn;
$("jakePow").title = STR.jakePower;
$("bFire").textContent = STR.fireBtn;
$("firePow").title = STR.firePower;
$("optSound").checked = opts.sound;
$("optShake").checked = opts.shake;
$("optBig").checked = opts.big;
const showSens = () => {
  for (const k of ["sensMouse", "sensPad"]) {
    const id = k[0].toUpperCase() + k.slice(1);
    $("opt" + id).value = opts[k];
    $("v" + id).textContent = Math.round(opts[k] * 100) + "%";
  }
};
showSens();
const applyOpts = () => {
  setSound(opts.sound);
  document.documentElement.style.setProperty("--text-scale", opts.big ? "1.25" : "1");
};
applyOpts();

// ── renderer / scene ──
const canvas = $("c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: devicePixelRatio < 2, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.info.autoReset = false;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xc4ecff);
scene.fog = new THREE.Fog(0xc4ecff, 120, 460);
const hemi = new THREE.HemisphereLight(0xffffff, 0x7a8a6a, 1.5);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.9);
sun.position.set(0.5, 1, 0.3);
scene.add(sun);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
// ink outlines on everything whose material allows it
const effect = new OutlineEffect(renderer, { defaultThickness: 0.0032, defaultColor: [0.09, 0.06, 0.11] });
const input = new Input(canvas);
if (input.touch) {
  document.body.classList.add("touch");
  $("touch").hidden = false;
}
/** The menu's controls: n treasures to find, and the Fire Wave once the Flame Heart is Finn's. */
function renderControls(n = "…") {
  const fire = flameHeart ? (input.touch ? STR.controlsFireTouch : STR.controlsFire) : "";
  $("controls").innerHTML = (input.touch ? STR.controlsTouch : STR.controlsKeys).replace("{N}", n).replace("{FIRE}", fire);
}
renderControls();
input.bindButton($("bJump"), "jump");
input.bindButton($("bAtk"), "attack");
input.bindButton($("bTalk"), "talk");
input.bindButton($("bJake"), "jake");
input.bindButton($("bFire"), "fire");
input.onStick = (on, ox, oy, dx = 0, dy = 0) => {
  const st = $("stick");
  st.style.display = on ? "block" : "none";
  if (on) {
    st.style.left = ox - 65 + "px";
    st.style.top = oy - 65 + "px";
    $("knob").style.transform = `translate(${dx}px, ${dy}px)`;
  }
};

// dynamic resolution: on a weak (integrated) GPU, give up a little sharpness to hold 60 fps
const PR_MAX = Math.min(devicePixelRatio, 1.75), PR_MIN = Math.min(1, PR_MAX);
const res = { pr: PR_MAX, t: 0, n: 0, good: 0, need: 5 };
function tuneResolution(frame) {
  res.t += frame;
  res.n++;
  if (res.t < 1) return;
  const f = res.n / res.t;
  res.t = res.n = 0;
  let next = res.pr;
  if (f < 54 && res.pr > PR_MIN) {
    next = Math.max(PR_MIN, res.pr - 0.125);
    if (res.good < 0) res.need = Math.min(60, res.need * 2); // it dropped right after a raise: wait longer
    res.good = 0;
  } else if (f > 58.5 && res.pr < PR_MAX) {
    if (++res.good >= res.need) { next = Math.min(PR_MAX, res.pr + 0.125); res.good = -3; }
  } else if (res.good > 0) res.good = 0;
  else if (res.good < 0) res.good++;
  if (next !== res.pr) {
    res.pr = next;
    renderer.setPixelRatio(next);
    renderer.setSize(innerWidth, innerHeight, false);
  }
}
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

// let the menu paint before the (synchronous) world build
await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const world = buildWorld(scene);
const treasures = world.treasures;
renderControls(treasures.length);
for (const t of treasures) {
  t.found = save.found.includes(t.id);
  t.mesh.visible = !t.found;
}

// ── particles ──
const PMAX = 320;
const pMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), noOutline(new THREE.MeshBasicMaterial({ color: 0xffffff })), PMAX);
pMesh.frustumCulled = false;
const pData = [];
const _m4 = new THREE.Matrix4(), _col = new THREE.Color();
for (let i = 0; i < PMAX; i++) {
  pData.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 1, shown: false });
  pMesh.setMatrixAt(i, _m4.makeScale(0, 0, 0));
  pMesh.setColorAt(i, _col.set(0xffffff));
}
scene.add(pMesh);
let pNext = 0;
function burst(x, y, z, n, colors, speed = 6, up = 5, g = 1, life = 0.8) {
  for (let k = 0; k < n; k++) {
    const i = pNext;
    pNext = (pNext + 1) % PMAX;
    const p = pData[i];
    p.life = p.max = life * (0.6 + Math.random() * 0.6);
    p.x = x; p.y = y; p.z = z;
    const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
    p.vx = Math.cos(a) * s;
    p.vz = Math.sin(a) * s;
    p.vy = up * (0.4 + Math.random());
    p.g = g;
    pMesh.setColorAt(i, _col.set(Array.isArray(colors) ? colors[k % colors.length] : colors));
  }
  pMesh.instanceColor.needsUpdate = true;
}
function updateParticles(dt) {
  for (let i = 0; i < PMAX; i++) {
    const p = pData[i];
    if (p.life <= 0) {
      if (p.shown) { pMesh.setMatrixAt(i, _m4.makeScale(0, 0, 0)); p.shown = false; }
      continue;
    }
    p.life -= dt;
    p.vy -= 18 * p.g * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    const s = Math.max(0, p.life / p.max);
    pMesh.setMatrixAt(i, _m4.makeScale(s, s, s).setPosition(p.x, p.y, p.z));
    p.shown = true;
  }
  pMesh.instanceMatrix.needsUpdate = true;
}

const fx = createFx(scene);
// hit-stop: a blow freezes the action for a few frames (the render keeps going)
let hitStop = 0;
const freeze = (s) => { hitStop = Math.min(0.15, Math.max(hitStop, s)); };

// ── player ──
const finn = makeFinn();
const finnShadow = makeShadow(0.55);
scene.add(finn, finnShadow);
if (hasNight) setFinnSword(finn, "night");
const player = {
  pos: new THREE.Vector3(), prev: new THREE.Vector3(), vel: new THREE.Vector3(),
  heading: Math.PI, prevHeading: Math.PI, onGround: true, sinceGround: 0, jumps: 0, buffer: 0,
  hearts: T.heartsMax, invuln: 0, sinceHurt: 99, regen: 0,
  attackT: -1, atkKind: 0, atkBuf: 0, sinceAtk: 9, aim: null, airSpun: false, hitDone: false,
  fireBuf: 0, fireCd: 0, aimFoe: null, // the Fire Wave: press buffer, recharge, the foe its cut turns toward
  dead: 0, climbing: false, grabCd: 0,
  // counters the animation watches (it may render less often than the physics steps)
  ev: { jump: 0, jump2: 0, land: 0, landV: 0, attack: 0, atkKind: 0, hit: 0, hurt: 0, snap: 0, snapOff: new THREE.Vector3() },
};
function placeAtSpawn() {
  player.pos.set(P.spawn.x, groundHeight(P.spawn.x, P.spawn.z), P.spawn.z);
  player.prev.copy(player.pos);
  player.vel.set(0, 0, 0);
  player.heading = player.prevHeading = Math.PI;
  cam.yaw = 0;
  cam.pitch = 0.35;
  cam.ty = player.pos.y + 1.4;
  jake.x = player.pos.x + 1.8;
  jake.z = player.pos.z + 2;
  jake.y = jake.ry = groundHeight(jake.x, jake.z);
  jake.px = jake.x;
  jake.pz = jake.z;
  jake.act = null;
}

// ── Jake ──
const jakeModel = makeJake();
const jakeShadow = makeShadow(0.5);
scene.add(jakeModel, jakeShadow);
// px/pz/pface: last step (rendering interpolates); ry: smoothed height; v: actual speed
// act: the power he is using (null, or { kind: "punch" | "slam", t, ... }); powerCd: the giant fist's cooldown
const jake = {
  x: 0, y: 0, z: 0, px: 0, pz: 0, ry: 0, vx: 0, vz: 0, face: Math.PI, pface: Math.PI, speed: 0, v: 0, waitSaid: false, waiting: false, talkT: 0,
  act: null, punchCd: 1, powerCd: 0, arm: 0,
};

// ── camera ──
const cam = { yaw: 0, pitch: 0.35, pitchEff: 0.35, dist: T.camDist, ty: 0, shake: 0, clip: 1 };

// ── sky, fog and light follow the region you are in ──
const SKY_TOP = BIOMES.map((b) => new THREE.Color(b.sky[0]));
const SKY_BOT = BIOMES.map((b) => new THREE.Color(b.sky[1]));
const LIGHT = BIOMES.map((b) => new THREE.Color(b.light));
const LUMPY_TOP = new THREE.Color(0x14042a), LUMPY_BOT = new THREE.Color(0x4a1466), LUMPY_LIGHT = new THREE.Color(0xe0c0ff);
// the Dark Lair, by its mood (LAIR.fx.mood: calm, angry, furious — the last one blood red)
const LAIR_SKY = [[0x07020f, 0x251040, 0xa088d8], [0x0c0218, 0x2c0a44, 0xa878d8], [0x160206, 0x3a0812, 0xd88080]].map((m) => m.map((c) => new THREE.Color(c)));
const _lc = [new THREE.Color(), new THREE.Color(), new THREE.Color()], LAIR_FLASH = new THREE.Color(0xd8c0ff);
let lairMood = 0;
// the Colosseum of Flames, by the Flame King's fire (ARENA.fx.mood: a fire, furious, the blue flame)
const COL_SKY = [[0x2a0604, 0xc0461c, 0xffc49a], [0x3a0402, 0xe0501a, 0xffb080], [0x060c30, 0x3a60d0, 0xc8dcff]].map((m) => m.map((c) => new THREE.Color(c)));
const _fc = [new THREE.Color(), new THREE.Color(), new THREE.Color()], COL_FLASH = new THREE.Color(0xfff0c0);
let colMood = 0;
const CAVE_SKY = [0x04070b, 0x0f1d26, 0x9cc8c0].map((c) => new THREE.Color(c));
const CAVE_DARK = [0x000000, 0x020803, 0x3a6a44].map((c) => new THREE.Color(c));
const _w = new Array(BIOMES.length).fill(0), _top = new THREE.Color(), _bot = new THREE.Color(), _lit = new THREE.Color();
function updateSky(p) {
  biomeWeights(p.x, p.z, _w);
  _top.setRGB(0, 0, 0);
  _bot.setRGB(0, 0, 0);
  _lit.setRGB(0, 0, 0);
  for (let i = 0; i < _w.length; i++) {
    _top.r += SKY_TOP[i].r * _w[i]; _top.g += SKY_TOP[i].g * _w[i]; _top.b += SKY_TOP[i].b * _w[i];
    _bot.r += SKY_BOT[i].r * _w[i]; _bot.g += SKY_BOT[i].g * _w[i]; _bot.b += SKY_BOT[i].b * _w[i];
    _lit.r += LIGHT[i].r * _w[i]; _lit.g += LIGHT[i].g * _w[i]; _lit.b += LIGHT[i].b * _w[i];
  }
  // Lumpy Space: a deep purple starry night up among its islands
  const lf = lumpyAt(p);
  if (lf > 0) { _top.lerp(LUMPY_TOP, lf); _bot.lerp(LUMPY_BOT, lf); _lit.lerp(LUMPY_LIGHT, lf * 0.7); }
  // a cold haze on the Ice Crown (what lies beyond it isn't drawn up there: W.sealed in ice.js)
  const cf = (1 - smooth(18, 30, Math.hypot(p.x - CROWN.x, p.z - CROWN.z))) * smooth(CROWN.y - 12, CROWN.y - 4, p.y);
  // the Dark Lair: a dark purple void, thick fog (the world below isn't drawn: W.sealed in lair.js)
  const df = lairAt(p);
  if (df > 0) {
    lairMood += (LAIR.fx.mood - lairMood) * 0.03;
    const i = Math.min(1, Math.floor(lairMood)), f = lairMood - i;
    for (let k = 0; k < 3; k++) _lc[k].copy(LAIR_SKY[i][k]).lerp(LAIR_SKY[i + 1][k], f);
    _top.lerp(_lc[0], df); _bot.lerp(_lc[1], df); _lit.lerp(_lc[2], df);
    // lightning over the lair lights the whole sky up for an instant
    if (LAIR.fx.sky > 0) { const k = LAIR.fx.sky * df; _top.lerp(LAIR_FLASH, 0.35 * k); _bot.lerp(LAIR_FLASH, 0.5 * k); _lit.lerp(LAIR_FLASH, 0.6 * k); }
  }
  // the Colosseum of Flames: a red sky thick with smoke, far volcanoes in the haze (blue in the blue flame)
  const hf = colosseumAt(p);
  if (hf > 0) {
    colMood += (ARENA.fx.mood - colMood) * 0.03;
    const i = Math.min(1, Math.floor(colMood)), f = colMood - i;
    for (let k = 0; k < 3; k++) _fc[k].copy(COL_SKY[i][k]).lerp(COL_SKY[i + 1][k], f);
    _top.lerp(_fc[0], hf); _bot.lerp(_fc[1], hf); _lit.lerp(_fc[2], hf);
    if (ARENA.fx.flash > 0) { const k = ARENA.fx.flash * hf; _bot.lerp(COL_FLASH, 0.35 * k); _lit.lerp(COL_FLASH, 0.5 * k); }
  }
  // the Lich's cave: dark blue rock lit by a sickly green (the world below isn't drawn: W.sealed in lich.js)
  const bf = lichCaveAt(p);
  // (the Lich's "Fall" darkens it all: lichboss.js)
  const kd = bf * (CAVE.fx ? CAVE.fx.dark : 0);
  if (bf > 0) { _top.lerp(CAVE_SKY[0], bf); _bot.lerp(CAVE_SKY[1], bf); _lit.lerp(CAVE_SKY[2], bf); }
  if (kd > 0) { _top.lerp(CAVE_DARK[0], kd); _bot.lerp(CAVE_DARK[1], kd); _lit.lerp(CAVE_DARK[2], kd * 0.8); }
  scene.fog.near = (((120 - 90 * lf - 50 * cf) * (1 - df) + 26 * df) * (1 - hf) + 90 * hf) * (1 - bf) + (22 - 12 * kd) * bf;
  scene.fog.far = (((460 - 320 * lf - 180 * cf) * (1 - df) + 140 * df) * (1 - hf) + 480 * hf) * (1 - bf) + (105 - 55 * kd) * bf;
  world.sky.material.uniforms.top.value.copy(_top);
  world.sky.material.uniforms.bottom.value.copy(_bot);
  scene.fog.color.copy(_bot);
  scene.background.copy(_bot);
  hemi.color.copy(_lit);
  sun.color.copy(_lit);
}

// ── NPCs ──
const npcs = world.npcs.map((n) => {
  const model = makeNpc(n.id);
  model.position.set(n.x, n.y, n.z);
  model.rotation.y = n.yaw;
  scene.add(model);
  const sh = makeShadow(0.45);
  sh.position.set(n.x, n.y + 0.03, n.z);
  if (!n.float) scene.add(sh);
  return { ...n, model, shadow: n.float ? null : sh, baseYaw: n.yaw, name: STR.names[n.id] };
});

/** Far NPCs, or ones outside a sealed room the camera is in, aren't drawn. */
function cullNpcs() {
  for (const n of npcs) {
    const cd = Math.hypot(camera.position.x - n.x, camera.position.z - n.z);
    n.model.visible = !n.hidden && cd < Math.min(120, Math.max(25, world.state.view));
    if (n.shadow) n.shadow.visible = n.model.visible;
  }
}

// ── the Candy People ──
const crowd = spawnCitizens(scene, world.citizens, groundHeight, makeShadow);
for (const c of crowd.list) c.name = STR.citizens.names[c.kind];

// ── slimes ──
const slimes = world.enemies.map((e, i) => {
  const model = makeSlime(SLIME_COLORS[e.biome]);
  const shadow = makeShadow(0.75);
  model.visible = shadow.visible = false; // shown once they wake up near Finn
  scene.add(model, shadow);
  const y = groundHeight(e.x, e.z);
  // st: idle (wanders) > alert (spotted Finn) > chase > windup (crouches, glowing) > lunge (the
  // only time it hurts) > recover (dazed) > chase...; hurt (knocked back) and dying (flies, then pops)
  return {
    x: e.x, y, z: e.z, px: e.x, py: y, pz: e.z, hx: e.x, hz: e.z, vx: 0, vy: 0, vz: 0, hp: T.slimeHp, maxHp: T.slimeHp, dead: false, respawn: 0,
    hopCd: 1 + (i % 5) * 0.3, onGround: true, face: 0, flash: 0, color: SLIME_COLORS[e.biome],
    st: "idle", stT: 0, atkCd: 0, stunFor: 0, tumble: 0, landN: 0, hitN: 0,
    model, shadow, rand: rng(500 + i), r: (i % 7) / 7,
  };
});
const alive = (e) => !e.dead && e.st !== "dying" && e.active && e.model.visible;
function setSlime(e, st) {
  e.st = st;
  e.stT = 0;
}

// ── hearts dropped by slimes and bosses (gone after T.heartLife seconds) ──
const pickups = [];
for (let i = 0; i < 4; i++) {
  const mesh = makeHeartPickup(), shadow = makeShadow(0.3);
  mesh.visible = shadow.visible = false;
  scene.add(mesh, shadow);
  pickups.push({ mesh, shadow, on: false, x: 0, y: 0, z: 0, vy: 0, t: 0 });
}
function dropHeart(x, y, z) {
  // a free slot, or else the oldest heart on the ground
  const p = pickups.find((q) => !q.on) || pickups.reduce((a, b) => (b.t > a.t ? b : a));
  Object.assign(p, { on: true, x, y, z, vy: 7, t: 0 });
}
const _tmp = new THREE.Vector3();

// ── HUD ──
const HEART = '<svg class="heart CLS" viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-10-9.2C.3 8.4 2.1 4 6.2 4c2.3 0 3.8 1.3 5.8 3.5C14 5.3 15.5 4 17.8 4c4.1 0 5.9 4.4 4.2 7.8C19.5 16.4 12 21 12 21z"/></svg>';
function updateHearts() {
  let h = "";
  for (let i = 0; i < T.heartsMax; i++) h += HEART.replace("CLS", i < player.hearts ? "" : "empty");
  $("hearts").innerHTML = h;
}
const foundCount = () => treasures.filter((t) => t.found).length;
const updateGems = () => ($("gemCount").textContent = `${foundCount()}/${treasures.length}`);
// the boss crystals, next to the treasures: grey until Finn has each one ("got" pops the newest)
const CRY = '<svg class="cry CLS" viewBox="0 0 14 22"><path d="M7 1.5 12.5 8 7 20.5 1.5 8z"/></svg>';
function updateCrystals(pop = null) {
  $("crys").innerHTML = CRYSTALS.map((c) => CRY.replace("CLS", hasCrystal(save, c.id) ? c.id + (c.id === pop ? " got" : "") : "")).join("");
}
/** A boss crystal was just picked up: the HUD, and a little later what to do next. */
function crystalNews(id) {
  updateCrystals(id);
  billy.refresh();
  renderClues();
  const n = crystalCount(save);
  const all = n === CRYSTALS.length && foundCount() === treasures.length;
  setTimeout(() => toast(all ? STR.billy.complete : STR.crystals.got[n], 7), 6500);
  if (all) setTimeout(() => jakeSay(STR.jake.crystals, true), 14000);
}
let toastTimer = 0;
function toast(html, secs = 2.6) {
  const el = $("toast");
  el.innerHTML = html;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), secs * 1000);
}
// Jake's giant fist and Finn's Fire Wave: each badge (and touch button) empties like a clock while it recharges
const POWERS = [
  { els: [$("jakePow"), $("bJake")], cd: () => jake.powerCd / T.jakePowerCd, ready: "ready", shown: -1 },
  { els: [$("firePow"), $("bFire")], cd: () => player.fireCd / T.fireCd, ready: "fireReady", shown: -1 },
];
function updatePowerHud() {
  for (const p of POWERS) {
    const q = Math.ceil(p.cd() * 40) / 40;
    if (q === p.shown) continue;
    if (q === 0 && p.shown > 0) sfx(p.ready);
    p.shown = q;
    for (const el of p.els) {
      el.style.setProperty("--cd", q);
      el.classList.toggle("ready", q === 0);
    }
  }
}
/** The Fire Wave's badge, touch button and line in the controls: there once the Flame Heart is Finn's. */
function showFirePower() {
  $("firePow").hidden = $("bFire").hidden = !flameHeart;
  renderControls(treasures.length);
}
let jakeCd = 0;
function jakeSay(text, force = false) {
  if (!force && jakeCd > 0) return;
  jakeCd = 6;
  jake.talkT = 1.8;
  toast(`<b>Jake:</b> ${text}`, 3);
}
let areaTimer = 0;
function showArea(key) {
  const el = $("area");
  el.textContent = STR.areas[key];
  el.classList.add("show");
  clearTimeout(areaTimer);
  areaTimer = setTimeout(() => el.classList.remove("show"), 2600);
}
function flashHurt() {
  const el = $("hurt");
  el.classList.add("on");
  setTimeout(() => el.classList.remove("on"), 120);
}
const shake = (a) => { if (opts.shake) cam.shake = Math.max(cam.shake, a); };

// minimap
const mm = $("minimap");
const mmCtx = mm.getContext("2d");
const mmBase = document.createElement("canvas");
mmBase.width = mmBase.height = mm.width;
paintMinimap(mmBase.getContext("2d"), mm.width);
const toMap = (v) => (v / (2 * WORLD.limit) + 0.5) * mm.width;
function drawMinimap() {
  const S = mm.width;
  mmCtx.clearRect(0, 0, S, S);
  mmCtx.save();
  mmCtx.beginPath();
  mmCtx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
  mmCtx.clip();
  mmCtx.drawImage(mmBase, 0, 0);
  mmCtx.fillStyle = "#fff";
  for (const n of npcs) {
    if (n.hidden) continue;
    mmCtx.beginPath();
    mmCtx.arc(toMap(n.x), toMap(n.z), 2.2, 0, Math.PI * 2);
    mmCtx.fill();
  }
  const dot = (x, z, color) => {
    mmCtx.fillStyle = color;
    mmCtx.beginPath();
    mmCtx.arc(toMap(x), toMap(z), 3, 0, Math.PI * 2);
    mmCtx.fill();
    mmCtx.stroke();
  };
  quest.dots(dot);
  spirits.dots(dot);
  flamePath.dots(dot);
  temple.dots(dot);
  lich.dots(dot);
  billy.dots(dot, slimes);
  mmCtx.fillStyle = "#ffd23f";
  mmCtx.strokeStyle = "#1d2340";
  for (const t of treasures) {
    if (!t.found) continue;
    mmCtx.beginPath();
    mmCtx.arc(toMap(t.x), toMap(t.z), 3, 0, Math.PI * 2);
    mmCtx.fill();
    mmCtx.stroke();
  }
  mmCtx.translate(toMap(player.pos.x), toMap(player.pos.z));
  mmCtx.rotate(Math.PI - player.heading);
  mmCtx.fillStyle = "#ff4d6d";
  mmCtx.lineWidth = 2;
  mmCtx.beginPath();
  mmCtx.moveTo(0, -8);
  mmCtx.lineTo(6, 6);
  mmCtx.lineTo(0, 3);
  mmCtx.lineTo(-6, 6);
  mmCtx.closePath();
  mmCtx.fill();
  mmCtx.stroke();
  mmCtx.restore();
  // compass: north is up (-z), east to the right (+x)
  mmCtx.font = "700 14px Fredoka, sans-serif";
  mmCtx.textAlign = "center";
  mmCtx.textBaseline = "middle";
  mmCtx.lineWidth = 3.5;
  mmCtx.lineJoin = "round";
  mmCtx.strokeStyle = "#1d2340";
  for (const [k, x, y] of [["n", S / 2, 12], ["s", S / 2, S - 11], ["e", S - 11, S / 2 + 1], ["w", 11, S / 2 + 1]]) {
    mmCtx.fillStyle = k === "n" ? "#ff4d6d" : "#fff";
    mmCtx.strokeText(STR.compass[k], x, y);
    mmCtx.fillText(STR.compass[k], x, y);
  }
}

// ── the Ice King: his quest (penguins) and the fight on the Ice Crown ──
let healHinted = false;
const boss = createBoss(scene, {
  player, fx, sfx, shake, freeze, dropHeart, burst,
  hurt: (n, nx, nz, kind) => hurtPlayer(n, nx, nz, kind),
  onStart() {
    jakeJoin(true);
    if (!healHinted) { healHinted = true; setTimeout(() => toast(STR.ice.healHint, 6), 3200); }
  },
  onWin(first) {
    quest.won();
    player.hearts = T.heartsMax;
    updateHearts();
    if (!first) setTimeout(() => toast(STR.ice.healed, 3), 400);
    setTimeout(() => jakeSay(STR.jake.bossWin, true), first ? 5200 : 3000);
  },
  onReward() {
    iceHeart = true;
    setHeartsMax();
    player.hearts = T.heartsMax;
    updateHearts();
    sfx("win");
    toast(STR.ice.heart, 5);
    crystalNews("ice");
  },
});
const quest = createQuest(scene, {
  save, writeSave, player, boss, toast, sfx, burst, makeShadow,
  king: npcs.find((n) => n.id === "iceking"),
  locked: () => !billyOpen(save), // he only asks once Billy has sent Finn after the crystals
});

// ── the Peppermint Butler: his quest (runaway spirits) and the fight in his Dark Lair ──
const pepNpc = npcs.find((n) => n.id === "pepbut");
let lairHinted = false;
const butler = createButler(scene, {
  player, fx, sfx, shake, freeze, dropHeart, burst,
  hurt: (n, nx, nz, kind) => hurtPlayer(n, nx, nz, kind),
  onStart() {
    jakeJoin(true);
    if (!lairHinted) { lairHinted = true; setTimeout(() => toast(STR.mint.healHint, 6), 3200); }
  },
  onWin() {
    const first = spirits.won();
    player.hearts = T.heartsMax;
    updateHearts();
    if (!first) setTimeout(() => toast(STR.mint.healed, 3), 400);
    setTimeout(() => toast(STR.mint.portal, 5), first ? 2400 : 3400);
    setTimeout(() => jakeSay(STR.jake.lairWin, true), first ? 8000 : 6000);
    return first;
  },
  onReward() {
    giveNightSword();
    sfx("win");
    toast(STR.mint.sword, 5);
    crystalNews("mint");
  },
  leave: () => leaveLair(),
});
const spirits = createSpirits(scene, {
  save, writeSave, player, toast, sfx, burst, makeShadow,
  enterLair: () => enterLair(),
  locked: () => !hasCrystal(save, "ice"), // he only asks a hero who beat the Ice King
});
function giveNightSword() {
  hasNight = true;
  setFinnSword(finn, "night");
}

// ── the Flame King: his daughter's quest (the Path of Flames) and the fight in the Colosseum of Flames ──
const flameNpc = npcs.find((n) => n.id === "flame");
let colHinted = false, sunHinted = false;
const flameKing = createFlameKing(scene, {
  player, fx, sfx, shake, freeze, dropHeart, burst,
  hurt: (n, nx, nz, kind) => hurtPlayer(n, nx, nz, kind),
  onStart() {
    jakeJoin(true);
    if (!colHinted) { colHinted = true; setTimeout(() => toast(STR.fire.healHint, 6), 3200); }
  },
  onSun() {
    jakeSay(STR.jake.pillars, true);
    if (!sunHinted) { sunHinted = true; toast(STR.fire.sunHint, 4.5); }
  },
  onWin() {
    const first = flamePath.won();
    player.hearts = T.heartsMax;
    updateHearts();
    if (!first) setTimeout(() => toast(STR.fire.healed, 3), 400);
    setTimeout(() => toast(STR.fire.portal, 5), first ? 2400 : 3400);
    setTimeout(() => jakeSay(STR.jake.colWin, true), first ? 8000 : 6000);
    return first;
  },
  onReward() {
    giveFlameHeart();
    sfx("win");
    toast(input.touch ? STR.fire.heartTouch : STR.fire.heart, 6);
    crystalNews("fire");
  },
  leave: () => leaveColosseum(),
});
const flamePath = createFlamePath(scene, {
  save, writeSave, player, toast, sfx, burst, flame: flameNpc,
  jakeSay: (text) => jakeSay(text, true),
  enterColosseum: () => enterColosseum(),
  locked: () => !hasCrystal(save, "mint"), // she only sends a champion who beat the Peppermint Butler
});
/** The Flame Heart: one more heart, and the Fire Wave (F). */
function giveFlameHeart() {
  flameHeart = true;
  setHeartsMax();
  player.hearts = T.heartsMax;
  updateHearts();
  player.fireCd = 0;
  save.fire.wave = true; // (the toast that comes with it tells him about the wave)
  writeSave();
  showFirePower();
}
// ── the Temple of the Enchiridion: the three boss crystals open it, the book of heroes is inside ──
const temple = createTemple(scene, {
  save, writeSave, player, toast, sfx, burst, shake,
  has: (id) => hasCrystal(save, id),
  gems: () => foundCount(),
  totalGems: treasures.length,
  onOpen() {
    toast(STR.temple.open, 5);
    setTimeout(() => jakeSay(STR.jake.templeOpen, true), 2500);
  },
  onBook() {
    sfx("win");
    winT = 5;
    toast(STR.temple.book, 6);
    renderClues();
    setTimeout(() => jakeSay(STR.jake.book, true), 2500); // (and on the way out, "Billy" wants to see it: lich.js)
  },
});
// ── Billy: his test (five slimes), then the boss diamonds and every golden crystal (the treasures), which open the temple door ──
let lichGoal = () => "";
const billy = createBilly(scene, {
  save, writeSave, player, toast, sfx, burst,
  npc: npcs.find((n) => n.id === "billy"),
  diamonds: () => crystalCount(save),
  totalD: CRYSTALS.length,
  gems: () => foundCount(),
  totalGems: treasures.length,
  templeOpen: () => save.temple.open,
  openTemple: () => temple.open(),
  bookTaken: () => save.temple.book,
  jakeSay: (text) => jakeSay(text, true),
  news: () => renderClues(),
  after: () => lichGoal(), // (his quest done: what the Lich left to do)
});
// ── the twist: Billy was the Lich all along; his dark portal by the temple and his cave of bones ──
const lichTalk = { id: "lich", name: STR.names.lich };
const lich = createLich(scene, {
  save, writeSave, player, toast, sfx, burst, shake, makeShadow,
  billy: npcs.find((n) => n.id === "billy"),
  bookTaken: () => save.temple.book,
  ground: groundHeight,
  jakeSay: (text) => jakeSay(text, true),
  jakeJoin: () => jakeJoin(false),
  dialogOpen: () => dialog.open,
  talk: (who, lines, after) => talkScript(who, lines, after),
  talking: () => dialog.open && (dialog.npc === lichTalk || dialog.npc?.id === "lich"),
  warp: (to, done) => warpTo(to, done, "lich"),
  place: (x, y, z, tx, tz) => placeFinn(x, y, z, tx, tz),
  face(x, y, z) {
    const p = player.pos;
    player.heading = player.prevHeading = Math.atan2(x - p.x, z - p.z);
    cam.yaw = Math.atan2(p.x - x, p.z - z) + 0.5; // a little to the side, so both are in the picture
    cam.pitch = 0.12;
    cam.dist = Math.max(cam.dist, 7);
  },
  news() { renderClues(); billy.refresh(); },
  fight: () => startLichFight(),
  fighting: () => lichBoss.fighting(),
  bossBook: () => lichBoss.book(),
});
lichGoal = () => lich.goal();
// ── the last fight: the Lich in his cave (lichboss.js); talking to him there starts it ──
let lichHinted = false, infernoHinted = false, fallHinted = false;
const lichBoss = createLichBoss(scene, {
  player, fx, sfx, shake, freeze, dropHeart, burst,
  hurt: (n, nx, nz, kind) => hurtPlayer(n, nx, nz, kind),
  kill() {
    // "Fall": no heart is enough
    if (player.dead > 0) return;
    player.invuln = 0;
    hurtPlayer(player.hearts, 0, 0, "dark");
  },
  onStart() {
    jakeJoin(false);
    jakeSay(STR.jake.lichFight, true);
    if (!lichHinted) { lichHinted = true; setTimeout(() => toast(STR.lich.healHint, 6), 3200); }
  },
  onInferno() {
    jakeSay(STR.jake.lichInferno, true);
    if (!infernoHinted) { infernoHinted = true; toast(STR.lich.infernoHint, 4.5); }
  },
  onFall() {
    jakeSay(STR.jake.lichFall, true);
    if (!fallHinted) { fallHinted = true; toast(STR.lich.fallHint, 5); }
  },
  onTear() {
    setTimeout(() => jakeSay(STR.jake.lichTear, true), 1500);
    toast(STR.lich.tearHint, 4);
  },
  onWin() {
    const first = save.lich.q !== "won";
    save.lich.q = "won";
    save.lich.wins++;
    writeSave();
    player.hearts = T.heartsMax;
    updateHearts();
    return first;
  },
  onBook() {
    sfx("win");
    winT = 8;
    toast(save.lich.wins > 1 ? STR.lich.again2 : STR.lich.end, 10);
    setTimeout(() => jakeSay(STR.jake.lichWin, true), 2500);
    renderClues();
    billy.refresh();
  },
});
/** Finn talked to the Lich in his cave: the fight starts where they stand (fresh hearts, Jake at his side). */
function startLichFight() {
  for (const p of pickups) p.on = false;
  player.hearts = T.heartsMax;
  updateHearts();
  lichBoss.enter();
}
/** Finn (and Jake) at the way into the cave, by the portal, facing the middle. */
function placeInCave() {
  const d = 22, a = CAVE.spawnA;
  placeFinn(CAVE.x + Math.sin(a) * d, CAVE.y, CAVE.z + Math.cos(a) * d, CAVE.x, CAVE.z);
}
const fighting = () => boss.fighting() || butler.fighting() || flameKing.fighting() || lichBoss.fighting();
/** What a boss fight puts in reach of the sword and of Jake: the bosses (while they can be hit) and the Butler's imps. */
function bossFoes() {
  const out = [], b = boss.foe(), m = butler.foe(), f = flameKing.foe(), l = lichBoss.foe();
  if (b) out.push(b);
  if (m) out.push(m);
  if (f) out.push(f);
  if (l) out.push(l);
  out.push(...butler.minions(), ...lichBoss.minions());
  return out;
}
// the boss arenas, for Jake and the camera (which stays inside their rim)
const CROWN_RING = { x: CROWN.x, z: CROWN.z, get y() { return CROWN.y; }, r: CROWN.r };
const LAIR_RING = { x: LAIR.x, z: LAIR.z, y: LAIR.y, r: LAIR.wall - 0.3 };
const COL_RING = { x: ARENA.x, z: ARENA.z, y: ARENA.y, r: 29.6 };
const LICH_RING = { x: CAVE.x, z: CAVE.z, y: CAVE.y, r: CAVE.r };
const arenaAt = (p) => (boss.holds(p) ? CROWN_RING : butler.holds(p) ? LAIR_RING : flameKing.holds(p) ? COL_RING : lich.holds(p) ? LICH_RING : null);

// ── Finn's Fire Wave (the Flame Heart's power): the cut is swing 4 (startFire), the wave firewave.js ──
const FIRE_FX = [0xff5a1a, 0xffb13b, 0xffe08a];
const fireWave = createFireWave(scene, {
  burst, sfx, fx,
  foes() {
    const out = [];
    for (const e of slimes) if (alive(e)) out.push({ o: e, x: e.x, y: e.y, z: e.z, r: 0.7 });
    for (const b of bossFoes()) out.push({ o: b, x: b.x, y: b.y, z: b.z, r: b.isBoss ? 1.5 : 0.5 });
    return out;
  },
  hit(o, nx, nz, n) {
    fx.star(o.x - nx * 0.5, o.y + (o.isBoss ? 1.4 : o.hurt ? 0 : 0.7), o.z - nz * 0.5, 1.3, 0xff8a2a);
    burst(o.x, o.y + 0.7, o.z, 10, FIRE_FX, 5, 5, 0.6, 0.6);
    if (o.hurt) o.hurt(T.fireBoss, nx, nz); // a boss, or one of the Butler's imps
    else damageSlime(o, nx, nz, T.slimeHp, 12, 8);
    if (n === 1) { freeze(0.07); shake(0.25); }
  },
});
fireWave.attach(finn);
let fireSaid = false, swordFire = 0;

// ── teleports: a flash (the Butler's dark purple, or Flame Princess's fire), the screen goes dark,
// and Finn and Jake are somewhere else (the Dark Lair or the Colosseum of Flames, or back where they
// came from); `to` moves them there while it's dark ──
const warp = { t: -1, to: null, done: null };
function warpTo(to, done = null, kind = "dark") {
  if (warp.t >= 0) return;
  Object.assign(warp, { t: 0, to, done });
  $("fade").classList.add(kind, "on");
  sfx("warp");
  const cols = kind === "fire" ? [0xff5a1a, 0xffd24a, 0x3a0a04] : kind === "lich" ? [0x7dff5a, 0xb58aff, 0x0a140a] : [0x6a2bd6, 0xb070ff, 0x1a0a26];
  burst(player.pos.x, player.pos.y + 1, player.pos.z, 30, cols, 5, 6, 0.2, 1);
  burst(jake.x, jake.y + 0.6, jake.z, 16, cols.slice(0, 2), 4, 5, 0.2, 0.9);
}
function stepWarp(dt) {
  const was = warp.t;
  warp.t += dt;
  player.invuln = Math.max(player.invuln, 0.5);
  if (was < 0.6 && warp.t >= 0.6) {
    warp.to();
    $("fade").classList.remove("on");
  }
  if (warp.t >= 1.2) {
    warp.t = -1;
    setTimeout(() => { if (warp.t < 0) $("fade").classList.remove("dark", "fire", "lich"); }, 500);
    const d = warp.done;
    warp.done = null;
    if (d) d();
  }
}
/** Finn at (x, y, z) facing (tx, tz), the camera behind him, Jake at his side. */
function placeFinn(x, y, z, tx, tz) {
  player.pos.set(x, y, z);
  player.prev.copy(player.pos);
  player.vel.set(0, 0, 0);
  player.heading = player.prevHeading = Math.atan2(tx - x, tz - z);
  cam.yaw = Math.atan2(x - tx, z - tz);
  cam.pitch = 0.3;
  cam.ty = y + 1.4;
  const sx = Math.cos(player.heading), sz = -Math.sin(player.heading);
  jake.x = jake.px = x + sx * 2;
  jake.z = jake.pz = z + sz * 2;
  jake.y = jake.ry = y;
  jake.act = null;
}
/** Off to the Dark Lair (after the talk with the Butler): Finn lands on the rim, he waits in the middle. */
function enterLair() {
  warpTo(() => {
    const a = LAIR.spawnA;
    placeFinn(LAIR.x + Math.sin(a) * 10.5, LAIR.y, LAIR.z + Math.cos(a) * 10.5, LAIR.x, LAIR.z);
    for (const p of pickups) p.on = false;
    player.hearts = T.heartsMax; // he's a gentleman: Finn starts it fresh
    updateHearts();
    butler.enter();
  });
}
/** Finn (and Jake) in the castle hall, in front of the Butler, facing him. */
function placeByButler() {
  const n = pepNpc, x = n.x + Math.sin(n.baseYaw) * 2.6, z = n.z + Math.cos(n.baseYaw) * 2.6;
  placeFinn(x, n.y, z, n.x, n.z);
}
/** Through the portal, back to the castle. */
function leaveLair() {
  warpTo(() => {
    butler.off();
    if (save.mint.wins > 0 && !hasNight) { giveNightSword(); setTimeout(() => toast(STR.mint.sword, 5), 700); crystalNews("mint"); } // left it lying there: it's his anyway
    placeByButler();
  });
}
/** Off to the Colosseum of Flames (after the talk with Flame Princess): Finn comes in by the gate, her father waits in the middle. */
function enterColosseum() {
  warpTo(() => {
    const a = ARENA.spawnA;
    placeFinn(ARENA.x + Math.sin(a) * 24, ARENA.y, ARENA.z + Math.cos(a) * 24, ARENA.x, ARENA.z);
    for (const p of pickups) p.on = false;
    player.hearts = T.heartsMax; // a duel by the old law: Finn starts it fresh
    updateHearts();
    flameKing.enter();
  }, null, "fire");
}
/** Finn (and Jake) in the Fire Palace's throne room, in front of Flame Princess, facing her. */
function placeByFlame() {
  const n = flameNpc, x = n.x + Math.sin(n.baseYaw) * 2.6, z = n.z + Math.cos(n.baseYaw) * 2.6;
  placeFinn(x, n.y, z, n.x, n.z);
}
/** Through the gate, back to the palace. */
function leaveColosseum() {
  warpTo(() => {
    flameKing.off();
    if (save.fire.wins > 0 && !flameHeart) { giveFlameHeart(); setTimeout(() => toast(input.touch ? STR.fire.heartTouch : STR.fire.heart, 6), 700); crystalNews("fire"); } // left it floating there: it's his anyway
    placeByFlame();
  }, null, "fire");
}

// ── dialog ──
// after: what happens once the last line is read (a quest moves on)
const dialog = { open: false, lines: [], i: 0, npc: null, after: null };
/** Jake doesn't know where the treasures are: he says who does (the nearest one Finn hasn't heard yet), or repeats a clue. */
function jakeLines() {
  if (crystalCount(save) === CRYSTALS.length && foundCount() === treasures.length && !save.temple.book) return [STR.jake.crystals, pick(STR.dialog.jakeExtra)];
  const left = treasures.filter((t) => !t.found && STR.clues[t.id]);
  if (!left.length) return [STR.dialog.jakeNone];
  const dist = (x, z) => Math.hypot(x - player.pos.x, z - player.pos.z);
  const unheard = left.filter((t) => !save.clues.includes(t.id));
  let line;
  if (unheard.length) {
    let who = null, bd = Infinity;
    for (const t of unheard) {
      const id = STR.clues[t.id][0], n = npcs.find((m) => m.id === id), d = n ? dist(n.x, n.z) : 1e9;
      if (d < bd) { bd = d; who = id; }
    }
    const atCrown = who === "iceking" && (save.ice.q === "boss" || save.ice.q === "won");
    line = STR.dialog.jakeAsk(STR.npcThe[who], STR.npcWhere[atCrown ? "icecrown" : who]);
  } else {
    let best = left[0], bd = Infinity;
    for (const t of left) if (dist(t.x, t.z) < bd) { bd = dist(t.x, t.z); best = t; }
    const [who, clue] = STR.clues[best.id];
    line = STR.dialog.jakeRemind(STR.npcThe[who], clue);
  }
  return [line, pick(STR.dialog.jakeExtra)];
}
/** The pause menu's journal: what Finn was told about the treasures still missing. */
function renderClues() {
  const el = $("clues"), left = treasures.filter((t) => !t.found), n = crystalCount(save);
  el.hidden = false;
  // the crystals first: which ones Finn has, and where the next one (or the temple) is
  const crys = `<h3>${STR.crystals.title} <span>${n}/${CRYSTALS.length}</span></h3><ul>` +
    CRYSTALS.map((c) => `<li>${hasCrystal(save, c.id) ? "✅" : "⬜"} <b>${STR.crystals.names[c.id]}</b>: ${STR.crystals.from[c.id]}</li>`).join("") +
    `</ul><p>${STR.billy.next[save.billy.q] || (save.temple.book && STR.lich.next[save.lich.q]) || (n === CRYSTALS.length && !left.length && !save.temple.open ? STR.billy.complete : STR.crystals.next[n + (save.temple.book ? 1 : 0)])}</p>`;
  if (!left.length) { el.innerHTML = crys; return; }
  const known = left.filter((t) => save.clues.includes(t.id) && STR.clues[t.id]);
  const more = left.some((t) => STR.clues[t.id] && !save.clues.includes(t.id));
  el.innerHTML = crys + `<h3 class="sep">${STR.cluesTitle} <span>${foundCount()}/${treasures.length}</span></h3>` +
    (known.length ? `<ul>${known.map((t) => `<li><b>${STR.names[STR.clues[t.id][0]]}:</b> ${STR.clues[t.id][1]}</li>`).join("")}</ul>` : "") +
    (more ? `<p>${known.length ? STR.cluesMore : STR.cluesNone}</p>` : "");
}
/** A line of dialog gave treasures away (c: [ids]): into the journal. */
function learnClues(ids) {
  const fresh = ids.filter((id) => !save.clues.includes(id) && treasures.some((t) => t.id === id && !t.found));
  if (!fresh.length) return;
  save.clues.push(...fresh);
  writeSave();
  renderClues();
  toast((input.touch ? STR.clueNewTouch : STR.clueNew)(fresh.length), 3);
}
/** A dialog the story opens by itself (who: an npc record or { name }); after: once it's read. */
function talkScript(who, lines, after) {
  dialog.open = true;
  dialog.npc = who;
  dialog.lines = lines;
  dialog.after = after;
  dialog.i = 0;
  renderDialog();
  sfx("talk");
}
function openDialog(n) {
  dialog.open = true;
  dialog.npc = n;
  dialog.after = n.id === "iceking" ? () => quest.afterTalk() : n.id === "pepbut" ? () => spirits.afterTalk() : n.id === "flame" ? () => flamePath.afterTalk() : n.id === "billy" ? () => billy.afterTalk() : n === bossTalk ? () => boss.rematch() : n === lichTalk ? () => lich.afterTalk() : null;
  dialog.lines = n.id === "jake" ? jakeLines() : n === bossTalk ? STR.ice.rest : n.id === "iceking" ? quest.lines() : n.id === "pepbut" ? spirits.lines() : n.id === "flame" ? flamePath.lines() : n.id === "billy" ? billy.lines()
    : n === lichTalk ? lich.lines()
    : n.kind ? [pick([...STR.citizens.lines[n.kind], ...STR.citizens.common[STR.citizens.home[n.kind] || "candy"]])] : STR.dialog[n.id];
  dialog.i = 0;
  renderDialog();
  sfx("talk");
}
function renderDialog() {
  $("dialog").hidden = !dialog.open;
  if (!dialog.open) return;
  $("dlgName").textContent = dialog.npc.name;
  const line = dialog.lines[dialog.i]; // a string, or { t: text, c: [treasure ids it gives away] }
  $("dlgText").textContent = typeof line === "string" ? line : line.t;
  if (line.c) learnClues(line.c);
  $("dlgHint").textContent = input.touch ? STR.nextTouch : STR.next;
}
function advanceDialog() {
  dialog.i++;
  if (dialog.i >= dialog.lines.length) dialog.open = false;
  else sfx("talk");
  renderDialog();
  if (!dialog.open && dialog.after) {
    const after = dialog.after;
    dialog.after = null;
    after();
  }
}
const jakeTalk = { id: "jake", name: STR.names.jake };
const bossTalk = { id: "icekingBoss", name: STR.names.iceking }; // up on the crown, after he lost
function nearestTalkable() {
  let best = null, bd = 4.5;
  for (const n of npcs) {
    if (n.hidden || n.busy) continue;
    const d = Math.hypot(n.x - player.pos.x, n.z - player.pos.z);
    if (d < bd && Math.abs(n.y - player.pos.y) < 3.5) { best = n; bd = d; }
  }
  const bt = boss.talker();
  if (bt && Math.hypot(bt.x - player.pos.x, bt.z - player.pos.z) < bd && Math.abs(bt.y - player.pos.y) < 3.5) best = bossTalk;
  const lt = lich.talker();
  if (lt && Math.hypot(lt.x - player.pos.x, lt.z - player.pos.z) < 4.5 && Math.abs(lt.y - player.pos.y) < 3.5) { best = lichTalk; lichTalk.name = lich.name(); }
  if (!best) {
    bd = 2.8;
    for (const c of crowd.list) {
      const d = Math.hypot(c.x - player.pos.x, c.z - player.pos.z);
      if (c.mesh.visible && d < bd && Math.abs(c.y - player.pos.y) < 2.5) { best = c; bd = d; }
    }
  }
  if (!best && Math.hypot(jake.x - player.pos.x, jake.z - player.pos.z) < 2.6 && Math.abs(jake.y - player.pos.y) < 2) best = jakeTalk;
  return best;
}

// ── gameplay ──
function hurtPlayer(n, nx, nz, kind) {
  if (player.invuln > 0 || player.dead > 0) return;
  if (kind === "slime") fx.star(player.pos.x - nx * 0.4, player.pos.y + 1, player.pos.z - nz * 0.4, 0.9, 0xff4d6d);
  player.hearts -= n;
  player.invuln = T.invuln;
  player.sinceHurt = 0;
  player.vel.x = nx * 9;
  player.vel.z = nz * 9;
  player.vel.y = 7;
  player.onGround = false;
  player.ev.hurt++;
  sfx("hurt");
  flashHurt();
  shake(0.35);
  updateHearts();
  if (player.hearts <= 0) return faint();
  jakeSay(kind === "lava" ? STR.jake.lava : pick(STR.jake.hurt));
}
// where Finn wakes up: "crown" (the last ledge by the Ice Crown's gate), "lair" (by the Butler in
// the castle), "colosseum" (by Flame Princess in her throne room) or null (at home)
let faintedIn = null;
function faint() {
  player.dead = 1.6;
  dialog.open = false;
  dialog.after = null;
  renderDialog();
  $("fade").classList.add("on");
  faintedIn = boss.fighting() ? "crown" : butler.fighting() ? "lair" : flameKing.fighting() ? "colosseum" : lichBoss.fighting() ? "cave" : null;
  if (faintedIn === "crown") boss.finnDown();
  if (faintedIn === "lair") { butler.finnDown(); spirits.lost(); }
  if (faintedIn === "colosseum") { flameKing.finnDown(); flamePath.lost(); }
  if (faintedIn === "cave") lichBoss.finnDown();
  flamePath.fainted(); // the Royal Flame goes out with him
  fireWave.reset();
  toast({ crown: STR.ice.faint, lair: STR.mint.faint, colosseum: STR.fire.faint, cave: STR.lich.faint }[faintedIn] || STR.fainted, faintedIn === "cave" ? 5 : 3);
}
function respawn() {
  if (faintedIn === "lair") {
    butler.off();
    placeByButler();
  } else if (faintedIn === "colosseum") {
    flameKing.off();
    placeByFlame();
  } else if (faintedIn === "cave") {
    lichBoss.off();
    placeInCave();
  } else if (faintedIn === "crown") {
    const L = CROWN.landing;
    player.pos.set(L.x, L.y, L.z);
    player.prev.copy(player.pos);
    player.vel.set(0, 0, 0);
    player.heading = player.prevHeading = Math.atan2(CROWN.x - L.x, CROWN.z - L.z);
    cam.yaw = Math.atan2(L.x - CROWN.x, L.z - CROWN.z);
    cam.pitch = 0.35;
    cam.ty = L.y + 1.4;
    boss.afterFaint();
  } else placeAtSpawn();
  for (const p of pickups) p.on = false;
  player.hearts = T.heartsMax;
  player.invuln = 1.5;
  player.dead = 0;
  updateHearts();
  $("fade").classList.remove("on");
  const retry = { crown: STR.jake.retry, lair: STR.jake.lairRetry, colosseum: STR.jake.colRetry, cave: STR.jake.lichRetry }[faintedIn] || STR.jake.fainted;
  setTimeout(() => jakeSay(retry, true), 600);
}
/** Knocks a slime along (nx, nz); returns true if that finished it (it flies, then pops). */
function damageSlime(e, nx, nz, amount = 1, kb = 9, up = 5) {
  if (e.dead || e.st === "dying") return false;
  const interrupted = e.st === "windup"; // hit while crouching to pounce: stunned for longer
  e.hp -= amount;
  e.flash = 0.12;
  e.hitN++;
  e.vx = nx * kb;
  e.vz = nz * kb;
  e.vy = up;
  e.onGround = false;
  e.hopCd = 0.8;
  e.face = Math.atan2(-nx, -nz); // turns to face the blow
  e.tumble = kb >= 12 ? (Math.random() < 0.5 ? -1 : 1) * (9 + kb * 0.4) : 0;
  e.stunFor = (interrupted ? 0.8 : 0.3) + kb * 0.015;
  setSlime(e, e.hp <= 0 ? "dying" : "hurt");
  sfx(amount > 1 ? "hitBig" : "hit");
  burst(e.x, e.y + 0.7, e.z, 5 + amount * 3, [e.color, 0xffffff], 4 + amount, 3 + amount);
  if (e.hp > 0) return false;
  sfx("squish");
  return true;
}
function popSlime(e) {
  e.dead = true;
  billy.kill();
  e.respawn = T.slimeRespawn;
  e.model.visible = e.shadow.visible = false;
  burst(e.x, e.y + 0.6, e.z, 26, [e.color, 0xffffff], 8, 7);
  const g = supportAt(e.x, e.z, 0.3, e.y + 0.5);
  if (e.y - g < 3) fx.puddle(e.x, g, e.z, 1.1, e.color);
  sfx("pop");
  shake(0.15);
  // now and then a heart, more often when Finn needs one
  if (Math.random() < (player.hearts <= 2 ? 0.55 : player.hearts < T.heartsMax ? 0.3 : 0.12)) dropHeart(e.x, e.y + 0.8, e.z);
}
/** The slime a swing should turn Finn toward: in front of him (or right beside him), close. */
function aimTarget(maxD) {
  let best = null, bs = Infinity;
  for (const e of slimes) {
    if (!alive(e)) continue;
    const dx = e.x - player.pos.x, dz = e.z - player.pos.z, d = Math.hypot(dx, dz);
    if (d > maxD || Math.abs(e.y - player.pos.y) > 2) continue;
    const off = Math.abs(wrapAngle(Math.atan2(dx, dz) - player.heading));
    if (off > 1.7 && d > 2.2) continue;
    const score = d + off * 1.5;
    if (score < bs) { bs = score; best = e; }
  }
  for (const b of bossFoes()) {
    const dx = b.x - player.pos.x, dz = b.z - player.pos.z, d = Math.hypot(dx, dz);
    const off = Math.abs(wrapAngle(Math.atan2(dx, dz) - player.heading)), score = d + off * 1.5 - (b.isBoss ? 0.5 : 0);
    if (d < maxD + 0.8 && Math.abs(b.y - player.pos.y) < 2.2 && (off < 1.7 || d < 2.6) && score < bs) { bs = score; best = b; }
  }
  return best;
}
function startSwing(kind) {
  const pl = player, sw = blades()[kind];
  pl.atkKind = kind;
  pl.attackT = 0;
  pl.sinceAtk = 0;
  pl.atkBuf = 0;
  pl.hitDone = false;
  pl.ev.attack++;
  pl.ev.atkKind = kind;
  sfx(["sword", "sword2", "sword3", "spin"][kind]);
  // aim assist: turn toward the slime in front and step in to meet it
  const tgt = kind === 3 ? null : aimTarget(sw.range + 2.5);
  pl.aim = tgt ? Math.atan2(tgt.x - pl.pos.x, tgt.z - pl.pos.z) : null;
  pl.aimFoe = null;
  if (pl.onGround && sw.lunge) {
    const h = pl.aim ?? pl.heading;
    const v = tgt ? clamp(sw.lunge + (Math.hypot(tgt.x - pl.pos.x, tgt.z - pl.pos.z) - 1.9) * 5, 2, 13) : sw.lunge;
    pl.vel.x = Math.sin(h) * v;
    pl.vel.z = Math.cos(h) * v;
  }
}
/** The foe the Fire Wave should run at: ahead of Finn (or right beside him), within its run; bosses first. */
function fireTarget() {
  let best = null, bs = Infinity;
  const consider = (o) => {
    const dx = o.x - player.pos.x, dz = o.z - player.pos.z, d = Math.hypot(dx, dz);
    if (d > fireWave.WAVE.range || Math.abs(o.y - player.pos.y) > 3.5) return;
    const off = Math.abs(wrapAngle(Math.atan2(dx, dz) - player.heading));
    if (off > 1.1 && d > 3) return;
    const score = d * 0.35 + off * 4 - (o.isBoss ? 1.5 : 0);
    if (score < bs) { bs = score; best = o; }
  };
  for (const e of slimes) if (alive(e)) consider(e);
  for (const b of bossFoes()) consider(b);
  return best;
}
/** F / RB / the Fire button: the burning sword raised, then brought down (the wave goes out at SWING[4].hit). */
function startFire() {
  const pl = player;
  pl.atkKind = 4;
  pl.attackT = 0;
  pl.sinceAtk = 0;
  pl.atkBuf = pl.fireBuf = 0;
  pl.hitDone = false;
  pl.fireCd = T.fireCd;
  pl.ev.attack++;
  pl.ev.atkKind = 4;
  pl.aimFoe = fireTarget();
  pl.aim = pl.aimFoe ? Math.atan2(pl.aimFoe.x - pl.pos.x, pl.aimFoe.z - pl.pos.z) : null;
  sfx("fireCharge");
}
/** The blade comes down: the Fire Wave runs out along the floor the way Finn faces. */
function launchFire() {
  const pl = player, dx = Math.sin(pl.heading), dz = Math.cos(pl.heading);
  fireWave.launch(pl.pos.x, pl.pos.y, pl.pos.z, dx, dz);
  fx.ring(pl.pos.x + dx * 0.8, supportAt(pl.pos.x + dx * 0.8, pl.pos.z + dz * 0.8, 0.3, pl.pos.y + 0.6), pl.pos.z + dz * 0.8, 3.2, 0xff8a2a, 0.35);
  sfx("fireWave");
  shake(0.3);
  pl.ev.hit++; // (the lunge's dip)
  if (!fireSaid) { fireSaid = true; setTimeout(() => jakeSay(STR.jake.fireFirst, true), 700); }
  else if (Math.random() < 0.2) jakeSay(pick(STR.jake.fire));
}
/** F while the wave is recharging: the badge shakes, the sword just smokes. */
function fireNope() {
  for (const el of [$("firePow"), $("bFire")]) {
    el.classList.remove("nope");
    void el.offsetWidth; // (restarts the animation)
    el.classList.add("nope");
  }
  const h = player.heading;
  burst(player.pos.x + Math.sin(h) * 0.5, player.pos.y + 1, player.pos.z + Math.cos(h) * 0.5, 5, [0x5a5a64, 0x8a8a94], 1.5, 2, -0.2, 0.6);
}
function swordHit(sw) {
  let n = 0, kill = false;
  for (const e of slimes) {
    if (!alive(e)) continue;
    const dx = e.x - player.pos.x, dz = e.z - player.pos.z, d = Math.hypot(dx, dz);
    if (d > sw.range + 0.6 || Math.abs(e.y - player.pos.y) > 2) continue;
    const off = Math.abs(wrapAngle(Math.atan2(dx, dz) - player.heading));
    if (off > sw.arc && d > 1.3) continue;
    const nx = dx / (d || 1), nz = dz / (d || 1);
    fx.star(e.x - nx * 0.55, e.y + 0.7, e.z - nz * 0.55, sw.heavy ? 1.35 : 0.95, sw.spark);
    kill = damageSlime(e, nx, nz, sw.dmg, sw.kb, sw.up) || kill;
    n++;
  }
  if (boss.swordHit(sw, player.heading)) n++;
  if (butler.swordHit(sw, player.heading)) n++;
  if (flameKing.swordHit(sw, player.heading)) n++;
  if (lichBoss.swordHit(sw, player.heading)) n++;
  if (!n) return;
  player.ev.hit++;
  freeze(kill || sw.heavy ? 0.09 : 0.05);
  shake(sw.heavy || kill ? 0.3 : 0.12);
}
function collect(t) {
  t.found = true;
  t.mesh.visible = false;
  if (!save.found.includes(t.id)) save.found.push(t.id);
  writeSave();
  burst(t.x, t.y, t.z, 30, [0xffd23f, 0xffffff, 0xfff2a0], 7, 7);
  sfx("collect");
  updateGems();
  renderClues();
  billy.refresh();
  if (billy.ready() && foundCount() === treasures.length) setTimeout(() => toast(STR.billy.complete, 6), 7500); // the last one: off to Billy
  const n = foundCount();
  toast(STR.found(n, treasures.length));
  if (n === treasures.length) {
    save.won = true;
    writeSave();
    winT = 3.5;
    setTimeout(() => { sfx("win"); toast(STR.allFound, 6); }, 900);
    setTimeout(() => jakeSay(STR.jake.win, true), 7000);
  } else setTimeout(() => jakeSay(n === 1 ? STR.jake.first : pick(STR.jake.collect), true), 1200);
}
let winT = 0;
let ladderHintShown = false;

function stepPlayer(dt) {
  const pl = player;
  pl.prev.copy(pl.pos);
  pl.prevHeading = pl.heading;
  if (pl.dead > 0) {
    pl.dead -= dt;
    if (pl.dead <= 0) respawn();
    return;
  }
  const canAct = !dialog.open && warp.t < 0 && !lich.busy() && !lichBoss.rooted(); // ("Stop": the Lich holds him still)
  const ix = canAct ? input.move.x : 0, iy = canAct ? input.move.y : 0;
  const s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
  const wx = -s * iy + c * ix, wz = -c * iy - s * ix;
  const wl = Math.hypot(wx, wz);
  // a ground swing plants Finn's feet (the lunge still carries him in)
  const swinging = pl.attackT >= 0, planted = swinging && pl.onGround;
  const speed = (input.sprint ? T.run : T.walk) * (planted ? 0.2 : 1);
  const acc = (pl.onGround ? T.accelGround : T.accelAir) * dt;
  let dvx = wx * speed - pl.vel.x, dvz = wz * speed - pl.vel.z;
  const dl = Math.hypot(dvx, dvz);
  if (dl > acc) { dvx *= acc / dl; dvz *= acc / dl; }
  pl.vel.x += dvx;
  pl.vel.z += dvz;
  // (the Fire Wave's cut keeps turning toward its foe until the blade comes down)
  if (swinging && pl.aimFoe && pl.attackT < SWING[pl.atkKind].hit) pl.aim = Math.atan2(pl.aimFoe.x - pl.pos.x, pl.aimFoe.z - pl.pos.z);
  if (swinging && pl.aim !== null && pl.attackT < SWING[pl.atkKind].hit) pl.heading = turnToward(pl.heading, pl.aim, 40 * dt);
  else if (wl > 0.1) pl.heading = turnToward(pl.heading, Math.atan2(wx, wz), (planted ? 3 : 14) * dt);

  // ladders: walk into one to climb; W/S (forward/back) go up/down, jump lets go
  pl.grabCd = Math.max(0, pl.grabCd - dt);
  const lad = canAct && pl.grabCd <= 0 ? ladderAt(pl.pos.x, pl.pos.y, pl.pos.z) : null;
  if (!lad) pl.climbing = false;
  else if (!pl.climbing && wl > 0.2 && pl.pos.y < lad.y1 - 0.15) {
    const tx = lad.x - pl.pos.x, tz = lad.z - pl.pos.z, td = Math.hypot(tx, tz) || 1;
    const dotC = (wx * tx + wz * tz) / (wl * td), dotF = (wx * lad.fx + wz * lad.fz) / wl;
    if (!pl.onGround || dotC > 0.3 || dotF > 0.3) {
      pl.climbing = true;
      if (!ladderHintShown) { ladderHintShown = true; toast(input.touch ? STR.ladderHintTouch : STR.ladderHint, 3.5); }
    }
  }
  if (pl.climbing) {
    if (input.consume("jump")) {
      pl.climbing = false;
      pl.grabCd = 0.4;
      pl.vel.set(-lad.fx * 4, T.jumpV * 0.8, -lad.fz * 4);
      pl.jumps = 1;
      pl.onGround = false;
      pl.ev.jump++;
      sfx("jump");
    } else {
      const dir = iy > 0.3 || (iy >= -0.3 && wl > 0.3 && Math.abs(ix) < 0.3) ? 1 : iy < -0.3 ? -1 : 0;
      if (pl.onGround && dir < 0) {
        pl.climbing = false;
        pl.grabCd = 0.3;
      } else pl.vel.set((lad.x - pl.pos.x) * 8, dir * T.climb, (lad.z - pl.pos.z) * 8);
      pl.heading = turnToward(pl.heading, Math.atan2(lad.fx, lad.fz), 18 * dt);
      if (dir > 0 && pl.pos.y >= lad.y1 - 0.05) {
        pl.climbing = false;
        pl.grabCd = 0.4;
        pl.ev.snapOff.copy(pl.pos);
        pl.pos.set(lad.x + lad.ex * 1.8, lad.y1 + 0.05, lad.z + lad.ez * 1.8);
        pl.prev.copy(pl.pos);
        pl.vel.set(lad.ex * 2, 0, lad.ez * 2);
        pl.ev.snapOff.sub(pl.pos); // the render glides across this instead of popping
        pl.ev.snap++;
      }
    }
  }

  if (!pl.climbing && canAct && input.consume("jump")) pl.buffer = T.buffer;
  else pl.buffer = Math.max(0, pl.buffer - dt);
  if (pl.buffer > 0 && !pl.climbing) {
    if (pl.onGround || pl.sinceGround < T.coyote) {
      pl.vel.y = T.jumpV;
      pl.jumps = 1;
      pl.onGround = false;
      pl.sinceGround = 1;
      pl.buffer = 0;
      pl.ev.jump++;
      sfx("jump");
      burst(pl.pos.x, pl.pos.y + 0.1, pl.pos.z, 5, 0xffffff, 3, 1, 0.3, 0.4);
    } else if (pl.jumps < 2) {
      pl.vel.y = T.jump2V;
      pl.jumps = 2;
      pl.buffer = 0;
      pl.ev.jump2++;
      sfx("jump2");
      burst(pl.pos.x, pl.pos.y + 0.2, pl.pos.z, 10, [0xffffff, 0xbfeaff], 5, 0.5, 0.2, 0.45);
    }
  }
  if (!pl.climbing) {
    let g = T.gravity;
    if (pl.vel.y > 0 && !input.held("jump")) g += T.lowJumpExtra;
    pl.vel.y = Math.max(-T.fallMax, pl.vel.y - g * dt);
  }

  const feet0 = pl.pos.y;
  pl.pos.x += pl.vel.x * dt;
  pl.pos.z += pl.vel.z * dt;
  resolveXZ(pl.pos, T.radius, pl.pos.y, pl.pos.y + T.height, pl.vel);
  const d0 = Math.hypot(pl.pos.x, pl.pos.z);
  if (d0 > WORLD.limit) { pl.pos.x *= WORLD.limit / d0; pl.pos.z *= WORLD.limit / d0; }
  let ny = pl.pos.y + pl.vel.y * dt;
  if (pl.vel.y > 0) {
    const ceil = ceilingAt(pl.pos.x, pl.pos.z, T.radius, pl.pos.y + T.height, ny + T.height);
    if (ceil !== Infinity) { ny = ceil - T.height; pl.vel.y = 0; }
  }
  const sup = supportAt(pl.pos.x, pl.pos.z, T.radius, feet0 + STEP + 0.05);
  const wasGround = pl.onGround;
  if (ny <= sup) {
    if (!wasGround) { pl.ev.land++; pl.ev.landV = -pl.vel.y; }
    if (!wasGround && pl.vel.y < -14) { sfx("land"); burst(pl.pos.x, sup + 0.1, pl.pos.z, 6, 0xffffff, 3, 1, 0.3, 0.35); }
    ny = sup;
    if (pl.vel.y < 0) pl.vel.y = 0;
    pl.onGround = true;
  } else if (wasGround && pl.vel.y <= 0 && ny - sup < 0.45) {
    ny = sup;
    pl.vel.y = 0;
    pl.onGround = true;
  } else pl.onGround = false;
  pl.pos.y = ny;
  if (pl.onGround) { pl.sinceGround = 0; pl.jumps = 0; } else pl.sinceGround += dt;

  // lava
  for (const p of LAVA) {
    const dx = pl.pos.x - p.x, dz = pl.pos.z - p.z;
    if (pl.pos.y < -0.5 && dx * dx + dz * dz < (p.r + 0.5) ** 2) {
      const d = Math.hypot(dx, dz) || 1;
      hurtPlayer(1, dx / d, dz / d, "lava");
      pl.vel.set((dx / d) * 8, 15, (dz / d) * 8);
      pl.onGround = false;
      pl.jumps = 1;
      burst(pl.pos.x, -1, pl.pos.z, 12, [0xff5a1a, 0xffb13b], 4, 6);
      if (player.dead <= 0) toast(STR.lava, 1.6);
    }
  }

  // sword: presses are buffered a moment, so mashing chains the combo
  pl.sinceAtk += dt;
  if (canAct && input.consume("attack")) pl.atkBuf = 0.3;
  else pl.atkBuf = Math.max(0, pl.atkBuf - dt);
  // F: the Fire Wave (before the Flame Heart it's just the sword, as it always was)
  pl.fireCd = Math.max(0, pl.fireCd - dt);
  if (canAct && input.consume("fire")) {
    if (!flameHeart) pl.atkBuf = 0.3;
    else if (pl.fireCd > 0) fireNope();
    else pl.fireBuf = 0.3;
  } else pl.fireBuf = Math.max(0, pl.fireBuf - dt);
  if (pl.onGround) pl.airSpun = false;
  const free = !pl.climbing && (pl.attackT < 0 || pl.attackT >= SWING[pl.atkKind].next);
  if (pl.fireBuf > 0 && free) startFire();
  else if (pl.atkBuf > 0 && free) {
    if (!pl.onGround && !pl.airSpun) { pl.airSpun = true; startSwing(3); }
    else startSwing(pl.atkKind < 2 && pl.sinceAtk < SWING[pl.atkKind].end + 0.3 ? pl.atkKind + 1 : 0);
  }
  if (pl.attackT >= 0) {
    const sw = blades()[pl.atkKind], was = pl.attackT;
    pl.attackT += dt;
    if (sw.lungeAt && was < sw.lungeAt && pl.attackT >= sw.lungeAt && pl.onGround) {
      pl.vel.x = Math.sin(pl.heading) * sw.lunge;
      pl.vel.z = Math.cos(pl.heading) * sw.lunge;
    }
    if (!pl.hitDone && pl.attackT >= sw.hit) { pl.hitDone = true; if (sw.fire) launchFire(); else swordHit(sw); }
    if (pl.attackT >= sw.end) pl.attackT = -1;
  }

  // hearts
  pl.invuln -= dt;
  pl.sinceHurt += dt;
  if (pl.hearts < T.heartsMax && pl.sinceHurt > T.regenDelay && !fighting()) {
    pl.regen += dt;
    if (pl.regen >= T.regenEvery) { pl.regen = 0; pl.hearts++; sfx("heal"); updateHearts(); }
  } else pl.regen = 0;
}

let combatHint = false;
function stepSlimes(dt) {
  const pl = player;
  let attackers = 0; // only a couple pounce at once: the rest circle around
  for (const e of slimes) if (!e.dead && (e.st === "windup" || e.st === "lunge")) attackers++;
  for (const e of slimes) {
    if (e.dead) {
      e.respawn -= dt;
      if (e.respawn <= 0 && Math.hypot(pl.pos.x - e.hx, pl.pos.z - e.hz) > 35) {
        e.dead = false;
        e.hp = T.slimeHp;
        e.x = e.px = e.hx; e.z = e.pz = e.hz; e.y = e.py = groundHeight(e.x, e.z);
        e.vx = e.vy = e.vz = 0;
        e.tumble = e.flash = e.atkCd = 0;
        setSlime(e, "idle");
      }
      continue;
    }
    const dxp = pl.pos.x - e.x, dzp = pl.pos.z - e.z, dp = Math.hypot(dxp, dzp);
    e.active = dp < 130;
    if (!e.active) continue;
    e.px = e.x; e.py = e.y; e.pz = e.z;
    e.hopCd -= dt;
    e.atkCd -= dt;
    e.flash -= dt;
    e.stT += dt;
    const homeD = Math.hypot(e.x - e.hx, e.z - e.hz);
    const sees = pl.dead <= 0 && !dialog.open && dp < T.slimeAggro &&
      Math.hypot(pl.pos.x - e.hx, pl.pos.z - e.hz) < T.slimeLeash && Math.abs(pl.pos.y - e.y) < 6;
    const toX = dxp / (dp || 1), toZ = dzp / (dp || 1);
    switch (e.st) {
      case "idle":
        if (!sees) break;
        setSlime(e, "alert");
        e.face = Math.atan2(toX, toZ);
        if (e.onGround) { e.vx = e.vz = 0; e.vy = 4.5; e.onGround = false; } // a startled little hop
        fx.alert(e.model, 2.1);
        sfx("alert");
        if (!combatHint) {
          combatHint = true;
          setTimeout(() => toast(input.touch ? STR.combatHintTouch : STR.combatHint, 5), 900);
        }
        break;
      case "alert":
        e.face = Math.atan2(toX, toZ);
        if (e.stT > 0.5 && e.onGround) setSlime(e, sees ? "chase" : "idle");
        break;
      case "chase":
        if (!sees) setSlime(e, "idle");
        else if (e.onGround && dp < T.slimePounce && e.atkCd <= 0 && attackers < T.slimeAttackers && Math.abs(pl.pos.y - e.y) < 2.5) {
          setSlime(e, "windup");
          attackers++;
          e.face = Math.atan2(toX, toZ);
          e.vx = e.vz = 0;
          sfx("charge");
        }
        break;
      case "windup":
        e.face = Math.atan2(toX, toZ);
        if (e.stT >= T.slimeWindup) {
          // pounce at where Finn is going to be
          const lx = pl.pos.x + pl.vel.x * 0.25 - e.x, lz = pl.pos.z + pl.vel.z * 0.25 - e.z;
          const ld = Math.hypot(lx, lz) || 1, flight = (2 * 8) / T.gravity, v = clamp(ld + 0.5, 1.5, 6.5) / flight;
          e.vx = (lx / ld) * v;
          e.vz = (lz / ld) * v;
          e.vy = 8;
          e.onGround = false;
          e.face = Math.atan2(lx, lz);
          setSlime(e, "lunge");
          sfx("lunge");
        }
        break;
      case "lunge":
        if (e.onGround && e.stT > 0.1) {
          setSlime(e, "recover");
          e.atkCd = 1.3 + e.r * 1.2;
        }
        break;
      case "recover":
        if (e.stT > T.slimeRecover) setSlime(e, sees ? "chase" : "idle");
        break;
      case "hurt":
        if (e.onGround && e.stT > e.stunFor) setSlime(e, sees ? "chase" : "idle");
        break;
      case "dying":
        if ((e.onGround && e.stT > 0.12) || e.stT > 0.8) { popSlime(e); continue; }
        break;
    }
    if (e.onGround) {
      const f = Math.max(0, 1 - 10 * dt);
      e.vx *= f;
      e.vz *= f;
      if (e.hopCd <= 0 && (e.st === "idle" || e.st === "chase")) {
        let tx, tz, sp;
        if (e.st === "chase") {
          tx = toX; tz = toZ; sp = T.slimeSpeed; e.hopCd = 0.5 + e.r * 0.4;
          // close by and waiting for its turn: hop sideways around Finn
          if (dp < 2.6) { const sd = e.r < 0.5 ? 1 : -1; tx = -toZ * sd - toX * 0.4; tz = toX * sd - toZ * 0.4; sp = 3.5; }
        } else if (homeD > 8) { tx = (e.hx - e.x) / homeD; tz = (e.hz - e.z) / homeD; sp = 3; e.hopCd = 1.2; }
        else { const a = e.rand() * Math.PI * 2; tx = Math.cos(a); tz = Math.sin(a); sp = 2; e.hopCd = 1.5 + e.rand() * 1.5; }
        const tl = Math.hypot(tx, tz) || 1;
        e.vx = (tx / tl) * sp;
        e.vz = (tz / tl) * sp;
        e.vy = e.st === "chase" ? T.slimeHop : 5;
        e.onGround = false;
        e.face = e.st === "chase" ? Math.atan2(toX, toZ) : Math.atan2(tx, tz);
      }
    }
    e.vy = Math.max(-T.fallMax, e.vy - T.gravity * dt);
    const feet0 = e.y;
    _tmp.set(e.x + e.vx * dt, 0, e.z + e.vz * dt);
    resolveXZ(_tmp, 0.7, e.y, e.y + 1.1, null);
    e.x = _tmp.x;
    e.z = _tmp.z;
    let ny = e.y + e.vy * dt;
    const sup = supportAt(e.x, e.z, 0.7, feet0 + STEP + 0.05);
    if (ny <= sup) {
      ny = sup;
      if (!e.onGround) e.landN++;
      e.vy = 0;
      e.onGround = true;
    } else e.onGround = false;
    e.y = ny;

    // stomp, pounce or a shove
    const dy = pl.pos.y - e.y, cx = pl.pos.x - e.x, cz = pl.pos.z - e.z, cd = Math.hypot(cx, cz) || 0.01;
    if (cd < 1.35 && pl.dead <= 0 && e.st !== "dying") {
      if (pl.vel.y < -2 && dy > 0.55) {
        fx.star(e.x, e.y + 1.1, e.z, 1.1);
        damageSlime(e, -cx / cd, -cz / cd, T.slimeHp, 4, 3); // a stomp always pops it
        freeze(0.06);
        pl.vel.y = 10;
        pl.jumps = 1;
        pl.ev.jump++;
        sfx("jump2");
      } else if (dy > -1.2 && dy < 1.1) {
        if (e.st === "lunge") {
          hurtPlayer(1, cx / cd, cz / cd, "slime");
          e.vx *= -0.3;
          e.vz *= -0.3;
        } else {
          // walking into a slime just pushes it aside
          e.x -= (cx / cd) * (1.35 - cd);
          e.z -= (cz / cd) * (1.35 - cd);
        }
      }
    }
  }
}

function stepPickups(dt) {
  for (const p of pickups) {
    if (!p.on) continue;
    p.t += dt;
    if (p.t > T.heartLife) { p.on = false; continue; }
    const dx = player.pos.x - p.x, dy = player.pos.y + 0.8 - p.y, dz = player.pos.z - p.z, d = Math.hypot(dx, dy, dz);
    const wants = player.dead <= 0 && player.hearts < T.heartsMax;
    // drawn to Finn when he needs it
    if (wants && d < 3.5 && p.t > 0.4) {
      const k = Math.min(1, (9 * dt) / (d || 1));
      p.x += dx * k; p.y += dy * k; p.z += dz * k;
      p.vy = 0;
    } else {
      const g = supportAt(p.x, p.z, 0.2, p.y + 0.3) + 0.55;
      p.vy -= T.gravity * dt;
      p.y += p.vy * dt;
      if (p.y < g) { p.y = g; p.vy = p.vy < -3 ? -p.vy * 0.35 : 0; }
    }
    if (wants && d < 1.3 && p.t > 0.4) {
      p.on = false;
      player.hearts++;
      updateHearts();
      sfx("heart");
      burst(p.x, p.y, p.z, 12, [0xff4d6d, 0xffffff, 0xffb3c1], 4, 4, 0.5, 0.6);
    }
  }
}

/** The slime Jake should go after: one that is fighting Finn, closest to him. */
function jakeFoe() {
  // in a boss fight: whatever of it is closest to Finn (the boss, or one of the Butler's imps)
  let bf = null, bfd = Infinity;
  for (const f of bossFoes()) {
    const d = Math.hypot(f.x - player.pos.x, f.z - player.pos.z);
    if (d < bfd) { bfd = d; bf = f; }
  }
  if (bf) return bf;
  let best = null, bd = 12;
  for (const e of slimes) {
    if (!alive(e) || e.st === "idle") continue;
    const d = Math.hypot(e.x - player.pos.x, e.z - player.pos.z);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
/** A slime in reach of Jake's stretchy arm, those pouncing on Finn first. */
function punchTarget() {
  let best = null, bs = Infinity;
  for (const e of slimes) {
    if (!alive(e) || Math.abs(e.y - jake.y) > 3) continue;
    const d = Math.hypot(e.x - jake.x, e.z - jake.z);
    if (d > T.jakeReach || Math.hypot(e.x - player.pos.x, e.z - player.pos.z) > 14) continue;
    const score = d - (e.st === "windup" || e.st === "lunge" ? 6 : 0) + (e.st === "idle" ? 4 : 0);
    if (score < bs) { bs = score; best = e; }
  }
  // a boss in reach beats a slime; an imp in reach beats the boss (it's coming for Finn)
  let bb = Infinity;
  for (const f of bossFoes()) {
    const d = Math.hypot(f.x - jake.x, f.z - jake.z);
    if (Math.abs(f.y - jake.y) > 3 || d > T.jakeReach) continue;
    if (d - (f.isBoss ? 0 : 8) < bb) { bb = d - (f.isBoss ? 0 : 8); best = f; }
  }
  return best;
}
function startPunch(e) {
  jake.arm ^= 1; // left, right, left...
  jake.act = { kind: "punch", t: 0, foe: e, arm: jake.arm, x: e.x, y: e.y, z: e.z, hit: false };
  sfx("stretch");
  if (Math.random() < 0.15) jakeSay(pick(STR.jake.punch));
}
/** Q / B / the Jake button: he grows giant and brings a huge fist down on the biggest bunch of slimes. */
function jakePower() {
  if (player.dead > 0 || (jake.act && jake.act.kind === "slam")) return;
  if (jake.powerCd > 0) return jakeSay(STR.jake.recharge);
  let best = null, bn = 0, bd = Infinity;
  for (const e of slimes) {
    if (!alive(e)) continue;
    const d = Math.hypot(e.x - player.pos.x, e.z - player.pos.z);
    if (Math.hypot(e.x - jake.x, e.z - jake.z) > T.jakeSlamReach || d > 18) continue;
    let n = 0;
    for (const o of slimes) if (alive(o) && Math.hypot(o.x - e.x, o.z - e.z) < T.jakeSlamR) n++;
    if (n > bn || (n === bn && d < bd)) { bn = n; bd = d; best = e; }
  }
  for (const f of bossFoes()) {
    if (Math.hypot(f.x - jake.x, f.z - jake.z) > T.jakeSlamReach || Math.hypot(f.x - player.pos.x, f.z - player.pos.z) > 18) continue;
    if (f.isBoss || !best || !best.floor) best = f; // the boss if he's there, else one of his imps
  }
  let x, y, z;
  if (best) { x = best.x; y = best.floor ?? best.y; z = best.z; } // the fist lands on the floor under a boss
  else {
    // nothing to hit: he shows off right in front of Finn (or of himself, if Finn is out of reach)
    const far = Math.hypot(player.pos.x - jake.x, player.pos.z - jake.z) > T.jakeSlamReach - 5 || jake.waiting;
    const ox = far ? jake.x : player.pos.x, oz = far ? jake.z : player.pos.z, h = far ? jake.face : player.heading;
    x = ox + Math.sin(h) * 4;
    z = oz + Math.cos(h) * 4;
    y = supportAt(x, z, 0.3, (far ? jake.y : player.pos.y) + 1.5);
  }
  jake.act = { kind: "slam", t: 0, foe: best, x, y, z, hit: false };
  jake.powerCd = T.jakePowerCd;
  sfx("grow");
  jakeSay(pick(STR.jake.slam), true);
}
function stepJakeAct(dt) {
  const A = jake.act, e = A.foe;
  A.t += dt;
  jake.v = 0;
  jake.speed = 0;
  if (A.kind === "punch") {
    // the fist chases its target until it lands
    if (!A.hit && e && alive(e)) { A.x = e.x; A.y = e.y; A.z = e.z; }
    jake.face = turnToward(jake.face, Math.atan2(A.x - jake.x, A.z - jake.z), 14 * dt);
    if (!A.hit && A.t >= 0.26) {
      A.hit = true;
      if (e && alive(e) && Math.hypot(e.x - jake.x, e.z - jake.z) < T.jakeReach + 1.5) {
        const dx = e.x - jake.x, dz = e.z - jake.z, d = Math.hypot(dx, dz) || 1;
        fx.star(e.x - (dx / d) * 0.6, e.y + (e.isBoss ? 1.3 : e.hurt ? 0 : 0.6), e.z - (dz / d) * 0.6, 1.1, 0xffb13b);
        const kill = e.hurt ? e.hurt(1, dx / d, dz / d) : damageSlime(e, dx / d, dz / d, 1, 10, 6);
        sfx("punch");
        freeze(kill ? 0.07 : 0.04);
        shake(0.1);
      }
    }
    if (A.t >= 0.5) { jake.act = null; jake.punchCd = T.jakePunchCd + Math.random() * 0.8; }
  } else {
    if (A.t < 0.6 && e && alive(e)) { A.x = e.x; A.y = e.floor ?? e.y; A.z = e.z; }
    jake.face = turnToward(jake.face, Math.atan2(A.x - jake.x, A.z - jake.z), 10 * dt);
    if (!A.hit && A.t >= 0.72) {
      A.hit = true;
      for (const o of slimes) {
        if (!alive(o)) continue;
        const dx = o.x - A.x, dz = o.z - A.z, d = Math.hypot(dx, dz);
        if (d < T.jakeSlamR && Math.abs(o.y - A.y) < 3) damageSlime(o, dx / (d || 1), dz / (d || 1), 3, 14 - d, 11);
      }
      for (const b of bossFoes()) {
        if (Math.hypot(b.x - A.x, b.z - A.z) >= T.jakeSlamR + 0.8 || b.y - A.y >= 3.5) continue;
        const dx = b.x - A.x, dz = b.z - A.z, d = Math.hypot(dx, dz) || 1;
        b.hurt(3, dx / d, dz / d);
      }
      fx.ring(A.x, A.y, A.z, T.jakeSlamR + 1.5, 0xffffff, 0.55);
      fx.ring(A.x, A.y, A.z, T.jakeSlamR * 0.7, 0xffe14d, 0.35);
      fx.star(A.x, A.y + 0.9, A.z, 2.4, 0xffb13b);
      burst(A.x, A.y + 0.2, A.z, 34, [0xd9c7a0, 0xffffff, 0xb59a72], 10, 6, 1, 0.9);
      sfx("boom");
      shake(0.65);
      freeze(0.12);
    }
    if (A.t >= 1.6) { jake.act = null; jake.punchCd = 0.8; }
  }
  jake.y = supportAt(jake.x, jake.z, 0.4, jake.y + 0.45);
}

/** Jake stretches up onto the Ice Crown (or turns up in the Dark Lair) next to Finn, and says so when the fight starts. */
function jakeJoin(talk) {
  const A = arenaAt(player.pos);
  if (A && arenaAt(jake) !== A) {
    const a = Math.atan2(player.pos.x - A.x, player.pos.z - A.z);
    jake.x = jake.px = player.pos.x - Math.sin(a) * 2.2;
    jake.z = jake.pz = player.pos.z - Math.cos(a) * 2.2;
    jake.y = jake.ry = A.y;
    jake.act = null;
    burst(jake.x, jake.y + 0.6, jake.z, 14, [0xf7ae1f, 0xffffff], 4, 4);
    sfx("stretch");
  }
  if (talk) jakeSay(A === LAIR_RING ? STR.jake.lair : A === COL_RING ? STR.jake.colosseum : A === LICH_RING ? STR.jake.lichCave : STR.jake.arena, true);
}
function stepJake(dt) {
  const pl = player;
  jake.px = jake.x;
  jake.pz = jake.z;
  jake.pface = jake.face;
  jake.punchCd -= dt;
  jake.powerCd = Math.max(0, jake.powerCd - dt);
  if (jake.act) return stepJakeAct(dt);
  const hs = Math.sin(pl.heading), hc = Math.cos(pl.heading);
  let tx = pl.pos.x - hs * 2.2 - hc * 1.6, tz = pl.pos.z - hc * 2.2 + hs * 1.6;
  // he waits below while Finn climbs, but stretches up onto the Ice Crown to be with him there
  const A = pl.dead <= 0 ? arenaAt(pl.pos) : null, arena = !!A;
  if (A && arenaAt(jake) !== A) jakeJoin(false);
  const elevated = !arena && pl.pos.y > groundHeight(pl.pos.x, pl.pos.z) + 2.5;
  if (elevated) {
    if (!jake.waitSaid && jake.y < CROWN.y - 1) { jake.waitSaid = true; jakeSay(STR.jake.wait); }
    tx = jake.x;
    tz = jake.z;
  } else {
    jake.waitSaid = false;
    // in a fight he steps up beside the slime closest to Finn
    const foe = pl.dead <= 0 ? jakeFoe() : null;
    if (foe) {
      const ox = jake.x - foe.x, oz = jake.z - foe.z, od = Math.hypot(ox, oz) || 1;
      tx = foe.x + (ox / od) * 3.5;
      tz = foe.z + (oz / od) * 3.5;
      // ...but not on top of Finn
      const fx_ = tx - pl.pos.x, fz = tz - pl.pos.z, fd = Math.hypot(fx_, fz);
      if (fd < 2.2) {
        const sx = fd > 0.1 ? fx_ / fd : -(foe.z - pl.pos.z) / (Math.hypot(foe.x - pl.pos.x, foe.z - pl.pos.z) || 1);
        const sz = fd > 0.1 ? fz / fd : (foe.x - pl.pos.x) / (Math.hypot(foe.x - pl.pos.x, foe.z - pl.pos.z) || 1);
        tx = pl.pos.x + sx * 2.2;
        tz = pl.pos.z + sz * 2.2;
      }
    }
  }
  jake.waiting = elevated;
  const dx = tx - jake.x, dz = tz - jake.z, d = Math.hypot(dx, dz);
  if (d > 45 && !elevated) {
    jake.x = tx;
    jake.z = tz;
    jake.y = groundHeight(tx, tz);
    jake.px = jake.x;
    jake.pz = jake.z;
    jake.v = 0;
    return;
  }
  const want = d > 6 ? 16 : d > 1.2 ? 9 : 0;
  jake.speed += (want - jake.speed) * Math.min(1, 6 * dt);
  if (d > 0.05 && jake.speed > 0.1) {
    const step = Math.min(d, jake.speed * dt);
    _tmp.set(jake.x + (dx / d) * step, 0, jake.z + (dz / d) * step);
    resolveXZ(_tmp, 0.4, jake.y, jake.y + 1, null);
    jake.x = _tmp.x;
    jake.z = _tmp.z;
    jake.face = turnToward(jake.face, Math.atan2(dx, dz), 10 * dt);
  } else jake.face = turnToward(jake.face, Math.atan2(pl.pos.x - jake.x, pl.pos.z - jake.z), 4 * dt);
  jake.y = supportAt(jake.x, jake.z, 0.4, jake.y + 0.45);
  jake.v = Math.hypot(jake.x - jake.px, jake.z - jake.pz) / dt;
  if (jake.punchCd <= 0 && pl.dead <= 0 && !dialog.open) {
    const e = punchTarget();
    if (e) startPunch(e);
  }
}

let areaCur = null, areaPend = null, areaCheck = 0;
function step(dt) {
  if (input.consume("pause")) return pause();
  if (dialog.open) {
    if (input.consume("talk") || input.consume("jump")) advanceDialog();
  } else if (warp.t < 0 && input.consume("talk")) {
    const n = nearestTalkable();
    if (n) openDialog(n);
  }
  if (input.consume("jake") && !dialog.open) jakePower();
  stepPlayer(dt);
  stepSlimes(dt);
  boss.step(dt);
  quest.step(dt);
  butler.step(dt);
  pepNpc.hidden = butler.B.st !== "off"; // he's up in his lair (off only once Finn has left it)
  spirits.step(dt);
  flameKing.step(dt);
  flameNpc.hidden = flameKing.B.st !== "off"; // she's watching from the royal box
  flamePath.step(dt);
  temple.step(dt);
  lich.step(dt);
  lichBoss.step(dt);
  fireWave.step(dt);
  if (warp.t >= 0) stepWarp(dt);
  stepJake(dt);
  stepPickups(dt);
  jakeCd -= dt;
  jake.talkT -= dt;
  for (const t of treasures) {
    if (t.found) continue;
    const dx = t.x - player.pos.x, dy = t.y - (player.pos.y + 0.9), dz = t.z - player.pos.z;
    if (dx * dx + dy * dy + dz * dz < 1.7 * 1.7) collect(t);
  }
  areaCheck -= dt;
  if (areaCheck <= 0) {
    areaCheck = 0.5;
    const a = areaAt(player.pos.x, player.pos.y, player.pos.z);
    if (a !== areaCur) {
      if (a === areaPend) { areaCur = a; showArea(a); }
      areaPend = a;
    } else areaPend = a;
  }
}

/** Jake's power for the animation, on the render clock, with the point his fist's centre goes to. */
const _act = { kind: "", t: 0, arm: 0, x: 0, y: 0, z: 0 };
function jakeAct(alpha) {
  const A = jake.act;
  if (!A) return null;
  _act.kind = A.kind;
  _act.arm = A.arm || 0;
  _act.t = Math.max(0, A.t - (1 - alpha) * DT);
  // (the giant fist comes down on the floor under the Ice King, not on him in the air)
  const e = A.foe, live = e && !e.dead && e.model.visible && !(e.isBoss && A.kind === "slam") && (A.kind === "punch" ? !A.hit : A.t < 0.6);
  const tx = live ? e.model.position.x : A.x, ty = live ? e.model.position.y : A.y, tz = live ? e.model.position.z : A.z;
  if (A.kind === "punch") {
    // stop at the slime's skin, on the side facing Jake
    const dx = tx - jakeModel.position.x, dz = tz - jakeModel.position.z, d = Math.hypot(dx, dz) || 1, r = 0.65 * (e ? e.model.scale.x : 1);
    _act.x = tx - (dx / d) * r; _act.y = ty + (e && e.isBoss ? 1.2 : e && e.hurt ? 0 : 0.55); _act.z = tz - (dz / d) * r;
  } else { _act.x = tx; _act.y = ty + 0.35; _act.z = tz; } // the giant fist rests on the ground
  return _act;
}

// ── visuals (every rendered frame) ──
const _v = new THREE.Vector3(), _t = new THREE.Vector3(), _fw = new THREE.Vector3();
let snapSeen = 0, snapT = 1;
function updateVisuals(dt, alpha, time) {
  const rdt = dt; // real frame time: effects and the camera keep going through a hit-stop
  if (hitStop > 0) dt *= 0.04; // ...while everyone freezes mid-blow
  // Finn
  _v.lerpVectors(player.prev, player.pos, alpha);
  // stepping off a ladder top teleports the physics body: rise first, then glide over onto the floor
  if (player.ev.snap !== snapSeen) { snapSeen = player.ev.snap; snapT = 0; }
  let mantle = 0;
  if (snapT < 1) {
    snapT = Math.min(1, snapT + dt / 0.3);
    const off = player.ev.snapOff, hor = 1 - smooth(0.15, 1, snapT);
    _v.x += off.x * hor;
    _v.z += off.z * hor;
    _v.y += off.y * (1 - smooth(0, 0.55, snapT)) + Math.sin(Math.PI * snapT) * 0.25;
    mantle = 1 - snapT;
  }
  finn.position.copy(_v);
  finn.rotation.y = player.prevHeading + wrapAngle(player.heading - player.prevHeading) * alpha;
  const hsp = Math.hypot(player.vel.x, player.vel.z);
  poseFinn(finn, {
    speed: hsp, vy: player.vel.y, ground: player.onGround, airT: player.sinceGround,
    climb: player.climbing, climbV: player.climbing ? player.vel.y : 0,
    heading: finn.rotation.y, time, mantle, ev: player.ev,
  }, dt);
  finn.visible = player.dead > 0 ? false : player.invuln > 0 ? Math.floor(time * 12) % 2 === 0 : true;
  const fs = supportAt(_v.x, _v.z, 0.2, _v.y + 0.1);
  finnShadow.position.set(_v.x, fs + 0.04, _v.z);
  finnShadow.scale.setScalar(0.55 * clamp(1 - (_v.y - fs) / 14, 0.35, 1));
  finnShadow.visible = player.dead <= 0;
  // the sword burns through the Fire Wave's cut, sparks flying off the blade
  const burning = player.attackT >= 0 && player.atkKind === 4;
  swordFire += ((burning ? 1 : 0) - swordFire) * (1 - Math.exp(-(burning ? 18 : 5) * rdt));
  fireWave.sword(swordFire);
  if (burning && finn.visible && Math.random() < rdt * 40) {
    finn.userData.sword.localToWorld(_fw.set(0, 0.15 + Math.random() * 0.5, 0));
    burst(_fw.x, _fw.y, _fw.z, 1, FIRE_FX, 1.2, 1.5, -0.4, 0.45);
  }
  fireWave.update(dt, alpha, time);

  // Jake
  const jx = jake.px + (jake.x - jake.px) * alpha, jz = jake.pz + (jake.z - jake.pz) * alpha;
  // steps and ledges: ease up/down instead of popping (a teleport snaps)
  jake.ry = Math.abs(jake.y - jake.ry) > 3 ? jake.y : jake.ry + (jake.y - jake.ry) * (1 - Math.exp(-16 * dt));
  jakeModel.position.set(jx, jake.ry, jz);
  jakeModel.rotation.y = jake.pface + wrapAngle(jake.face - jake.pface) * alpha;
  poseJake(jakeModel, {
    speed: jake.v, heading: jakeModel.rotation.y, time, wait: jake.waiting,
    look: wrapAngle(Math.atan2(player.pos.x - jx, player.pos.z - jz) - jakeModel.rotation.y),
    lookUp: clamp((player.pos.y - jake.y - 1) / 5, 0, 1),
    talk: jake.talkT > 0 || (dialog.open && dialog.npc === jakeTalk),
    act: jakeAct(alpha),
  }, dt);
  jakeShadow.position.set(jx, jake.ry + 0.04, jz);
  jakeShadow.scale.setScalar(0.5 * jakeModel.userData.giant);

  // Candy People
  crowd.update(dt, time, player.pos, camera.position, world.state.sealed);
  // the Ice King up on his crown, his penguins; the Peppermint Butler in his lair, his spirits
  boss.update(dt, alpha, time, camera);
  quest.update(dt, time, camera.position, world.state.sealed);
  butler.update(dt, alpha, time, camera);
  spirits.update(dt, time, camera.position, world.state.sealed);
  // the Flame King in his Colosseum of Flames, his daughter's Path of Flames
  flameKing.update(dt, alpha, time, camera);
  flamePath.update(dt, time, camera.position, world.state.sealed);
  temple.update(dt, time, camera.position);
  billy.update(dt);
  lich.update(dt, time, camera.position);
  lichBoss.update(dt, alpha, time, camera);

  // NPCs
  cullNpcs();
  for (const n of npcs) {
    if (!n.model.visible) continue;
    const d = Math.hypot(player.pos.x - n.x, player.pos.z - n.z);
    const target = d < 10 ? Math.atan2(player.pos.x - n.x, player.pos.z - n.z) : n.baseYaw;
    n.model.rotation.y = turnToward(n.model.rotation.y, target, 3 * dt);
    if (n.float) n.model.position.y = n.y + Math.sin(time * 1.6 + n.x) * 0.25;
    poseNpc(n.model, { time, near: d, talking: dialog.open && dialog.npc === n }, dt);
  }

  // slimes
  for (const e of slimes) {
    if (e.dead) continue;
    e.model.visible = e.shadow.visible = !!e.active && !world.state.sealed;
    if (!e.active) continue;
    const m = e.model;
    m.position.set(e.px + (e.x - e.px) * alpha, e.py + (e.y - e.py) * alpha, e.pz + (e.z - e.pz) * alpha);
    m.rotation.y = turnToward(m.rotation.y, e.face, (e.st === "windup" || e.st === "lunge" ? 16 : 8) * dt);
    poseSlime(m, e, dt, time);
    const sy = groundHeight(m.position.x, m.position.z);
    e.shadow.position.set(m.position.x, Math.max(sy, e.y - 20) + 0.04, m.position.z);
    e.shadow.scale.setScalar(0.75 * m.scale.x);
  }
  // hearts: bob and spin; blink before they vanish
  for (const p of pickups) {
    p.mesh.visible = p.shadow.visible = p.on && (p.t < T.heartLife - 3 || Math.floor(time * 8) % 2 === 0);
    if (!p.mesh.visible) continue;
    p.mesh.position.set(p.x, p.y + Math.sin(time * 3 + p.x) * 0.12, p.z);
    p.mesh.rotation.y = time * 2.5;
    p.shadow.position.set(p.x, supportAt(p.x, p.z, 0.2, p.y + 0.3) + 0.04, p.z);
  }

  if (winT > 0) {
    winT -= dt;
    if (Math.random() < dt * 12)
      burst(player.pos.x + (Math.random() - 0.5) * 6, player.pos.y + 4, player.pos.z + (Math.random() - 0.5) * 6, 8,
        [0xff4f9a, 0x5fd3ff, 0xffd84f, 0x9dff6b, 0xc27bff], 5, 4, 0.5, 1.4);
  }
  updateParticles(rdt);

  // camera (pulled in by walls, floors and ceilings so rooms stay readable)
  const sm = T.sensMouse * opts.sensMouse, sp = T.sensPad * opts.sensPad;
  cam.yaw -= input.look.x * sm + input.lookRate.x * sp * rdt;
  cam.pitch = clamp(cam.pitch + input.look.y * sm * 0.8 + input.lookRate.y * sp * 0.7 * rdt, -0.25, 1.2);
  cam.dist = clamp(cam.dist + input.zoom * 1.2, T.camMin, T.camMax);
  // (in a boss fight it aims higher, so the boss floating ahead stays in the picture)
  // (and for the Flame King, who's huge, higher and farther back)
  const giant = flameKing.fighting() || lichBoss.fighting();
  cam.ty += (_v.y + (giant ? 3.2 : fighting() ? 2.4 : 1.2) - cam.ty) * (1 - Math.exp(-10 * rdt));
  _t.set(_v.x, cam.ty, _v.z);
  // under a low ceiling, look more horizontally so the camera has room behind Finn
  const low = ceilingAt(_v.x, _v.z, 0.4, _v.y + 1.7, _v.y + 7) !== Infinity;
  cam.pitchEff += ((low ? Math.min(cam.pitch, 0.1) : cam.pitch) - cam.pitchEff) * (1 - Math.exp(-6 * rdt));
  const cp = Math.cos(cam.pitchEff);
  const cd = giant ? Math.max(cam.dist, 11) : cam.dist;
  const ox = Math.sin(cam.yaw) * cp * cd, oy = Math.sin(cam.pitchEff) * cd, oz = Math.cos(cam.yaw) * cp * cd;
  let allowed = 1;
  for (let i = 1; i <= 24; i++) {
    const f = i / 24;
    if (pointBlocked(_t.x + ox * f, _t.y + oy * f, _t.z + oz * f)) { allowed = Math.max(0.06, (i - 1.5) / 24); break; }
  }
  // on the Ice Crown the band is a wall for the camera too (its crystal points would hide the
  // fight), and so is the Dark Lair's rim; pressed against it, the camera keeps some height and
  // looks down on Finn instead
  const ring = arenaAt(player.pos);
  if (ring) {
    const px = _t.x - ring.x, pz = _t.z - ring.z, a = ox * ox + oz * oz, b = px * ox + pz * oz;
    const c = px * px + pz * pz - ring.r * ring.r, disc = b * b - a * c;
    if (a > 1e-6 && disc > 0) allowed = Math.min(allowed, Math.max(0.06, (-b + Math.sqrt(disc)) / a));
  }
  cam.clip = allowed < cam.clip ? allowed : cam.clip + (allowed - cam.clip) * (1 - Math.exp(-2.5 * rdt));
  let cx = _t.x + ox * cam.clip, cy = _t.y + oy * Math.max(cam.clip, ring ? Math.min(1, 4.5 / cd) : 0), cz = _t.z + oz * cam.clip;
  const gy = groundHeight(cx, cz) + 0.5;
  if (cy < gy) cy = gy;
  if (cam.shake > 0) {
    cam.shake = Math.max(0, cam.shake - rdt * 1.6);
    cx += (Math.random() - 0.5) * cam.shake;
    cy += (Math.random() - 0.5) * cam.shake;
  }
  camera.position.set(cx, cy, cz);
  camera.lookAt(_t);
  fx.update(rdt, camera);
  updatePowerHud();
  if (camera.position.distanceTo(_t) < 1.1) finn.visible = false; // camera inside Finn: hide him
  updateSky(camera.position);
  world.update(time, camera.position);
  mm.hidden = ring === LAIR_RING || ring === COL_RING || ring === LICH_RING; // the Dark Lair, the Colosseum of Flames and the Lich's cave are off the map

  // prompt / talk button
  const near = !dialog.open && player.dead <= 0 && warp.t < 0 ? nearestTalkable() : null;
  const pr = $("prompt");
  if (near) {
    pr.innerHTML = (input.touch ? "" : "<kbd>E</kbd>") + `${STR.talkTo} ${near.name}`;
    pr.style.display = "block";
  } else pr.style.display = "none";
  $("bTalk").style.display = near || dialog.open ? "block" : "none";
}

// ── menu / state ──
let state = "menu";
let started = false;
let lockHintShown = false;
function startGame() {
  unlockAudio();
  applyOpts();
  $("menu").hidden = true;
  $("hud").hidden = false;
  state = "play";
  lastT = performance.now();
  accum = 0;
  if (!started) {
    started = true;
    placeAtSpawn();
    updateHearts();
    updateGems();
    updateCrystals();
    // a save from before the Fire Wave: the Flame Heart already gives it, so say so once
    if (flameHeart && !save.fire.wave) {
      save.fire.wave = true;
      writeSave();
      setTimeout(() => toast(input.touch ? STR.fire.waveNewTouch : STR.fire.waveNew, 6), 1800);
    }
  }
  input.requestLock();
  if (!input.touch && !lockHintShown) {
    lockHintShown = true;
    setTimeout(() => { if (!input.locked && state === "play") toast(STR.lockHint, 3.5); }, 1500);
  }
}
function pause() {
  if (state !== "play") return;
  state = "paused";
  renderClues();
  const m = $("menu");
  m.hidden = false;
  m.classList.add("overlay");
  $("mSub").textContent = STR.paused;
  $("btnPlay").textContent = STR.resume;
  $("btnNew").hidden = false;
  newArmed = false;
  $("btnNew").textContent = STR.newGame;
  if (document.pointerLockElement) document.exitPointerLock();
}
input.onUnlock = () => pause();
$("bPause").addEventListener("click", () => pause());
$("btnPlay").addEventListener("click", startGame);
let newArmed = false;
$("btnNew").addEventListener("click", () => {
  if (!newArmed) {
    newArmed = true;
    $("btnNew").textContent = STR.confirmNew;
    return;
  }
  newArmed = false;
  save.found = [];
  save.won = false;
  save.clues = [];
  Object.assign(save.ice, iceSave());
  Object.assign(save.mint, mintSave());
  Object.assign(save.fire, fireSave());
  Object.assign(save.temple, templeSave());
  Object.assign(save.billy, billySave());
  Object.assign(save.lich, lichSave());
  temple.reset();
  lich.reset();
  billy.reset();
  iceHeart = flameHeart = false;
  setHeartsMax();
  fireWave.reset();
  player.fireCd = 0;
  showFirePower();
  boss.off();
  quest.reset();
  butler.off();
  spirits.reset();
  flameKing.off();
  flamePath.reset();
  lichBoss.off();
  hasNight = false;
  setFinnSword(finn, "gold");
  writeSave();
  for (const t of treasures) {
    t.found = false;
    t.mesh.visible = true;
  }
  started = false;
  renderClues();
  player.hearts = T.heartsMax;
  player.dead = 0;
  $("fade").classList.remove("on");
  $("btnNew").textContent = STR.newGame;
  startGame();
});
for (const [id, key] of [["optSound", "sound"], ["optShake", "shake"], ["optBig", "big"]]) {
  $(id).addEventListener("change", (e) => {
    opts[key] = e.target.checked;
    applyOpts();
    writeSave();
  });
}
for (const key of ["sensMouse", "sensPad"]) {
  const el = $("opt" + key[0].toUpperCase() + key.slice(1));
  el.addEventListener("input", () => {
    opts[key] = sensOpt(+el.value);
    showSens();
  });
  el.addEventListener("change", () => writeSave());
}
renderClues();
showFirePower();
$("loading").hidden = true;
$("btnPlay").disabled = false;
placeAtSpawn();

// debug: ?debug=1 shows an overlay; digits teleport to landmarks
const dbg = $("debug");
if (DEBUG) {
  dbg.hidden = false;
  const spots = [P.spawn, P.fort, P.candy, P.cupcake, P.ice, P.icePillars, P.fire, P.marcy, P.lumpy];
  addEventListener("keydown", (e) => {
    const k = Number(e.code.replace("Digit", ""));
    if (e.code.startsWith("Digit") && spots[k - 1]) {
      const s = spots[k - 1];
      player.pos.set(s.x, groundHeight(s.x, s.z) + 1, s.z + 14);
      player.prev.copy(player.pos);
      player.vel.set(0, 0, 0);
    }
  });
  window.__game = {
    player, cam, jake, jakeModel, slimes, pickups, treasures, npcs, input, dialog, scene, renderer, camera, finn, effect, world, fx, jakePower, boss, quest,
    butler, spirits, enterLair, warp, billy, lich, flameKing, flamePath, enterColosseum, fireWave, temple, save, lichBoss, startLichFight, placeInCave,
    courses: world.courses, saveKey: SAVE_KEY,
    // the Fire Wave without beating the Flame King (not saved: the Flame Heart's extra heart comes along until a reload)
    firePower(on = true) {
      flameHeart = on;
      setHeartsMax();
      player.hearts = Math.min(player.hearts, T.heartsMax);
      updateHearts();
      showFirePower();
    },
    // deterministic stepping for tests: n fixed steps, synchronously
    sim(n) {
      for (let i = 0; i < n; i++) {
        input.poll();
        step(DT);
      }
    },
    tp(x, z, y) {
      player.pos.set(x, y ?? groundHeight(x, z), z);
      player.prev.copy(player.pos);
      player.vel.set(0, 0, 0);
    },
  };
}

// ── main loop: fixed-step simulation, interpolated rendering ──
let lastT = performance.now(), accum = 0, time = 0, fps = 60, mmTick = 0;
renderer.setAnimationLoop((now) => {
  const frame = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  time += frame;
  input.poll();
  let steps = 0;
  if (state === "play") {
    if (hitStop > 0) {
      hitStop -= frame;
      accum = 0;
    } else accum += frame;
    while (accum >= DT && steps < 5 && state === "play" && hitStop <= 0) {
      step(DT);
      accum -= DT;
      steps++;
    }
    if (steps === 5) accum = 0;
    updateVisuals(frame, clamp(accum / DT, 0, 1), time);
    tuneResolution(frame);
    if (++mmTick % 3 === 0) drawMinimap();
  } else {
    // attract mode behind the menu
    const a = time * 0.08;
    const g = groundHeight(P.fort.x, P.fort.z);
    if (state === "menu") {
      camera.position.set(Math.sin(a) * 58, g + 26, Math.cos(a) * 58 + 12);
      camera.lookAt(0, g + 17, 0);
    }
    updateSky(camera.position);
    world.update(time, camera.position);
    cullNpcs();
    updateParticles(frame);
  }
  input.endFrame(state === "play" ? steps : 1);
  renderer.info.reset();
  effect.render(scene, camera);
  if (DEBUG) {
    fps += (1 / Math.max(frame, 1e-4) - fps) * 0.05;
    const i = renderer.info.render;
    dbg.textContent = `fps ${fps.toFixed(0)}  draws ${i.calls}  tris ${(i.triangles / 1000).toFixed(0)}k  res ${res.pr.toFixed(2)}\n` +
      `pos ${player.pos.x.toFixed(1)} ${player.pos.y.toFixed(1)} ${player.pos.z.toFixed(1)}  ${areaAt(player.pos.x, player.pos.y, player.pos.z)}`;
  }
});
