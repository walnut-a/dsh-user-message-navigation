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

/** Resolve a marker's document position into the owning scrollport coordinates. */
export function scrollTopForMarker(
  currentScrollTop: number,
  markerTop: number,
  scrollportTop: number,
  topInset: number,
): number {
  return Math.max(0, currentScrollTop + markerTop - scrollportTop - topInset)
}

/** Limit animated navigation to nearby messages. */
export function shouldSmoothMarkerDistance(
  currentIndex: number,
  targetIndex: number,
  maximumDistance = 5,
): boolean {
  const distance = Math.abs(targetIndex - currentIndex)
  return distance > 0 && distance <= maximumDistance
}

/** Resolve animation progress with a fast, confident arrival. */
export function easeOutQuart(progress: number): number {
  const clamped = Math.max(0, Math.min(1, progress))
  return 1 - (1 - clamped) ** 4
}

/** Build the theme highlight used to acknowledge an arrived-at message. */
export function arrivalFeedbackKeyframes(baseColor: string, highlightColor: string): Keyframe[] {
  return [
    {
      backgroundColor: baseColor,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      offset: 0,
    },
    { backgroundColor: highlightColor, easing: 'linear', offset: 0.25 },
    {
      backgroundColor: highlightColor,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      offset: 0.62,
    },
    { backgroundColor: baseColor, offset: 1 },
  ]
}

/** Identify keys that activate a focused navigation marker. */
export function isMarkerActivationKey(key: string): boolean {
  return key === 'Enter' || key === ' '
}
