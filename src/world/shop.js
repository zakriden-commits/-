import * as THREE from 'three';
import {
  mesh, box, rbox, cyl, sphere, makeShelfUnit, makeCheckout, makeCashDrawer, makeCameraProp,
  makeWindowLit, contactShadow,
} from '../core/props.js';
import { floorPatch, ceilingPatch, wall, poster, grungeDecal, makeCardboardBox } from './common.js';
import { makeRng, randRange } from '../core/util.js';

/**
 * The corner shop: glass front, four product aisles, two checkouts with
 * cashiers, a back room with the safe, ceiling cameras and a neon sign.
 *
 * Interior bounds: x -8..8, z 14..30 (entrance at z = 14, x = 3)
 */
export function buildShop(scene, assets, colliders, lights, opts = {}) {
  const R = makeRng(777);
  const group = new THREE.Group();
  group.name = 'shop';
  scene.add(group);

  const H = { x0: -8, x1: 8, z0: 14, z1: 30, h: 3.4 };

  /* --------------------------- shell --------------------------- */
  floorPatch(scene, assets, assets.mat.shopTile, H.x0, H.x1, H.z0, H.z1, 0.002, 0.55);
  ceilingPatch(scene, new THREE.MeshStandardMaterial({ color: 0x8e959b, roughness: 1 }), H.x0, H.x1, H.z0, H.z1, H.h);

  // front wall: glass with a door opening at x = 3
  wall(scene, colliders, assets, {
    axis: 'x', fixed: H.z0, from: H.x0, to: H.x1, height: H.h, thickness: 0.3,
    mat: assets.mat.concrete,
    gaps: [
      { at: -3.0, width: 3.4, type: 'window', sill: 0.55, height: 2.1 },
      { at: 3.0, width: 1.5, type: 'door', height: 2.3 },
      { at: 6.3, width: 2.2, type: 'window', sill: 0.55, height: 2.1 },
    ],
  });
  // glass panes for the shop front
  const shopGlass = new THREE.MeshPhysicalMaterial({
    color: 0xdff2ff, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.16, side: THREE.DoubleSide,
  });
  for (const [cx, w] of [[-3.0, 3.4], [6.3, 2.2]]) {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, 2.1), shopGlass);
    pane.position.set(cx, 0.55 + 1.05, H.z0);
    group.add(pane);
    // mullions
    for (let i = -1; i <= 1; i++) {
      const bar = mesh(box(0.05, 2.1, 0.06), assets.mat.metal, cx + i * (w / 3), 1.6, H.z0);
      group.add(bar);
    }
  }
  // sliding door frame
  const doorFrame = new THREE.Group();
  doorFrame.add(mesh(box(1.6, 0.1, 0.12), assets.mat.metal, 3.0, 2.32, H.z0));
  doorFrame.add(mesh(box(0.1, 2.3, 0.12), assets.mat.metal, 2.98, 1.15, H.z0));
  doorFrame.add(mesh(box(0.1, 2.3, 0.12), assets.mat.metal, 3.2, 1.15, H.z0));
  group.add(doorFrame);
  const doorLeft = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 2.2), shopGlass);
  doorLeft.position.set(2.66, 1.15, H.z0);
  group.add(doorLeft);
  const doorRight = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 2.2), shopGlass);
  doorRight.position.set(3.34, 1.15, H.z0);
  group.add(doorRight);
  const doorCollider = colliders.addBounds(2.25, 3.75, H.z0 - 0.2, H.z0 + 0.2, 'shopDoor');

  // side + back walls
  wall(scene, colliders, assets, { axis: 'z', fixed: H.x0, from: H.z0, to: H.z1, height: H.h, mat: assets.mat.concrete });
  wall(scene, colliders, assets, { axis: 'z', fixed: H.x1, from: H.z0, to: H.z1, height: H.h, mat: assets.mat.concrete });
  wall(scene, colliders, assets, { axis: 'x', fixed: H.z1, from: H.x0, to: H.x1, height: H.h, mat: assets.mat.concrete });
  // interior partition for the back room (door at x = 0.5)
  wall(scene, colliders, assets, {
    axis: 'x', fixed: 27, from: H.x0, to: H.x1, height: H.h, thickness: 0.16,
    mat: assets.mat.plaster,
    gaps: [{ at: 0.5, width: 1.1, type: 'door', height: 2.2 }],
  });
  // partition gets a "staff only" door
  const backDoorPivot = new THREE.Group();
  backDoorPivot.position.set(-0.05, 0, 26.94);
  const backDoor = new THREE.Group();
  backDoor.add(mesh(rbox(1.05, 2.2, 0.06, 0.02), assets.mat.metal, 0.55, 1.1, 0));
  backDoor.add(mesh(box(0.6, 0.5, 0.02), assets.mat.glassDark, 0.55, 1.7, 0.04));
  backDoor.add(mesh(sphere(0.03, 8), assets.mat.metal, 0.95, 1.05, 0.06));
  backDoorPivot.add(backDoor);
  group.add(backDoorPivot);
  // The doorway's lintel is intentionally excluded from the 2D wall collider,
  // so use a real, openable slab collider instead of making the doorway both
  // invisible and impassable.
  const backDoorCollider = colliders.addBox(0.5, 26.94, 1.05, 0.12, 'backDoor');

  /* ---------------------------- signage ------------------------- */
  // neon sign above the entrance
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 1024; signCanvas.height = 256;
  const sctx = signCanvas.getContext('2d');
  sctx.fillStyle = '#0a0e14'; sctx.fillRect(0, 0, 1024, 256);
  sctx.font = 'bold 150px Helvetica, Arial, sans-serif';
  sctx.textAlign = 'center'; sctx.textBaseline = 'middle';
  sctx.shadowColor = '#54e8ff'; sctx.shadowBlur = 40;
  sctx.fillStyle = '#bff6ff';
  sctx.fillText('МАГАЗИН', 512, 108);
  sctx.font = 'bold 52px Helvetica, Arial, sans-serif';
  sctx.shadowColor = '#b6ff5c'; sctx.shadowBlur = 24; sctx.fillStyle = '#dcffb0';
  sctx.fillText('24  ЧАСА', 512, 208);
  const signTex = new THREE.CanvasTexture(signCanvas);
  signTex.colorSpace = THREE.SRGBColorSpace;
  const signBoard = mesh(box(7.2, 1.7, 0.18), assets.mat.metalDark, 0, 3.7, H.z0 - 0.16);
  group.add(signBoard);
  const signFace = new THREE.Mesh(new THREE.PlaneGeometry(7.0, 1.55),
    new THREE.MeshBasicMaterial({ map: signTex }));
  signFace.position.set(0, 3.7, H.z0 - 0.06);
  group.add(signFace);
  const signLight = new THREE.PointLight(0x66e8ff, 12, 12, 2);
  signLight.position.set(0, 3.2, H.z0 - 1.2);
  group.add(signLight);
  lights.push(signLight);

  // shop windows: warm interior light spilling out
  for (const [x, z, ry] of [[-3.0, H.z0 - 0.4, 0], [6.3, H.z0 - 0.4, 0]]) {
    const shaft = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.4),
      new THREE.MeshBasicMaterial({ map: assets.tex.shaft, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
    shaft.position.set(x, 1.55, z);
    group.add(shaft);
  }

  /* -------------------------- interior lights ------------------- */
  const gridLights = [];
  for (const x of [-4, 0, 4]) for (const z of [17.5, 22, 26]) {
    const tube = new THREE.Group();
    tube.add(mesh(box(1.6, 0.08, 0.18), assets.mat.metalDark, 0, H.h - 0.09, 0));
    const bulb = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.14),
      new THREE.MeshBasicMaterial({ color: 0xeaf6ff }));
    bulb.rotation.x = Math.PI / 2;
    bulb.position.y = H.h - 0.14;
    tube.add(bulb);
    tube.position.set(x, 0, z);
    group.add(tube);
    gridLights.push(tube);
  }
  for (const [x, z] of [[-3.5, 19], [3.5, 19], [0, 24.5]]) {
    const l = new THREE.PointLight(0xdfefff, 16, 13, 2);
    l.position.set(x, 3.0, z);
    group.add(l);
    lights.push(l);
  }
  const backLight = new THREE.PointLight(0xffe0b0, 7, 8, 2);
  backLight.position.set(0, 2.6, 28.6);
  group.add(backLight);
  lights.push(backLight);

  /* ---------------------------- shelves ------------------------- */
  const shelves = [];
  const shelfRows = [
    { z: 18.2, x: -4.6, w: 4.0 }, { z: 18.2, x: 4.4, w: 4.2 },
    { z: 20.8, x: -4.8, w: 4.2 }, { z: 20.8, x: 4.6, w: 4.0 },
    { z: 23.4, x: -4.6, w: 4.0 }, { z: 23.4, x: 4.4, w: 4.2 },
    { z: 25.8, x: -4.8, w: 3.6 }, { z: 25.8, x: 4.8, w: 3.4 },
  ];
  shelfRows.forEach((row, i) => {
    const unit = makeShelfUnit(assets, {
      width: row.w, depth: 1.0, height: 2.0, levels: 4, seed: 100 + i, rng: makeRng(1000 + i),
    });
    unit.position.set(row.x, 0, row.z);
    // shelves face the central aisle
    unit.rotation.y = row.x < 0 ? Math.PI / 2 : -Math.PI / 2;
    group.add(unit);
    colliders.addBox(row.x, row.z, 1.05, row.w, 'shelf');
    shelves.push({ ...row, unit });

    // price tags hanging over the edge
    for (let k = 0; k < 3; k++) {
      const tag = mesh(box(0.14, 0.09, 0.01), assets.mat.paper,
        row.x + (row.x < 0 ? 0.53 : -0.53), 1.35, row.z - row.w / 2 + 0.4 + k * (row.w / 3));
      tag.rotation.y = row.x < 0 ? Math.PI / 2 : -Math.PI / 2;
      group.add(tag);
    }
  });

  /* --------------------------- checkouts ------------------------ */
  // checkout 1 (left, cashier station) + checkout 2 (right, unattended)
  const checkoutA = makeCheckout(assets);
  checkoutA.position.set(-6.2, 0, 16.4);
  checkoutA.rotation.y = Math.PI; // register faces the entrance
  group.add(checkoutA);
  colliders.addBox(-6.2, 16.4, 2.6, 1.0, 'checkout');

  const drawerA = makeCashDrawer(assets);
  drawerA.position.set(-6.9, 0.98, 16.4);
  group.add(drawerA);

  const checkoutB = makeCheckout(assets);
  checkoutB.position.set(6.2, 0, 16.4);
  checkoutB.rotation.y = Math.PI;
  group.add(checkoutB);
  colliders.addBox(6.2, 16.4, 2.6, 1.0, 'checkout');
  const drawerB = makeCashDrawer(assets);
  drawerB.position.set(6.9, 0.98, 16.4);
  group.add(drawerB);

  // shopping baskets + trolleys near the entrance
  const basketStack = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const basket = mesh(rbox(0.44, 0.16, 0.3, 0.02), i % 2 ? assets.mat.plasticRed : assets.mat.plasticYellow,
      0, 0.08 + i * 0.09, 0);
    basket.rotation.y = randRange(R, -0.1, 0.1);
    basketStack.add(basket);
  }
  basketStack.position.set(-1.2, 0, 15.2);
  group.add(basketStack);
  colliders.addBox(-1.2, 15.2, 0.5, 0.4, 'baskets');

  /* --------------------------- back room ------------------------ */
  // stock shelves, safe, crates, notice board with the safe code
  const stockA = makeShelfUnit(assets, { width: 3.2, depth: 0.8, height: 1.9, levels: 3, seed: 501, rng: makeRng(501) });
  stockA.position.set(-5.4, 0, 28.9);
  group.add(stockA);
  colliders.addBox(-5.4, 28.9, 3.2, 0.85, 'shelf');

  for (let i = 0; i < 5; i++) {
    const c = makeCardboardBox(assets, randRange(R, 0.4, 0.6), 700 + i);
    c.position.set(randRange(R, 3.2, 6.2), 0, randRange(R, 27.8, 29.4));
    group.add(c);
    colliders.addBox(c.position.x, c.position.z, 0.5, 0.5, 'crate');
  }

  // the safe (bonus loot)
  const safe = new THREE.Group();
  safe.add(mesh(rbox(0.9, 1.0, 0.8, 0.03), assets.mat.metalDark, 0, 0.5, 0));
  const safeDoor = new THREE.Group();
  safeDoor.add(mesh(rbox(0.86, 0.94, 0.06, 0.02), assets.mat.metal, 0, 0.5, 0.4));
  const dial = mesh(cyl(0.13, 0.13, 0.05, 20), assets.mat.chrome, 0, 0.55, 0.45);
  dial.rotation.x = Math.PI / 2;
  safeDoor.add(dial);
  safeDoor.add(mesh(box(0.5, 0.04, 0.03), assets.mat.chrome, 0, 0.85, 0.44));
  safe.add(safeDoor);
  safe.position.set(-6.4, 0, 27.6);
  group.add(safe);
  const safeCollider = colliders.addBox(-6.4, 27.6, 0.95, 0.85, 'safe');

  // staff notice board with the code
  const noteC = document.createElement('canvas');
  noteC.width = 256; noteC.height = 256;
  const nctx = noteC.getContext('2d');
  nctx.fillStyle = '#e8e2cc'; nctx.fillRect(0, 0, 256, 256);
  nctx.fillStyle = '#b4271f'; nctx.font = 'bold 30px Helvetica, Arial'; nctx.textAlign = 'center';
  nctx.fillText('СЕЙФ', 128, 46);
  nctx.fillStyle = '#222'; nctx.font = 'bold 20px Helvetica, Arial';
  nctx.fillText('код на смене', 128, 78);
  nctx.font = 'bold 76px Courier New, monospace';
  nctx.fillText('4-3-7-1', 128, 160);
  nctx.font = '18px Helvetica, Arial';
  nctx.fillText('не забыть закрыть!!', 128, 205);
  nctx.fillText('— З.М.', 128, 232);
  const noteTex = new THREE.CanvasTexture(noteC);
  noteTex.colorSpace = THREE.SRGBColorSpace;
  const notice = mesh(new THREE.PlaneGeometry(0.55, 0.55), new THREE.MeshStandardMaterial({ map: noteTex, roughness: 0.95 }),
    1.75, 1.6, 26.91);
  notice.rotation.y = Math.PI;
  group.add(notice);
  const noticeLight = new THREE.PointLight(0xfff0d0, 1.5, 3, 2);
  noticeLight.position.set(1.75, 1.9, 26.2);
  group.add(noticeLight);

  /* --------------------------- cameras -------------------------- */
  const cameras = [];
  const camDefs = [
    { x: -7.6, y: 3.1, z: 15.2, ry: Math.PI * 0.25, sweep: 0.9 },
    { x: 7.6, y: 3.1, z: 15.2, ry: -Math.PI * 0.25, sweep: 0.9 },
    { x: 0, y: 3.2, z: 26.6, ry: Math.PI, sweep: 1.2 },
  ];
  camDefs.forEach((d, i) => {
    const cam = makeCameraProp(assets);
    cam.position.set(d.x, d.y, d.z);
    cam.rotation.y = d.ry;
    group.add(cam);
    cameras.push({
      mesh: cam, baseYaw: d.ry, sweep: d.sweep, phase: i * 1.7,
      pos: new THREE.Vector3(d.x, d.y, d.z), range: 9, fov: 0.62,
    });
  });

  /* --------------------------- props --------------------------- */
  // wet floor sign, posters on walls, mop bucket
  const wetSign = new THREE.Group();
  wetSign.add(mesh(rbox(0.3, 0.6, 0.04, 0.01), assets.mat.plasticYellow, 0, 0.3, 0));
  wetSign.children[0].rotation.x = 0.18;
  wetSign.position.set(1.2, 0, 19.6);
  group.add(wetSign);
  poster(scene, assets, -7.94, 2.0, 18.5, Math.PI / 2, 0.7, 0.9, 200);
  poster(scene, assets, 7.94, 2.0, 21.5, -Math.PI / 2, 0.7, 0.9, 120);
  grungeDecal(scene, -7.93, 1.0, 22.0, Math.PI / 2, 1.4, 1.2, 71);

  // staff jacket on a hook in the back room (disguise-ish flavour)
  const jacket = mesh(rbox(0.4, 0.7, 0.2, 0.08, 2), assets.mat.fabricBlue, 3.2, 1.4, 26.85);
  group.add(jacket);

  /* ------------------------- interactions --------------------- */
  const interactions = [];

  // Required products are deliberately placed as separate, easy-to-spot
  // packages on real shelf surfaces. The interaction point stays in the aisle
  // so the shelf collider never forces the player to clip through the rack.
  const productSpots = [
    { shelfIndex: 0, level: 1, localX: -0.12, approachX: -3.5, z: 18.2, name: 'хлеб', seed: 3 },
    { shelfIndex: 3, level: 1, localX: 0.12, approachX: 3.5, z: 20.8, name: 'молоко', seed: 5 },
    { shelfIndex: 4, level: 2, localX: -0.16, approachX: -3.5, z: 23.4, name: 'чай', seed: 8 },
    { shelfIndex: 7, level: 2, localX: 0.16, approachX: 3.5, z: 25.8, name: 'печенье', seed: 2 },
    { shelfIndex: 2, level: 0, localX: 0.18, approachX: -3.5, z: 20.8, name: 'консервы', seed: 6 },
  ];
  productSpots.forEach((p, i) => {
    const shelf = shelves[p.shelfIndex];
    const unit = shelf.unit;
    const itemHeight = p.name === 'хлеб' ? 0.26 : 0.3;
    const itemDepth = 0.18;
    const shelfY = 0.12 + p.level * ((2.0 - 0.2) / 4);
    const approachX = shelf.x < 0 ? -3.5 : 3.5;
    const itemGeo = mesh(
      rbox(0.24, itemHeight, itemDepth, 0.028, 3),
      assets.productMaterial('box', p.seed),
      p.localX, shelfY + 0.02 + itemHeight / 2, 0.5 - itemDepth / 2 - 0.035,
    );
    itemGeo.rotation.y = (p.seed % 3 - 1) * 0.045;
    itemGeo.userData.productName = p.name;
    unit.add(itemGeo);
    const marker = new THREE.Mesh(new THREE.RingGeometry(0.14, 0.2, 24), new THREE.MeshBasicMaterial({
      color: 0xffd166, transparent: true, opacity: 0.86, side: THREE.DoubleSide, depthWrite: false,
    }));
    marker.userData.productMarkerFor = p.name;
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(approachX, 0.026, p.z);
    group.add(marker);

    const tagCanvas = document.createElement('canvas');
    tagCanvas.width = 256; tagCanvas.height = 80;
    const tagCtx = tagCanvas.getContext('2d');
    tagCtx.fillStyle = '#101a21'; tagCtx.fillRect(0, 0, 256, 80);
    tagCtx.strokeStyle = '#ffd166'; tagCtx.lineWidth = 7; tagCtx.strokeRect(4, 4, 248, 72);
    tagCtx.fillStyle = '#fff0c4'; tagCtx.font = 'bold 32px Helvetica, Arial, sans-serif';
    tagCtx.textAlign = 'center'; tagCtx.textBaseline = 'middle'; tagCtx.fillText(p.name.toUpperCase(), 128, 41, 238);
    const tagTexture = new THREE.CanvasTexture(tagCanvas);
    tagTexture.colorSpace = THREE.SRGBColorSpace;
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.16), new THREE.MeshBasicMaterial({
      map: tagTexture, side: THREE.DoubleSide, toneMapped: false,
    }));
    tag.position.set(p.localX, shelfY + 0.105, 0.505);
    unit.add(tag);

    interactions.push({
      id: `product${i}`, kind: 'loot', position: new THREE.Vector3(approachX, 1.0, p.z), radius: 1.35,
      label: `Взять ${p.name}`, icon: 'loot', product: p.name, value: 35,
      onUse: (ctx) => {
        if (ctx.flags[`p${i}`]) return { text: 'Здесь уже пусто.' };
        if (ctx.canAddItem && !ctx.canAddItem()) return { text: 'Рюкзак полон. Оставь часть вещей дома.' };
        ctx.flags[`p${i}`] = true;
        ctx.audio.pickup();
        itemGeo.visible = false;
        marker.visible = false;
        tag.visible = false;
        ctx.addItem(p.name, 35, 'product');
        return { text: `${p.name[0].toUpperCase()}${p.name.slice(1)} — в рюкзак. (${ctx.inventory.length}/10)`, pickup: true };
      },
    });
  });

  /* ----------------------- tools / hacking ---------------------- */
  // A small workbench in the stockroom makes the tool hunt legible. The
  // hacking tablet is used at the camera console; lockpicks are optional loot.
  const workbench = new THREE.Group();
  workbench.add(mesh(rbox(1.05, 0.12, 0.62, 0.025, 2), assets.mat.woodOld, 0, 0.72, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    workbench.add(mesh(box(0.06, 0.72, 0.06), assets.mat.metalDark, sx * 0.43, 0.36, sz * 0.24));
  }
  workbench.position.set(1.8, 0, 28.2);
  group.add(workbench);
  colliders.addBox(1.8, 28.2, 0.72, 0.42, 'workbench');

  const tablet = new THREE.Group();
  tablet.add(mesh(rbox(0.3, 0.045, 0.22, 0.025, 3), assets.mat.metalDark, 0, 0, 0));
  tablet.add(mesh(box(0.22, 0.012, 0.14), assets.mat.neonGreen, 0, 0.027, 0.01));
  tablet.add(mesh(box(0.045, 0.014, 0.045), assets.mat.emissiveWarm, 0.105, 0.028, -0.07));
  tablet.position.set(1.75, 0.81, 28.18);
  group.add(tablet);

  const lockpickCase = new THREE.Group();
  lockpickCase.add(mesh(rbox(0.24, 0.045, 0.13, 0.018, 2), assets.mat.leather, 0, 0.025, 0));
  for (let i = 0; i < 3; i++) {
    const pick = mesh(box(0.014, 0.008, 0.1), assets.mat.chrome, -0.06 + i * 0.06, 0.052, 0);
    pick.rotation.y = (i - 1) * 0.08;
    lockpickCase.add(pick);
  }
  lockpickCase.position.set(-1.2, 0, 28.05);
  group.add(lockpickCase);

  const console = new THREE.Group();
  console.add(mesh(rbox(0.42, 0.48, 0.1, 0.025, 2), assets.mat.metalDark, 0, 0, 0));
  console.add(mesh(box(0.27, 0.18, 0.016), assets.mat.glassDark, 0, 0.08, 0.06));
  const consoleLed = mesh(sphere(0.028, 10), assets.mat.neonGreen.clone(), 0.14, -0.14, 0.06);
  console.add(consoleLed);
  console.position.set(-7.82, 1.65, 17.4);
  console.rotation.y = Math.PI / 2;
  group.add(console);

  interactions.push({
    id: 'hackTablet', kind: 'loot', position: new THREE.Vector3(1.75, 1.0, 27.45), radius: 1.35,
    label: 'Взять хак-планшет', icon: 'tool',
    onUse: (ctx) => {
      if (ctx.flags.hackTablet) return { text: 'Планшет уже у тебя.' };
      if (ctx.canAddItem && !ctx.canAddItem()) return { text: 'Рюкзак полон. Освободи место в домашнем хранилище.' };
      ctx.flags.hackTablet = true;
      tablet.visible = false;
      ctx.addItem('Хак-планшет', 0, 'tool');
      ctx.audio.pickup();
      return { text: 'Хак-планшет в рюкзаке. Подключи его к консоли у левой стены.', pickup: true };
    },
  });
  interactions.push({
    id: 'lockpicks', kind: 'loot', position: new THREE.Vector3(-1.2, 0.8, 27.35), radius: 1.35,
    label: 'Взять отмычки', icon: 'tool',
    onUse: (ctx) => {
      if (ctx.flags.lockpicks) return { text: 'Отмычки уже у тебя.' };
      if (ctx.canAddItem && !ctx.canAddItem()) return { text: 'Рюкзак полон. Освободи место в домашнем хранилище.' };
      ctx.flags.lockpicks = true;
      lockpickCase.visible = false;
      ctx.addItem('Отмычки', 0, 'tool');
      ctx.audio.pickup();
      return { text: 'Ты нашёл набор тонких отмычек.', pickup: true };
    },
  });
  interactions.push({
    id: 'cameraConsole', kind: 'hack', position: new THREE.Vector3(-6.75, 1.55, 17.4), radius: 1.45,
    label: 'Взломать камеры (45 сек)', icon: 'hack',
    onUse: (ctx) => {
      if (!ctx.hasItem('Хак-планшет')) return { text: 'Нужен хак-планшет из подсобки.' };
      if (ctx.time < (ctx.flags.camerasDisabledUntil ?? 0)) return { text: 'Камеры уже отключены.' };
      ctx.flags.camerasDisabledUntil = ctx.time + 45;
      consoleLed.material.color.setHex(0x39ff9a);
      ctx.audio.tone({ freq: 740, dur: 0.12, type: 'triangle', gain: 0.08 });
      return { text: 'Камеры отключены на 45 секунд. Действуй быстро.' };
    },
  });

  // checkout A drawer (cashier present during the day)
  interactions.push({
    id: 'drawerA', kind: 'loot', position: new THREE.Vector3(-6.9, 1.15, 16.9), radius: 1.8,
    label: 'Открыть кассу', icon: 'cash', money: 340, risky: true,
    onUse: (ctx) => {
      if (ctx.flags.drawerA) return { text: 'Касса пуста.' };
      ctx.flags.drawerA = true;
      ctx.audio.drawer();
      drawerA.userData.tray.position.z = 0.22;
      ctx.audio.coins();
      ctx.addMoney(340);
      return { text: 'Из кассы исчезло 340 ₴.', money: 340, _credited: true, noise: 0.45 };
    },
  });
  interactions.push({
    id: 'drawerB', kind: 'loot', position: new THREE.Vector3(6.9, 1.15, 16.9), radius: 1.8,
    label: 'Открыть кассу', icon: 'cash', money: 210, risky: true,
    onUse: (ctx) => {
      if (ctx.flags.drawerB) return { text: 'Касса пуста.' };
      ctx.flags.drawerB = true;
      ctx.audio.drawer();
      drawerB.userData.tray.position.z = 0.22;
      ctx.audio.coins();
      ctx.addMoney(210);
      return { text: 'Из второй кассы — 210 ₴.', money: 210, _credited: true, noise: 0.45 };
    },
  });

  // Manually open the stockroom door. The player must reach the handle;
  // walking straight through a closed staff door is never allowed.
  interactions.push({
    id: 'stockroomDoor', kind: 'door', position: new THREE.Vector3(0.5, 1.0, 26.2), radius: 1.1,
    label: 'Открыть дверь подсобки', icon: 'door',
    onUse: (ctx) => {
      if (!backDoorCollider.active) return { text: 'Дверь подсобки уже открыта.' };
      backDoorCollider.active = false;
      backDoorPivot.rotation.y = -Math.PI / 2;
      ctx.flags.stockroomDoorOpen = true;
      ctx.audio.creak();
      return { text: 'Дверь тихо открылась. Внутри охранник и сейф.' };
    },
  });

  // safe in the back room
  interactions.push({
    id: 'safe', kind: 'safe', position: new THREE.Vector3(-6.0, 1.1, 27.3), radius: 1.9,
    label: 'Открыть сейф', icon: 'safe', money: 900, risky: true,
    onUse: (ctx) => {
      if (ctx.flags.safe) return { text: 'Сейф пуст.' };
      const hasTools = ctx.hasItem('Отмычки') || ctx.hasItem('Хак-планшет');
      if (!ctx.flags.note && !hasTools) return { text: 'Кодовый замок закрыт: найди записку с кодом или инструменты в подсобке.' };
      ctx.flags.safe = true;
      safeDoor.rotation.y = -1.6;
      safeCollider.maxX += 0.6;
      ctx.audio.coins();
      ctx.audio.success();
      ctx.addMoney(900);
      const openedBy = ctx.flags.note ? 'Код подошёл.' : 'Ты обошёл замок инструментом.';
      return { text: `${openedBy} Внутри 900 ₴ выручки.`, money: 900, _credited: true, noise: 0.7 };
    },
  });
  // the note with the code
  interactions.push({
    id: 'note', kind: 'read', position: new THREE.Vector3(1.75, 1.5, 26.2), radius: 1.2,
    label: 'Прочитать объявление', icon: 'note',
    onUse: (ctx) => {
      ctx.flags.note = true;
      return { text: 'Код сейфа: 4-3-7-1. Запомнили.', note: true };
    },
  });
  // The entrance is an automatic sliding door (proximity driven by the game).

  const openDoors = () => {
    doorLeft.position.x = 2.2;
    doorRight.position.x = 3.8;
    doorCollider.active = false;
  };
  const resetDoors = () => {
    doorLeft.position.x = 2.66;
    doorRight.position.x = 3.34;
    doorCollider.active = true;
  };

  return {
    group, H, interactions, cameras, shelves, resetDoors, openDoors, doorCollider, backDoorCollider,
    cameraConsoleLed: consoleLed,
    cashierSpot: new THREE.Vector3(-6.2, 0, 17.6),
    guardSpawn: new THREE.Vector3(0, 0, 22.5),
    entrance: new THREE.Vector3(3.0, 0, 13.4),
    backDoorPivot,
  };
}
