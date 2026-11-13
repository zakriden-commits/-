/** DOM-driven HUD. Keeps all text/state tweaks in one place. */
export class HUD {
  constructor() {
    this.$ = (id) => document.getElementById(id);
    this.hud = this.$('hud');
    this.money = this.$('money');
    this.task = this.$('task');
    this.inv = this.$('inv');
    this.noise = this.$('noise');
    this.prompt = this.$('prompt');
    this.promptText = this.$('promptText');
    this.promptKey = this.prompt.querySelector('.key');
    this.crosshair = this.$('crosshair');
    this.suspicion = this.$('suspicion');
    this.suspicionFill = this.suspicion.querySelector('i');
    this.subtitleEl = this.$('subtitle');
    this.toast = this.$('toast');
    this.toastBig = this.toast.querySelector('.big');
    this.toastSmall = this.toast.querySelector('.small');
    this.stickEl = this.$('stick');
    this.buttons = this.$('btns');
    this.nub = this.stickEl.querySelector('.nub');
    this.subTimer = 0;
    this.toastTimer = 0;
    this.lastPrompt = '';
    this.queue = [];
    this.onSubtitleDone = null;
  }

  show(on = true) {
    this.hud.classList.toggle('on', on);
    this.crosshair.classList.toggle('on', on);
    this.stickEl.classList.toggle('on', on);
    this.buttons.classList.toggle('on', on);
  }
  setMoney(v) { this.money.textContent = `${Math.round(v)}`; }
  setTask(html) { if (this.task.innerHTML !== html) this.task.innerHTML = html; }
  setInventory(count, total = 3) { this.inv.textContent = `рюкзак: ${count}/${total}`; }
  setNoise(level) {
    const label = level < 0.2 ? 'тихо' : level < 0.45 ? 'слышно' : level < 0.75 ? 'громко' : 'очень громко';
    const txt = `шум: ${label}`;
    if (this.noise.textContent !== txt) {
      this.noise.textContent = txt;
      this.noise.style.color = level > 0.6 ? '#ff9aa4' : level > 0.35 ? '#ffd166' : '';
    }
  }
  setSuspicion(v) {
    this.suspicion.style.opacity = v > 0.02 ? '1' : '0';
    this.suspicionFill.style.width = `${Math.min(100, v * 100).toFixed(0)}%`;
  }
  showPrompt(text, key = 'E') {
    if (text === this.lastPrompt) return;
    this.lastPrompt = text;
    if (!text) { this.prompt.classList.remove('on'); return; }
    this.promptText.textContent = text;
    this.promptKey.textContent = key;
    this.prompt.classList.add('on');
  }
  setStick(stick) {
    if (!stick || !stick.active) { this.stickEl.classList.remove('active'); this.nub.style.transform = ''; return; }
    this.stickEl.classList.add('active');
    const dx = stick.x - stick.ox, dy = stick.y - stick.oy;
    const len = Math.hypot(dx, dy);
    const max = 40;
    const k = len > max ? max / len : 1;
    this.nub.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  }
  say(text, duration = 3.4) {
    this.subtitleEl.textContent = text;
    this.subtitleEl.classList.add('on');
    this.subTimer = duration;
  }
  toast(big, small = '', duration = 2.2) {
    this.toastBig.textContent = big;
    this.toastSmall.textContent = small;
    this.toast.classList.add('on');
    this.toastTimer = duration;
  }
  update(dt) {
    if (this.subTimer > 0) {
      this.subTimer -= dt;
      if (this.subTimer <= 0) this.subtitleEl.classList.remove('on');
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toast.classList.remove('on');
    }
  }
}
