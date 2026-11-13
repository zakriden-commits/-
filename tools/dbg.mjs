import * as THREE from 'three';
import { installDom } from '../tests/harness.mjs';
installDom();
const { renderView } = await import('./render.mjs');
const scene = new THREE.Scene();
const box = new THREE.Mesh(new THREE.BoxGeometry(2,2,2), new THREE.MeshStandardMaterial({ color: 0xff3333 }));
scene.add(box);
const r = await renderView(scene, { position: [0,0,6], target: [0,0,0], fov: 60, width: 240, height: 240, out: '/tmp/box.png' });
console.log(r);
