import * as THREE from 'three';
import { box, mesh, rbox } from '../core/props.js';
import { makeRng, randRange } from '../core/util.js';

/**
 * Structural helpers: floors, walls with door/window openings, trims,
 * baseboards. Openings are cut by building wall segments around them,
 * which keeps collision simple (one box per solid segment).
 */

export function floorPatch(scene, assets, mat, x0, x1, z0, z1, y = 0, uvScale = null) {
  const w = x1 - x0, d = z1 - z0;
  const g = new THREE.PlaneGeometry(w, d);
  const m = mat.clone();
  m.map = mat.map ? mat.map.clone() : null;
  if (m.map) {
    m.map.needsUpdate = true;
    m.map.wrapS = m.map.wrapT = THREE.RepeatWrapping;
    const s = uvScale || 0.35;
    m.map.repeat.set(w * s, d * s);
  }
  const tile = new THREE.Mesh(g, m);
  tile.rotation.x = -Math.PI / 2;
  tile.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
  tile.receiveShadow = true;
  scene.add(tile);
  return tile;
}

export function ceilingPatch(scene, mat, x0, x1, z0, z1, y) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), mat);
  m.rotation.x = Math.PI / 2;
  m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
  m.receiveShadow = true;
  scene.add(m);
  return m;
}

/**
 * Build a wall along X (constant z) or along Z (constant x).
 * @param opts.gaps [{ at, width, type: 'door'|'window', sill, height }]
 */
export function wall(scene, colliders, assets, {
  axis = 'x', fixed, from, to, y0 = 0, height = 2.7, thickness = 0.2,
  mat = assets.mat.wallpaper, gaps = [], tag = 'wall', uvScale = 0.5, skirting = true,
}) {
  const len = to - from;
  const group = new THREE.Group();
  const segments = []; // {a, b, y0, y1}
  let cursor = from;
  const sorted = [...gaps].sort((a, b) => a.at - b.at);
  for (const g of sorted) {
    const gs = g.at - g.width / 2, ge = g.at + g.width / 2;
    if (gs > cursor) segments.push({ a: cursor, b: gs, y0, y1: y0 + height });
    // header above the opening
    const top = g.type === 'window' ? g.sill + (g.height || 1.2) : (g.height || 2.05) + y0;
    if (top < y0 + height - 0.001) segments.push({ a: gs, b: ge, y0: top, y1: y0 + height });
    if (g.type === 'window') segments.push({ a: gs, b: ge, y0: y0, y1: y0 + (g.sill || 0.9) });
    cursor = ge;
  }
  if (cursor < to) segments.push({ a: cursor, b: to, y0, y1: y0 + height });

  const m = mat.clone();
  if (m.map) {
    m.map = m.map.clone();
    m.map.wrapS = m.map.wrapT = THREE.RepeatWrapping;
    m.map.needsUpdate = true;
  }

  for (const s of segments) {
    const w = s.b - s.a;
    if (w <= 0.001) continue;
    const h = s.y1 - s.y0;
    const geo = box(w, h, thickness);
    const piece = new THREE.Mesh(geo, m);
    const cy = (s.y0 + s.y1) / 2;
    const cx = (s.a + s.b) / 2;
    if (axis === 'x') {
      piece.position.set(cx, cy, fixed);
      if (m.map) { /* texture repeats handled by clone scale */ }
    } else {
      piece.position.set(fixed, cy, cx);
      piece.rotation.y = Math.PI / 2;
    }
    piece.castShadow = true; piece.receiveShadow = true;
    if (m.map) {
      const uv = piece.geometry.attributes.uv;
      // scale UVs to world size so stripes keep a consistent density
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w * uvScale + s.a * uvScale * 0.0, uv.getY(i) * h * uvScale);
      uv.needsUpdate = true;
    }
    group.add(piece);
    // The player collider is horizontal (X/Z), so never register a door
    // lintel as a floor-height blocker. Window sills start at y=0 and remain
    // solid; door headers start above a standing player's head and are visual
    // only for collision purposes.
    if (s.y0 < 1.8) {
      if (axis === 'x') {
        colliders.addBounds(s.a, s.b, fixed - thickness / 2, fixed + thickness / 2, tag);
      } else {
        colliders.addBounds(fixed - thickness / 2, fixed + thickness / 2, s.a, s.b, tag);
      }
    }
  }

  // Skirting follows the wall faces but leaves real gaps at doorways.
  if (skirting) {
    const skirtMat = assets.mat.woodWarm;
    const spans = [];
    let start = from;
    for (const door of sorted.filter((g) => g.type === 'door')) {
      const a = Math.max(from, door.at - door.width / 2);
      const b = Math.min(to, door.at + door.width / 2);
      if (a > start) spans.push([start, a]);
      start = Math.max(start, b);
    }
    if (start < to) spans.push([start, to]);
    for (const side of [-1, 1]) for (const [a, b] of spans) {
      const width = b - a;
      if (width <= 0.001) continue;
      const strip = new THREE.Mesh(box(width, 0.1, 0.03), skirtMat);
      if (axis === 'x') {
        strip.position.set((a + b) / 2, y0 + 0.05, fixed + side * (thickness / 2 + 0.015));
      } else {
        strip.position.set(fixed + side * (thickness / 2 + 0.015), y0 + 0.05, (a + b) / 2);
        strip.rotation.y = Math.PI / 2;
      }
      strip.receiveShadow = true;
      group.add(strip);
    }
  }

  scene.add(group);
  return group;
}

