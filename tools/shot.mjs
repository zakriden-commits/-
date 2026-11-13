/** Real browser screenshots of the running game (Chromium + SwiftShader). */
import chromiumPkg from '@sparticuz/chromium';
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = process.env.BASE || 'http://127.0.0.1:5173/';
const exe = await chromiumPkg.executablePath();

const browser = await chromium.launch({
  executablePath: exe,
  args: [
    '--no-sandbox', '--disable-dev-shm-usage', '--single-process', '--no-zygote',
    '--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader',
    '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
  ],
  headless: true,
});
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}\n${e.stack}`));

const frames = (n = 3) => page.evaluate((count) => new Promise((res) => {
  let seen = 0;
  const tick = () => { if (++seen >= count) res(true); else requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}), n);

await page.goto(BASE, { waitUntil: 'load' });
await page.waitForFunction(() => window.__islamwork, null, { timeout: 60000 });
await page.waitForTimeout(2000);
await frames(6);
fs.mkdirSync('shots', { recursive: true });
await page.screenshot({ path: 'shots/01-title.png' });

// start through the real button, capture the closed-eye beat, then advance the
// deterministic wake timeline for the open-eye and standing screenshots.
await page.click('#btnStart');
await frames(1);
await page.screenshot({ path: 'shots/02-wake-eyes-closed.png' });
await page.evaluate(() => {
  const g = window.__islamwork;
  g._advanceWake(2.25);
  g.player.update(1 / 60, g.input, { hideHands: !g.wakePose.handsVisible });
  g._updateBlink(1 / 60);
  g.composer.render();
});
await frames(1);
await page.screenshot({ path: 'shots/03-wake-eyes-open.png' });
await page.evaluate(() => {
  const g = window.__islamwork;
  g._advanceWake(20);
  g.player.update(1 / 60, g.input, { hideHands: !g.wakePose.handsVisible });
  g._finishWake();
  g.player.update(1 / 60, g.input, {});
  g._updateBlink(1 / 60);
  g.composer.render();
});
await frames(1);
await page.screenshot({ path: 'shots/04-wake-standing.png' });

// look around the bedroom
await page.evaluate(() => { const g = window.__islamwork; g.player.yaw = Math.PI * 1.05; g.player.pitch = -0.12; });
await page.waitForTimeout(600);
  await frames(3);
  await page.screenshot({ path: 'shots/05-bedroom.png' });

// walk into the living room
await page.evaluate(() => { const g = window.__islamwork; g.player.teleport(-1.5, -0.5, Math.PI * 1.45); });
await page.waitForTimeout(700);
  await frames(3);
  await page.screenshot({ path: 'shots/06-living.png' });

// street
await page.evaluate(() => { const g = window.__islamwork; g.flags.leftHouse = true; g.mission.stage = 'street'; g.player.teleport(0.5, 6.5, Math.PI); });
await page.waitForTimeout(900);
  await frames(3);
  await page.screenshot({ path: 'shots/07-street.png' });

// shop front
await page.evaluate(() => { const g = window.__islamwork; g.player.teleport(2.6, 12.0, Math.PI); });
await page.waitForTimeout(900);
  await frames(3);
  await page.screenshot({ path: 'shots/08-shop-front.png' });

// inside the shop
await page.evaluate(() => { const g = window.__islamwork; g.mission.stage = 'shop'; g.player.teleport(3.0, 15.6, Math.PI * 0.92); });
await page.waitForTimeout(1200);
  await frames(3);
  await page.screenshot({ path: 'shots/09-shop-inside.png' });

// near the guard
await page.evaluate(() => { const g = window.__islamwork; g.guard.pos.set(-1.0, 0, 20.5); g.guard.yaw = Math.PI * 0.7; g.player.teleport(0.6, 22.4, Math.PI * 1.15); });
await page.waitForTimeout(1500);
  await frames(3);
  await page.screenshot({ path: 'shots/10-guard.png' });

// checkout with the cashier
await page.evaluate(() => { const g = window.__islamwork; g.player.teleport(-4.2, 18.4, Math.PI * 1.28); });
await page.waitForTimeout(1200);
  await frames(3);
  await page.screenshot({ path: 'shots/11-checkout.png' });

// prompt visible near a product
await page.evaluate(() => { const g = window.__islamwork; g.player.teleport(-3.0, 18.2, Math.PI * 1.5); });
await page.waitForTimeout(800);
  await frames(3);
  await page.screenshot({ path: 'shots/12-prompt.png' });

console.log('fps sample:', await page.evaluate(async () => new Promise((res) => {
  let frames = 0; const t0 = performance.now();
  const tick = () => { frames++; if (performance.now() - t0 < 2000) requestAnimationFrame(tick); else res((frames / ((performance.now() - t0) / 1000)).toFixed(1)); };
  requestAnimationFrame(tick);
})));
console.log('THREE objects:', await page.evaluate(() => window.__islamwork.scene.children.length));
console.log('errors:', errors.length ? errors.slice(0, 6).join('\n---\n') : 'none');
await browser.close();
