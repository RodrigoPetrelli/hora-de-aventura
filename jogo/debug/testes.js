// Reachability tests. With the game open at /?debug=1, in the page console (or via
// the browser tool's JavaScript):
//   const T = await import("/debug/testes.js"); T.testarTudo()
// Ladders come from physics.js; routes come from W.course(...) calls in the world
// builders, so editing a platform in fort.js / kingdoms.js updates the test too.
// Everything runs through __game.sim(n): deterministic, independent of the tab's frame rate.
// The tests collect treasures, so every exported test backs up the player's saved
// progress, restores it afterwards and reloads the page (pass { recarregar: false } to skip the reload).
import { ladders, supportAt } from "../physics.js";
import { groundHeight } from "../terrain.js";

function game() {
  const G = window.__game;
  if (!G) throw new Error("abra o jogo com ?debug=1");
  G.dialog.open = false;
  return G;
}

/** One jump toward `to` ({x, z, y}); double-jumps if falling short. */
function hop(G, to) {
  const I = G.input, p = G.player.pos;
  I.keys.add("Space");
  I.taps.add("jump");
  let duplo = false;
  for (let i = 0; i < 160; i++) {
    const hd = Math.hypot(to.x - p.x, to.z - p.z);
    G.cam.yaw = Math.atan2(-(to.x - p.x), -(to.z - p.z));
    if (hd < 0.35) I.keys.delete("KeyW");
    else I.keys.add("KeyW");
    if (!duplo && !G.player.onGround && G.player.vel.y < 0 && p.y < to.y + 0.4 && hd > 0.6) {
      I.taps.add("jump");
      duplo = true;
    }
    G.sim(1);
    if (i > 4 && G.player.onGround) break;
  }
  I.keys.delete("KeyW");
  I.keys.delete("Space");
  G.sim(2);
  const hd = Math.hypot(to.x - p.x, to.z - p.z);
  return { ok: Math.abs(p.y - to.y) < 0.25 && hd < 2.2, duplo, y: +p.y.toFixed(2), alvo: +to.y.toFixed(2) };
}

/** Walk (no jumping) toward `to`; used for routes registered with { walk: true }. */
function walkTo(G, to) {
  const I = G.input, p = G.player.pos;
  I.keys.add("KeyW");
  for (let i = 0; i < 400 && Math.hypot(to.x - p.x, to.z - p.z) > 0.6; i++) {
    G.cam.yaw = Math.atan2(-(to.x - p.x), -(to.z - p.z));
    G.sim(1);
  }
  I.keys.delete("KeyW");
  G.sim(10);
  // momentum carries the walker a plank or two past the waypoint on stairs, so allow ~1 unit
  return { ok: Math.abs(p.y - to.y) < 1.0 && Math.hypot(to.x - p.x, to.z - p.z) < 2.0, duplo: false, y: +p.y.toFixed(2), alvo: +to.y.toFixed(2) };
}

/** Runs fn with the player's save backed up and restored afterwards, then reloads. */
function protegido(fn, { recarregar = true } = {}) {
  const key = game().saveKey;
  let backup = null;
  try {
    backup = localStorage.getItem(key);
  } catch {
    /* storage blocked */
  }
  try {
    return fn();
  } finally {
    try {
      if (backup === null) localStorage.removeItem(key);
      else localStorage.setItem(key, backup);
    } catch {
      /* storage blocked */
    }
    if (recarregar) setTimeout(() => location.reload(), 600);
  }
}

/** Climb every ladder from its foot; ok = ends on the floor at its top. */
export const testarEscadas = (opts) => protegido(escadas, opts);
function escadas() {
  const G = game(), I = G.input, p = G.player.pos;
  G.player.invuln = 1e9;
  const out = ladders.map((l) => {
    const sx = l.x - l.fx, sz = l.z - l.fz;
    G.tp(sx, sz, supportAt(sx, sz, 0.42, l.y0 + 0.5));
    G.sim(5);
    G.cam.yaw = Math.atan2(-l.fx, -l.fz);
    I.keys.add("KeyW");
    let subiu = false;
    for (let i = 0; i < 500; i++) {
      G.sim(1);
      if (G.player.climbing) subiu = true;
      if (subiu && !G.player.climbing && p.y > l.y1 - 0.2) break;
    }
    I.keys.delete("KeyW");
    G.sim(20);
    return { escada: `${l.x.toFixed(1)},${l.z.toFixed(1)}`, de: +l.y0.toFixed(1), ate: +l.y1.toFixed(1), chegou: +p.y.toFixed(2), ok: subiu && Math.abs(p.y - l.y1) < 0.3 };
  });
  G.player.invuln = 0;
  return out;
}

/** Hop through every registered route (or just `nome`); ok = no missed jump and the treasure collected. */
export const testarPercursos = (nome, opts) => protegido(() => percursos(nome), opts);
function percursos(nome) {
  const G = game();
  const out = [];
  for (const c of G.courses) {
    if (nome && c.name !== nome) continue;
    G.player.invuln = 1e9;
    G.player.hearts = 5;
    G.tp(c.start.x, c.start.z, c.start.y ?? groundHeight(c.start.x, c.start.z));
    G.sim(3);
    const falhas = [];
    let pulosDuplos = 0;
    c.points.forEach((pt, k) => {
      const to = { x: pt.x, z: pt.z, y: pt.y ?? supportAt(pt.x, pt.z, 0.42, 999) };
      const r = c.walk ? walkTo(G, to) : hop(G, to);
      if (r.duplo) pulosDuplos++;
      if (!r.ok) {
        falhas.push(`ponto ${k}: chegou em y=${r.y}, alvo y=${r.alvo}`);
        G.tp(to.x, to.z, to.y);
        G.sim(2);
      }
    });
    const t = c.treasure && G.treasures.find((x) => x.id === c.treasure);
    if (t && !t.found) hop(G, { x: t.x, z: t.z, y: t.y - 1.1 });
    out.push({ percurso: c.name, ok: falhas.length === 0 && (!t || t.found), pontos: c.points.length, pulosDuplos, falhas, tesouro: t ? t.found : null });
  }
  G.player.invuln = 0;
  return out;
}

/** Run every ladder and route; returns a summary (all "n/n ok" and empty lists = pass). */
export const testarTudo = (opts) => protegido(() => {
  const e = escadas(), p = percursos();
  const G = game();
  return {
    escadas: `${e.filter((x) => x.ok).length}/${e.length} ok`,
    percursos: `${p.filter((x) => x.ok).length}/${p.length} ok`,
    tesourosSemPercurso: G.treasures.filter((t) => !G.courses.some((c) => c.treasure === t.id)).map((t) => t.id),
    tesourosNaoPegos: G.treasures.filter((t) => !t.found).map((t) => t.id),
    falhas: [...e.filter((x) => !x.ok), ...p.filter((x) => !x.ok)],
  };
}, opts);
