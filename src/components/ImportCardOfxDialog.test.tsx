// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getCardOfxMissing, resetCardOfxMissing } from '../utils/cardOfx'
import enUS from '../i18n/en-US.json'
import type { CardOfxLine, CardOfxPayment, CardOfxPreview } from '../hooks/api/useCardOfxPreview'
import ImportCardOfxDialog from './ImportCardOfxDialog'

const previewMutateAsync = vi.fn()
const toastError = vi.fn()

// The dialog runs against its real helpers and the real en-US strings; only the data layer, contexts and formatters are replaced.
vi.mock('../hooks/api/useCardOfxPreview', () => ({
  useCardOfxPreview: () => ({ mutateAsync: previewMutateAsync, isPending: false }),
}))
vi.mock('../context/ToastContext', () => ({ useToastContext: () => ({ error: toastError }) }))
vi.mock('../context/CurrencyContext', () => ({ useCurrency: () => ({ baseCurrency: 'BRL' }) }))
// The real formatters pull in the currency table, which pulls in Firebase; the dialog only needs a stable rendering.
vi.mock('../utils/format', () => ({
  formatCurrency: (value: number, currency: string) => `${currency} ${value.toFixed(2)}`,
  formatDate: (date: Date) => date.toISOString().slice(0, 10),
  parseDateFromAPI: (date: string) => new Date(`${date.slice(0, 10)}T00:00:00.000Z`),
}))
vi.mock('../context/I18nContext', () => ({ useI18n: () => ({ t: enUS }) }))

const CARD = { id: 'card-1', name: 'Everyday card' }

const line = (over: Partial<CardOfxLine> & Pick<CardOfxLine, 'ref' | 'memo' | 'amount'>): CardOfxLine => ({
  fitid: over.ref,
  date: '2026-11-10',
  type: 'EXPENSE',
  kind: 'purchase',
  merchant: over.memo,
  installment: null,
  status: 'new',
  ...over,
})

const PREVIEW: CardOfxPreview = {
  accountId: CARD.id,
  month: { year: 2026, month: 12 },
  monthKey: '2026-12',
  monthSource: 'statement',
  period: { start: '2026-11-02', end: '2026-12-02' },
  ofxTotal: 90,
  ledgerBalance: 90,
  lines: [
    line({ ref: 'r1', memo: 'Corner market', amount: 60 }),
    line({ ref: 'r2', memo: 'Shoe store - Parcela 2/3', amount: 40 }),
    line({ ref: 'r3', memo: 'Estorno de Corner market', amount: 10, type: 'INCOME', kind: 'refund' }),
    line({ ref: 'r4', memo: 'Pagamento recebido', amount: 85, type: 'INCOME', kind: 'payment', status: 'payment' }),
  ],
  skipped: [],
  payment: { invoiceMonthKey: '2026-11', statementTotal: 85, recorded: [], recordedTotal: 0, state: 'missing' },
  totals: { lines: 4, new: 3, payments: 1, skipped: 0 },
  warnings: [],
}

const ofxFile = (name = 'invoice.ofx') => new File(['x'], name, { type: 'application/octet-stream' })

function setup(onClose = vi.fn()) {
  // applyAccept off: the browser's `accept` filter does not stop a dragged-in file, and the dialog must check it too.
  const user = userEvent.setup({ applyAccept: false })
  render(<ImportCardOfxDialog open onClose={onClose} account={CARD} />)
  return { user, onClose }
}

const fileInput = () => screen.getByLabelText(enUS.cardOfxFile)
const previewButton = () => screen.getByRole('button', { name: enUS.cardOfxPreview }) as HTMLButtonElement

async function preview(user: ReturnType<typeof userEvent.setup>, file = ofxFile()) {
  await user.upload(fileInput(), file)
  await user.click(previewButton())
}

const rowOf = (memo: string) => screen.getByText(memo).closest('tr') as HTMLElement

beforeEach(() => {
  previewMutateAsync.mockResolvedValue(PREVIEW)
})

afterEach(() => {
  resetCardOfxMissing()
  cleanup()
  vi.clearAllMocks()
})

