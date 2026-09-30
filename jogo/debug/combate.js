// Combat check. With the game open at /?debug=1 and a match running (click Jogar), in the
// page console:
//   const C = await import("/debug/combate.js");
//   C.guardar()                 keep a copy of the player's save (the fight is the real game)
//   C.arena()                   Finn a few steps from the nearest slime, Jake beside him, side camera
//   await C.filme(() => __game.jakePower(), { n: 12, every: 0.1 })
//                               runs the function, then grabs n live frames `every` s apart into
//                               a grid over the page (crop: fraction of the screen kept, centred)
//   C.limpar()                  removes the grid;  C.restaurar() puts the save back and reloads
//   await C.chefe({ only: "dive" })  the Ice King fight (boss.js): saving off, him waiting on the
//                               crown, Finn on the last ledge by the gate (walk in to start it);
//                               only repeats one attack (bolt | breath | blizzard | dive)
//   await C.mordomo({ only: "seal" })  the Peppermint Butler fight (butler.js): saving off, Finn and
//                               Jake warped into the Dark Lair; it starts on its own; only repeats one
//                               attack (stakes | hands | hiss | summon | shadow | seal | armor)
//   await C.rei({ only: "sun" })  the Flame King fight (flameking.js): saving off, Finn and Jake sent
//                               into the Colosseum of Flames; it starts on its own; only repeats one
//                               attack (fireball | meteor | pillars | stomp | slam | charge | leap | sun)
//   await C.lich({ only: "fall" })  the Lich fight (lichboss.js): saving off, Finn and Jake put in the
//                               Caverna dos Ossos and it starts; only repeats one attack (claw | kick | quake |
//                               spikes | bolt | inferno — his first body; orbs | breath | stop | raise |
//                               blackfire | comet | sweep | fall — his true form); forma: 1 starts in his true form
//   await C.golpe("fall", { forma: 1, fase: 2 })  a film (a grid of frames) of one of the Lich's attacks
//   C.fase(2)                   during the fight: his hp down to the start of phase 0 | 1 | 2
//                               (C.fase(2, "menta") for the Butler, C.fase(2, "fogo") for the Flame King,
//                               C.fase(2, "lich") for the Lich, in the body he's in)
// Attacks: __game.input.taps.add("attack") presses the sword for one step.
// The copy of the save lives in localStorage, so `node servidor.mjs --dev` reloading the page on
// every file saved doesn't lose it. A fight left running goes on without you (Jake can win it).
const G = () => {
  if (!window.__game) throw new Error("abra o jogo com ?debug=1");
  return window.__game;
};
const BAK = "ooo:debug:save";

export function guardar() {
  const s = localStorage[G().saveKey];
  if (localStorage[BAK] === undefined) localStorage[BAK] = s === undefined ? "" : s;
  return "save guardado";
}
export function restaurar() {
  const s = localStorage[BAK];
  if (s !== undefined) {
    if (s === "") localStorage.removeItem(G().saveKey);
    else localStorage[G().saveKey] = s;
    localStorage.removeItem(BAK);
  }
  location.reload();
}

/** The Ice King waiting on the Ice Crown, Finn on the last ledge facing the gate; nothing is saved. */
export async function chefe({ only = null } = {}) {
  const g = G();
  guardar();
  g.noSave = true;
  g.input.keys.clear();
  const { CROWN: C } = await import("../ice.js");
  if (g.boss.B.st !== "wait") g.boss.arm();
  g.boss.B.only = only;
  const L = C.landing;
  g.tp(L.x, L.z, L.y);
  g.player.heading = g.player.prevHeading = Math.atan2(C.x - L.x, C.z - L.z);
  g.cam.yaw = Math.atan2(L.x - C.x, L.z - C.z);
  g.cam.pitch = 0.45;
  return "entre pelo portão (W + pulo) para começar";
}
/** Finn and Jake warped into the Dark Lair, the Butler about to start; nothing is saved. */
export async function mordomo({ only = null } = {}) {
  const g = G();
  guardar();
  g.noSave = true;
  g.input.keys.clear();
  if (g.butler.B.st !== "off") g.butler.off();
  g.enterLair();
  g.sim(80); // through the teleport
  g.butler.B.only = only;
  return "no covil: a luta começa sozinha";
}
/** Finn and Jake sent into the Colosseum of Flames, the Flame King about to start; nothing is saved. */
export async function rei({ only = null } = {}) {
  const g = G();
  guardar();
  g.noSave = true;
  g.input.keys.clear();
  if (g.flameKing.B.st !== "off") g.flameKing.off();
  g.enterColosseum();
  g.sim(80); // through the teleport
  g.flameKing.B.only = only;
  return "no coliseu: a luta começa sozinha";
}
/** Finn and Jake in the Lich's cave, the fight started (forma 1: skip to his true form); nothing is saved. */
export async function lich({ only = null, forma = 0 } = {}) {
  const g = G();
  guardar();
  g.noSave = true;
  g.input.keys.clear();
  if (g.lichBoss.B.st !== "off") g.lichBoss.off();
  if (g.save.lich.q === "none" || g.save.lich.q === "portal") g.save.lich.q = "cave";
  g.placeInCave();
  g.sim(2);
  g.startLichFight();
  g.lichBoss.B.only = only;
  if (forma) {
    g.sim(60 * 4); // through his intro
    const B = g.lichBoss.B;
    B.hp = 1;
    B.hurt(5, 0, 1);
    g.sim(60 * 8); // through the tearing of the skin
  }
  return "na caverna: a luta começou";
}
/**
 * A film of one of the Lich's attacks: the fight started with only that attack (forma 1: in his true
 * form), Finn untouchable, and n frames `every` s apart from a free camera by him (vista: "lado" | "cima")
 * laid out in a grid once it starts. C.limpar() removes it.
 */
