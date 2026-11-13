import * as THREE from 'three';
import {
  wallpaperTexture, plasterTexture, woodFloorTexture, tileFloorTexture, concreteTexture,
  asphaltTexture, sidewalkTexture, brickTexture, grassTexture, roofTileTexture,
  productLabelTexture, glowTexture, shaftTexture, skyTexture, blobShadowTexture, productAtlasTexture,
} from './textures.js';

/**
 * Central material library. Textures are built once and reused so the
 * phone only ever holds a handful of GPU textures.
 */
export class Assets {
  constructor(renderer) {
    this.renderer = renderer;
    this.aniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    this.tex = {};
    this.mat = {};
    this._build();
  }

  _t(key, fn) { this.tex[key] = fn(); this.tex[key].anisotropy = this.aniso; return this.tex[key]; }

  _build() {
    const T = this.tex;
    this._t('wallpaper', wallpaperTexture);
    this._t('plaster', plasterTexture);
    this._t('woodFloor', woodFloorTexture);
    this._t('tile', () => tileFloorTexture('#9aa09b', '#4a4f4d'));
    this._t('shopTile', () => tileFloorTexture('#c9cdc6', '#8f948d'));
    this._t('concrete', () => concreteTexture());
    this._t('concreteDark', () => concreteTexture([72, 74, 76]));
    this._t('asphalt', asphaltTexture);
    this._t('sidewalk', sidewalkTexture);
    this._t('brick', brickTexture);
    this._t('grass', grassTexture);
    this._t('roof', roofTileTexture);
    this._t('sky', skyTexture);
    this._t('glow', () => glowTexture());
    this._t('shaft', shaftTexture);
    this._t('shadow', blobShadowTexture);
    this._t('productAtlas', productAtlasTexture);

    const M = this.mat;
    M.wallpaper = new THREE.MeshStandardMaterial({ map: T.wallpaper, roughness: 0.94, metalness: 0 });
    M.plaster = new THREE.MeshStandardMaterial({ map: T.plaster, roughness: 0.95 });
    M.woodFloor = new THREE.MeshStandardMaterial({ map: T.woodFloor, roughness: 0.72, metalness: 0.02 });
    M.tile = new THREE.MeshStandardMaterial({ map: T.tile, roughness: 0.5, metalness: 0.05 });
    M.shopTile = new THREE.MeshStandardMaterial({ map: T.shopTile, roughness: 0.35, metalness: 0.03 });
    M.concrete = new THREE.MeshStandardMaterial({ map: T.concrete, roughness: 0.92 });
    M.concreteDark = new THREE.MeshStandardMaterial({ map: T.concreteDark, roughness: 0.9 });
    M.asphalt = new THREE.MeshStandardMaterial({ map: T.asphalt, roughness: 0.95 });
    M.sidewalk = new THREE.MeshStandardMaterial({ map: T.sidewalk, roughness: 0.85 });
    M.brick = new THREE.MeshStandardMaterial({ map: T.brick, roughness: 0.92 });
    M.grass = new THREE.MeshStandardMaterial({ map: T.grass, roughness: 1 });
    M.roof = new THREE.MeshStandardMaterial({ map: T.roof, roughness: 0.9 });

    M.woodOld = new THREE.MeshStandardMaterial({ color: 0x4a3325, roughness: 0.82 });
    M.woodWarm = new THREE.MeshStandardMaterial({ color: 0x6b4a30, roughness: 0.7 });
    M.woodPaint = new THREE.MeshStandardMaterial({ color: 0x8d8f7e, roughness: 0.85 });
    M.metal = new THREE.MeshStandardMaterial({ color: 0x9aa1a6, roughness: 0.35, metalness: 0.85 });
    M.metalDark = new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.45, metalness: 0.7 });
    M.chrome = new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.18, metalness: 1 });
    M.fabricRed = new THREE.MeshStandardMaterial({ color: 0x6d2b24, roughness: 0.95 });
    M.fabricGrey = new THREE.MeshStandardMaterial({ color: 0x5d5f63, roughness: 0.98 });
    M.fabricCream = new THREE.MeshStandardMaterial({ color: 0xcbbfa5, roughness: 0.97 });
    M.fabricBlue = new THREE.MeshStandardMaterial({ color: 0x35455c, roughness: 0.97 });
    M.blanket = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 1 });
    M.mattress = new THREE.MeshStandardMaterial({ color: 0xd9d2c2, roughness: 1 });
    M.glass = new THREE.MeshPhysicalMaterial({
      color: 0xbfe0ea, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.22,
      transmission: 0.0, side: THREE.DoubleSide,
    });
    M.glassDark = new THREE.MeshStandardMaterial({ color: 0x0c1418, roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.55 });
    M.windowGlow = new THREE.MeshBasicMaterial({ color: 0xffcf8a });
    M.neon = new THREE.MeshBasicMaterial({ color: 0x9ff6ff });
    M.neonGreen = new THREE.MeshBasicMaterial({ color: 0xb6ff5c });
    M.paper = new THREE.MeshStandardMaterial({ color: 0xe8e2cf, roughness: 0.95 });
    M.plasticWhite = new THREE.MeshStandardMaterial({ color: 0xe9ecef, roughness: 0.4 });
    M.plasticRed = new THREE.MeshStandardMaterial({ color: 0xb4271f, roughness: 0.45 });
    M.plasticYellow = new THREE.MeshStandardMaterial({ color: 0xe8b53c, roughness: 0.45 });
    M.plasticGreen = new THREE.MeshStandardMaterial({ color: 0x2f7d4f, roughness: 0.42 });
    M.plasticBlue = new THREE.MeshStandardMaterial({ color: 0x245a9e, roughness: 0.42 });
    M.rubber = new THREE.MeshStandardMaterial({ color: 0x1a1c1e, roughness: 0.95 });
    M.leather = new THREE.MeshStandardMaterial({ color: 0x38302a, roughness: 0.6 });
    M.coin = new THREE.MeshStandardMaterial({ color: 0xd9b55c, roughness: 0.25, metalness: 0.95 });
    M.emissiveWarm = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
    M.emissiveCool = new THREE.MeshBasicMaterial({ color: 0xdff1ff });
    M.dirt = new THREE.MeshStandardMaterial({ color: 0x3a3128, roughness: 1 });
    M.rust = new THREE.MeshStandardMaterial({ color: 0x6b3a24, roughness: 0.9, metalness: 0.3 });
    M.tarp = new THREE.MeshStandardMaterial({ color: 0x2f4b56, roughness: 0.9, side: THREE.DoubleSide });
    M.productAtlas = new THREE.MeshStandardMaterial({ map: T.productAtlas, roughness: 0.55 });
    M.skinDark = new THREE.MeshStandardMaterial({ color: 0x8a5a3c, roughness: 0.75 });
  }

  /** UV cell (u0,v0,u1,v1) for a product kind in the atlas. */
  atlasCell(kindIndex) {
    const col = kindIndex % 3, row = Math.floor(kindIndex / 3);
    return { u0: col / 3, u1: (col + 1) / 3, v0: 1 - (row + 1) / 2, v1: 1 - row / 2 };
  }

  productMaterial(kind, seed) {
    const key = `${kind}:${seed}`;
    this.mat[key] = this.mat[key] || new THREE.MeshStandardMaterial({
      map: productLabelTexture(kind, seed), roughness: 0.55,
    });
    return this.mat[key];
  }

  blobShadow() {
    return new THREE.MeshBasicMaterial({
      map: this.tex.shadow, transparent: true, depthWrite: false, opacity: 0.9,
    });
  }
}
