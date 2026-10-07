// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import enUS from '../i18n/en-US.json'
import AdjustBalanceDialog from './accounts/AdjustBalanceDialog'
import { AccountActionsMenu } from './AccountActionsMenu'

// The real menu (Radix popover) opening the real dialog: the menu item that was clicked unmounts together with the
// popover, so the dialog has to give focus back to something that is still there.
vi.mock('../utils/api', () => ({ apiClient: { post: vi.fn() } }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ currentUser: null }) }))
vi.mock('../context/I18nContext', () => ({ useI18n: () => ({ t: enUS, locale: 'en-US' }) }))
vi.mock('../context/CurrencyContext', () => {
  const USD = { code: 'USD', name: 'US Dollar', symbol: '$', locale: 'en-US', decimalPlaces: 2 }
  return { CURRENCIES: { USD }, DEFAULT_CURRENCY: 'USD', useCurrency: () => ({ baseCurrency: 'USD' }) }
})
vi.mock('../context/ToastContext', () => ({
  useToastContext: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
}))

const ACCOUNT = { id: 'acc-1', name: 'Test Checking' } as never

// Wired like pages/Accounts.tsx: the menu callback opens the dialog.
function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <QueryClientProvider client={new QueryClient()}>
      <AccountActionsMenu account={ACCOUNT} onEdit={() => {}} onDelete={() => {}} onAdjustBalance={() => setOpen(true)} />
      <AdjustBalanceDialog open={open} onClose={() => setOpen(false)} accountId="acc-1" accountName="Test Checking" currentBalance={10} />
    </QueryClientProvider>
  )
}

afterEach(cleanup)

describe('AccountActionsMenu + AdjustBalanceDialog', () => {
  it('opens the dialog with focus inside it and gives focus back to the "more options" button when it closes', async () => {
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: enUS.moreOptions })
    fireEvent.click(trigger)
    fireEvent.click(await screen.findByRole('button', { name: enUS.adjustBalanceAction }))
    const dialog = await screen.findByRole('dialog')
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)) })
    expect(dialog.contains(document.activeElement)).toBe(true)
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })
})
