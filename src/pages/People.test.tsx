// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import enUS from '../i18n/en-US.json'
import type { Person } from '../hooks/api/usePeople'
import { apiMock } from '../test/fakes/apiMock'
import { createPeopleServer, HttpError } from '../test/fakes/peopleServer'
import type { PeopleServer } from '../test/fakes/peopleServer'
import { isPeopleMissing, resetPeopleMissing } from '../utils/peopleAvailability'
import People from './People'

const ctx = vi.hoisted(() => ({
  household: { id: 'hh-1', role: 'OWNER' } as { id: string; role: string } | null,
}))
const toastSuccess = vi.fn()
const toastError = vi.fn()
const server = (): PeopleServer => apiMock.server as PeopleServer

// The page runs against its real hooks, helpers and the real en-US texts; only the HTTP layer, the contexts and the
// formatters are replaced. The fake server answers like the API (see test/fakes/peopleServer.ts).
vi.mock('../utils/api', async () => (await import('../test/fakes/apiMock')).apiModule)
// The settlement dialog reads accounts and candidate transactions; these hooks pull in the Firebase-backed auth context
vi.mock('../hooks/api/useAccounts', () => ({ useAccounts: () => ({ data: { accounts: [] } }) }))
vi.mock('../hooks/api/useTransactions', () => ({ useTransactions: () => ({ data: { data: [] }, isFetching: false }) }))
vi.mock('../hooks/useDefaultHousehold', () => ({
  useDefaultHousehold: () => ({ householdId: ctx.household?.id, household: ctx.household }),
}))
vi.mock('../context/ToastContext', () => ({ useToastContext: () => ({ success: toastSuccess, error: toastError }) }))
vi.mock('../context/CurrencyContext', () => ({ useCurrency: () => ({ baseCurrency: 'BRL' }) }))
// The real formatters pull in the currency table, which pulls in Firebase; the screens only need a stable rendering.
vi.mock('../utils/format', () => ({
  formatCurrency: (value: number, currency: string) => `${currency} ${value.toFixed(2)}`,
  formatDate: (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
  parseDateFromAPI: (date: string) => new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))),
}))
vi.mock('../context/I18nContext', () => ({ useI18n: () => ({ t: enUS }) }))

const ANA: Person = { id: 'p-ana', householdId: 'hh-1', name: 'Ana', aliases: ['Aninha'], userId: null, isActive: true }
const BIA: Person = { id: 'p-bia', householdId: 'hh-1', name: 'Bia', aliases: [], userId: null, isActive: true }
const CAIO: Person = { id: 'p-caio', householdId: 'hh-1', name: 'Caio', aliases: [], userId: null, isActive: true }
const DORA: Person = { id: 'p-dora', householdId: 'hh-1', name: 'Dora', aliases: [], userId: null, isActive: false }

const TRANSACTIONS = [
  { id: 't-1', description: 'Weekend groceries', amount: 100, date: '2026-10-03' },
  { id: 't-2', description: 'Movie night', amount: 90.01, date: '2026-10-04' },
]

/** Ana owes 30.00 (one share), Bia is owed 10.00 (I owe her), Caio has nothing, Dora is inactive and settled. */
function seed(): PeopleServer {
  const fake = createPeopleServer({ people: [ANA, BIA, CAIO, DORA], transactions: TRANSACTIONS })
  fake.addShare('t-1', ANA.id, 30)
  fake.addShare('t-2', BIA.id, 10, 'I_OWE_THEM')
  return fake
}

const page = (client: QueryClient) => (
  <QueryClientProvider client={client}>
    <People />
  </QueryClientProvider>
)

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } })
  const user = userEvent.setup()
  const utils = render(page(client))
  return { user, client, ...utils }
}

// The header button holds its label twice (desktop and mobile spans), so its accessible name repeats it
const NEW_PERSON = new RegExp(enUS.peopleNew)
const money = (value: number) => `BRL ${value.toFixed(2)}`
const listItem = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) })
const sentOf = (method: string, url: string) => apiMock.calls.filter((call) => call.method === method && call.url === url)

beforeEach(() => {
  apiMock.server = seed()
  ctx.household = { id: 'hh-1', role: 'OWNER' }
  apiMock.calls = []
})

afterEach(() => {
  cleanup()
  resetPeopleMissing()
  vi.clearAllMocks()
})

