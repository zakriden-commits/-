import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installDom, stubRenderer } from './harness.mjs';

installDom();
const { Assets } = await import('../src/core/assets.js');
const { CollisionWorld } = await import('../src/systems/collision.js');
const { buildHouse } = await import('../src/world/house.js');
const { buildStreet } = await import('../src/world/street.js');
const { buildShop } = await import('../src/world/shop.js');
const { Guard, NPC } = await import('../src/systems/ai.js');
const { Player } = await import('../src/systems/player.js');

const log = (...a) => console.log('  •', ...a);
console.log('\nWORLD BUILD');
const renderer = stubRenderer();
const assets = new Assets(renderer);
const scene = new THREE.Scene();
const colliders = new CollisionWorld();
const lights = [];

const house = buildHouse(scene, assets, colliders, lights, {});
const street = buildStreet(scene, assets, colliders, lights, {});
const shop = buildShop(scene, assets, colliders, lights, {});

let meshes = 0, tris = 0;
scene.traverse((o) => {
  if (o.isMesh) {
    meshes++;
    const g = o.geometry;
    if (g?.index) tris += g.index.count / 3;
    else if (g?.attributes?.position) tris += g.attributes.position.count / 3;
  }
});
log(`meshes: ${meshes}`);
log(`triangles: ${Math.round(tris).toLocaleString('ru-RU')}`);
log(`colliders: ${colliders.boxes.length}`);
log(`interactions: ${house.interactions.length + shop.interactions.length}`);
log(`point lights: ${lights.length}`);
assert.ok(meshes > 200, 'scene should be rich');
assert.ok(colliders.boxes.length > 40, 'walls should collide');

console.log('\nCOLLISION');
// bedroom must be enclosed: cannot leave the house through walls
let escapes = 0;
for (let a = 0; a < 64; a++) {
  const ang = (a / 64) * Math.PI * 2;
  const p = colliders.resolve(-1 + Math.cos(ang) * 30, -3 + Math.sin(ang) * 30, 0.3);
  // outside of any interior => we simply assert resolve never returns NaN
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z));
}
log('resolve stable in 64 directions, no NaN');
// the doorway at x=1.2,z=-2 must be passable
const doorRes = colliders.resolve(1.2, -2.0, 0.3);
assert.ok(Math.abs(doorRes.z + 2) < 0.4, 'doorway should be free');
log('bedroom doorway is open');

// Regression: the entire route from the actual wake spawn, through the
// bedroom doorway and kitchen opening, into the living room must stay clear.
const exitRoute = [
  [house.spawn.x, house.spawn.z], [1.2, -2.8], [1.2, -1.3],
  [1.2, -0.05], [1.2, 0.4], [0.0, 0.4], [-1.0, 0.4],
];
const assertExitRouteClear = () => {
  for (let segment = 0; segment < exitRoute.length - 1; segment++) {
    const [x0, z0] = exitRoute[segment];
    const [x1, z1] = exitRoute[segment + 1];
    const steps = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.05);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t;
      const z = z0 + (z1 - z0) * t;
      assert.equal(colliders.circleHits(x, z, 0.3), null, `house exit route blocked at ${x.toFixed(2)}, ${z.toFixed(2)}`);
    }
  }
};
assertExitRouteClear();
assert.ok(house.fridgeCollider.minX > 3, 'fridge is kept against the kitchen wall');
assert.ok(house.shelfCollider.maxX < 0, 'bookcase is moved away from the doorway');
log('bedroom → kitchen opening → living room route is clear');

const drawerAction = house.interactions.find((it) => it.id === 'drawer');
const drawerFlags = {};
const originalDrawerMaxX = house.nightstandCollider.maxX;
const originalDrawerMaxZ = house.nightstandCollider.maxZ;
drawerAction.onUse({ flags: drawerFlags, audio: { drawer() {}, coins() {} } });
assert.equal(drawerFlags.drawer, true, 'the starter drawer opens');
assert.equal(house.nightstandCollider.maxX, originalDrawerMaxX + 0.26, 'the opened drawer collider follows its world X travel');
assert.equal(house.nightstandCollider.maxZ, originalDrawerMaxZ, 'opening the drawer does not create a false wall in world Z');
assertExitRouteClear();
log('collecting the starter cash keeps the doorway route clear');

