import * as THREE from 'three';
import { Humanoid } from '../core/humanoid.js';
import { clamp, damp, lerp, noise1 } from '../core/util.js';

/**
 * First-person player. Body physics are simple (circle vs boxes), while
 * the view gets head-bob, crouch, sprint FOV, footsteps and a subtle
 * sway/lean so walking feels physical rather than a floating camera.
 */
export class Player {
  constructor(assets, camera, colliders) {
    this.assets = assets;
    this.camera = camera;
    this.colliders = colliders;

    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.eyeHeight = 1.02;
    this.eyeOverride = 1.02; // animated by the wake-up sequence
    this.crouch = 0;
    this.crouchTarget = 0;
    this.radius = 0.3;
    this.speed = 0;
    this.bobPhase = 0;
    this.bobAmount = 0;
    this.fov = 72;
    this.fovTarget = 72;
    this.money = 0;
    this.inventory = [];
    this.storage = [];
    this.inventoryCapacity = 10;
    this.stamina = 100;
    this.staminaMax = 100;
    this.exhausted = false;
    this.isSprinting = false;
    this.hidden = false;
    this.frozen = false;
    this.stepTimer = 0;
    this.lastStepSign = 1;
    this.headTilt = 0;
    this.rollOverride = null;
    this.carrying = null;
    this.surface = 'wood';
    this.footstepCb = null;
    this.swayX = 0;
    this.swayY = 0;

    // hands / body seen in first person
    this.hands = this._buildHands();
    camera.add(this.hands.group);

    this.body = new Humanoid(assets, {
      skin: 0xb9855e, shirt: 0x2f3a4a, pants: 0x272b33, shoes: 0x14161a,
      hair: 0x1e1712, seed: 9, height: 1.0,
    });
    this.body.root.visible = false; // first person: body hidden except shadow
  }

