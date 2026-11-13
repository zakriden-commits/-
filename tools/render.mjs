/**
 * Software preview renderer.
 * Walks a THREE scene, projects every triangle, z-buffers and shades it
 * with material colour + a couple of directional lights, then writes a
 * PNG. Not a game screenshot — it's a geometry/material sanity check that
 * runs in CI without a GPU. Textures are sampled too (nearest neighbour).
 */
import * as THREE from 'three';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';
import { installDom, stubRenderer } from '../tests/harness.mjs';

const { installNapiCanvas } = await import('./canvas-adapter.mjs');
installDom();          // stub DOM + window first
installNapiCanvas();   // then upgrade canvas creation to real pixels

export async function renderView(scene, {
  position, target, fov = 66, width = 720, height = 1280, out = 'preview.png',
  ambient = 0.35, exposure = 1.05, fog = null, tonemap = true,
} = {}) {
  const camera = new THREE.PerspectiveCamera(fov, width / height, 0.05, 400);
  camera.position.set(position[0], position[1], position[2]);
  camera.up.set(0, 1, 0);
  camera.lookAt(new THREE.Vector3(target[0], target[1], target[2]));
  camera.updateMatrixWorld(true);
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  scene.updateMatrixWorld(true);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(width, height);
  const data = img.data;
  // night-sky base so unpainted pixels read as sky, not as holes
  for (let i = 0; i < data.length; i += 4) {
    const y = Math.floor(i / 4 / width) / height;
    data[i] = 10 + 14 * y; data[i + 1] = 16 + 22 * y; data[i + 2] = 28 + 34 * y; data[i + 3] = 255;
  }
  const zbuf = new Float32Array(width * height).fill(-Infinity); // stores 1/w: bigger = closer

  const W = width, H = height;
  const proj = camera.projectionMatrix.elements;
  const view = camera.matrixWorldInverse.elements;
  const vp = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);

  // directional lights (world space)
  const lights = [
    { dir: new THREE.Vector3(-0.45, 0.8, 0.4).normalize(), color: [0.62, 0.78, 1.0], intensity: 0.95 },
    { dir: new THREE.Vector3(0.6, 0.3, -0.5).normalize(), color: [1.0, 0.82, 0.62], intensity: 0.35 },
    { dir: new THREE.Vector3(0, -1, 0).normalize(), color: [0.5, 0.45, 0.4], intensity: 0.18 },
  ];

  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const nm = new THREE.Matrix3();
  let tris = 0, drawn = 0;

  const textureCache = new Map();
  const getPixels = (tex) => {
    if (!tex || !tex.image) return null;
    const key = tex.uuid;
    if (textureCache.has(key)) return textureCache.get(key);
    const cv = tex.image;
    let px = null;
    try {
      const cctx = cv.getContext('2d');
      px = cctx.getImageData(0, 0, cv.width, cv.height);
    } catch { px = null; }
    textureCache.set(key, px);
    return px;
  };

  const list = [];
  scene.traverse((o) => { if (o.isMesh && o.visible) list.push(o); });

  for (const mesh of list) {
    const geo = mesh.geometry;
    const posAttr = geo.attributes.position;
    if (!posAttr) continue;
    const uvAttr = geo.attributes.uv;
    const index = geo.index;
    const count = index ? index.count : posAttr.count;
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!mat || mat.visible === false) continue;
    if (mat.transparent && (mat.opacity ?? 1) < 0.25) continue;

    const col = mat.color ? [mat.color.r, mat.color.g, mat.color.b] : [1, 1, 1];
    const emissive = mat.emissive ? [mat.emissive.r, mat.emissive.g, mat.emissive.b] : [0, 0, 0];
    const basic = mat.isMeshBasicMaterial;
    nm.getNormalMatrix(mesh.matrixWorld);
    const texPx = getPixels(mat.map);

    const worldPos = [];
    const worldN = [];
    for (let i = 0; i < posAttr.count; i++) {
      v.fromBufferAttribute(posAttr, i).applyMatrix4(mesh.matrixWorld);
      worldPos.push(v.x, v.y, v.z);
      n.set(1, 0, 0);
    }
    // per-face normals computed in screen space loop instead (flat shading, fast)
    for (let t = 0; t < count; t += 3) {
      tris++;
      const i0 = index ? index.getX(t) : t;
      const i1 = index ? index.getX(t + 1) : t + 1;
      const i2 = index ? index.getX(t + 2) : t + 2;
      const ax = worldPos[i0 * 3], ay = worldPos[i0 * 3 + 1], az = worldPos[i0 * 3 + 2];
      const bx = worldPos[i1 * 3], by = worldPos[i1 * 3 + 1], bz = worldPos[i1 * 3 + 2];
      const cx = worldPos[i2 * 3], cy = worldPos[i2 * 3 + 1], cz = worldPos[i2 * 3 + 2];
      // face normal
      const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
      const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
      let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;

      // ---- clip-space projection with near-plane clipping ----
      const clip = [[ax, ay, az], [bx, by, bz], [cx, cy, cz]].map(([px, py, pz]) => {
        const e = vp.elements;
        const cx4 = px * e[0] + py * e[4] + pz * e[8] + e[12];
        const cy4 = px * e[1] + py * e[5] + pz * e[9] + e[13];
        const cw = px * e[3] + py * e[7] + pz * e[11] + e[15];
        return [cx4, cy4, cw];
      });
      const NEAR = 0.06;
      let poly = clip;
      if (clip.some((v) => v[2] <= NEAR)) {
        const out = [];
        for (let i = 0; i < poly.length; i++) {
          const a1 = poly[i], b1 = poly[(i + 1) % poly.length];
          const ain = a1[2] > NEAR, bin = b1[2] > NEAR;
          if (ain) out.push(a1);
          if (ain !== bin) {
            const t = (NEAR - a1[2]) / (b1[2] - a1[2]);
            out.push([a1[0] + (b1[0] - a1[0]) * t, a1[1] + (b1[1] - a1[1]) * t, NEAR]);
          }
        }
        poly = out;
      }
      if (poly.length < 3) continue;

      // shading (unchanged, uses the face normal)
      let lambert = ambient;
      let tint = [1, 1, 1];
      for (const L of lights) {
        const d = Math.max(0, nx * L.dir.x + ny * L.dir.y + nz * L.dir.z);
        lambert += d * L.intensity;
        tint = tint.map((c, i) => c * (0.6 + L.color[i] * d));
      }
      lambert = Math.min(lambert, 1.6);
      tint = tint.map((c) => Math.min(1.5, Math.max(0.35, c)));

      let texCol = [1, 1, 1];
      if (texPx && uvAttr) {
        const u = (uvAttr.getX(i0) + uvAttr.getX(i1) + uvAttr.getX(i2)) / 3;
        const vv = (uvAttr.getY(i0) + uvAttr.getY(i1) + uvAttr.getY(i2)) / 3;
        const px = Math.min(texPx.width - 1, Math.max(0, Math.floor(((u % 1) + 1) % 1 * texPx.width)));
        const py = Math.min(texPx.height - 1, Math.max(0, Math.floor((1 - (((vv % 1) + 1) % 1)) * texPx.height)));
        const o = (py * texPx.width + px) * 4;
        texCol = [texPx.data[o] / 255, texPx.data[o + 1] / 255, texPx.data[o + 2] / 255];
      }

      let r, g, b;
      if (basic) {
        r = col[0] * texCol[0]; g = col[1] * texCol[1]; b = col[2] * texCol[2];
      } else {
        r = (col[0] * texCol[0] * lambert) * tint[0] + emissive[0];
        g = (col[1] * texCol[1] * lambert) * tint[1] + emissive[1];
        b = (col[2] * texCol[2] * lambert) * tint[2] + emissive[2];
      }
      if (tonemap) {
        const f = (c) => {
          c *= exposure;
          c = (c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14);
          c = Math.min(1, Math.max(0, c));
          return Math.pow(c, 1 / 2.2) * 255;
        };
        r = f(r); g = f(g); b = f(b);
      } else {
        r = Math.min(255, r * 255); g = Math.min(255, g * 255); b = Math.min(255, b * 255);
      }

      // screen-space vertices of the (possibly clipped) polygon
      const pts = poly.map(([cx4, cy4, cw]) => [(cx4 / cw * 0.5 + 0.5) * W, (1 - (cy4 / cw * 0.5 + 0.5)) * H, cw]);
      drawn++;

      // fan triangulate and rasterise with a 1/w z-buffer
      for (let f = 1; f < pts.length - 1; f++) {
        const tri = [pts[0], pts[f], pts[f + 1]];
        const minX = Math.max(0, Math.floor(Math.min(tri[0][0], tri[1][0], tri[2][0])));
        const maxX = Math.min(W - 1, Math.ceil(Math.max(tri[0][0], tri[1][0], tri[2][0])));
        const minY = Math.max(0, Math.floor(Math.min(tri[0][1], tri[1][1], tri[2][1])));
        const maxY = Math.min(H - 1, Math.ceil(Math.max(tri[0][1], tri[1][1], tri[2][1])));
        if (maxX < minX || maxY < minY) continue;
        const [x0, y0, w0] = tri[0], [x1, y1, w1] = tri[1], [x2, y2, w2] = tri[2];
        let den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
        if (Math.abs(den) < 1e-9) continue;
        const flip = den < 0;
        if (flip) den = -den;
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            let a = ((y1 - y2) * (x + 0.5 - x2) + (x2 - x1) * (y + 0.5 - y2)) / den;
            let bb = ((y2 - y0) * (x + 0.5 - x2) + (x0 - x2) * (y + 0.5 - y2)) / den;
            if (flip) { a = -a; bb = -bb; }
            const c = 1 - a - bb;
            if (a < -1e-6 || bb < -1e-6 || c < -1e-6) continue;
            const depth = a * (1 / w0) + bb * (1 / w1) + c * (1 / w2);
            const idx = y * W + x;
            if (depth <= zbuf[idx]) continue;
            zbuf[idx] = depth;
            const o = idx * 4;
            data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
          }
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, canvas.toBuffer('image/png'));
  return { out, tris, drawn, width, height };
}
