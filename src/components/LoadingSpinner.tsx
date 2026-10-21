import RectaMark from './RectaMark';

interface LoadingSpinnerProps {
  size?: number;
  className?: string;
}

/**
 * App loader: the Equilíbrio mark leveling itself with a damped tilt, like the iOS/Android splash.
 * With reduced motion it only fades gently.
 */
export const LoadingSpinner = ({ size = 48, className = '' }: LoadingSpinnerProps) => (
  <div className={`flex items-center justify-center ${className}`} role="status">
    <RectaMark className="animate-mark-level text-content" style={{ width: size * 1.45, height: 'auto' }} />
  </div>
);
