// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import enUS from '../../i18n/en-US.json'
import { lastDayOfPreviousYear, todayIsoDate } from '../../utils/adjustBalance'
import AdjustBalanceDialog from './AdjustBalanceDialog'

// The dialog runs for real; only the edges are replaced: the contexts it reads (texts, currency, toasts, auth) and the HTTP
// client, which a tiny fake of POST /accounts/:id/adjust-balance stands in for. Every name and amount here is invented.
const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  toasts: [] as Array<[string, string]>,
}))

vi.mock('../../utils/api', () => ({ apiClient: { post: mocks.post } }))
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ currentUser: null }) }))
vi.mock('../../context/I18nContext', () => ({ useI18n: () => ({ t: enUS, locale: 'en-US' }) }))
vi.mock('../../context/CurrencyContext', () => {
  const USD = { code: 'USD', name: 'US Dollar', symbol: '$', locale: 'en-US', decimalPlaces: 2 }
  return { CURRENCIES: { USD }, DEFAULT_CURRENCY: 'USD', useCurrency: () => ({ baseCurrency: 'USD' }) }
})
vi.mock('../../context/ToastContext', () => ({
  useToastContext: () => ({
    success: (message: string) => mocks.toasts.push(['success', message]),
    error: (message: string) => mocks.toasts.push(['error', message]),
    warning: (message: string) => mocks.toasts.push(['warning', message]),
  }),
}))

const TODAY = todayIsoDate()
const OPENING = lastDayOfPreviousYear()
const ACCOUNT = { id: 'acc-1', name: 'Test Checking', currentBalance: 3665.04 }

let closed = 0
let held: Array<() => void> = []

/**
 * The reply of a server that dates the entry as asked: { account, adjustment } with adjustment null when nothing needed to
 * change. `ignoreDate` is a backend that predates the `date` field and dates the entry "now".
 */
function reply(body: { newBalance: number; date: string; reason: string }, { ignoreDate = false } = {}) {
  const diff = Math.round(body.newBalance * 100) - Math.round(ACCOUNT.currentBalance * 100)
  const [y, m, d] = body.date.split('-').map(Number) as [number, number, number]
  return {
    success: true,
    data: {
      account: { id: ACCOUNT.id, householdId: 'h1' },
      adjustment: diff === 0 ? null : {
        id: 'e1',
        amount: Math.abs(diff) / 100,
        date: (ignoreDate ? new Date() : new Date(y, m - 1, d)).toISOString(),
      },
    },
  }
}

function renderDialog(props: Partial<{ open: boolean }> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const tree = (open: boolean) => (
    <QueryClientProvider client={client}>
      <AdjustBalanceDialog open={open} onClose={() => { closed += 1 }} accountId={ACCOUNT.id} accountName={ACCOUNT.name} currentBalance={ACCOUNT.currentBalance} />
    </QueryClientProvider>
  )
  const view = render(tree(props.open ?? true))
  return { ...view, setOpen: (open: boolean) => view.rerender(tree(open)) }
}

const target = () => screen.getByLabelText(enUS.adjustBalanceTargetLabel) as HTMLInputElement
const dateField = () => screen.getByLabelText(enUS.adjustBalanceDateLabel) as HTMLInputElement
const reasonField = () => screen.getByLabelText(enUS.adjustBalanceReasonLabel) as HTMLInputElement
const confirmBox = () => screen.getByRole('checkbox') as HTMLInputElement
const submit = () => screen.getByRole('button', { name: new RegExp(`^(${enUS.adjustBalanceAction}|${enUS.adjustBalanceSaving})$`) }) as HTMLButtonElement
const type = (field: HTMLElement, value: string) => fireEvent.change(field, { target: { value } })
const fill = (cents: string) => {
  type(target(), cents)
  fireEvent.click(confirmBox())
}

beforeEach(() => {
  closed = 0
  held = []
  mocks.toasts.length = 0
  mocks.post.mockReset()
  mocks.post.mockImplementation(async (_url: string, body: { newBalance: number; date: string; reason: string }) => reply(body))
})
afterEach(cleanup)

