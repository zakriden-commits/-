import * as THREE from 'three';
import { installDom, stubRenderer } from '../tests/harness.mjs';
import { installNapiCanvas } from './canvas-adapter.mjs';
installDom(); installNapiCanvas();
const { Assets } = await import('../src/core/assets.js');
const { CollisionWorld } = await import('../src/systems/collision.js');
const { buildHouse } = await import('../src/world/house.js');
const scene = new THREE.Scene();
const assets = new Assets(stubRenderer());
const c = new CollisionWorld(); const L = [];
buildHouse(scene, assets, c, L, {});
scene.updateMatrixWorld(true);
const rays = [];
scene.traverse((o) => {
  if (!o.isMesh) return;
  const b = new THREE.Box3().setFromObject(o);
  if (b.min.y > -0.2 && b.max.y < 0.2 && b.max.x > -3 && b.min.x < -3) {
    rays.push({ type: o.geometry.type, mat: o.material.type, color: o.material.color?.getHexString(), hasMap: !!o.material.map,
      mapSize: o.material.map ? [o.material.image?.width, o.material.image?.height] : null,
      repeat: o.material.map ? [o.material.map.repeat.x, o.material.map.repeat.y] : null,
      b: [b.min.toArray().map(v=>+v.toFixed(2)), b.max.toArray().map(v=>+v.toFixed(2))] });
  }
});
console.log(JSON.stringify(rays, null, 1).slice(0, 2000));
