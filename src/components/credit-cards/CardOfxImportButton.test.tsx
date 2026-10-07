// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { markCardOfxMissing, resetCardOfxMissing } from '../../utils/cardOfx'
import enUS from '../../i18n/en-US.json'
import CardOfxImportButton from './CardOfxImportButton'

vi.mock('../../context/I18nContext', () => ({ useI18n: () => ({ t: enUS }) }))
// The dialog has its own tests; here it only has to appear for the right card.
vi.mock('../ImportCardOfxDialog', () => ({
  default: ({ account, onClose }: { account: { id: string; name: string }; onClose: () => void }) => (
    <div role="dialog" aria-label={`dialog for ${account.id}`}>
      <button onClick={onClose}>close dialog</button>
    </div>
  ),
}))

const CARD = { id: 'card-1', name: 'Everyday card' }
const button = () => screen.queryByRole('button', { name: enUS.cardOfxButtonLabel })

afterEach(() => {
  resetCardOfxMissing()
  cleanup()
})

describe('CardOfxImportButton', () => {
  it('opens the invoice preview of its card and closes it again', async () => {
    const user = userEvent.setup()
    render(<CardOfxImportButton account={CARD} />)
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(button()!)
    expect(screen.getByRole('dialog', { name: 'dialog for card-1' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'close dialog' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('disappears for the session once the server is known to have no importer', () => {
    render(<CardOfxImportButton account={CARD} />)
    expect(button()).not.toBeNull()

    act(() => markCardOfxMissing())

    expect(button()).toBeNull()
  })

  it('is not drawn at all when the server is already known to lack it', () => {
    markCardOfxMissing()
    render(<CardOfxImportButton account={CARD} />)

    expect(button()).toBeNull()
  })
})
