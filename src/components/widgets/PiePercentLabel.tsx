import { PIE_LABEL_FONT_SIZE, pieLabelFormat, pieLabelPlacement } from '../../utils/pieLabel';

export interface PiePercentLabelProps {
  cx: number;
  cy: number;
  midAngle: number;
  outerRadius: number;
  percent: number;
  fill?: string;
}

/** Percentage label of a pie slice, placed by utils/pieLabel so that pieOuterRadius(height) keeps it inside the chart. */
export const PiePercentLabel = ({ cx, cy, midAngle, outerRadius, percent, fill }: PiePercentLabelProps) => {
  const text = pieLabelFormat(percent);
  if (text === null) return null;
  const { x, y, anchor } = pieLabelPlacement(cx, cy, midAngle, outerRadius);
  return (
    <text x={x} y={y} fill={fill} textAnchor={anchor} dominantBaseline="central" fontSize={PIE_LABEL_FONT_SIZE}>
      {text}
    </text>
  );
};
