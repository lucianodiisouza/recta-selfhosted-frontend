import enUS from './en-US.json';

/**
 * A locale file with the en-US texts under it: a key the locale does not define renders in English instead of empty
 * (and code that formats the text never receives undefined).
 */
export function withEnglishFallback(own: object): Record<string, string> {
  return { ...enUS, ...own };
}
