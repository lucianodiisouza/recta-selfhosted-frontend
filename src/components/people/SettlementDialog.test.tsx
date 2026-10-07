// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import enUS from '../../i18n/en-US.json'
import type { Person } from '../../hooks/api/usePeople'
import { SETTLEMENT_ACCOUNT_STORAGE_KEY } from '../../hooks/api/usePeople'
import { apiMock } from '../../test/fakes/apiMock'
import { createPeopleServer, HttpError } from '../../test/fakes/peopleServer'
import type { PeopleServer } from '../../test/fakes/peopleServer'
import SettlementDialog from './SettlementDialog'

const toastSuccess = vi.fn()
const toastError = vi.fn()
const onClose = vi.fn()
const data = vi.hoisted(() => ({
  accounts: [] as Array<{ id: string; name: string; type: string; isActive: boolean }>,
  candidates: [] as Array<{ id: string; date: string; description: string; amount: number }>,
  lastTransactionsParams: null as unknown,
}))

vi.mock('../../utils/api', async () => (await import('../../test/fakes/apiMock')).apiModule)
vi.mock('../../hooks/api/useAccounts', () => ({ useAccounts: () => ({ data: { accounts: data.accounts } }) }))
vi.mock('../../hooks/api/useTransactions', () => ({
  useTransactions: (params: unknown) => {
    data.lastTransactionsParams = params
    return { data: { data: data.candidates }, isFetching: false }
  },
}))
vi.mock('../../context/ToastContext', () => ({ useToastContext: () => ({ success: toastSuccess, error: toastError }) }))
vi.mock('../../context/CurrencyContext', () => ({ useCurrency: () => ({ baseCurrency: 'BRL' }) }))
vi.mock('../../utils/format', () => ({
  formatCurrency: (value: number, currency: string) => `${currency} ${value.toFixed(2)}`,
  formatDate: (date: Date) => date.toISOString().slice(0, 10),
  parseDateFromAPI: (date: string) => new Date(`${date.slice(0, 10)}T00:00:00.000Z`),
}))
vi.mock('../../context/I18nContext', () => ({ useI18n: () => ({ t: enUS }) }))

const ANA: Person = { id: 'p-ana', householdId: 'hh-1', name: 'Ana', aliases: [], userId: null, isActive: true }
const money = (value: number) => `BRL ${value.toFixed(2)}`
const server = (): PeopleServer => apiMock.server as PeopleServer
const posts = () => apiMock.calls.filter((call) => call.method === 'POST' && call.url === '/people/p-ana/settlements')

function mount(balance = 30) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const user = userEvent.setup()
  render(
    <QueryClientProvider client={client}>
      <SettlementDialog open onClose={onClose} householdId="hh-1" person={ANA} balance={balance} />
    </QueryClientProvider>,
  )
  return { user, client }
}

const saveButton = () => screen.getByRole('button', { name: enUS.peopleSettleAction }) as HTMLButtonElement