describe('People page: list and summary', () => {
  it('shows what each person owes, in cents, and the summary above the list', async () => {
    renderPage()
    expect(await screen.findByText(`Ana owes you ${money(30)}`)).toBeTruthy()
    expect(screen.getByText(`You owe ${money(10)} to Bia`)).toBeTruthy()
    expect(screen.getByText('All settled with Caio')).toBeTruthy()

    const summary = screen.getByLabelText(enUS.peopleSummaryAria)
    expect(within(summary).getByText(enUS.peopleOwedToMe).nextSibling?.textContent).toBe(money(30))
    expect(within(summary).getByText(enUS.peopleIOwe).nextSibling?.textContent).toBe(money(10))
    expect(within(summary).getByText(enUS.peopleNet).nextSibling?.textContent).toContain(money(20))
    expect(within(summary).getByText(enUS.peopleNetToReceive)).toBeTruthy()
  })

  it('says how many shares a person has, singular and plural', async () => {
    const fake = apiMock.server as PeopleServer
    fake.addShare('t-2', ANA.id, 5)
    renderPage()
    await screen.findByText(`Ana owes you ${money(35)}`)
    expect(within(listItem('Ana')).getByText('2 recorded shares')).toBeTruthy()
    expect(within(listItem('Bia')).getByText('1 recorded share')).toBeTruthy()
  })

  it('leaves out inactive people until asked', async () => {
    const { user } = renderPage()
    await screen.findByText('All settled with Caio')
    expect(screen.queryByText(/Dora/)).toBeNull()
    await user.click(screen.getByLabelText(enUS.peopleShowInactive))
    expect(await screen.findByText('All settled with Dora')).toBeTruthy()
    expect(within(listItem('Dora')).getByText(enUS.peopleInactive)).toBeTruthy()
  })

  it('explains an empty household', async () => {
    apiMock.server = createPeopleServer()
    renderPage()
    expect(await screen.findByText(enUS.peopleEmptyTitle)).toBeTruthy()
    expect(screen.getByText(enUS.peopleEmptyHint)).toBeTruthy()
  })

  it('shows the error of a failed load', async () => {
    server().failNext((m, u) => m === 'GET' && u === '/people/balances', new HttpError(500, 'Database is down'))
    renderPage()
    expect((await screen.findByRole('alert')).textContent).toBe('Database is down')
  })

  it('a viewer reads but cannot add, edit or delete', async () => {
    ctx.household = { id: 'hh-1', role: 'VIEWER' }
    const { user } = renderPage()
    await screen.findByText('All settled with Caio')
    expect(screen.queryByRole('button', { name: NEW_PERSON })).toBeNull()
    await user.click(listItem('Ana'))
    expect(await screen.findByRole('heading', { level: 2, name: 'Ana' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: enUS.edit })).toBeNull()
    expect(screen.queryByRole('button', { name: enUS.delete })).toBeNull()
  })
})

