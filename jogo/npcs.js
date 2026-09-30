// The people of Ooo: models (built with shapes.js) and their idle life. Every
// model faces +z. userData: body and head (groups that breathe / tilt), arms
// [{ sh, el }] with a rest pose, eyes (a mesh or group that blinks), wave (the
// arm that greets), flames (flicker) and an optional per-model tick().
import * as THREE from "three";
import { G, BLACK, WHITE, GOLD, rbox, add, cap, lathe, blob, tube, group, bake, decal, ellipse, arc, ring, poly, roundRect } from "./shapes.js";
import { toon, noOutline } from "./toon.js";

const PI = Math.PI;
const toonHole = (c) => toon(c, { outline: false, flat: true });
/** Two-segment arm hanging from a shoulder at (x, y, z); returns { sh, el, hand }. */
function arm(parent, x, y, z, upper, lower, r, color, handColor = color, hand = 0.03) {
  const sh = group(parent, x, y, z);
  sh.rotation.order = "YXZ";
  cap(sh, [0, 0, 0], [0, -upper, 0], r, color);
  const el = group(sh, 0, -upper, 0);
  cap(el, [0, 0, 0], [0, -lower, 0], r * 0.92, color);
  const h = add(el, G.sph, handColor, 0, -lower - hand * 0.6, 0.003, hand, hand * 1.1, hand * 0.9);
  return { sh, el, hand: h };
}
const dots = (target, dx, y, rx, ry, cx = 0) =>
  decal(target, [ellipse(rx, ry, cx - dx, y), ellipse(rx, ry, cx + dx, y)], BLACK, { lift: 0.004, pivot: [cx, y], keep: true });
const smileOn = (target, y, r, t = 0.007, open = 0.6) => decal(target, arc(0, y + r, r, t, PI + open, 2 * PI - open), BLACK, { lift: 0.004 });

