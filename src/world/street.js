import * as THREE from 'three';
import { mesh, box, rbox, cyl, sphere, makeStreetLamp, makeCar, makeTrashBin, makeWindowLit, makeCrate } from '../core/props.js';
import { floorPatch, grungeDecal } from './common.js';
import { makeRng, randRange } from '../core/util.js';

/**
 * The street between the house (z = +2) and the shop (z = -26 on the far
 * side). Sidewalks, asphalt, street lamps with real lights, parked cars,
 * neighbouring facades and an alley shortcut that a guard patrols.
 *
 * World layout:
 *   house front      z = +2 .. +4   (sidewalk)
 *   road             z = +4 .. +12
 *   shop sidewalk    z = +12 .. +14
 *   shop front       z = +14
 */
export function buildStreet(scene, assets, colliders, lights, opts = {}) {
  const R = makeRng(4242);
  const group = new THREE.Group();
  group.name = 'street';
  scene.add(group);

  const ROAD = { z0: 4, z1: 12, x0: -30, x1: 30 };

  // ground: grass behind the buildings, sidewalks, asphalt
  floorPatch(scene, assets, assets.mat.grass, -40, 40, -60, 60, -0.02, 0.5);
  floorPatch(scene, assets, assets.mat.sidewalk, -30, 30, 2.0, 4, 0.001, 0.5);
  floorPatch(scene, assets, assets.mat.asphalt, ROAD.x0, ROAD.x1, ROAD.z0, ROAD.z1, 0.0, 0.25);
  floorPatch(scene, assets, assets.mat.sidewalk, -30, 30, 12, 14.2, 0.001, 0.5);

  // curbs
  for (const z of [4, 12]) {
    const curb = mesh(box(60, 0.16, 0.18), assets.mat.concrete, 0, 0.08, z);
    group.add(curb);
  }
  // road markings
  for (let x = -28; x < 28; x += 4) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.14),
      new THREE.MeshBasicMaterial({ color: 0xcfc6a8, transparent: true, opacity: 0.35 }));
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(x, 0.005, 8);
    group.add(dash);
  }
  // manhole + puddles
  const manhole = new THREE.Mesh(new THREE.CircleGeometry(0.4, 20),
    new THREE.MeshStandardMaterial({ color: 0x3a3a38, roughness: 0.7, metalness: 0.4 }));
  manhole.rotation.x = -Math.PI / 2;
  manhole.position.set(2.5, 0.006, 9.4);
  group.add(manhole);
  for (let i = 0; i < 7; i++) {
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(randRange(R, 0.5, 1.3), 18),
      new THREE.MeshStandardMaterial({ color: 0x0d1620, roughness: 0.06, metalness: 0.85, transparent: true, opacity: 0.75 }));
    puddle.rotation.x = -Math.PI / 2;
    puddle.scale.set(1, randRange(R, 0.4, 0.8), 1);
    puddle.position.set(randRange(R, -24, 24), 0.008, randRange(R, 5, 11.5));
    group.add(puddle);
  }

  /* ----------------------- facades across ---------------------- */
  // opposite side of the street (south of the house) — closed shop fronts
  const southFacade = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const w = randRange(R, 4, 6.5);
    const h = randRange(R, 6, 11);
    const x = -26 + i * 7.4;
    const b = mesh(box(w, h, 0.4), i % 2 ? assets.mat.brick : assets.mat.concrete, x, h / 2, -1.6 - 0.35);
    southFacade.add(b);
    for (let f = 0; f < Math.floor(h / 3); f++) {
      const lit = R() < 0.35;
      const win = makeWindowLit(assets, 0.9, 1.1, lit);
      win.position.set(x + randRange(R, -w * 0.25, w * 0.25), 2.2 + f * 2.9, -1.35);
      southFacade.add(win);
    }
  }
  group.add(southFacade);

  // north side: our house facade (already has the player's wall at z=2), so
  // add neighbouring houses left/right of it for a street feel.
  const houseFacade = (x, w, col) => {
    const g = new THREE.Group();
    const h = randRange(R, 5.5, 8.5);
    g.add(mesh(box(w, h, 3.0), col, x, h / 2, 0.4));
    // roof
    const roof = mesh(box(w + 0.5, 0.3, 3.4), assets.mat.roof, x, h + 0.15, 0.4);
    g.add(roof);
    for (let f = 0; f < Math.floor(h / 3); f++) {
      const win = makeWindowLit(assets, 0.85, 1.05, R() < 0.55);
      win.position.set(x + randRange(R, -w * 0.25, w * 0.25), 2.4 + f * 2.8, 1.95);
      g.add(win);
    }
    // door
    const door = mesh(rbox(1.0, 2.1, 0.1, 0.02), assets.mat.woodWarm, x + w * 0.25, 1.05, 1.93);
    g.add(door);
    group.add(g);
    return g;
  };
  houseFacade(-10.5, 7, assets.mat.brick);
  houseFacade(10.5, 8, assets.mat.concrete);
  houseFacade(-18, 6, assets.mat.plaster);

  /* -------------------------- street lamps ---------------------- */
  const lampPositions = [[-12, 4.6], [0, 4.6], [12, 4.6], [-6, 11.4], [6, 11.4], [18, 11.4], [-20, 11.4]];
  lampPositions.forEach(([x, z], i) => {
    const lampProp = makeStreetLamp(assets);
    lampProp.position.set(x, 0, z);
    lampProp.rotation.y = z > 8 ? Math.PI : 0;
    group.add(lampProp);
    // one real light for the closest lamp only (perf), rest faked with sprites
    const dist = Math.hypot(x - 0, z - 8);
    const p = new THREE.PointLight(0xffd9a0, dist < 9 ? 14 : 0.0, 16, 2);
    const wp = lampProp.userData.lampPos.clone().add(lampProp.position);
    p.position.copy(wp);
    group.add(p);
    if (dist < 9) lights.push(p);
    // glow sprite
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: assets.tex.glow, color: 0xffcf8a, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sprite.scale.setScalar(2.4);
    sprite.position.copy(wp);
    group.add(sprite);
    colliders.addBox(x, z, 0.24, 0.24, 'lamp');
  });

  /* ----------------------------- cars --------------------------- */
  const cars = [
    { x: -7.5, z: 5.4, ry: Math.PI, color: 0x1d3a5c },
    { x: 8.5, z: 10.9, ry: 0, color: 0x5c1d1d },
    { x: 17, z: 5.2, ry: Math.PI, color: 0x3d3f45 },
  ];
  cars.forEach((c) => {
    const car = makeCar(assets, c.color);
    car.position.set(c.x, 0, c.z);
    car.rotation.y = c.ry;
    group.add(car);
    colliders.addBox(c.x, c.z, 1.9, 4.0, 'car');
  });

  // bins + crates in an alley between the house and its neighbour
  for (const [x, z] of [[-6.6, 3.0], [6.2, 12.9], [-14.5, 3.1]]) {
    const bin = makeTrashBin(assets);
    bin.position.set(x, 0, z);
    group.add(bin);
    colliders.addBox(x, z, 0.5, 0.5, 'bin');
  }
  for (let i = 0; i < 3; i++) {
    const crate = makeCrate(assets, 20 + i);
    crate.position.set(13.2 + (i % 2) * 0.65, 0, 13.2 + Math.floor(i / 2) * 0.6);
    group.add(crate);
    colliders.addBox(crate.position.x, crate.position.z, 0.6, 0.6, 'crate');
  }

  // a parked van near the shop — good cover and a landmark
  const van = new THREE.Group();
  van.add(mesh(rbox(2.0, 2.0, 4.6, 0.14, 3), new THREE.MeshStandardMaterial({ color: 0x8a8f95, roughness: 0.5, metalness: 0.4 }), 0, 1.15, 0));
  van.add(mesh(box(1.9, 0.9, 1.5), assets.mat.glassDark, 0, 1.9, 1.3));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const tire = mesh(cyl(0.36, 0.36, 0.24, 16), assets.mat.rubber, sx * 0.95, 0.36, sz * 1.5);
    tire.rotation.z = Math.PI / 2;
    van.add(tire);
  }
  van.position.set(-4.5, 0, 12.6);
  van.rotation.y = 0.06;
  group.add(van);
  colliders.addBox(-4.5, 12.6, 2.2, 4.8, 'van');

  // graffiti-ish decals on the north facade
  grungeDecal(scene, 5.5, 1.6, 1.98, 0, 2.0, 1.4, 33);
  grungeDecal(scene, -8.4, 1.4, 1.98, 0, 1.6, 1.2, 44);

  return { group, ROAD, lampPositions, facadeZ: 14 };
}
