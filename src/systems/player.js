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
    const skin = new THREE.MeshStandardMaterial({ color: 0xc18c67, roughness: 0.72 });
    const sleeve = new THREE.MeshStandardMaterial({ color: 0x34404d, roughness: 0.94 });
    const cuff = new THREE.MeshStandardMaterial({ color: 0x27313d, roughness: 0.88 });
    const up = new THREE.Vector3(0, 1, 0);

    const capsuleBetween = (a, b, radius, material) => {
      const direction = new THREE.Vector3().subVectors(b, a);
      const distance = direction.length();
      direction.normalize();
      const mesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(radius, Math.max(0.01, distance - radius * 2), 5, 12),
        material,
      );
      mesh.position.copy(a).add(b).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(up, direction);
      return mesh;
    };
    const cylinderBetween = (a, b, radius, material) => {
      const direction = new THREE.Vector3().subVectors(b, a);
      const length = direction.length();
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 14), material);
      mesh.position.copy(a).add(b).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(up, direction.normalize());
      return mesh;
    };

    const mkArm = (side) => {
      const arm = new THREE.Group();
      // The elbow stays outside the portrait frame; a slim sleeve angles into
      // a small, relaxed hand near the lower edge. Fingers sit together, with
      // no outward-pointing thumb that can read as a crab claw.
      const elbow = new THREE.Vector3(side * 0.31, -0.74, -0.32);
      const wrist = new THREE.Vector3(side * 0.13, -0.36, -0.58);
      const reach = new THREE.Vector3().subVectors(wrist, elbow).normalize();
      arm.add(capsuleBetween(elbow, wrist, 0.041, sleeve));

      const cuffStart = wrist.clone().addScaledVector(reach, -0.06);
      arm.add(cylinderBetween(cuffStart, wrist, 0.043, cuff));

      const palmCenter = wrist.clone().addScaledVector(reach, 0.04);
      const palm = new THREE.Mesh(new THREE.SphereGeometry(0.038, 16, 12), skin);
      palm.scale.set(0.86, 0.98, 0.86);
      palm.position.copy(palmCenter);
      arm.add(palm);

      // Small, touching knuckles read as a relaxed hand instead of four long
      // prongs. A tucked thumb sits against the inside edge of each palm.
      for (let i = 0; i < 4; i++) {
        const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.01, 10, 8), skin);
        knuckle.scale.set(0.88, 1.0, 0.9);
        knuckle.position.copy(palmCenter)
          .addScaledVector(reach, 0.024)
          .add(new THREE.Vector3((i - 1.5) * 0.018, 0, 0));
        arm.add(knuckle);
      }
      const thumb = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 10), skin);
      thumb.scale.set(1.0, 0.88, 0.9);
      thumb.position.copy(palmCenter).add(new THREE.Vector3(-side * 0.024, -0.01, 0.004));
      arm.add(thumb);

      arm.traverse((o) => { if (o.isMesh) o.castShadow = false; });
      return arm;
    };
    const left = mkArm(-1), right = mkArm(1);
    g.add(left, right);
    g.userData.left = left;
    g.userData.right = right;
    return { group: g };
  }

  get inventoryCount() { return this.inventory.length; }

  addItem(name, value) { this.inventory.push({ name, value }); }
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

    let baseSpeed = 3.0;
    if (this.crouch > 0.5) baseSpeed = 1.25;
    if (input.run && !wantsCrouch) baseSpeed = 4.6;
    if (ctx.speedScale) baseSpeed *= ctx.speedScale;

    const targetSpeed = this.frozen ? 0 : baseSpeed * mag;
    this.speed = damp(this.speed, targetSpeed, 10, dt);

    // forward is -Z in camera space
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    const dirX = fx * -move.y + rx * move.x;
    const dirZ = fz * -move.y + rz * move.x;
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
      this.footstepCb?.(this.surface, this.crouch > 0.5 ? 0.35 : input.run ? 1.2 : 0.8);
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
    hands.visible = !ctx.hideHands;

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
