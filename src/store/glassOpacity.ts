/** Window / launcher glass opacity range (higher = less see-through). */
export const GLASS_OPACITY_MIN = 40
export const GLASS_OPACITY_MAX = 100
export const GLASS_OPACITY_DEFAULT = 90

export function clampGlassOpacity(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return GLASS_OPACITY_DEFAULT
  return Math.min(GLASS_OPACITY_MAX, Math.max(GLASS_OPACITY_MIN, Math.round(value)))
}
