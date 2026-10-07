// Geometry of the percentage labels drawn around a pie chart. Recharts places an "outside" label at
// outerRadius + gap and clips whatever falls outside the SVG, so the radius has to leave room for the label:
// the widgets take their outerRadius from pieOuterRadius(height) instead of hard-coding it.

export const PIE_LABEL_GAP = 14;
export const PIE_LABEL_FONT_SIZE = 12;
/** Slices below this share get no label (it would overlap the neighbours). */
export const PIE_LABEL_MIN_PERCENT = 0.05;
/** Breathing room kept between the widest label and the edge of the chart. */
export const PIE_LABEL_EDGE_PADDING = 4;
/** Average glyph width as a fraction of the font size (digits and "%"). */
const CHAR_WIDTH = 0.62;
const LINE_HEIGHT = 1.2;
const RADIAN = Math.PI / 180;

export const PIE_LABEL_WIDEST_TEXT = '100%';

export interface PieLabelPlacement {
  x: number;
  y: number;
  anchor: 'start' | 'end';
}

export function pieLabelPlacement(cx: number, cy: number, midAngle: number, outerRadius: number): PieLabelPlacement {
  const r = outerRadius + PIE_LABEL_GAP;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return { x, y, anchor: x > cx ? 'start' : 'end' };
}

export function pieLabelFormat(percent: number): string | null {
  if (!(percent >= PIE_LABEL_MIN_PERCENT)) return null;
  return `${(percent * 100).toFixed(0)}%`;
}

/** Never draw a bigger pie: a wider one would push the side labels out of the narrowest cards (240px). */
export const PIE_MAX_OUTER_RADIUS = 70;

/**
 * Height a recharts <Legend /> takes from the plot area (measured: 24px for the legend wrapper). A pie
 * with a legend is sized with pieOuterRadius(height - PIE_LEGEND_HEIGHT), or its top label is cut.
 */
export const PIE_LEGEND_HEIGHT = 24;

/** Largest outer radius whose top and bottom labels still fit inside a chart of this height (and the narrowest card). */
export function pieOuterRadius(height: number): number {
  const half = PIE_LABEL_FONT_SIZE * LINE_HEIGHT / 2;
  return Math.max(24, Math.min(PIE_MAX_OUTER_RADIUS, Math.floor(height / 2 - PIE_LABEL_GAP - half - PIE_LABEL_EDGE_PADDING)));
}

export interface PieLabelClearance {
  top: number;
  bottom: number;
  left: number;
  right: number;
  /** Smallest of the four: negative means a label is cut. */
  min: number;
}

/**
 * Worst clearance between any label (every angle, widest text) and the edges of a width x height chart.
 * `legendHeight` is the height a legend takes: the pie is centred in what is left.
 */
export function pieLabelClearance(width: number, height: number, outerRadius: number, legendHeight = 0): PieLabelClearance {
  const cx = width / 2;
  const cy = (height - legendHeight) / 2;
  const textWidth = PIE_LABEL_WIDEST_TEXT.length * PIE_LABEL_FONT_SIZE * CHAR_WIDTH;
  const textHeight = PIE_LABEL_FONT_SIZE * LINE_HEIGHT;
  const worst = { top: Infinity, bottom: Infinity, left: Infinity, right: Infinity };
  for (let angle = 0; angle < 360; angle += 1) {
    const { x, y, anchor } = pieLabelPlacement(cx, cy, angle, outerRadius);
    const left = anchor === 'start' ? x : x - textWidth;
    const right = left + textWidth;
    worst.top = Math.min(worst.top, y - textHeight / 2);
    worst.bottom = Math.min(worst.bottom, height - legendHeight - (y + textHeight / 2));
    worst.left = Math.min(worst.left, left);
    worst.right = Math.min(worst.right, width - right);
  }
  return { ...worst, min: Math.min(worst.top, worst.bottom, worst.left, worst.right) };
}
