import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installDom, stubRenderer } from './harness.mjs';

installDom();
const { Assets } = await import('../src/core/assets.js');
const { CollisionWorld } = await import('../src/systems/collision.js');
const { Player } = await import('../src/systems/player.js');
const { Guard, NPC_STATE } = await import('../src/systems/ai.js');
const { Mission } = await import('../src/systems/mission.js');
const { DIFFICULTIES, getDifficulty } = await import('../src/systems/difficulty.js');
const { buildHouse } = await import('../src/world/house.js');
const { buildShop } = await import('../src/world/shop.js');

const assets = new Assets(stubRenderer());
const scene = new THREE.Scene();
const colliders = new CollisionWorld();
const lights = [];
const house = buildHouse(scene, assets, colliders, lights, {});
const shop = buildShop(scene, assets, colliders, lights, {});
const camera = new THREE.PerspectiveCamera(72, 390 / 844, 0.06, 200);
const player = new Player(assets, camera, colliders);

console.log('\nFEATURES');

// Distinct difficulty presets must affect guard, camera, patrol, police and stamina tuning.
assert.deepEqual(Object.keys(DIFFICULTIES), ['easy', 'medium', 'hard']);
assert.equal(getDifficulty('unknown').id, 'medium');
assert.ok(DIFFICULTIES.easy.guardSight < DIFFICULTIES.medium.guardSight);
assert.ok(DIFFICULTIES.hard.guardSight > DIFFICULTIES.medium.guardSight);
assert.ok(DIFFICULTIES.hard.staminaDrain > DIFFICULTIES.easy.staminaDrain);
console.log('  • Easy / Medium / Hard presets have distinct stealth and stamina tuning');

// Sprinting drains the stamina meter; exhaustion lowers pace and recovery restores it.
const input = {
  move: { x: 0, y: 1 }, sneak: false, run: true,
  sample() { return this.move; },
};
player.teleport(-20, -20, 0);
for (let i = 0; i < 300; i++) player.update(1 / 60, input, { difficulty: DIFFICULTIES.medium });
assert.ok(player.stamina < 12, 'sprinting spends stamina');
assert.equal(player.isSprinting, false, 'an exhausted player cannot keep sprinting');
assert.ok(player.speed < 3, 'exhaustion reduces movement speed');
const exhaustedSpeed = player.speed;
input.run = false;
for (let i = 0; i < 150; i++) player.update(1 / 60, input, { difficulty: DIFFICULTIES.medium });
assert.ok(player.stamina > 45, 'stamina recovers while walking');
assert.ok(player.speed > exhaustedSpeed, 'pace returns as stamina recovers');
assert.ok(player.hands.group.userData.left && player.hands.group.userData.right, 'both first-person arms are articulated');
console.log('  • sprint drains stamina, exhaustion slows the player, and rest restores speed');

// Product meshes belong to the shelf rows, sit at shelf height, and have aisle-side interactions.
const placedProducts = new Map();
for (const shelf of shop.shelves) shelf.unit.traverse((obj) => {
  if (obj.isMesh && obj.userData.productName) placedProducts.set(obj.userData.productName, { obj, shelf });
});
assert.equal(placedProducts.size, 5, 'all five named shop products are visible shelf objects');
for (const name of ['хлеб', 'молоко', 'чай', 'печенье', 'консервы']) {
  const { obj, shelf } = placedProducts.get(name);
  assert.equal(obj.parent, shelf.unit, `${name} is attached to its shelf, not floating in the aisle`);
  assert.ok(obj.position.y > 0.2 && obj.position.y < 1.7, `${name} rests on a shelf level`);
  assert.ok(shelf.unit.children.some((child) => child.isMesh && child.material?.map), `${name} shelf has a visible product label`);
  const marker = shop.group.children.find((child) => child.userData.productMarkerFor === name);
  assert.ok(marker?.visible, `${name} has a visible, name-addressable pickup marker`);
  assert.equal(marker.parent, shop.group, `${name} marker sits in the open aisle rather than behind its package`);
  assert.ok(marker.position.y < 0.05, `${name} marker is placed on the floor`);
}
for (const id of ['product0', 'product1', 'product2', 'product3', 'product4']) {
  const interaction = shop.interactions.find((item) => item.id === id);
  assert.ok(interaction && interaction.radius >= 1.3, `${id} is reachable from the aisle`);
}
console.log('  • five labeled products are attached to shelf geometry with accessible pickup points');

const spoken = [];
const hud = {
  setTask() {}, setMoney() {}, setInventory() {}, setNoise() {}, setSuspicion() {},
  showPrompt() {}, show() {}, update() {}, say(text) { spoken.push(text); }, toast() {},
};
const audio = new Proxy({}, { get: () => () => {} });
const flags = {};
const game = {
  scene, colliders, assets, hud, audio, flags, player, house, shop, time: 0, noiseLevel: 0,
  state: 'playing', openStorage() { this.storageOpened = true; },
  enterHide() { this.player.hidden = true; this.player.frozen = true; },
  exitHide() { this.player.hidden = false; this.player.frozen = false; },
  canExitHide() { return this.hideSafe !== false; },
};
const mission = new Mission(game);
game.mission = mission;

