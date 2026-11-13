/* Safe offline PWA lifecycle: user data lives in localStorage, never in SW cache. */
(() => {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) location.reload();
  });
  const offerUpdate = (worker) => {
    if (document.getElementById('pwaUpdateBanner')) return;
    const bar = document.createElement('div');
    bar.id = 'pwaUpdateBanner';
    bar.className = 'pwa-update-banner';
    bar.innerHTML = '<span>Доступно обновление LifeGame 2.0</span><button type="button" class="btn-primary" style="padding:5px 11px;font-size:11.5px;">Обновить</button>';
    bar.querySelector('button').addEventListener('click', () => {
      if (document.querySelector('.modal-backdrop')) {
        if (typeof showToast === 'function') showToast('Сначала сохрани или закрой открытое окно редактора');
        return;
      }
      refreshing = true;
      worker.postMessage({ type: 'SKIP_WAITING' });
    });
    document.body.appendChild(bar);
  };
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).then((reg) => {
      if (reg.waiting) offerUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (w) {
          w.addEventListener('statechange', () => {
            if (w.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(w);
          });
        }
      });
    }).catch(() => {});
  });
})();
