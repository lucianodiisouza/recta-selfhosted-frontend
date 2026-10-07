// Pure helpers shared by check-tsc-baseline.mjs and its tests.

/** Parses baseline text into a Map of key -> number of occurrences. */
export function parseBaseline(text) {
  const map = new Map()
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    map.set(line, (map.get(line) ?? 0) + 1)
  }
  return map
}

/** Entries of `next` that occur more often than in `base`, as [key, extraCount]. */
export function growth(base, next) {
  const grown = []
  for (const [key, count] of next) {
    const extra = count - (base.get(key) ?? 0)
    if (extra > 0) grown.push([key, extra])
  }
  return grown
}