// The front door has a reversible open/close interaction, and a hide is blocked while it is open.
const door = house.interactions.find((item) => item.id === 'frontDoor');
mission.interact(door);
assert.equal(flags.houseDoorOpen, true);
assert.equal(house.doorCollider.active, false);
const hide = house.hideInteraction;
mission.interact(hide);
assert.equal(player.hidden, false, 'an open front door prevents a successful hide');
assert.ok(spoken.at(-1).includes('закрой входную дверь'));
mission.interact(door);
assert.equal(flags.houseDoorOpen, false);
assert.equal(house.doorCollider.active, true, 'closing the door restores its collider');
assert.equal(door.label, 'Открыть входную дверь', 'a closed exterior door remains reopenable');
mission.interact(hide);
assert.equal(player.hidden, true, 'the player can hide with the door shut');
game.hideSafe = false;
mission.interact(hide);
assert.equal(player.hidden, true, 'a pursuer nearby prevents leaving the hiding place');
game.hideSafe = true;
mission.interact(hide);
assert.equal(player.hidden, false, 'the player can leave once the search ends');
assert.deepEqual(house.wardrobeDoors.map((doorPart) => doorPart.rotation.y), [0, 0]);
console.log('  • door closes solidly; hiding waits for nearby pursuers to leave');

// Collecting a shelf product removes its package, shelf label, and gold marker.
mission.stage = 'shop';
const bread = shop.interactions.find((item) => item.id === 'product0');
const breadMarker = shop.group.children.find((child) => child.userData.productMarkerFor === 'хлеб');
assert.equal(breadMarker.visible, true);
const pickupResult = mission.interact(bread);
assert.equal(pickupResult.pickup, true);
assert.equal(placedProducts.get('хлеб').obj.visible, false);
assert.equal(breadMarker.visible, false, 'the floor marker disappears with its picked-up product');
assert.equal(player.inventory.at(-1).name, 'хлеб');
assert.equal(mission.products, 1);
player.inventory.length = 0;
mission.products = 0;
delete flags.p0;
console.log('  • product pickup adds the item and clears its shelf marker');

// The home chest opens the storage flow, and backpack items can be moved both ways.
const storage = house.interactions.find((item) => item.id === 'storage');
mission.interact(storage);
assert.equal(game.storageOpened, true, 'the storage interaction opens the inventory screen');
assert.equal(player.addItem('Хак-планшет', 0, 'tool'), true);
assert.equal(player.addItem('Хлеб', 35, 'product'), true);
assert.equal(player.hasItem('Хак-планшет'), true);
assert.equal(player.storeItem(0).name, 'Хак-планшет');
assert.equal(player.hasItem('Хак-планшет'), false);
assert.equal(player.retrieveItem(0).name, 'Хак-планшет');
assert.equal(player.hasItem('Хак-планшет'), true);
console.log('  • backpack and home storage support depositing and retrieving typed items');
player.inventory.length = 0;
player.storage.length = 0;

// A tablet disables cameras temporarily and can substitute for the safe code.
const safe = shop.interactions.find((item) => item.id === 'safe');
mission.interact(safe);
assert.equal(flags.safe, undefined, 'the safe remains locked without a code or tools');
const stockroomDoor = shop.interactions.find((item) => item.id === 'stockroomDoor');
mission.interact(stockroomDoor);
const tablet = shop.interactions.find((item) => item.id === 'hackTablet');
mission.interact(tablet);
assert.equal(player.hasItem('Хак-планшет'), true);
const cameraConsole = shop.interactions.find((item) => item.id === 'cameraConsole');
mission.interact(cameraConsole);
assert.equal(flags.camerasDisabledUntil, 45, 'the camera hack runs for 45 game seconds');
mission.interact(safe);
assert.equal(flags.safe, true, 'the hacking tool can bypass the safe lock');
assert.equal(player.money, 900);
console.log('  • stockroom tools hack the camera system and open the safe');

// Returning home is only a win after the door is closed, hiding has ended, and pursuers are gone.
mission.stage = 'returnHome';
game.flags = { houseDoorOpen: true, shopDoorOpen: false };
game.player.hidden = false;
game.player.teleport(-3.4, -1.0, 0);
game.guards = [{ state: NPC_STATE.PATROL }];
assert.equal(mission.checkProgress(), null, 'an open front door blocks the return-home win');
assert.equal(mission.stage, 'returnHome');
game.flags.houseDoorOpen = false;
game.player.hidden = true;
assert.equal(mission.checkProgress(), null, 'the player must leave the hiding place before completing');
game.player.hidden = false;
game.guards[0].state = NPC_STATE.CHASE;
assert.equal(mission.checkProgress(), null, 'a chase must not reach the safe-home ending');
game.guards[0].state = NPC_STATE.SEARCH;
assert.equal(mission.checkProgress(), null, 'an active search must not reach the safe-home ending');
game.guards[0].state = NPC_STATE.PATROL;
assert.equal(mission.checkProgress(), 'win');
assert.equal(mission.stage, 'done');
console.log('  • return-home win waits for a shut door, no hiding, and no active search or chase');

// A pursuer who loses sight after a successful hide searches instead of catching the player.
const chaseGame = {
  player: {
    position: new THREE.Vector3(2.6, 0, -6), hidden: true,
    lastSeenPosition: new THREE.Vector3(2.6, 0, -6), crouch: 0,
  },
  colliders, noiseLevel: 0, alertLevel: 0, difficulty: DIFFICULTIES.easy,
  lightLevelAt: () => 1, caught: false,
  onCaught() { this.caught = true; }, onDetected() {},
};
const guard = new Guard(assets, { seed: 53, route: [[2, -3], [2, 2]], speed: 1.2 });
guard.state = NPC_STATE.CHASE;
guard.pos.set(2.6, 0, -4.5);
guard.alertTimer = 6;
guard.update(1 / 60, 0, colliders, chaseGame);
assert.equal(guard.state, NPC_STATE.SEARCH);
assert.equal(chaseGame.caught, false, 'hidden player cannot be caught during the search transition');
assert.equal(guard.visibility(chaseGame), 0);
console.log('  • a hidden player breaks line of sight and turns a chase into a search');

console.log('\nFEATURE TESTS PASSED\n');
