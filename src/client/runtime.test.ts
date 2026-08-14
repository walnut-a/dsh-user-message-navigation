import { describe, expect, it } from 'vitest'
import {
  arrivalFeedbackKeyframes, easeOutQuart, isMarkerActivationKey, markerIndexAtY, previewText,
  scrollTopForMarker, shouldSmoothMarkerDistance,
} from './runtime.ts'

describe('previewText', () => {
  it('normalizes whitespace and keeps short content', () => {
    expect(previewText('  hello\n world  ')).toBe('hello world')
  })

  it('uses the fallback for empty rendered content', () => {
    expect(previewText(' \n ')).toBe('无文本内容')
  })

  it('bounds long previews', () => {
    expect(previewText('x'.repeat(120))).toHaveLength(96)
  })
})

describe('markerIndexAtY', () => {
  it('clamps positions to the available marker range', () => {
    expect(markerIndexAtY(-10, 0, 100, 4)).toBe(0)
    expect(markerIndexAtY(49, 0, 100, 4)).toBe(1)
    expect(markerIndexAtY(1000, 0, 100, 4)).toBe(3)
  })
})

describe('isMarkerActivationKey', () => {
  it('accepts keyboard button activation keys only', () => {
    expect(isMarkerActivationKey('Enter')).toBe(true)
    expect(isMarkerActivationKey(' ')).toBe(true)
    expect(isMarkerActivationKey('ArrowDown')).toBe(false)
  })
})

describe('scrollTopForMarker', () => {
  it('aligns the marker below the scrollport top inset', () => {
    expect(scrollTopForMarker(17_074.5, -16_982.5, 76, 16)).toBe(0)
    expect(scrollTopForMarker(17_074.5, -7_654, 76, 16)).toBe(9_328.5)
  })

  it('never requests negative scroll', () => {
    expect(scrollTopForMarker(20, 40, 76, 16)).toBe(0)
  })
})

describe('shouldSmoothMarkerDistance', () => {
  it('smooths jumps between one and five messages apart', () => {
    expect(shouldSmoothMarkerDistance(2, 2)).toBe(false)
    expect(shouldSmoothMarkerDistance(2, 3)).toBe(true)
    expect(shouldSmoothMarkerDistance(2, 7)).toBe(true)
    expect(shouldSmoothMarkerDistance(7, 2)).toBe(true)
    expect(shouldSmoothMarkerDistance(2, 8)).toBe(false)
  })
})

describe('easeOutQuart', () => {
  it('decelerates toward the destination and clamps progress', () => {
    expect(easeOutQuart(-1)).toBe(0)
    expect(easeOutQuart(0)).toBe(0)
    expect(easeOutQuart(0.5)).toBe(0.9375)
    expect(easeOutQuart(1)).toBe(1)
    expect(easeOutQuart(2)).toBe(1)
  })
})

describe('arrivalFeedbackKeyframes', () => {
  it('holds the theme highlight before gently restoring the bubble', () => {
    expect(arrivalFeedbackKeyframes('base', 'highlight')).toEqual([
      {
        backgroundColor: 'base',
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        offset: 0,
      },
      {
        backgroundColor: 'highlight',
        easing: 'linear',
        offset: 0.25,
      },
      {
        backgroundColor: 'highlight',
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        offset: 0.62,
      },
      { backgroundColor: 'base', offset: 1 },
    ])
  })
})