describe('AdjustBalanceDialog', () => {
  it('opens blank: the balance, an empty target, today and nothing to send yet', () => {
    renderDialog()
    expect(screen.getByText('Adjust balance of Test Checking')).toBeTruthy()
    expect(screen.getByText('Current balance in Recta: $3,665.04')).toBeTruthy()
    expect(target().value).toBe('')
    expect(dateField().value).toBe(TODAY)
    expect(reasonField().value).toBe('')
    expect(reasonField().placeholder).toBe(enUS.adjustBalanceReasonDefault)
    expect(submit().disabled).toBe(true)
    expect(confirmBox().disabled).toBe(true)
    expect(screen.queryAllByRole('alert')).toHaveLength(0)
    expect(mocks.post).not.toHaveBeenCalled()
  })

  it('masks the target in cents, shows the difference and the entry, and needs the confirmation', () => {
    renderDialog()
    type(target(), '380227')
    expect(target().value).toBe('$3,802.27')
    expect(screen.getByText(/Difference: \+\$137\.23\. an income of \$137\.23 will be created on /)).toBeTruthy()
    expect(screen.getByText(/the balance becomes \$3,802\.27/)).toBeTruthy()
    expect(submit().disabled).toBe(true)
    fireEvent.click(confirmBox())
    expect(submit().disabled).toBe(false)
    expect(mocks.post).not.toHaveBeenCalled()
  })

  it('"Use" fills the opening-balance date, and the empty reason is sent as the opening-balance text', async () => {
    renderDialog()
    fireEvent.click(screen.getByRole('button', { name: /^Use / }))
    expect(dateField().value).toBe(OPENING)
    expect(reasonField().placeholder).toBe(enUS.adjustBalanceReasonOpening)
    fill('380227')
    fireEvent.click(submit())
    await waitFor(() => expect(closed).toBe(1))
    expect(mocks.post).toHaveBeenCalledTimes(1)
    expect(mocks.post).toHaveBeenCalledWith('/accounts/acc-1/adjust-balance', { newBalance: 3802.27, date: OPENING, reason: enUS.adjustBalanceReasonOpening })
    expect(mocks.toasts.at(-1)?.[0]).toBe('success')
    expect(mocks.toasts.at(-1)?.[1]).toMatch(/^Balance adjusted: an income of \$137\.23 on /)
  })

  it('sends a lower target as an expense wording with the typed reason', async () => {
    renderDialog()
    type(reasonField(), '  Checked in the bank app ')
    fill('100000')
    expect(screen.getByText(/an expense of \$2,665\.04/)).toBeTruthy()
    fireEvent.click(submit())
    await waitFor(() => expect(closed).toBe(1))
    expect(mocks.post.mock.calls[0]?.[1]).toEqual({ newBalance: 1000, date: TODAY, reason: 'Checked in the bank app' })
  })

  it('refuses the current balance, a future date and a missing date without any request', () => {
    renderDialog()
    type(target(), '366504')
    expect(screen.getByRole('alert').textContent).toBe(enUS.adjustBalanceErrSameBalance)
    expect(confirmBox().disabled).toBe(true)
    type(target(), '380227')
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    type(dateField(), todayIsoDate(tomorrow))
    expect(screen.getByRole('alert').textContent).toBe(enUS.adjustBalanceErrDateFuture)
    type(dateField(), '')
    expect(screen.getByRole('alert').textContent).toBe(enUS.adjustBalanceErrDateRequired)
    expect(submit().disabled).toBe(true)
    expect(dateField().max).toBe(TODAY)
    expect(mocks.post).not.toHaveBeenCalled()
  })

  it('takes the confirmation back when any field is edited after confirming', () => {
    renderDialog()
    fill('380227')
    expect(submit().disabled).toBe(false)
    type(target(), '$3,802.270')
    expect(confirmBox().checked).toBe(false)
    expect(submit().disabled).toBe(true)
    fireEvent.click(confirmBox())
    fireEvent.click(screen.getByRole('button', { name: /^Use / }))
    expect(confirmBox().checked).toBe(false)
    fireEvent.click(confirmBox())
    type(reasonField(), 'Another reason')
    expect(confirmBox().checked).toBe(false)
  })

  it('sends one request on a double submit and cannot be closed while it is in flight', async () => {
    mocks.post.mockImplementation((_url: string, body: { newBalance: number; date: string; reason: string }) =>
      new Promise((resolve) => { held.push(() => resolve(reply(body))) }))
    renderDialog()
    fill('380227')
    // Two clicks before React re-renders the button as disabled: only the in-flight guard stops the second one.
    const button = submit()
    act(() => {
      fireEvent.click(button)
      fireEvent.click(button)
    })
    await waitFor(() => expect(submit().textContent).toBe(enUS.adjustBalanceSaving))
    expect(mocks.post).toHaveBeenCalledTimes(1)
    expect(target().disabled).toBe(true)
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: enUS.cancel }))
    fireEvent.click(document.querySelector('div[aria-hidden="true"]') as HTMLElement)
    expect(closed).toBe(0)
    await act(async () => { held[0]?.() })
    await waitFor(() => expect(closed).toBe(1))
    expect(mocks.post).toHaveBeenCalledTimes(1)
  })

  it('warns instead of reporting success when an older backend ignored the date', async () => {
    mocks.post.mockImplementation(async (_url: string, body: { newBalance: number; date: string; reason: string }) =>
      reply(body, { ignoreDate: true }))
    renderDialog()
    fireEvent.click(screen.getByRole('button', { name: /^Use / }))
    fill('380227')
    fireEvent.click(submit())
    await waitFor(() => expect(closed).toBe(1))
    const [kind, message] = mocks.toasts.at(-1)!
    expect(kind).toBe('warning')
    expect(message).toMatch(/^The server recorded the entry on /)
    expect(mocks.toasts.some(([k]) => k === 'success')).toBe(false)
  })

  it('does not warn when the entry is dated today as asked, even by an older backend', async () => {
    mocks.post.mockImplementation(async (_url: string, body: { newBalance: number; date: string; reason: string }) =>
      reply(body, { ignoreDate: true }))
    renderDialog()
    fill('380227')
    fireEvent.click(submit())
    await waitFor(() => expect(closed).toBe(1))
    expect(mocks.toasts.at(-1)?.[0]).toBe('success')
  })

  it('says the difference is estimated from the balance last loaded', () => {
    renderDialog()
    type(target(), '380227')
    expect(screen.getByText(enUS.adjustBalanceStaleHint)).toBeTruthy()
  })

  it('moves focus into the dialog, keeps Tab inside it and gives focus back when it closes', () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    const { setOpen } = renderDialog({ open: false })
    setOpen(true)
    expect(document.activeElement).toBe(target())
    const dialog = screen.getByRole('dialog')
    const buttons = () => Array.from(dialog.querySelectorAll<HTMLElement>('input:not([disabled]), button:not([disabled])'))
    const first = buttons()[0]!
    const last = buttons().at(-1)!
    last.focus()
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(document.activeElement).toBe(first)
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
    // Focus that escaped the dialog is pulled back in.
    opener.focus()
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(dialog.contains(document.activeElement)).toBe(true)
    setOpen(false)
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })

  it('closes with ESC when idle', () => {
    renderDialog()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(closed).toBe(1)
  })

  it('keeps the dialog open on a server error, shows it, and a retry is one more request', async () => {
    mocks.post.mockRejectedValueOnce(new Error('date cannot be in the future'))
    renderDialog()
    fill('380227')
    fireEvent.click(submit())
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('date cannot be in the future'))
    expect(mocks.toasts.at(-1)).toEqual(['error', 'date cannot be in the future'])
    expect(closed).toBe(0)
    expect(submit().disabled).toBe(false)
    fireEvent.click(submit())
    await waitFor(() => expect(closed).toBe(1))
    expect(mocks.post).toHaveBeenCalledTimes(2)
  })

  it('says so when the server found the account already at that balance (adjustment null)', async () => {
    mocks.post.mockResolvedValueOnce({ success: true, data: { account: { id: ACCOUNT.id, householdId: 'h1' }, adjustment: null } })
    renderDialog()
    fill('380227')
    fireEvent.click(submit())
    await waitFor(() => expect(closed).toBe(1))
    expect(mocks.toasts.at(-1)).toEqual(['success', enUS.adjustBalanceAlreadyThere])
  })

  it('starts every opening blank and unconfirmed', () => {
    const { setOpen } = renderDialog()
    fill('380227')
    type(reasonField(), 'Something')
    setOpen(false)
    setOpen(true)
    expect(target().value).toBe('')
    expect(reasonField().value).toBe('')
    expect(confirmBox().checked).toBe(false)
    expect(submit().disabled).toBe(true)
  })

  it('types a negative target with a minus sign and sends it negative', async () => {
    renderDialog()
    type(target(), '-5000')
    expect(target().value).toBe('-$50.00')
    fireEvent.click(confirmBox())
    fireEvent.click(submit())
    await waitFor(() => expect(closed).toBe(1))
    expect(mocks.post.mock.calls[0]?.[1]).toMatchObject({ newBalance: -50 })
  })
})
