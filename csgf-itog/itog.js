(() => {
  'use strict';
  if (window.__csgfItogInstalled) return;
  window.__csgfItogInstalled = true;

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Итог';
  button.title = 'Переместить ленту к конечной позиции';
  button.style.cssText = 'position:fixed;bottom:20px;left:20px;z-index:2147483647;padding:12px 22px;border:2px solid #53d9b7;border-radius:10px;background:#152a40;color:white;font:bold 16px Arial,sans-serif;cursor:pointer;box-shadow:0 3px 12px #0008';
  document.body.appendChild(button);

  let timer = null;
  let deadline = 0;
  // After skipping, the site's line may still contain a masked avatar. Wait
  // for its official winner marker and copy that user's avatar from the page.
  const watchedGames = new Set();
  function restoreWinners() {
    for (const game of watchedGames) {
      if (!game.isConnected) { watchedGames.delete(game); continue; }
      const winnerImage = game.querySelector('.line img.winner');
      const winnerLink = game.querySelector('.sliding .winner[href*="/user/"]');
      if (!winnerImage || !winnerLink) continue;
      const match = winnerLink.getAttribute('href')?.match(/\/user\/(\d+)(?:[/?#]|$)/);
      if (!match) continue;
      const id = match[1];
      // A matching non-roulette image is best, including its cache-busting
      // suffix. Fall back to the site's usual avatar URL for this user.
      const images = [...document.querySelectorAll('img')];
      const avatar = images.find(img => img !== winnerImage &&
        !img.closest('.line') &&
        (img.getAttribute('src') || '').includes('/storage/ava_' + id + '.'));
      const source = avatar?.getAttribute('src') || '/storage/ava_' + id + '.jpg';
      if (winnerImage.getAttribute('src') !== source) {
        winnerImage.removeAttribute('pixelated');
        winnerImage.setAttribute('src', source);
      }
    }
  }
  setInterval(restoreWinners, 250);
  function endSpin() {
    let changed = false;
    for (const line of document.querySelectorAll('.jackpot [id^="game_"] .line')) {
      if (!line.querySelector('img') || !line.getClientRects().length) continue;
      // The site sets the final transform when it starts a CSS spin. Its older
      // fallback instead animates margin-left with its bundled jQuery.
      const transform = line.style.transform;
      const cssTarget = transform && !/^translate3d\(0(?:px)?\s*,\s*0(?:px)?\s*,\s*0(?:px)?\s*\)$/.test(transform);
      let jquery;
      try { jquery = window.parcelRequirea96a?.('dlAzT')?.default; } catch (_) {}
      const jqueryActive = typeof jquery === 'function' && jquery(line).is(':animated');
      if (!cssTarget && !jqueryActive) continue;
      const game = line.closest('[id^="game_"]');
      if (game) watchedGames.add(game);
      if (jqueryActive) jquery(line).stop(true, true);
      if (cssTarget) {
        line.style.setProperty('transition', 'none', 'important');
        // Finish any transition already running. The inline transform remains
        // the target set by the website, rather than a guessed winner.
        for (const animation of line.getAnimations()) {
          try { animation.finish(); } catch (_) { /* already finished */ }
        }
      }
      restoreWinners();
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
    clearInterval(timer);
    button.textContent = 'Ожидание...';
    deadline = Date.now() + 5000;
    timer = setInterval(endSpin, 150);
    endSpin();
  });
})();
