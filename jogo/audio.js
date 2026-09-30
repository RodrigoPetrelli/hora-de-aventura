// Tiny WebAudio synth for sound effects — no audio files needed.
let ctx = null;
let master = null;
let enabled = true;

export function unlockAudio() {
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
  } catch {
    ctx = null;
  }
}
export function setSound(on) {
  enabled = on;
}

function tone(type, f0, f1, dur, vol = 1, delay = 0) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}
function noise(dur, freq, vol = 1) {
  const t = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  f.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

const SFX = {
  jump: () => tone("square", 280, 560, 0.12, 0.25),
  jump2: () => tone("square", 420, 900, 0.14, 0.25),
  land: () => tone("sine", 160, 90, 0.06, 0.2),
  sword: () => noise(0.14, 2400, 0.7),
  sword2: () => noise(0.13, 3100, 0.65),
  sword3: () => { noise(0.2, 1500, 0.9); tone("sawtooth", 180, 90, 0.18, 0.12); },
  spin: () => { noise(0.3, 2000, 0.7); tone("triangle", 500, 950, 0.28, 0.12); },
  hit: () => { tone("sawtooth", 220, 80, 0.12, 0.3); noise(0.08, 900, 0.6); },
  hitBig: () => { tone("sawtooth", 200, 50, 0.2, 0.4); noise(0.14, 700, 0.9); },
  squish: () => { tone("sine", 300, 900, 0.12, 0.3); noise(0.1, 500, 0.5); },
  alert: () => { tone("square", 880, 880, 0.06, 0.12); tone("square", 1175, 1175, 0.08, 0.12, 0.07); },
  charge: () => tone("sawtooth", 140, 420, 0.5, 0.1),
  lunge: () => tone("sine", 250, 520, 0.16, 0.2),
  stretch: () => tone("triangle", 220, 820, 0.16, 0.18),
  punch: () => { tone("sine", 190, 55, 0.14, 0.45); noise(0.07, 500, 0.7); },
  grow: () => { tone("triangle", 110, 520, 0.4, 0.25); tone("sine", 220, 1040, 0.4, 0.1); },
  boom: () => { tone("sine", 110, 32, 0.6, 0.6); noise(0.5, 180, 1); noise(0.25, 900, 0.4); },
  heart: () => { tone("triangle", 880, 880, 0.1, 0.3); tone("triangle", 1320, 1320, 0.16, 0.3, 0.08); },
  ready: () => tone("sine", 660, 990, 0.12, 0.15),
  pop: () => { tone("sine", 600, 1400, 0.1, 0.35); tone("triangle", 900, 300, 0.2, 0.2, 0.05); },
  hurt: () => tone("sawtooth", 300, 90, 0.3, 0.35),
  collect: () => [523, 659, 784, 1047].forEach((f, i) => tone("triangle", f, f, 0.18, 0.35, i * 0.08)),
  win: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone("triangle", f, f, 0.22, 0.35, i * 0.11)),
  talk: () => tone("square", 660, 700, 0.05, 0.12),
  heal: () => tone("sine", 700, 1100, 0.15, 0.2),
  // the Ice King and his penguins
  wenk: () => { tone("square", 640, 520, 0.08, 0.16); tone("square", 720, 560, 0.1, 0.16, 0.11); },
  freeze: () => { tone("triangle", 1200, 2400, 0.35, 0.1); tone("sine", 1800, 3400, 0.3, 0.07, 0.06); },
  zap: () => { tone("sawtooth", 1700, 180, 0.2, 0.22); noise(0.16, 3200, 0.6); },
  crack: () => { noise(0.22, 1900, 0.8); tone("square", 950, 300, 0.12, 0.1); },
  breath: () => { noise(0.6, 800, 0.9); tone("sine", 320, 140, 0.5, 0.1); },
  whoosh: () => { tone("sine", 180, 900, 0.45, 0.15); noise(0.4, 600, 0.45); },
  bossHurt: () => { tone("square", 540, 330, 0.12, 0.13); tone("square", 480, 300, 0.12, 0.13, 0.12); },
  roar: () => { tone("sawtooth", 170, 80, 0.9, 0.28); noise(0.7, 260, 0.8); tone("triangle", 900, 1800, 0.6, 0.06, 0.2); },
  gate: () => { tone("sine", 95, 55, 0.7, 0.4); noise(0.6, 380, 0.6); },
  // the Peppermint Butler, his spirits and his Dark Lair
  spirit: () => { tone("sine", 520, 1300, 0.35, 0.18); tone("triangle", 780, 1950, 0.3, 0.1, 0.08); },
  warp: () => { tone("sine", 900, 90, 0.9, 0.25); tone("triangle", 1400, 180, 0.8, 0.1, 0.1); noise(0.6, 500, 0.4); },
  blink: () => { tone("sine", 700, 140, 0.22, 0.2); noise(0.18, 1400, 0.4); },
  hiss: () => { noise(0.7, 4200, 0.9); noise(0.5, 2600, 0.5); },
  cackle: () => [0, 1, 2, 3, 4].forEach((i) => tone("square", 420 - i * 25, 300 - i * 20, 0.09, 0.1, i * 0.12)),
  stake: () => { tone("sine", 150, 45, 0.3, 0.45); noise(0.12, 1100, 0.6); },
  claw: () => { noise(0.35, 600, 0.8); tone("sawtooth", 110, 60, 0.3, 0.14); },
  summon: () => { tone("triangle", 180, 360, 0.6, 0.12); tone("sine", 270, 540, 0.6, 0.08, 0.1); },
  sink: () => { tone("sine", 320, 60, 0.5, 0.25); noise(0.4, 300, 0.4); },
  imp: () => { tone("square", 900, 1300, 0.08, 0.1); tone("square", 1200, 800, 0.1, 0.1, 0.09); },
  impPop: () => { tone("sine", 700, 1500, 0.1, 0.3); noise(0.12, 1200, 0.5); },
  darkBoom: () => { tone("sine", 90, 28, 0.7, 0.55); noise(0.5, 220, 0.9); tone("sawtooth", 160, 50, 0.4, 0.1); },
  slash: () => { noise(0.35, 1800, 0.9); tone("sawtooth", 260, 90, 0.3, 0.14); },
  portal: () => [392, 523, 659, 784].forEach((f, i) => tone("sine", f, f * 1.01, 0.5, 0.14, i * 0.12)),
  // the Flame King, his daughter's Path of Flames and his Colosseum of Flames
  ember: () => { tone("triangle", 440, 1320, 0.3, 0.16); noise(0.25, 1800, 0.35); },
  fireball: () => { noise(0.35, 700, 0.7); tone("sawtooth", 150, 320, 0.3, 0.08); },
  fireHit: () => { tone("sine", 130, 45, 0.35, 0.4); noise(0.35, 500, 0.8); },
  eruption: () => { noise(0.6, 350, 0.9); tone("sawtooth", 90, 45, 0.5, 0.18); noise(0.3, 1400, 0.3); },
  stomp: () => { tone("sine", 70, 28, 0.5, 0.6); noise(0.3, 160, 0.9); },
  megaCharge: () => { tone("sawtooth", 60, 240, 3.2, 0.1); tone("sine", 120, 480, 3.2, 0.08); noise(1.5, 300, 0.3); },
  megaBoom: () => { tone("sine", 80, 22, 1.4, 0.7); noise(1.2, 140, 1); noise(0.6, 700, 0.6); tone("sawtooth", 140, 40, 0.9, 0.15); },
  // Finn's Fire Wave (firewave.js): the sword catches fire, the cut, the wave dying in water; ready again
  fireCharge: () => { noise(0.3, 1100, 0.55); tone("sawtooth", 110, 330, 0.26, 0.1); },
  fireWave: () => { noise(0.55, 800, 0.9); tone("sawtooth", 150, 60, 0.4, 0.2); tone("triangle", 380, 1100, 0.3, 0.1, 0.03); },
  fizzle: () => { noise(0.45, 4200, 0.6); tone("sine", 420, 200, 0.18, 0.08); },
  fireReady: () => { tone("triangle", 520, 1040, 0.14, 0.14); noise(0.12, 2400, 0.2); },
  // the Lich (lichboss.js)
  bones: () => [0, 1, 2, 3, 4, 5].forEach((i) => tone("square", 900 + (i % 3) * 260, 700 + (i % 2) * 300, 0.04, 0.08, i * 0.045)),
  stopTime: () => { tone("sine", 220, 55, 1.1, 0.4); tone("triangle", 1760, 440, 0.9, 0.08); noise(0.4, 3000, 0.25); },
  fallCharge: () => { tone("sawtooth", 45, 180, 5.2, 0.12); tone("sine", 90, 360, 5.2, 0.1); tone("triangle", 1200, 300, 5, 0.03); noise(4.5, 200, 0.35); },
  fallWord: () => { tone("sawtooth", 110, 40, 0.8, 0.3); tone("square", 55, 30, 0.8, 0.2); },
  fallBoom: () => { tone("sine", 70, 18, 2, 0.8); noise(1.8, 120, 1); noise(1, 900, 0.5); tone("sawtooth", 180, 25, 1.4, 0.2); },
};
export function sfx(name) {
  if (!enabled || !ctx || ctx.state !== "running") return;
  try {
    SFX[name]();
  } catch {
    /* audio is decoration; never let it break the game */
  }
}
