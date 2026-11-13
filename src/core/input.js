/**
 * Touch-first controls:
 *  - left thumb  -> virtual stick (walk / sneak with half tilt)
 *  - right side  -> drag to look
 *  - taps        -> interact (buttons in world + HUD prompt)
 * Also supports keyboard + mouse/pointer lock for desktop testing.
 */
export class Input {
  constructor(dom) {
    this.dom = dom;
    this.move = { x: 0, y: 0 };          // -1..1, y forward
    this.look = { dx: 0, dy: 0 };        // consumed each frame
    this.sneak = false;                  // toggled by partial stick / shift
    this.run = false;
    this.interactPressed = false;
    this.pausePressed = false;
    this.pointers = new Map();
    this.stick = { id: null, ox: 0, oy: 0, x: 0, y: 0, active: false };
    this.lookPointer = { id: null, x: 0, y: 0 };
    this.keys = new Set();
    this.enabled = true;
    this.locked = false;
    this.sensitivity = 0.0032;
    this.tapHandlers = [];
    this.onFirstGesture = null;
    this.gestureDone = false;
    this.stickRadius = 64;

    this._bind();
  }

  _fireGesture() {
    if (this.gestureDone) return;
    this.gestureDone = true;
    this.onFirstGesture?.();
  }

  _bind() {
    const el = this.dom;
    el.style.touchAction = 'none';

    el.addEventListener('pointerdown', (e) => {
      this._fireGesture();
      if (!this.enabled) return;
      const half = window.innerWidth * 0.45;
      if (e.clientX < half && this.stick.id === null) {
        this.stick.id = e.pointerId;
        this.stick.ox = e.clientX; this.stick.oy = e.clientY;
        this.stick.x = e.clientX; this.stick.y = e.clientY;
        this.stick.active = true;
        this.onStick?.(this.stick);
      } else if (this.lookPointer.id === null) {
        this.lookPointer.id = e.pointerId;
        this.lookPointer.x = e.clientX; this.lookPointer.y = e.clientY;
      }
      el.setPointerCapture?.(e.pointerId);
    }, { passive: true });

    el.addEventListener('pointermove', (e) => {
      if (!this.enabled) return;
      if (e.pointerId === this.stick.id) {
        this.stick.x = e.clientX; this.stick.y = e.clientY;
        this.onStick?.(this.stick);
        this._updateStickVector();
      } else if (e.pointerId === this.lookPointer.id) {
        const dx = e.clientX - this.lookPointer.x;
        const dy = e.clientY - this.lookPointer.y;
        this.look.dx += dx; this.look.dy += dy;
        this.lookPointer.x = e.clientX; this.lookPointer.y = e.clientY;
      }
    }, { passive: true });

    const end = (e) => {
      if (e.pointerId === this.stick.id) {
        this.stick.id = null; this.stick.active = false;
        this.move.x = 0; this.move.y = 0;
        this.onStick?.(null);
      }
      if (e.pointerId === this.lookPointer.id) this.lookPointer.id = null;
    };
    el.addEventListener('pointerup', end, { passive: true });
    el.addEventListener('pointercancel', end, { passive: true });

    // Taps (short press without much movement) -> interact
    let downAt = 0, downX = 0, downY = 0, moved = 0;
    el.addEventListener('pointerdown', (e) => { downAt = performance.now(); downX = e.clientX; downY = e.clientY; moved = 0; });
    el.addEventListener('pointermove', (e) => { moved += Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0); });
    el.addEventListener('pointerup', (e) => {
      const dt = performance.now() - downAt;
      const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (dt < 300 && dist < 16 && moved < 40) this.interactPressed = true;
    });

    window.addEventListener('keydown', (e) => {
      this._fireGesture();
      this.keys.add(e.code);
      if (e.code === 'KeyE' || e.code === 'Space') this.interactPressed = true;
      if (e.code === 'Escape') this.pausePressed = true;
      if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    // Desktop mouse look with pointer lock
    el.addEventListener('click', () => {
      if (!('ontouchstart' in window) && !this.locked) el.requestPointerLock?.();
    });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === el; });
    document.addEventListener('mousemove', (e) => {
      if (this.locked) { this.look.dx += e.movementX; this.look.dy += e.movementY; }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.move.x = 0; this.move.y = 0; }
    });
  }

  _updateStickVector() {
    const dx = this.stick.x - this.stick.ox;
    const dy = this.stick.y - this.stick.oy;
    const len = Math.hypot(dx, dy);
    const max = this.stickRadius;
    const clamped = Math.min(1, len / max);
    if (len < 1e-3) { this.move.x = 0; this.move.y = 0; return; }
    const mag = Math.pow(clamped, 0.85);
    this.move.x = (dx / len) * mag;
    this.move.y = -(dy / len) * mag; // up on screen = forward
  }

  /** Merge keyboard into the analog values once per frame. */
  sample() {
    const k = this.keys;
    let kx = 0, ky = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) ky += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) ky -= 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) kx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) kx += 1;
    if (kx || ky) {
      const l = Math.hypot(kx, ky) || 1;
      this.move.x = kx / l; this.move.y = ky / l;
    } else if (!this.stick.active) {
      this.move.x = 0; this.move.y = 0;
    }
    this.sneak = k.has('ShiftLeft') || k.has('ShiftRight') || (this.stick.active && Math.hypot(this.move.x, this.move.y) < 0.55);
    this.run = k.has('KeyF') || (this.stick.active && Math.hypot(this.move.x, this.move.y) > 0.94);
    return this.move;
  }

  consumeLook() {
    const l = { dx: this.look.dx * this.sensitivity, dy: this.look.dy * this.sensitivity };
    this.look.dx = 0; this.look.dy = 0;
    return l;
  }

  consumeInteract() {
    const v = this.interactPressed;
    this.interactPressed = false;
    return v;
  }

  consumePause() {
    const v = this.pausePressed;
    this.pausePressed = false;
    return v;
  }

  get moveMagnitude() { return Math.hypot(this.move.x, this.move.y); }
}
