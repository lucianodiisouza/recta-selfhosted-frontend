// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CreditCardFormFields } from './CreditCardFormFields'

// The component only reads labels from the i18n context; the keys themselves are the labels here.
vi.mock('../../context/I18nContext', () => ({
  useI18n: () => ({ t: new Proxy({}, { get: (_target, key) => String(key) }) }),
}))

type FormValues = { name: string; dueDay?: number; closingDay?: number }

let lastValues: () => FormValues = () => ({ name: '' })

function Harness({ defaults = {} }: { defaults?: Partial<FormValues> }) {
  const form = useForm<FormValues>({ defaultValues: { name: 'Card', ...defaults } })
  lastValues = form.getValues
  const mask = { value: '', onChange: () => undefined }
  return <CreditCardFormFields form={form} creditLimitMask={mask} setValue={form.setValue} isCreation />
}

const field = (name: string) => document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!
const type = (name: string, value: string) => fireEvent.change(field(name), { target: { value } })

afterEach(cleanup)

describe('CreditCardFormFields closing day', () => {
  it('asks for a single closing day and no best-day offset', () => {
    render(<Harness />)

    expect(field('closingDay')).not.toBeNull()
    expect(field('bestDayOffset')).toBeNull()
    expect(screen.getByText('closingDay')).toBeTruthy()
  })

  it('fills the closing day with due - 7 while the user types the due day', () => {
    render(<Harness />)

    type('dueDay', '9')
    expect(field('closingDay').value).toBe('2')
    type('dueDay', '3')
    expect(field('closingDay').value).toBe('26')
    expect(lastValues().closingDay).toBe(26)
  })

  it('keeps a closing day the user typed when the due day changes', () => {
    render(<Harness />)

    type('dueDay', '9')
    type('closingDay', '20')
    type('dueDay', '10')

    expect(field('closingDay').value).toBe('20')
  })

  it('does not overwrite the closing day of a saved card on load', () => {
    render(<Harness defaults={{ dueDay: 9, closingDay: 20 }} />)

    expect(field('closingDay').value).toBe('20')
  })
})
