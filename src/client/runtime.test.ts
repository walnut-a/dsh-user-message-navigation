import { describe, expect, it } from 'vitest'
import { isMarkerActivationKey, markerIndexAtY, previewText } from './runtime.ts'

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
