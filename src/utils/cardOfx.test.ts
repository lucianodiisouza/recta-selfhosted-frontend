import { afterEach, describe, expect, it, vi } from 'vitest'
import enUS from '../i18n/en-US.json'
import {
  CARD_OFX_MAX_FILE_BYTES,
  KIND_KEYS,
  PAYMENT_STATE_KEYS,
  SKIP_REASON_KEYS,
  STATUS_KEYS,
  WARNING_KEYS,
  cardOfxFileProblem,
  getCardOfxMissing,
  isOfxFileName,
  markCardOfxMissing,
  monthKeyLabel,
  monthLabel,
  parseMonthInput,
  resetCardOfxMissing,
  subscribeCardOfxMissing,
} from './cardOfx'

afterEach(() => resetCardOfxMissing())

describe('card invoice file check', () => {
  it('accepts .ofx in any case and nothing else', () => {
    expect(isOfxFileName('Invoice.OFX')).toBe(true)
    expect(isOfxFileName('invoice.ofx')).toBe(true)
    expect(isOfxFileName('invoice.csv')).toBe(false)
    expect(isOfxFileName('invoice.ofx.pdf')).toBe(false)
    expect(isOfxFileName('ofx')).toBe(false)
  })

  it('names the problem: the format first, then a size over 5 MB', () => {
    expect(cardOfxFileProblem({ name: 'a.ofx', size: 1 })).toBeNull()
    expect(cardOfxFileProblem({ name: 'a.ofx', size: CARD_OFX_MAX_FILE_BYTES })).toBeNull()
    expect(cardOfxFileProblem({ name: 'a.ofx', size: CARD_OFX_MAX_FILE_BYTES + 1 })).toBe('size')
    expect(cardOfxFileProblem({ name: 'a.csv', size: 1 })).toBe('format')
    expect(cardOfxFileProblem({ name: 'a.csv', size: CARD_OFX_MAX_FILE_BYTES + 1 })).toBe('format')
  })
})

describe('invoice month', () => {
  it('reads a month input as the server takes it', () => {
    expect(parseMonthInput('2026-12')).toEqual({ year: 2026, month: 12 })
    expect(parseMonthInput('2000-01')).toEqual({ year: 2000, month: 1 })
    expect(parseMonthInput('2100-12')).toEqual({ year: 2100, month: 12 })
  })

  it('drops what the server would refuse', () => {
    for (const value of ['', '2026-13', '2026-00', '1999-12', '2101-01', '2026-1', 'December', '2026-12-01']) {
      expect(parseMonthInput(value), value).toBeUndefined()
    }
  })

  it('writes months as MM/YYYY', () => {
    expect(monthLabel({ year: 2026, month: 3 })).toBe('03/2026')
    expect(monthKeyLabel('2026-11')).toBe('11/2026')
  })
})

describe('code to message tables', () => {
  const tables: Array<[string, Record<string, string | null>, string[]]> = [
    ['warnings', WARNING_KEYS, ['possible-duplicates', 'multiple-statements', 'period-end-missing', 'card-without-due-day', 'card-without-closing-day', 'balance-mismatch']],
    ['skip reasons', SKIP_REASON_KEYS, ['invalid-amount', 'zero-amount', 'amount-too-large', 'invalid-date', 'missing-id', 'id-too-long']],
    ['statuses', STATUS_KEYS, ['new', 'reconciled', 'payment']],
    ['kinds', KIND_KEYS, ['purchase', 'refund', 'discount', 'payment']],
    ['payment states', PAYMENT_STATE_KEYS, ['matches', 'differs', 'missing', 'undetermined']],
  ]

  it.each(tables)('%s: every code the backend sends has a message that exists', (_name, table, codes) => {
    expect(Object.keys(table).sort()).toEqual([...codes].sort())
    for (const key of Object.values(table)) {
      if (key !== null) expect(typeof (enUS as Record<string, string>)[key], key).toBe('string')
    }
  })
})

describe('missing importer flag', () => {
  it('starts clear, is set once and tells its listeners once', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeCardOfxMissing(listener)
    expect(getCardOfxMissing()).toBe(false)

    markCardOfxMissing()
    markCardOfxMissing()

    expect(getCardOfxMissing()).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('stops telling a listener that unsubscribed', () => {
    const listener = vi.fn()
    subscribeCardOfxMissing(listener)()

    markCardOfxMissing()

    expect(listener).not.toHaveBeenCalled()
  })
})
