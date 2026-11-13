import assert from 'node:assert/strict';
import { installDom } from './harness.mjs';

const elements = installDom();
const { HUD } = await import('../src/ui/hud.js');
const hud = new HUD();

assert.equal(typeof hud.toast, 'function', 'toast action stays callable beside its DOM element');
hud.toast('+120 ₴', 'в кармане', 1.6);
assert.equal(elements.get('toast').classList.contains('on'), true, 'toast appears');
assert.equal(hud.toastBig.textContent, '+120 ₴');
assert.equal(hud.toastSmall.textContent, 'в кармане');
hud.update(1.7);
assert.equal(elements.get('toast').classList.contains('on'), false, 'toast expires without throwing');

console.log('\nHUD TOAST TEST PASSED\n');
