import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeRng, randRange, pick } from './util.js';

/* ------------------------------------------------------------------ *
 * Geometry helpers. All furniture uses soft bevels and repeated
 * detail (slats, buttons, fabric folds) so nothing reads as a plain
 * untextured cube. Geometries are cached by key.
 * ------------------------------------------------------------------ */

const geoCache = new Map();
export function cachedGeo(key, make) {
  let g = geoCache.get(key);
  if (!g) { g = make(); geoCache.set(key, g); }
  return g;
}

export function rbox(w, h, d, r = 0.03, seg = 2) {
  const key = `rb:${w.toFixed(3)}:${h.toFixed(3)}:${d.toFixed(3)}:${r}:${seg}`;
  return cachedGeo(key, () => new RoundedBoxGeometry(w, h, d, seg, r));
}

export function box(w, h, d) {
  return cachedGeo(`b:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
}

export function cyl(rt, rb, h, seg = 16, open = false) {
  const key = `c:${rt}:${rb}:${h}:${seg}:${open}`;
  return cachedGeo(key, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));
}

export function sphere(r, seg = 16) {
  return cachedGeo(`s:${r}:${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(8, seg / 2)));
}

export function plane(w, h) {
  return cachedGeo(`p:${w}:${h}`, () => new THREE.PlaneGeometry(w, h));
}

export function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Simple box group helper: lets you build a "part" in local coordinates. */
export function group(...children) {
  const g = new THREE.Group();
  children.forEach((c) => c && g.add(c));
  return g;
}

export function contactShadow(assets, size = 1, opacity = 1) {
  const m = new THREE.Mesh(plane(1, 1), assets.blobShadow().clone());
  m.material.opacity *= opacity;
  m.rotation.x = -Math.PI / 2;
  m.scale.set(size, size, 1);
  m.position.y = 0.012;
  m.renderOrder = 1;
  return m;
}

/* ------------------------------ furniture ------------------------- */

/** Old wooden bed with a metal frame, folded blanket and a pillow. */
export function makeBed(assets, opts = {}) {
  const { width = 1.0, length = 2.0, height = 0.52 } = opts;
  const g = new THREE.Group();
  // legs / frame
  const legH = height - 0.16;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    g.add(mesh(cyl(0.025, 0.025, legH, 8), assets.mat.metalDark,
      sx * (width / 2 - 0.06), legH / 2, sz * (length / 2 - 0.08)));
  });
  // headboard: slats
  const headZ = -length / 2 + 0.03;
  g.add(mesh(rbox(width, 0.07, 0.06, 0.02), assets.mat.woodOld, 0, height + 0.45, headZ));
  for (let i = 0; i < 5; i++) {
    const x = -width / 2 + 0.1 + i * ((width - 0.2) / 4);
    g.add(mesh(cyl(0.018, 0.018, 0.9, 8), assets.mat.woodOld, x, height + 0.02, headZ));
  }
  // mattress + blanket
  g.add(mesh(rbox(width - 0.04, 0.17, length - 0.06, 0.06, 3), assets.mat.mattress, 0, height - 0.05, 0));
  const blanket = mesh(rbox(width + 0.03, 0.09, length * 0.62, 0.05, 3), assets.mat.blanket, 0, height + 0.06, length * 0.16);
  blanket.rotation.x = -0.02;
  g.add(blanket);
  // folded edge of the blanket
  g.add(mesh(rbox(width + 0.04, 0.1, 0.12, 0.05, 3), assets.mat.fabricCream, 0, height + 0.08, -length * 0.14));
  // pillow
  const pillow = mesh(rbox(width * 0.62, 0.13, 0.36, 0.09, 3), assets.mat.mattress, 0, height + 0.08, -length / 2 + 0.28);
  pillow.rotation.z = 0.03;
  g.add(pillow);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Wobbly old nightstand with a drawer that can be opened. */
