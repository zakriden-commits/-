import * as THREE from 'three';
import { installDom } from '../tests/harness.mjs';
installDom();
const { renderView } = await import('./render.mjs');
const scene = new THREE.Scene();
scene.add(new THREE.Mesh(new THREE.PlaneGeometry(20,20), new THREE.MeshStandardMaterial({ color: 0x22ff88 })));
const box = new THREE.Mesh(new THREE.BoxGeometry(2,2,2), new THREE.MeshStandardMaterial({ color: 0xff3333 }));
box.position.set(0, 1, 0);
scene.add(box);
// log the world bounds of everything
scene.updateMatrixWorld(true);
scene.traverse(o => { if (o.isMesh) { const b = new THREE.Box3().setFromObject(o); console.log('mesh', o.geometry.type, b.min.toArray().map(v=>v.toFixed(1)), b.max.toArray().map(v=>v.toFixed(1))); } });
const r = await renderView(scene, { position: [0,3,8], target: [0,0,0], fov: 60, width: 300, height: 300, out: '/tmp/floor.png' });
console.log(r);
