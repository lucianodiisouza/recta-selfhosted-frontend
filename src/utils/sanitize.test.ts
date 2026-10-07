import { describe, expect, it } from 'vitest'
import { sanitizeNumber, sanitizeString } from './sanitize'

describe('sanitizeString', () => {
  it('trims and truncates to the maximum length', () => {
    expect(sanitizeString('  abcdef  ', 3)).toBe('abc')
  })

  it('strips control characters but keeps newlines and tabs', () => {
    expect(sanitizeString('a\u0000b\u0007c\nd\te')).toBe('abc\nd\te')
  })

  it('removes script tags, javascript: URLs and inline event handlers', () => {
    expect(sanitizeString('ok<script>alert(1)</script>')).toBe('ok')
    expect(sanitizeString('javascript:alert(1)')).toBe('alert(1)')
    expect(sanitizeString('<img src=x onerror=alert(1)>')).not.toMatch(/onerror\s*=/i)
  })

  it('returns an empty string for non-string input', () => {
    expect(sanitizeString(42 as unknown as string)).toBe('')
  })
})

describe('sanitizeNumber', () => {
  it('parses numeric strings', () => {
    expect(sanitizeNumber('12.5')).toBe(12.5)
  })

  it('maps NaN and infinities to 0', () => {
    expect(sanitizeNumber('abc')).toBe(0)
    expect(sanitizeNumber(Infinity)).toBe(0)
  })

  it('caps the value at the given maximum', () => {
    expect(sanitizeNumber(1000, 100)).toBe(100)
  })
})
