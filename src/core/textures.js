import * as THREE from 'three';
import { makeRng, clamp } from './util.js';

/* ------------------------------------------------------------------ *
 * Procedural textures — everything is generated at runtime into
 * canvases so the game ships with zero image downloads (important for
 * PWA caching and instant load on a phone).
 * ------------------------------------------------------------------ */

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return { c, ctx: c.getContext('2d') };
}

function finish(c, { repeat = [1, 1], srgb = true, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

/** Add fine grain so flat surfaces never look like plastic. */
function grain(ctx, w, h, amount = 14, seed = 3) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const rng = makeRng(seed);
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng() - 0.5) * amount;
    d[i] = clamp(d[i] + n, 0, 255);
    d[i + 1] = clamp(d[i + 1] + n, 0, 255);
    d[i + 2] = clamp(d[i + 2] + n, 0, 255);
  }
  ctx.putImageData(img, 0, 0);
}

function blobs(ctx, w, h, count, seed, colors, radius = [20, 90], alpha = 0.08) {
  const rng = makeRng(seed);
  for (let i = 0; i < count; i++) {
    const x = rng() * w, y = rng() * h;
    const r = radius[0] + rng() * (radius[1] - radius[0]);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const col = colors[Math.floor(rng() * colors.length)];
    g.addColorStop(0, `rgba(${col},${alpha})`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
}

/* ----------------------------- walls ----------------------------- */

export function wallpaperTexture() {
  const { c, ctx } = canvas(512, 512);
  ctx.fillStyle = '#c9b79a'; ctx.fillRect(0, 0, 512, 512);
  // faded vertical stripes
  for (let x = 0; x < 512; x += 64) {
    ctx.fillStyle = 'rgba(140,116,82,0.16)'; ctx.fillRect(x, 0, 26, 512);
    ctx.fillStyle = 'rgba(255,246,225,0.10)'; ctx.fillRect(x + 30, 0, 8, 512);
  }
  // old small floral-ish pattern
  const rng = makeRng(11);
  for (let i = 0; i < 90; i++) {
    const x = rng() * 512, y = rng() * 512;
    ctx.strokeStyle = 'rgba(120,96,66,0.13)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(x, y, 6 + rng() * 4, 0, Math.PI * 2); ctx.stroke();
  }
  blobs(ctx, 512, 512, 26, 4, ['90,66,38', '60,50,36'], [40, 150], 0.10);
  // water stains near the bottom
  const grad = ctx.createLinearGradient(0, 512, 0, 380);
  grad.addColorStop(0, 'rgba(92,70,44,0.34)'); grad.addColorStop(1, 'rgba(92,70,44,0)');
  ctx.fillStyle = grad; ctx.fillRect(0, 380, 512, 132);
  grain(ctx, 512, 512, 16, 9);
  return finish(c, { repeat: [1, 1] });
}

/** Peeling paint / damp plaster used for the hallway wall. */
export function plasterTexture() {
  const { c, ctx } = canvas(512, 512);
  ctx.fillStyle = '#b9b2a2'; ctx.fillRect(0, 0, 512, 512);
  blobs(ctx, 512, 512, 40, 21, ['120,118,108', '86,92,84', '160,150,132'], [50, 190], 0.16);
  grain(ctx, 512, 512, 22, 5);
  return finish(c);
}

export function woodFloorTexture() {
  const { c, ctx } = canvas(512, 512);
  ctx.fillStyle = '#5b3a22'; ctx.fillRect(0, 0, 512, 512);
  const rng = makeRng(77);
  const plankH = 64;
  for (let row = 0; row * plankH < 512; row++) {
    const y = row * plankH;
    const shift = (row % 2) * 128;
    for (let x = -256; x < 512; x += 256) {
      const px = x + shift;
      const base = 62 + rng() * 34;
      ctx.fillStyle = `rgb(${base + 26},${base},${base - 18})`;
      ctx.fillRect(px + 1, y + 1, 254, plankH - 2);
      // grain lines
      for (let g = 0; g < 9; g++) {
        ctx.strokeStyle = `rgba(40,24,12,${0.05 + rng() * 0.10})`;
        ctx.lineWidth = 0.6 + rng() * 1.4;
        ctx.beginPath();
        const gy = y + 4 + rng() * (plankH - 8);
        ctx.moveTo(px + 2, gy);
        ctx.bezierCurveTo(px + 80, gy + (rng() - 0.5) * 7, px + 170, gy + (rng() - 0.5) * 7, px + 252, gy + (rng() - 0.5) * 5);
        ctx.stroke();
      }
    }
  }
  // plank seams
  ctx.fillStyle = 'rgba(18,10,5,0.55)';
  for (let y = 0; y < 512; y += plankH) ctx.fillRect(0, y, 512, 2);
  grain(ctx, 512, 512, 18, 12);
  return finish(c, { repeat: [4, 4] });
}

export function tileFloorTexture(base = '#8f9490', grout = '#4c5150') {
  const { c, ctx } = canvas(512, 512);
  ctx.fillStyle = base; ctx.fillRect(0, 0, 512, 512);
  const rng = makeRng(31);
  const n = 4, s = 512 / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const v = (rng() - 0.5) * 12;
    ctx.fillStyle = `rgba(255,255,255,${0.02 + rng() * 0.04})`;
    ctx.fillRect(x * s + 3, y * s + 3, s - 6, s - 6);
    ctx.fillStyle = `rgba(0,0,0,${0.03 + Math.abs(v) * 0.004})`;
    ctx.fillRect(x * s + 3, y * s + 3, s - 6, s - 6);
  }
  ctx.strokeStyle = grout; ctx.lineWidth = 6;
  for (let i = 0; i <= n; i++) {
    ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s, 512); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * s); ctx.lineTo(512, i * s); ctx.stroke();
  }
  blobs(ctx, 512, 512, 18, 8, ['60,60,58'], [60, 200], 0.14);
  grain(ctx, 512, 512, 12, 4);
  return finish(c, { repeat: [6, 6] });
}

