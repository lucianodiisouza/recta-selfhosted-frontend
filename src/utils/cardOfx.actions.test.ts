import { describe, expect, it } from 'vitest'
import enUS from '../i18n/en-US.json'
import type { CardOfxLine } from '../hooks/api/useCardOfxPreview'
import {
  SKIP_CAUSE_KEYS,
  actionCounts,
  buildConfirmRequest,
  categoryKey,
  defaultActions,
  isActionable,
  merchantsToImport,
  suggestedCategories,
} from './cardOfx'

const line = (over: Partial<CardOfxLine> & Pick<CardOfxLine, 'ref' | 'merchant'>): CardOfxLine => ({
  fitid: over.ref,
  date: '2026-11-10',
  amount: 10,
  type: 'EXPENSE',
  kind: 'purchase',
  memo: over.merchant,
  installment: null,
  status: 'new',
  possibleDuplicate: null,
  ...over,
})

const DUP = { transactionId: 'tx-1', description: 'typed', date: '2026-11-09' }
const lines: CardOfxLine[] = [
  line({ ref: 'a', merchant: 'Market' }),
  line({ ref: 'b', merchant: 'Market', memo: 'Market - Parcela 2/3', installment: { number: 2, total: 3 } }),
  line({ ref: 'c', merchant: 'Bakery', possibleDuplicate: DUP }),
  line({ ref: 'd', merchant: 'Shoes', status: 'reconciled' }),
  line({ ref: 'e', merchant: 'Refund', type: 'INCOME', kind: 'refund' }),
  line({ ref: 'f', merchant: 'Pagamento recebido', type: 'INCOME', kind: 'payment', status: 'payment' }),
]
const preview = {
  accountId: 'card-1',
  lines,
  categorySuggestions: [{ merchant: 'Market', type: 'EXPENSE' as const, categoryName: 'GROCERIES' }],
}

describe('what to do with each line', () => {
  it('only new lines that are not payments can be decided', () => {
    expect(lines.filter(isActionable).map((l) => l.ref)).toEqual(['a', 'b', 'c', 'e'])
  })

  it('imports new lines and skips the look-alikes of hand-typed transactions until told otherwise', () => {
    expect(defaultActions(preview)).toEqual({ a: 'import', b: 'import', c: 'skip', e: 'import' })
    expect(actionCounts(defaultActions(preview))).toEqual({ import: 3, link: 0, skip: 1 })
  })

  it('reads the suggested categories by direction and merchant', () => {
    expect(suggestedCategories(preview)).toEqual({ [categoryKey('EXPENSE', 'Market')]: 'GROCERIES' })
    expect(categoryKey('EXPENSE', 'Refund')).not.toBe(categoryKey('INCOME', 'Refund'))
  })

  it('lists each merchant to import once, only for lines that are going to be created', () => {
    expect(merchantsToImport(preview, defaultActions(preview))).toEqual([
      { merchant: 'Market', type: 'EXPENSE' },
      { merchant: 'Refund', type: 'INCOME' },
    ])
    expect(merchantsToImport(preview, { a: 'skip', b: 'skip', c: 'import', e: 'link' })).toEqual([{ merchant: 'Bakery', type: 'EXPENSE' }])
  })
})

describe('buildConfirmRequest', () => {
  it('echoes every line without what the server recomputes, in order', () => {
    const request = buildConfirmRequest(preview, defaultActions(preview), {})

    expect(request.accountId).toBe('card-1')
    expect(request.lines.map((l) => l.ref)).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
    for (const echoed of request.lines) {
      expect(echoed).not.toHaveProperty('status')
      expect(echoed).not.toHaveProperty('possibleDuplicate')
    }
    expect(request.lines[0]).toMatchObject({ ref: 'a', fitid: 'a', amount: 10, kind: 'purchase', merchant: 'Market', installment: null })
    // The installment goes back as the preview gave it: the server rechecks it against the memo.
    expect(request.lines[1]).toMatchObject({ ref: 'b', memo: 'Market - Parcela 2/3', installment: { number: 2, total: 3 } })
  })

  it('selects the lines to import, marks the look-alikes among them, and turns links into transaction ids', () => {
    const request = buildConfirmRequest(preview, { a: 'import', b: 'skip', c: 'import', e: 'import' }, {})
    expect(request).toMatchObject({ selectedRefs: ['a', 'c', 'e'], createDespiteDuplicate: ['c'], links: [] })

    const linked = buildConfirmRequest(preview, { a: 'import', b: 'skip', c: 'link', e: 'skip' }, {})
    expect(linked).toMatchObject({ selectedRefs: ['a'], createDespiteDuplicate: [], links: [{ ref: 'c', transactionId: 'tx-1' }] })
  })

  it('never links a line that has no look-alike, nor selects lines the user did not decide about', () => {
    const request = buildConfirmRequest(preview, { a: 'link', d: 'import', f: 'import' } as never, {})

    expect(request.links).toEqual([])
    // d (reconciled) and f (payment) were forced into the actions by the caller: they are still only what the caller said.
    expect(request.selectedRefs).toEqual(['d', 'f'])
  })

  it('sends a category only for merchants that are going to be created and have one', () => {
    const categories = { [categoryKey('EXPENSE', 'Market')]: 'GROCERIES', [categoryKey('EXPENSE', 'Shoes')]: 'CLOTHING', [categoryKey('INCOME', 'Refund')]: '' }
    const request = buildConfirmRequest(preview, defaultActions(preview), categories)

    expect(request.categoryMap).toEqual([{ merchant: 'Market', type: 'EXPENSE', categoryName: 'GROCERIES' }])
  })
})

describe('skip causes', () => {
  it('has a message for every cause the server can answer with', () => {
    for (const key of Object.values(SKIP_CAUSE_KEYS)) expect(typeof (enUS as Record<string, string>)[key], key).toBe('string')
    expect(Object.keys(SKIP_CAUSE_KEYS).sort()).toEqual(['already-imported', 'link-refused', 'possible-duplicate'])
  })
})
