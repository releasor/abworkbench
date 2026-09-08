try {
  if (localStorage.getItem('mineradio-startup-fast-skip-v1') === '1') {
    document.documentElement.classList.add('startup-fast-skip-preload');
  }
  document.documentElement.classList.add(localStorage.getItem('mineradio-diy-player-mode-v1') === '1' ? 'diy-mode-preload' : 'simple-mode-preload');
} catch (e) {
  document.documentElement.classList.add('simple-mode-preload');
}

try {
  if (new URLSearchParams(location.search).get('embedded') === '1') {
    document.documentElement.classList.add('abwb-embedded');
    var __abwbTheme = new URLSearchParams(location.search).get('theme') === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = __abwbTheme;
    document.documentElement.classList.toggle('abwb-theme-light', __abwbTheme === 'light');
    document.documentElement.classList.toggle('abwb-theme-dark', __abwbTheme !== 'light');
    try { document.documentElement.style.colorScheme = __abwbTheme; } catch (e) {}
    document.addEventListener('DOMContentLoaded', function () {
      document.body.classList.add('abwb-embedded');
      document.body.dataset.theme = __abwbTheme;
    });
  }
} catch (e) {}

try {
  if (new URLSearchParams(location.search).get('embedded') === '1') {
    var __abwbFlush = document.createElement('style');
    __abwbFlush.id = 'abwb-embed-flush-critical';
    __abwbFlush.textContent = [
      'html.abwb-embedded #desktop-window-shell,html.abwb-embedded body.desktop-shell #desktop-window-shell{border-radius:0!important;box-shadow:none!important;clip-path:none!important;transform:none!important;}',
      'html.abwb-embedded #empty-home,html.abwb-embedded body.desktop-shell #empty-home,html.abwb-embedded body.empty-home-active #empty-home{left:0!important;right:0!important;width:100%!important;max-width:none!important;transform:none!important;margin:0!important;border-radius:0!important;box-shadow:none!important;}',
      'html.abwb-embedded body:not(.empty-home-active) #empty-home{opacity:0!important;pointer-events:none!important;visibility:hidden!important;}',
      'html.abwb-embedded body.empty-home-active #empty-home{opacity:1!important;pointer-events:auto!important;visibility:visible!important;}',
      'html.abwb-embedded[data-theme="light"] body.empty-home-active,html.abwb-embedded[data-theme="light"] body.empty-home-active #desktop-window-shell{background:linear-gradient(165deg,#f8fafc 0%,#f1f5f9 100%)!important;background-color:#f1f5f9!important;}',
      'html.abwb-embedded[data-theme="light"] body:not(.empty-home-active),html.abwb-embedded[data-theme="light"] body:not(.empty-home-active) #desktop-window-shell{background:#0b1220!important;background-color:#0b1220!important;}',
      'html.abwb-embedded[data-theme="light"] body:not(.empty-home-active) #canvas-container{opacity:1!important;visibility:visible!important;filter:none!important;}'
    ].join('');
    (document.head || document.documentElement).appendChild(__abwbFlush);
  }
} catch (e) {}

