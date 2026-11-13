import * as THREE from 'three';
import { installDom, stubRenderer } from '../tests/harness.mjs';
installDom();
const { Assets } = await import('../src/core/assets.js');
const { CollisionWorld } = await import('../src/systems/collision.js');
const { buildHouse } = await import('../src/world/house.js');
const { buildStreet } = await import('../src/world/street.js');
const { buildShop } = await import('../src/world/shop.js');
const { renderView } = await import('./render.mjs');

const scene = new THREE.Scene();
const assets = new Assets(stubRenderer());
const colliders = new CollisionWorld();
const lights = [];
buildHouse(scene, assets, colliders, lights, {});
buildStreet(scene, assets, colliders, lights, {});
buildShop(scene, assets, colliders, lights, {});
// hide ceilings for the top view
scene.traverse((o) => {
  if (o.isMesh && o.geometry?.type === 'PlaneGeometry') {
    const p = new THREE.Box3().setFromObject(o);
    if (p.max.y > 2.6 && p.max.y < 3.6 && p.min.y > 2.6) o.visible = false;
  }
});
for (const v of [
  { name: 'top-shop', position: [0, 34, 22.01], target: [0, 0, 22], fov: 60, out: 'previews/top-shop.png', width: 700, height: 700 },
  { name: 'top-house', position: [-1, 26, -3.01], target: [-1, 0, -3], fov: 60, out: 'previews/top-house.png', width: 700, height: 700 },
  { name: 'top-street', position: [0, 46, 8.01], target: [0, 0, 8], fov: 70, out: 'previews/top-street.png', width: 700, height: 700 },
]) {
  const r = await renderView(scene, { ...v, ambient: 0.6 });
  console.log(v.name, r.drawn);
}
