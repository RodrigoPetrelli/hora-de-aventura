// Keyboard (physical key codes), mouse + pointer lock, touch and gamepad,
// all folded into one set of intents: move, look, jump, attack, talk, jake, fire, sprint.

export const BIND = {
  forward: ["KeyW", "ArrowUp"],
  back: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  jump: ["Space"],
  attack: ["KeyJ"],
  talk: ["KeyE", "Enter"],
  jake: ["KeyQ", "KeyK"],
  fire: ["KeyF"], // Finn's Fire Wave (before the Flame Heart, main.js treats it as the sword)
  sprint: ["ShiftLeft", "ShiftRight"],
  pause: ["Escape", "KeyP"],
};
const ACTIONS_BY_CODE = new Map();
for (const [action, codes] of Object.entries(BIND)) for (const c of codes) ACTIONS_BY_CODE.set(c, action);
const BLOCK = new Set(["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"]);
const GP = { jump: 0, jake: 1, attack: 2, talk: 3, fire: 5, pause: 9 }; // fire: RB

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.taps = new Set();
    this.move = { x: 0, y: 0 };
    this.look = { x: 0, y: 0 }; // pixels this frame (mouse / touch drag)
    this.lookRate = { x: 0, y: 0 }; // -1..1 continuous (gamepad stick)
    this.zoom = 0;
    this.sprint = false;
    this.touch = matchMedia("(pointer: coarse)").matches;
    this.locked = false;
    this.enabled = true;
    this.onUnlock = null;
    this.gpPrev = [];
    this.btnHeld = new Set();
    this.stick = { id: -1, ox: 0, oy: 0, x: 0, y: 0 };
    this.lookTouch = { id: -1, x: 0, y: 0 };
    this.dragging = false;

    addEventListener("keydown", (e) => {
      if (BLOCK.has(e.code)) e.preventDefault();
      this.keys.add(e.code);
      const a = ACTIONS_BY_CODE.get(e.code);
      if (a && !e.repeat) this.taps.add(a);
    });
    addEventListener("keyup", (e) => this.keys.delete(e.code));
    addEventListener("blur", () => {
      this.keys.clear();
      this.btnHeld.clear();
      this.stick.id = -1;
      this.lookTouch.id = -1;
      this.dragging = false;
    });

    document.addEventListener("pointerlockchange", () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === canvas;
      if (was && !this.locked && this.onUnlock) this.onUnlock();
    });
    canvas.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch") return this.touchDown(e);
      if (this.locked) {
        if (e.button === 0) this.taps.add("attack");
        return;
      }
      this.dragging = true;
      this.requestLock();
    });
    addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch") return this.touchMove(e);
      if (this.locked || this.dragging) {
        this.look.x += e.movementX || 0;
        this.look.y += e.movementY || 0;
      }
    });
    addEventListener("pointerup", (e) => {
      if (e.pointerType === "touch") return this.touchUp(e);
      this.dragging = false;
    });
    addEventListener("pointercancel", (e) => this.touchUp(e));
    canvas.addEventListener("wheel", (e) => { e.preventDefault(); this.zoom += Math.sign(e.deltaY); }, { passive: false });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  requestLock() {
    if (this.touch || !this.canvas.requestPointerLock) return;
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch {
      /* no pointer lock (e.g. inside an iframe) — drag-to-look still works */
    }
  }

  bindButton(el, action) {
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.taps.add(action);
      this.btnHeld.add(action);
      el.classList.add("on");
    });
    const up = () => { this.btnHeld.delete(action); el.classList.remove("on"); };
    el.addEventListener("pointerup", up);
    el.addEventListener("pointerleave", up);
    el.addEventListener("pointercancel", up);
  }

  touchDown(e) {
    this.touch = true;
    if (e.clientX < innerWidth * 0.45 && this.stick.id < 0) {
      this.stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 };
      if (this.onStick) this.onStick(true, e.clientX, e.clientY, 0, 0);
    } else if (this.lookTouch.id < 0) {
      this.lookTouch = { id: e.pointerId, x: e.clientX, y: e.clientY };
    }
  }
  touchMove(e) {
    if (e.pointerId === this.stick.id) {
      let dx = e.clientX - this.stick.ox, dy = e.clientY - this.stick.oy;
      const d = Math.hypot(dx, dy), R = 55;
      if (d > R) { dx *= R / d; dy *= R / d; }
      this.stick.x = dx / R;
      this.stick.y = -dy / R;
      if (this.onStick) this.onStick(true, this.stick.ox, this.stick.oy, dx, dy);
    } else if (e.pointerId === this.lookTouch.id) {
      this.look.x += (e.clientX - this.lookTouch.x) * 1.6;
      this.look.y += (e.clientY - this.lookTouch.y) * 1.6;
      this.lookTouch.x = e.clientX;
      this.lookTouch.y = e.clientY;
    }
  }
  touchUp(e) {
    if (e.pointerId === this.stick.id) {
      this.stick = { id: -1, ox: 0, oy: 0, x: 0, y: 0 };
      if (this.onStick) this.onStick(false);
    }
    if (e.pointerId === this.lookTouch.id) this.lookTouch.id = -1;
  }

  has(action) {
    return BIND[action].some((c) => this.keys.has(c));
  }
  held(action) {
    if (this.has(action) || this.btnHeld.has(action)) return true;
    const gp = this.pad();
    return !!(gp && action === "jump" && gp.buttons[GP.jump]?.pressed);
  }
  pad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) if (p && p.connected) return p;
    return null;
  }

  /** Call once per rendered frame, before the simulation steps. */
  poll() {
    let x = (this.has("right") ? 1 : 0) - (this.has("left") ? 1 : 0);
    let y = (this.has("forward") ? 1 : 0) - (this.has("back") ? 1 : 0);
    this.sprint = this.has("sprint");
    if (this.stick.id >= 0) {
      x += this.stick.x;
      y += this.stick.y;
      if (Math.hypot(this.stick.x, this.stick.y) > 0.92) this.sprint = true;
    }
    this.lookRate.x = 0;
    this.lookRate.y = 0;
    const gp = this.pad();
    if (gp) {
      const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
      x += dz(gp.axes[0] || 0);
      y -= dz(gp.axes[1] || 0);
      this.lookRate.x = dz(gp.axes[2] || 0);
      this.lookRate.y = dz(gp.axes[3] || 0);
      if (gp.buttons[6]?.pressed || gp.buttons[7]?.pressed || gp.buttons[10]?.pressed) this.sprint = true;
      const now = gp.buttons.map((b) => b.pressed);
      const edge = (i) => now[i] && !this.gpPrev[i];
      if (edge(GP.jump)) this.taps.add("jump");
      if (edge(GP.attack)) this.taps.add("attack");
      if (edge(GP.talk)) this.taps.add("talk");
      if (edge(GP.jake)) this.taps.add("jake");
      if (edge(GP.fire)) this.taps.add("fire");
      if (edge(GP.pause)) this.taps.add("pause");
      this.gpPrev = now;
    }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    this.move.x = x;
    this.move.y = y;
  }
  consume(action) {
    if (!this.taps.has(action)) return false;
    this.taps.delete(action);
    return true;
  }
  endFrame(steps) {
    this.look.x = 0;
    this.look.y = 0;
    this.zoom = 0;
    if (steps > 0) this.taps.clear();
  }
}
