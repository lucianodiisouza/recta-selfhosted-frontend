// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import enUS from '../../i18n/en-US.json'
import type { Person } from '../../hooks/api/usePeople'
import PersonFormDialog from './PersonFormDialog'

const mutations = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }))

vi.mock('../../hooks/api/usePeople', () => ({
  usePeople: () => ({ data: [] }),
  useCreatePerson: () => ({ mutateAsync: mutations.create }),
  useUpdatePerson: () => ({ mutateAsync: mutations.update }),
}))
vi.mock('../../context/ToastContext', () => ({ useToastContext: () => ({ success: vi.fn(), error: vi.fn() }) }))
vi.mock('../../context/I18nContext', () => ({ useI18n: () => ({ t: enUS }) }))

const ANA: Person = { id: 'p-ana', householdId: 'hh-1', name: 'Ana', aliases: ['Aninha'], userId: null, isActive: true }

function mount(person: Person | null) {
  const client = new QueryClient()
  const ui = (current: Person | null) => (
    <QueryClientProvider client={client}>
      <PersonFormDialog open onClose={vi.fn()} householdId="hh-1" person={current} />
    </QueryClientProvider>
  )
  const utils = render(ui(person))
  return { ...utils, rerenderWith: (current: Person | null) => utils.rerender(ui(current)) }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('PersonFormDialog', () => {
  it('seeds the fields from the person being edited', () => {
    mount(ANA)
    expect((screen.getByLabelText(enUS.name) as HTMLInputElement).value).toBe('Ana')
    expect((screen.getByLabelText(enUS.peopleFormAliases) as HTMLInputElement).value).toBe('Aninha')
    expect((screen.getByLabelText(enUS.peopleFormActive) as HTMLInputElement).checked).toBe(true)
  })

  it('keeps what the user is typing when the same person arrives again as a new object (a refetch)', async () => {
    const user = userEvent.setup()
    const { rerenderWith } = mount(ANA)
    await user.type(screen.getByLabelText(enUS.peopleFormAliases), ', Nana')
    rerenderWith({ ...ANA })
    expect((screen.getByLabelText(enUS.peopleFormAliases) as HTMLInputElement).value).toBe('Aninha, Nana')
  })

  it('seeds again when another person is edited', () => {
    const { rerenderWith } = mount(ANA)
    rerenderWith({ ...ANA, id: 'p-bia', name: 'Bia', aliases: [] })
    expect((screen.getByLabelText(enUS.name) as HTMLInputElement).value).toBe('Bia')
    expect((screen.getByLabelText(enUS.peopleFormAliases) as HTMLInputElement).value).toBe('')
  })

  it('keeps Tab and Shift+Tab inside the dialog, wrapping around at both ends', async () => {
    const user = userEvent.setup()
    mount(ANA)
    const dialog = screen.getByRole('dialog')
    const tabbable = Array.from(dialog.querySelectorAll<HTMLElement>('button, input, select, textarea')).filter((el) => !(el as HTMLButtonElement).disabled)
    const first = tabbable[0]!
    const last = tabbable[tabbable.length - 1]!
    expect(dialog.contains(document.activeElement)).toBe(true)

    last.focus()
    await user.tab()
    expect(document.activeElement).toBe(first)
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(last)
    // a focus that escaped to the page behind is brought back
    ;(document.activeElement as HTMLElement).blur()
    await user.tab()
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('does not offer the active flag when creating', () => {
    mount(null)
    expect(screen.queryByLabelText(enUS.peopleFormActive)).toBeNull()
  })

  it('shows the message of a failed save and lets the user try again', async () => {
    const user = userEvent.setup()
    mutations.create.mockRejectedValueOnce(new Error('Server says no'))
    mount(null)
    await user.type(screen.getByLabelText(enUS.name), 'Zeca')
    await user.click(screen.getByRole('button', { name: enUS.save }))
    expect((await screen.findByRole('alert')).textContent).toBe('Server says no')
    mutations.create.mockResolvedValueOnce({ id: 'new', name: 'Zeca' })
    await user.click(screen.getByRole('button', { name: enUS.save }))
    await waitFor(() => expect(mutations.create).toHaveBeenCalledTimes(2))
    expect(mutations.create).toHaveBeenLastCalledWith({ householdId: 'hh-1', name: 'Zeca', aliases: [] })
  })
})
