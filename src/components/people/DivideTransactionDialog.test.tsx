// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import enUS from '../../i18n/en-US.json'
import type { Person } from '../../hooks/api/usePeople'
import { apiMock } from '../../test/fakes/apiMock'
import { createPeopleServer, HttpError } from '../../test/fakes/peopleServer'
import type { PeopleServer } from '../../test/fakes/peopleServer'
import DivideTransactionDialog from './DivideTransactionDialog'

const toastSuccess = vi.fn()
const toastError = vi.fn()
const onClose = vi.fn()

vi.mock('../../utils/api', async () => (await import('../../test/fakes/apiMock')).apiModule)
vi.mock('../../context/ToastContext', () => ({ useToastContext: () => ({ success: toastSuccess, error: toastError }) }))
vi.mock('../../context/CurrencyContext', () => ({ useCurrency: () => ({ baseCurrency: 'BRL' }) }))
vi.mock('../../utils/format', () => ({ formatCurrency: (value: number, currency: string) => `${currency} ${value.toFixed(2)}` }))
vi.mock('../../context/I18nContext', () => ({ useI18n: () => ({ t: enUS }) }))

const ANA: Person = { id: 'p-ana', householdId: 'hh-1', name: 'Ana', aliases: [], userId: null, isActive: true }
const BIA: Person = { id: 'p-bia', householdId: 'hh-1', name: 'Bia', aliases: [], userId: null, isActive: true }
const TX = { id: 't-1', description: 'Weekend groceries', amount: 100, date: '2026-10-03' }

const money = (value: number) => `BRL ${value.toFixed(2)}`
const server = (): PeopleServer => apiMock.server as PeopleServer
const puts = () => apiMock.calls.filter((call) => call.method === 'PUT')

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } })
  const user = userEvent.setup()
  render(
    <QueryClientProvider client={client}>
      <DivideTransactionDialog open onClose={onClose} householdId="hh-1" transaction={{ id: TX.id, description: TX.description, amount: TX.amount }} />
    </QueryClientProvider>,
  )
  return { user }
}

/** Picks a person in the select of the n-th row (1-based). */
async function pick(user: ReturnType<typeof userEvent.setup>, label: string, name: string) {
  await user.selectOptions(await screen.findByLabelText(label), name)
}

