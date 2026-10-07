import { describe, expect, it } from 'vitest'
import type { LedgerEntry, Person, PersonBalance } from '../hooks/api/usePeople'
import {
  MAX_ALIASES,
  MAX_PERSON_NAME,
  balanceStatus,
  canWritePeople,
  cleanAliases,
  fillText,
  isPeopleRouteMissing,
  ledgerKind,
  mergePeopleRows,
  normalizeName,
  parseAliasText,
  personSaveFailure,
  reaisToCents,
  summarizeBalances,
  validatePersonForm,
} from './people'

// Invented names and amounts only.

const person = (id: string, name: string, over: Partial<Person> = {}): Person => ({
  id, householdId: 'hh-1', name, aliases: [], userId: null, isActive: true, ...over,
})
const balanceOf = (p: Person, balance: number): PersonBalance => ({
  person: p, owedToMe: Math.max(balance, 0), iOwe: Math.max(-balance, 0), received: 0, paid: 0, balance, openShares: 1,
})

describe('reaisToCents', () => {
  it('does not drift on two-decimal values', () => {
    for (const reais of [0.07, 0.1, 0.29, 1.15, 19.99, 100.01, 1234.56, 123456789.57]) {
      expect(reaisToCents(reais)).toBe(Math.round(reais * 100))
    }
    expect(reaisToCents(-0.1)).toBe(-10)
    expect(reaisToCents(NaN)).toBe(0)
  })
})

describe('balanceStatus', () => {
  it('lets cents decide the sign, not floats', () => {
    expect(balanceStatus(10)).toEqual({ kind: 'owes-me', cents: 1000 })
    expect(balanceStatus(-0.01)).toEqual({ kind: 'i-owe', cents: 1 })
    expect(balanceStatus(0)).toEqual({ kind: 'settled', cents: 0 })
    // 0.1 + 0.2 - 0.3 is 5.5e-17 in doubles: still settled
    expect(balanceStatus(0.1 + 0.2 - 0.3)).toEqual({ kind: 'settled', cents: 0 })
  })
})

describe('summarizeBalances', () => {
  it('adds what people owe me, what I owe and the net in exact cents', () => {
    const summary = summarizeBalances([{ balance: 10.1 }, { balance: 0.2 }, { balance: -3.3 }, { balance: -0.07 }, { balance: 0 }])
    expect(summary).toEqual({ owedToMeCents: 1030, iOweCents: 337, netCents: 693 })
  })

  it('is all zero without people', () => {
    expect(summarizeBalances([])).toEqual({ owedToMeCents: 0, iOweCents: 0, netCents: 0 })
  })
})

describe('mergePeopleRows', () => {
  const ana = person('a', 'Ana')
  const bia = person('b', 'Bia')
  const caio = person('c', 'Caio', { isActive: false })
  const dora = person('d', 'Dora', { isActive: false })

  it('lists the people with a balance entry, active first and then by name', () => {
    const rows = mergePeopleRows([balanceOf(bia, 5), balanceOf(ana, -2)], [ana, bia], false)
    expect(rows.map((r) => r.person.name)).toEqual(['Ana', 'Bia'])
    expect(rows[0]).toMatchObject({ balanceCents: -200 })
  })

  it('adds the people the balances endpoint leaves out only when inactive people are shown', () => {
    expect(mergePeopleRows([balanceOf(ana, 1)], [ana, caio], false).map((r) => r.person.id)).toEqual(['a'])
    const shown = mergePeopleRows([balanceOf(ana, 1)], [ana, caio, dora], true)
    expect(shown.map((r) => r.person.id)).toEqual(['a', 'c', 'd'])
    expect(shown[1]!.balance).toBeNull()
  })

  it('keeps an inactive person that still has a balance, below the active ones', () => {
    const rows = mergePeopleRows([balanceOf(caio, 7), balanceOf(ana, 1)], [], false)
    expect(rows.map((r) => r.person.id)).toEqual(['a', 'c'])
  })

  it('hides an inactive person whose balance is zero unless asked', () => {
    expect(mergePeopleRows([balanceOf(caio, 0)], [], false)).toEqual([])
    expect(mergePeopleRows([balanceOf(caio, 0)], [], true)).toHaveLength(1)
  })
})

describe('ledgerKind', () => {
  const entry = (kind: LedgerEntry['kind'], direction: LedgerEntry['direction']) => ({ kind, direction })
  it('follows the direction of the share or the settlement', () => {
    expect(ledgerKind(entry('share', 'THEY_OWE_ME'))).toBe('their-share')
    expect(ledgerKind(entry('share', 'I_OWE_THEM'))).toBe('my-share')
    expect(ledgerKind(entry('settlement', 'RECEIVED'))).toBe('received')
    expect(ledgerKind(entry('settlement', 'PAID'))).toBe('paid')
  })
})

describe('canWritePeople', () => {
  it('refuses a viewer and an unknown household; owner and editor can write', () => {
    expect(canWritePeople(null)).toBe(false)
    expect(canWritePeople(undefined)).toBe(false)
    expect(canWritePeople({ role: 'VIEWER' })).toBe(false)
    expect(canWritePeople({ role: 'EDITOR' })).toBe(true)
    expect(canWritePeople({ role: 'OWNER' })).toBe(true)
  })
})