export function concreteTexture(tint = [104, 104, 100]) {
  const { c, ctx } = canvas(512, 512);
  ctx.fillStyle = `rgb(${tint[0]},${tint[1]},${tint[2]})`; ctx.fillRect(0, 0, 512, 512);
  blobs(ctx, 512, 512, 50, 55, ['70,70,68', '150,148,140', '52,54,56'], [60, 220], 0.16);
  // expansion seams
  ctx.strokeStyle = 'rgba(30,30,30,0.35)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 256); ctx.lineTo(512, 256); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(256, 0); ctx.lineTo(256, 512); ctx.stroke();
  grain(ctx, 512, 512, 24, 17);
  return finish(c, { repeat: [8, 8] });
}

export function asphaltTexture() {
  const { c, ctx } = canvas(512, 512);
  ctx.fillStyle = '#26262a'; ctx.fillRect(0, 0, 512, 512);
  const rng = makeRng(99);
  for (let i = 0; i < 9000; i++) {
    const v = 30 + rng() * 70;
    ctx.fillStyle = `rgba(${v},${v},${v + 4},${0.25 + rng() * 0.4})`;
    ctx.fillRect(rng() * 512, rng() * 512, 1 + rng() * 2, 1 + rng() * 2);
  }
  blobs(ctx, 512, 512, 22, 44, ['10,10,12'], [40, 160], 0.4);
  return finish(c, { repeat: [10, 10] });
}

export function sidewalkTexture() {
  const { c, ctx } = canvas(512, 512);
  ctx.fillStyle = '#7b7b74'; ctx.fillRect(0, 0, 512, 512);
  const rng = makeRng(63);
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
    ctx.fillStyle = `rgba(${118 + rng() * 24},${116 + rng() * 22},${108 + rng() * 20},1)`;
    ctx.fillRect(x * 256 + 4, y * 256 + 4, 248, 248);
  }
  ctx.strokeStyle = 'rgba(40,40,38,0.6)'; ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, 512, 512);
  ctx.beginPath(); ctx.moveTo(256, 0); ctx.lineTo(256, 512); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 256); ctx.lineTo(512, 256); ctx.stroke();
  grain(ctx, 512, 512, 20, 6);
  return finish(c, { repeat: [3, 3] });
}

