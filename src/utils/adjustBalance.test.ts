import { describe, expect, it } from 'vitest'
import {
  adjustReasonKind, adjustmentDateHonored, buildAdjustBody, formatIsoDate, isValidIsoDate, lastDayOfPreviousYear, maskMoneyInput, reaisToCents,
  todayIsoDate, validateAdjust,
} from './adjustBalance'

const NOW = new Date(2026, 9, 6, 15, 30) // 2026-10-06, local time
// Cents formatted the way a currency field would show them, with a fixed separator style so the assertions are stable.
const format = (cents: number) => `$${(cents / 100).toFixed(2)}`
const REASONS = { opening: 'Opening balance', adjust: 'Balance adjustment' }

describe('maskMoneyInput', () => {
  it('fills from the right in integer cents and drops leading zeros', () => {
    expect(maskMoneyInput('380227', format)).toEqual({ cents: 380227, display: '$3802.27' })
    expect(maskMoneyInput('5', format)).toEqual({ cents: 5, display: '$0.05' })
    expect(maskMoneyInput('000', format)).toEqual({ cents: 0, display: '$0.00' })
  })

  it('reads its own output back to the same value', () => {
    expect(maskMoneyInput('$3802.27', format)).toEqual({ cents: 380227, display: '$3802.27' })
    expect(maskMoneyInput('$0.005', format)).toEqual({ cents: 5, display: '$0.05' })
  })

  it('treats empty or letters-only text as nothing typed, not zero', () => {
    expect(maskMoneyInput('', format)).toEqual({ cents: null, display: '' })
    expect(maskMoneyInput('abc', format)).toEqual({ cents: null, display: '' })
    expect(maskMoneyInput('-', format)).toEqual({ cents: null, display: '-' })
  })

  it('makes a minus sign anywhere negative, but keeps "-0" at zero', () => {
    expect(maskMoneyInput('-1000', format)).toEqual({ cents: -1000, display: '-$10.00' })
    expect(maskMoneyInput('1000-', format)).toEqual({ cents: -1000, display: '-$10.00' })
    expect(maskMoneyInput('-$10.0', format)).toEqual({ cents: -100, display: '-$1.00' })
    expect(maskMoneyInput('-0', format).cents).toBe(0)
  })

  it('cuts anything past 12 digits and always yields integer cents', () => {
    const masked = maskMoneyInput('1234567890123456', format)
    expect(masked.cents).toBe(123456789012)
    expect(Number.isInteger(masked.cents)).toBe(true)
  })
})

describe('reaisToCents', () => {
  it('rounds the float noise of reais * 100', () => {
    expect(reaisToCents(3665.04)).toBe(366504) // 3665.04 * 100 is 366503.99999999994
    expect(reaisToCents(0.29)).toBe(29) // 28.999999999999996
    expect(reaisToCents(1.15)).toBe(115) // 114.99999999999999
    expect(reaisToCents(-10.1)).toBe(-1010)
    expect(reaisToCents(-0.29)).toBe(-29)
  })

  it('turns a non-finite value into zero', () => {
    expect(reaisToCents(Number.NaN)).toBe(0)
  })
})

