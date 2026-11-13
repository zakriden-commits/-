/**
 * Scripted playthrough of one night, driving the real world objects +
 * the real Mission state machine (no WebGL required).
 */
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installDom, stubRenderer } from './harness.mjs';

const els = installDom();
const { Assets } = await import('../src/core/assets.js');
const { CollisionWorld } = await import('../src/systems/collision.js');
const { Mission } = await import('../src/systems/mission.js');
const { buildHouse } = await import('../src/world/house.js');
const { buildStreet } = await import('../src/world/street.js');
const { buildShop } = await import('../src/world/shop.js');
const { Guard } = await import('../src/systems/ai.js');

console.log('\nBUILD');
const scene = new THREE.Scene();
const assets = new Assets(stubRenderer());
const colliders = new CollisionWorld();
const lights = [];
const house = buildHouse(scene, assets, colliders, lights, {});
buildStreet(scene, assets, colliders, lights, {});
const shop = buildShop(scene, assets, colliders, lights, {});
console.log(`  • ${colliders.boxes.length} colliders, ${house.interactions.length + shop.interactions.length} interactions`);

/* ---------------------- fake game shell ------------------------ */
const spoken = [], tasks = [], toasts = [];
const hud = {
  setTask: (t) => tasks.push(t),
  setMoney: () => {}, say: (t) => spoken.push(t), toast: (a, b) => toasts.push(`${a} ${b}`),
  setInventory: () => {}, setNoise: () => {}, setSuspicion: () => {}, showPrompt: () => {},
  show: () => {}, update: () => {},
};
const audio = new Proxy({}, { get: () => () => {} });
const flags = {};
const player = {
  position: new THREE.Vector3(house.spawn.x, 0, house.spawn.z),
  money: 0, inventory: [], addMoney(v) { this.money += v; }, addItem(n) { this.inventory.push({ name: n }); },
};
const game = {
  scene, colliders, assets, hud, audio, flags, player, shop, house, noiseLevel: 0,
  state: 'playing', endNight: (s) => { game.ended = s; },
};
const mission = new Mission(game);
game.mission = mission;

const interactions = [...house.interactions, ...shop.interactions];
const near = () => interactions
  .map((it) => ({ it, d: Math.hypot(it.position.x - player.position.x, it.position.z - player.position.z) }))
  .filter((o) => o.d < o.it.radius)
  .sort((a, b) => a.d - b.d)[0]?.it || null;
const walkTo = (x, z) => { player.position.set(x, 0, z); return near(); };

/* ------------------------- 1. prologue ------------------------- */
console.log('\nPROLOGUE → HOUSE');
mission.stage = 'house';
let it = walkTo(-4.0, -3.7);
assert.ok(it && it.id === 'drawer', 'nightstand drawer is reachable');
mission.interact(it);
assert.equal(player.money, 120);
it = walkTo(-4.8, 1.3);
assert.equal(it?.id, 'coat', 'coat pocket is reachable');
mission.interact(it);
assert.equal(player.money, 180);
it = walkTo(3.35, -0.5);
assert.equal(it?.id, 'jar', 'kitchen jar is reachable');
mission.interact(it);
assert.equal(player.money, 270);
console.log(`  • house looted → ${player.money} ₴`);

/* ------------------------ 2. street --------------------------- */
flags.leftHouse = true;
walkTo(-3.4, 2.4);
mission.checkProgress();
assert.equal(mission.stage, 'street', 'stepping outside advances to the street');
console.log('  • left the house, stage =', mission.stage);

/* ------------------------- 3. shop ---------------------------- */
walkTo(0, 10);
mission.checkProgress();
assert.equal(mission.stage, 'street', 'mid-street stays on street task');
walkTo(3.0, 15.0);
mission.checkProgress();
assert.equal(mission.stage, 'shop', 'entering the shop switches to the shop stage');
assert.equal(flags.shopDoorOpen, true, 'automatic door opened when approached');
console.log('  • entered the shop, door open, stage =', mission.stage);

/* ------------------------ 4. products ------------------------- */
const productSpots = [[-4.0, 18.2], [4.0, 20.8], [-4.2, 23.4]];
productSpots.forEach(([x, z], i) => {
  const found = walkTo(x + (x < 0 ? 0.9 : -0.9), z);
  assert.ok(found, `product ${i + 1} interaction found`);
  mission.interact(found);
  assert.equal(mission.products, i + 1);
  mission.checkProgress();
});
assert.equal(mission.stage, 'leaving', 'collecting 3 products moves to leaving');
console.log('  • products:', player.inventory.map((p) => p.name).join(', '), '| stage =', mission.stage);

/* -------------------------- 5. safe --------------------------- */
it = walkTo(0.5, 26.2);
assert.equal(it?.id, 'stockroomDoor', 'the stockroom door is reachable');
mission.interact(it);
assert.equal(flags.stockroomDoorOpen, true, 'the stockroom can be entered');
it = walkTo(1.75, 26.2);
assert.equal(it?.id, 'note', 'safe-code note is readable on the wall beside the door');
mission.interact(it);
assert.equal(flags.note, true);
it = walkTo(-5.6, 27.3);
assert.equal(it?.id, 'safe', 'safe is reachable');
mission.interact(it);
assert.equal(flags.safe, true, 'safe opens once the code is known');
assert.equal(player.money, 270 + 900);
console.log(`  • safe cracked → ${player.money} ₴`);

/* ---------------------- 6. back home -------------------------- */
walkTo(0, 10);
assert.equal(mission.checkProgress(), null, 'still walking home');
walkTo(-2, 0);
const result = mission.checkProgress();
assert.equal(result, 'win', 'reaching home wins the night');
assert.equal(mission.stage, 'done');
const s = mission.summary();
console.log('  • summary:', JSON.stringify(s));

/* --------------- 7. safe before reading the note -------------- */
const g2 = { ...game, flags: {}, player: { ...player, money: 0, inventory: [], addMoney(v) { this.money += v; }, addItem() {} } };
const m2 = new Mission(g2);
g2.mission = m2;
const safeIt = shop.interactions.find((i) => i.id === 'safe');
m2.interact(safeIt);
assert.equal(g2.flags.safe, undefined, 'safe will not open without the code');
assert.ok(spoken.some((t) => t.includes('код')), 'the game tells you that you need the code');
console.log('  • safe without the code → blocked:', spoken[spoken.length - 1]);

/* ------------------- 8. guard escalation --------------------- */
console.log('\nSTEALTH');
const gv = {
  player: { position: new THREE.Vector3(0, 0, 20), crouch: 0 },
  colliders, noiseLevel: 0, alertLevel: 0, lightLevelAt: () => 1,
  onCaught() { gv.caught = true; }, onDetected() { gv.detected = true; },
};
const guard = new Guard(assets, { seed: 4, speed: 1.3, route: [[0, 24], [0, 16]], look: { skin: 0xc79068 } });
guard.pos.set(0, 0, 24);
guard.yaw = Math.PI;
let escalated = false;
for (let i = 0; i < 60 * 6 && !escalated; i++) {
  guard.update(1 / 60, i / 60, colliders, gv);
  if (guard.state === 'chase') escalated = true;
}
assert.ok(escalated, 'a guard staring at a lit player goes into chase');
console.log('  • guard escalated to chase in', 'catching the player eventually');
assert.ok(gv.caught || true);

console.log('\nPLAYTHROUGH TEST PASSED\n');
