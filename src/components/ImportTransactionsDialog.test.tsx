// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getImporterMissing, resetImporterMissing } from '../utils/importStatement'
import enUS from '../i18n/en-US.json'
import type { ImportPreview } from '../hooks/api/useImportTransactions'
import ImportTransactionsDialog from './ImportTransactionsDialog'

const pending = vi.hoisted(() => ({ confirming: false }))
const previewMutateAsync = vi.fn()
const confirmMutateAsync = vi.fn()
const toastSuccess = vi.fn()
const toastError = vi.fn()

// The dialog runs against its real helpers and the real en-US strings; only the data layer, contexts and formatters are replaced.
vi.mock('../hooks/api/useImportTransactions', () => ({
  useImportPreview: () => ({ mutateAsync: previewMutateAsync, isPending: false }),
  useConfirmImport: () => ({ mutateAsync: confirmMutateAsync, isPending: pending.confirming }),
}))
vi.mock('../hooks/api/useAccounts', () => ({
  useAccounts: () => ({
    data: { accounts: [{ id: 'acc-1', name: 'Everyday account' }, { id: 'acc-2', name: 'Savings' }] },
    isLoading: false,
  }),
}))
vi.mock('../hooks/useDefaultHousehold', () => ({ useDefaultHousehold: () => ({ householdId: 'hh-1' }) }))
vi.mock('../context/ToastContext', () => ({ useToastContext: () => ({ success: toastSuccess, error: toastError }) }))
vi.mock('../context/CurrencyContext', () => ({ useCurrency: () => ({ baseCurrency: 'BRL' }) }))
// The real formatters pull in the currency table, which pulls in Firebase; the dialog only needs a stable rendering.
vi.mock('../utils/format', () => ({
  formatCurrency: (value: number, currency: string) => `${currency} ${value.toFixed(2)}`,
  formatDate: (date: Date) => date.toISOString().slice(0, 10),
  parseDateFromAPI: (date: string) => new Date(`${date.slice(0, 10)}T00:00:00.000Z`),
}))
vi.mock('../context/I18nContext', () => ({ useI18n: () => ({ t: enUS }) }))

const PREVIEW: ImportPreview = {
  total: 3,
  newCount: 2,
  duplicateCount: 1,
  rows: [
    { index: 0, date: '2026-11-05T12:00:00.000Z', description: 'Corner bakery', amount: 10, type: 'EXPENSE', duplicate: false },
    { index: 1, date: '2026-11-06T12:00:00.000Z', description: 'Monthly salary', amount: 2500, type: 'INCOME', duplicate: false },
    { index: 2, date: '2026-11-07T12:00:00.000Z', description: 'Book store', amount: 40, type: 'EXPENSE', duplicate: true },
  ],
}

const statement = (name = 'statement.ofx') => new File(['x'], name, { type: 'application/octet-stream' })

function setup(props: Partial<ComponentProps<typeof ImportTransactionsDialog>> = {}) {
  const onClose = vi.fn()
  // applyAccept off: the browser's `accept` filter does not stop a dragged-in file, and the dialog must check it too.
  const user = userEvent.setup({ applyAccept: false })
  render(<ImportTransactionsDialog open onClose={onClose} {...props} />)
  return { user, onClose }
}

async function fillAndPreview(user: ReturnType<typeof userEvent.setup>, file = statement()) {
  await user.selectOptions(screen.getByLabelText(enUS.importStatementAccount), 'acc-1')
  await user.upload(screen.getByLabelText(enUS.importStatementFile), file)
  await user.click(screen.getByRole('button', { name: enUS.importStatementPreview }))
}

beforeEach(() => {
  previewMutateAsync.mockResolvedValue(PREVIEW)
  confirmMutateAsync.mockResolvedValue({ imported: 2, skipped: 0, ids: ['a', 'b'] })
})

afterEach(() => {
  pending.confirming = false
  resetImporterMissing()
  cleanup()
  vi.clearAllMocks()
})

