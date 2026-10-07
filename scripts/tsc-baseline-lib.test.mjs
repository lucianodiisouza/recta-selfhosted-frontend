import { describe, expect, it } from 'vitest'
import { growth, parseBaseline } from './tsc-baseline-lib.mjs'

const base = parseBaseline('# header\na.ts: TS1: x\na.ts: TS1: x\nb.ts: TS2: y\n')

describe('parseBaseline', () => {
  it('ignores comments and blank lines and counts repeated keys', () => {
    expect(base.get('a.ts: TS1: x')).toBe(2)
    expect(base.get('b.ts: TS2: y')).toBe(1)
    expect(base.size).toBe(2)
  })
})

describe('growth', () => {
  it('is empty when the new baseline only removes entries', () => {
    expect(growth(base, parseBaseline('a.ts: TS1: x\n'))).toEqual([])
  })

  it('reports a brand-new key', () => {
    expect(growth(base, parseBaseline('a.ts: TS1: x\na.ts: TS1: x\nc.ts: TS3: z\n'))).toEqual([
      ['c.ts: TS3: z', 1],
    ])
  })

  it('reports an extra occurrence of an existing key', () => {
    expect(growth(base, parseBaseline('b.ts: TS2: y\nb.ts: TS2: y\n'))).toEqual([['b.ts: TS2: y', 1]])
  })
})