describe('isPeopleRouteMissing', () => {
  it('recognises the framework 404/405 of a server without the routes (no application code)', () => {
    expect(isPeopleRouteMissing(Object.assign(new Error('HTTP 404'), { status: 404 }))).toBe(true)
    expect(isPeopleRouteMissing(Object.assign(new Error('HTTP 405'), { status: 405 }))).toBe(true)
  })

  it('does not hide a missing person, or any other failure, behind it', () => {
    expect(isPeopleRouteMissing(Object.assign(new Error('Person not found'), { status: 404, code: 'NOT_FOUND' }))).toBe(false)
    expect(isPeopleRouteMissing(Object.assign(new Error('boom'), { status: 500 }))).toBe(false)
    expect(isPeopleRouteMissing(new Error('Network error'))).toBe(false)
    expect(isPeopleRouteMissing(null)).toBe(false)
    expect(isPeopleRouteMissing(undefined)).toBe(false)
  })
})

describe('fillText', () => {
  it('fills every placeholder, repeated ones included, and leaves unknown ones as written', () => {
    expect(fillText('{{name}} owes {{amount}} ({{name}})', { name: 'Ana', amount: 'R$ 10,00' })).toBe('Ana owes R$ 10,00 (Ana)')
    expect(fillText('{{count}} items', { count: 3 })).toBe('3 items')
    expect(fillText('{{known}} {{unknown}}', { known: 'x' })).toBe('x {{unknown}}')
  })

  it('does not interpret the replacement as a pattern', () => {
    expect(fillText('{{name}}', { name: '$& $1 {{name}}' })).toBe('$& $1 {{name}}')
  })
})

describe('aliases', () => {
  it('parses a comma or semicolon separated list, trimmed', () => {
    expect(parseAliasText(' Aninha ,Nana;  ; Ani ')).toEqual(['Aninha', 'Nana', 'Ani'])
    expect(parseAliasText('')).toEqual([])
  })

  it('drops repeats the way the server normalizes (case, accents) and the name itself', () => {
    expect(cleanAliases('José', ['jose', 'Zé', 'ZE', 'Zézinho', ' '])).toEqual(['Zé', 'Zézinho'])
  })

  it('normalizes names like the server', () => {
    expect(normalizeName('  Édna   da  Silva ')).toBe('edna da silva')
  })
})

describe('validatePersonForm', () => {
  const others = [person('a', 'Ana', { aliases: ['Aninha'] }), person('b', 'Bia')]

  it('needs a name', () => {
    expect(validatePersonForm('   ', [], others, null)).toEqual({ ok: false, error: { code: 'name-required' } })
  })

  it('accepts a free name and free aliases', () => {
    expect(validatePersonForm('Caio', ['Cacá'], others, null)).toEqual({ ok: true })
  })

  it('refuses the name or alias of ANOTHER person, naming it', () => {
    expect(validatePersonForm('ANA', [], others, null)).toEqual({ ok: false, error: { code: 'name-taken', label: 'ANA', owner: 'Ana' } })
    expect(validatePersonForm('Caio', ['aninha'], others, null)).toEqual({ ok: false, error: { code: 'name-taken', label: 'aninha', owner: 'Ana' } })
  })

  it('does not count the person being edited as another person', () => {
    expect(validatePersonForm('Ana', ['Aninha', 'Nana'], others, 'a')).toEqual({ ok: true })
  })

  it('applies the server limits: name and alias length, number of aliases', () => {
    expect(validatePersonForm('x'.repeat(MAX_PERSON_NAME + 1), [], [], null)).toEqual({ ok: false, error: { code: 'name-too-long', max: MAX_PERSON_NAME } })
    expect(validatePersonForm('x'.repeat(MAX_PERSON_NAME), [], [], null)).toEqual({ ok: true })
    const many = Array.from({ length: MAX_ALIASES + 1 }, (_, i) => `apelido ${i}`)
    expect(validatePersonForm('Caio', many, [], null)).toEqual({ ok: false, error: { code: 'too-many-aliases', max: MAX_ALIASES } })
    expect(validatePersonForm('Caio', many.slice(0, MAX_ALIASES), [], null)).toEqual({ ok: true })
    expect(validatePersonForm('Caio', ['y'.repeat(MAX_PERSON_NAME + 1)], [], null)).toEqual({ ok: false, error: { code: 'alias-too-long', max: MAX_PERSON_NAME } })
  })
})

describe('personSaveFailure', () => {
  it('reads a 409 as a taken name or alias, any other error by its message', () => {
    expect(personSaveFailure(Object.assign(new Error('x'), { status: 409 }))).toEqual({ code: 'conflict' })
    expect(personSaveFailure(new Error('Server says no'))).toEqual({ code: 'message', message: 'Server says no' })
    expect(personSaveFailure(new Error(''))).toEqual({ code: 'unknown' })
    expect(personSaveFailure('nope')).toEqual({ code: 'unknown' })
    expect(personSaveFailure(null)).toEqual({ code: 'unknown' })
  })
})
