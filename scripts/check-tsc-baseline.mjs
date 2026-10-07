#!/usr/bin/env node
/* eslint-env node */

// "No new errors" gate for `tsc --noEmit`.
//
// The codebase carries type errors that predate this script (see
// tsc-baseline.txt). Fixing them does not belong in a feature PR, but letting
// new ones in silently would make the number meaningless. So this script runs
// tsc, reduces every error to a line-independent key and fails when the run
// has more occurrences of a key than the baseline allows.
//
//   node scripts/check-tsc-baseline.mjs            check (what CI runs)
//   node scripts/check-tsc-baseline.mjs --update   rewrite the baseline; only
//                                                  allowed when nothing grew
//                                                  (the first run creates the file)
//   node scripts/check-tsc-baseline.mjs --against <file>
//                                                  compare tsc-baseline.txt with another copy
//                                                  (the PR base in CI) and fail if it GREW; hand-editing
//                                                  the baseline cannot hide a new error
//
// A key is `file: TSxxxx: message`. Line and column are dropped so that moving
// code around does not look like a new error, and the absolute project path
// that TypeScript embeds in some messages is replaced by <root> so the file
// is identical on every machine.

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { growth, parseBaseline } from './tsc-baseline-lib.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const baselinePath = join(root, 'tsc-baseline.txt')
const update = process.argv.includes('--update')

const againstIdx = process.argv.indexOf('--against')
if (againstIdx !== -1) {
  const otherPath = process.argv[againstIdx + 1]
  if (!otherPath || !existsSync(otherPath)) {
    console.error('--against needs the path of the baseline to compare with')
    process.exit(2)
  }
  const grown = growth(
    parseBaseline(readFileSync(otherPath, 'utf8')),
    parseBaseline(existsSync(baselinePath) ? readFileSync(baselinePath, 'utf8') : ''),
  )
  if (grown.length > 0) {
    console.error('tsc-baseline.txt grew compared with the base; it may only shrink:')
    for (const [key, n] of grown) console.error(`  +${n} ${key}`)
    process.exit(1)
  }
  console.log('tsc-baseline.txt did not grow.')
  process.exit(0)
}

const tscBin = join(root, 'node_modules', 'typescript', 'bin', 'tsc')
const run = spawnSync(process.execPath, [tscBin, '--noEmit', '--pretty', 'false'], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
})
if (run.error) {
  console.error(`Could not run tsc: ${run.error.message}`)
  process.exit(2)
}

const rootForward = root.split('\\').join('/')
const normalize = (text) => text.split('\\').join('/').split(rootForward).join('<root>')

// Only the first line of each diagnostic: the indented lines that follow are
// elaboration of the same error and would multiply the keys.
const ERROR_LINE = /^(.+?)\(\d+,\d+\): error (TS\d+): (.*)$/
const current = new Map()
for (const raw of `${run.stdout}${run.stderr}`.split(/\r?\n/)) {
  const m = ERROR_LINE.exec(raw)
  if (!m) continue
  const key = normalize(`${m[1]}: ${m[2]}: ${m[3]}`)
  current.set(key, (current.get(key) ?? 0) + 1)
}

// tsc exits non-zero both for type errors and for a crash; only the former
// produces diagnostics, so a failure with none means the check cannot be trusted.
if (run.status !== 0 && current.size === 0) {
  console.error('tsc failed without reporting diagnostics:')
  console.error(run.stdout || run.stderr)
  process.exit(2)
}

const readBaseline = () =>
  existsSync(baselinePath) ? parseBaseline(readFileSync(baselinePath, 'utf8')) : new Map()

const total = (entries) => [...entries].reduce((sum, [, n]) => sum + n, 0)

const baseline = readBaseline()
const added = growth(baseline, current)
const fixed = growth(current, baseline)

if (update) {
  // The first run has no baseline to shrink from, so it may create one.
  if (added.length > 0 && existsSync(baselinePath)) {
    console.error('Refusing to update: the baseline may only shrink, but these errors are new:')
    for (const [key, n] of added) console.error(`  +${n} ${key}`)
    process.exit(1)
  }
  const header = [
    '# tsc --noEmit baseline: errors that existed before the "no new errors" gate.',
    '# One line per error: file: TSxxxx: message (no line numbers). It may only shrink.',
    '# Regenerate with: node scripts/check-tsc-baseline.mjs --update',
  ]
  const body = [...current.entries()].flatMap(([key, n]) => Array(n).fill(key)).sort()
  writeFileSync(baselinePath, `${[...header, ...body].join('\n')}\n`)
  console.log(`Baseline written: ${body.length} errors.`)
  process.exit(0)
}

if (added.length > 0) {
  console.error(`tsc found ${total(added)} error(s) that are not in tsc-baseline.txt:\n`)
  for (const [key, n] of added) console.error(`  +${n} ${key}`)
  console.error('\nFix them. The baseline only holds errors that predate the gate.')
  process.exit(1)
}

console.log(`tsc: no new errors (${total(current)} known, baseline ${total(baseline)}).`)
if (fixed.length > 0) {
  console.log(
    `${total(fixed)} baseline error(s) no longer occur; run \`npm run check:tsc -- --update\` to shrink tsc-baseline.txt.`,
  )
}
