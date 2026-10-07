import { describe, expect, it } from 'vitest'
import { autoFillClosingDay, closingDayFromDue, effectiveClosingDay, firstInstallmentAnchor } from './closingDay'

describe('closingDayFromDue', () => {
  it('is the due day minus 7, wrapping into the previous month with +30', () => {
    const expected: Array<[number, number]> = [[9, 2], [8, 1], [7, 30], [3, 26], [1, 24], [31, 24], [15, 8], [2, 25]]
    for (const [due, closing] of expected) expect(closingDayFromDue(due), `due ${due}`).toBe(closing)
  })

  it('has no suggestion without a valid due day', () => {
    for (const bad of [null, undefined, 0, 32, -1, 1.5, Number.NaN]) expect(closingDayFromDue(bad), String(bad)).toBeNull()
  })
})

describe('effectiveClosingDay', () => {
  it('prefers the explicit day, derives otherwise and is null with neither', () => {
    expect(effectiveClosingDay({ closingDay: 20, dueDay: 9 })).toBe(20)
    expect(effectiveClosingDay({ closingDay: null, dueDay: 9 })).toBe(2)
    expect(effectiveClosingDay({ dueDay: 3 })).toBe(26)
    expect(effectiveClosingDay({ closingDay: 0, dueDay: 31 })).toBe(24)
    expect(effectiveClosingDay({ closingDay: null, dueDay: null })).toBeNull()
    expect(effectiveClosingDay({})).toBeNull()
    expect(effectiveClosingDay(undefined)).toBeNull()
  })
})

describe('firstInstallmentAnchor', () => {
  const purchase = (day: number) => new Date(2026, 9, day)

  it('moves the first installment to the next month on or after the derived closing day (due 9 closes on 2)', () => {
    expect(firstInstallmentAnchor(purchase(1), { dueDay: 9 })).toEqual(purchase(1))
    expect(firstInstallmentAnchor(purchase(2), { dueDay: 9 })).toEqual(new Date(2026, 10, 2))
  })

  it('uses the explicit closing day over the derived one', () => {
    expect(firstInstallmentAnchor(purchase(10), { dueDay: 9, closingDay: 20 })).toEqual(purchase(10))
    expect(firstInstallmentAnchor(purchase(20), { dueDay: 9, closingDay: 20 })).toEqual(new Date(2026, 10, 20))
  })

  it('keeps the purchase date for a card with neither day, or without a card', () => {
    expect(firstInstallmentAnchor(purchase(28), {})).toEqual(purchase(28))
    expect(firstInstallmentAnchor(purchase(28), undefined)).toEqual(purchase(28))
  })
})

// Each step is a change of the due day, optionally preceded by the user typing a closing day.
type Step = { due?: number; typedClosing?: number | 'clear' }

function run(steps: Step[], initial: { closing?: number; lastSuggested?: number | null } = {}) {
  let closing: number | undefined = initial.closing
  let last: number | null = initial.lastSuggested ?? null
  let due: number | undefined
  const trace: Array<number | undefined> = []
  for (const step of steps) {
    if (step.typedClosing !== undefined) closing = step.typedClosing === 'clear' ? undefined : step.typedClosing
    if ('due' in step) due = step.due
    const result = autoFillClosingDay({ dueDay: due, closingDay: closing, lastSuggested: last })
    closing = result.closingDay
    last = result.suggested
    trace.push(closing)
  }
  return trace
}

describe('autoFillClosingDay', () => {
  it('fills the empty closing day and keeps following the due day while it holds the suggestion', () => {
    expect(run([{ due: 9 }])).toEqual([2])
    expect(run([{ due: 1 }, { due: 19 }, { due: 3 }])).toEqual([24, 12, 26])
  })

  it('keeps a closing day the user typed when the due day changes', () => {
    expect(run([{ due: 9 }, { typedClosing: 20 }, { due: 10 }, { due: 11 }])).toEqual([2, 20, 20, 20])
    expect(run([{ typedClosing: 15 }, { due: 9 }])).toEqual([15, 15])
  })

  it('treats typing the suggested value itself as untouched', () => {
    expect(run([{ due: 9 }, { typedClosing: 2 }, { due: 12 }])).toEqual([2, 2, 5])
  })

  it('clears an automatic closing day with the due day, not a typed one, and fills a cleared one again', () => {
    expect(run([{ due: 9 }, { due: undefined }])).toEqual([2, undefined])
    expect(run([{ due: 9 }, { typedClosing: 20 }, { due: undefined }])).toEqual([2, 20, 20])
    expect(run([{ due: 9 }, { typedClosing: 'clear', due: 10 }])).toEqual([2, 3])
  })

  it('on a saved card follows only a closing day equal to the old suggestion', () => {
    expect(run([{ due: 10 }], { closing: 2, lastSuggested: 2 })).toEqual([3])
    expect(run([{ due: 10 }], { closing: 20, lastSuggested: 2 })).toEqual([20])
    // The hook starts with no memory: the first run only remembers the suggestion and never overwrites a value.
    expect(run([{ due: 9 }], { closing: 20, lastSuggested: null })).toEqual([20])
  })

  it('exposes the suggestion for the placeholder', () => {
    expect(autoFillClosingDay({ dueDay: 9, closingDay: 20, lastSuggested: null }).suggested).toBe(2)
    expect(autoFillClosingDay({ dueDay: undefined, closingDay: undefined, lastSuggested: 2 }).suggested).toBeNull()
  })
})