describe('dates', () => {
  it('accepts real calendar days only', () => {
    expect(isValidIsoDate('2025-12-31')).toBe(true)
    expect(isValidIsoDate('2024-02-29')).toBe(true)
    for (const bad of ['2025-02-30', '2025-13-01', '31/12/2025', '2025-1-1', '', '2025-12-31T00:00:00Z']) {
      expect(isValidIsoDate(bad), bad).toBe(false)
    }
  })

  it('formats with the locale without a timezone shift', () => {
    expect(formatIsoDate('2025-12-31', 'en-US')).toBe('12/31/2025')
    expect(formatIsoDate('2025-12-31', 'pt-BR')).toBe('31/12/2025')
    expect(formatIsoDate('not-a-date', 'pt-BR')).toBe('not-a-date')
  })

  it('suggests the last day of the previous year and reads "today" in local time', () => {
    expect(lastDayOfPreviousYear(NOW)).toBe('2025-12-31')
    expect(lastDayOfPreviousYear(new Date(2027, 0, 1))).toBe('2026-12-31')
    expect(todayIsoDate(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01')
    expect(todayIsoDate(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31')
  })
})

describe('adjustReasonKind', () => {
  it('is "opening" only for a real date before the current year', () => {
    expect(adjustReasonKind('2025-12-31', NOW)).toBe('opening')
    expect(adjustReasonKind('2020-03-01', NOW)).toBe('opening')
    expect(adjustReasonKind('2026-01-01', NOW)).toBe('adjust')
    expect(adjustReasonKind('2026-10-06', NOW)).toBe('adjust')
    expect(adjustReasonKind('', NOW)).toBe('adjust')
    expect(adjustReasonKind('2025-02-30', NOW)).toBe('adjust')
  })
})

describe('validateAdjust', () => {
  const ok = { currentCents: 366504, targetCents: 380227, date: '2025-12-31', reason: 'Opening balance' }

  it('passes a valid input and reports the difference', () => {
    expect(validateAdjust(ok, NOW)).toEqual({ ok: true, differenceCents: 13723, errors: {} })
  })

  it('requires a target and refuses one equal to the current balance', () => {
    const missing = validateAdjust({ ...ok, targetCents: null }, NOW)
    expect(missing.errors.target).toBe('targetRequired')
    expect(missing.differenceCents).toBeNull()
    const same = validateAdjust({ ...ok, targetCents: 366504 }, NOW)
    expect(same.ok).toBe(false)
    expect(same.differenceCents).toBe(0)
    expect(same.errors.target).toBe('sameBalance')
  })

  it('requires a real date that is not in the future, and allows today', () => {
    expect(validateAdjust({ ...ok, date: '' }, NOW).errors.date).toBe('dateRequired')
    expect(validateAdjust({ ...ok, date: '2025-02-30' }, NOW).errors.date).toBe('dateInvalid')
    expect(validateAdjust({ ...ok, date: '2026-10-07' }, NOW).errors.date).toBe('dateFuture')
    expect(validateAdjust({ ...ok, date: '2026-10-06' }, NOW).ok).toBe(true)
  })

  it('limits the trimmed reason to 255 characters', () => {
    expect(validateAdjust({ ...ok, reason: 'x'.repeat(256) }, NOW).errors.reason).toBe('reasonTooLong')
    expect(validateAdjust({ ...ok, reason: 'x'.repeat(255) }, NOW).ok).toBe(true)
    expect(validateAdjust({ ...ok, reason: ' '.repeat(300) }, NOW).ok).toBe(true)
  })

  it('gives a negative difference for a lower or negative target', () => {
    const r = validateAdjust({ currentCents: 1000, targetCents: -500, date: '2026-10-06', reason: '' }, NOW)
    expect(r.differenceCents).toBe(-1500)
    expect(r.ok).toBe(true)
  })
})

describe('buildAdjustBody', () => {
  const base = { currentCents: 366504, targetCents: 380227, date: '2025-12-31', reason: '  My reason ' }

  it('sends cents / 100, the date as typed and the trimmed reason', () => {
    expect(buildAdjustBody(base, REASONS, NOW)).toEqual({ newBalance: 3802.27, date: '2025-12-31', reason: 'My reason' })
    expect(Math.round(buildAdjustBody(base, REASONS, NOW)!.newBalance * 100)).toBe(380227)
    expect(buildAdjustBody({ ...base, targetCents: -5 }, REASONS, NOW)?.newBalance).toBe(-0.05)
  })

  it('replaces a blank reason with the default for the date', () => {
    expect(buildAdjustBody({ ...base, reason: '   ' }, REASONS, NOW)?.reason).toBe('Opening balance')
    expect(buildAdjustBody({ ...base, date: '2026-10-06', reason: '' }, REASONS, NOW)?.reason).toBe('Balance adjustment')
  })

  it('builds no body for anything that does not validate', () => {
    expect(buildAdjustBody({ ...base, targetCents: null }, REASONS, NOW)).toBeNull()
    expect(buildAdjustBody({ ...base, targetCents: 366504 }, REASONS, NOW)).toBeNull()
    expect(buildAdjustBody({ ...base, date: '2026-10-07' }, REASONS, NOW)).toBeNull()
    expect(buildAdjustBody({ ...base, date: '' }, REASONS, NOW)).toBeNull()
  })
})

describe('adjustmentDateHonored', () => {
  const midnight = (y: number, m: number, d: number) => new Date(y, m - 1, d).toISOString()

  it('accepts an entry dated at the requested day, also when the server time zone differs by a few hours', () => {
    expect(adjustmentDateHonored('2025-12-31', midnight(2025, 12, 31))).toBe(true)
    expect(adjustmentDateHonored('2025-12-31', new Date(new Date(2025, 11, 31).getTime() + 6 * 3600_000).toISOString())).toBe(true)
    expect(adjustmentDateHonored('2025-12-31', new Date(new Date(2025, 11, 31).getTime() - 6 * 3600_000).toISOString())).toBe(true)
  })

  it('rejects an entry dated another day (a backend that ignored the date dates it now)', () => {
    expect(adjustmentDateHonored('2025-12-31', new Date().toISOString())).toBe(false)
    expect(adjustmentDateHonored('2025-12-31', midnight(2026, 1, 1))).toBe(false)
  })

  it('cannot judge an answer without a usable date and does not complain about it', () => {
    expect(adjustmentDateHonored('2025-12-31', undefined)).toBe(true)
    expect(adjustmentDateHonored('2025-12-31', 'not a date')).toBe(true)
  })
})
