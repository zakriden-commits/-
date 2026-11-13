import * as THREE from 'three';
import { Humanoid } from '../core/humanoid.js';
import { clamp, damp, makeRng, randRange, shortestAngle, angleLerp } from '../core/util.js';

/**
 * NPC brains. Each NPC owns a Humanoid and walks a route with simple
 * steering + collision. Guards additionally track a suspicion meter that
 * fills when they see the player sneaking around or hear noise.
 *
 * Player visibility model:
 *   seen = in guard view cone AND unobstructed AND distance < sightRange
 *   the closer and the more "in the open" the player is, the faster the
 *   suspicion builds. Crouching in the dark slows it down a lot.
 */

export const NPC_STATE = { PATROL: 'patrol', IDLE: 'idle', CHASE: 'chase', SEARCH: 'search', ALERT: 'alert' };

export class NPC {
  constructor(assets, opts) {
    const {
      route = [], speed = 1.15, seed = 1, kind = 'adult', look = {}, name = 'npc',
      hoverText = null, pauseAt = [], sitting = false, idleSway = true,
    } = opts;
    this.name = name;
    this.assets = assets;
    this.humanoid = new Humanoid(assets, { ...look, seed, kind });
    this.object = this.humanoid.root;
    this.currentSpeed = 0;
    this.route = route.map((p) => new THREE.Vector3(p[0], 0, p[1]));
    this.routeIndex = 0;
    this.speed = speed;
    this.baseSpeed = speed;
    this.bonusSpeed = 0;
    this.yaw = 0;
    this.pos = new THREE.Vector3().copy(this.route[0] || new THREE.Vector3());
    this.state = sitting ? NPC_STATE.IDLE : NPC_STATE.PATROL;
    this.sitting = sitting;
    this.pauseAt = pauseAt;
    this.waitTimer = 0;
    this.suspicion = 0;
    this.alertTimer = 0;
    this.searchTimer = 0;
    this.target = this.route[1] || this.pos.clone();
    this.rng = makeRng(seed * 31 + 7);
    this.idleSway = idleSway;
    this.idlePhase = randRange(this.rng, 0, 10);
    this.lookAngle = 0;
    this.headYaw = 0;
    this.stuckTimer = 0;
    this.lastPos = this.pos.clone();
    this.routeSide = new THREE.Vector3();
    this.object.position.copy(this.pos);
  }

  faceTowards(x, z, dt, rate = 6) {
    const targetYaw = Math.atan2(x - this.pos.x, z - this.pos.z);
    this.yaw = angleLerp(this.yaw, targetYaw, 1 - Math.exp(-rate * dt));
  }

