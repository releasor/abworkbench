(function () {
  // Native Electron preload already exposes the full desktopWindow API.
  if (window.desktopWindow) return;

  var pending = Object.create(null);

  window.addEventListener('message', function (event) {
    var data = event && event.data;
    if (!data || data.source !== 'abwb-desktop-bridge' || !data.id) return;
    var entry = pending[data.id];
    if (!entry) return;
    delete pending[data.id];
    if (data.ok) entry.resolve(data.result);
    else entry.reject(new Error(data.error || 'desktop bridge failed'));
  });

  function callDesktop(method, args) {
    return new Promise(function (resolve, reject) {
      if (!window.parent || window.parent === window) {
        reject(new Error('desktop bridge unavailable'));
        return;
      }
      var id = 'abwb-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
      pending[id] = { resolve: resolve, reject: reject };
      try {
        window.parent.postMessage({
          source: 'mineradio-desktop-bridge',
          id: id,
          method: method,
          args: args || null,
        }, '*');
      } catch (e) {
        delete pending[id];
        reject(e instanceof Error ? e : new Error(String(e)));
        return;
      }
      setTimeout(function () {
        if (!pending[id]) return;
        delete pending[id];
        reject(new Error('desktop bridge timeout'));
      }, 5 * 60 * 1000);
    });
  }

  function notifyAccount(info) {
    try {
      callDesktop('saveMineradioAccount', info || {}).catch(function () {});
    } catch (_) {}
  }

  window.desktopWindow = {
    isDesktop: true,
    __abwbBridge: true,
    getLoginEasterEggStatus: function () {
      return Promise.resolve({ ok: true, unlocked: true, embedded: true });
    },
    unlockLoginEasterEgg: function () {
      return Promise.resolve({ ok: true, unlocked: true, embedded: true });
    },
    resetLoginEasterEgg: function () {
      return Promise.resolve({ ok: true, unlocked: true, embedded: true });
    },
    openNeteaseMusicLogin: function () { return callDesktop('openNeteaseMusicLogin'); },
    openQQMusicLogin: function (options) { return callDesktop('openQQMusicLogin', options || {}); },
    openKugouMusicLogin: function () { return callDesktop('openKugouMusicLogin'); },
    openSpotifyMusicLogin: function () {
      return Promise.resolve({
        ok: false,
        error: 'SPOTIFY_EMBED_UNSUPPORTED',
        message: 'Spotify 官方授权暂未接入 Abworkbench 嵌入模式。',
      });
    },
    saveMineradioAccount: function (info) { return callDesktop('saveMineradioAccount', info || {}); },
    listMineradioAccounts: function () { return callDesktop('listMineradioAccounts'); },
  };

  window.__abwbNotifyMineradioAccount = notifyAccount;
})();
