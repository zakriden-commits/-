import * as THREE from 'three';
import { rbox, box, cyl, sphere, mesh } from './props.js';
import { clamp, damp, makeRng, randRange } from './util.js';

/**
 * A rigged low-poly human with rounded limbs, a proper face and a small
 * procedural animation set (idle, walk, sneak-walk, guard patrol, sit,
 * run). Built from limb groups so joints bend instead of a blocky body
 * swinging as one piece.
 */
export class Humanoid {
  constructor(assets, opts = {}) {
    const {
      skin = 0xc99a72, shirt = 0x3f6f8a, pants = 0x2a3242, shoes = 0x1a1a1d,
      hair = 0x2a1f16, hairStyle = 'short', beard = false, height = 1.0, kind = 'adult', apron = null, hat = null,
      vest = null, badge = null, seed = 1, cap = null, scarf = null,
    } = opts;

    this.assets = assets;
    this.rng = makeRng(seed);
    this.gaitTempo = randRange(this.rng, 0.92, 1.08);
    this.armSwingScale = randRange(this.rng, 0.88, 1.16);
    this.heightScale = height;
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);

    const M = assets.mat;
    const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.62, metalness: 0.0 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.88 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.9 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: shoes, roughness: 0.6 });
    const hairMat = new THREE.MeshStandardMaterial({ color: hair, roughness: 0.75 });
    this.mats = { skinMat, shirtMat, pantsMat, shoeMat, hairMat };

    const child = kind === 'child';
    const hs = child ? 0.66 : 1.0;
    this.hs = hs;

    /* --------------------------- torso --------------------------- */
    const hipY = 0.9 * hs;
    const torso = new THREE.Group();
    torso.position.y = hipY;
    this.body.add(torso);
    this.torso = torso;

    const belly = child ? 0.9 : 1.0;
    const chest = mesh(rbox(0.42 * hs * belly, 0.5 * hs, 0.26 * hs * belly, 0.11, 3), shirtMat, 0, 0.24 * hs, 0);
    chest.scale.set(1, 1, 0.95);
    torso.add(chest);
    // shoulders
    const shoulders = mesh(rbox(0.48 * hs, 0.16 * hs, 0.26 * hs, 0.08, 2), shirtMat, 0, 0.44 * hs, 0);
    torso.add(shoulders);
    // neck
    torso.add(mesh(cyl(0.055 * hs, 0.06 * hs, 0.1 * hs, 10), skinMat, 0, 0.52 * hs, 0));

    // hips
    const hips = mesh(rbox(0.34 * hs * belly, 0.2 * hs, 0.24 * hs * belly, 0.07, 2), pantsMat, 0, -0.02 * hs, 0);
    torso.add(hips);

    /* --------------------------- head ---------------------------- */
    const headPivot = new THREE.Group();
    headPivot.position.y = 0.58 * hs;
    torso.add(headPivot);
    this.head = headPivot;

    const headR = 0.115 * hs;
    const head = mesh(sphere(headR, 18), skinMat, 0, headR * 0.95, 0);
    head.scale.set(0.92, 1.08, 0.98);
    headPivot.add(head);

    // nose, ears
    const nose = mesh(sphere(0.022 * hs, 8), skinMat, 0, headR * 0.9, headR * 0.93);
    nose.scale.set(0.8, 1.1, 1.4);
    headPivot.add(nose);
    for (const s of [-1, 1]) {
      const ear = mesh(sphere(0.028 * hs, 8), skinMat, s * headR * 0.92, headR * 0.95, 0);
      ear.scale.set(0.5, 1, 1);
      headPivot.add(ear);
    }

    // eyes (whites + iris + blink lids)
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f0, roughness: 0.3 });
    const irisMat = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.25 });
    this.lids = [];
    for (const s of [-1, 1]) {
      const eyeY = headR * 1.12, eyeX = s * headR * 0.36, eyeZ = headR * 0.82;
      const white = mesh(sphere(0.026 * hs, 10), eyeWhiteMat, eyeX, eyeY, eyeZ);
      white.scale.set(1, 0.9, 0.55);
      headPivot.add(white);
      headPivot.add(mesh(sphere(0.013 * hs, 8), irisMat, eyeX + s * 0.002, eyeY, eyeZ + 0.014));
      const brow = mesh(box(0.045 * hs, 0.011 * hs, 0.014 * hs), hairMat, eyeX, eyeY + 0.045 * hs, eyeZ + 0.006);
      brow.rotation.z = s * -0.12;
      headPivot.add(brow);
      // lid used for blinking / sleeping
      const lid = mesh(sphere(0.0275 * hs, 10), skinMat, eyeX, eyeY, eyeZ);
      lid.scale.set(1.03, 0.05, 0.6);
      lid.visible = false;
      headPivot.add(lid);
      this.lids.push(lid);
    }
    // mouth
    const mouth = mesh(box(0.05 * hs, 0.008 * hs, 0.01 * hs), new THREE.MeshStandardMaterial({ color: 0x6b3b33, roughness: 0.7 }),
      0, headR * 0.6, headR * 0.9);
    headPivot.add(mouth);

    /* --------------------------- hair ---------------------------- */
    if (hair !== null) {
      const cap0 = mesh(sphere(headR * 1.03, 16), hairMat, 0, headR * 1.02, -0.008 * hs);
      cap0.scale.set(1.0, 1.0, 1.02);
      headPivot.add(cap0);
      if (hairStyle !== 'long' && hairStyle !== 'bun') {
        const fringe = mesh(rbox(0.2 * hs, 0.06 * hs, 0.04 * hs, 0.02), hairMat, 0, headR * 1.62, headR * 0.6);
        fringe.rotation.x = 0.5;
        headPivot.add(fringe);
      }
      if (hairStyle === 'long') {
        for (const s of [-1, 1]) {
          const lock = mesh(rbox(0.055 * hs, 0.24 * hs, 0.07 * hs, 0.025), hairMat,
            s * headR * 0.82, -headR * 0.2, -headR * 0.2);
          lock.rotation.z = -s * 0.08;
          headPivot.add(lock);
        }
      } else if (hairStyle === 'bun') {
        headPivot.add(mesh(sphere(headR * 0.43, 10), hairMat, 0, headR * 1.75, -headR * 0.7));
        const sidePart = mesh(rbox(0.19 * hs, 0.045 * hs, 0.04 * hs, 0.018), hairMat, 0, headR * 1.6, headR * 0.52);
        sidePart.rotation.x = 0.42;
        headPivot.add(sidePart);
      } else if (hairStyle === 'curly') {
        for (const [x, y, z, r] of [
          [-0.07, 0.12, -0.015, 0.048], [0, 0.15, -0.01, 0.05], [0.07, 0.12, -0.015, 0.048],
          [-0.09, 0.07, -0.01, 0.04], [0.09, 0.07, -0.01, 0.04],
        ]) headPivot.add(mesh(sphere(r * hs, 8), hairMat, x * hs, y * hs, z * hs));
      }
    }

    if (beard) {
      const beardMat = new THREE.MeshStandardMaterial({ color: hair, roughness: 0.95 });
      const beard = mesh(rbox(0.13 * hs, 0.09 * hs, 0.045 * hs, 0.03), beardMat,
        0, headR * 0.15, headR * 0.85);
      beard.rotation.x = -0.18;
      headPivot.add(beard);
    }

    if (hat) {
      const hatMat = new THREE.MeshStandardMaterial({ color: hat, roughness: 0.8 });
      headPivot.add(mesh(cyl(headR * 1.02, headR * 1.05, 0.09 * hs, 18), hatMat, 0, headR * 1.75, 0));
      headPivot.add(mesh(cyl(headR * 1.35, headR * 1.35, 0.015 * hs, 18), hatMat, 0, headR * 1.62, 0.02 * hs));
    }
    if (cap) {
      const capMat = new THREE.MeshStandardMaterial({ color: cap, roughness: 0.85 });
      headPivot.add(mesh(sphere(headR * 1.04, 16, 8), capMat, 0, headR * 1.25, 0));
      const brim = mesh(rbox(0.2 * hs, 0.02 * hs, 0.12 * hs, 0.02), capMat, 0, headR * 1.45, headR * 0.9);
      headPivot.add(brim);
    }

    /* --------------------------- arms ---------------------------- */
    const makeArm = (side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.25 * hs, 0.4 * hs, 0);
      torso.add(pivot);
      // Rounded upper and lower arms have a visible shoulder, elbow and wrist
      // instead of the thin straight-cylinder silhouette of the old rig.
      pivot.add(mesh(new THREE.CapsuleGeometry(0.058 * hs, 0.16 * hs, 5, 10), shirtMat, 0, -0.14 * hs, 0));
      pivot.add(mesh(sphere(0.062 * hs, 12), shirtMat, 0, 0, 0));
      const elbow = new THREE.Group();
      elbow.position.y = -0.28 * hs;
      pivot.add(elbow);
      elbow.add(mesh(new THREE.CapsuleGeometry(0.047 * hs, 0.15 * hs, 5, 10), skinMat, 0, -0.125 * hs, 0));

      const palm = mesh(rbox(0.09 * hs, 0.105 * hs, 0.065 * hs, 0.035 * hs, 3), skinMat,
        0, -0.31 * hs, 0.018 * hs);
      elbow.add(palm);
      for (let finger = 0; finger < 4; finger++) {
        const x = (finger - 1.5) * 0.022 * hs;
        const length = (finger === 1 || finger === 2 ? 0.064 : 0.052) * hs;
        elbow.add(mesh(new THREE.CapsuleGeometry(0.012 * hs, length * 0.55, 3, 7), skinMat,
          x, -0.365 * hs - (finger === 1 || finger === 2 ? 0.004 * hs : 0), 0.02 * hs));
      }
      const thumb = mesh(new THREE.CapsuleGeometry(0.014 * hs, 0.045 * hs, 3, 7), skinMat,
        side * 0.054 * hs, -0.315 * hs, 0.018 * hs);
      thumb.rotation.z = -side * 0.6;
      elbow.add(thumb);
      return { pivot, elbow };
    };
    this.armL = makeArm(-1);
    this.armR = makeArm(1);

    /* --------------------------- legs ---------------------------- */
    const makeLeg = (side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.11 * hs, hipY - 0.05 * hs, 0);
      this.body.add(pivot);
      pivot.add(mesh(cyl(0.075 * hs, 0.062 * hs, 0.42 * hs, 10), pantsMat, 0, -0.21 * hs, 0));
      const knee = new THREE.Group();
      knee.position.y = -0.42 * hs;
      pivot.add(knee);
      knee.add(mesh(cyl(0.058 * hs, 0.05 * hs, 0.38 * hs, 10), pantsMat, 0, -0.19 * hs, 0));
      // shoe
      const shoe = mesh(rbox(0.1 * hs, 0.075 * hs, 0.24 * hs, 0.035, 2), shoeMat, 0, -0.4 * hs, 0.035 * hs);
      knee.add(shoe);
      const sole = mesh(box(0.1 * hs, 0.02 * hs, 0.24 * hs), new THREE.MeshStandardMaterial({ color: 0x0d0d0f, roughness: 0.9 }), 0, -0.44 * hs, 0.035 * hs);
      knee.add(sole);
      return { pivot, knee };
    };
    this.legL = makeLeg(-1);
    this.legR = makeLeg(1);

    /* ------------------------ accessories ------------------------ */
    if (apron) {
      const apronMat = new THREE.MeshStandardMaterial({ color: apron, roughness: 0.92 });
      const bib = mesh(rbox(0.3 * hs, 0.42 * hs, 0.02, 0.01), apronMat, 0, 0.16 * hs, 0.135 * hs);
      torso.add(bib);
      const skirt = mesh(rbox(0.36 * hs, 0.5 * hs, 0.03, 0.01), apronMat, 0, -0.16 * hs, 0.13 * hs);
      torso.add(skirt);
      torso.add(mesh(box(0.02 * hs, 0.4 * hs, 0.02), apronMat, 0, 0.42 * hs, 0.12 * hs));
    }
    if (vest) {
      const vestMat = new THREE.MeshStandardMaterial({ color: vest, roughness: 0.55, metalness: 0.1 });
      const v = mesh(rbox(0.44 * hs, 0.42 * hs, 0.29 * hs, 0.1, 2), vestMat, 0, 0.24 * hs, 0);
      torso.add(v);
      // reflective stripes
      const stripeMat = new THREE.MeshStandardMaterial({ color: 0xd7dee4, roughness: 0.3, emissive: 0x222222 });
      torso.add(mesh(box(0.45 * hs, 0.03 * hs, 0.30 * hs), stripeMat, 0, 0.3 * hs, 0));
      torso.add(mesh(box(0.45 * hs, 0.03 * hs, 0.30 * hs), stripeMat, 0, 0.16 * hs, 0));
      if (badge) {
        const badgeMat = new THREE.MeshStandardMaterial({ color: badge, roughness: 0.3, metalness: 0.7 });
        const b = mesh(rbox(0.07 * hs, 0.05 * hs, 0.01, 0.005), badgeMat, -0.12 * hs, 0.34 * hs, 0.15 * hs);
        torso.add(b);
      }
    }
    if (scarf) {
      const scarfMat = new THREE.MeshStandardMaterial({ color: scarf, roughness: 0.95 });
      torso.add(mesh(cyl(0.1 * hs, 0.11 * hs, 0.08 * hs, 14), scarfMat, 0, 0.5 * hs, 0));
    }

    this.root.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });
    this.root.scale.setScalar(this.heightScale);

    // animation state
    this.phase = randRange(this.rng, 0, 6.28);
    this.walkAmount = 0;
    this.lookTarget = new THREE.Vector2();
    this.blinkTimer = randRange(this.rng, 1, 4);
    this.sitting = false;
    this.pose = 'idle';
  }

  /** Set the visual pose target. */
  setPose(pose) { this.pose = pose; }

  /**
   * @param dt seconds
   * @param speed current horizontal speed in m/s
   * @param crouch 0..1
   */
  update(dt, speed = 0, crouch = 0, t = 0) {
    const hs = this.hs;
    const targetWalk = clamp(speed / 1.4, 0, 1.6);
    this.walkAmount = damp(this.walkAmount, targetWalk, 9, dt);
    this.phase += dt * (4.2 + speed * 3.4) * this.gaitTempo * (speed > 0.05 ? 1 : 0.35);

    const w = this.walkAmount;
    const s = Math.sin(this.phase);
    const c = Math.cos(this.phase);
    const idle = Math.sin(t * 1.6 + this.phase * 0.2);

    const sleeping = this.pose === 'sleep';
    const sitting = this.pose === 'sit' || sleeping;

    // hips / body bob
    this.body.position.y = Math.abs(s) * 0.035 * w + (sleeping ? 0 : idle * 0.006);
    this.body.rotation.z = s * 0.02 * w;
    this.body.rotation.x = damp(this.body.rotation.x, sleeping ? 0 : -crouch * 0.12 + w * 0.05, 8, dt);

    // torso lean ("breathing" while asleep)
    const breathe = sleeping ? Math.sin(t * 1.1) * 0.015 : 0;
    this.torso.rotation.x = damp(this.torso.rotation.x, sleeping ? 0.02 : crouch * 0.28 - w * 0.06, 8, dt);
    this.torso.position.y = 0.9 * hs - crouch * 0.24 * hs + breathe;

    // legs
    const legSwing = 0.55 * w;
    const kneeBend = 0.5 * w;
    if (sitting) {
      this.legL.pivot.rotation.x = damp(this.legL.pivot.rotation.x, -1.35, 6, dt);
      this.legR.pivot.rotation.x = damp(this.legR.pivot.rotation.x, -1.3, 6, dt);
      this.legL.knee.rotation.x = damp(this.legL.knee.rotation.x, 1.35, 6, dt);
      this.legR.knee.rotation.x = damp(this.legR.knee.rotation.x, 1.3, 6, dt);
    } else {
      this.legL.pivot.rotation.x = s * legSwing;
      this.legR.pivot.rotation.x = -s * legSwing;
      this.legL.knee.rotation.x = Math.max(0, -s) * kneeBend;
      this.legR.knee.rotation.x = Math.max(0, s) * kneeBend;
    }

    // arms
    const armSwing = 0.42 * w * this.armSwingScale;
    const tuck = crouch * 0.5;
    this.armL.pivot.rotation.x = damp(this.armL.pivot.rotation.x, -s * armSwing - tuck, 10, dt);
    this.armR.pivot.rotation.x = damp(this.armR.pivot.rotation.x, s * armSwing - tuck, 10, dt);
    this.armL.pivot.rotation.z = damp(this.armL.pivot.rotation.z, 0.12 + crouch * 0.05 + idle * 0.01, 6, dt);
    this.armR.pivot.rotation.z = damp(this.armR.pivot.rotation.z, -0.12 - crouch * 0.05 - idle * 0.01, 6, dt);
    this.armL.elbow.rotation.x = damp(this.armL.elbow.rotation.x, -0.25 - w * 0.3 - crouch * 0.7, 10, dt);
    this.armR.elbow.rotation.x = damp(this.armR.elbow.rotation.x, -0.25 - w * 0.3 - crouch * 0.7, 10, dt);

    // head: slight bob + look-at
    this.head.rotation.y = damp(this.head.rotation.y, this.lookTarget.x, 6, dt);
    this.head.rotation.x = damp(this.head.rotation.x, this.lookTarget.y + (sleeping ? 0.4 : idle * 0.02), 6, dt);
    this.head.rotation.z = s * 0.02 * w;

    // blinking
    this.blinkTimer -= dt;
    const blink = this.blinkTimer < 0.11;
    if (this.blinkTimer < 0) this.blinkTimer = randRange(this.rng, 1.6, 5.2);
    for (const lid of this.lids) {
      lid.visible = blink || sleeping;
      if (sleeping) {
        lid.scale.set(1.03, 0.05, 0.6);
        lid.position.y = lid.userData.eyeY ?? lid.position.y;
      }
    }
  }

  /** Rotate the whole character toward a yaw (radians, +Z = 0). */
  faceYaw(yaw) { this.root.rotation.y = yaw; }
}