console.log('\nSIGHT / STEALTH');
const game = {
  colliders,
  player: { position: new THREE.Vector3(0, 0, 20), crouch: 0 },
  noiseLevel: 0,
  alertLevel: 0,
  lightLevelAt: () => 1,
  onCaught() {}, onDetected() {},
};
const g = new Guard(assets, {
  seed: 3, route: [[-5, 24], [-5, 16]], speed: 1,
  look: { skin: 0xc79068, height: 1 },
});
// yaw = atan2(dx, dz): 0 faces +z, PI faces -z. Stand in the central aisle.
function visAt(x, z, yaw, crouch = 0) {
  g.pos.set(0, 0, 24); g.yaw = yaw; game.player.position.set(x, 0, z); game.player.crouch = crouch;
  return g.visibility(game);
}
const front = visAt(0, 20, Math.PI);
const back = visAt(0, 28, Math.PI);
const far = visAt(0, 13.2, Math.PI);
const crouched = visAt(0, 20, Math.PI, 1);
const throughShelf = visAt(-4.8, 20.8, Math.PI);
log(`in front: ${front.toFixed(2)} | behind: ${back.toFixed(2)} | too far: ${far.toFixed(2)} | crouched front: ${crouched.toFixed(2)}`);
assert.ok(front > 0.2, 'guard sees a player in front of him');
assert.equal(back, 0, 'guard cannot see behind himself');
assert.equal(far, 0, 'guard cannot see beyond range');
assert.ok(crouched < front, 'crouching reduces visibility');
assert.equal(throughShelf, 0, 'shelves block line of sight');

// wall blocking
game.player.position.set(-7.6, 0, 28); // behind the back room partition
g.pos.set(0, 0, 25); g.yaw = 0;
g.pos.set(0, 0, 25); g.yaw = 0;
const wallVis = g.visibility({ ...game, player: { position: new THREE.Vector3(0, 0, 29), crouch: 0 } });
log('sight through the closed back-room door:', wallVis.toFixed(2));
assert.equal(wallVis, 0, 'the closed back-room door blocks sight');
const stockroomDoor = shop.interactions.find((it) => it.id === 'stockroomDoor');
assert.ok(shop.backDoorCollider.active, 'stockroom door starts closed and solid');
const doorFlags = {};
stockroomDoor.onUse({ flags: doorFlags, audio: { creak() {} } });
assert.equal(doorFlags.stockroomDoorOpen, true, 'the stockroom door can be opened');
assert.equal(shop.backDoorCollider.active, false, 'opening the door clears its collider');
assert.equal(colliders.lineBlocked(0, 25, 0, 29), false, 'open stockroom door leaves a real passage');
shop.resetDoors();
assert.equal(shop.backDoorCollider.active, false, 'front-shop door timing does not trap the player in the stockroom');
log('stockroom door opens and its passage remains traversable');

console.log('\nPLAYER MOVEMENT');
const cam = new THREE.PerspectiveCamera(72, 0.5, 0.06, 200);
const player = new Player(assets, cam, colliders);
player.teleport(-10, -10, 0);
const inputStub = {
  move: { x: 0, y: 1 }, sneak: false, run: false,
  sample() { return this.move; }, consumeLook() { return { dx: 0, dy: 0 }; },
  consumeInteract() { return false; }, consumePause() { return false; },
};
const startZ = player.position.z;
for (let i = 0; i < 60; i++) player.update(1 / 60, inputStub, {});
// yaw = 0 => forward is -Z, and move.y = 1 must move toward -Z.
const walked = startZ - player.position.z;
log(`forward walked ${walked.toFixed(2)} m in 1s (speed ${Math.hypot(player.velocity.x, player.velocity.z).toFixed(2)} m/s)`);
assert.ok(walked > 1.5, 'forward input moves toward -Z when yaw is zero');
const walkSpeed = walked;
// crouch reduces speed
player.teleport(-10, -10, 0);
const c0 = player.position.z;
inputStub.sneak = true;
for (let i = 0; i < 60; i++) player.update(1 / 60, inputStub, { forceSneak: true });
const crouchDist = Math.abs(c0 - player.position.z);
log(`crouch-walked ${crouchDist.toFixed(2)} m in 1s`);
assert.ok(crouchDist < walkSpeed, 'crouching is slower');

// The real wake camera faces the bedroom exit; holding forward must walk
// through that doorway instead of into the bed/wall behind the player.
inputStub.sneak = false;
inputStub.move = { x: 0, y: 1 };
const doorYaw = Math.atan2(
  -(house.bedroomDoorway.x - house.spawn.x),
  -(house.bedroomDoorway.z - house.spawn.z),
);
player.teleport(house.spawn.x, house.spawn.z, doorYaw);
for (let i = 0; i < 150; i++) player.update(1 / 60, inputStub, {});
assert.ok(player.position.x > house.spawn.x + 4.5, 'forward movement follows the wake camera toward the bedroom exit');
assert.ok(player.position.z > house.spawn.z + 2.2, 'the player clears the doorway instead of hitting an invisible wall');
log(`woke and walked through the bedroom exit to (${player.position.x.toFixed(2)}, ${player.position.z.toFixed(2)})`);

console.log('\nNPC ANIMATION');
const npc = new NPC(assets, { seed: 5, route: [[0, 0], [0, 3]], look: { skin: 0xc79068, height: 1 } });
for (let i = 0; i < 120; i++) npc.update(1 / 60, i / 60, colliders, game);
log(`patrol moved to z=${npc.pos.z.toFixed(2)}, state=${npc.state}`);
assert.ok(npc.pos.z > 1.2, 'patrol walks along its route');

console.log('\nALL WORLD TESTS PASSED\n');
