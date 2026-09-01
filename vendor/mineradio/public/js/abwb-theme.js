/**
 * Abworkbench ↔ Mineradio theme bridge (embed only).
 * Applies light/dark from ?theme= or parent postMessage.
 */
(function () {
  function normalizeTheme(value) {
    return value === 'light' ? 'light' : 'dark';
  }

  function applyAbwbLightPlaybackFx() {
    try {
      if (typeof window.fx === 'undefined' || !window.fx) return false;
      window.fx.lyricBackgroundAdapt = 1;
      if (typeof window.syncFxUniforms === 'function') window.syncFxUniforms();
      if (typeof window.renderLyrics === 'function') window.renderLyrics({ reason: 'abwb-theme-light' });
      return true;
    } catch (_) {
      return false;
    }
  }

  function scheduleAbwbLightPlaybackFx() {
    var tries = 0;
    function tick() {
      if (normalizeTheme(document.documentElement.dataset.theme || 'dark') !== 'light') return;
      if (applyAbwbLightPlaybackFx()) return;
      if (tries++ < 48) setTimeout(tick, 250);
    }
    tick();
  }

  function applyAbwbTheme(theme) {
    var mode = normalizeTheme(theme);
    var root = document.documentElement;
    root.dataset.theme = mode;
    root.classList.toggle('abwb-theme-light', mode === 'light');
    root.classList.toggle('abwb-theme-dark', mode === 'dark');
    if (document.body) {
      document.body.dataset.theme = mode;
      document.body.classList.toggle('abwb-embed-playback-light', mode === 'light');
    }
    try {
      root.style.colorScheme = mode;
    } catch (_) {}
    if (mode === 'light') scheduleAbwbLightPlaybackFx();
    return mode;
  }

  window.__abwbApplyTheme = applyAbwbTheme;

  try {
    var params = new URLSearchParams(location.search || '');
    if (params.get('embedded') === '1') {
      applyAbwbTheme(params.get('theme') || 'dark');
    }
  } catch (_) {}

  window.addEventListener('message', function (event) {
    var data = event && event.data;
    if (!data || data.source !== 'abwb-theme') return;
    applyAbwbTheme(data.theme);
  });

  document.addEventListener('DOMContentLoaded', function () {
    try {
      var params = new URLSearchParams(location.search || '');
      if (params.get('embedded') === '1') {
        applyAbwbTheme(params.get('theme') || document.documentElement.dataset.theme || 'dark');
        if (document.body) {
          var obs = new MutationObserver(function () {
            if (normalizeTheme(document.documentElement.dataset.theme || 'dark') !== 'light') return;
            if (!document.body.classList.contains('empty-home-active')) scheduleAbwbLightPlaybackFx();
          });
          obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        }
      }
    } catch (_) {}
  });
})();