beforeEach(() => {
  apiMock.server = createPeopleServer({ people: [ANA] })
  apiMock.calls = []
  data.accounts = [
    { id: 'acc-main', name: 'Main account', type: 'CHECKING', isActive: true },
    { id: 'acc-card', name: 'Credit card', type: 'CREDIT', isActive: true },
    { id: 'acc-old', name: 'Old account', type: 'CHECKING', isActive: false },
  ]
  data.candidates = []
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('SettlementDialog', () => {
  it('opens with the balance as the suggested amount and direction, and never guesses an account', async () => {
    mount(30)
    expect((await screen.findByLabelText(enUS.amount) as HTMLInputElement).value).toBe('30,00')
    expect((screen.getByLabelText(enUS.peopleSettleWhat) as HTMLSelectElement).value).toBe('RECEIVED')
    expect((screen.getByLabelText(enUS.account) as HTMLSelectElement).value).toBe('')
    expect(saveButton().disabled).toBe(true)
    expect(screen.getByText(`Ana owes you ${money(30)}`)).toBeTruthy()
    expect(screen.getByText(`Balance after the settlement: All settled with Ana.`)).toBeTruthy()
    // only active accounts that are not credit cards
    const options = [...(screen.getByLabelText(enUS.account) as HTMLSelectElement).options].map((o) => o.text)
    expect(options).toEqual([enUS.peopleSelectAccount, 'Main account'])
  })

  it('a balance I owe suggests the payment: PAID, an expense', async () => {
    mount(-12.5)
    expect((await screen.findByLabelText(enUS.amount) as HTMLInputElement).value).toBe('12,50')
    expect((screen.getByLabelText(enUS.peopleSettleWhat) as HTMLSelectElement).value).toBe('PAID')
    expect(screen.getByLabelText(enUS.peopleSettleDescription)).toBeTruthy()
    expect((screen.getByLabelText(enUS.peopleSettleDescription) as HTMLInputElement).value).toBe('Settlement paid to Ana')
    expect(screen.getByLabelText(enUS.peopleModeCreateExpense)).toBeTruthy()
  })

  it('creates the real transaction on the chosen account, and remembers the account', async () => {
    const { user } = mount(30)
    await user.selectOptions(await screen.findByLabelText(enUS.account), 'acc-main')
    expect(saveButton().disabled).toBe(false)
    await user.click(saveButton())
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(posts()).toHaveLength(1)
    expect(posts()[0]!.payload).toMatchObject({
      householdId: 'hh-1', direction: 'RECEIVED', amount: 30,
      createTransaction: { accountId: 'acc-main', description: 'Settlement received from Ana' },
    })
    expect(toastSuccess).toHaveBeenCalledWith(enUS.peopleSettleSavedIncome)
    expect(server().state.transactions.some((t) => t.description === 'Settlement received from Ana')).toBe(true)
    expect(JSON.parse(window.localStorage.getItem(SETTLEMENT_ACCOUNT_STORAGE_KEY)!)).toEqual({ 'hh-1': 'acc-main' })
  })

  it('preselects the account used last time in this household, when it still exists', async () => {
    window.localStorage.setItem(SETTLEMENT_ACCOUNT_STORAGE_KEY, JSON.stringify({ 'hh-1': 'acc-main' }))
    mount(30)
    await waitFor(() => expect((screen.getByLabelText(enUS.account) as HTMLSelectElement).value).toBe('acc-main'))
    cleanup()
    window.localStorage.setItem(SETTLEMENT_ACCOUNT_STORAGE_KEY, JSON.stringify({ 'hh-1': 'acc-gone' }))
    mount(30)
    await screen.findByLabelText(enUS.account)
    expect((screen.getByLabelText(enUS.account) as HTMLSelectElement).value).toBe('')
  })

  it('the description follows the direction until the user writes their own', async () => {
    const { user } = mount(30)
    const description = (await screen.findByLabelText(enUS.peopleSettleDescription)) as HTMLInputElement
    await user.selectOptions(screen.getByLabelText(enUS.peopleSettleWhat), 'PAID')
    expect(description.value).toBe('Settlement paid to Ana')
    await user.clear(description)
    await user.type(description, 'Pix to Ana')
    await user.selectOptions(screen.getByLabelText(enUS.peopleSettleWhat), 'RECEIVED')
    expect(description.value).toBe('Pix to Ana')
  })

  it('only records the settlement, without a transaction, when asked to', async () => {
    const { user } = mount(30)
    await user.click(await screen.findByLabelText(enUS.peopleModeNone))
    expect(screen.getByText(enUS.peopleSettleNoneHint)).toBeTruthy()
    await user.type(screen.getByLabelText(enUS.peopleSettleNote), '  pix  ')
    await user.click(saveButton())
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(posts()[0]!.payload).toEqual({ householdId: 'hh-1', direction: 'RECEIVED', amount: 30, date: expect.any(String), note: 'pix' })
    expect(toastSuccess).toHaveBeenCalledWith(enUS.peopleSettleSaved)
    expect(server().state.transactions).toHaveLength(0)
  })

  it('links an existing income, offering only the transactions of the right type, and can adopt its amount', async () => {
    data.candidates = [{ id: 't-income', date: '2026-10-02', description: 'Refund from Ana', amount: 45 }]
    const { user } = mount(30)
    server().addTransaction({ id: 't-income', description: 'Refund from Ana', amount: 45, date: '2026-10-02' })
    await user.click(await screen.findByLabelText(enUS.peopleModeLinkIncome))
    expect(data.lastTransactionsParams).toMatchObject({ householdId: 'hh-1', type: 'INCOME', search: 'Ana' })
    expect(saveButton().disabled).toBe(true)
    expect((await screen.findAllByRole('alert')).map((a) => a.textContent)).toContain(enUS.peopleErrTransaction)

    await user.selectOptions(screen.getByLabelText(enUS.income), 't-income')
    expect(screen.getByText(new RegExp(`The transaction is ${money(45)} and the settlement ${money(30)}`))).toBeTruthy()
    await user.click(screen.getByRole('button', { name: enUS.peopleUseTransactionAmount }))
    expect((screen.getByLabelText(enUS.amount) as HTMLInputElement).value).toBe('45,00')

    await user.click(saveButton())
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(posts()[0]!.payload).toMatchObject({ direction: 'RECEIVED', amount: 45, transactionId: 't-income' })
    expect(posts()[0]!.payload).not.toHaveProperty('createTransaction')
  })

  it('a paid settlement looks for expenses', async () => {
    const { user } = mount(-10)
    await user.click(await screen.findByLabelText(enUS.peopleModeLinkExpense))
    expect(data.lastTransactionsParams).toMatchObject({ type: 'EXPENSE' })
  })

  it('shows the message of a failed save, keeps the dialog open and allows another try', async () => {
    const { user } = mount(30)
    await user.click(await screen.findByLabelText(enUS.peopleModeNone))
    server().failNext((m) => m === 'POST', Object.assign(new HttpError(409, 'That transaction is already linked to a settlement'), { code: 'CONFLICT' }))
    await user.click(saveButton())
    expect((await screen.findByText('That transaction is already linked to a settlement')).textContent).toBeTruthy()
    expect(toastError).toHaveBeenCalledWith('That transaction is already linked to a settlement')
    expect(onClose).not.toHaveBeenCalled()
    await user.click(saveButton())
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('sends one request when Save is pressed twice while the first is in flight', async () => {
    const { user } = mount(30)
    await user.click(await screen.findByLabelText(enUS.peopleModeNone))
    const gate = server().gate((m) => m === 'POST')
    await user.click(saveButton())
    const busy = screen.getByRole('button', { name: enUS.peopleSettling }) as HTMLButtonElement
    expect(busy.disabled).toBe(true)
    await user.click(busy)
    gate.ok()
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(posts()).toHaveLength(1)
  })

  it('sends one request when two clicks land before the screen redraws', async () => {
    const { user } = mount(30)
    await user.click(await screen.findByLabelText(enUS.peopleModeNone))
    const button = saveButton()
    button.click()
    button.click()
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(posts()).toHaveLength(1)
  })

  it('refreshes balances, transactions, accounts and the dashboard after recording', async () => {
    const { user, client } = mount(30)
    const spy = vi.spyOn(client, 'invalidateQueries')
    await user.click(await screen.findByLabelText(enUS.peopleModeNone))
    await user.click(saveButton())
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    const keys = spy.mock.calls.map((call) => (call[0] as { queryKey: string[] }).queryKey[0])
    expect(keys).toEqual(expect.arrayContaining(['people', 'transactions', 'accounts', 'dashboard']))
  })

  it('refuses an amount of zero before asking the server', async () => {
    const { user } = mount(30)
    await user.click(await screen.findByLabelText(enUS.peopleModeNone))
    const amount = screen.getByLabelText(enUS.amount)
    await user.clear(amount)
    await user.type(amount, '0')
    expect((await screen.findAllByRole('alert')).map((a) => a.textContent)).toContain(enUS.peopleErrAmount)
    expect(saveButton().disabled).toBe(true)
    expect(posts()).toHaveLength(0)
  })
})