describe('People page: the statement of a person', () => {
  it('asks to pick a person first, then shows the ledger with the running balance', async () => {
    const { user } = renderPage()
    expect(await screen.findByText(enUS.peoplePickOne)).toBeTruthy()
    server().addSettlement(ANA.id, 12.5, '2026-10-06')
    await user.click(listItem('Ana'))

    const statement = await screen.findByRole('region', { name: 'Statement of Ana' })
    const rows = await within(statement).findAllByRole('row')
    // header + the settlement (newest) + the share
    expect(rows).toHaveLength(3)
    expect(within(rows[1]!).getAllByText(enUS.peopleKindReceived).length).toBeGreaterThan(0)
    expect(within(rows[1]!).getByText(`-${money(12.5)}`)).toBeTruthy()
    expect(within(rows[2]!).getByText(enUS.peopleKindTheirShare)).toBeTruthy()
    expect(within(rows[2]!).getByText(`of ${money(100)}`)).toBeTruthy()
    // balance after the share: +30.00, after the settlement: +17.50
    expect(within(rows[2]!).getAllByText(`+${money(30)}`).length).toBeGreaterThan(0)
    expect(within(rows[1]!).getByText(`+${money(17.5)}`)).toBeTruthy()
  })

  it('shows a settlement without a transaction by its translated kind, not by the server default text', async () => {
    server().addSettlement(ANA.id, 12.5, '2026-10-06')
    const { user } = renderPage()
    await user.click(await screen.findByRole('button', { name: /^Ana/ }))
    const statement = await screen.findByRole('region', { name: 'Statement of Ana' })
    const row = (await within(statement).findAllByText(enUS.peopleKindReceived))[0]!.closest('tr')!
    expect(within(row).getAllByText(enUS.peopleKindReceived)).toHaveLength(2)
    expect(within(row).queryByText('Settlement')).toBeNull()
  })

  it('shows the four totals of the person from the balances endpoint', async () => {
    const { user } = renderPage()
    await user.click(await screen.findByRole('button', { name: /^Bia/ }))
    const statement = await screen.findByRole('region', { name: 'Statement of Bia' })
    expect(within(statement).getByText(enUS.peopleIOwe).nextSibling?.textContent).toBe(money(10))
    expect(within(statement).getByText(enUS.peopleStatReceived).nextSibling?.textContent).toBe(money(0))
  })

  it('pages the ledger by cursor and appends, never replacing what is shown', async () => {
    const fake = apiMock.server as PeopleServer
    for (let i = 0; i < 29; i += 1) {
      fake.addTransaction({ id: `bulk-${i}`, description: `Bulk ${String(i).padStart(2, '0')}`, amount: 10, date: `2026-09-${String((i % 28) + 1).padStart(2, '0')}` })
      fake.addShare(`bulk-${i}`, ANA.id, 1)
    }
    const { user } = renderPage()
    await user.click(await screen.findByRole('button', { name: /^Ana/ }))
    const statement = await screen.findByRole('region', { name: 'Statement of Ana' })
    await within(statement).findByText('Showing 25 of 30 entries')
    expect(within(statement).getAllByRole('row')).toHaveLength(26)

    await user.click(within(statement).getByRole('button', { name: enUS.peopleLoadMore }))
    await within(statement).findByText('Showing 30 of 30 entries')
    expect(within(statement).getAllByRole('row')).toHaveLength(31)
    expect(within(statement).queryByRole('button', { name: enUS.peopleLoadMore })).toBeNull()
    const ledgerCalls = sentOf('GET', '/people/p-ana/ledger')
    expect(ledgerCalls[0]!.payload).toMatchObject({ householdId: 'hh-1', limit: 25 })
    expect((ledgerCalls[0]!.payload as { cursor?: string }).cursor).toBeUndefined()
    expect((ledgerCalls[1]!.payload as { cursor?: string }).cursor).toBe('c25')
  })

  it('forgets the person picked when the household changes', async () => {
    const { user, client, rerender } = renderPage()
    await user.click(await screen.findByRole('button', { name: /^Ana/ }))
    await screen.findByRole('region', { name: 'Statement of Ana' })
    ctx.household = { id: 'hh-2', role: 'OWNER' }
    rerender(page(client))
    expect(await screen.findByText(enUS.peoplePickOne)).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Statement of Ana' })).toBeNull()
  })

  it('offers a retry when the ledger fails to load', async () => {
    const { user } = renderPage()
    await screen.findByText(`Ana owes you ${money(30)}`)
    server().failNext((m, u) => m === 'GET' && u === '/people/p-ana/ledger', new HttpError(500, 'Ledger exploded'))
    await user.click(listItem('Ana'))
    const statement = await screen.findByRole('region', { name: 'Statement of Ana' })
    expect((await within(statement).findByRole('alert')).textContent).toBe('Ledger exploded')
    await user.click(within(statement).getByRole('button', { name: enUS.peopleRetry }))
    expect(await within(statement).findByText(enUS.peopleKindTheirShare)).toBeTruthy()
  })
})