export async function golpe(only, { forma = 0, fase: f = 0, every = 0.3, n = 12, vista = "lado", perto = 17 } = {}) {
  const g = G(), { STR } = await import("../strings.js"), { CAVE } = await import("../lichcave.js"), M = await import("./medir.js");
  limpar();
  await lich({ only, forma });
  if (f) { const B = g.lichBoss.B; B.phase = B.nextPhase = f; B.hp = Math.ceil(g.lichBoss.K.hp[B.form] * [1, 0.6, 0.3][f]) - 1; } // (straight into that phase: no rage)
  g.jake.punchCd = 1e9;
  g.player.invuln = 1e9;
  const B = g.lichBoss.B, t0 = performance.now();
  while (!(B.cast && B.cast.name === STR.lich.cast[only]) && performance.now() - t0 < 15000) await new Promise((r) => setTimeout(r, 30));
  const p = g.player.pos, mx = (p.x + B.x) / 2, mz = (p.z + B.z) / 2, a = Math.atan2(mx - CAVE.x, mz - CAVE.z) + (vista === "cima" ? 0 : 1.2), d = vista === "cima" ? 4 : perto;
  M.foto(mx + Math.sin(a) * d, CAVE.y + (vista === "cima" ? 26 : 10), mz + Math.cos(a) * d, mx, CAVE.y + 1.5, mz, (n * every + 1) * 1000);
  return filme(null, { n, every, per: 4, crop: 0.9 });
}
/**
 * A bot plays the whole Ice King fight (quem: "menta" — the Peppermint Butler's, "fogo" — the Flame
 * King's) in __game.sim steps (seconds of game time, not real time): it
 * walks up to him and swings, and with `esquiva` steps out of every marked area (behind a column from
 * the Sun, over the walls of fire, out of the fire on the floor). Finn never faints
 * (his hearts are refilled), so it counts the blows he took instead. Nothing is saved; C.restaurar()
 * afterwards. Returns how long the fight took, the attacks he used, the phase changes, the blows.
 */
