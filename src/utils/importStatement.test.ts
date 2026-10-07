import { describe, expect, it } from 'vitest'
import type { ImportPreview, ImportPreviewRow } from '../hooks/api/useImportTransactions'
import {
  SKIP_REASON_KEYS,
  confirmTimeoutMs,
  isImportBusy,
  isTimeoutError,
  getImporterMissing,
  isImporterMissing,
  isStatementFile,
  markImporterMissing,
  previewCounts,
  resetImporterMissing,
  rowsToConfirm,
  subscribeImporterMissing,
} from './importStatement'
import enUS from '../i18n/en-US.json'

const row = (index: number, duplicate: boolean, amount = 10): ImportPreviewRow => ({
  index,
  date: '2026-11-05T00:00:00.000Z',
  description: `Row ${index}`,
  amount,
  type: 'EXPENSE',
  duplicate,
})

describe('isStatementFile', () => {
  it('accepts .csv and .ofx in any letter case', () => {
    expect(isStatementFile('extrato.csv')).toBe(true)
    expect(isStatementFile('EXTRATO.OFX')).toBe(true)
  })

  it('rejects other extensions and names that only contain the extension', () => {
    expect(isStatementFile('extrato.pdf')).toBe(false)
    expect(isStatementFile('extrato.csv.zip')).toBe(false)
    expect(isStatementFile('ofx')).toBe(false)
  })
})

describe('rowsToConfirm', () => {
  it('sends every row of the file, duplicates included, without the preview-only fields', () => {
    const sent = rowsToConfirm([row(0, false), row(1, true), row(2, false, 25.5)])

    expect(sent).toEqual([
      { date: '2026-11-05T00:00:00.000Z', description: 'Row 0', amount: 10, type: 'EXPENSE' },
      { date: '2026-11-05T00:00:00.000Z', description: 'Row 1', amount: 10, type: 'EXPENSE' },
      { date: '2026-11-05T00:00:00.000Z', description: 'Row 2', amount: 25.5, type: 'EXPENSE' },
    ])
    expect(sent.every((r) => !('duplicate' in r) && !('index' in r))).toBe(true)
  })

  it('does not filter: the server counts occurrences over the whole file, so a subset would lose rows', () => {
    const file = [row(0, true), row(1, false), row(2, false)]

    expect(rowsToConfirm(file)).toHaveLength(file.length)
  })
})

describe('previewCounts', () => {
  it('uses the totals the server reported', () => {
    const preview: ImportPreview = { rows: [row(0, false)], total: 1, newCount: 7, duplicateCount: 3 }

    expect(previewCounts(preview)).toEqual({ newCount: 7, duplicateCount: 3 })
  })

  it('recomputes them from the rows when the response omits them', () => {
    const preview = { rows: [row(0, false), row(1, true), row(2, true)], total: 3 } as ImportPreview

    expect(previewCounts(preview)).toEqual({ newCount: 1, duplicateCount: 2 })
  })
})

describe('isImporterMissing', () => {
  it('recognises the framework 404/405 of a server without the import route (no app error code)', () => {
    expect(isImporterMissing(Object.assign(new Error('HTTP 404'), { status: 404 }))).toBe(true)
    expect(isImporterMissing(Object.assign(new Error('HTTP 405'), { status: 405 }))).toBe(true)
  })

  it('does not mistake a missing account (404 with the app NOT_FOUND code) for a missing importer', () => {
    expect(isImporterMissing(Object.assign(new Error('Account not found'), { status: 404, code: 'NOT_FOUND' }))).toBe(false)
  })

  it('does not hide real failures behind the unavailable message', () => {
    expect(isImporterMissing(Object.assign(new Error('bad file'), { status: 400 }))).toBe(false)
    expect(isImporterMissing(new Error('Network error'))).toBe(false)
    expect(isImporterMissing(null)).toBe(false)
  })
})

describe('confirm failures', () => {
  it('recognises a second import on the same account (409)', () => {
    expect(isImportBusy(Object.assign(new Error('busy'), { status: 409 }))).toBe(true)
    expect(isImportBusy(Object.assign(new Error('bad'), { status: 400 }))).toBe(false)
  })

  it('recognises a request that gave up waiting, and nothing that has an HTTP status', () => {
    expect(isTimeoutError(new Error('Network error: Request timeout - server took too long to respond'))).toBe(true)
    expect(isTimeoutError(Object.assign(new Error('timeout in the message'), { status: 500 }))).toBe(false)
    expect(isTimeoutError(new Error('Network error: Unable to connect to server'))).toBe(false)
  })

  it('scales the wait with the rows and caps it', () => {
    expect(confirmTimeoutMs(0)).toBe(30_000)
    expect(confirmTimeoutMs(1500)).toBe(180_000)
    expect(confirmTimeoutMs(100_000)).toBe(300_000)
  })
})

describe('importer availability flag', () => {
  it('flips once, notifies subscribers and can be reset', () => {
    const seen: boolean[] = []
    const unsubscribe = subscribeImporterMissing(() => seen.push(getImporterMissing()))

    expect(getImporterMissing()).toBe(false)
    markImporterMissing()
    markImporterMissing()
    expect(getImporterMissing()).toBe(true)
    expect(seen).toEqual([true])

    unsubscribe()
    resetImporterMissing()
    expect(getImporterMissing()).toBe(false)
  })
})

describe('SKIP_REASON_KEYS', () => {
  it('points every server reason at an existing translation', () => {
    for (const key of Object.values(SKIP_REASON_KEYS)) {
      expect((enUS as Record<string, string>)[key], key).toBeTruthy()
    }
    expect(Object.keys(SKIP_REASON_KEYS).sort()).toEqual([
      'ambiguous-amount',
      'column-count',
      'invalid-amount',
      'invalid-date',
      'repeated-id',
    ])
  })
})