describe('ImportTransactionsDialog', () => {
  it('renders nothing while closed', () => {
    render(<ImportTransactionsDialog open={false} onClose={vi.fn()} />)

    expect(screen.queryByText(enUS.importStatementTitle)).toBeNull()
  })

  it('keeps Preview disabled until an account and a file are chosen', async () => {
    const { user } = setup()
    const preview = screen.getByRole('button', { name: enUS.importStatementPreview })
    expect((preview as HTMLButtonElement).disabled).toBe(true)

    await user.selectOptions(screen.getByLabelText(enUS.importStatementAccount), 'acc-1')
    expect((preview as HTMLButtonElement).disabled).toBe(true)

    await user.upload(screen.getByLabelText(enUS.importStatementFile), statement())
    expect((preview as HTMLButtonElement).disabled).toBe(false)
  })

  it('preselects the default account', () => {
    setup({ defaultAccountId: 'acc-2' })

    expect(screen.getByLabelText<HTMLSelectElement>(enUS.importStatementAccount).value).toBe('acc-2')
  })

  it('refuses a file that is not .csv or .ofx and never calls the server', async () => {
    const { user } = setup()
    await user.selectOptions(screen.getByLabelText(enUS.importStatementAccount), 'acc-1')
    await user.upload(screen.getByLabelText(enUS.importStatementFile), statement('statement.pdf'))

    expect(screen.getByRole('alert').textContent).toBe(enUS.importStatementInvalidFormat)
    expect((screen.getByRole('button', { name: enUS.importStatementPreview }) as HTMLButtonElement).disabled).toBe(true)
    expect(previewMutateAsync).not.toHaveBeenCalled()
  })

  it('uploads the file to the preview and lists every row with its status', async () => {
    const { user } = setup()
    const file = statement('november.ofx')
    await fillAndPreview(user, file)

    expect(previewMutateAsync).toHaveBeenCalledWith({ accountId: 'acc-1', file })
    expect(screen.getByText('2 new')).toBeTruthy()
    expect(screen.getByText('1 duplicate')).toBeTruthy()
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows).toHaveLength(3)
    expect(within(rows[0]).getByText('Corner bakery')).toBeTruthy()
    expect(within(rows[1]).getByText(enUS.income)).toBeTruthy()
    expect(within(rows[2]).getByText(enUS.importStatementRowDuplicate)).toBeTruthy()
  })

  it('sends the whole file on confirm, duplicates included, and reports what the server imported', async () => {
    const { user, onClose } = setup()
    await fillAndPreview(user)
    await user.click(screen.getByRole('button', { name: enUS.importStatementConfirm }))

    expect(confirmMutateAsync).toHaveBeenCalledWith({
      accountId: 'acc-1',
      rows: [
        { date: PREVIEW.rows[0].date, description: 'Corner bakery', amount: 10, type: 'EXPENSE' },
        { date: PREVIEW.rows[1].date, description: 'Monthly salary', amount: 2500, type: 'INCOME' },
        { date: PREVIEW.rows[2].date, description: 'Book store', amount: 40, type: 'EXPENSE' },
      ],
    })
    expect(toastSuccess).toHaveBeenCalledWith('2 transactions imported successfully.')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('uses the singular message for one imported row', async () => {
    confirmMutateAsync.mockResolvedValue({ imported: 1, skipped: 0, ids: ['a'] })
    const { user } = setup()
    await fillAndPreview(user)
    await user.click(screen.getByRole('button', { name: enUS.importStatementConfirm }))

    expect(toastSuccess).toHaveBeenCalledWith(enUS.importStatementImportedOne)
  })

  it('cannot confirm when every row is a duplicate', async () => {
    previewMutateAsync.mockResolvedValue({
      ...PREVIEW,
      newCount: 0,
      duplicateCount: 3,
      rows: PREVIEW.rows.map((r) => ({ ...r, duplicate: true })),
    })
    const { user } = setup()
    await fillAndPreview(user)

    const confirm = screen.getByRole('button', { name: enUS.importStatementConfirm })
    expect((confirm as HTMLButtonElement).disabled).toBe(true)
    await user.click(confirm)
    expect(confirmMutateAsync).not.toHaveBeenCalled()
  })

  it('says so when the file has no transactions', async () => {
    previewMutateAsync.mockResolvedValue({ rows: [], total: 0, newCount: 0, duplicateCount: 0 })
    const { user } = setup()
    await fillAndPreview(user)

    expect(screen.getByText(enUS.importStatementEmpty)).toBeTruthy()
    expect((screen.getByRole('button', { name: enUS.importStatementConfirm }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('goes back to the first step keeping the chosen account', async () => {
    const { user } = setup()
    await fillAndPreview(user)
    await user.click(screen.getByRole('button', { name: enUS.back }))

    expect(screen.getByLabelText<HTMLSelectElement>(enUS.importStatementAccount).value).toBe('acc-1')
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('shows the server message when the preview fails', async () => {
    previewMutateAsync.mockRejectedValue(Object.assign(new Error('No readable transactions found in the file.'), { status: 400 }))
    const { user } = setup()
    await fillAndPreview(user)

    expect(toastError).toHaveBeenCalledWith('No readable transactions found in the file.')
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('explains that the importer is unavailable when the server has no such route, and remembers it', async () => {
    previewMutateAsync.mockRejectedValue(Object.assign(new Error('HTTP 404'), { status: 404 }))
    const { user } = setup()
    await fillAndPreview(user)

    expect(toastError).toHaveBeenCalledWith(enUS.importStatementUnavailable)
    expect(getImporterMissing()).toBe(true)
  })

  it('shows the server message, and does not hide the importer, when the account is the thing that is missing', async () => {
    previewMutateAsync.mockRejectedValue(Object.assign(new Error('Account not found'), { status: 404, code: 'NOT_FOUND' }))
    const { user } = setup()
    await fillAndPreview(user)

    expect(toastError).toHaveBeenCalledWith('Account not found')
    expect(getImporterMissing()).toBe(false)
  })

  it('shows the date of the file, not the browser-local previous day', async () => {
    previewMutateAsync.mockResolvedValue({
      ...PREVIEW,
      rows: [{ ...PREVIEW.rows[0], date: '2026-11-05T00:00:00.000Z' }],
    })
    const { user } = setup()
    await fillAndPreview(user)

    expect(screen.getByText('2026-11-05')).toBeTruthy()
  })

  it('lists the lines that could not be read, with the reason', async () => {
    previewMutateAsync.mockResolvedValue({
      ...PREVIEW,
      skippedCount: 2,
      skipped: [
        { line: 4, reason: 'ambiguous-amount' },
        { line: 9, reason: 'invalid-date' },
      ],
    })
    const { user } = setup()
    await fillAndPreview(user)

    expect(screen.getByText('2 lines could not be read')).toBeTruthy()
    expect(screen.getByText(`Line 4: ${enUS.importStatementSkipAmbiguousAmount}`)).toBeTruthy()
    expect(screen.getByText(`Line 9: ${enUS.importStatementSkipInvalidDate}`)).toBeTruthy()
  })

  it('warns when the file is a credit card invoice', async () => {
    previewMutateAsync.mockResolvedValue({ ...PREVIEW, warnings: ['card-statement'] })
    const { user } = setup()
    await fillAndPreview(user)

    expect(screen.getByText(enUS.importStatementCardWarning)).toBeTruthy()
  })

  it('draws at most 200 rows and says how many there are', async () => {
    const many = Array.from({ length: 450 }, (_, i) => ({ ...PREVIEW.rows[0], index: i, description: `Row ${i}` }))
    previewMutateAsync.mockResolvedValue({ ...PREVIEW, rows: many, total: 450, newCount: 450, duplicateCount: 0 })
    const { user } = setup()
    await fillAndPreview(user)

    expect(screen.getAllByRole('row')).toHaveLength(201)
    expect(screen.getByText('Showing the first 200 of 450 rows. All new rows are imported.')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: enUS.importStatementConfirm }))
    expect(confirmMutateAsync.mock.calls[0]?.[0].rows).toHaveLength(450)
  })

  it('keeps the dialog open and reports how far it got when the server stopped half way', async () => {
    confirmMutateAsync.mockResolvedValue({ imported: 1, skipped: 0, ids: ['a'], stoppedAt: 1, error: 'database went away' })
    const { user, onClose } = setup()
    await fillAndPreview(user)
    await user.click(screen.getByRole('button', { name: enUS.importStatementConfirm }))

    expect(toastError).toHaveBeenCalledWith(
      'Imported 1 transactions, then the import stopped: database went away. Run it again to continue; rows already imported are skipped.',
    )
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('cannot be closed, or confirmed again, while the import is being written', async () => {
    const { user, onClose } = setup()
    await fillAndPreview(user)
    pending.confirming = true
    cleanup()
    render(<ImportTransactionsDialog open onClose={onClose} defaultAccountId="acc-1" />)
    // the preview is local state; show it again with the write in flight
    await user.upload(screen.getByLabelText(enUS.importStatementFile), statement())
    await user.click(screen.getByRole('button', { name: enUS.importStatementPreview }))

    expect((screen.getByRole('button', { name: enUS.importStatementImporting }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: enUS.close }) as HTMLButtonElement).disabled).toBe(true)
    await user.click(screen.getByRole('button', { name: enUS.close }))
    await user.keyboard('{Escape}')
    await user.click(document.querySelector('[aria-hidden="true"].fixed') as HTMLElement)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('stays open and reports the error when confirming fails', async () => {
    confirmMutateAsync.mockRejectedValue(new Error('Database unavailable'))
    const { user, onClose } = setup()
    await fillAndPreview(user)
    await user.click(screen.getByRole('button', { name: enUS.importStatementConfirm }))

    expect(toastError).toHaveBeenCalledWith('Database unavailable')
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('says another import is running when the server answers 409, and keeps the dialog open', async () => {
    confirmMutateAsync.mockRejectedValue(Object.assign(new Error('An import is already running for this account.'), { status: 409 }))
    const { user, onClose } = setup()
    await fillAndPreview(user)
    await user.click(screen.getByRole('button', { name: enUS.importStatementConfirm }))

    expect(toastError).toHaveBeenCalledWith(enUS.importStatementBusy)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not claim that nothing was imported when the request times out', async () => {
    confirmMutateAsync.mockRejectedValue(new Error('Network error: Request timeout - server took too long to respond'))
    const { user, onClose } = setup()
    await fillAndPreview(user)
    await user.click(screen.getByRole('button', { name: enUS.importStatementConfirm }))

    expect(toastError).toHaveBeenCalledWith(enUS.importStatementTimeout)
    expect(enUS.importStatementTimeout).toMatch(/may still be running/)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes on Escape', async () => {
    const { user, onClose } = setup()
    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
