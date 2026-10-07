import { describe, expect, it } from 'vitest';
import enUS from './en-US.json';
import ptBR from './pt-BR.json';

// Every `category*` text, the older ones included: pt-BR must carry each of them with the same placeholders.
const keys = Object.keys(enUS).filter((key) => key.startsWith('category'));
const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();

describe('category translations', () => {
  it('defines the keys', () => {
    expect(keys.length).toBeGreaterThan(40);
  });

  it('has every key in pt-BR, non-empty, with the same placeholders as en-US', () => {
    for (const key of keys) {
      const text = (ptBR as Record<string, string>)[key];
      expect(typeof text, `pt-BR.${key}`).toBe('string');
      expect(text.trim(), `pt-BR.${key}`).not.toBe('');
      expect(placeholders(text), `pt-BR.${key}`).toEqual(placeholders((enUS as Record<string, string>)[key]));
    }
  });
});