/** Window glass + frame filling an opening created by `wall`. */
export function glassPane(scene, assets, {
  axis = 'x', fixed, at, width, sill = 0.9, height = 1.2, lit = 0, frameMat = null,
}) {
  const g = new THREE.Group();
  const fm = frameMat || assets.mat.woodPaint;
  const glassMat = lit > 0
    ? new THREE.MeshStandardMaterial({ color: 0x223444, emissive: 0xffc985, emissiveIntensity: lit, roughness: 0.2 })
    : assets.mat.glass;
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), glassMat);
  pane.position.set(0, sill + height / 2, 0);
  if (axis === 'x') pane.position.x = at; else { pane.rotation.y = Math.PI / 2; pane.position.z = at; }
  g.add(pane);

  const fw = 0.06;
  const frameParts = [
    { w: width + 0.1, h: fw, y: sill, x: 0 },
    { w: width + 0.1, h: fw, y: sill + height, x: 0 },
    { w: fw, h: height, y: sill + height / 2, x: -width / 2 },
    { w: fw, h: height, y: sill + height / 2, x: width / 2 },
    { w: 0.05, h: height, y: sill + height / 2, x: 0 },
  ];
  for (const p of frameParts) {
    const bar = new THREE.Mesh(box(p.w, p.h, 0.09), fm);
    bar.position.set(p.x, p.y, 0);
    bar.castShadow = true;
    g.add(bar);
  }
  // sill ledge
  const ledge = new THREE.Mesh(box(width + 0.24, 0.06, 0.2), fm);
  ledge.position.set(0, sill - 0.02, 0.06);
  g.add(ledge);

  if (axis === 'x') g.position.set(0, 0, fixed);
  else { g.position.set(fixed, 0, 0); g.rotation.y = Math.PI / 2; }
  g.position.x += axis === 'x' ? 0 : 0;
  // position along the wall handled by caller through `at`
  if (axis === 'x') g.position.x = 0;
  scene.add(g);
  return g;
}

/** Curtains: two soft panels beside a window. */
export function curtains(scene, assets, x, y, z, width, ry = 0, color = 0x6b4a3a) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.98, side: THREE.DoubleSide });
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const geo = new THREE.PlaneGeometry(width * 0.35, 1.7, 6, 4);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      pos.setZ(i, Math.sin((px / (width * 0.35)) * Math.PI * 3) * 0.035);
    }
    geo.computeVertexNormals();
    const p = new THREE.Mesh(geo, mat);
    p.position.set(s * width * 0.36, 0.85, 0);
    g.add(p);
  }
  g.position.set(x, y, z);
  g.rotation.y = ry;
  scene.add(g);
  return g;
}