  _buildHands() {
    const g = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0xb98260, roughness: 0.82 });
    const skinCrease = new THREE.LineBasicMaterial({ color: 0x76513d, transparent: true, opacity: 0.38 });
    const sleeve = new THREE.MeshStandardMaterial({ color: 0x405162, roughness: 0.9 });
    const cuff = new THREE.MeshStandardMaterial({ color: 0x293745, roughness: 0.86 });
    const up = new THREE.Vector3(0, 1, 0);

    const capsuleBetween = (a, b, radius, material) => {
      const direction = new THREE.Vector3().subVectors(b, a);
      const distance = direction.length();
      direction.normalize();
      const mesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(radius, Math.max(0.01, distance - radius * 2), 6, 14),
        material,
      );
      mesh.position.copy(a).add(b).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(up, direction);
      return mesh;
    };
    const cylinderBetween = (a, b, radius, material) => {
      const direction = new THREE.Vector3().subVectors(b, a);
      const length = direction.length();
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 16), material);
      mesh.position.copy(a).add(b).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(up, direction.normalize());
      return mesh;
    };
    const extrude = (shape) => new THREE.ExtrudeGeometry(shape, {
      depth: 0.016, bevelEnabled: true, bevelSegments: 3, steps: 1,
      bevelSize: 0.003, bevelThickness: 0.003, curveSegments: 7,
    });

    const mkArm = (side) => {
      const parts = new THREE.Group();
      // Pivot at each elbow so the sleeves swing naturally with the gait.
      const elbow = new THREE.Vector3(side * 0.38, -0.76, -0.44);
      const wrist = new THREE.Vector3(side * 0.17, -0.34, -0.74);
      const reach = new THREE.Vector3().subVectors(wrist, elbow).normalize();
      parts.add(capsuleBetween(elbow, wrist, 0.042, sleeve));

      const cuffStart = wrist.clone().addScaledVector(reach, -0.068);
      parts.add(cylinderBetween(cuffStart, wrist, 0.044, cuff));
      const seamStart = wrist.clone().addScaledVector(reach, -0.058);
      const seamEnd = wrist.clone().addScaledVector(reach, -0.050);
      parts.add(cylinderBetween(seamStart, seamEnd, 0.045, sleeve));

      const hand = new THREE.Group();
      hand.position.copy(wrist).addScaledVector(reach, 0.008);
      hand.scale.x = side; // mirror the palm so both thumbs point inward

      // A softly rounded palm sits behind the shaped silhouette, giving the
      // hand volume instead of a flat finger fan or a single ball.
      const palmVolume = new THREE.Mesh(new THREE.SphereGeometry(0.048, 16, 12), skin);
      palmVolume.scale.set(0.78, 0.72, 0.28);
      palmVolume.position.set(0, -0.012, -0.006);
      palmVolume.castShadow = false;
      hand.add(palmVolume);

      const palmShape = new THREE.Shape();
      palmShape.moveTo(-0.021, 0.018)
        .quadraticCurveTo(-0.035, 0.014, -0.036, -0.004)
        .lineTo(-0.038, -0.022)
        .quadraticCurveTo(-0.039, -0.030, -0.033, -0.031)
        // little finger
        .lineTo(-0.037, -0.073)
        .quadraticCurveTo(-0.037, -0.083, -0.029, -0.084)
        .quadraticCurveTo(-0.021, -0.084, -0.020, -0.075)
        .lineTo(-0.020, -0.049)
        // first finger web
        .quadraticCurveTo(-0.020, -0.043, -0.017, -0.043)
        // ring finger
        .quadraticCurveTo(-0.012, -0.043, -0.012, -0.049)
        .lineTo(-0.012, -0.092)
        .quadraticCurveTo(-0.012, -0.102, -0.004, -0.103)
        .quadraticCurveTo(0.004, -0.103, 0.004, -0.092)
        .lineTo(0.004, -0.049)
        // second finger web
        .quadraticCurveTo(0.004, -0.043, 0.008, -0.043)
        // middle finger
        .quadraticCurveTo(0.013, -0.043, 0.013, -0.049)
        .lineTo(0.013, -0.083)
        .quadraticCurveTo(0.013, -0.092, 0.021, -0.092)
        .quadraticCurveTo(0.029, -0.092, 0.029, -0.083)
        .lineTo(0.029, -0.049)
        // third finger web and palm edge
        .quadraticCurveTo(0.029, -0.043, 0.033, -0.043)
        .quadraticCurveTo(0.038, -0.043, 0.038, -0.050)
        .lineTo(0.037, -0.026)
        .quadraticCurveTo(0.038, -0.014, 0.032, -0.004)
        .lineTo(0.026, 0.012)
        .quadraticCurveTo(0.021, 0.020, 0.013, 0.021)
        .lineTo(-0.012, 0.022)
        .quadraticCurveTo(-0.019, 0.022, -0.021, 0.018)
        .closePath();
      const palmMesh = new THREE.Mesh(extrude(palmShape), skin);
      palmMesh.castShadow = false;
      hand.add(palmMesh);

      // The thumb lies close against the palm; fingers stay together and curl
      // slightly inward so the silhouette reads as a relaxed human hand.
      const thumbShape = new THREE.Shape();
      thumbShape.moveTo(-0.022, 0.001)
        .quadraticCurveTo(-0.034, -0.003, -0.039, -0.016)
        .quadraticCurveTo(-0.043, -0.027, -0.036, -0.034)
        .quadraticCurveTo(-0.029, -0.037, -0.025, -0.029)
        .lineTo(-0.015, -0.015)
        .quadraticCurveTo(-0.012, -0.007, -0.017, -0.001)
        .closePath();
      const thumbMesh = new THREE.Mesh(extrude(thumbShape), skin);
      thumbMesh.position.z = 0.007;
      thumbMesh.castShadow = false;
      hand.add(thumbMesh);

      for (const [x1, x2, y] of [
        [-0.034, -0.025, -0.054], [-0.016, -0.006, -0.061],
        [0.001, 0.011, -0.061], [0.021, 0.031, -0.056],
      ]) {
        const crease = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x1, y, 0.020), new THREE.Vector3(x2, y, 0.020),
        ]);
        const line = new THREE.Line(crease, skinCrease);
        line.frustumCulled = false;
        hand.add(line);
      }

      parts.add(hand);
      parts.traverse((o) => { if (o.isMesh) o.castShadow = false; });

      const pivot = new THREE.Group();
      pivot.position.copy(elbow);
      for (const child of [...parts.children]) {
        child.position.sub(elbow);
        pivot.add(child);
      }
      pivot.userData.hand = hand;
      pivot.userData.side = side;
      return pivot;
    };
    const left = mkArm(-1), right = mkArm(1);
    g.add(left, right);
    g.userData.left = left;
    g.userData.right = right;
    g.userData.baseAspect = 390 / 844;
    g.userData.spread = 0.17;
    return { group: g };
  }

  get inventoryCount() { return this.inventory.length; }

  canAddItem() { return this.inventory.length < this.inventoryCapacity; }

  addItem(name, value = 0, type = 'loot') {
    if (!this.canAddItem()) return false;
    this.inventory.push({ name, value, type });
    return true;
  }

  hasItem(name) { return this.inventory.some((item) => item.name === name); }

  storeItem(index) {
    if (index < 0 || index >= this.inventory.length) return null;
    const [item] = this.inventory.splice(index, 1);
    this.storage.push(item);
    return item;
  }

  retrieveItem(index) {
    if (this.inventory.length >= this.inventoryCapacity || index < 0 || index >= this.storage.length) return null;
    const [item] = this.storage.splice(index, 1);
    this.inventory.push(item);
    return item;
  }

  addMoney(v) { this.money += v; }

  setCrouch(on) { this.crouchTarget = on ? 1 : 0; }

  teleport(x, z, yaw = this.yaw) {
    this.position.set(x, 0, z);
    this.yaw = yaw;
    this.velocity.set(0, 0, 0);
  }

  look(dx, dy, sensitivityScale = 1) {
    this.yaw -= dx * sensitivityScale;
    this.pitch = clamp(this.pitch - dy * sensitivityScale, -1.25, 1.25);
  }

  /**
   * @param input Input instance
   * @param dt seconds
   * @param ctx { light, noise, sneakOnly }
   */
  update(dt, input, ctx = {}) {
    const move = input.sample();
    const mag = Math.min(1, Math.hypot(move.x, move.y));
    const wantsCrouch = input.sneak || ctx.forceSneak;
    this.setCrouch(wantsCrouch);
    this.crouch = damp(this.crouch, this.crouchTarget, 8, dt);

    const staminaRatio = this.stamina / this.staminaMax;
    const staminaDrain = ctx.difficulty?.staminaDrain ?? 22;
    const staminaRegen = ctx.difficulty?.staminaRegen ?? 17;
    const wantsRun = !!input.run && !wantsCrouch && mag > 0.02 && !this.frozen;
    if (wantsRun && !this.exhausted && this.stamina > 0) {
      this.stamina = Math.max(0, this.stamina - staminaDrain * dt);
      if (this.stamina <= 0) this.exhausted = true;
    } else {
      this.stamina = Math.min(this.staminaMax, this.stamina + staminaRegen * dt);
      if (this.exhausted && this.stamina >= 26) this.exhausted = false;
    }

    const staminaScale = 0.68 + 0.32 * staminaRatio;
    this.isSprinting = wantsRun && !this.exhausted && this.stamina > 0;
    let baseSpeed = 3.0 * staminaScale;
    if (this.crouch > 0.5) baseSpeed = 1.25 * staminaScale;
    else if (this.isSprinting) baseSpeed = 4.6 * (0.56 + 0.44 * staminaRatio);
    else if (this.exhausted && wantsRun) baseSpeed = 2.25 * staminaScale;
    if (ctx.speedScale) baseSpeed *= ctx.speedScale;

    const targetSpeed = this.frozen ? 0 : baseSpeed * mag;
    this.speed = damp(this.speed, targetSpeed, 10, dt);

    // forward is -Z in camera space
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    // `move.y` is positive for W / an upward stick tilt, so it follows the
    // camera-forward vector (`fx`, `fz`) rather than walking backward.
    const dirX = fx * move.y + rx * move.x;
    const dirZ = fz * move.y + rz * move.x;
    const dl = Math.hypot(dirX, dirZ);
    let wishX = 0, wishZ = 0;
    if (dl > 1e-4 && mag > 0.01) { wishX = dirX / dl; wishZ = dirZ / dl; }

    const accel = 14;
    this.velocity.x = damp(this.velocity.x, wishX * this.speed, accel, dt);
    this.velocity.z = damp(this.velocity.z, wishZ * this.speed, accel, dt);

    const nx = this.position.x + this.velocity.x * dt;
    const nz = this.position.z + this.velocity.z * dt;
    const solved = this.colliders.resolve(nx, nz, this.radius);
    this.position.x = solved.x;
    this.position.z = solved.z;

    // head bob + footsteps
    const realSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    const bobRate = 6.2 + realSpeed * 1.6;
    this.bobPhase += dt * bobRate * (realSpeed > 0.1 ? 1 : 0.15);
    this.bobAmount = damp(this.bobAmount, clamp(realSpeed / 3.2, 0, 1) * (this.crouch > 0.5 ? 0.5 : 1), 8, dt);
    const stepSign = Math.sign(Math.sin(this.bobPhase));
    if (stepSign !== this.lastStepSign && realSpeed > 0.35) {
      this.lastStepSign = stepSign;
      this.footstepCb?.(this.surface, this.crouch > 0.5 ? 0.28 : this.isSprinting ? 1.15 : 0.72);
    }

    // camera
    const eyeTarget = this.eyeOverride != null ? this.eyeOverride : lerp(1.62, 0.95, this.crouch);
    this.eyeHeight = damp(this.eyeHeight, eyeTarget, 3.2, dt);
    const eye = this.eyeHeight;
    const bobY = Math.sin(this.bobPhase * 2) * 0.028 * this.bobAmount;
    const bobX = Math.cos(this.bobPhase) * 0.02 * this.bobAmount;
    const swayTargetX = -this.velocity.x * 0.004;
    this.swayX = damp(this.swayX, swayTargetX, 6, dt);
    this.camera.position.set(
      this.position.x + bobX * Math.cos(this.yaw) + this.swayX * Math.cos(this.yaw),
      eye + bobY,
      this.position.z + bobX * -Math.sin(this.yaw) + this.swayX * -Math.sin(this.yaw),
    );
    this.headTilt = damp(this.headTilt, -this.velocity.x * 0.012 * Math.cos(this.yaw) + this.velocity.z * 0.012 * Math.sin(this.yaw), 6, dt);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.z = this.rollOverride != null
      ? this.rollOverride
      : this.headTilt + Math.sin(this.bobPhase) * 0.005 * this.bobAmount;

    // hands sway (walk + idle breathing)
    const hands = this.hands.group;
    const t = performance.now() / 1000;
    hands.position.set(
      Math.sin(this.bobPhase) * 0.012 * this.bobAmount,
      Math.sin(t * 1.2) * 0.004 - this.bobAmount * 0.012 + Math.sin(this.bobPhase * 2) * 0.01 * this.bobAmount,
      0,
    );
    hands.rotation.z = Math.sin(this.bobPhase) * 0.02 * this.bobAmount;
    const armSwing = Math.sin(this.bobPhase) * 0.16 * this.bobAmount;
    this.hands.group.userData.left.rotation.x = damp(
      this.hands.group.userData.left.rotation.x, -armSwing, 8, dt,
    );
    this.hands.group.userData.right.rotation.x = damp(
      this.hands.group.userData.right.rotation.x, armSwing, 8, dt,
    );
    this.hands.group.userData.left.rotation.z = damp(
      this.hands.group.userData.left.rotation.z, -0.045 - armSwing * 0.2, 8, dt,
    );
    this.hands.group.userData.right.rotation.z = damp(
      this.hands.group.userData.right.rotation.z, 0.045 + armSwing * 0.2, 8, dt,
    );
    hands.visible = !ctx.hideHands && !this.hidden;

    // dynamic FOV for sprint
    this.fovTarget = 72 + (realSpeed > 3.6 ? 6 : 0);
    this.fov = damp(this.fov, this.fovTarget, 4, dt);
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }

    this.body.root.position.copy(this.position);
    this.body.faceYaw(this.yaw + Math.PI);
    this.body.update(dt, realSpeed, this.crouch, t);
  }
}