const BUILDERS = {
  pb() {
    const root = new THREE.Group(), b = group(root, 0, 0, 0);
    const SK = 0xffcbe6, HAIR = 0xff66c4, DR = 0xf21d9c, DR2 = 0xff5cb8, BELT = 0xa0106a;
    lathe(b, [[0.001, 0], [0.235, 0], [0.245, 0.03], [0.232, 0.25], [0.205, 0.55], [0.17, 0.8], [0.146, 0.95], [0.14, 1.05],
      [0.125, 1.12], [0.08, 1.16], [0.001, 1.17]], DR, 0, 0, 0, { smooth: 40, sz: 0.85 });
    add(b, new THREE.TorusGeometry(0.15, 0.018, 8, 32), BELT, 0, 0.9, 0, 1, 0.85, 1, { rx: PI / 2 });
    for (const s of [-1, 1]) blob(b, [0.078, 0.072, 0.072], 2, DR2, s * 0.13, 1.1, 0); // puffed sleeves
    const arms = [-1, 1].map((s) => arm(b, s * 0.14, 1.08, 0, 0.2, 0.17, 0.021, SK));
    add(b, G.cyl, SK, 0, 1.21, 0, 0.034, 0.1, 0.034);
    const h = group(b, 0, 1.36, 0.01);
    const face = add(h, G.sph, SK, 0, 0, 0, 0.155, 0.16, 0.15);
    blob(h, [0.172, 0.17, 0.168], 2.2, HAIR, 0, 0.03, -0.03);
    for (const s of [-1, 1]) blob(h, [0.07, 0.3, 0.075], 2.2, HAIR, s * 0.145, -0.2, -0.02); // locks by the face
    // a long curtain of bubblegum down the back, scalloped at the bottom
    blob(h, [0.25, 0.62, 0.11], 2.3, HAIR, 0, -0.62, -0.17);
    for (let i = -2; i <= 2; i++) add(h, G.sph, HAIR, i * 0.095, -1.19, -0.17, 0.062, 0.05, 0.085);
    // tiara with a tall stem and a blue gem
    blob(h, [0.08, 0.02, 0.05], 2, GOLD, 0, 0.165, 0.095, { rx: -0.55 });
    cap(h, [0, 0.17, 0.1], [0, 0.34, 0.085], 0.008, GOLD);
    add(h, G.sph, 0x4fc3f7, 0, 0.35, 0.085, 0.025);
    const eyes = dots(face, 0.052, 0.008, 0.011, 0.016);
    smileOn(face, -0.07, 0.03);
    decal(face, [ellipse(0.024, 0.012, -0.088, -0.035), ellipse(0.024, 0.012, 0.088, -0.035)], 0xff9fd0, { lift: 0.002 });
    root.userData = { body: b, head: h, arms, eyes, rest: [[-0.4, 0.4, -0.1, -1.3], [-0.4, -0.4, 0.1, -1.3]], wave: 1, headAmp: 0.4 };
    return root;
  },
  iceking() {
    const root = new THREE.Group(), b = group(root, 0, 0, 0);
    const SK = 0x9ccbf0, ROBE = 0x1d3fd8, ROBE_D = 0x152e9e, RED = 0xd81f2a;
    lathe(b, [[0.001, 0], [0.43, 0], [0.445, 0.035], [0.42, 0.3], [0.37, 0.65], [0.31, 0.95], [0.25, 1.15], [0.18, 1.27],
      [0.08, 1.32], [0.001, 1.33]], ROBE, 0, 0, 0, { smooth: 40, sz: 0.9 });
    add(b, new THREE.TorusGeometry(0.43, 0.022, 8, 40), ROBE_D, 0, 0.03, 0, 1, 0.9, 1, { rx: PI / 2 });
    // the beard: a white teardrop from the chin to the floor, fluffy along the bottom, hinged at the
    // chin (it flaps like wings when he flies: boss.js)
    const bg = group(b, 0, 1.44, 0.13);
    const beard = lathe(bg, [[0.001, 0], [0.22, 0.02], [0.31, 0.15], [0.33, 0.4], [0.28, 0.75], [0.2, 1.05], [0.12, 1.25], [0.001, 1.36]], WHITE, 0, -1.36, 0, { smooth: 36, sz: 0.5 });
    const BP = beard.geometry.attributes.position; // lean it forward at the bottom, over the robe
    for (let i = 0; i < BP.count; i++) BP.setZ(i, BP.getZ(i) + 0.3 * Math.max(0, 1 - BP.getY(i) / 1.36) ** 1.5);
    beard.geometry.computeVertexNormals();
    for (let i = -3; i <= 3; i++) add(bg, G.sph, WHITE, i * 0.085, 0.11 + Math.abs(i) * 0.025 - 1.44, 0.27 + 0.12 * Math.cos(i * 0.5), 0.075, 0.07, 0.065);
    const arms = [-1, 1].map((s) => arm(b, s * 0.3, 1.2, 0, 0.3, 0.3, 0.07, ROBE, SK, 0.045));
    for (const A of arms) for (const f of [-1, 0, 1]) cap(A.el, [f * 0.022, -0.34, 0.01], [f * 0.028, -0.4, 0.015], 0.011, SK); // fingers
    const h = group(b, 0, 1.5, 0.04);
    const face = add(h, G.sph, SK, 0, 0, 0, 0.165, 0.17, 0.155);
    add(h, G.sph, WHITE, 0, 0, -0.06, 0.18, 0.18, 0.16);
    blob(h, [0.2, 0.3, 0.1], 2.2, WHITE, 0, -0.25, -0.13);
    add(h, G.cone, SK, 0, -0.15, 0.2, 0.05, 0.36, 0.045, { rx: PI - 0.33 }); // the long droopy nose
    for (const s of [-1, 1]) blob(h, [0.055, 0.024, 0.035], 2, WHITE, s * 0.075, 0.085, 0.135, { rz: s * 0.3 }); // bushy brows
    const eyes = dots(face, 0.07, 0.02, 0.012, 0.015);
    for (const s of [-1, 1]) decal(face, arc(s * 0.07, 0.003, 0.02, 0.005, PI + 0.3, 2 * PI - 0.3), 0x5b7fa6, { lift: 0.003 }); // tired bags
    // grimace with teeth behind the nose, the beard starting just below it
    add(h, G.sph, 0x14263f, 0, -0.1, 0.12, 0.075, 0.032, 0.022, { outline: false });
    for (const [x, up] of [[-0.045, 1], [-0.015, 0], [0.015, 1], [0.045, 0]]) add(h, G.cone, WHITE, x, up ? -0.087 : -0.113, 0.138, 0.012, 0.028, 0.008, { rx: up ? PI : 0, outline: false });
    // crown: gold band, tall points, three red gems (its own group: it gets knocked off in boss.js)
    const crown = group(h, 0, 0.15, 0);
    lathe(crown, [[0.13, 0], [0.14, 0.01], [0.14, 0.08], [0.13, 0.09]], GOLD, 0, 0, 0, { seg: 24 });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * PI * 2, hh = i === 0 ? 0.26 : i === 1 || i === 6 ? 0.2 : 0.15;
      add(crown, G.cone, GOLD, Math.sin(a) * 0.125, 0.09 + hh / 2, Math.cos(a) * 0.125, 0.04, hh, 0.04);
    }
    for (const a of [-0.55, 0, 0.55]) add(crown, new THREE.OctahedronGeometry(1), RED, Math.sin(a) * 0.145, 0.045, Math.cos(a) * 0.145, a ? 0.03 : 0.04, a ? 0.04 : 0.05, 0.022, { ry: a });
    root.userData = { body: b, head: h, arms, eyes, beard: bg, crown, rest: [[0.05, 0, -0.24, -0.15], [0.05, 0, 0.24, -0.15]], wave: 0, headAmp: 0.6 };
    return root;
  },
  flame() {
    const root = new THREE.Group(), b = group(root, 0, 0, 0);
    const SK = 0xffb338, DR = 0xff5a1e, DR_D = 0xc81e1e, HAIR = 0xff4418, HAIR2 = 0xffc23a, E = { emissive: 0x552200 };
    const dress = lathe(b, [[0.001, 0], [0.34, 0], [0.35, 0.035], [0.3, 0.2], [0.22, 0.45], [0.16, 0.7], [0.135, 0.85], [0.14, 0.97],
      [0.15, 1.06], [0.12, 1.13], [0.001, 1.15]], DR, 0, 0, 0, { smooth: 40, sz: 0.88, ...E });
    // V-neck bodice and the dark trim running down the skirt
    decal(dress, poly([[-0.12, 1.12], [-0.08, 1.12], [0, 0.98], [0.08, 1.12], [0.12, 1.12], [0, 0.93]]), DR_D, { lift: 0.003 });
    decal(dress, poly([[-0.07, 1.12], [0.07, 1.12], [0, 0.99]]), SK, { lift: 0.004, emissive: 0x442200 });
    for (const s of [-1, 1]) decal(dress, poly([[s * 0.01, 0.93], [s * 0.03, 0.92], [s * 0.2, 0.05], [s * 0.16, 0.05]]), DR_D, { lift: 0.003 });
    add(b, new THREE.OctahedronGeometry(1), 0xe8202a, 0, 0.94, 0.14, 0.03, 0.04, 0.015, { emissive: 0x550000 });
    const arms = [-1, 1].map((s) => arm(b, s * 0.14, 1.08, 0, 0.19, 0.16, 0.021, SK));
    add(b, G.cyl, SK, 0, 1.19, 0, 0.034, 0.1, 0.034, E);
    const h = group(b, 0, 1.33, 0.01);
    const face = add(h, G.sph, SK, 0, 0, 0, 0.15, 0.155, 0.145, E);
    // forehead gem: gold setting, red stone
    decal(face, poly([[0, 0.125], [0.026, 0.09], [0, 0.055], [-0.026, 0.09]]), GOLD, { lift: 0.003 });
    decal(face, poly([[0, 0.113], [0.016, 0.09], [0, 0.067], [-0.016, 0.09]]), 0xe8202a, { lift: 0.005, emissive: 0x440000 });
    const eyes = dots(face, 0.05, 0.005, 0.011, 0.016);
    smileOn(face, -0.065, 0.028);
    // hair of fire: a tall curling flame with a yellow core, two licks flipping out by the chin
    const flames = [];
    const flame = (pts, r0, color, core) => {
      const m = tube(h, pts, r0, 0.004, color, { r: (t) => r0 * Math.sin(Math.PI * (0.25 + 0.75 * t)) ** 0.8 * (1 - t) ** 0.35, segs: 16, radial: 10, keep: true, emissive: core ? 0xaa6600 : 0xaa2200, caps: false });
      m.userData.h0 = 1;
      flames.push(m);
    };
    flame([[0, 0.08, -0.07], [0, 0.28, -0.1], [0.04, 0.48, -0.07], [-0.03, 0.66, -0.03], [0.06, 0.82, 0]], 0.19, HAIR, false);
    flame([[0, 0.12, 0.0], [0, 0.27, -0.02], [0.03, 0.41, 0], [-0.01, 0.53, 0.02]], 0.1, HAIR2, true);
    for (const s of [-1, 1]) flame([[s * 0.11, 0.06, 0.02], [s * 0.16, -0.08, 0], [s * 0.19, -0.2, -0.02], [s * 0.29, -0.24, -0.02]], 0.07, HAIR, false);
    root.userData = { body: b, head: h, arms, eyes, flames, rest: [[0.15, 0, -0.35, -0.4], [0.15, 0, 0.35, -0.4]], wave: 1 };
    return root;
  },
  marceline() {
    const root = new THREE.Group(), b = group(root, 0, 0, 0);
    const SK = 0xa9bfc6, HAIR = 0x15151d, TOP = 0x5d6070, JEANS = 0x27397a, BOOT = 0x7e1a28;
    for (const s of [-1, 1]) {
      // dangling legs, one knee bent: jeans into knee-high boots with pointy toes
      const hip = group(b, s * 0.075, 0.82, 0);
      hip.rotation.x = s > 0 ? -0.35 : 0.05;
      cap(hip, [0, 0, 0], [0, -0.38, 0], 0.052, JEANS);
      const knee = group(hip, 0, -0.38, 0);
      knee.rotation.x = s > 0 ? 0.6 : 0.1;
      cap(knee, [0, 0, 0], [0, -0.34, 0], 0.052, BOOT);
      blob(knee, [0.05, 0.04, 0.1], 2.4, BOOT, 0, -0.39, 0.04, { rx: 0.35 });
    }
    blob(b, [0.13, 0.1, 0.09], 2.6, JEANS, 0, 0.84, 0);
    blob(b, [0.12, 0.19, 0.08], 2.8, TOP, 0, 1.03, 0);
    const arms = [-1, 1].map((s) => arm(b, s * 0.14, 1.18, 0, 0.21, 0.19, 0.022, SK));
    add(b, G.cyl, SK, 0, 1.24, 0, 0.032, 0.09, 0.032);
    const h = group(b, 0, 1.39, 0);
    const face = add(h, G.sph, SK, 0, 0, 0, 0.145, 0.15, 0.14);
    for (const s of [-1, 1]) add(h, G.cone, SK, s * 0.15, 0.0, -0.01, 0.025, 0.08, 0.018, { rz: -s * 1.35 }); // pointed ears
    blob(h, [0.16, 0.16, 0.155], 2.2, HAIR, 0, 0.03, -0.022);
    blob(h, [0.11, 0.05, 0.06], 2, HAIR, 0.05, 0.115, 0.1, { rz: -0.35 }); // side-swept bangs
    blob(h, [0.22, 0.75, 0.09], 2.3, HAIR, 0, -0.75, -0.14); // hair down to her ankles
    for (let i = -2; i <= 2; i++) tube(h, [[i * 0.08, -1.3, -0.14], [i * 0.085, -1.45, -0.14], [i * 0.1, -1.58, -0.13]], 0.05, 0.004, HAIR, { segs: 6, radial: 6, caps: false });
    const eyes = dots(face, 0.05, 0.005, 0.01, 0.014);
    smileOn(face, -0.065, 0.028);
    for (const s of [-1, 1]) decal(face, poly([[s * 0.012, -0.066], [s * 0.026, -0.066], [s * 0.019, -0.09]]), WHITE, { lift: 0.006 }); // fangs
    // the axe bass hangs from her right hand by the neck
    const bass = group(arms[0].el, 0, -0.76, 0.05);
    bass.rotation.set(0.1, 0, 0.12);
    const axe = new THREE.Shape();
    axe.moveTo(-0.16, -0.22);
    axe.lineTo(0.18, -0.12);
    axe.lineTo(0.12, 0.05);
    axe.lineTo(0.2, 0.2);
    axe.lineTo(-0.1, 0.14);
    axe.lineTo(-0.2, 0.0);
    axe.closePath();
    add(bass, new THREE.ExtrudeGeometry(axe, { depth: 0.05, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 1 }), 0xb3202a, 0, 0, -0.025);
    add(bass, rbox(0.05, 0.6, 0.035, 0.012), 0x5d3a1e, 0, 0.42, 0);
    add(bass, rbox(0.08, 0.1, 0.04, 0.015), 0x3a2414, 0, 0.75, 0);
    for (const y of [0.25, 0.45, 0.65]) add(bass, G.cyl, 0xd8d8d8, 0, y, 0.02, 0.004, 0.02, 0.004); // frets
    root.userData = { body: b, head: h, arms, eyes, rest: [[0.1, 0, -0.15, -0.3], [0.2, 0, 0.55, -1.5]], wave: 1 };
    return root;
  },
  lsp() {
    const root = new THREE.Group(), b = group(root, 0, 0, 0);
    const C = 0xb887ef, C_D = 0x5a3a7a;
    const core = blob(b, [0.5, 0.52, 0.45], 2, C, 0, 0.78, 0, { ws: 28, hs: 20 });
    for (const [x, y, z, r] of [[0, 1.3, 0, 0.26], [-0.27, 1.2, -0.02, 0.22], [0.27, 1.2, -0.02, 0.22], [-0.46, 0.96, 0, 0.23], [0.46, 0.96, 0, 0.23],
      [-0.48, 0.63, 0, 0.23], [0.48, 0.63, 0, 0.23], [-0.3, 0.32, 0.02, 0.24], [0, 0.27, 0.04, 0.26], [0.3, 0.32, 0.02, 0.24], [0, 0.8, -0.34, 0.32]]) add(b, G.sph, C, x, y, z, r);
    const star = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * PI * 2 - PI / 2, rr = i % 2 ? 0.045 : 0.1;
      if (i === 0) star.moveTo(Math.cos(a) * rr, -Math.sin(a) * rr);
      else star.lineTo(Math.cos(a) * rr, -Math.sin(a) * rr);
    }
    star.closePath();
    add(b, new THREE.ExtrudeGeometry(star, { depth: 0.02, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.01, bevelSegments: 2 }), 0xffd84f, 0, 1.13, 0.42, 1, 1, 1, { emissive: 0x665500, rx: -0.25 });
    // unimpressed eyes: half-lidded ovals
    const lid = (cx) => poly([...Array(9)].map((_, i) => { const a = PI + (i / 8) * PI; return [cx + Math.cos(a) * 0.028, 0.96 + Math.sin(a) * 0.022]; }));
    const eyes = decal(core, [lid(-0.13), lid(0.13)], BLACK, { lift: 0.004, pivot: [0, 0.96], keep: true });
    for (const s of [-1, 1]) decal(core, poly([[s * 0.09, 0.975], [s * 0.17, 0.99], [s * 0.17, 0.98], [s * 0.09, 0.965]]), BLACK, { lift: 0.004 });
    blob(b, [0.05, 0.032, 0.03], 2, C_D, 0, 0.9, 0.44);
    decal(core, arc(0.02, 0.86, 0.035, 0.008, PI + 0.5, 2 * PI - 0.9), BLACK, { lift: 0.004 });
    const arms = [-1, 1].map((s) => arm(b, s * 0.36, 0.74, 0.3, 0.16, 0.15, 0.03, C));
    root.userData = { body: b, head: b, arms, eyes, rest: [[-0.5, 0.5, -0.2, -1.4], [-0.3, -0.3, 0.2, -0.9]], wave: 1, headAmp: 0.5 };
    return root;
  },
  bmo() {
    const root = new THREE.Group(), b = group(root, 0, 0.18, 0);
    const TL = 0x62bfa6, TL_D = 0x2f6f63, LIMB = 0x4f9fa0, SCR = 0xc9f7df;
    const box = blob(b, [0.25, 0.31, 0.15], 5, TL, 0, 0.31, 0, { ws: 32, hs: 24 });
    // screen with its dark bezel, and the face on it
    decal(box, roundRect(0.37, 0.28, 0.035, 0, 0.42), TL_D, { lift: 0.002, edge: 0.12 });
    decal(box, roundRect(0.34, 0.25, 0.028, 0, 0.42), SCR, { lift: 0.003, emissive: 0x1a3a2a, edge: 0.12 });
    const eyes = dots(box, 0.07, 0.45, 0.013, 0.016);
    decal(box, arc(0, 0.405, 0.035, 0.008, PI + 0.5, 2 * PI - 0.5), BLACK, { lift: 0.006 });
    // controls
    decal(box, roundRect(0.17, 0.022, 0.01, -0.05, 0.245), TL_D, { lift: 0.003 });
    decal(box, ellipse(0.014, 0.012, 0.15, 0.25), 0x1f3f8f, { lift: 0.003 });
    add(b, rbox(0.1, 0.032, 0.03, 0.01), 0xffd84f, -0.12, 0.12, 0.15);
    add(b, rbox(0.032, 0.1, 0.03, 0.01), 0xffd84f, -0.12, 0.12, 0.15);
    add(b, new THREE.ExtrudeGeometry(poly([[-0.025, -0.02], [0.025, -0.02], [0, 0.025]]), { depth: 0.015, bevelEnabled: false }), 0x2e86c1, 0.06, 0.16, 0.145);
    add(b, G.cyl, 0x39c24a, 0.14, 0.165, 0.15, 0.018, 0.02, 0.018, { rx: PI / 2 });
    add(b, G.cyl, 0xe8202a, 0.12, 0.08, 0.15, 0.04, 0.025, 0.04, { rx: PI / 2 });
    for (const x of [-0.14, -0.07]) decal(box, roundRect(0.045, 0.015, 0.007, x, 0.035), 0x1f3f8f, { lift: 0.003 });
    // "BMO" on the right side, speaker holes on the left
    const bar = (x0, y0, x1, y1, t = 0.016) => { const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy), nx = (-dy / l) * t / 2, ny = (dx / l) * t / 2; return poly([[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]]); };
    const letters = [bar(-0.1, 0.37, -0.1, 0.47), arc(-0.1, 0.445, 0.025, 0.016, -PI / 2, PI / 2), arc(-0.1, 0.395, 0.025, 0.016, -PI / 2, PI / 2),
      bar(-0.035, 0.37, -0.035, 0.47), bar(-0.035, 0.47, 0, 0.41), bar(0, 0.41, 0.035, 0.47), bar(0.035, 0.47, 0.035, 0.37), ring(0.03, 0.05, 0.016, 0.095, 0.42)];
    decal(box, letters, TL_D, { lift: 0.003, side: "x" });
    decal(box, [[-0.04, 0.5], [0, 0.52], [0.04, 0.5], [-0.02, 0.46], [0.02, 0.46]].map(([x, y]) => ellipse(0.009, 0.009, x, y, 10)), TL_D, { lift: 0.003, side: "-x" });
    const arms = [-1, 1].map((s) => arm(b, s * 0.25, 0.28, 0, 0.1, 0.09, 0.02, LIMB, LIMB, 0.024));
    for (const s of [-1, 1]) {
      cap(root, [s * 0.1, 0.2, 0], [s * 0.1, 0.03, 0.01], 0.022, LIMB);
      blob(root, [0.035, 0.018, 0.045], 2, LIMB, s * 0.1, 0.012, 0.02);
    }
    root.userData = { body: b, head: b, arms, eyes, rest: [[0.1, 0, -0.35, -0.3], [0.1, 0, 0.35, -0.3]], wave: 1, headAmp: 0.6 };
    return root;
  },
  gunter() {
    const root = new THREE.Group(), b = group(root, 0, 0, 0);
    const NAVY = 0x1b2530, CREAM = 0xfff4d6, ORANGE = 0xffa51f;
    lathe(b, [[0.001, 0.02], [0.14, 0.03], [0.2, 0.1], [0.215, 0.22], [0.2, 0.36], [0.16, 0.46], [0.09, 0.52], [0.001, 0.54]], NAVY, 0, 0, 0, { smooth: 30, sz: 0.95 });
    blob(b, [0.17, 0.235, 0.14], 2, CREAM, 0, 0.28, 0.075);
    const eyes = group(b, 0, 0.405, 0.16);
    for (const s of [-1, 1]) {
      add(eyes, G.sph, BLACK, s * 0.06, 0, 0, 0.045, 0.05, 0.035);
      add(eyes, G.sph, WHITE, s * 0.06 - 0.012, 0.018, 0.03, 0.013, 0.013, 0.008, { outline: false });
    }
    add(b, G.cone, ORANGE, 0, 0.36, 0.24, 0.033, 0.13, 0.026, { rx: PI / 2 });
    const flippers = [-1, 1].map((s) => {
      const f = group(b, s * 0.19, 0.34, 0);
      blob(f, [0.035, 0.12, 0.06], 2, NAVY, s * 0.025, -0.09, 0, { rz: s * 0.25 });
      return f;
    });
    for (const s of [-1, 1]) blob(b, [0.055, 0.02, 0.07], 2, ORANGE, s * 0.065, 0.02, 0.08);
    root.userData = {
      body: b, head: b, eyes, headAmp: 0.8,
      tick(t, a) { flippers.forEach((f, i) => (f.rotation.z = (i ? 1 : -1) * (0.1 + 0.08 * Math.sin(t * 3) + (a.wave > 0 ? 0.6 * Math.abs(Math.sin(t * 14)) : 0)))); },
    };
    return root;
  },
  banana() {
    const root = new THREE.Group(), b = group(root, 0, 0, 0);
    const BY = 0xfbe33a, TIP = 0xe6d68e, BROWN = 0x8a5a2b, LEG = 0xa58258;
    // a seven-sided lathe, flat shaded, gives the ridges; bent a touch like a banana
    const peel = lathe(b, [[0.001, 0.33], [0.15, 0.335], [0.2, 0.4], [0.21, 0.7], [0.2, 1.2], [0.18, 1.55], [0.14, 1.78], [0.07, 1.9], [0.001, 1.93]], BY, 0, 0, 0, { smooth: 30, seg: 7, flat: true });
    const P = peel.geometry.attributes.position;
    for (let i = 0; i < P.count; i++) P.setZ(i, P.getZ(i) - 0.07 * ((P.getY(i) - 1.1) / 0.8) ** 2);
    peel.geometry.computeVertexNormals();
    blob(b, [0.15, 0.02, 0.13], 2, TIP, 0, 0.34, -0.03);
    blob(b, [0.125, 0.08, 0.115], 2.2, BROWN, 0, 1.88, -0.03);
    for (const [x, z] of [[-0.06, 0.05], [0.02, 0.08], [0.08, 0.02]]) add(b, G.sph, 0x7fc8ff, x, 1.93, z - 0.03, 0.022);
    for (const s of [-1, 1]) {
      cap(b, [s * 0.07, 0.36, -0.02], [s * 0.07, 0.03, 0], 0.022, LEG);
      blob(b, [0.04, 0.02, 0.07], 2, LEG, s * 0.07, 0.015, 0.03);
    }
    const eyes = dots(peel, 0.07, 1.55, 0.011, 0.014);
    decal(peel, poly([[-0.04, 1.49], [0.04, 1.49], [0.04, 1.48], [-0.04, 1.48]]), BLACK, { lift: 0.004 });
    const arms = [-1, 1].map((s) => arm(b, s * 0.2, 1.05, 0, 0.28, 0.24, 0.025, BY));
    // spear in the right hand: gold shaft, ice-blue tip, a loop at the butt
    const spear = group(arms[0].el, 0, -0.26, 0.02);
    spear.rotation.x = 1.55; // undo the bent arm so the spear stands upright
    cap(spear, [0, -0.95, 0], [0, 1.0, 0], 0.014, 0xd99a2b);
    add(spear, new THREE.OctahedronGeometry(1), 0x7fd4ff, 0, 1.12, 0, 0.05, 0.14, 0.05, { emissive: 0x114466 });
    add(spear, new THREE.TorusGeometry(0.04, 0.012, 6, 16), 0xd99a2b, 0, -0.99, 0, 1, 1, 1, { ry: PI / 2 });
    root.userData = { body: b, head: null, arms, eyes, rest: [[-0.25, 0, -0.1, -1.3], [0.05, 0, 0.12, -0.2]], wave: 1 };
    return root;
  },
  billy: () => billyish(false),
  lich: () => billyish(true),
  lichTrue: () => lichTrue(),
};
/** The Peppermint Butler; `boss` adds what the fight needs (butler.js): demon eyes, a jagged grin and the cape. */
function peppermint(boss) {
  const root = new THREE.Group(), b = group(root, 0, 0, 0);
  const SUIT = 0x1f1f2a, RED = 0xe8303a;
  for (const s of [-1, 1]) {
    cap(b, [s * 0.065, 0.3, 0], [s * 0.065, 0.06, 0], 0.036, SUIT);
    blob(b, [0.048, 0.032, 0.085], 2.2, BLACK, s * 0.065, 0.03, 0.03);
  }
  // the tailcoat: a short bell, tails hanging behind, white shirt front and a black bow tie
  const coat = lathe(b, [[0.001, 0.26], [0.16, 0.26], [0.175, 0.31], [0.16, 0.45], [0.13, 0.54], [0.06, 0.58], [0.001, 0.585]], SUIT, 0, 0, 0, { smooth: 24, sz: 0.85 });
  for (const s of [-1, 1]) blob(b, [0.05, 0.13, 0.025], 2.2, SUIT, s * 0.06, 0.2, -0.13, { rx: 0.25 });
  decal(coat, poly([[-0.06, 0.57], [0.06, 0.57], [0.015, 0.33], [-0.015, 0.33]]), WHITE, { lift: 0.003 });
  for (const s of [-1, 1]) decal(coat, poly([[0, 0.54], [s * 0.055, 0.575], [s * 0.055, 0.51]]), BLACK, { lift: 0.005 });
  for (const y of [0.46, 0.4]) decal(coat, ellipse(0.009, 0.009, 0, y, 10), BLACK, { lift: 0.005 });
  const arms = [-1, 1].map((s) => arm(b, s * 0.15, 0.52, 0, 0.14, 0.13, 0.03, SUIT, WHITE, 0.04));
  // the head is a peppermint: a white disc with a red swirl, face on the front
  const h = group(b, 0, 0.8, 0.01);
  const face = add(h, G.cyl, WHITE, 0, 0, 0, 0.23, 0.12, 0.23, { rx: PI / 2 });
  const swirl = [];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * PI * 2, pt = (rr, da) => [Math.cos(a + da) * rr, Math.sin(a + da) * rr];
    swirl.push(poly([pt(0.035, 0), pt(0.12, 0.25), pt(0.215, 0.55), pt(0.215, 0.85), pt(0.12, 0.62), pt(0.05, 0.38)]));
  }
  decal(face, swirl, RED, { lift: 0.003 });
  add(h, new THREE.TorusGeometry(0.23, 0.012, 6, 32), RED, 0, 0, 0.0, 1, 1, 1);
  const eyes = dots(face, 0.055, 0.03, 0.017, 0.024);
  const smile = decal(face, arc(0, -0.01, 0.035, 0.009, PI + 0.6, 2 * PI - 0.6), BLACK, { lift: 0.004, keep: boss });
  root.userData = { body: b, head: h, arms, eyes, rest: [[0.1, 0, -0.2, -0.9], [0.1, 0, 0.2, -0.9]], wave: 1, headAmp: 0.5 };
  if (!boss) return root;
  // the dark one's face ("The Suitor"): black spiky suns for eyes with a yellow glint, a jagged grin
  const sun = (cx, cy) => poly([...Array(18)].map((_, i) => { const a = (i / 18) * PI * 2, rr = i % 2 ? 0.024 : 0.046; return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]; }));
  const demon = [
    decal(face, [sun(-0.062, 0.035), sun(0.062, 0.035)], BLACK, { lift: 0.005, pivot: [0, 0.035], keep: true }),
    decal(face, [ellipse(0.012, 0.012, -0.062, 0.035, 12), ellipse(0.012, 0.012, 0.062, 0.035, 12)], 0xffe14d, { lift: 0.008, pivot: [0, 0.035], keep: true, emissive: 0x8a6a00 }),
  ];
  const lips = [[-0.075, -0.035], [-0.04, -0.055], [0, -0.06], [0.04, -0.055], [0.075, -0.035], [0.05, -0.1], [0, -0.115], [-0.05, -0.1]];
  const fangs = [];
  for (let i = 0; i < 5; i++) {
    const x0 = -0.06 + i * 0.03;
    fangs.push(poly([[x0 - 0.012, -0.05 - Math.abs(x0) * 0.2], [x0 + 0.012, -0.05 - Math.abs(x0) * 0.2], [x0, -0.075 - Math.abs(x0) * 0.1]]));
  }
  const grin = [
    decal(face, poly(lips), 0x4a0818, { lift: 0.005, keep: true }),
    decal(face, fangs, WHITE, { lift: 0.008, keep: true }),
  ];
  for (const m of [...demon, ...grin]) m.visible = false;
  // the cape ("Nemesis" model sheet): two red flaps down his back that open into bat wings
  const wingShape = (s) => {
    const w = new THREE.Shape(), P = (x, y) => [s * x, y];
    w.moveTo(...P(0, 0.05));
    w.quadraticCurveTo(...P(0.22, 0.22), ...P(0.5, 0.15));
    w.lineTo(...P(0.58, 0.0));
    w.quadraticCurveTo(...P(0.44, -0.01), ...P(0.43, -0.15));
    w.quadraticCurveTo(...P(0.31, -0.12), ...P(0.27, -0.27));
    w.quadraticCurveTo(...P(0.15, -0.2), ...P(0.07, -0.33));
    w.quadraticCurveTo(...P(0.02, -0.16), ...P(0, -0.1));
    w.closePath();
    return w;
  };
  const wings = [-1, 1].map((s) => {
    const w = group(b, s * 0.045, 0.555, -0.15);
    add(w, new THREE.ExtrudeGeometry(wingShape(s), { depth: 0.022, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 1, curveSegments: 6 }), 0xc0142c, 0, 0, -0.011, 1, 1, 1, { side: THREE.DoubleSide });
    return w;
  });
  Object.assign(root.userData, { smile, demon, grin, wings });
  return root;
}
BUILDERS.pepbut = () => peppermint(false);
BUILDERS.pepbutBoss = () => peppermint(true);

