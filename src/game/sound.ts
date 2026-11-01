/* ------------------------------------------------------------------
   Синтезированные звуки через WebAudio — без внешних файлов.
------------------------------------------------------------------ */

class SoundEngine {
  private ctx: AudioContext | null = null;
  muted = false;

  private ensure(): AudioContext | null {
    if (this.muted) return null;
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        this.ctx = new Ctor();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  private tone(
    freq: number,
    duration: number,
    options: { type?: OscillatorType; gain?: number; delay?: number; slideTo?: number } = {},
  ) {
    const ctx = this.ensure();
    if (!ctx) return;
    const { type = 'sine', gain = 0.06, delay = 0, slideTo } = options;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + duration);
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(amp).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  private noise(duration: number, gain = 0.05, filterFreq = 1800) {
    const ctx = this.ensure();
    if (!ctx) return;
    const frames = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    const amp = ctx.createGain();
    amp.gain.value = gain;
    src.connect(filter).connect(amp).connect(ctx.destination);
    src.start();
  }

  click() {
    this.tone(520, 0.05, { type: 'triangle', gain: 0.03 });
  }

  bet() {
    this.tone(660, 0.06, { type: 'square', gain: 0.018 });
  }

  spin() {
    this.noise(0.28, 0.035, 900);
    this.tone(170, 0.22, { type: 'sawtooth', gain: 0.02, slideTo: 90 });
  }

  reelStop(index: number) {
    const base = 300 + index * 40;
    this.tone(base, 0.06, { type: 'square', gain: 0.02 });
    this.noise(0.04, 0.02, 2400);
  }

  win(small = false) {
    const notes = small ? [660, 880] : [523, 659, 784, 1046];
    notes.forEach((f, i) => this.tone(f, 0.22, { type: 'triangle', gain: 0.05, delay: i * 0.08 }));
  }

  bigWin() {
    const notes = [523, 659, 784, 1046, 1318, 1568];
    notes.forEach((f, i) => this.tone(f, 0.4, { type: 'triangle', gain: 0.055, delay: i * 0.11 }));
    this.tone(130, 0.8, { type: 'sine', gain: 0.05, delay: 0.1 });
  }

  scatter() {
    [880, 1108, 1318, 1760].forEach((f, i) =>
      this.tone(f, 0.3, { type: 'sine', gain: 0.05, delay: i * 0.07 }),
    );
  }

  freeSpin() {
    [392, 523, 659].forEach((f, i) => this.tone(f, 0.5, { type: 'sine', gain: 0.045, delay: i * 0.1 }));
  }

  error() {
    this.tone(180, 0.16, { type: 'sawtooth', gain: 0.03, slideTo: 120 });
  }
}

export const sound = new SoundEngine();
