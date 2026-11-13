import assert from 'node:assert/strict';
import { sampleWakePose, WAKE_DURATION } from '../src/systems/wake.js';

const asleep = sampleWakePose(0, 1.1, 0.8);
const eyesOpen = sampleWakePose(2.15, 1.1, 0.8);
const seated = sampleWakePose(5.0, 1.1, 0.8);
const standing = sampleWakePose(WAKE_DURATION, 1.1, 0.8);

assert.equal(asleep.fade, 1, 'wake begins with eyes fully closed');
assert.equal(asleep.stepOffBed, 0, 'player starts in bed');
assert.equal(asleep.handsVisible, false, 'hands stay out of view while lying down');
assert.equal(eyesOpen.fade, 0, 'eyes open before the player stands');
assert.ok(eyesOpen.fov > asleep.fov, 'the view widens as focus returns');
assert.ok(seated.eyeHeight > asleep.eyeHeight, 'the player sits up');
assert.ok(standing.stepOffBed > seated.stepOffBed, 'the player moves off the bed');
assert.equal(standing.stepOffBed, 1, 'the player reaches the standing spawn');
assert.ok(Math.abs(standing.eyeHeight - 1.62) < 1e-9, 'standing eye height is normal');
assert.equal(standing.frozen, false, 'control is returned at the end');
assert.equal(standing.handsVisible, true, 'hands appear only after sitting up');

console.log('\nWAKE-UP ANIMATION TEST PASSED\n');