export function brickTexture() {
  const { c, ctx } = canvas(512, 512);
  ctx.fillStyle = '#6d5245'; ctx.fillRect(0, 0, 512, 512);
  const rng = makeRng(1234);
  const bh = 32, bw = 96;
  for (let row = 0; row * bh < 512; row++) {
    const y = row * bh;
    const off = (row % 2) * (bw / 2);
    for (let x = -bw; x < 512 + bw; x += bw) {
      const r = 128 + rng() * 54, g = 74 + rng() * 30, b = 60 + rng() * 24;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x + off + 2, y + 2, bw - 4, bh - 4);
      ctx.fillStyle = `rgba(255,240,230,${rng() * 0.06})`;
      ctx.fillRect(x + off + 2, y + 2, bw - 4, bh - 4);
    }
  }
  grain(ctx, 512, 512, 20, 3);
  return finish(c);
}

export function grassTexture() {
  const { c, ctx } = canvas(512, 512);
  ctx.fillStyle = '#3d5230'; ctx.fillRect(0, 0, 512, 512);
  const rng = makeRng(808);
  for (let i = 0; i < 14000; i++) {
    const g = 50 + rng() * 70;
    ctx.strokeStyle = `rgba(${30 + rng() * 30},${g},${28 + rng() * 24},${0.3 + rng() * 0.5})`;
    ctx.lineWidth = 1;
    const x = rng() * 512, y = rng() * 512;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rng() - 0.5) * 3, y - 2 - rng() * 4); ctx.stroke();
  }
  blobs(ctx, 512, 512, 30, 66, ['24,40,20', '90,110,60'], [50, 180], 0.18);
  return finish(c, { repeat: [14, 14] });
}

export function roofTileTexture() {
  const { c, ctx } = canvas(512, 512);
  ctx.fillStyle = '#4a2c26'; ctx.fillRect(0, 0, 512, 512);
  const rng = makeRng(555);
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 12; col++) {
      const y = row * 51, x = col * 43 + (row % 2) * 21;
      const r = 96 + rng() * 44, g = 50 + rng() * 24, b = 40 + rng() * 18;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.beginPath(); ctx.roundRect(x + 1, y + 1, 40, 48, [10, 10, 2, 2]); ctx.fill();
      ctx.fillStyle = `rgba(230,220,200,${rng() * 0.07})`;
      ctx.fillRect(x + 1, y + 1, 40, 12);
    }
  }
  grain(ctx, 512, 512, 18, 14);
  return finish(c, { repeat: [4, 3] });
}

/* ---------------------------- materials --------------------------- */

export function productLabelTexture(kind, seed) {
  const { c, ctx } = canvas(256, 256);
  const rng = makeRng(seed);
  const palettes = {
    snack: ['#f0b429', '#b4271f', '#fff7e0', '#7a3b12'],
    drink: ['#1b6fb8', '#0c355e', '#e9f6ff', '#2f9fd6'],
    can: ['#c2c7cc', '#8b1414', '#f2f2f2', '#3c4d5e'],
    dairy: ['#f2f6f9', '#2b7fbf', '#ffe9a8', '#4a90c4'],
    bread: ['#c98f4e', '#7a4a1c', '#f3dcc0', '#5c3210'],
    box: ['#e4522c', '#2b1a12', '#ffe1b8', '#f7a72c'],
  }[kind] || ['#cccccc', '#555555', '#ffffff', '#999999'];
  const [a, b, cc, d] = palettes;
  ctx.fillStyle = a; ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = b;
  ctx.fillRect(0, 0, 256, 74);
  ctx.fillRect(0, 190, 256, 66);
  // fake brand block
  ctx.fillStyle = cc;
  ctx.beginPath(); ctx.ellipse(128, 132, 78, 42, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = b;
  ctx.font = 'bold 34px Helvetica, Arial, sans-serif';
  ctx.textAlign = 'center';
  const words = { snack: 'CRISP', drink: 'COLA', can: 'ENERGY', dairy: 'MILK', bread: 'BREAD', box: 'GOODS' };
  ctx.fillText(words[kind] || 'ITEM', 128, 144);
  // stripes / accents
  ctx.fillStyle = d;
  for (let i = 0; i < 3; i++) ctx.fillRect(16 + i * 12, 84, 6, 96);
  // barcode
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = i % 2 ? '#111' : 'rgba(255,255,255,0.9)';
    ctx.fillRect(168 + i * 3, 200, rng() > 0.4 ? 2 : 1, 40);
  }
  grain(ctx, 256, 256, 10, seed);
  return finish(c, { repeat: [1, 1] });
}

