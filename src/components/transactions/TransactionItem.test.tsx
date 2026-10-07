// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import enUS from '../../i18n/en-US.json'
import { TransactionType } from '../../lib/enums'
import type { Transaction } from '../../types'
import { TransactionItem } from './TransactionItem'

vi.mock('../../context/I18nContext', () => ({ useI18n: () => ({ t: enUS }) }))
vi.mock('../../utils/format', () => ({ formatCurrency: (value: number) => `BRL ${value.toFixed(2)}` }))

const base: Transaction = { id: 'tx-1', description: 'Weekend groceries', amount: 100, type: TransactionType.EXPENSE, date: new Date(2026, 9, 3), paid: true, accountId: 'acc-1' }

function mount(transaction: Transaction, onSplitShares = vi.fn()) {
  render(
    <ul>
      <TransactionItem
        transaction={transaction}
        accounts={[{ id: 'acc-1', name: 'Main account' }]}
        baseCurrency="BRL"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onMarkAsPaid={vi.fn()}
        onView={vi.fn()}
        onSplitShares={onSplitShares}
        formatTransactionDescription={(t) => t.description}
        getCategoryIcon={() => () => null}
        t={enUS as unknown as Record<string, string>}
      />
    </ul>,
  )
  return { onSplitShares, user: userEvent.setup() }
}

const openMenu = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getAllByRole('button')[0]!)
}

afterEach(() => cleanup())

describe('the split action of a transaction row', () => {
  it('shows on an expense and hands the transaction to the page', async () => {
    const { user, onSplitShares } = mount(base)
    await openMenu(user)
    await user.click(await screen.findByRole('button', { name: enUS.peopleDivideAction }))
    expect(onSplitShares).toHaveBeenCalledWith(base)
  })

  it.each([
    ['an income', { ...base, type: TransactionType.INCOME }],
    ['a transfer', { ...base, type: TransactionType.TRANSFER }],
    ['an invoice payment', { ...base, attachmentUrl: 'invoice_pay:card-1:2026-10' }],
  ])('does not show on %s', async (_name, transaction) => {
    const { user } = mount(transaction)
    await openMenu(user)
    await screen.findByRole('button', { name: enUS.edit })
    expect(screen.queryByRole('button', { name: enUS.peopleDivideAction })).toBeNull()
  })
})
