(() => {
  'use strict';
  if (window.__csgfItogInstalled) return;
  window.__csgfItogInstalled = true;

  // Capture only the roulette data received by this page. The site sometimes
  // supplies the image at the landing position as a data URL instead of a URL
  // under /storage/. Decoding it into a canvas avoids an img-src restriction.
  const games = new Map();
  const NativeSocket = window.WebSocket;
  function handleFrame(text) {
    // Centrifuge may send multiple JSON objects in a single frame.
    let start = -1, depth = 0, string = false, escape = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (start < 0) { if (c === '{') { start = i; depth = 1; } continue; }
      if (string) {
        if (escape) escape = false;
        else if (c === '\\') escape = true;
        else if (c === '"') string = false;
      } else if (c === '"') string = true;
      else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) {
        try { processMessage(JSON.parse(text.slice(start, i + 1))); } catch (_) {}
        start = -1;
      }
    }
  }
  function processMessage(msg) {
    if (msg?.push?.channel !== 'slide_game') return;
    const data = msg.push.pub?.data;
    const game = String(data?.game || '');
    if (!/^\d+$/.test(game) || !Array.isArray(data.line)) return;
    const margin = Number(data.margin);
    if (!Number.isFinite(margin)) return;
    // The site's own animation moves by 3 * margin rem, with one 3-rem image
    // per position. The site's explicit winner.position takes precedence.
    const index = data.winner && Number.isInteger(Number(data.winner.position))
      ? Number(data.winner.position) : Math.floor(margin);
    const src = data.line[index];
    if (typeof src !== 'string' || !/^data:image\/(?:jpeg|png|webp);base64,/i.test(src) || src.length > 500000) return;
    const old = games.get(game);
    if (old && old.src === src && old.index === index) return;
    games.set(game, { src, index });
    // Keep a bounded cache: this page also receives updates for other rooms.
    if (games.size > 30) games.delete(games.keys().next().value);
  }
  if (NativeSocket) {
    window.WebSocket = new Proxy(NativeSocket, {
      construct(target, args, newTarget) {
        const socket = Reflect.construct(target, args, newTarget);
        socket.addEventListener('message', event => {
          if (typeof event.data === 'string') handleFrame(event.data);
          else if (event.data instanceof ArrayBuffer) handleFrame(new TextDecoder().decode(event.data));
          else if (event.data instanceof Blob) event.data.text().then(handleFrame).catch(() => {});
        });
        return socket;
      }
    });
  }

  function init() {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Итог';
    button.title = 'Переместить ленту к конечной позиции';
    button.style.cssText = 'position:fixed;bottom:20px;left:20px;z-index:2147483647;padding:12px 22px;border:2px solid #53d9b7;border-radius:10px;background:#152a40;color:white;font:bold 16px Arial,sans-serif;cursor:pointer;box-shadow:0 3px 12px #0008';
    document.body.appendChild(button);
    let timer = null, deadline = 0;
    const overlays = new Map();

    async function showImage(game, record) {
      const key = game.id;
      if (overlays.has(key)) return;
      const canvas = document.createElement('canvas');
      const overlay = { canvas, game, record };
      overlays.set(key, overlay);
      try {
        const base64 = record.src.split(',')[1];
        const binary = atob(base64);
        const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
        if (!game.isConnected || overlays.get(key) !== overlay) { bitmap.close(); return; }
        canvas.width = bitmap.width; canvas.height = bitmap.height;
        canvas.getContext('2d').drawImage(bitmap, 0, 0);
        bitmap.close();
        canvas.style.cssText = 'position:fixed;pointer-events:none;z-index:10000;object-fit:cover;display:none';
        document.body.appendChild(canvas);
      } catch (_) { overlays.delete(key); }
    }
    function updateOverlays() {
      for (const [key, overlay] of overlays) {
        if (!overlay.game.isConnected) { overlay.canvas.remove(); overlays.delete(key); continue; }
        const line = overlay.game.querySelector('.line');
        const image = line?.querySelectorAll('img')[overlay.record.index];
        if (!image) { overlay.canvas.style.display = 'none'; continue; }
        const r = image.getBoundingClientRect();
        const clip = line.parentElement.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0 || r.right <= clip.left || r.left >= clip.right || r.bottom <= clip.top || r.top >= clip.bottom) {
          overlay.canvas.style.display = 'none'; continue;
        }
        Object.assign(overlay.canvas.style, { display:'block', left:r.left+'px', top:r.top+'px', width:r.width+'px', height:r.height+'px' });
      }
    }
    setInterval(updateOverlays, 150);
    function endSpin() {
      let changed = false;
      for (const line of document.querySelectorAll('.jackpot [id^="game_"] .line')) {
        if (!line.querySelector('img') || !line.getClientRects().length) continue;
        const transform = line.style.transform;
        const cssTarget = transform && !/^translate3d\(0(?:px)?\s*,\s*0(?:px)?\s*,\s*0(?:px)?\s*\)$/.test(transform);
        let jquery;
        try { jquery = window.parcelRequirea96a?.('dlAzT')?.default; } catch (_) {}
        const jqueryActive = typeof jquery === 'function' && jquery(line).is(':animated');
        if (!cssTarget && !jqueryActive) continue;
        if (jqueryActive) jquery(line).stop(true, true);
        if (cssTarget) {
          line.style.setProperty('transition', 'none', 'important');
          for (const animation of line.getAnimations()) { try { animation.finish(); } catch (_) {} }
        }
        const game = line.closest('[id^="game_"]');
        const record = game && games.get(game.id.slice(5));
        if (record) showImage(game, record);
        changed = true;
      }
      if (changed) {
        clearInterval(timer); timer = null;
        button.textContent = 'Готово';
        setTimeout(() => { if (!timer) button.textContent = 'Итог'; }, 2000);
      } else if (Date.now() >= deadline) {
        clearInterval(timer); timer = null;
        button.textContent = 'Нет прокрутки';
        setTimeout(() => { if (!timer) button.textContent = 'Итог'; }, 2000);
      }
    }
    button.addEventListener('click', () => {
      clearInterval(timer); button.textContent = 'Ожидание...';
      deadline = Date.now() + 5000;
      timer = setInterval(endSpin, 150); endSpin();
    });
  }
  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init, { once: true });
})();
