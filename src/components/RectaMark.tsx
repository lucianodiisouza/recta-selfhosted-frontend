import type { CSSProperties } from 'react';

interface RectaMarkProps {
  className?: string;
  style?: CSSProperties;
  /** Color of the filled top half. Defaults to the brand violet (lighter in dark mode). */
  topColor?: string;
  /**
   * Opacity of the whole mark as one flat layer. Use this for watermarks instead of
   * translucent colors: the half circle, outline and line overlap, so per-part alpha
   * stacks into visible seams and the mark stops reading as the logo.
   */
  opacity?: number;
}

/**
 * The Recta "Equilíbrio" mark: filled top half circle, bottom half as an outline and a
 * horizontal line across. Same geometry as the iOS/Android app icon (100×100 box), cropped
 * to the drawing. Line and outline use `currentColor`, so set the text color to theme it.
 */
const RectaMark = ({ className = 'h-8 w-auto', topColor = 'var(--recta-mark-top)', opacity, style }: RectaMarkProps) => (
  <svg
    viewBox="10.5 24 79 54.5"
    className={className}
    style={style}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    <g opacity={opacity}>
      <path d="M24 50a26 26 0 0 1 52 0z" fill={topColor} />
      <path d="M24 50a26 26 0 0 0 52 0" stroke="currentColor" strokeWidth="5" />
      <path d="M13 50h74" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    </g>
  </svg>
);

export default RectaMark;
