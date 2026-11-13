/** Renders the key views of the game world to PNG for visual review. */
import * as THREE from 'three';
import { renderView } from './render.mjs';
import { installDom, stubRenderer } from '../tests/harness.mjs';

const { Assets } = await import('../src/core/assets.js');
const { CollisionWorld } = await import('../src/systems/collision.js');
const { buildHouse } = await import('../src/world/house.js');
const { buildStreet } = await import('../src/world/street.js');
const { buildShop } = await import('../src/world/shop.js');
const { NPC, Guard } = await import('../src/systems/ai.js');
const { Humanoid } = await import('../src/core/humanoid.js');

const scene = new THREE.Scene();
const assets = new Assets(stubRenderer());
const colliders = new CollisionWorld();
const lights = [];
const house = buildHouse(scene, assets, colliders, lights, {});
buildStreet(scene, assets, colliders, lights, {});
const shop = buildShop(scene, assets, colliders, lights, {});

// add the NPC cast so people appear in the previews
const cast = [
  new Guard(assets, { seed: 12, route: [[0, 20], [0, 24]], look: { skin: 0xc79068, height: 1.04, shirt: 0x22303f, cap: 0x1b2a38, vest: 0x1e3a5f }, speed: 1 }),
  new NPC(assets, { seed: 41, sitting: true, look: { skin: 0xd7a878, shirt: 0x2f6d8a, apron: 0x1f4d6b, height: 0.98 }, route: [[0, 0]] }),
  new NPC(assets, { seed: 77, look: { skin: 0xe0b48c, shirt: 0x7a4b5a, hair: 0x5a3a22, height: 0.96 }, route: [[0, 0]] }),
];
cast[0].pos.set(-1.6, 0, 20.5); cast[0].yaw = Math.PI * 0.85; cast[0].object.position.copy(cast[0].pos); cast[0].object.rotation.y = cast[0].yaw;
cast[1].pos.set(-6.2, 0, 17.4); cast[1].object.position.copy(cast[1].pos); cast[1].object.rotation.y = Math.PI; cast[1].humanoid.faceYaw(Math.PI);
cast[2].pos.set(1.4, 0, 21.6); cast[2].yaw = -0.5; cast[2].object.position.copy(cast[2].pos); cast[2].object.rotation.y = -0.5;
cast.forEach((n) => { n.humanoid.setPose(n.humanoid.pose); n.humanoid.update(0.016, 0.8, 0, 1); scene.add(n.object); });

const views = [
  { name: '01-title-street', position: [2.5, 2.2, 9.5], target: [-1, 2.6, 16], fov: 62, out: 'previews/01-title-street.png' },
  { name: '02-bedroom-wake', position: [-4.2, 1.1, -4.3], target: [-1.5, 1.2, -7.0], fov: 70, out: 'previews/02-bedroom-wake.png' },
  { name: '03-bedroom-wide', position: [0.6, 1.7, -2.4], target: [-3.5, 1.1, -6.2], fov: 72, out: 'previews/03-bedroom-wide.png' },
  { name: '04-living-room', position: [-1.2, 1.6, 1.2], target: [-5.6, 1.2, -1.4], fov: 72, out: 'previews/04-living-room.png' },
  { name: '05-kitchen', position: [1.1, 1.6, 0.9], target: [3.2, 1.1, -1.8], fov: 72, out: 'previews/05-kitchen.png' },
  { name: '06-shop-front', position: [0.5, 1.7, 10.5], target: [3.0, 2.6, 14], fov: 66, out: 'previews/06-shop-front.png' },
  { name: '07-shop-inside', position: [3.0, 1.65, 15.4], target: [-2.0, 1.4, 22], fov: 74, out: 'previews/07-shop-inside.png' },
  { name: '08-shop-aisle', position: [0.2, 1.65, 19.0], target: [0.0, 1.5, 27], fov: 74, out: 'previews/08-shop-aisle.png' },
  { name: '09-checkout', position: [-3.4, 1.65, 18.6], target: [-6.4, 1.3, 16.6], fov: 70, out: 'previews/09-checkout.png' },
  { name: '10-backroom', position: [0.4, 1.65, 26.2], target: [-5.6, 1.2, 28.2], fov: 74, out: 'previews/10-backroom.png' },
];

const which = process.argv[2];
for (const vw of views) {
  if (which && !vw.name.includes(which)) continue;
  const r = await renderView(scene, { ...vw, width: 540, height: 960, out: `previews/${vw.name}.png` });
  console.log(`${vw.name}: ${r.drawn}/${r.tris} tris drawn`);
}
