import fs from 'node:fs';
import { installDom, stubRenderer } from '../tests/harness.mjs';
import { installNapiCanvas } from './canvas-adapter.mjs';
installDom(); installNapiCanvas();
const { Assets } = await import('../src/core/assets.js');
const a = new Assets(stubRenderer());
fs.mkdirSync('previews/tex', { recursive: true });
const names = ['wallpaper','plaster','woodFloor','tile','shopTile','concrete','asphalt','sidewalk','brick','grass','roof','productAtlas','sky'];
for (const n of names) {
  const t = a.tex[n];
  if (!t?.image) continue;
  fs.writeFileSync(`previews/tex/${n}.png`, t.image.toBuffer('image/png'));
}
console.log('dumped', names.length);