// the Flame King's fire (flameking.js tints it by phase): outer shell, head and hands, the bright core
export const FLAME_KING_FIRE = { red: 0xff5a1a, orange: 0xff9a26, yellow: 0xffd24a };
/**
 * The Flame King (his fight: flameking.js), from his model sheet: a giant fireball for a head (three
 * dark marks for a face, a small five-pointed crown with a red gem), a suit of faceted copper armour
 * with rhombus gems round the collar and a pentagon gem on the chest, stubby legs and long arms
 * banded copper and brown, hands of fire. The rig: legs [{ hip, knee }] off the root, the body leans
 * at the waist; face marks: eyes, frown (mouth shut), roar (mouth open, hidden).
 */
BUILDERS.flameKing = () => {
  const root = new THREE.Group();
  const CU = 0xd2703a, CU_L = 0xe8925a, BR = 0x8a3c1e, BR_D = 0x4e2010, GEM = 0xe0202a, CROWN = 0xe8a030, INK = 0x6a1a00;
  const { red: FL_R, orange: FL, yellow: FL_Y } = FLAME_KING_FIRE;
  const EG = { emissive: 0x5a0006, flat: true }, EF = { emissive: 0xc04400 }, EY = { emissive: 0xc08000 };
  const FACET = new THREE.IcosahedronGeometry(1, 1);
  // a banded limb: n barrels alternating copper and brown, from its joint (y 0) down to -len
  const limb = (g, len, r0, r1, n) => {
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n, ra = r0 + (r1 - r0) * t0, rb = r0 + (r1 - r0) * t1, h = len / n;
      lathe(g, [[rb * 0.84, 0], [rb, h * 0.22], [(ra + rb) * 0.53, h * 0.5], [ra, h * 0.78], [ra * 0.84, h]], i % 2 ? BR : CU, 0, -len * t1, 0, { seg: 12 });
    }
  };
  const legs = [-1, 1].map((s) => {
    const hip = group(root, s * 0.3, 0.86, 0);
    add(hip, G.sph, BR, 0, 0, 0, 0.2);
    limb(hip, 0.4, 0.2, 0.18, 3);
    const knee = group(hip, 0, -0.4, 0);
    add(knee, G.sph, BR, 0, 0, 0, 0.17);
    limb(knee, 0.34, 0.18, 0.16, 3);
    blob(knee, [0.17, 0.09, 0.22], 2.4, BR_D, 0, -0.4, 0.05);
    return { hip, knee };
  });
  // the body leans from the waist: pelvis plate, faceted chest, collar with gems, the pentagon gem
  const b = group(root, 0, 0.9, 0);
  add(b, FACET, BR, 0, 0.04, 0, 0.5, 0.26, 0.4, { flat: true });
  add(b, FACET, CU, 0, 0.55, 0, 0.74, 0.6, 0.6, { flat: true });
  add(b, new THREE.TorusGeometry(0.44, 0.1, 8, 22), CU_L, 0, 1.0, 0, 1, 0.85, 1, { rx: PI / 2 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * PI * 2;
    add(b, new THREE.OctahedronGeometry(1), GEM, Math.sin(a) * 0.52, 1.0, Math.cos(a) * 0.45, 0.07, 0.1, 0.035, { ry: a, ...EG });
  }
  add(b, new THREE.CylinderGeometry(1, 1, 1, 5), BR_D, 0, 0.6, 0.575, 0.25, 0.05, 0.25, { rx: PI / 2, flat: true });
  add(b, new THREE.CylinderGeometry(1, 1, 1, 5), GEM, 0, 0.6, 0.6, 0.2, 0.07, 0.2, { rx: PI / 2, ...EG });
  for (const s of [-1, 1]) add(b, FACET, CU, s * 0.72, 0.84, 0, 0.27, 0.25, 0.27, { flat: true });
  const hands = [];
  const arms = [-1, 1].map((s) => {
    const sh = group(b, s * 0.78, 0.8, 0);
    sh.rotation.order = "YXZ";
    add(sh, G.sph, BR, 0, 0, 0, 0.15);
    limb(sh, 0.5, 0.15, 0.14, 4);
    const el = group(sh, 0, -0.5, 0);
    add(el, G.sph, BR, 0, 0, 0, 0.13);
    limb(el, 0.46, 0.14, 0.12, 4);
    // a hand of fire: a glowing palm, four fingers of flame and a thumb
    const hand = group(el, 0, -0.5, 0);
    hand.scale.setScalar(1.35);
    add(hand, G.sph, FL, 0, -0.06, 0, 0.13, 0.12, 0.1, EF);
    for (let f = 0; f < 4; f++) {
      const x = (f - 1.5) * 0.055;
      add(hand, G.cone, FL, x, -0.22, 0.01, 0.045, 0.26, 0.045, { rx: PI, rz: -x * 2.2, ...EF });
      add(hand, G.cone, FL_Y, x, -0.19, 0.03, 0.02, 0.15, 0.02, { rx: PI, rz: -x * 2.2, outline: false, ...EY });
    }
    add(hand, G.cone, FL, s * -0.1, -0.1, 0.07, 0.04, 0.18, 0.04, { rx: PI - 0.6, rz: s * 0.6, ...EF });
    hands.push(hand);
    return { sh, el, hand };
  });
  // the head: a teardrop of fire (a red shell behind, the orange face in front), marks for a face
  const h = group(b, 0, 1.06, 0.02);
  const shell = lathe(h, [[0.001, -0.02], [0.44, 0.02], [0.56, 0.22], [0.54, 0.48], [0.42, 0.78], [0.24, 1.08], [0.08, 1.36], [0.001, 1.52]], FL_R, 0, 0, -0.06, { smooth: 30, seg: 20, keep: true, ...EF });
  const face = lathe(h, [[0.001, 0], [0.4, 0.03], [0.5, 0.22], [0.48, 0.46], [0.36, 0.74], [0.18, 1.02], [0.05, 1.26], [0.001, 1.38]], FL, 0, 0, 0.05, { smooth: 30, seg: 20, ...EF });
  decal(face, ellipse(0.3, 0.27, 0, 0.3), FL_Y, { lift: 0.003, ...EY });
  // eyes: arches slanting down toward the middle (a scowl), a frown under them
  const eyes = decal(face, [arc(-0.15, 0.33, 0.08, 0.032, 0.05, PI - 0.55), arc(0.15, 0.33, 0.08, 0.032, 0.55, PI - 0.05)], INK, { lift: 0.006, pivot: [0, 0.36], keep: true });
  const frown = decal(face, arc(0, 0.1, 0.085, 0.03, 0.3, PI - 0.3), INK, { lift: 0.006, keep: true });
  const roar = [
    decal(face, ellipse(0.12, 0.1, 0, 0.13), 0x5a1400, { lift: 0.006, keep: true }),
    decal(face, [poly([[-0.09, 0.2], [-0.05, 0.2], [-0.07, 0.16]]), poly([[0.09, 0.2], [0.05, 0.2], [0.07, 0.16]]), poly([[-0.08, 0.06], [-0.04, 0.06], [-0.06, 0.1]]), poly([[0.08, 0.06], [0.04, 0.06], [0.06, 0.1]])], FL_Y, { lift: 0.009, keep: true, ...EY }),
  ];
  for (const m of roar) m.visible = false;
  // licks of flame: the tip flicking up through the crown, one each side, one down the back
  const flames = [shell];
  const lick = (pts, r0, color, em) => {
    const m = tube(h, pts, r0, 0.004, color, { r: (t) => r0 * Math.sin(Math.PI * (0.25 + 0.75 * t)) ** 0.8 * (1 - t) ** 0.35, segs: 14, radial: 8, keep: true, emissive: em, caps: false });
    flames.push(m);
  };
  lick([[0, 1.08, 0.02], [0.03, 1.3, 0.03], [-0.05, 1.52, 0.02], [0.04, 1.76, 0]], 0.13, FL, 0xc04400);
  for (const s of [-1, 1]) lick([[s * 0.4, 0.62, -0.14], [s * 0.5, 0.78, -0.16], [s * 0.54, 0.92, -0.14], [s * 0.64, 0.98, -0.12]], 0.075, FL_R, 0xa02a00);
  lick([[0, 0.55, -0.42], [0, 0.82, -0.55], [0.05, 1.05, -0.52], [0, 1.22, -0.44]], 0.15, FL_R, 0xa02a00);
  for (const m of flames) m.userData.h0 = 1;
  // the crown: a band with five points and a red gem, round the flame near its top
  const crown = group(h, 0, 1.0, 0.03);
  lathe(crown, [[0.19, 0], [0.205, 0.01], [0.205, 0.08], [0.19, 0.09]], CROWN, 0, 0, 0, { seg: 20, emissive: 0x3a2000 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * PI * 2, hh = i ? 0.13 : 0.18;
    add(crown, G.cone, CROWN, Math.sin(a) * 0.195, 0.08 + hh / 2, Math.cos(a) * 0.195, 0.035, hh, 0.035, { emissive: 0x3a2000 });
  }
  add(crown, new THREE.OctahedronGeometry(1), GEM, 0, 0.045, 0.21, 0.03, 0.04, 0.02, EG);
  root.userData = { body: b, head: h, arms, legs, hands, eyes, frown, roar, flames, crown, rest: [[0.08, 0, -0.28, -0.35], [0.08, 0, 0.28, -0.35]], wave: 0, headAmp: 0.3 };
  return root;
};

/**
 * Billy, the greatest hero of Ooo, retired ("His Hero" model sheet): very tall, grey-teal skin, a white
 * beard down to his thighs and white hair down his back; still built like a warrior: broad shoulders,
 * a V-shaped bare chest with a stitched scar on the left shoulder, thick arms; brown trousers bound with
 * dark straps, bracelets, bare feet, huge hands.
 * lich: the same body worn by the Lich ("The Lich", season 4 finale): rotting grey-green skin, ribs and
 * bones showing through, half the face torn off down to the skull with a burning green eye in its
 * socket, the Lich's horns bursting out of the head (one curled like a ram's, one broken to a point),
 * the white hair gone wild, a skeletal forearm and claw, iron shackles, hunched over.
 */
function billyish(lich) {
  const root = new THREE.Group(), b = group(root, 0, 0, 0);
  const SK = lich ? 0x86a096 : 0x96b8b0, SK_D = lich ? 0x4d6660 : 0x5a7a73, PANTS = lich ? 0x5e3c20 : 0x8a5424, STRAP = lich ? 0x2c1a0e : 0x3e2412;
  const BAND = lich ? 0x3b4447 : 0x5d6b6a, EYE = 0xe8df6a, BONE = 0xe6ead8, HAIR = lich ? 0xe8eee8 : WHITE;
  const GREEN = 0x8dff5a, HORN = 0xc8b27a, HORN_D = 0x8a7a50;
  const RING = (r, t = 0.02) => new THREE.TorusGeometry(r, t, 6, 14);
  // each leg swings from its hip (legs[i].hip: the Lich walks and kicks in this body, lichboss.js)
  const HIP = 1.74;
  const legs = [-1, 1].map((s) => {
    const x = s * 0.162, hip = group(b, 0, HIP, 0);
    cap(hip, [s * 0.155, 0, 0], [x, 0.14 - HIP, 0], 0.094, PANTS);
    blob(hip, [0.118, 0.3, 0.118], 2.2, PANTS, s * 0.16, 1.42 - HIP, 0.01); // thighs
    for (const y of [0.3, 0.64, 0.98]) add(hip, RING(0.097), STRAP, x, y - HIP, 0, 1, 1, 1, { rx: PI / 2 });
    for (const d of [-1, 1]) cap(hip, [x - 0.06 * d, 0.34 - HIP, 0.095], [x + 0.06 * d, 0.6 - HIP, 0.095], 0.015, STRAP); // the strap crossing the shin
    if (lich && s > 0) {
      // a skeletal foot: long toe bones
      blob(hip, [0.07, 0.045, 0.08], 2.2, BONE, x, 0.05 - HIP, 0.0);
      for (const f of [-1.5, -0.5, 0.5, 1.5]) cap(hip, [x + f * 0.03, 0.04 - HIP, 0.05], [x + f * 0.04, 0.025 - HIP, 0.2], 0.014, BONE);
    } else blob(hip, [0.085, 0.055, 0.16], 2.2, SK, x, 0.05 - HIP, 0.05);
    return { hip };
  });
  blob(b, [0.29, 0.17, 0.19], 2.4, PANTS, 0, 1.76, 0);
  if (lich) for (let i = 0; i < 7; i++) add(b, G.cone, PANTS, -0.25 + i * 0.083, 1.56, 0.1 - Math.abs(i - 3) * 0.02, 0.05, 0.14 + (i % 3) * 0.05, 0.03, { rx: PI }); // torn hem
  // a V: narrow waist, broad chest and shoulders
  const torso = lathe(b, [[0.001, 1.8], [0.25, 1.8], [0.26, 1.95], [0.31, 2.2], [0.37, 2.46], [0.4, 2.62], [0.28, 2.76], [0.1, 2.82], [0.001, 2.83]], SK, 0, 0, 0, { smooth: 30, sz: 0.62 });
  add(b, RING(0.265), STRAP, 0, 1.87, 0, 1, 0.66, 1, { rx: PI / 2 });
  for (const s of [-1, 1]) {
    blob(b, [0.08, 0.24, 0.1], 2.2, SK, s * 0.3, 2.28, -0.02); // lats
  }
  blob(b, [0.3, 0.065, 0.14], 2.2, SK, 0, 2.74, -0.02); // trapezius, from the neck to the shoulders
  // the scar: a slash with stitches across it
  const bar = (x0, y0, x1, y1, t) => { const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy), nx = (-dy / l) * t / 2, ny = (dx / l) * t / 2; return poly([[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]]); };
  decal(torso, [bar(0.2, 2.7, 0.33, 2.5, 0.016), ...[0.25, 0.5, 0.75].map((k) => { const cx = 0.2 + 0.13 * k, cy = 2.7 - 0.2 * k; return bar(cx - 0.03, cy - 0.02, cx + 0.03, cy + 0.02, 0.01); })], SK_D, { lift: 0.004 });
  if (lich) {
    // rotten patches, and the ribs and breastbone showing through them
    decal(torso, [poly([[0.06, 2.42], [0.26, 2.48], [0.3, 2.1], [0.2, 1.98], [0.08, 2.08]]), poly([[-0.1, 2.3], [-0.28, 2.34], [-0.3, 2.06], [-0.14, 2.0]])], 0x2e3c3a, { lift: 0.004 });
    const ribs = [];
    for (let i = 0; i < 4; i++) {
      const y = 2.4 - i * 0.1;
      ribs.push(bar(0.1, y, 0.25, y - 0.05, 0.035));
      if (i) ribs.push(bar(-0.15, y - 0.04, -0.27, y - 0.08, 0.03));
    }
    ribs.push(bar(0.0, 2.52, 0.0, 2.16, 0.05));
    decal(torso, ribs, BONE, { lift: 0.007 });
    // the spine down his back
    for (let i = 0; i < 6; i++) add(b, G.sph, BONE, 0, 2.62 - i * 0.12, -0.235 + i * 0.004, 0.05, 0.04, 0.035);
  }
  cap(b, [0, 2.76, 0.02], [0, 2.92, 0.04], 0.1, SK);
  const arms = [-1, 1].map((s) => {
    add(b, G.sph, SK, s * 0.41, 2.62, 0, 0.13, 0.12, 0.12); // deltoids
    const bony = lich && s < 0;
    const A = arm(b, s * 0.44, 2.6, 0, 0.6, 0.54, 0.072, SK, bony ? BONE : SK, 0.11);
    blob(A.sh, [0.09, 0.17, 0.095], 2.2, SK, 0, -0.3, 0.02); // biceps
    add(A.sh, RING(0.08), BAND, 0, -0.5, 0, 1, 1, 1, { rx: PI / 2 });
    if (bony) {
      // the forearm rotted away: two bones and a claw of long finger bones
      A.el.remove(A.el.children[0]);
      for (const d of [-1, 1]) cap(A.el, [d * 0.03, 0, 0], [d * 0.025, -0.56, 0.01], 0.024, BONE);
      add(A.el, RING(0.085, 0.034), BAND, 0, -0.42, 0, 1, 1, 1, { rx: PI / 2 }); // an iron shackle
      for (const f of [-1.5, -0.5, 0.5, 1.5]) {
        cap(A.el, [f * 0.035, -0.62, 0.015], [f * 0.055, -0.78, 0.05], 0.016, BONE);
        cap(A.el, [f * 0.055, -0.78, 0.05], [f * 0.06, -0.9, 0.11], 0.013, BONE);
      }
      cap(A.el, [-s * 0.07, -0.58, 0.04], [-s * 0.12, -0.72, 0.1], 0.016, BONE);
    } else {
      blob(A.el, [0.083, 0.19, 0.083], 2.2, SK, 0, -0.18, 0.01); // forearm
      add(A.el, RING(0.074, lich ? 0.034 : 0.02), BAND, 0, -0.46, 0, 1, 1, 1, { rx: PI / 2 });
      for (const f of [-1.5, -0.5, 0.5, 1.5]) cap(A.el, [f * 0.042, -0.65, 0.015], [f * 0.05, -0.8, 0.025], 0.025, SK); // big fingers
      cap(A.el, [-s * 0.08, -0.59, 0.04], [-s * 0.11, -0.7, 0.07], 0.025, SK);
      if (lich) for (const f of [-1.5, -0.5, 0.5, 1.5]) add(A.el, G.cone, BONE, f * 0.05, -0.83, 0.03, 0.018, 0.06, 0.018, { rx: PI }); // claws
    }
    return A;
  });
  const h = group(b, 0, 3.02, 0.04);
  const face = add(h, G.sph, SK, 0, 0, 0, 0.2, 0.25, 0.2);
  for (const s of [-1, 1]) add(h, G.sph, SK, s * 0.2, 0.0, -0.02, 0.035, 0.06, 0.03);
  blob(h, [0.21, 0.24, 0.18], 2.2, HAIR, 0, 0.0, -0.09); // hair from the crown back (the top of the head is bare)
  blob(h, [0.27, 0.75, 0.1], 2.3, HAIR, 0, -0.7, -0.2);
  blob(h, [0.17, 0.035, 0.06], 2, SK, lich ? -0.06 : 0, 0.075, 0.15, { rz: lich ? -0.15 : 0 }); // heavy brow
  const eyeX = lich ? [-0.075] : [-0.075, 0.075];
  decal(face, eyeX.map((x) => ellipse(0.03, 0.022, x, 0.03)), EYE, { lift: 0.003 });
  const eyes = lich
    ? decal(face, ellipse(0.011, 0.015, -0.075, 0.03), BLACK, { lift: 0.004, pivot: [-0.075, 0.03], keep: true })
    : dots(face, 0.075, 0.03, 0.011, 0.015);
  add(h, G.cone, SK, lich ? -0.02 : 0, -0.045, 0.2, 0.045, 0.2, 0.05, { rx: PI - 0.25 }); // the long nose
  for (const s of lich ? [-1] : [-1, 1]) blob(h, [0.1, 0.04, 0.05], 2, HAIR, s * 0.07, -0.13, 0.17, { rz: s * 0.4 });
  // the beard, hinged under the nose, bulging forward over the chest (the Lich's: torn short, to one side)
  const bg = group(h, lich ? -0.05 : 0, -0.14, 0.12), L = lich ? 1.1 : 1.56;
  const beard = lathe(bg, [[0.001, 0], [0.06, 0.08], [0.13, 0.31], [0.18, 0.66], [0.2, 1.06], [0.18, 1.36], [0.13, 1.53], [0.001, 1.56]].map(([r, y]) => [r * (lich ? 0.8 : 1), (y * L) / 1.56]), HAIR, 0, -L, 0, { smooth: 36, sz: 0.45 });
  const BP = beard.geometry.attributes.position;
  for (let i = 0; i < BP.count; i++) BP.setZ(i, BP.getZ(i) + 0.18 * Math.sin(Math.min(1, (1 - BP.getY(i) / L) * 2.2) * PI / 2));
  beard.geometry.computeVertexNormals();
  root.userData = { body: b, head: h, arms, legs, eyes, beard: bg, rest: [[0.05, 0, -0.14, -0.25], [0.05, 0, 0.14, -0.25]], wave: 1, headAmp: 0.5 };
  if (!lich) return root;

  // ── the Lich shows through ──
  // half the face torn off: the skull, a black socket with a green fire in it, a grin of teeth
  const skull = blob(h, [0.15, 0.23, 0.17], 2.3, BONE, 0.075, 0.01, 0.045);
  decal(skull, ellipse(0.05, 0.047, 0.09, 0.03, 20), BLACK, { lift: 0.004 });
  decal(skull, ellipse(0.02, 0.02, 0.092, 0.028, 16), GREEN, { lift: 0.008, emissive: 0x3aa020 });
  decal(skull, poly([[0.0, -0.1], [0.14, -0.08], [0.12, -0.16], [0.0, -0.17]]), 0x2a0e0e, { lift: 0.004 });
  const teeth = [];
  for (let i = 0; i < 5; i++) {
    const x0 = 0.012 + i * 0.026;
    teeth.push(roundRect(0.02, 0.028, 0.006, x0 + 0.01, -0.108 - i * 0.003), roundRect(0.02, 0.026, 0.006, x0 + 0.01, -0.155 + i * 0.003));
  }
  decal(skull, teeth, BONE, { lift: 0.007 });
  decal(skull, poly([[0.05, -0.03], [0.075, -0.03], [0.062, -0.07]]), BLACK, { lift: 0.005 }); // the nose hole
  // tatters of skin hanging off the edge of the skull
  for (let i = 0; i < 4; i++) add(h, G.cone, SK_D, 0.0 + i * 0.005, 0.12 - i * 0.07, 0.19 - i * 0.01, 0.022, 0.08, 0.012, { rx: PI, rz: 0.2 });
  // a soft glow round the burning eye
  add(h, G.sph, 0, 0.09, 0.03, 0.2, 0.07, 0.07, 0.04, { material: noOutline(new THREE.MeshBasicMaterial({ color: 0x7dff4a, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })), keep: true });
  // the horns: a ram's horn curling over the skull side, a broken point on the other
  const curl = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10, a = t * 4.4, rad = 0.2 * (1 - t * 0.55);
    curl.push([0.13 + Math.sin(a) * 0.02 + t * 0.12, 0.16 + Math.sin(a) * rad, -0.02 + Math.cos(a) * rad - 0.12 * Math.sin(t * PI) * 0.3]);
  }
  tube(h, curl, 0.07, 0.018, HORN, { segs: 18, radial: 8 });
  for (let i = 1; i < 5; i++) { const p = curl[i * 2]; add(h, RING(0.07 * (1 - i * 0.14), 0.008), HORN_D, p[0], p[1], p[2], 1, 1, 1, { ry: PI / 2 }); }
  add(h, G.cone, 0xb4bcb0, -0.07, 0.3, -0.02, 0.07, 0.34, 0.06, { rz: 0.35, rx: -0.15 }); // the broken horn, like a blade
  // the hair gone wild: spikes all round the head and over the shoulders
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * PI * 2, s = 0.9 + (i % 3) * 0.2;
    add(h, G.cone, HAIR, Math.sin(a) * 0.19, -0.05 + Math.cos(a) * 0.1, -0.1 + Math.cos(a) * 0.06, 0.06 * s, 0.26 * s, 0.05 * s, { rz: -a * 0.5 - PI * 0.5 * Math.sign(Math.sin(a)) * 0.6, rx: 0.4 });
  }
  for (let i = 0; i < 9; i++) {
    const x = -0.36 + i * 0.09, up = 1 - Math.abs(x) * 1.4;
    add(b, G.cone, HAIR, x, 2.72 + up * 0.06, -0.12 - up * 0.05, 0.07, 0.3 + (i % 2) * 0.1, 0.05, { rx: PI + 0.3, rz: x * 0.9 });
  }
  // hunched over, arms hanging forward like claws; he never waves
  b.rotation.x = 0.1;
  Object.assign(root.userData, { rest: [[-0.45, 0, -0.3, -0.7], [-0.35, 0, 0.3, -0.9]], wave: -1, headAmp: 0.35 });
  return root;
}

