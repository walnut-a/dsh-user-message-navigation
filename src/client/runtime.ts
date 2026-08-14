/** One durable user-message row discovered in the mounted Chat projection. */
export interface UserMessageMarker {
  readonly key: string
  readonly label: string
  readonly element: HTMLElement
  readonly ordinal: number
}

/** Collapse rendered message copy into a short preview. */
export function previewText(value: string, fallback = '无文本内容'): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized === '') return fallback
  return normalized.length <= 96 ? normalized : `${normalized.slice(0, 95)}…`
}

/** Map a pointer position onto the nearest marker in a vertical rail. */
export function markerIndexAtY(position: number, top: number, height: number, count: number): number {
  if (count <= 1 || height <= 0) return 0
  const ratio = Math.max(0, Math.min(1, (position - top) / height))
  return Math.min(count - 1, Math.floor(ratio * count))
}

/** Identify keys that activate a focused navigation marker. */
export function isMarkerActivationKey(key: string): boolean {
  return key === 'Enter' || key === ' '
}