/** Soft radial sprite for dust motes, glows and light shafts. */
export function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const { c, ctx } = canvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(0.45, inner.replace(/[\d.]+\)$/, '0.45)'));
  g.addColorStop(1, outer);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Vertical light shaft used for shop windows at night. */
export function shaftTexture() {
  const { c, ctx } = canvas(64, 256);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, 'rgba(255,236,190,0.55)');
  g.addColorStop(0.6, 'rgba(255,214,140,0.18)');
  g.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Night sky gradient with stars — drawn once and scrolled slowly. */
export function skyTexture() {
  const { c, ctx } = canvas(1024, 512);
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#05070f');
  g.addColorStop(0.45, '#0b1526');
  g.addColorStop(0.72, '#1c2b40');
  g.addColorStop(1, '#33404f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1024, 512);
  const rng = makeRng(2024);
  for (let i = 0; i < 700; i++) {
    const x = rng() * 1024, y = rng() * 380;
    const r = rng() * 1.5 + 0.3;
    const a = 0.2 + rng() * 0.8 * (1 - y / 460);
    ctx.fillStyle = `rgba(220,235,255,${a})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  // soft clouds
  blobs(ctx, 1024, 512, 26, 17, ['60,78,104', '40,54,76'], [90, 260], 0.16);
  return finish(c, { srgb: true });
}

/** Cheap contact shadow sprite. */
export function blobShadowTexture() {
  const { c, ctx } = canvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 62);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.22)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  return t;
}

/**
 * One atlas holding six product label designs (3x2). Every shelf product
 * uses the same texture, so a whole shelf can be merged into a single
 * draw call — the single biggest perf win on a phone.
 */
export function productAtlasTexture() {
  const W = 768, H = 512, CW = 256, CH = 256;
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = '#242a30'; ctx.fillRect(0, 0, W, H);
  const kinds = [
    { name: 'CRISP', a: '#f0b429', b: '#b4271f', c: '#fff7e0' },
    { name: 'COLA', a: '#1b6fb8', b: '#0c355e', c: '#e9f6ff' },
    { name: 'ENERGY', a: '#c2c7cc', b: '#8b1414', c: '#f2f2f2' },
    { name: 'MILK', a: '#f2f6f9', b: '#2b7fbf', c: '#ffe9a8' },
    { name: 'BREAD', a: '#c98f4e', b: '#7a4a1c', c: '#f3dcc0' },
    { name: 'GOODS', a: '#e4522c', b: '#2b1a12', c: '#ffe1b8' },
  ];
  kinds.forEach((k, i) => {
    const x = (i % 3) * CW, y = Math.floor(i / 3) * CH;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, CW, CH); ctx.clip();
    ctx.fillStyle = k.a; ctx.fillRect(x, y, CW, CH);
    ctx.fillStyle = k.b; ctx.fillRect(x, y, CW, 78); ctx.fillRect(x, y + CH - 64, CW, 64);
    ctx.fillStyle = k.c;
    ctx.beginPath(); ctx.ellipse(x + CW / 2, y + 136, 82, 46, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = k.b;
    ctx.font = 'bold 32px Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(k.name, x + CW / 2, y + 140);
    ctx.fillStyle = k.b;
    for (let s = 0; s < 3; s++) ctx.fillRect(x + 16 + s * 13, y + 86, 6, 96);
    const rng = makeRng(300 + i);
    for (let b = 0; b < 24; b++) {
      ctx.fillStyle = b % 2 ? '#111' : 'rgba(255,255,255,0.9)';
      ctx.fillRect(x + 168 + b * 3, y + CH - 56, rng() > 0.4 ? 2 : 1, 40);
    }
    ctx.restore();
  });
  // atlas grid padding lines (avoid texture bleed)
  ctx.strokeStyle = '#242a30'; ctx.lineWidth = 6;
  for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(i * CW, 0); ctx.lineTo(i * CW, H); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(0, CH); ctx.lineTo(W, CH); ctx.stroke();
  return finish(c, { repeat: [1, 1] });
}
