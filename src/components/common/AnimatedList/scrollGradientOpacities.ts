/** Compute top/bottom fade opacities for a scrollable AnimatedList. */
export function scrollGradientOpacities(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
): { top: number; bottom: number } {
  const top = Math.min(scrollTop / 50, 1)
  if (scrollHeight <= clientHeight) {
    return { top: 0, bottom: 0 }
  }
  const bottomDistance = scrollHeight - (scrollTop + clientHeight)
  const bottom = Math.min(bottomDistance / 50, 1)
  return { top, bottom }
}
