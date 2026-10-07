import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import arSA from './ar-SA.json';
import enUS from './en-US.json';
import esES from './es-ES.json';
import frFR from './fr-FR.json';
import jaJP from './ja-JP.json';
import ptBR from './pt-BR.json';
import ruRU from './ru-RU.json';
import zhCN from './zh-CN.json';
import { I18nProvider, useI18n } from '../context/I18nContext';
import type { Locale, Translations } from '../context/I18nContext';

// The provider is rendered for real (react-dom/server, no DOM needed) and read through useI18n; only the account it looks up
// for a saved preference is replaced.
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ currentUser: null }) }));
vi.mock('../hooks/api/useUsers', () => ({
  useUser: () => ({ data: undefined, isLoading: false }),
  useUpdateUserPreferences: () => ({ mutate: vi.fn() }),
}));

const FILES: Record<Locale, Record<string, string>> = {
  'pt-BR': ptBR, 'en-US': enUS, 'es-ES': esES, 'fr-FR': frFR, 'ru-RU': ruRU, 'ja-JP': jaJP, 'zh-CN': zhCN, 'ar-SA': arSA,
};
const en = enUS as Record<string, string>;

function textsFor(locale: Locale): Translations {
  vi.stubGlobal('localStorage', { getItem: (key: string) => (key === 'locale' ? locale : null), setItem: () => undefined });
  let captured: Translations | null = null;
  const Probe = () => {
    captured = useI18n().t;
    return null;
  };
  renderToString(<I18nProvider><Probe /></I18nProvider>);
  return captured as unknown as Translations;
}

afterEach(() => vi.unstubAllGlobals());

describe('texts a language does not define fall back to English', () => {
  const partial = (['es-ES', 'fr-FR', 'ru-RU', 'ja-JP', 'zh-CN', 'ar-SA'] as const).map((locale) => {
    const missing = Object.keys(en).filter((key) => !(key in FILES[locale]));
    return { locale, missing };
  });

  it('really has languages with missing keys (the premise of the fallback)', () => {
    for (const { locale, missing } of partial) expect(missing.length, locale).toBeGreaterThan(0);
  });

  it.each(partial)('$locale: every key it lacks reads as the English text, through useI18n', ({ locale, missing }) => {
    const t = textsFor(locale) as unknown as Record<string, string>;
    for (const key of missing) expect(t[key], `${locale}.${key}`).toBe(en[key]);
  });

  it.each(partial)('$locale: the keys it defines keep its own text', ({ locale }) => {
    const t = textsFor(locale) as unknown as Record<string, string>;
    const own = FILES[locale];
    for (const key of Object.keys(own).filter((k) => k in en)) expect(t[key], `${locale}.${key}`).toBe(own[key]);
  });

  it.each(['ru-RU', 'ja-JP', 'zh-CN', 'ar-SA'] as const)('%s: the two texts the monthly recap calls string methods on are strings', (locale) => {
    const t = textsFor(locale) as unknown as Record<string, unknown>;
    // MonthlyRecapModal calls .includes/.replace/.trim on these: undefined used to throw a TypeError.
    expect(typeof t.monthlyRecapTitle).toBe('string');
    expect(typeof t.monthlyRecapQuizCorrect).toBe('string');
  });

  it('leaves pt-BR and en-US exactly as their files', () => {
    expect(textsFor('pt-BR')).toEqual(ptBR);
    expect(textsFor('en-US')).toEqual(enUS);
  });
});
