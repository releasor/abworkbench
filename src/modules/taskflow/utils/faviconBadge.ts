/**
 * Dynamically renders a task count badge on the favicon.
 * Draws the original favicon onto a canvas, overlays a colored badge with the count,
 * then swaps the <link rel="icon"> href to the new data URL.
 */

let _canvas: HTMLCanvasElement | null = null;
let _ctx: CanvasRenderingContext2D | null = null;
let _baseImage: HTMLImageElement | null = null;
let _baseLoaded = false;
let _currentCount = -1;

function getCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  if (!_canvas) {
    _canvas = document.createElement('canvas');
    _canvas.width = 32;
    _canvas.height = 32;
    _ctx = _canvas.getContext('2d')!;
  }
  return { canvas: _canvas, ctx: _ctx! };
}

function getOrCreateLink(): HTMLLinkElement {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    document.head.appendChild(link);
  }
  return link;
}

function renderBadge(count: number): void {
  const { canvas, ctx } = getCanvas();
  const size = 32;

  ctx.clearRect(0, 0, size, size);

  // Draw base favicon image if loaded
  if (_baseLoaded && _baseImage) {
    ctx.drawImage(_baseImage, 0, 0, size, size);
  } else {
    // Fallback: blue rounded square
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, 6);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('T', size / 2, size / 2);
  }

  if (count > 0) {
    // Draw badge circle (top-right)
    const badgeR = 9;
    const bx = size - badgeR - 1;
    const by = badgeR + 1;

    ctx.beginPath();
    ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444'; // red-500
    ctx.fill();

    // Badge text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(count > 99 ? '99+' : String(count), bx, by);
  }

  // Update favicon
  const link = getOrCreateLink();
  link.href = canvas.toDataURL('image/png');
}

/**
 * Update the favicon badge with the given pending task count.
 * Call this whenever tasks change.
 */
export function updateFaviconBadge(count: number): void {
  if (count === _currentCount) return;
  _currentCount = count;

  // Load base favicon on first call
  if (!_baseImage) {
    _baseImage = new Image();
    _baseImage.onload = () => {
      _baseLoaded = true;
      renderBadge(count);
    };
    _baseImage.onerror = () => {
      // Fallback: just render badge without base image
      renderBadge(count);
    };
    _baseImage.src = '/vite.svg';
    return;
  }

  renderBadge(count);
}