export async function robo({ segundos = 300, esquiva = true, quem = "gelo", forma = 0 } = {}) {
  const g = G(), menta = quem === "menta", fogo = quem === "fogo", lic = quem === "lich";
  if (menta) await mordomo();
  else if (fogo) await rei();
  else if (lic) await lich({ forma });
  else {
    await chefe();
    const { CROWN: C } = await import("../ice.js");
    g.tp(C.x + Math.sin(C.gate[0]) * 11, C.z + Math.cos(C.gate[0]) * 11, C.y);
  }
  await new Promise((r) => setTimeout(r, 400)); // a few real frames: models shown (Jake only punches what's drawn)
  const b = menta ? g.butler : fogo ? g.flameKing : lic ? g.lichBoss : g.boss, B = b.B, p = g.player.pos, I = g.input;
  const { CAVE } = lic ? await import("../lichcave.js") : {};
  const { heapTop } = lic ? await import("../lichboss.js") : {};
  g.player.invuln = 0;
  const out = { vitoria: false, tempo: 0, ataques: {}, fases: [], golpesSofridos: 0, golpesPorAtaque: {}, mortes: 0 };
  let form = B.form || 0;
  const hurt0 = g.player.ev.hurt;
  let cast = "", hurtSeen = hurt0, phase = 0;
  const go = (dx, dz, run) => {
    g.cam.yaw = Math.atan2(-dx, -dz);
    I.keys.add("KeyW");
    if (run) I.keys.add("ShiftLeft"); else I.keys.delete("ShiftLeft");
  };
  for (let i = 0; i < segundos * 60; i++) {
    g.player.hearts = 7;
    if (B.cast && B.cast.name !== cast) { cast = B.cast.name; out.ataques[cast] = (out.ataques[cast] || 0) + 1; }
    if (B.phase !== phase || (lic && B.form !== form)) { phase = B.phase; form = B.form; out.fases.push({ forma: lic ? form : undefined, fase: phase, s: +(i / 60).toFixed(1), hp: B.hp }); }
    // the nearest danger it is standing in
    let dodge = null, hide = null;
    if (esquiva) for (const h of b.hazards) {
      if (h.fired || h.t < h.delay) continue;
      const dx = p.x - h.x, dz = p.z - h.z, d = Math.hypot(dx, dz) || 1;
      if (h.occ) {
        // the Sun: the spot right behind the nearest column, seen from the blast
        let best = null, bd = Infinity;
        for (const c of h.occ) {
          const ox = c.x - h.x, oz = c.z - h.z, od = Math.hypot(ox, oz), sx = c.x + (ox / od) * (c.r + 1.4), sz = c.z + (oz / od) * (c.r + 1.4), sd = Math.hypot(sx - p.x, sz - p.z);
          if (sd < bd) { bd = sd; best = [sx, sz]; }
        }
        if (bd > 0.5) hide = best;
        else hide = [p.x, p.z];
      } else if (h.shape === 0 && d < h.r + 0.7 && !(fogo && h.warn - (h.t - h.delay) > 1.25)) dodge = [dx / d, dz / d]; // (a far-off one can wait)
      else if (h.shape === 1 && d > h.inner - 0.9) dodge = [-dx / d, -dz / d];
      else if (h.shape === 2 && d < h.r + 0.7 && Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - h.a), Math.cos(Math.atan2(dx, dz) - h.a))) < h.half + 0.3) {
        const s = Math.sign(Math.sin(Math.atan2(dx, dz) - h.a)) || 1;
        dodge = [Math.cos(h.a) * s, -Math.sin(h.a) * s];
      } else if (h.shape === 3) {
        const along = dx * Math.sin(h.a) + dz * Math.cos(h.a), across = dx * Math.cos(h.a) - dz * Math.sin(h.a);
        if (along > -0.8 && along < h.r + 0.5 && Math.abs(across) < h.w + 0.7) { const s = Math.sign(across) || 1; dodge = [Math.cos(h.a) * s, -Math.sin(h.a) * s]; }
      }
    }
    if (lic && esquiva) {
      // the green fire on the floor (and the ring of fire): up the nearest mountain of skulls; "Fall": into the book's light
      const inferno = b.hazards.some((h) => h.harmless && h.shape === 0 && h.r > 20) || (B.pose === "infernoGo");
      const fall = b.hazards.some((h) => h.harmless && h.shape === 1);
      if (fall) {
        const dx = CAVE.x - p.x, dz = CAVE.z - p.z;
        hide = Math.hypot(dx, dz) > 1.2 ? [CAVE.x, CAVE.z] : [p.x, p.z];
        dodge = null;
      } else if (inferno || (g.player.pos.y > CAVE.y + 1 && heapTop(p.x, p.z) > 1.2 && b.burns && false)) {
        let best = null, bd = Infinity;
        for (const h of CAVE.heaps) {
          if (h.mid || Math.hypot(h.x - CAVE.x, h.z - CAVE.z) > 20) continue;
          const d = Math.hypot(h.x - p.x, h.z - p.z);
          if (d < bd) { bd = d; best = h; }
        }
        if (best) { hide = heapTop(p.x, p.z) > 1.3 ? [p.x, p.z] : [best.x, best.z]; dodge = null; if (heapTop(p.x, p.z) < 1.3 && bd < best.R + 1.5 && g.player.onGround) I.taps.add("jump"); }
      }
      for (const w of b.waves) {
        const wd = Math.hypot(p.x - w.x, p.z - w.z);
        if (w.on && w.t >= 0 && wd > w.r && wd - w.r < w.speed * 0.22 && g.player.onGround) I.taps.add("jump");
      }
      if (!hide) for (const z of b.burns) {
        const dx = p.x - z.x, dz = p.z - z.z, d = Math.hypot(dx, dz) || 1;
        if (z.t > -0.3 && d < z.r + 1) dodge = [dx / d, dz / d];
      }
    }
    if (fogo && esquiva) {
      for (const z of b.burns) {
        const dx = p.x - z.x, dz = p.z - z.z, d = Math.hypot(dx, dz) || 1;
        if (z.t > -0.3 && d < z.r + 1) dodge = [dx / d, dz / d];
      }
      // a wall of fire coming: jump when it's about to pass
      for (const w of b.waves) {
        const wd = Math.hypot(p.x - w.x, p.z - w.z);
        if (w.on && w.t >= 0 && wd > w.r && wd - w.r < w.speed * 0.22 && g.player.onGround) I.taps.add("jump");
      }
    }
    // the Butler's imps first, when one is close
    let tgt = B;
    if (menta) for (const e of b.imps) if (e.on && Math.hypot(e.x - p.x, e.z - p.z) < 5) tgt = e;
    if (lic) for (const e of b.skels) if (e.on && e.st !== "rise" && Math.hypot(e.x - p.x, e.z - p.z) < 5) tgt = e;
    const bx = tgt.x - p.x, bz = tgt.z - p.z, bd = Math.hypot(bx, bz);
    if (hide) { const hx = hide[0] - p.x, hz = hide[1] - p.z; if (Math.hypot(hx, hz) > 0.4) go(hx, hz, true); else I.keys.delete("KeyW"); }
    else if (dodge) go(dodge[0], dodge[1], true);
    else if (bd > 2.2) go(bx, bz, false);
    else { I.keys.delete("KeyW"); g.cam.yaw = Math.atan2(-bx, -bz); }
    if (!dodge && !hide && bd < (fogo ? 4.4 : 3.2) && i % 9 === 0) I.taps.add("attack");
    g.sim(1);
    if (lic && B.st === "gloat") { out.mortes++; out.morreuEm = cast; break; } // ("Fall" kills whatever the hearts)
    if (g.player.ev.hurt !== hurtSeen) { hurtSeen = g.player.ev.hurt; out.golpesPorAtaque[cast] = (out.golpesPorAtaque[cast] || 0) + 1; }
    if (B.st === "rest") { out.vitoria = true; out.tempo = +(i / 60).toFixed(1); break; }
  }
  I.keys.clear();
  out.golpesSofridos = g.player.ev.hurt - hurt0;
  if (!out.vitoria) out.tempo = segundos;
  out.hpFinal = B.hp;
  return out;
}
export function fase(n, quem = "gelo") {
  const b = quem === "menta" ? G().butler : quem === "fogo" ? G().flameKing : quem === "lich" ? G().lichBoss : G().boss, f = [1, b.K.phase2, b.K.phase3][n];
  b.B.hp = Math.ceil((quem === "lich" ? b.K.hp[b.B.form] : b.K.hp) * f) - 1;
  b.B.nextPhase = Math.max(b.B.phase, n);
  return `hp ${b.B.hp}`;
}

