import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PIE_LEGEND_HEIGHT, pieLabelClearance, pieLabelFormat, pieLabelPlacement, pieOuterRadius } from './pieLabel'

// Chart heights used by the widgets (the inline height of ResponsiveContainer) and the narrowest card we render.
const HEIGHTS = [180, 200, 250, 300]
const WIDTHS = [240, 320, 480, 1200]

describe('pieOuterRadius', () => {
  it('keeps every label inside the chart, at every angle and width', () => {
    for (const h of HEIGHTS) {
      for (const w of WIDTHS) {
        const clearance = pieLabelClearance(w, h, pieOuterRadius(h))
        expect(clearance.min, `labels cut at ${w}x${h}: ${JSON.stringify(clearance)}`).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('would have cut the label with the old fixed radii (the bug this guards)', () => {
    expect(pieLabelClearance(320, 200, 80).top).toBeLessThan(0)
    expect(pieLabelClearance(320, 180, 70).top).toBeLessThan(0)
  })

  it('keeps the labels inside a chart whose legend takes part of the height', () => {
    for (const w of WIDTHS) {
      const clearance = pieLabelClearance(w, 180, pieOuterRadius(180 - PIE_LEGEND_HEIGHT), PIE_LEGEND_HEIGHT)
      expect(clearance.min, `labels cut at ${w}x180 with a legend: ${JSON.stringify(clearance)}`).toBeGreaterThanOrEqual(0)
    }
  })

  it('would cut the top label of the fixed vs variable chart if the legend were ignored (the second bug this guards)', () => {
    expect(pieLabelClearance(320, 180, pieOuterRadius(180), PIE_LEGEND_HEIGHT).top).toBeLessThan(0)
  })

  it('leaves a usable pie', () => {
    for (const h of HEIGHTS) expect(pieOuterRadius(h), `radius too small for ${h}`).toBeGreaterThanOrEqual(50)
  })
})

describe('pieLabelPlacement', () => {
  it('puts the label outside the slice, anchored to the side it belongs to', () => {
    const right = pieLabelPlacement(100, 100, 0, 70)
    expect(right.anchor).toBe('start')
    expect(right.x).toBeGreaterThan(170)
    const left = pieLabelPlacement(100, 100, 180, 70)
    expect(left.anchor).toBe('end')
    expect(left.x).toBeLessThan(30)
    expect(pieLabelPlacement(100, 100, 90, 70).y).toBeLessThan(30)
  })
})

describe('pieLabelFormat', () => {
  it('gives no label to small slices and a rounded percentage to the others', () => {
    expect(pieLabelFormat(0.04)).toBeNull()
    expect(pieLabelFormat(Number.NaN)).toBeNull()
    expect(pieLabelFormat(0.6)).toBe('60%')
    expect(pieLabelFormat(1)).toBe('100%')
  })
})

// Structural guards: the geometry above only protects a widget that actually uses it.
const SRC = fileURLToPath(new URL('..', import.meta.url))

describe('pie widgets', () => {
  it('size the pie with pieOuterRadius and draw labels through PiePercentLabel', () => {
    for (const file of ['IncomeByCategoryWidget.tsx', 'ExpensesByCategoryWidget.tsx', 'FixedVsVariableWidget.tsx']) {
      const source = readFileSync(`${SRC}components/widgets/${file}`, 'utf8')
      const radius = file === 'FixedVsVariableWidget.tsx' ? 'PIE_CHART_HEIGHT - PIE_LEGEND_HEIGHT' : 'PIE_CHART_HEIGHT'
      expect(source, `${file}: outerRadius must come from pieOuterRadius(${radius})`).toContain(`outerRadius={pieOuterRadius(${radius})}`)
      expect(source, `${file}: the chart height must be the same constant`).toMatch(/height=\{PIE_CHART_HEIGHT\}/)
      expect(source, `${file}: labels must use PiePercentLabel`).toMatch(/<PiePercentLabel /)
      expect(source, `${file}: no hard-coded outerRadius`).not.toMatch(/outerRadius=\{\d+\}/)
    }
  })

  // The landing page draws a decorative pie in a fixed layout of its own, outside the dashboard widgets.
  it('are the only pies with a label (another one would draw labels nobody checked)', () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = `${dir}/${entry.name}`
        if (entry.isDirectory()) return walk(path)
        return /\.tsx$/.test(entry.name) ? [path] : []
      })
    const offenders = walk(SRC).filter((file) => {
      const source = readFileSync(file, 'utf8')
      return /<Pie[\s>]/.test(source) && /label=/.test(source) && !/PiePercentLabel/.test(source) && !/LandingPage/.test(file)
    })
    expect(offenders).toEqual([])
  })
})
