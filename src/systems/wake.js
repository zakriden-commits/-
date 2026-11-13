import { clamp } from '../core/util.js';

export const WAKE_DURATION = 8.4;

const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const mix = (a, b, t) => a + (b - a) * t;

/**
 * A deterministic first-person wake-up shot. Time is advanced by the game
 * loop (not timers), so pausing the game also pauses the animation.
 */
export function sampleWakePose(time, startYaw = 0, endYaw = startYaw) {
  const t = clamp(time, 0, WAKE_DURATION);
  const eyesOpen = smooth(1.05, 2.15, t);
  const focus = smooth(2.0, 3.8, t);
  const sitUp = smooth(3.55, 5.35, t);
  const standUp = smooth(5.45, 7.45, t);
  const settle = smooth(7.25, 8.25, t);
  const yawDelta = Math.atan2(Math.sin(endYaw - startYaw), Math.cos(endYaw - startYaw));
  const scan = Math.sin(Math.PI * smooth(2.0, 4.1, t)) * 0.12;
  const breathing = Math.sin(t * 2.1) * 0.012 * (1 - smooth(1.1, 4.0, t));

  return {
    time: t,
    // Eyes start fully closed, then open while the view slowly focuses.
    fade: 1 - eyesOpen,
    fov: mix(52, 72, smooth(1.3, 3.8, t)),
    eyeHeight: 1.01 + 0.17 * sitUp + 0.44 * standUp + breathing,
    pitch: mix(0.42, -0.065, focus) + Math.sin(t * 1.7) * 0.018 * (1 - standUp),
    yaw: startYaw + yawDelta * sitUp + scan * (1 - standUp),
    roll: Math.sin(t * 1.8) * 0.026 * (1 - focus) + Math.sin(t * 1.2) * 0.012 * (1 - settle),
    stepOffBed: standUp,
    handsVisible: t >= 5.55,
    frozen: t < WAKE_DURATION,
  };
}
