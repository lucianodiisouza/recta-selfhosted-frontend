import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import enUS from './en-US.json'
import ptBR from './pt-BR.json'

const en = enUS as Record<string, string>
const pt = ptBR as Record<string, string>
const isPeopleKey = (key: string) => /^people[A-Z]/.test(key)
const keys = Object.keys(en).filter(isPeopleKey)
const placeholders = (text: string) => (text.match(/\{\{\w+\}\}/g) ?? []).sort()

// The people screens are the only code that uses these keys: pt-BR and en-US carry all of them; the other six
// languages get the en-US text from the English fallback (a separate change of the series).
const SOURCES = ['../pages/People.tsx', '../hooks/api/usePeople.ts', '../utils/people.ts', '../utils/shares.ts', '../utils/settlements.ts', '../components/TransactionActionsMenu.tsx']
  .map((path) => new URL(path, import.meta.url))
  .concat(readdirSync(new URL('../components/people/', import.meta.url)).filter((f) => /\.tsx?$/.test(f)).map((f) => new URL(`../components/people/${f}`, import.meta.url)))
const sourceText = SOURCES.map((url) => readFileSync(url, 'utf8')).join('\n')
// The menu is an existing file with Portuguese fallbacks of its own; only what the people screens added is checked for text
const ownSourceText = SOURCES.filter((url) => !url.pathname.endsWith('TransactionActionsMenu.tsx'))
  .map((url) => readFileSync(url, 'utf8'))
  .join('\n')

describe('people translations', () => {
  it('defines the keys', () => {
    expect(keys.length).toBeGreaterThan(0)
  })

  it('pt-BR has every key, non-empty, with the same placeholders as en-US', () => {
    for (const key of keys) {
      expect(typeof pt[key], `pt-BR.${key}`).toBe('string')
      expect(pt[key]!.trim(), `pt-BR.${key}`).not.toBe('')
      expect(placeholders(pt[key]!), `pt-BR.${key}`).toEqual(placeholders(en[key]!))
    }
  })

  it('pt-BR has no people key en-US lacks', () => {
    expect(Object.keys(pt).filter((key) => isPeopleKey(key) && !(key in en))).toEqual([])
  })

  it('the screens use only keys that exist, and every key is used', () => {
    const used = new Set([...sourceText.matchAll(/\bt\.(people\w+)/g)].map((m) => m[1]!))
    // Keys the code names without `t.` (a lookup by code) would be listed here; there are none.
    expect([...used].filter((key) => !(key in en))).toEqual([])
    expect(keys.filter((key) => !used.has(key))).toEqual([])
  })

  it('has no Portuguese text written into the screens', () => {
    // Comments aside, accented letters in the source mean text that bypassed the translations.
    const code = ownSourceText.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(code.match(/[À-ÿ]/g) ?? []).toEqual([])
  })
})