/** Wall-mounted picture / poster with a soft procedurally painted face. */
export function poster(scene, assets, x, y, z, ry = 0, w = 0.6, h = 0.8, hue = 25) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 170;
  const ctx = c.getContext('2d');
  ctx.fillStyle = `hsl(${hue}, 22%, 24%)`; ctx.fillRect(0, 0, 128, 170);
  const grd = ctx.createLinearGradient(0, 0, 128, 170);
  grd.addColorStop(0, `hsla(${hue + 20}, 45%, 62%, 0.55)`);
  grd.addColorStop(1, `hsla(${hue - 20}, 35%, 28%, 0.35)`);
  ctx.fillStyle = grd; ctx.fillRect(0, 0, 128, 170);
  ctx.strokeStyle = 'rgba(240,232,210,0.4)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(64, 70, 34, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(30, 140); ctx.quadraticCurveTo(64, 100, 100, 140); ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const g = new THREE.Group();
  const frame = new THREE.Mesh(box(w + 0.06, h + 0.06, 0.03), assets.mat.woodOld);
  g.add(frame);
  const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  art.position.z = 0.017;
  g.add(art);
  g.position.set(x, y, z);
  g.rotation.y = ry;
  scene.add(g);
  return g;
}

/** Old cracked patch / stain decal on a wall (cheap plane + canvas). */
export function grungeDecal(scene, x, y, z, ry, w = 1, h = 1, seed = 1) {
  const rng = makeRng(seed);
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  for (let i = 0; i < 5; i++) {
    const gx = 64 + randRange(rng, -20, 20), gy = 64 + randRange(rng, -20, 20);
    const r = randRange(rng, 20, 46);
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
    g.addColorStop(0, 'rgba(58,44,30,0.35)');
    g.addColorStop(1, 'rgba(58,44,30,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(gx, gy, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(40,30,20,0.35)'; ctx.lineWidth = 1.4;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    let px = randRange(rng, 20, 100), py = randRange(rng, 20, 100);
    ctx.moveTo(px, py);
    for (let j = 0; j < 4; j++) { px += randRange(rng, -22, 22); py += randRange(rng, -18, 24); ctx.lineTo(px, py); }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.75, depthWrite: false }));
  m.position.set(x, y, z);
  m.rotation.y = ry;
  scene.add(m);
  return m;
}

/** Cardboard moving box — used to sell "we just moved in" and old-house clutter. */
export function makeCardboardBox(assets, size = 0.5, seed = 1) {
  const rng = makeRng(seed);
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xa07a4e, roughness: 0.95 });
  const tape = new THREE.MeshStandardMaterial({ color: 0xc9b48e, roughness: 0.7 });
  const s = size;
  g.add(mesh(rbox(s, s * 0.85, s, 0.012, 2), mat, 0, s * 0.42, 0));
  g.add(mesh(box(s * 0.22, 0.004, s + 0.002), tape, 0, s * 0.85 + 0.002, 0));
  g.add(mesh(box(s + 0.002, 0.004, s * 0.22), tape, 0, s * 0.85 + 0.002, 0));
  g.rotation.y = randRange(rng, -0.5, 0.5);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Simple dumpster / trash pile for the alley. */
export function makeTrashPile(assets, seed = 3) {
  const rng = makeRng(seed);
  const g = new THREE.Group();
  const bagMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.65 });
  for (let i = 0; i < 5; i++) {
    const b = mesh(sphere(randRange(rng, 0.16, 0.26), 10), bagMat,
      randRange(rng, -0.35, 0.35), randRange(rng, 0.12, 0.2), randRange(rng, -0.35, 0.35));
    b.scale.y = 0.75;
    g.add(b);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
