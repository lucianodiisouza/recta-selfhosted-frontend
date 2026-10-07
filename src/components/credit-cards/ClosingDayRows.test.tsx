// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClosingDayRows } from './ClosingDayRows'

// The keys themselves are the labels here.
vi.mock('../../context/I18nContext', () => ({
  useI18n: () => ({ t: new Proxy({}, { get: (_target, key) => String(key) }) }),
}))

afterEach(cleanup)

// Each row is a label followed by its value, so the row text is label + value.
const rowText = (label: string) => screen.getByText(label).closest('.justify-between')!.textContent

describe('ClosingDayRows', () => {
  it('shows the derived closing day as closing day and best day for a card with only a due day', () => {
    render(<ClosingDayRows account={{ dueDay: 9 }} />)

    expect(rowText('closingDay')).toBe('closingDay2')
    expect(rowText('bestDayToBuy')).toBe('bestDayToBuy2')
  })

  it('shows the stored closing day when there is one', () => {
    render(<ClosingDayRows account={{ dueDay: 9, closingDay: 20 }} />)

    expect(rowText('closingDay')).toBe('closingDay20')
    expect(rowText('bestDayToBuy')).toBe('bestDayToBuy20')
  })

  it('renders nothing for a card with neither day', () => {
    const { container } = render(<ClosingDayRows account={{}} />)

    expect(container.innerHTML).toBe('')
  })
})
