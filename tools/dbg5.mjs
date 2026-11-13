import * as THREE from 'three';
import { installDom, stubRenderer } from '../tests/harness.mjs';
import { installNapiCanvas } from './canvas-adapter.mjs';
installDom(); installNapiCanvas();
const { Assets } = await import('../src/core/assets.js');
const a = new Assets(stubRenderer());
const t = a.tex.woodFloor;
const cv = t.image;
const cctx = cv.getContext('2d');
const px = cctx.getImageData(0, 0, 8, 8);
console.log('wood tex pixels', Array.from(px.data.slice(0, 12)));
console.log('size', cv.width, cv.height);
// now clone and check
const clone = t.clone();
const px2 = clone.image.getContext('2d').getImageData(0,0,8,8);
console.log('clone pixels', Array.from(px2.data.slice(0,12)));
// check asset material map identity
console.log('mat map is tex', a.mat.woodFloor.map === t, 'clone?', a.mat.woodFloor.map.image === t.image);