export function makeNightstand(assets) {
  const g = new THREE.Group();
  const w = 0.5, d = 0.4, h = 0.58;
  g.add(mesh(rbox(w, h, d, 0.02), assets.mat.woodOld, 0, h / 2, 0));
  g.add(mesh(box(w + 0.03, 0.03, d + 0.03), assets.mat.woodWarm, 0, h, 0));
  const drawer = new THREE.Group();
  drawer.add(mesh(rbox(w - 0.06, 0.16, 0.03, 0.01), assets.mat.woodWarm, 0, 0, 0));
  drawer.add(mesh(cyl(0.012, 0.012, 0.09, 8), assets.mat.metal, 0, 0, 0.035));
  drawer.children[1].rotation.z = Math.PI / 2;
  drawer.position.set(0, h * 0.68, d / 2 + 0.015);
  g.add(drawer);
  g.userData.drawer = drawer;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function makeWardrobe(assets) {
  const g = new THREE.Group();
  const w = 1.0, h = 2.0, d = 0.55;
  const doors = [];
  const darkInterior = new THREE.MeshStandardMaterial({ color: 0x171716, roughness: 1 });

  // A real hollow cabinet: the doors can swing open, revealing a dark space
  // the player can use to hide in. The old solid box left no interior visible.
  g.add(mesh(box(0.055, h - 0.04, d), assets.mat.woodOld, -w / 2 + 0.0275, h / 2, 0));
  g.add(mesh(box(0.055, h - 0.04, d), assets.mat.woodOld, w / 2 - 0.0275, h / 2, 0));
  g.add(mesh(box(w - 0.08, 0.055, d), assets.mat.woodWarm, 0, 0.0275, 0));
  g.add(mesh(box(w - 0.08, 0.055, d), assets.mat.woodWarm, 0, h - 0.0275, 0));
  g.add(mesh(box(w - 0.1, h - 0.12, 0.035), assets.mat.woodOld, 0, h / 2, -d / 2 + 0.02));
  g.add(mesh(box(w - 0.11, h - 0.13, 0.012), darkInterior, 0, h / 2, d / 2 - 0.035));
  g.add(mesh(box(w - 0.18, 0.024, 0.024), assets.mat.metal, 0, h - 0.28, 0.02));

  const makeDoor = (side) => {
    const hinge = new THREE.Group();
    hinge.position.set(side < 0 ? -w / 2 + 0.04 : w / 2 - 0.04, 0, d / 2 + 0.008);
    const width = w / 2 - 0.04;
    const center = side < 0 ? width / 2 : -width / 2;
    hinge.add(mesh(rbox(width, h - 0.12, 0.045, 0.012), assets.mat.woodWarm,
      center, h / 2, 0));
    hinge.add(mesh(box(width - 0.15, h - 0.42, 0.012), assets.mat.woodOld,
      center, h / 2, 0.026));
    const knobX = side < 0 ? width - 0.06 : -width + 0.06;
    hinge.add(mesh(sphere(0.024, 10), assets.mat.metal, knobX, h / 2, 0.05));
    g.add(hinge);
    doors.push(hinge);
  };
  makeDoor(-1);
  makeDoor(1);

  // A few clothes on the rail make the hollow space read as a lived-in closet.
  const shirtMats = [assets.mat.fabricBlue, assets.mat.fabricRed, assets.mat.fabricGrey];
  for (let i = 0; i < 3; i++) {
    const shirt = mesh(rbox(0.16, 0.5, 0.08, 0.035), shirtMats[i], -0.22 + i * 0.22, 1.12, 0.02);
    shirt.rotation.z = (i - 1) * 0.035;
    g.add(shirt);
  }

  g.userData.doors = doors;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Old sofa with cushions and a sagging seat. */
export function makeSofa(assets, opts = {}) {
  const { width = 2.1, fabric = 'fabricRed' } = opts;
  const g = new THREE.Group();
  const mat = assets.mat[fabric];
  const seatH = 0.44;
  g.add(mesh(rbox(width, seatH, 0.9, 0.12, 3), mat, 0, seatH / 2, 0));
  const back = mesh(rbox(width, 0.72, 0.22, 0.13, 3), mat, 0, seatH + 0.34, -0.36);
  back.rotation.x = -0.12;
  g.add(back);
  for (const s of [-1, 1]) {
    g.add(mesh(rbox(0.22, 0.6, 0.92, 0.12, 3), mat, s * (width / 2 - 0.02), seatH + 0.06, 0));
    // legs
    for (const t of [-1, 1]) g.add(mesh(cyl(0.03, 0.022, 0.12, 8), assets.mat.woodOld, s * (width / 2 - 0.14), 0.06, t * 0.34));
  }
  // cushions with a bit of rotation for life
  const rng = makeRng(5);
  for (const s of [-1, 1]) {
    const c = mesh(rbox(width / 2 - 0.2, 0.16, 0.72, 0.09, 3), assets.mat.fabricCream, s * (width / 4 - 0.02), seatH + 0.1, 0.03);
    c.rotation.z = s * 0.02; c.rotation.x = -0.03;
    g.add(c);
    const p = mesh(rbox(0.42, 0.42, 0.15, 0.09, 3), assets.mat.fabricBlue, s * (width / 4 - 0.04), seatH + 0.34, -0.25);
    p.rotation.z = randRange(rng, -0.3, 0.3); p.rotation.x = -0.3;
    g.add(p);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Low wooden coffee table with a few worn objects on top. */
export function makeCoffeeTable(assets) {
  const g = new THREE.Group();
  const w = 1.1, d = 0.62, h = 0.42;
  g.add(mesh(rbox(w, 0.06, d, 0.01), assets.mat.woodWarm, 0, h, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(mesh(cyl(0.025, 0.02, h, 8), assets.mat.woodOld, sx * (w / 2 - 0.08), h / 2, sz * (d / 2 - 0.07)));
  }
  // mug + newspaper + ashtray-ish dish
  g.add(mesh(cyl(0.045, 0.038, 0.1, 14), assets.mat.plasticWhite, 0.22, h + 0.08, 0.06));
  const handle = mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 12), assets.mat.plasticWhite, 0.27, h + 0.09, 0.06);
  handle.rotation.y = Math.PI / 2;
  g.add(handle);
  const paper = mesh(box(0.3, 0.005, 0.22), assets.mat.paper, -0.2, h + 0.035, -0.02);
  paper.rotation.y = 0.3;
  g.add(paper);
  g.add(mesh(cyl(0.07, 0.06, 0.03, 16), assets.mat.glassDark, -0.28, h + 0.05, 0.16));
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function makeChair(assets) {
  const g = new THREE.Group();
  const seatH = 0.45;
  g.add(mesh(rbox(0.44, 0.05, 0.44, 0.012), assets.mat.woodWarm, 0, seatH, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(mesh(cyl(0.02, 0.018, seatH, 8), assets.mat.woodOld, sx * 0.18, seatH / 2, sz * 0.18));
  }
  g.add(mesh(rbox(0.44, 0.4, 0.04, 0.012), assets.mat.woodWarm, 0, seatH + 0.22, -0.2));
  for (const sx of [-1, 1]) g.add(mesh(cyl(0.018, 0.018, 0.44, 8), assets.mat.woodOld, sx * 0.18, seatH + 0.22, -0.2));
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function makeDiningTable(assets) {
  const g = new THREE.Group();
  const w = 1.3, d = 0.9, h = 0.75;
  g.add(mesh(rbox(w, 0.06, d, 0.015), assets.mat.woodWarm, 0, h, 0));
  g.add(mesh(box(w - 0.1, 0.02, d - 0.1), assets.mat.woodOld, 0, h + 0.04, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(mesh(rbox(0.07, h - 0.06, 0.07, 0.01), assets.mat.woodOld, sx * (w / 2 - 0.09), (h - 0.06) / 2, sz * (d / 2 - 0.09)));
  }
  // plate, cup, bottle for a lived-in look
  g.add(mesh(cyl(0.13, 0.11, 0.02, 20), assets.mat.plasticWhite, -0.3, h + 0.05, 0.1));
  g.add(mesh(cyl(0.04, 0.045, 0.12, 14), assets.mat.plasticWhite, 0.05, h + 0.1, -0.12));
  g.add(mesh(cyl(0.035, 0.035, 0.28, 12), assets.mat.plasticGreen, 0.4, h + 0.18, 0.14));
  g.add(mesh(cyl(0.012, 0.012, 0.08, 8), assets.mat.plasticGreen, 0.4, h + 0.36, 0.14));
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function makeFridge(assets) {
  const g = new THREE.Group();
  const w = 0.7, h = 1.7, d = 0.68;
  g.add(mesh(rbox(w, h, d, 0.04, 2), assets.mat.plasticWhite, 0, h / 2, 0));
  g.add(mesh(box(w, 0.02, d), assets.mat.metalDark, 0, h * 0.66, 0.001));
  g.add(mesh(cyl(0.014, 0.014, 0.3, 8), assets.mat.metal, w * 0.33, h * 0.8, d / 2 + 0.03));
  g.add(mesh(cyl(0.014, 0.014, 0.5, 8), assets.mat.metal, w * 0.33, h * 0.35, d / 2 + 0.03));
  // magnets and a note
  g.add(mesh(box(0.12, 0.09, 0.003), assets.mat.paper, -0.1, h * 0.8, d / 2 + 0.005));
  const magnet = mesh(cyl(0.012, 0.012, 0.006, 10), assets.mat.plasticRed, -0.14, h * 0.84, d / 2 + 0.008);
  magnet.rotation.x = Math.PI / 2;
  g.add(magnet);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function makeCounter(assets, w = 1.6, d = 0.6, h = 0.9) {
  const g = new THREE.Group();
  g.add(mesh(rbox(w, h - 0.05, d, 0.02), assets.mat.woodPaint, 0, (h - 0.05) / 2, 0));
  g.add(mesh(box(w + 0.06, 0.05, d + 0.06), assets.mat.woodWarm, 0, h, 0));
  // cabinet doors
  for (let i = 0; i < Math.max(2, Math.round(w / 0.6)); i++) {
    const n = Math.max(2, Math.round(w / 0.6));
    const sw = w / n;
    g.add(mesh(box(sw - 0.06, h * 0.6, 0.015), assets.mat.woodOld, -w / 2 + sw * (i + 0.5), h * 0.45, d / 2 + 0.005));
    g.add(mesh(sphere(0.018, 8), assets.mat.metal, -w / 2 + sw * (i + 0.5) + sw / 2 - 0.08, h * 0.45, d / 2 + 0.03));
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function makeSink(assets) {
  const g = new THREE.Group();
  g.add(mesh(rbox(0.6, 0.2, 0.45, 0.03), assets.mat.metal, 0, 0, 0));
  g.add(mesh(box(0.48, 0.12, 0.32), assets.mat.metalDark, 0, 0.02, 0));
  const tap = mesh(cyl(0.02, 0.02, 0.3, 10), assets.mat.chrome, 0, 0.24, -0.16);
  g.add(tap);
  const spout = mesh(cyl(0.018, 0.018, 0.18, 10), assets.mat.chrome, 0, 0.38, -0.07);
  spout.rotation.x = Math.PI / 2;
  g.add(spout);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/**
 * Shop shelving unit. The frame is a few boxes; all the products on the
 * shelves are merged into ONE geometry using a product-label atlas, so a
 * full aisle costs 1-2 draw calls instead of ~90.
 */
export function makeShelfUnit(assets, opts = {}) {
  const { width = 1.8, depth = 0.5, height = 1.9, levels = 4, seed = 1, rng = makeRng(seed), facing = 1 } = opts;
  const g = new THREE.Group();
  const frameMat = assets.mat.metalDark;

  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(mesh(box(0.05, height, 0.05), frameMat, sx * (width / 2 - 0.025), height / 2, sz * (depth / 2 - 0.025)));
  }
  // perforated back panel
  g.add(mesh(box(width - 0.06, height - 0.1, 0.02), assets.mat.concreteDark, 0, height / 2, -depth / 2 + 0.01));

  // build product geometry in a local buffer, then merge
  const parts = [];
  const addBox = (w, h, d, x, y, z, ry, cell) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    // only the front face gets the label, others get a plain edge of the atlas
    const uv = geo.attributes.uv;
    const cu = (cell.u0 + cell.u1) / 2, cv = (cell.v0 + cell.v1) / 2;
    const inset = 0.006;
    // BoxGeometry face order: +x,-x,+y,-y,+z,-z (4 verts each)
    const setFace = (faceIndex, u0, u1, v0, v1) => {
      const o = faceIndex * 4;
      uv.setXY(o + 0, u0, v1);
      uv.setXY(o + 1, u1, v1);
      uv.setXY(o + 2, u0, v0);
      uv.setXY(o + 3, u1, v0);
    };
    setFace(4, cell.u0 + inset, cell.u1 - inset, cell.v0 + inset, cell.v1 - inset); // front
    for (const f of [0, 1, 2, 3, 5]) setFace(f, cu - 0.02, cu + 0.02, cv + 0.05, cv + 0.09);
    uv.needsUpdate = true;
    geo.translate(x, y, z);
    if (ry) geo.rotateY(ry);
    parts.push(geo);
  };

  const cells = [0, 1, 2, 3, 4, 5].map((k) => assets.atlasCell(k));
  for (let l = 0; l < levels; l++) {
    const y = 0.12 + l * ((height - 0.2) / levels);
    g.add(mesh(box(width - 0.08, 0.03, depth - 0.04), assets.mat.metal, 0, y, 0));
    let x = -width / 2 + 0.1;
    while (x < width / 2 - 0.12) {
      const cell = cells[Math.floor(rng() * cells.length)];
      const hh = randRange(rng, 0.16, 0.3);
      const ww = randRange(rng, 0.08, 0.15);
      const dd = randRange(rng, 0.08, 0.14);
      addBox(ww, hh, dd, x + ww / 2, y + 0.02 + hh / 2, facing * (depth * 0.16), randRange(rng, -0.06, 0.06), cell);
      x += ww + randRange(rng, 0.012, 0.05);
    }
  }

  if (parts.length) {
    const merged = mergeGeometries(parts, false);
    if (merged) {
      const prodMesh = new THREE.Mesh(merged, assets.mat.productAtlas);
      prodMesh.castShadow = true;
      prodMesh.receiveShadow = true;
      g.add(prodMesh);
    }
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Checkout counter with register, screen and conveyor. */
export function makeCheckout(assets) {
  const g = new THREE.Group();
  const w = 2.6, d = 1.0, h = 0.95;
  g.add(mesh(rbox(w, h, d, 0.03), assets.mat.plasticWhite, 0, h / 2, 0));
  g.add(mesh(box(w + 0.05, 0.04, d + 0.05), assets.mat.metalDark, 0, h, 0));
  // dark conveyor strip
  g.add(mesh(box(w * 0.55, 0.02, d * 0.5), assets.mat.rubber, -w * 0.18, h + 0.02, 0.06));
  // register body + screen
  const reg = new THREE.Group();
  reg.add(mesh(rbox(0.34, 0.16, 0.3, 0.02), assets.mat.metalDark, 0, 0, 0));
  const scr = mesh(box(0.3, 0.22, 0.02), assets.mat.emissiveCool, 0, 0.2, -0.02);
  scr.rotation.x = -0.28;
  reg.add(scr);
  reg.add(mesh(cyl(0.06, 0.06, 0.01, 12), assets.mat.metal, 0.11, 0.08, 0.06));
  reg.position.set(w * 0.28, h + 0.12, -0.02);
  g.add(reg);
  // card reader
  const reader = mesh(rbox(0.1, 0.16, 0.06, 0.015), assets.mat.metalDark, w * 0.12, h + 0.1, 0.2);
  g.add(reader);
  g.add(mesh(box(0.07, 0.05, 0.005), assets.mat.neonGreen, w * 0.12, h + 0.14, 0.232));
  g.userData.registerScreen = scr;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Cash drawer (the loot target). */
export function makeCashDrawer(assets) {
  const g = new THREE.Group();
  const base = mesh(rbox(0.44, 0.18, 0.42, 0.02), assets.mat.metalDark, 0, 0.09, 0);
  g.add(base);
  const tray = new THREE.Group();
  tray.add(mesh(rbox(0.4, 0.05, 0.38, 0.01), assets.mat.metal, 0, 0, 0));
  for (let i = 0; i < 4; i++) {
    tray.add(mesh(box(0.02, 0.04, 0.34), assets.mat.metalDark, -0.15 + i * 0.1, 0.04, 0));
    // banknotes
    tray.add(mesh(box(0.06, 0.012, 0.1), assets.mat.paper, -0.15 + i * 0.1 + 0.035, 0.03, 0.06));
  }
  tray.add(mesh(cyl(0.05, 0.05, 0.02, 14), assets.mat.coin, 0.12, 0.03, -0.1));
  tray.position.set(0, 0.2, 0);
  g.add(tray);
  g.userData.tray = tray;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Security camera: pivoting head + red LED. */
export function makeCameraProp(assets) {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.06, 0.06, 0.04, 12), assets.mat.plasticWhite, 0, 0, 0));
  const headPivot = new THREE.Group();
  const body = mesh(rbox(0.13, 0.12, 0.24, 0.03), assets.mat.plasticWhite, 0, 0, 0.12);
  headPivot.add(body);
  const lens = mesh(cyl(0.045, 0.045, 0.03, 16), assets.mat.glassDark, 0, 0, 0.245);
  lens.rotation.x = Math.PI / 2;
  headPivot.add(lens);
  const led = new THREE.Mesh(sphere(0.012, 8), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  led.position.set(0.05, 0.06, 0.2);
  headPivot.add(led);
  headPivot.position.y = -0.02;
  headPivot.rotation.x = 0.25;
  g.add(headPivot);
  g.userData.head = headPivot;
  g.userData.led = led;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return g;
}

/* ------------------------------ street ---------------------------- */

export function makeStreetLamp(assets) {
  const g = new THREE.Group();
  const h = 4.2;
  g.add(mesh(cyl(0.06, 0.09, h, 10), assets.mat.metalDark, 0, h / 2, 0));
  const arm = mesh(cyl(0.045, 0.045, 0.5, 8), assets.mat.metalDark, 0.22, h, 0);
  arm.rotation.z = Math.PI / 2;
  g.add(arm);
  g.add(mesh(rbox(0.34, 0.1, 0.24, 0.03), assets.mat.metalDark, 0.44, h - 0.03, 0));
  const bulb = new THREE.Mesh(box(0.28, 0.03, 0.18), new THREE.MeshBasicMaterial({ color: 0xffe0a8 }));
  bulb.position.set(0.44, h - 0.09, 0);
  g.add(bulb);
  g.userData.lampPos = new THREE.Vector3(0.44, h - 0.15, 0);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return g;
}

export function makeCar(assets, color = 0x1d3a5c) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 });
  g.add(mesh(rbox(1.75, 0.5, 4.0, 0.12, 3), bodyMat, 0, 0.62, 0));
  const cabin = mesh(rbox(1.55, 0.5, 2.1, 0.14, 3), bodyMat, 0, 1.06, -0.15);
  g.add(cabin);
  // windows
  const glass = assets.mat.glassDark;
  const wf = mesh(box(1.44, 0.34, 0.04), glass, 0, 1.1, 0.92); wf.rotation.x = -0.35; g.add(wf);
  const wb = mesh(box(1.44, 0.3, 0.04), glass, 0, 1.1, -1.22); wb.rotation.x = 0.3; g.add(wb);
  for (const s of [-1, 1]) g.add(mesh(box(0.04, 0.32, 1.7), glass, s * 0.76, 1.1, -0.15));
  // wheels
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const tire = mesh(cyl(0.32, 0.32, 0.22, 16), assets.mat.rubber, sx * 0.82, 0.32, sz * 1.3);
    tire.rotation.z = Math.PI / 2;
    g.add(tire);
    const rim = mesh(cyl(0.17, 0.17, 0.24, 12), assets.mat.metal, sx * 0.82, 0.32, sz * 1.3);
    rim.rotation.z = Math.PI / 2;
    g.add(rim);
  }
  // lights
  for (const s of [-1, 1]) {
    g.add(mesh(rbox(0.3, 0.12, 0.06, 0.02), assets.mat.emissiveWarm, s * 0.6, 0.66, 2.0));
    g.add(mesh(rbox(0.28, 0.1, 0.05, 0.02), new THREE.MeshStandardMaterial({ color: 0x7a1010, emissive: 0x4a0808 }), s * 0.6, 0.68, -2.0));
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function makeTrashBin(assets) {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.26, 0.22, 0.8, 14), assets.mat.plasticBlue, 0, 0.4, 0));
  g.add(mesh(cyl(0.28, 0.28, 0.05, 14), assets.mat.plasticBlue, 0, 0.82, 0));
  g.add(mesh(cyl(0.2, 0.2, 0.03, 12), assets.mat.rubber, 0, 0.86, 0));
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function makeCrate(assets, seed = 1) {
  const rng = makeRng(seed);
  const g = new THREE.Group();
  const s = 0.6;
  g.add(mesh(rbox(s, s, s, 0.02), assets.mat.woodWarm, 0, s / 2, 0));
  for (let i = 0; i < 3; i++) {
    g.add(mesh(box(s + 0.01, 0.05, 0.04), assets.mat.woodOld, 0, 0.1 + i * 0.2, s / 2 + 0.005));
  }
  g.rotation.y = randRange(rng, -0.3, 0.3);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Cheap facade window with warm light behind it. */
export function makeWindowLit(assets, w = 1.2, h = 1.4, lit = true) {
  const g = new THREE.Group();
  g.add(mesh(box(w + 0.14, h + 0.14, 0.08), assets.mat.woodPaint, 0, 0, 0));
  const pane = new THREE.Mesh(box(w, h, 0.02), lit ? assets.mat.windowGlow : assets.mat.glassDark);
  pane.position.z = 0.05;
  g.add(pane);
  g.add(mesh(box(w + 0.1, 0.05, 0.05), assets.mat.woodPaint, 0, 0, 0.06));
  g.add(mesh(box(0.05, h + 0.1, 0.05), assets.mat.woodPaint, 0, 0, 0.06));
  g.add(mesh(box(w + 0.24, 0.07, 0.14), assets.mat.woodPaint, 0, -h / 2 - 0.09, 0.04));
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return g;
}

export function makeDoor(assets, w = 0.95, h = 2.05) {
  const g = new THREE.Group();
  g.add(mesh(rbox(w, h, 0.06, 0.02), assets.mat.woodWarm, 0, h / 2, 0));
  // inset panels
  g.add(mesh(box(w - 0.24, h * 0.36, 0.02), assets.mat.woodOld, 0, h * 0.68, 0.04));
  g.add(mesh(box(w - 0.24, h * 0.3, 0.02), assets.mat.woodOld, 0, h * 0.28, 0.04));
  g.add(mesh(sphere(0.035, 10), assets.mat.metal, w * 0.34, h * 0.46, 0.06));
  const keyhole = mesh(cyl(0.028, 0.028, 0.06, 10), assets.mat.metal, w * 0.34, h * 0.46, 0.03);
  keyhole.rotation.x = Math.PI / 2;
  g.add(keyhole);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Hanging bulb with a warm light + a small emissive sphere. */
export function makeCeilingBulb(assets, cord = 0.7, color = 0xffc48a) {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.008, 0.008, cord, 6), assets.mat.rubber, 0, -cord / 2, 0));
  const socket = mesh(cyl(0.03, 0.035, 0.07, 10), assets.mat.metalDark, 0, -cord - 0.03, 0);
  g.add(socket);
  const bulb = new THREE.Mesh(sphere(0.055, 14), new THREE.MeshBasicMaterial({ color }));
  bulb.position.y = -cord - 0.1;
  g.add(bulb);
  g.userData.bulb = bulb;
  return g;
}
