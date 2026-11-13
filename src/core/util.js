// Small math / random helpers shared across the game.
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const smoothstep = (t) => t * t * (3 - 2 * t);
export const TAU = Math.PI * 2;

/** Deterministic PRNG so the level looks identical on every run. */
export function makeRng(seed = 1) {
  let s = seed >>> 0 || 1;
  return function rng() {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export function shortestAngle(from, to) {
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export function angleLerp(a, b, t) { return a + shortestAngle(a, b) * t; }

/** Cheap value noise for flicker / shake. */
export function noise1(x) {
  const i = Math.floor(x);
  const f = x - i;
  const h = (n) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
  const u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u);
}

export const randRange = (rng, a, b) => a + rng() * (b - a);
export const pick = (rng, arr) => arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))];