/** Finn `dist` south of the nearest living slime, facing it; Jake to his side; camera from `yaw`. */
export function arena(dist = 5, yaw = 0.9, camDist = 8) {
  const g = G(), p = g.player.pos;
  g.input.keys.clear();
  let e = null, bd = Infinity;
  for (const s of g.slimes) {
    const d = Math.hypot(s.x - p.x, s.z - p.z);
    if (!s.dead && d < bd) { bd = d; e = s; }
  }
  g.tp(e.x, e.z + dist);
  g.player.heading = g.player.prevHeading = Math.PI;
  const j = g.jake;
  j.x = j.px = e.x + 2.5;
  j.z = j.pz = e.z + dist + 1;
  j.act = null;
  g.cam.yaw = yaw;
  g.cam.pitch = 0.28;
  g.cam.dist = camDist;
  return e;
}

/** Runs fn, then captures n frames of the running game into a grid. */
export function filme(fn, { n = 12, every = 0.08, per = 4, crop = 0.62 } = {}) {
  const cv = G().renderer.domElement, imgs = [];
  return new Promise((done) => {
    let next = performance.now();
    if (fn) fn();
    // runs right after the game's own frame (registered later), while the canvas still holds it
    const tick = (now) => {
      if (now >= next) {
        const w = Math.round(cv.width * crop), h = Math.round(cv.height * crop);
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        c.getContext("2d").drawImage(cv, (cv.width - w) / 2, (cv.height - h) / 2, w, h, 0, 0, w, h);
        imgs.push(c.toDataURL("image/jpeg", 0.85));
        next += every * 1000;
      }
      if (imgs.length < n) requestAnimationFrame(tick);
      else done(grid(imgs, per));
    };
    requestAnimationFrame(tick);
  });
}
function grid(imgs, per) {
  let g = document.getElementById("combate");
  if (!g) {
    g = document.createElement("div");
    g.id = "combate";
    g.style.cssText = "position:fixed;inset:0;z-index:9999;background:#222;display:flex;flex-wrap:wrap;align-content:flex-start;pointer-events:none";
    document.body.appendChild(g);
  }
  const rows = Math.ceil(imgs.length / per);
  g.innerHTML = imgs.map((s, i) => `<div style="position:relative;width:${100 / per}vw;height:${100 / rows}vh">` +
    `<img src="${s}" style="width:100%;height:100%;object-fit:cover"><b style="position:absolute;left:4px;top:2px;color:#fff;font:bold 13px sans-serif;text-shadow:0 1px 2px #000">${i + 1}</b></div>`).join("");
  return `${imgs.length} quadros`;
}
export function limpar() {
  document.getElementById("combate")?.remove();
  return "ok";
}
