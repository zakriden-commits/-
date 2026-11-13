/**
 * Fully synthesised audio (WebAudio) — no asset files.
 * Music: slow minor arpeggio loop for the "night heist" mood.
 * SFX: footsteps, drawers, coins, alarm, whoosh, heartbeat.
 * Audio unlocks on first touch (iOS requirement).
 */
export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.started = false;
    this.musicTimer = null;
    this.step = 0;
    this.muted = false;
    this.intensity = 0.4;
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.85;
    this.master.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.master);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.6;
    this.sfxGain.connect(this.master);

    this.startMusic();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.05);
  }

  /* --------------------------- basics --------------------------- */

  tone({ freq = 440, dur = 0.2, type = 'sine', gain = 0.3, attack = 0.005, glide = null, dest = null }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, glide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(dest || this.sfxGain);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  noise({ dur = 0.25, gain = 0.3, filterType = 'bandpass', freq = 1200, q = 1, sweepTo = null }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = filterType; filt.frequency.value = freq; filt.Q.value = q;
    if (sweepTo) filt.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(filt); filt.connect(g); g.connect(this.sfxGain);
    src.start(t0);
  }

  /* ---------------------------- sfx ----------------------------- */

  footstep(surface = 'wood', volume = 1) {
    if (!this.ctx) return;
    const cfg = {
      wood: { freq: 260, q: 1.2, dur: 0.12, gain: 0.16 },
      carpet: { freq: 130, q: 0.7, dur: 0.14, gain: 0.09 },
      tile: { freq: 900, q: 0.9, dur: 0.1, gain: 0.12 },
      concrete: { freq: 420, q: 0.8, dur: 0.1, gain: 0.11 },
      grass: { freq: 220, q: 0.6, dur: 0.16, gain: 0.10 },
    }[surface] || { freq: 300, q: 1, dur: 0.12, gain: 0.12 };
    this.noise({ dur: cfg.dur, gain: cfg.gain * volume, filterType: 'bandpass', freq: cfg.freq, q: cfg.q });
    this.tone({ freq: 80, dur: 0.07, type: 'sine', gain: 0.06 * volume });
  }

  creak() {
    this.tone({ freq: 180, dur: 0.6, type: 'sawtooth', gain: 0.06, glide: 120 });
    this.noise({ dur: 0.5, gain: 0.05, filterType: 'bandpass', freq: 700, q: 4 });
  }

  drawer() {
    this.noise({ dur: 0.35, gain: 0.14, filterType: 'bandpass', freq: 1500, q: 2, sweepTo: 600 });
  }

  coins() {
    [1046, 1318, 1568].forEach((f, i) =>
      setTimeout(() => this.tone({ freq: f, dur: 0.16, type: 'triangle', gain: 0.18 }), i * 55));
  }

  pickup() {
    this.tone({ freq: 620, dur: 0.09, type: 'triangle', gain: 0.12 });
    setTimeout(() => this.tone({ freq: 930, dur: 0.12, type: 'triangle', gain: 0.12 }), 70);
  }

  alarm() {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        this.tone({ freq: 880, dur: 0.22, type: 'square', gain: 0.14 });
        this.tone({ freq: 660, dur: 0.22, type: 'square', gain: 0.1 });
      }, i * 260);
    }
  }

  heartbeat() {
    this.tone({ freq: 62, dur: 0.16, type: 'sine', gain: 0.28 });
    setTimeout(() => this.tone({ freq: 54, dur: 0.2, type: 'sine', gain: 0.2 }), 170);
  }

  whoosh() {
    this.noise({ dur: 0.3, gain: 0.2, filterType: 'bandpass', freq: 300, q: 0.8, sweepTo: 2600 });
  }

  success() {
    [523, 659, 784, 1046].forEach((f, i) =>
      setTimeout(() => this.tone({ freq: f, dur: 0.35, type: 'triangle', gain: 0.16 }), i * 110));
  }

  fail() {
    [440, 370, 294, 220].forEach((f, i) =>
      setTimeout(() => this.tone({ freq: f, dur: 0.3, type: 'sawtooth', gain: 0.1 }), i * 130));
  }

  /* --------------------------- music ---------------------------- */

  startMusic() {
    if (!this.ctx) return;
    // Am - F - C - G loop, sparse and moody
    const chords = [
      [220, 261.63, 329.63],
      [174.61, 220, 261.63],
      [261.63, 329.63, 392],
      [196, 246.94, 293.66],
    ];
    const bass = [55, 43.65, 65.41, 49];
    const tick = () => {
      if (!this.ctx || this.muted) { this.musicTimer = setTimeout(tick, 700); return; }
      const bar = Math.floor(this.step / 8) % chords.length;
      const beat = this.step % 8;
      const chord = chords[bar];
      const t = this.ctx.currentTime;
      const noteLen = 1.9;
      const play = (freq, gain, type = 'sine') => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const filt = this.ctx.createBiquadFilter();
        filt.type = 'lowpass'; filt.frequency.value = 1400;
        osc.type = type; osc.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t + noteLen);
        osc.connect(filt); filt.connect(g); g.connect(this.musicGain);
        osc.start(t); osc.stop(t + noteLen + 0.1);
      };
      if (beat === 0) play(bass[bar], 0.30, 'triangle');
      if (beat === 0 || beat === 3 || beat === 6) {
        const idx = (beat / 3) % 3 | 0;
        play(chord[Math.min(2, idx)], 0.10 + this.intensity * 0.05, 'sine');
      }
      this.step++;
      this.musicTimer = setTimeout(tick, 420);
    };
    tick();
  }
}