  /** Basic steering with wall sliding; returns distance moved. */
  moveTowards(target, dt, colliders, radius = 0.32) {
    const dx = target.x - this.pos.x;
    const dz = target.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.05) return 0;
    const step = Math.min(dist, this.currentSpeed * dt);
    const ox = this.pos.x, oz = this.pos.z;
    const solved = colliders.resolve(ox + (dx / dist) * step, oz + (dz / dist) * step, radius);
    const moved = Math.hypot(solved.x - ox, solved.z - oz);
    // if blocked, sidestep a little so patrols don't grind on corners
    if (moved < step * 0.3) {
      const perpX = -dz / dist, perpZ = dx / dist;
      const side = this.rng() < 0.5 ? 1 : -1;
      const s2 = colliders.resolve(ox + perpX * side * step, oz + perpZ * side * step, radius);
      if (Math.hypot(s2.x - ox, s2.z - oz) > moved) {
        this.pos.x = s2.x; this.pos.z = s2.z;
        this.faceTowards(target.x, target.z, dt);
        return Math.hypot(s2.x - ox, s2.z - oz);
      }
    }
    this.pos.x = solved.x; this.pos.z = solved.z;
    this.faceTowards(target.x, target.z, dt);
    return moved;
  }

  update(dt, t, colliders, game) {
    let speedNow = 0;
    let crouch = 0;

    this.currentSpeed = this.baseSpeed + this.bonusSpeed;
    if (this.state === NPC_STATE.PATROL || this.state === NPC_STATE.IDLE) {
      if (this.sitting) {
        this.humanoid.setPose('sit');
        // seated cashier slowly looks around
        this.headYaw = Math.sin(t * 0.4 + this.idlePhase) * 0.5;
      } else if (this.route.length > 1) {
        this.humanoid.setPose('idle');
        const target = this.route[this.routeIndex];
        const before = this.pos.clone();
        const moved = this.moveTowards(target, dt, colliders);
        speedNow = moved / Math.max(dt, 1e-4);
        if (this.pos.distanceTo(target) < 0.45) {
          const pause = this.pauseAt.find((p) => Math.abs(p[0] - target.x) < 0.3 && Math.abs(p[1] - target.z) < 0.3);
          if (pause) {
            this.state = NPC_STATE.IDLE;
            this.waitTimer = pause[2] ?? 2;
          }
          this.routeIndex = (this.routeIndex + 1) % this.route.length;
        }
        if (this.idleSway) {
          this.headYaw = Math.sin(t * 0.7 + this.idlePhase) * 0.35;
        }
      } else {
        this.headYaw = Math.sin(t * 0.8 + this.idlePhase) * 0.6;
      }
      // guards sweep their head down aisles while patrolling
      if (this.state === NPC_STATE.PATROL && !this.sitting) {
        this.headYaw = Math.sin(t * 0.9 + this.idlePhase) * 0.55;
      }
      if (this.state === NPC_STATE.IDLE && !this.sitting) {
        this.waitTimer -= dt;
        if (this.waitTimer <= 0) this.state = NPC_STATE.PATROL;
        // idle guard turns to scan
        this.headYaw = Math.sin(t * 1.2) * 0.9;
      }
    } else if (this.state === NPC_STATE.CHASE) {
      this.currentSpeed = this.baseSpeed * 1.9 + this.bonusSpeed;
      const p = game.player.position;
      const moved = this.moveTowards(p, dt, colliders, 0.34);
      speedNow = moved / Math.max(dt, 1e-4);
      this.alertTimer -= dt;
      if (this.alertTimer <= 0) { this.state = NPC_STATE.SEARCH; this.searchTimer = 6; }
      if (this.pos.distanceTo(p) < 1.4) game.onCaught('guard');
    } else if (this.state === NPC_STATE.SEARCH) {
      this.currentSpeed = this.baseSpeed * 1.1 + this.bonusSpeed;
      const before = this.pos.clone();
      if (this.searchTarget) {
        this.moveTowards(this.searchTarget, dt, colliders, 0.32);
      }
      this.searchTimer -= dt;
      if (!this.searchTarget || this.pos.distanceTo(this.searchTarget) < 0.6) {
        this.searchTarget = new THREE.Vector3(
          clamp(this.pos.x + randRange(this.rng, -4, 4), -7, 7), 0,
          clamp(this.pos.z + randRange(this.rng, -4, 4), 15, 29));
      }
      speedNow = this.pos.distanceTo(before) / Math.max(dt, 1e-4);
      if (this.searchTimer <= 0) { this.state = NPC_STATE.PATROL; this.searchTarget = null; }
    }

    this.object.position.copy(this.pos);
    this.humanoid.faceYaw(this.yaw);
    this.humanoid.lookTarget.x = damp(this.humanoid.lookTarget.x, this.headYaw, 4, dt);
    this.humanoid.update(dt, speedNow, crouch, t);
  }
}

/**
 * Guard subclass: line-of-sight detection, hearing and alarm behaviour.
 */
export class Guard extends NPC {
  constructor(assets, opts) {
    super(assets, { ...opts, look: { ...opts.look, vest: 0x1e3a5f, badge: 0xd9b55c } });
    this.sightRange = opts.sightRange ?? 11;
    this.fov = opts.fov ?? 1.05;
    this.hearRange = opts.hearRange ?? 5.5;
    this.torch = null;
    this.onSpot = null;
    this.maxSuspicion = 1;
  }

  /** How visible the player is from here, 0..1 (0 = unseen). */
  visibility(game) {
    const p = game.player.position;
    const dx = p.x - this.pos.x;
    const dz = p.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > this.sightRange) return 0;
    // view cone based on facing
    const toPlayer = Math.atan2(dx, dz);
    const diff = Math.abs(shortestAngle(this.yaw, toPlayer));
    if (diff > this.fov) return 0;
    if (game.colliders.lineBlocked(this.pos.x, this.pos.z, p.x, p.z)) return 0;
    let v = 1 - dist / this.sightRange;
    // cone centre is far more effective than the edge of vision
    v *= 0.55 + 0.45 * (1 - diff / this.fov);
    // crouching helps, standing in bright light hurts
    const crouch = game.player.crouch;
    v *= 1 - crouch * 0.45;
    v *= 0.55 + 0.45 * game.lightLevelAt(p);
    // in the shop at night the guards are more alert
    v *= 1 + game.alertLevel * 0.55;
    return clamp(v, 0, 1.4);
  }

  update(dt, t, colliders, game) {
    super.update(dt, t, colliders, game);
    if (this.state === NPC_STATE.CHASE || this.state === NPC_STATE.SEARCH) {
      this.humanoid.lookTarget.x = 0;
      return;
    }
    const vis = this.visibility(game);
    const noise = game.noiseLevel;
    const hearing = clamp((noise - 0.25) * 1.4, 0, 1) * clamp(1 - this.pos.distanceTo(game.player.position) / this.hearRange, 0, 1);
    const gain = vis * 0.9 + hearing * 1.1;
    const decay = vis > 0.02 ? 0.02 : 0.35;
    this.suspicion = clamp(this.suspicion + gain * dt - decay * dt, 0, 1);

    if (this.suspicion >= 0.98) {
      this.state = NPC_STATE.CHASE;
      this.alertTimer = 7;
      this.suspicion = 0.5;
      this.humanoid.setPose('idle');
      this.onSpot?.();
      game.onDetected(this);
    }
  }
}