describe('People page: settlements', () => {
  it('records a settlement from the statement and the balance follows', async () => {
    const { user } = renderPage()
    await user.click(await screen.findByRole('button', { name: /^Ana/ }))
    await user.click(await screen.findByRole('button', { name: enUS.peopleSettleAction }))
    const dialog = await screen.findByRole('dialog', { name: 'Record a settlement with Ana' })
    expect((within(dialog).getByLabelText(enUS.amount) as HTMLInputElement).value).toBe('30,00')
    await user.click(within(dialog).getByLabelText(enUS.peopleModeNone))
    await user.click(within(dialog).getByRole('button', { name: enUS.peopleSettleAction }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(sentOf('POST', '/people/p-ana/settlements')).toHaveLength(1)
    expect(await screen.findByText('All settled with Ana', { selector: 'p.mt-2' })).toBeTruthy()
    const statement = screen.getByRole('region', { name: 'Statement of Ana' })
    expect((await within(statement).findAllByText(enUS.peopleKindReceived)).length).toBeGreaterThan(0)
  })

  it('undoes a settlement after a confirmation, keeping the linked transaction', async () => {
    server().addSettlement(ANA.id, 12.5, '2026-10-06')
    const { user } = renderPage()
    await user.click(await screen.findByRole('button', { name: /^Ana/ }))
    const statement = await screen.findByRole('region', { name: 'Statement of Ana' })
    await user.click(await within(statement).findByRole('button', { name: 'Undo the settlement of 2026-10-06' }))
    expect(within(statement).getByText(enUS.peopleUndoHint)).toBeTruthy()
    expect(sentOf('DELETE', '/settlements/st-3')).toHaveLength(0)
    await user.click(within(statement).getByRole('button', { name: enUS.peopleUndo }))

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith(enUS.peopleUndone))
    expect(server().state.settlements).toHaveLength(0)
    expect(await screen.findByText(`Ana owes you ${money(30)}`, { selector: 'p.mt-2' })).toBeTruthy()
  })

  it('can cancel the undo, and a failed undo shows the error', async () => {
    server().addSettlement(ANA.id, 12.5, '2026-10-06')
    const { user } = renderPage()
    await user.click(await screen.findByRole('button', { name: /^Ana/ }))
    const statement = await screen.findByRole('region', { name: 'Statement of Ana' })
    await user.click(await within(statement).findByRole('button', { name: 'Undo the settlement of 2026-10-06' }))
    await user.click(within(statement).getByRole('button', { name: enUS.cancel }))
    expect(within(statement).queryByText(enUS.peopleUndoHint)).toBeNull()

    server().failNext((m) => m === 'DELETE', new HttpError(500, 'Cannot undo now'))
    await user.click(within(statement).getByRole('button', { name: 'Undo the settlement of 2026-10-06' }))
    await user.click(within(statement).getByRole('button', { name: enUS.peopleUndo }))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Cannot undo now'))
    expect(server().state.settlements).toHaveLength(1)
  })

  it('a viewer cannot record or undo settlements', async () => {
    server().addSettlement(ANA.id, 12.5, '2026-10-06')
    ctx.household = { id: 'hh-1', role: 'VIEWER' }
    const { user } = renderPage()
    await user.click(await screen.findByRole('button', { name: /^Ana/ }))
    const statement = await screen.findByRole('region', { name: 'Statement of Ana' })
    await within(statement).findAllByText(enUS.peopleKindReceived)
    expect(screen.queryByRole('button', { name: enUS.peopleSettleAction })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Undo the settlement of 2026-10-06' })).toBeNull()
  })
})

describe('People page: add, edit and delete', () => {
  const openForm = async (user: ReturnType<typeof userEvent.setup>) => {
    // The header renders its actions twice (desktop and mobile layouts)
    await user.click((await screen.findAllByRole('button', { name: NEW_PERSON }))[0]!)
    return screen.findByRole('dialog', { name: enUS.peopleNew })
  }

  it('creates a person with nicknames and selects them', async () => {
    const { user } = renderPage()
    await screen.findByText('All settled with Caio')
    const dialog = await openForm(user)
    expect((within(dialog).getByRole('button', { name: enUS.save }) as HTMLButtonElement).disabled).toBe(true)

    await user.type(within(dialog).getByLabelText(enUS.name), '  Eva  ')
    await user.type(within(dialog).getByLabelText(enUS.peopleFormAliases), 'Evinha; Eve , eva')
    await user.click(within(dialog).getByRole('button', { name: enUS.save }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(sentOf('POST', '/people')).toHaveLength(1)
    // trimmed name, aliases cleaned: no repeat of the name ("eva"), separators of both kinds
    expect(sentOf('POST', '/people')[0]!.payload).toEqual({ householdId: 'hh-1', name: 'Eva', aliases: ['Evinha', 'Eve'] })
    expect(toastSuccess).toHaveBeenCalledWith(enUS.peopleCreated)
    expect(await screen.findByRole('region', { name: 'Statement of Eva' })).toBeTruthy()
  })

  it('refuses a name or nickname of another person before asking the server', async () => {
    const { user } = renderPage()
    await screen.findByText('All settled with Caio')
    const dialog = await openForm(user)
    await user.type(within(dialog).getByLabelText(enUS.name), 'Zeca')
    await user.type(within(dialog).getByLabelText(enUS.peopleFormAliases), 'aninha')
    expect((await within(dialog).findByRole('alert')).textContent).toBe('"aninha" is already the name or nickname of Ana.')
    expect((within(dialog).getByRole('button', { name: enUS.save }) as HTMLButtonElement).disabled).toBe(true)
    expect(sentOf('POST', '/people')).toHaveLength(0)
  })

  it('keeps the form open and says so when the server answers 409', async () => {
    const { user } = renderPage()
    await screen.findByText('All settled with Caio')
    const dialog = await openForm(user)
    await user.type(within(dialog).getByLabelText(enUS.name), 'Zeca')
    server().failNext((m, u) => m === 'POST' && u === '/people', Object.assign(new HttpError(409, 'conflict'), { code: 'CONFLICT' }))
    await user.click(within(dialog).getByRole('button', { name: enUS.save }))

    expect((await within(dialog).findByRole('alert')).textContent).toBe(enUS.peopleErrConflict)
    expect(toastError).toHaveBeenCalledWith(enUS.peopleErrConflict)
    expect(screen.getByRole('dialog')).toBeTruthy()
    // the user can try again without retyping
    expect((within(dialog).getByLabelText(enUS.name) as HTMLInputElement).value).toBe('Zeca')
  })

  it('sends one request when Save is pressed twice in a row', async () => {
    const { user } = renderPage()
    await screen.findByText('All settled with Caio')
    const dialog = await openForm(user)
    await user.type(within(dialog).getByLabelText(enUS.name), 'Zeca')
    const gate = server().gate((m, u) => m === 'POST' && u === '/people')
    const save = within(dialog).getByRole('button', { name: enUS.save })
    await user.click(save)
    await user.click(within(dialog).getByRole('button', { name: enUS.peopleFormSaving }))
    gate.ok()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(sentOf('POST', '/people')).toHaveLength(1)
  })

  it('edits a person: nicknames replaced, active flag sent', async () => {
    const { user } = renderPage()
    await user.click(await screen.findByRole('button', { name: /^Caio/ }))
    await user.click(await screen.findByRole('button', { name: enUS.edit }))
    const dialog = await screen.findByRole('dialog', { name: enUS.peopleFormEditTitle })
    expect((within(dialog).getByLabelText(enUS.name) as HTMLInputElement).value).toBe('Caio')
    await user.type(within(dialog).getByLabelText(enUS.peopleFormAliases), 'Cacá')
    await user.click(within(dialog).getByLabelText(enUS.peopleFormActive))
    await user.click(within(dialog).getByRole('button', { name: enUS.save }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(sentOf('PATCH', '/people/p-caio')[0]!.payload).toEqual({ name: 'Caio', aliases: ['Cacá'], isActive: false })
    expect(toastSuccess).toHaveBeenCalledWith(enUS.peopleUpdated)
  })

  it('does not wipe what is being typed when the person refetches meanwhile', async () => {
    const { user, client } = renderPage()
    await user.click(await screen.findByRole('button', { name: /^Caio/ }))
    await user.click(await screen.findByRole('button', { name: enUS.edit }))
    const dialog = await screen.findByRole('dialog', { name: enUS.peopleFormEditTitle })
    await user.type(within(dialog).getByLabelText(enUS.peopleFormAliases), 'Cacá')
    await client.invalidateQueries({ queryKey: ['people'] })
    await waitFor(() => expect(sentOf('GET', '/people/balances').length).toBeGreaterThan(1))
    expect((within(dialog).getByLabelText(enUS.peopleFormAliases) as HTMLInputElement).value).toBe('Cacá')
  })

  it('deletes a person without history: confirmation first, then gone', async () => {
    const { user } = renderPage()
    await user.click(await screen.findByRole('button', { name: /^Caio/ }))
    await user.click(await screen.findByRole('button', { name: enUS.delete }))
    const confirm = await screen.findByRole('alertdialog', { name: enUS.peopleDeleteConfirmAria })
    expect(within(confirm).getByText('Delete Caio?')).toBeTruthy()
    expect(sentOf('DELETE', '/people/p-caio')).toHaveLength(0)

    await user.click(within(confirm).getByRole('button', { name: enUS.delete }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Caio/ })).toBeNull())
    expect(toastSuccess).toHaveBeenCalledWith(enUS.peopleDeleted)
    expect(screen.queryByRole('region', { name: 'Statement of Caio' })).toBeNull()
  })

  it('a person with history is deactivated instead, and stays on the page', async () => {
    const { user } = renderPage()
    await user.click(await screen.findByRole('button', { name: /^Ana/ }))
    await user.click(await screen.findByRole('button', { name: enUS.delete }))
    const confirm = await screen.findByRole('alertdialog')
    await user.click(within(confirm).getByRole('button', { name: enUS.delete }))

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith(enUS.peopleDeactivated))
    expect(toastSuccess).not.toHaveBeenCalledWith(enUS.peopleDeleted)
    expect(await screen.findByRole('region', { name: 'Statement of Ana' })).toBeTruthy()
    // still listed (she has a balance) and now marked inactive
    expect(await within(listItem('Ana')).findByText(enUS.peopleInactive)).toBeTruthy()
  })

  it('sends one delete request while the first is still in flight', async () => {
    const { user } = renderPage()
    await user.click(await screen.findByRole('button', { name: /^Caio/ }))
    await user.click(await screen.findByRole('button', { name: enUS.delete }))
    const confirm = await screen.findByRole('alertdialog')
    const gate = server().gate((m) => m === 'DELETE')
    await user.click(within(confirm).getByRole('button', { name: enUS.delete }))
    const busy = within(confirm).getByRole('button', { name: enUS.peopleDeleting }) as HTMLButtonElement
    expect(busy.disabled).toBe(true)
    await user.click(busy)
    gate.ok()
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Caio/ })).toBeNull())
    expect(sentOf('DELETE', '/people/p-caio')).toHaveLength(1)
  })

  it('moves focus into the delete confirmation, on the safe choice', async () => {
    const { user } = renderPage()
    await user.click(await screen.findByRole('button', { name: /^Caio/ }))
    await user.click(await screen.findByRole('button', { name: enUS.delete }))
    const confirm = await screen.findByRole('alertdialog', { name: enUS.peopleDeleteConfirmAria })
    expect(document.activeElement).toBe(within(confirm).getByRole('button', { name: enUS.cancel }))
  })

  it('can cancel the deletion, and shows the error when it fails', async () => {
    const { user } = renderPage()
    await user.click(await screen.findByRole('button', { name: /^Caio/ }))
    await user.click(await screen.findByRole('button', { name: enUS.delete }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: enUS.cancel }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(sentOf('DELETE', '/people/p-caio')).toHaveLength(0)

    server().failNext((m) => m === 'DELETE', new HttpError(500, 'Cannot delete right now'))
    await user.click(screen.getByRole('button', { name: enUS.delete }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: enUS.delete }))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Cannot delete right now'))
    expect(screen.getByRole('region', { name: 'Statement of Caio' })).toBeTruthy()
  })
})

describe('People page: server without the people routes', () => {
  it('explains that the feature is unavailable and remembers it for the menu', async () => {
    server().failNext((m, u) => m === 'GET' && u === '/people/balances', Object.assign(new HttpError(404, 'HTTP 404'), { code: undefined }), 5)
    server().failNext((m, u) => m === 'GET' && u === '/people', Object.assign(new HttpError(404, 'HTTP 404'), { code: undefined }), 5)
    renderPage()
    expect(await screen.findByText(enUS.peopleUnavailable)).toBeTruthy()
    expect(isPeopleMissing()).toBe(true)
    expect(screen.queryByRole('button', { name: NEW_PERSON })).toBeNull()
  })

  it('a missing person (an application 404) is not mistaken for a missing feature', async () => {
    server().failNext((m, u) => m === 'GET' && u === '/people/balances', Object.assign(new HttpError(404, 'Household not found'), { code: 'NOT_FOUND' }), 5)
    renderPage()
    expect((await screen.findByRole('alert')).textContent).toBe('Household not found')
    expect(isPeopleMissing()).toBe(false)
    expect(screen.queryByText(enUS.peopleUnavailable)).toBeNull()
  })
})
