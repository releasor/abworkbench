/** Placement for Dock item hover labels. Header docks use `below` to avoid clipping. */
export type DockLabelPlacement = 'above' | 'below'

export function dockLabelClassName(placement: DockLabelPlacement, className = ''): string {
  const side = placement === 'below' ? 'dock-label--below' : 'dock-label--above'
  return ['dock-label', side, className].filter(Boolean).join(' ')
}

/** Motion y offset when the label becomes visible (px). */
export function dockLabelAnimateY(placement: DockLabelPlacement): number {
  return placement === 'below' ? 8 : -10
}
