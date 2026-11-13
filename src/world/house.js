import * as THREE from 'three';
import {
  makeBed, makeNightstand, makeWardrobe, makeSofa, makeCoffeeTable, makeChair, makeDiningTable,
  makeFridge, makeCounter, makeSink, makeWindowLit, makeDoor, makeCeilingBulb, contactShadow,
  mesh, box, rbox, cyl, sphere, makeCrate,
} from '../core/props.js';
import { floorPatch, ceilingPatch, wall, poster, grungeDecal, curtains, makeCardboardBox, glassPane } from './common.js';
import { makeRng, randRange } from '../core/util.js';

/**
 * The old family house: cramped bedroom, hallway with the front door,
 * a lived-in living room and a tiny kitchen. The player wakes up here.
 *
 * Layout (metres): x -6..4, z -8..2, ceiling 2.7
 *   bedroom   x -6..4, z -8..-2   (door at x 1.2, z -2)
 *   living    x -6..0.5, z -2..2
 *   kitchen   x 0.5..4, z -2..2
 *   front door at z 2, x -3.4
 */
export function buildHouse(scene, assets, colliders, lights, opts) {
  const R = makeRng(2024);
  const group = new THREE.Group();
  group.name = 'house';
  scene.add(group);

  const W = { x0: -6, x1: 4, z0: -8, z1: 2, h: 2.7 };

  /* --------------------------- floors -------------------------- */
  floorPatch(scene, assets, assets.mat.woodFloor, W.x0 - 0.1, W.x1 + 0.1, W.z0 - 0.1, W.z1 + 0.1, 0, 0.32);
  // kitchen tile overlay
  floorPatch(scene, assets, assets.mat.tile, 0.5, W.x1, -2, W.z1, 0.004, 0.5);
  ceilingPatch(scene, new THREE.MeshStandardMaterial({ color: 0xb0a894, roughness: 1 }), W.x0, W.x1, W.z0, W.z1, W.h);

  /* ---------------------------- walls -------------------------- */
  // back wall (bedroom, z = -8) with a small window
  wall(scene, colliders, assets, {
    axis: 'x', fixed: W.z0, from: W.x0, to: W.x1, height: W.h,
    mat: assets.mat.wallpaper,
    gaps: [{ at: -2.0, width: 1.3, type: 'window', sill: 1.1, height: 1.15 }],
  });
  // west wall
  wall(scene, colliders, assets, {
    axis: 'z', fixed: W.x0, from: W.z0, to: W.z1, height: W.h, mat: assets.mat.wallpaper,
    gaps: [{ at: -4.6, width: 1.1, type: 'window', sill: 1.0, height: 1.2 }],
  });
  // east wall
  wall(scene, colliders, assets, {
    axis: 'z', fixed: W.x1, from: W.z0, to: W.z1, height: W.h,
    gaps: [{ at: 0.2, width: 0.9, type: 'window', sill: 1.2, height: 0.9 }],
  });
  // front wall z = 2, front door + kitchen window
  wall(scene, colliders, assets, {
    axis: 'x', fixed: W.z1, from: W.x0, to: W.x1, height: W.h, mat: assets.mat.wallpaper,
    gaps: [
      { at: -3.4, width: 1.05, type: 'door', height: 2.1 },
      { at: 2.3, width: 1.0, type: 'window', sill: 1.15, height: 0.9 },
    ],
  });
  // bedroom / rest wall z = -2 with a doorway
  wall(scene, colliders, assets, {
    axis: 'x', fixed: -2, from: W.x0, to: W.x1, height: W.h, mat: assets.mat.plaster,
    gaps: [{ at: 1.2, width: 1.0, type: 'door', height: 2.1 }],
  });
  // living / kitchen partition x = 0.5 with a wide opening
  wall(scene, colliders, assets, {
    axis: 'z', fixed: 0.5, from: -2, to: 2, height: W.h, mat: assets.mat.plaster,
    gaps: [{ at: 0.4, width: 1.6, type: 'door', height: 2.2 }],
  });

  /* ------------------------- glass panes ----------------------- */
  glassPane(scene, assets, { axis: 'x', fixed: W.z0 + 0.02, at: -2.0, width: 1.3, sill: 1.1, height: 1.15, lit: 0.55 });
  glassPane(scene, assets, { axis: 'z', fixed: W.x0 - 0.02, at: -4.6, width: 1.1, sill: 1.0, height: 1.2, lit: 0.4 });
  glassPane(scene, assets, { axis: 'z', fixed: W.x1 + 0.02, at: 0.2, width: 0.9, sill: 1.2, height: 0.9, lit: 0.25 });
  glassPane(scene, assets, { axis: 'x', fixed: W.z1 - 0.02, at: 2.3, width: 1.0, sill: 1.15, height: 0.9, lit: 0.3 });
  curtains(scene, assets, W.x0 + 0.12, 1.2, -4.6, 1.3, Math.PI / 2, 0x5a4030);
  curtains(scene, assets, -2.0, 1.25, W.z0 + 0.12, 1.4, 0, 0x6a4a38);

  /* --------------------------- bedroom ------------------------- */
  // bed under the back window, headboard against the west wall
  const bed = makeBed(assets, { width: 1.05, length: 2.05, height: 0.5 });
  bed.position.set(-4.2, 0, -5.3);
  bed.rotation.y = Math.PI / 2 + Math.PI; // headboard at x = -5.2
  group.add(bed);
  const bedCollider = colliders.addBox(-4.2, -5.3, 2.1, 1.1, 'bed');

  const nightstand = makeNightstand(assets);
  nightstand.position.set(-4.9, 0, -3.7);
  nightstand.rotation.y = -Math.PI / 2;
  group.add(nightstand);
  const nightstandCollider = colliders.addBox(-4.9, -3.7, 0.45, 0.5, 'furniture');

  // lamp on the nightstand + warm bedroom bulb
  const lampGroup = new THREE.Group();
  lampGroup.add(mesh(cyl(0.09, 0.11, 0.03, 14), assets.mat.metalDark, 0, 0.015, 0));
  lampGroup.add(mesh(cyl(0.02, 0.02, 0.22, 8), assets.mat.metal, 0, 0.12, 0));
  const shade = new THREE.Mesh(cyl(0.11, 0.16, 0.16, 16, true), new THREE.MeshStandardMaterial({
    color: 0xf0dcc0, roughness: 0.9, side: THREE.DoubleSide, emissive: 0xffb672, emissiveIntensity: 0.5,
  }));
  shade.position.y = 0.28;
  lampGroup.add(shade);
  lampGroup.position.set(-4.9, 0.6, -3.7);
  group.add(lampGroup);
  const lamp = new THREE.PointLight(0xffbb77, 5.5, 6, 2);
  lamp.position.set(-4.75, 0.92, -3.7);
  lamp.castShadow = false;
  group.add(lamp);
  lights.push(lamp);

  // wardrobe
  const wardrobe = makeWardrobe(assets);
  wardrobe.position.set(2.6, 0, -7.2);
  group.add(wardrobe);
  colliders.addBox(2.6, -7.2, 1.05, 0.6, 'furniture');
  // open wardrobe door with clothes inside
  const clothes = new THREE.Group();
  const shirtCols = [0x8b3f3f, 0x3f5d8b, 0x6b6b4a, 0x8b7a3f, 0x4a4a55];
  for (let i = 0; i < 7; i++) {
    const c = new THREE.MeshStandardMaterial({ color: shirtCols[i % shirtCols.length], roughness: 0.95 });
    const s = mesh(rbox(0.18, 0.62, 0.1, 0.04, 2), c, 2.25 + (i % 4) * 0.16, 1.25, -2.8 + Math.floor(i / 4) * 0.16);
    s.rotation.z = randRange(R, -0.06, 0.06);
    clothes.add(s);
  }
  group.add(clothes);

  // rug
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.7),
    new THREE.MeshStandardMaterial({ color: 0x6a4a52, roughness: 1 }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(-1.2, 0.008, -4.6);
  rug.receiveShadow = true;
  group.add(rug);
  // rug fringe pattern
  const rugBorder = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 24), new THREE.MeshStandardMaterial({ color: 0x8a6a68, roughness: 1 }));
  rugBorder.rotation.x = -Math.PI / 2;
  rugBorder.scale.set(1.5, 1.05, 1);
  rugBorder.position.set(-1.2, 0.009, -4.6);
  group.add(rugBorder);

  // cardboard boxes (just moved in)
  [[-0.2, -7.3, 0.55, 1], [0.5, -7.2, 0.45, 2], [-5.3, -6.6, 0.5, 3]].forEach(([x, z, s, seed]) => {
    const b = makeCardboardBox(assets, s, seed);
    b.position.set(x, 0, z);
    group.add(b);
    colliders.addBox(x, z, s, s, 'furniture');
  });

  // poster, damp patches
  poster(scene, assets, W.x0 + 0.02, 1.75, -6.6, Math.PI / 2, 0.5, 0.66, 15);
  poster(scene, assets, 1.0, 1.8, W.z0 + 0.03, 0, 0.55, 0.7, 34);
  grungeDecal(scene, W.x0 + 0.03, 0.7, -3.0, Math.PI / 2, 1.2, 1.0, 7);
  grungeDecal(scene, 3.2, 2.2, W.z0 + 0.04, 0, 1.4, 0.9, 12);

  // ceiling bulb + cool dawn light from the window
  const bedBulb = makeCeilingBulb(assets, 0.55, 0xffca8a);
  bedBulb.position.set(-1.4, W.h - 0.05, -5.0);
  group.add(bedBulb);
  const bulbLight = new THREE.PointLight(0xffc078, 7, 9, 2);
  bulbLight.position.set(-1.4, W.h - 0.75, -5.0);
  group.add(bulbLight);
  lights.push(bulbLight);

  /* --------------------------- hallway ------------------------- */
  // front door (opens inward)
  const frontDoorPivot = new THREE.Group();
  frontDoorPivot.position.set(-3.92, 0, W.z1 - 0.06);
  const frontDoor = makeDoor(assets, 1.0, 2.08);
  frontDoor.position.set(0.5, 0, 0);
  frontDoorPivot.add(frontDoor);
  group.add(frontDoorPivot);
  const doorCollider = colliders.addBounds(-4.0, -2.85, W.z1 - 0.15, W.z1 + 0.05, 'door');

  // coat rack
  const rack = new THREE.Group();
  rack.add(mesh(cyl(0.03, 0.04, 1.75, 8), assets.mat.woodOld, 0, 0.87, 0));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const peg = mesh(cyl(0.012, 0.012, 0.16, 6), assets.mat.woodWarm, Math.cos(a) * 0.08, 1.6, Math.sin(a) * 0.08);
    peg.rotation.z = Math.PI / 2 - 0.5; peg.rotation.y = a;
    rack.add(peg);
  }
  const coat = mesh(rbox(0.42, 0.75, 0.22, 0.09, 2), assets.mat.fabricGrey, 0.1, 1.15, 0);
  coat.rotation.z = 0.05;
  rack.add(coat);
  rack.position.set(-5.3, 0, 1.3);
  group.add(rack);
  colliders.addBox(-5.3, 1.3, 0.4, 0.4, 'furniture');

  // shoes by the door
  for (let i = 0; i < 3; i++) {
    const shoe = mesh(rbox(0.12, 0.09, 0.28, 0.03, 2), i === 1 ? assets.mat.leather : assets.mat.rubber,
      -4.5 + i * 0.22, 0.045, 1.62 + randRange(R, -0.06, 0.06));
    shoe.rotation.y = randRange(R, -0.5, 0.5);
    group.add(shoe);
  }

  // mirror
  const mirrorFrame = mesh(rbox(0.5, 0.9, 0.04, 0.02), assets.mat.woodOld, -5.85, 1.5, 0.2);
  mirrorFrame.rotation.y = Math.PI / 2;
  group.add(mirrorFrame);
  const mirror = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.82),
    new THREE.MeshStandardMaterial({ color: 0x9fb0b8, roughness: 0.08, metalness: 1 }));
  mirror.rotation.y = Math.PI / 2;
  mirror.position.set(-5.83, 1.5, 0.2);
  group.add(mirror);

  // hall light
  const hallBulb = makeCeilingBulb(assets, 0.5, 0xffd2a0);
  hallBulb.position.set(-3.0, W.h - 0.05, 0.6);
  group.add(hallBulb);
  const hallLight = new THREE.PointLight(0xffc890, 4.5, 7, 2);
  hallLight.position.set(-3.0, W.h - 0.7, 0.6);
  group.add(hallLight);
  lights.push(hallLight);

  /* ------------------------- living room ----------------------- */
  const sofa = makeSofa(assets, { width: 2.2, fabric: 'fabricRed' });
  sofa.position.set(-4.1, 0, -0.2);
  sofa.rotation.y = Math.PI / 2;
  group.add(sofa);
  colliders.addBox(-4.1, -0.2, 0.95, 2.2, 'sofa');

  const coffee = makeCoffeeTable(assets);
  coffee.position.set(-2.4, 0, -0.2);
  group.add(coffee);
  colliders.addBox(-2.4, -0.2, 1.15, 0.66, 'furniture');

  // old CRT television on a low cabinet
  const tvCab = mesh(rbox(1.1, 0.5, 0.45, 0.02), assets.mat.woodWarm, -0.4, 0.25, -1.55);
  group.add(tvCab);
  colliders.addBox(-0.4, -1.55, 1.1, 0.45, 'furniture');
  const tv = new THREE.Group();
  tv.add(mesh(rbox(0.62, 0.5, 0.5, 0.05, 2), assets.mat.metalDark, 0, 0, 0));
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x10161c, roughness: 0.15, metalness: 0.2, emissive: 0x16242e, emissiveIntensity: 0.6 });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.36), screenMat);
  screen.position.z = 0.253;
  tv.add(screen);
  tv.add(mesh(box(0.03, 0.03, 0.02), assets.mat.neonGreen, 0.24, -0.18, 0.25));
  tv.position.set(-0.4, 0.75, -1.55);
  tv.rotation.y = 0.25;
  group.add(tv);
  const tvGlow = new THREE.PointLight(0x3e6b8a, 1.6, 3.5, 2);
  tvGlow.position.set(-0.4, 0.85, -1.2);
  group.add(tvGlow);

  // bookshelf with real books
  const shelf = new THREE.Group();
  shelf.add(mesh(rbox(1.0, 1.5, 0.32, 0.02), assets.mat.woodOld, 0, 0.75, 0));
  for (let l = 0; l < 3; l++) {
    shelf.add(mesh(box(0.94, 0.03, 0.3), assets.mat.woodWarm, 0, 0.42 + l * 0.42, 0));
    let x = -0.42;
    while (x < 0.42) {
      const w = randRange(R, 0.03, 0.06), h = randRange(R, 0.18, 0.28);
      const col = new THREE.Color().setHSL(randRange(R, 0, 1), 0.3, randRange(R, 0.2, 0.5));
      const b = mesh(box(w, h, 0.22), new THREE.MeshStandardMaterial({ color: col, roughness: 0.9 }),
        x + w / 2, 0.44 + l * 0.42 + h / 2, 0);
      b.rotation.z = R() < 0.12 ? 0.25 : 0;
      shelf.add(b);
      x += w + 0.006;
    }
  }
  // Keep the narrow bedroom doorway clear. This bookcase sits against the
  // living-room side of the partition instead of crowding the kitchen exit.
  shelf.position.set(-1.55, 0, -1.5);
  shelf.rotation.y = Math.PI / 2;
  group.add(shelf);
  const shelfCollider = colliders.addBox(-1.55, -1.5, 0.34, 1.05, 'furniture');

  // living room rug + floor lamp
  const rug2 = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.6), new THREE.MeshStandardMaterial({ color: 0x5b5142, roughness: 1 }));
  rug2.rotation.x = -Math.PI / 2; rug2.position.set(-3.2, 0.008, -0.2); rug2.receiveShadow = true;
  group.add(rug2);
  const floorLamp = new THREE.Group();
  floorLamp.add(mesh(cyl(0.16, 0.18, 0.03, 16), assets.mat.metalDark, 0, 0.02, 0));
  floorLamp.add(mesh(cyl(0.015, 0.015, 1.5, 8), assets.mat.metalDark, 0, 0.76, 0));
  const fShade = new THREE.Mesh(cyl(0.16, 0.22, 0.24, 16, true), new THREE.MeshStandardMaterial({
    color: 0xe8dcc0, roughness: 0.95, side: THREE.DoubleSide, emissive: 0xffcc88, emissiveIntensity: 0.7,
  }));
  fShade.position.y = 1.55;
  floorLamp.add(fShade);
  floorLamp.position.set(-5.45, 0, -0.75);
  group.add(floorLamp);
  const floorLampLight = new THREE.PointLight(0xffcf9a, 5, 5.5, 2);
  floorLampLight.position.set(-5.45, 1.5, -0.75);
  group.add(floorLampLight);
  lights.push(floorLampLight);

  // radiator under the front window
  const rad = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    rad.add(mesh(rbox(0.06, 0.5, 0.09, 0.02), assets.mat.plasticWhite, i * 0.075, 0.35, 0));
  }
  rad.position.set(-5.72, 0, 0.2);
  rad.rotation.y = Math.PI / 2;
  group.add(rad);

  /* --------------------------- kitchen ------------------------- */
  const counter = makeCounter(assets, 2.0, 0.6, 0.9);
  counter.position.set(2.9, 0, -1.68);
  group.add(counter);
  colliders.addBox(2.9, -1.68, 2.0, 0.62, 'furniture');

  const sink = makeSink(assets);
  sink.position.set(2.4, 0.9, -1.68);
  group.add(sink);

  const fridge = makeFridge(assets);
  // Tuck the fridge against the east kitchen wall, facing the room. The old
  // position sat directly beyond the bedroom door and made the doorway feel
  // blocked even though the door opening itself was clear.
  fridge.position.set(3.55, 0, 0.15);
  fridge.rotation.y = -Math.PI / 2;
  group.add(fridge);
  const fridgeCollider = colliders.addBox(3.55, 0.15, 0.68, 0.7, 'furniture');

  const table = makeDiningTable(assets);
  table.position.set(2.4, 0, 0.5);
  group.add(table);
  colliders.addBox(2.4, 0.5, 1.32, 0.92, 'furniture');
  const chairA = makeChair(assets); chairA.position.set(2.4, 0, 1.25); chairA.rotation.y = Math.PI; group.add(chairA);
  const chairB = makeChair(assets); chairB.position.set(2.4, 0, -0.28); group.add(chairB);
  colliders.addBox(2.4, 1.25, 0.46, 0.46, 'furniture');
  colliders.addBox(2.4, -0.28, 0.46, 0.46, 'furniture');

  // kettle + cups
  const kettle = new THREE.Group();
  kettle.add(mesh(cyl(0.09, 0.11, 0.2, 14), assets.mat.metal, 0, 0.1, 0));
  kettle.add(mesh(cyl(0.03, 0.03, 0.14, 8), assets.mat.metal, 0.06, 0.19, 0.06));
  kettle.position.set(2.85, 0.78, 0.35);
  group.add(kettle);

  // hanging pots + a window over the sink already exists
  const potRack = new THREE.Group();
  potRack.add(mesh(cyl(0.012, 0.012, 0.9, 6), assets.mat.metalDark, 0, 0, 0));
  potRack.children[0].rotation.z = Math.PI / 2;
  for (let i = 0; i < 3; i++) {
    const p = mesh(cyl(0.09, 0.07, 0.1, 12), i % 2 ? assets.mat.metal : assets.mat.rust, -0.3 + i * 0.3, -0.14, 0);
    potRack.add(p);
  }
  potRack.position.set(2.6, 2.15, -1.4);
  group.add(potRack);

  const kitchenBulb = makeCeilingBulb(assets, 0.45, 0xfff0d0);
  kitchenBulb.position.set(2.4, W.h - 0.05, -0.6);
  group.add(kitchenBulb);
  const kitchenLight = new THREE.PointLight(0xfff0d0, 6, 7, 2);
  kitchenLight.position.set(2.4, W.h - 0.7, -0.6);
  group.add(kitchenLight);
  lights.push(kitchenLight);

  /* ---------------------- interactive props -------------------- */
  const interactions = [];

  // nightstand drawer -> starter cash
  interactions.push({
    id: 'drawer', kind: 'loot', position: new THREE.Vector3(-4.62, 0.72, -3.7),
    radius: 1.6, label: 'Открыть ящик тумбочки', icon: 'drawer',
    money: 120,
    onUse: (ctx) => {
      const drawer = nightstand.userData.drawer;
      ctx.audio.drawer();
      if (!ctx.flags.drawer) {
        ctx.flags.drawer = true;
        drawer.position.z += 0.26; // walks out toward the room (+local z)
        nightstandCollider.maxZ += 0.26;
        ctx.audio.coins();
        return { text: 'В ящике — 120 ₴. Мама оставила на хлеб…', money: 120 };
      }
      return { text: 'Больше ничего нет.' };
    },
  });

  // coat pocket
  interactions.push({
    id: 'coat', kind: 'loot', position: new THREE.Vector3(-5.15, 1.15, 1.3), radius: 1.4,
    label: 'Проверить карман пальто', icon: 'search', money: 60,
    onUse: (ctx) => {
      if (!ctx.flags.coat) {
        ctx.flags.coat = true;
        ctx.audio.coins();
        return { text: 'В кармане пальто нашлось 60 ₴ мелочью.', money: 60 };
      }
      return { text: 'Пусто.' };
    },
  });

  // kitchen jar
  interactions.push({
    id: 'jar', kind: 'loot', position: new THREE.Vector3(3.35, 0.95, -1.62), radius: 1.4,
    label: 'Взять банку с монетами', icon: 'loot', money: 90,
    onUse: (ctx) => {
      if (!ctx.flags.jar) {
        ctx.flags.jar = true;
        ctx.audio.coins();
        return { text: 'Банка с монетами: 90 ₴.', money: 90 };
      }
      return { text: 'Банка уже пуста.' };
    },
  });

  // front door -> go outside
  const doorInteract = {
    id: 'frontDoor', kind: 'door', position: new THREE.Vector3(-3.4, 1.1, 1.6), radius: 1.7,
    label: 'Выйти на улицу', icon: 'door',
    onUse: (ctx) => {
      frontDoorPivot.rotation.y = Math.PI * 0.62;
      doorCollider.active = false;
      ctx.audio.creak();
      return { text: 'Дверь скрипнула. На улице холодно.', event: 'exitHouse' };
    },
  };
  interactions.push(doorInteract);

  // light switch: toggles the bedroom bulb
  interactions.push({
    id: 'lightSwitch', kind: 'switch', position: new THREE.Vector3(3.65, 1.35, -2.1), radius: 1.3,
    label: 'Выключить свет', icon: 'switch',
    onUse: (ctx) => {
      bulbLight.visible = !bulbLight.visible;
      bedBulb.userData.bulb.material.color.setHex(bulbLight.visible ? 0xffca8a : 0x3a3028);
      ctx.audio.tone({ freq: 1200, dur: 0.05, type: 'square', gain: 0.05 });
      return { text: bulbLight.visible ? 'Свет включён.' : 'Свет выключен. Темно…' };
    },
  });

  return {
    group,
    W,
    interactions,
    spawn: new THREE.Vector3(-4.2, 0, -4.4),
    bedroomDoorway: new THREE.Vector3(1.2, 0, -2.0),
    bedPosition: new THREE.Vector3(-4.2, 0.6, -5.3),
    bedCollider,
    fridgeCollider,
    shelfCollider,
    doorPivot: frontDoorPivot,
    doorCollider,
    bedroomLight: bulbLight,
    surfaces: { floor: 'wood' },
  };
}
