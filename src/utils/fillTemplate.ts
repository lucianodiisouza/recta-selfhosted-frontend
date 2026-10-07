/**
 * Fills the {name} placeholders of a translated text. Every occurrence of a placeholder is replaced and values are
 * inserted literally (a "$" in a value is not a replacement pattern). A placeholder with no value is left as is.
 */
export function fillTemplate(text: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((acc, [key, value]) => acc.split(`{${key}}`).join(String(value)), text);
}