describe('ImportCardOfxDialog', () => {
  it('renders nothing while closed', () => {
    render(<ImportCardOfxDialog open={false} onClose={vi.fn()} account={CARD} />)

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('names the card and keeps Preview disabled until a file is chosen', async () => {
    const { user } = setup()

    expect(screen.getByRole('dialog', { name: enUS.cardOfxTitle.replace('{card}', CARD.name) })).toBeTruthy()
    expect(previewButton().disabled).toBe(true)

    await user.upload(fileInput(), ofxFile())
    expect(previewButton().disabled).toBe(false)
  })

  it('refuses a file that is not .ofx and never calls the server', async () => {
    const { user } = setup()
    await user.upload(fileInput(), ofxFile('invoice.csv'))

    expect(screen.getByRole('alert').textContent).toBe(enUS.cardOfxInvalidFormat)
    expect(previewButton().disabled).toBe(true)
    expect(previewMutateAsync).not.toHaveBeenCalled()
  })

  it('refuses a file over 5 MB before uploading it', async () => {
    const { user } = setup()
    const big = ofxFile()
    Object.defineProperty(big, 'size', { value: 5 * 1024 * 1024 + 1 })
    await user.upload(fileInput(), big)

    expect(screen.getByRole('alert').textContent).toBe(enUS.cardOfxTooLarge.replace('{max}', '5'))
    expect(previewMutateAsync).not.toHaveBeenCalled()
  })

  it('uploads the file for the card, with no month when none was typed', async () => {
    const { user } = setup()
    const file = ofxFile('november.ofx')
    await preview(user, file)

    expect(previewMutateAsync).toHaveBeenCalledWith({ accountId: 'card-1', file, monthOverride: undefined })
  })

  it('sends the month the user typed', async () => {
    const { user } = setup()
    fireEvent.change(screen.getByLabelText(enUS.cardOfxMonth), { target: { value: '2027-02' } })
    await preview(user)

    expect(previewMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ monthOverride: { year: 2027, month: 2 } }))
  })

  it('shows the invoice month taken from the file, the period, the totals and the counts', async () => {
    const { user } = setup()
    await preview(user)

    expect(screen.getByText(enUS.cardOfxMonthFromFile.replace('{month}', '12/2026'))).toBeTruthy()
    expect(screen.getByText(enUS.cardOfxPeriod.replace('{start}', '2026-11-02').replace('{end}', '2026-12-02'))).toBeTruthy()
    expect(
      screen.getByText(
        `${enUS.cardOfxTotal.replace('{amount}', 'BRL 90.00')} · ${enUS.cardOfxLedger.replace('{amount}', 'BRL 90.00')}`,
      ),
    ).toBeTruthy()
    expect(screen.getByText('New: 3')).toBeTruthy()
    expect(screen.getByText('Payments: 1')).toBeTruthy()
  })

  it('says when the month was chosen by the user, and leaves the balance out when the file has none', async () => {
    previewMutateAsync.mockResolvedValue({ ...PREVIEW, monthSource: 'override', ledgerBalance: null })
    const { user } = setup()
    await preview(user)

    expect(screen.getByText(enUS.cardOfxMonthChosen.replace('{month}', '12/2026'))).toBeTruthy()
    expect(screen.getByText(enUS.cardOfxTotal.replace('{amount}', 'BRL 90.00'))).toBeTruthy()
  })

  it('lists every line with its amount, direction, kind and status', async () => {
    const { user } = setup()
    await preview(user)

    const market = within(rowOf('Corner market'))
    expect(market.getByText('BRL 60.00')).toBeTruthy()
    expect(market.getByText(enUS.cardOfxStatusNew)).toBeTruthy()
    expect(within(rowOf('Shoe store - Parcela 2/3')).getByText(enUS.cardOfxStatusNew)).toBeTruthy()
    const refund = within(rowOf('Estorno de Corner market'))
    expect(refund.getByText(new RegExp(`${enUS.income} · ${enUS.cardOfxKindRefund}`))).toBeTruthy()
    const payment = within(rowOf('Pagamento recebido'))
    expect(payment.getByText(enUS.cardOfxStatusPayment)).toBeTruthy()
  })

  it.each<[CardOfxPayment['state'], string]>([
    ['matches', 'The payment of BRL 85.00 in the file is already recorded.'],
    ['differs', 'The file shows a payment of BRL 85.00, but BRL 80.00 is recorded for this invoice.'],
    ['missing', 'The file shows a payment of BRL 85.00 that is not recorded for this invoice.'],
    [
      'undetermined',
      'The file has several payments (BRL 85.00 in total) and BRL 80.00 is recorded for this invoice. They are not compared here.',
    ],
  ])('words the payment state %s with both amounts', async (state, text) => {
    previewMutateAsync.mockResolvedValue({
      ...PREVIEW,
      payment: { invoiceMonthKey: '2026-11', statementTotal: 85, recorded: [], recordedTotal: 80, state },
    })
    const { user } = setup()
    await preview(user)

    expect(screen.getByText(enUS.cardOfxPaymentTitle.replace('{month}', '11/2026'))).toBeTruthy()
    expect(screen.getByText(text)).toBeTruthy()
  })

  it('has no payment box when the file has no payment line', async () => {
    previewMutateAsync.mockResolvedValue({ ...PREVIEW, payment: null })
    const { user } = setup()
    await preview(user)

    expect(screen.queryByText(enUS.cardOfxPaymentTitle.replace('{month}', '11/2026'))).toBeNull()
  })

  it('words each warning code', async () => {
    previewMutateAsync.mockResolvedValue({ ...PREVIEW, warnings: ['balance-mismatch', 'card-without-due-day'] })
    const { user } = setup()
    await preview(user)

    const alert = within(screen.getByRole('alert'))
    expect(alert.getByText(enUS.cardOfxWarningBalanceMismatch)).toBeTruthy()
    expect(alert.getByText(enUS.cardOfxWarningCardWithoutDueDay)).toBeTruthy()
  })

  it('lists the lines that could not be read, by position and reason', async () => {
    previewMutateAsync.mockResolvedValue({
      ...PREVIEW,
      skipped: [
        { position: 3, reason: 'invalid-amount' },
        { position: 9, reason: 'id-too-long' },
      ],
      totals: { ...PREVIEW.totals, skipped: 2 },
    })
    const { user } = setup()
    await preview(user)

    expect(screen.getByText('2 lines could not be read')).toBeTruthy()
    expect(screen.getByText('Line 3: invalid amount')).toBeTruthy()
    expect(screen.getByText('Line 9: transaction ID too long')).toBeTruthy()
  })

  it('counts the unreadable lines from the totals, as the server lists only the first 100', async () => {
    previewMutateAsync.mockResolvedValue({
      ...PREVIEW,
      skipped: [{ position: 3, reason: 'invalid-amount' }],
      totals: { ...PREVIEW.totals, skipped: 580_000 },
    })
    const { user } = setup()
    await preview(user)

    expect(screen.getByText('580000 lines could not be read')).toBeTruthy()
  })

  it('warns about a month it cannot send, instead of dropping it silently, and sends nothing', async () => {
    const { user } = setup()
    fireEvent.change(screen.getByLabelText(enUS.cardOfxMonth), { target: { value: '1999-05' } })
    await user.upload(fileInput(), ofxFile())
    await user.click(previewButton())

    expect(screen.getByRole('alert').textContent).toBe(enUS.cardOfxMonthInvalid)
    expect(previewMutateAsync).not.toHaveBeenCalled()
  })

  it('draws the first 200 lines and says how many exist', async () => {
    const lines = Array.from({ length: 205 }, (_, i) => line({ ref: `r${i}`, memo: `Shop ${i}`, amount: 1 }))
    previewMutateAsync.mockResolvedValue({ ...PREVIEW, lines })
    const { user } = setup()
    await preview(user)

    expect(screen.getByText('Shop 199')).toBeTruthy()
    expect(screen.queryByText('Shop 200')).toBeNull()
    expect(screen.getByText('Showing the first 200 of 205 lines.')).toBeTruthy()
  })

  it('is a preview only: it says so and offers nothing that saves', async () => {
    const { user } = setup()
    await preview(user)

    expect(screen.getByText(enUS.cardOfxPreviewOnly)).toBeTruthy()
    const buttons = screen.getAllByRole('button').map((button) => button.textContent)
    expect(buttons.filter((text) => /import|confirm/i.test(text ?? ''))).toEqual([])
  })

  it('goes back to the file step keeping nothing of the previous preview', async () => {
    const { user } = setup()
    await preview(user)
    await user.click(screen.getByRole('button', { name: enUS.back }))

    expect(screen.queryByText(enUS.cardOfxPreviewOnly)).toBeNull()
    expect(previewButton().disabled).toBe(false)
  })

  it('closes on Escape and on Close', async () => {
    const { user, onClose } = setup()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: enUS.close }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('hides the entry point for the session when the server has no importer (404 without a code)', async () => {
    previewMutateAsync.mockRejectedValue({ status: 404, message: 'Route POST:/transactions/import/card-ofx/preview not found' })
    const { user } = setup()
    await preview(user)

    expect(toastError).toHaveBeenCalledWith(enUS.cardOfxUnavailable)
    expect(getCardOfxMissing()).toBe(true)
  })

  it('does not mistake a missing account (404 with a code) for a missing importer', async () => {
    previewMutateAsync.mockRejectedValue(Object.assign(new Error('Account not found'), { status: 404, code: 'NOT_FOUND' }))
    const { user } = setup()
    await preview(user)

    expect(toastError).toHaveBeenCalledWith('Account not found')
    expect(getCardOfxMissing()).toBe(false)
  })

  it('shows the server message when it gives one, a timeout notice when the request gave up, and a generic one otherwise', async () => {
    const { user } = setup()
    previewMutateAsync.mockRejectedValueOnce(Object.assign(new Error('Not a credit card invoice'), { status: 400 }))
    await preview(user)
    expect(toastError).toHaveBeenLastCalledWith('Not a credit card invoice')

    previewMutateAsync.mockRejectedValueOnce(new Error('timeout of 30000ms exceeded'))
    await user.click(previewButton())
    expect(toastError).toHaveBeenLastCalledWith(enUS.cardOfxTimeout)

    previewMutateAsync.mockRejectedValueOnce({ status: 500 })
    await user.click(previewButton())
    expect(toastError).toHaveBeenLastCalledWith(enUS.cardOfxPreviewFailed)
  })
})