/**
 * The Lich in his true form ("Mortal Folly", and out of Billy's skin in "Escape from the Citadel"): very
 * tall and hunched, a skull of pale taut skin with green fire for pupils in black sockets and a
 * perpetual grin, a rusty crown, a ram's horn curling back on one side and a broken one on the other;
 * a heavy olive robe pooling on the floor, a pale green cape with a high collar, two amber clasps on
 * the chest, sleeves torn at the elbow and bare bony forearms ending in long claws (hands: where the
 * green fire burns while he casts). He floats: the robe hides his feet.
 */
function lichTrue() {
  const root = new THREE.Group(), b = group(root, 0, 0, 0);
  const ROBE = 0x56663a, ROBE_D = 0x3a4526, ROBE_L = 0x7d8c4e, CAPE = 0x74ae7c, CAPE_D = 0x3f6e4c;
  const BONE = 0xe4ead8, SKULL = 0xdde7ea, GOLD = 0xa8963c, AMBER = 0xe08a1c, HORN = 0xc8b27a, HORN_D = 0x8a7a50;
  const GREEN = 0x9dff5a;
  // the robe: wide at the floor, narrowing up to the shoulders, a paler panel down the front, tatters at the hem
  lathe(b, [[0.001, 0], [0.98, 0], [0.94, 0.12], [0.8, 0.45], [0.64, 0.95], [0.52, 1.45], [0.45, 1.85], [0.42, 2.2], [0.38, 2.5], [0.3, 2.7], [0.14, 2.8], [0.001, 2.82]], ROBE, 0, 0, 0, { smooth: 30, sz: 0.8 });
  blob(b, [0.17, 0.85, 0.1], 2.6, ROBE_L, 0, 1.2, 0.54, { rx: -0.22 });
  add(b, new THREE.TorusGeometry(0.84, 0.05, 5, 26), ROBE_D, 0, 0.3, 0, 1, 1, 0.8, { rx: PI / 2 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * PI * 2 + 0.2, r = 0.93;
    add(b, G.cone, ROBE_D, Math.sin(a) * r, 0.05, Math.cos(a) * r * 0.8, 0.12, 0.26, 0.05, { rx: PI / 2 + 0.9, ry: a, rz: 0 });
  }
  // the cape down his back, spreading on the floor behind; the high collar round the head
  blob(b, [0.66, 1.35, 0.2], 2.3, CAPE, 0, 1.45, -0.42, { rx: 0.12 });
  blob(b, [0.9, 0.16, 0.55], 2.2, CAPE_D, 0, 0.06, -0.72);
  for (const s2 of [-1, 1]) blob(b, [0.24, 0.16, 0.24], 2.2, CAPE, s2 * 0.32, 2.72, 0.02); // over the shoulders
  add(b, new THREE.LatheGeometry([[0.2, 0], [0.26, 0.18], [0.34, 0.42], [0.36, 0.56]].map(([r, y]) => new THREE.Vector2(r, y)), 16, 0.6, PI * 2 - 1.2), CAPE, 0, 2.72, -0.08, 1, 1, 0.85, { side: THREE.DoubleSide }); // the collar, open in front
  for (const s2 of [-1, 1]) add(b, G.sph, AMBER, s2 * 0.2, 2.52, 0.33, 0.075, 0.075, 0.035, { emissive: 0x5a2a00 }); // the clasps
  add(b, G.cyl, BONE, 0, 2.86, 0.02, 0.06, 0.16, 0.06);
  // arms: sleeves to the elbow, then bare bones and long claws
  const arms = [-1, 1].map((s2) => {
    const A = arm(b, s2 * 0.4, 2.62, 0, 0.6, 0.56, 0.05, BONE, BONE, 0.05);
    A.sh.remove(A.sh.children[0]);
    lathe(A.sh, [[0.001, -0.63], [0.2, -0.62], [0.16, -0.3], [0.14, 0.02], [0.001, 0.08]], ROBE, 0, 0, 0, { smooth: 12 });
    for (let i = 0; i < 5; i++) { const a = (i / 5) * PI * 2; add(A.sh, G.cone, ROBE_D, Math.sin(a) * 0.17, -0.66, Math.cos(a) * 0.17, 0.06, 0.16, 0.03, { rx: PI }); }
    A.el.remove(A.el.children[0]);
    A.el.remove(A.hand);
    for (const d of [-1, 1]) cap(A.el, [d * 0.028, 0, 0], [d * 0.024, -0.52, 0.01], 0.022, BONE);
    blob(A.el, [0.06, 0.05, 0.035], 2, BONE, 0, -0.57, 0.01);
    for (const f of [-1.5, -0.5, 0.5, 1.5]) {
      cap(A.el, [f * 0.03, -0.6, 0.01], [f * 0.05, -0.76, 0.05], 0.014, BONE);
      cap(A.el, [f * 0.05, -0.76, 0.05], [f * 0.055, -0.9, 0.12], 0.011, BONE);
    }
    cap(A.el, [-s2 * 0.05, -0.56, 0.03], [-s2 * 0.1, -0.68, 0.1], 0.014, BONE);
    return A;
  });
  // the head: a skull under skin pulled tight: a heavy scowling brow over deep black sockets with green
  // fire burning in them, hollow cheeks under sharp cheekbones, a nose hole, and a lipless grin of long
  // yellowed teeth, torn skin hanging at the corners; the jaw hangs apart (userData.jaw: it drops open
  // while he casts and roars, lichboss.js); cracks across the crown
  const h = group(b, 0, 3.08, 0.1);
  h.scale.setScalar(1.3);
  const SKIN = 0xcfd8d3, SHADE = 0x6d7c77, TEETH = 0xe2d6aa, HOLE = 0x050807;
  const skull = blob(h, [0.175, 0.205, 0.2], 2.4, SKIN, 0, 0.06, -0.02);
  for (const s2 of [-1, 1]) {
    blob(h, [0.088, 0.034, 0.06], 2.2, SKIN, s2 * 0.07, 0.092, 0.145, { rz: s2 * 0.4 }); // the brow, pulled down in a scowl
    blob(h, [0.058, 0.034, 0.05], 2.2, SKIN, s2 * 0.122, -0.035, 0.115, { rz: -s2 * 0.25 }); // cheekbones
    add(h, G.sph, 0, s2 * 0.068, 0.03, 0.12, 0.062, 0.056, 0.052, { material: toonHole(HOLE), rz: s2 * 0.35 }); // the sockets, deep
  }
  const face = blob(h, [0.125, 0.085, 0.12], 2.3, SKIN, 0, -0.08, 0.05); // cheeks and upper jaw
  decal(face, [ellipse(0.035, 0.05, -0.098, -0.095), ellipse(0.035, 0.05, 0.098, -0.095)], SHADE, { lift: 0.003 }); // hollow cheeks
  decal(skull, [poly([[-0.03, 0.2], [-0.045, 0.16], [-0.03, 0.15], [-0.055, 0.1], [-0.05, 0.1], [-0.022, 0.15], [-0.036, 0.16], [-0.02, 0.2]]),
    poly([[0.05, 0.22], [0.075, 0.17], [0.06, 0.16], [0.09, 0.125], [0.085, 0.12], [0.055, 0.155], [0.068, 0.17], [0.043, 0.22]])], SHADE, { lift: 0.004 }); // cracks
  add(h, G.cone, 0, 0, -0.045, 0.172, 0.022, 0.05, 0.012, { material: toonHole(HOLE), rx: PI }); // the nose hole
  add(h, G.sph, 0, 0, -0.152, 0.105, 0.105, 0.03, 0.06, { material: toonHole(HOLE) }); // the dark between the teeth
  // green fire in the sockets (a hot core, a halo)
  const eyes = group(h, 0, 0.026, 0);
  const fireEye = noOutline(new THREE.MeshBasicMaterial({ color: 0x8dff4a })), coreEye = noOutline(new THREE.MeshBasicMaterial({ color: 0xf0ffd0 }));
  const halo = noOutline(new THREE.MeshBasicMaterial({ color: 0x5aff3a, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
  for (const s2 of [-1, 1]) {
    add(eyes, G.sph, 0, s2 * 0.068, 0, 0.156, 0.015, 0.013, 0.01, { material: fireEye, keep: true });
    add(eyes, G.sph, 0, s2 * 0.068, 0.002, 0.168, 0.008, 0.008, 0.006, { material: coreEye, keep: true });
    add(eyes, G.sph, 0, s2 * 0.068, 0, 0.166, 0.028, 0.024, 0.014, { material: halo, keep: true });
  }
  // the grin: long upper teeth along the curve of the jaw, fangs at the corners
  const teethAt = (parent, y, up) => {
    for (let i = -4; i <= 4; i++) {
      const x = i * 0.024, z = 0.158 - x * x * 2.6, fang = Math.abs(i) === 3, len = fang ? 0.072 : 0.046 - Math.abs(i) * 0.002;
      add(parent, G.cone, TEETH, x, y + (up ? len / 2 : -len / 2), z, fang ? 0.013 : 0.011, len, 0.009, { rx: up ? 0 : PI, ry: -x * 5 });
    }
  };
  teethAt(h, -0.125, false);
  // the jaw, hinged under the ears: lower teeth pointing up, the chin
  const jaw = group(h, 0, -0.1, -0.02);
  blob(jaw, [0.118, 0.045, 0.115], 2.2, SKIN, 0, -0.105, 0.065);
  blob(jaw, [0.04, 0.03, 0.03], 2, SKIN, 0, -0.12, 0.175); // the chin
  teethAt(jaw, -0.075, true);
  // skin torn at the corners of the mouth, strings of it between the jaws
  for (const s2 of [-1, 1]) {
    add(h, G.cone, SHADE, s2 * 0.118, -0.14, 0.11, 0.016, 0.06, 0.008, { rx: PI, rz: s2 * 0.3 });
    add(h, G.cone, SHADE, s2 * 0.135, -0.1, 0.09, 0.012, 0.05, 0.008, { rx: PI, rz: s2 * 0.5 });
    cap(h, [s2 * 0.1, -0.125, 0.135], [s2 * 0.1, -0.195, 0.13], 0.004, SHADE, { keep: true });
  }
  // the rusty crown, five points
  add(h, new THREE.TorusGeometry(0.17, 0.03, 5, 18), GOLD, 0, 0.19, -0.01, 1, 1, 1, { rx: PI / 2 });
  for (let i = 0; i < 5; i++) { const a = (i / 5) * PI * 2; add(h, G.cone, GOLD, Math.sin(a) * 0.17, 0.3, Math.cos(a) * 0.17 - 0.01, 0.04, 0.2, 0.04); }
  // a ram's horn curling back on his right, a broken one on his left
  const curl = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12, a = t * 4.6, rad = 0.24 * (1 - t * 0.5);
    curl.push([-0.15 - t * 0.16 - Math.sin(a) * 0.03, 0.14 + Math.sin(a) * rad, -0.04 + Math.cos(a) * rad - 0.1 * t]);
  }
  tube(h, curl, 0.075, 0.02, HORN, { segs: 20, radial: 8 });
  for (let i = 1; i < 6; i++) { const p = curl[i * 2]; add(h, new THREE.TorusGeometry(0.075 * (1 - i * 0.12), 0.009, 4, 12), HORN_D, p[0], p[1], p[2], 1, 1, 1, { ry: PI / 2 }); }
  add(h, G.cone, HORN, 0.17, 0.2, -0.03, 0.065, 0.22, 0.06, { rz: -0.7, rx: -0.2 });
  b.rotation.x = 0.12; // hunched
  root.userData = { body: b, head: h, jaw, arms, eyes, rest: [[-0.55, 0, -0.35, -0.95], [-0.55, 0, 0.35, -0.95]], wave: -1, headAmp: 0.3 };
  return root;
}

export function makeNpc(id) {
  return bake(BUILDERS[id]());
}

/** Idle life: breathing, glances, blinking, a wave when Finn comes near, gestures while talking. */
export function poseNpc(m, s, dt) {
  const u = m.userData;
  const a = u.anim || (u.anim = { blink: 1 + Math.random() * 3, wave: 0, greeted: false, seed: Math.random() * 20, talk: 0 });
  const t = s.time + a.seed;
  if (!a.greeted && s.near < 7) { a.greeted = true; a.wave = 1.6; }
  if (s.near > 12) a.greeted = false;
  a.wave = Math.max(0, a.wave - dt);
  a.talk += ((s.talking ? 1 : 0) - a.talk) * (1 - Math.exp(-8 * dt));
  if (u.body) u.body.scale.y = 1 + 0.012 * Math.sin(t * 2.1);
  if (u.head) {
    const amp = u.headAmp ?? 1;
    u.head.rotation.set((0.03 * Math.sin(t * 0.7) + 0.07 * a.talk * Math.sin(t * 6)) * amp, 0.15 * Math.sin(t * 0.4) * amp, 0.05 * Math.sin(t * 0.9) * amp);
  }
  a.blink -= dt;
  if (a.blink < -0.12) a.blink = 2 + Math.random() * 3.5;
  if (u.eyes) u.eyes.scale.y = a.blink < 0 ? 0.12 : 1;
  if (u.arms) {
    const w = Math.sin(Math.min(1, a.wave / 1.6) * PI) ** 0.6; // up, wave, down
    u.arms.forEach((A, i) => {
      const r = u.rest[i], side = i ? 1 : -1, sway = 0.04 * Math.sin(t * 1.3 + i);
      let x = r[0] + sway, y = r[1], z = r[2], e = r[3];
      if (i === u.wave && w > 0) {
        x += (-2.7 - x) * w; y += (0 - y) * w; z += (side * 0.3 - z) * w;
        e += (-0.5 + 0.45 * Math.sin(t * 13) - e) * w;
      } else if (i !== u.wave && a.talk > 0.01) {
        x += (-0.9 + 0.2 * Math.sin(t * 3.1) - x) * a.talk * 0.7;
        e += (-1.2 + 0.25 * Math.sin(t * 4.3) - e) * a.talk * 0.7;
      }
      A.sh.rotation.set(x, y, z);
      A.el.rotation.x = e;
    });
  }
  if (u.flames) u.flames.forEach((f, i) => (f.scale.y = f.userData.h0 * (1 + Math.sin(s.time * 11 + i * 1.7) * 0.1 + Math.sin(s.time * 17 + i) * 0.04)));
  if (u.tick) u.tick(t, a, dt);
}
