import { clamp } from '../core/util.js';

/**
 * Axis-aligned collider world. Everything solid (walls, shelves, doors,
 * cash registers) is registered as a box, so the player and the NPCs can
 * slide along walls instead of sticking to them.
 */
export class CollisionWorld {
  constructor() {
    this.boxes = []; // { minX, maxX, minZ, maxZ, tag }
  }

  addBox(cx, cz, sx, sz, tag = 'wall') {
    const b = { minX: cx - sx / 2, maxX: cx + sx / 2, minZ: cz - sz / 2, maxZ: cz + sz / 2, tag, active: true };
    this.boxes.push(b);
    return b;
  }

  /** Convenience: register from a THREE.Box3-like set of bounds. */
  addBounds(minX, maxX, minZ, maxZ, tag = 'wall') {
    const b = { minX, maxX, minZ, maxZ, tag, active: true };
    this.boxes.push(b);
    return b;
  }

  block(cx, cz, length, thickness, rotated = false, tag = 'wall') {
    return rotated
      ? this.addBox(cx, cz, thickness, length, tag)
      : this.addBox(cx, cz, length, thickness, tag);
  }

  circleHits(x, z, r) {
    for (const b of this.boxes) {
      if (!b.active) continue;
      const nx = clamp(x, b.minX, b.maxX);
      const nz = clamp(z, b.minZ, b.maxZ);
      const dx = x - nx, dz = z - nz;
      if (dx * dx + dz * dz < r * r) return b;
    }
    return null;
  }

  /** Push a circle out of all solids (two passes avoids corner jitter). */
  resolve(x, z, r) {
    for (let pass = 0; pass < 2; pass++) {
      for (const b of this.boxes) {
        if (!b.active) continue;
        const nx = clamp(x, b.minX, b.maxX);
        const nz = clamp(z, b.minZ, b.maxZ);
        let dx = x - nx, dz = z - nz;
        let d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          x = nx + (dx / d) * r;
          z = nz + (dz / d) * r;
        } else {
          // centre inside the box: push out along the shallowest axis
          const left = Math.abs(x - b.minX), right = Math.abs(b.maxX - x);
          const up = Math.abs(z - b.minZ), down = Math.abs(b.maxZ - z);
          const m = Math.min(left, right, up, down);
          if (m === left) x = b.minX - r;
          else if (m === right) x = b.maxX + r;
          else if (m === up) z = b.minZ - r;
          else z = b.maxZ + r;
        }
      }
    }
    return { x, z };
  }

  /** Line of sight test used by guards (sampled, cheap and forgiving). */
  lineBlocked(x0, z0, x1, z1, step = 0.35) {
    const dx = x1 - x0, dz = z1 - z0;
    const dist = Math.hypot(dx, dz);
    const n = Math.max(1, Math.ceil(dist / step));
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (this.circleHits(x0 + dx * t, z0 + dz * t, 0.001)) return true;
    }
    return false;
  }
}

/** Simple grid for keeping the "walk zone" queries fast on the map. */
export function pointInRect(x, z, rect) {
  return x > rect.minX && x < rect.maxX && z > rect.minZ && z < rect.maxZ;
}
