/**
 * Headless harness: provides just enough DOM stubs for the procedural
 * textures and HUD so the world/gameplay can be exercised in Node.
 */
import { createCanvas } from './canvas-stub.mjs';
import * as THREE from 'three';

export function installDom() {
  const ctx2d = createCanvas;
  const mkEl = (tag = 'div') => {
    const el = {
      tagName: tag.toUpperCase(), children: [], style: {}, dataset: {},
      classList: { _s: new Set(), add(...c) { c.forEach((x) => this._s.add(x)); }, remove(...c) { c.forEach((x) => this._s.delete(x)); }, toggle(c, on) { if (on === undefined) on = !this._s.has(c); on ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); } },
      getContext: () => ctx2d(),
      getBoundingClientRect: () => ({ width: 390, height: 844, left: 0, top: 0 }),
      appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
      addEventListener() {}, removeEventListener() {}, setPointerCapture() {},
      querySelector(sel) { this._q = this._q || {}; return (this._q[sel] = this._q[sel] || mkEl()); },
      querySelectorAll() { return []; },
      textContent: '', innerHTML: '', width: 128, height: 128,
    };
    return el;
  };
  const els = new Map();
  global.document = {
    createElement: (t) => mkEl(t),
    getElementById: (id) => { if (!els.has(id)) els.set(id, mkEl()); return els.get(id); },
    querySelectorAll: () => [],
    addEventListener() {},
    createElementNS: () => mkEl('canvas'),
    hidden: false,
    body: mkEl('body'),
  };
  global.window = global;
  Object.defineProperty(global, 'navigator', { value: { maxTouchPoints: 0, userAgent: 'node' }, configurable: true });
  global.devicePixelRatio = 2;
  global.innerWidth = 390;
  global.innerHeight = 844;
  global.performance = global.performance || { now: () => Date.now() };
  global.location = { search: '', protocol: 'http:', href: 'http://x/' };
  global.addEventListener = () => {};
  global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
  return els;
}

/** A viewer/renderer stub: three needs a renderer only for capabilities. */
export function stubRenderer() {
  return {
    capabilities: { getMaxAnisotropy: () => 4, isWebGL2: true },
    domElement: { style: {}, addEventListener() {}, requestPointerLock() {} },
    shadowMap: {}, setPixelRatio() {}, setSize() {}, render() {}, setAnimationLoop() {},
    getPixelRatio: () => 1,
    outputColorSpace: THREE.SRGBColorSpace, toneMapping: 0, toneMappingExposure: 1,
  };
}
