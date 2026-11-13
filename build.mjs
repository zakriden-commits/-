import * as esbuild from 'esbuild';
import { cp, mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const watch = process.argv.includes('--watch');

const options = {
  entryPoints: { game: 'src/main.js' },
  outdir: 'dist',
  bundle: true,
  format: 'esm',
  target: ['es2020'],
  minify: !watch,
  sourcemap: watch,
  legalComments: 'none',
  logLevel: 'info',
};

async function copyStatic() {
  await mkdir('dist/icons', { recursive: true });
  for (const f of ['index.html', 'manifest.webmanifest', 'sw.js']) {
    await cp(f, path.join('dist', f));
  }
  for (const f of await readdir('icons')) {
    await cp(path.join('icons', f), path.join('dist/icons', f));
  }
}

if (watch) {
  const ctx = await esbuild.context({ ...options, plugins: [{
    name: 'static', setup(b) { b.onEnd(async (r) => { if (!r.errors.length) await copyStatic(); }); }
  }]});
  await copyStatic();
  await ctx.watch();
  console.log('watching…');
} else {
  await esbuild.build(options);
  await copyStatic();
  const { size } = await stat('dist/game.js');
  console.log(`dist/game.js ${(size / 1024).toFixed(0)} KB`);
}
