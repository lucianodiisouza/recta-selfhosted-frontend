import { useEffect, useRef, useState } from 'react';
import { useCurrency } from '../../context/CurrencyContext';
import { useDemoBlur } from '../../context/DemoBlurContext';
import { formatCurrency } from '../../utils/format';
import { cn } from './cn';

export interface MoneyTextProps {
  value: number | null | undefined;
  /** Defaults to the user's base currency. */
  currency?: string;
  /**
   * `auto`: minus only when negative. `always`: "+" on positives too (income/expense rows).
   * `none`: absolute value.
   */
  sign?: 'auto' | 'always' | 'none';
  /** `semantic` colors by sign (positive green, negative red); `neutral` keeps the text color. */
  tone?: 'semantic' | 'neutral';
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'display';
  /** Counts up/down to new values (hero balances), like the app. Off with reduced motion. */
  animate?: boolean;
  className?: string;
}

const sizes = {
  sm: 'text-sm font-semibold',
  md: 'text-[15px] font-semibold',
  lg: 'text-lg font-semibold',
  xl: 'text-2xl font-bold',
  display: 'text-4xl sm:text-[44px] font-bold tracking-tight',
};

/**
 * Money as in the apps (iOS `MoneyText`): rounded tabular digits, user's currency, sign and
 * semantic color. The sign is always in the text, so meaning never depends on color alone.
 * Honors the demo blur.
 */
/** Eases from the previous value to `target` in ~0.6s. */
const useCountUp = (target: number, enabled: boolean): number => {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!enabled || reduce || from.current === target) {
      from.current = target;
      setShown(target);
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 600);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(origin + (target - origin) * eased);
      if (p < 1) frame = requestAnimationFrame(tick);
      else from.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      from.current = target;
    };
  }, [target, enabled]);
  return shown;
};

export const MoneyText = ({ value, currency, sign = 'auto', tone = 'neutral', size = 'md', animate = false, className }: MoneyTextProps) => {
  const { baseCurrency } = useCurrency();
  const { isBlurred } = useDemoBlur();
  const amount = useCountUp(value ?? 0, animate);
  const formatted = formatCurrency(Math.abs(amount), currency ?? baseCurrency);
  const prefix = sign === 'none' ? '' : amount < 0 ? '-' : sign === 'always' && amount > 0 ? '+' : '';
  const color = tone === 'semantic' ? (amount > 0 ? 'text-positive' : amount < 0 ? 'text-negative' : 'text-content') : undefined;
  return (
    <span className={cn('font-rounded tabular-nums whitespace-nowrap', sizes[size], color, isBlurred && 'demo-blur', className)}>
      {prefix}
      {formatted}
    </span>
  );
};
