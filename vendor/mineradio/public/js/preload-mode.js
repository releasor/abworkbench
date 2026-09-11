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
    document.addEventListener('DOMContentLoaded', function () {
      document.body.classList.add('abwb-embedded');
    });
  }
} catch (e) {}