beforeEach(() => {
  apiMock.server = createPeopleServer({ people: [ANA, BIA], transactions: [TX] })
  apiMock.calls = []
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('DivideTransactionDialog', () => {
  it('splits equally with one person: live preview first, then the PUT the server rule agrees with', async () => {
    const { user } = mount()
    await pick(user, 'Person 1', 'Ana')
    // me + Ana: 50.00 each
    expect(screen.getByLabelText('Part 1').textContent).toBe(money(50))
    const summary = screen.getByLabelText(enUS.peopleDivideSummaryAria)
    expect(within(summary).getByText(enUS.peopleRestMine).nextSibling?.textContent).toBe(money(50))

    await user.click(screen.getByRole('button', { name: enUS.peopleSaveSplit }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(puts()[0]!.payload).toEqual({ direction: 'THEY_OWE_ME', strategy: 'equal', entries: [{ personId: 'p-ana' }] })
    expect(toastSuccess).toHaveBeenCalledWith(`Split saved. Your part: ${money(50)}.`)
  })

  it('gives the cents left by a division to the first person, like the server', async () => {
    server().addTransaction({ id: 't-odd', description: 'Odd bill', amount: 10, date: '2026-10-04' })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={client}>
        <DivideTransactionDialog open onClose={onClose} householdId="hh-1" transaction={{ id: 't-odd', description: 'Odd bill', amount: 10 }} />
      </QueryClientProvider>,
    )
    await pick(user, 'Person 1', 'Ana')
    await user.click(screen.getByRole('button', { name: enUS.peopleAddPerson }))
    await pick(user, 'Person 2', 'Bia')
    // 10.00 among me + 2: 3.34 for the first, 3.33 for the second, 3.33 mine
    expect(screen.getByLabelText('Part 1').textContent).toBe(money(3.34))
    expect(screen.getByLabelText('Part 2').textContent).toBe(money(3.33))
  })

  it('refuses parts above the transaction amount, naming both amounts, and does not allow saving', async () => {
    const { user } = mount()
    await user.selectOptions(await screen.findByLabelText(enUS.peopleDivideHow), enUS.peopleStrategyExact)
    await pick(user, 'Person 1', 'Ana')
    await user.type(screen.getByLabelText('Amount of Ana'), '60')
    await user.click(screen.getByRole('button', { name: enUS.peopleAddPerson }))
    await pick(user, 'Person 2', 'Bia')
    await user.type(screen.getByLabelText('Amount of Bia'), '50')

    expect((await screen.findAllByRole('alert')).map((a) => a.textContent)).toContain(`The parts add up to ${money(110)}, more than the transaction amount (${money(100)}).`)
    expect((screen.getByRole('button', { name: enUS.peopleSaveSplit }) as HTMLButtonElement).disabled).toBe(true)
    expect(puts()).toHaveLength(0)
  })

  it('switching the strategy keeps the computed parts as the exact amounts', async () => {
    const { user } = mount()
    await pick(user, 'Person 1', 'Ana')
    await user.selectOptions(screen.getByLabelText(enUS.peopleDivideHow), enUS.peopleStrategyExact)
    expect((screen.getByLabelText('Amount of Ana') as HTMLInputElement).value).toBe('50,00')
  })

  it('shows a row error until a person is chosen, and a repeated person is refused', async () => {
    const { user } = mount()
    await screen.findByLabelText('Person 1')
    expect((await screen.findByRole('alert')).textContent).toBe(enUS.peopleErrRowNoPerson)
    await pick(user, 'Person 1', 'Ana')
    await user.click(screen.getByRole('button', { name: enUS.peopleAddPerson }))
    // Ana is no longer offered in the second row
    const second = screen.getByLabelText('Person 2') as HTMLSelectElement
    expect([...second.options].map((o) => o.text)).not.toContain('Ana')
  })

  it('a server check that fails shows its message; a failed save keeps the dialog open', async () => {
    const { user } = mount()
    await pick(user, 'Person 1', 'Ana')
    server().failNext((m, u) => m === 'POST' && u.endsWith('/shares/preview'), new HttpError(500, 'Preview is down'))
    await user.click(screen.getByRole('button', { name: enUS.peopleCheckAction }))
    expect((await screen.findByRole('status')).textContent).toBe('Preview is down')

    server().failNext((m) => m === 'PUT', new HttpError(500, 'Cannot save now'))
    await user.click(screen.getByRole('button', { name: enUS.peopleSaveSplit }))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Cannot save now'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('a server check that agrees says so', async () => {
    const { user } = mount()
    await pick(user, 'Person 1', 'Ana')
    await user.click(screen.getByRole('button', { name: enUS.peopleCheckAction }))
    expect((await screen.findByRole('status')).textContent).toBe(enUS.peopleCheckSame)
  })

  it('sends one PUT when Save is pressed twice while the first is in flight', async () => {
    const { user } = mount()
    await pick(user, 'Person 1', 'Ana')
    const gate = server().gate((m) => m === 'PUT')
    await user.click(screen.getByRole('button', { name: enUS.peopleSaveSplit }))
    const busy = screen.getByRole('button', { name: enUS.peopleFormSaving }) as HTMLButtonElement
    expect(busy.disabled).toBe(true)
    await user.click(busy)
    gate.ok()
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(puts()).toHaveLength(1)
  })

  it('sends one PUT when two clicks land before the screen redraws', async () => {
    const { user } = mount()
    await pick(user, 'Person 1', 'Ana')
    const button = screen.getByRole('button', { name: enUS.peopleSaveSplit })
    // Native clicks: React has not re-rendered the disabled button between them
    button.click()
    button.click()
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(puts()).toHaveLength(1)
  })

  it('forgets the server check as soon as the division changes', async () => {
    const { user } = mount()
    await pick(user, 'Person 1', 'Ana')
    await user.click(screen.getByRole('button', { name: enUS.peopleCheckAction }))
    expect((await screen.findByRole('status')).textContent).toBe(enUS.peopleCheckSame)
    await user.selectOptions(screen.getByLabelText(enUS.peopleDivideHow), enUS.peopleStrategyExact)
    await user.clear(screen.getByLabelText('Amount of Ana'))
    await user.type(screen.getByLabelText('Amount of Ana'), '40')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('opens on the stored split, edits one direction only and keeps the other one', async () => {
    server().addShare(TX.id, ANA.id, 30)
    server().addShare(TX.id, BIA.id, 10, 'I_OWE_THEM')
    const { user } = mount()
    expect(((await screen.findByLabelText('Person 1')) as HTMLSelectElement).value).toBe('p-ana')
    expect((screen.getByLabelText('Amount of Ana') as HTMLInputElement).value).toBe('30,00')
    expect(screen.getByText(`This transaction also has 1 share in the other direction (Bia ${money(10)}): it does not change here.`)).toBeTruthy()

    await user.clear(screen.getByLabelText('Amount of Ana'))
    await user.type(screen.getByLabelText('Amount of Ana'), '35')
    await user.click(screen.getByRole('button', { name: enUS.peopleSaveSplit }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(puts()).toHaveLength(1)
    expect(puts()[0]!.payload).toMatchObject({ direction: 'THEY_OWE_ME', strategy: 'exact', entries: [{ personId: 'p-ana', amount: 35 }] })
    // the other direction was not touched
    expect(server().state.shares.filter((s) => s.direction === 'I_OWE_THEM')).toHaveLength(1)
  })

  it('removing the last person of a direction clears just that direction', async () => {
    server().addShare(TX.id, ANA.id, 30)
    const { user } = mount()
    await screen.findByLabelText('Person 1')
    await user.click(screen.getByRole('button', { name: 'Remove person 1' }))
    await user.click(screen.getByRole('button', { name: enUS.peopleRemoveShares }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(puts()[0]!.payload).toEqual({ direction: 'THEY_OWE_ME', strategy: 'exact', entries: [] })
    expect(toastSuccess).toHaveBeenCalledWith(enUS.peopleSplitRemoved)
  })

  it('clears the split of both directions after a confirmation', async () => {
    server().addShare(TX.id, ANA.id, 30)
    server().addShare(TX.id, BIA.id, 10, 'I_OWE_THEM')
    const { user } = mount()
    await screen.findByLabelText('Person 1')
    await user.click(screen.getByRole('button', { name: enUS.peopleClearAction }))
    const confirm = await screen.findByRole('alertdialog', { name: enUS.peopleClearConfirmAria })
    expect(puts()).toHaveLength(0)
    await user.click(within(confirm).getByRole('button', { name: enUS.peopleRemove }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(puts().map((c) => (c.payload as { direction: string }).direction).sort()).toEqual(['I_OWE_THEM', 'THEY_OWE_ME'])
    expect(server().state.shares).toHaveLength(0)
  })

  it('creates a person from the dialog and selects them in the row', async () => {
    const { user } = mount()
    await pick(user, 'Person 1', enUS.peopleNewPersonOption)
    const form = await screen.findByRole('dialog', { name: enUS.peopleNew })
    await user.type(within(form).getByLabelText(enUS.name), 'Caio')
    await user.click(within(form).getByRole('button', { name: enUS.save }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: enUS.peopleNew })).toBeNull())
    const select = (await screen.findByLabelText('Person 1')) as HTMLSelectElement
    expect(select.selectedOptions[0]!.text).toBe('Caio')
    expect(screen.getByLabelText('Part 1').textContent).toBe(money(50))
  })

  it('offers a retry when the stored split cannot be loaded', async () => {
    server().failNext((m, u) => m === 'GET' && u.endsWith('/shares'), new HttpError(500, 'Shares exploded'))
    const { user } = mount()
    expect((await screen.findByRole('alert')).textContent).toBe('Shares exploded')
    await user.click(screen.getByRole('button', { name: enUS.peopleRetry }))
    expect(await screen.findByLabelText('Person 1')).toBeTruthy()
  })
})
