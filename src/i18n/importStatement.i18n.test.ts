import { describe, expect, it } from 'vitest'
import arSA from './ar-SA.json'
import enUS from './en-US.json'
import esES from './es-ES.json'
import frFR from './fr-FR.json'
import jaJP from './ja-JP.json'
import ptBR from './pt-BR.json'
import ruRU from './ru-RU.json'
import zhCN from './zh-CN.json'

const locales: Record<string, Record<string, string>> = {
  'ar-SA': arSA,
  'en-US': enUS,
  'es-ES': esES,
  'fr-FR': frFR,
  'ja-JP': jaJP,
  'pt-BR': ptBR,
  'ru-RU': ruRU,
  'zh-CN': zhCN,
}

const keys = Object.keys(enUS).filter((key) => key.startsWith('importStatement'))
const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort()

// The app has no fallback to en-US: a key missing from a locale renders as undefined, so every locale must carry them all.
describe('statement import translations', () => {
  it('defines the keys', () => {
    expect(keys.length).toBeGreaterThan(0)
  })

  it.each(Object.keys(locales))('%s has every key, non-empty, with the same placeholders as en-US', (locale) => {
    for (const key of keys) {
      const text = locales[locale][key]
      expect(typeof text, `${locale}.${key}`).toBe('string')
      expect(text.trim(), `${locale}.${key}`).not.toBe('')
      expect(placeholders(text), `${locale}.${key}`).toEqual(placeholders((enUS as Record<string, string>)[key]))
    }
  })
})
