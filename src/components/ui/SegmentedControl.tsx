import { KeyboardEvent, ReactNode, useRef } from 'react';
import { cn } from './cn';

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  /** May be outside `options` (nothing selected). */
  value: T | string;
  onChange: (value: T) => void;
  /** Accessible name of the group. */
  label: string;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
}

/** iOS-style segmented control: sunken track, elevated pill on the selected segment. */
export const SegmentedControl = <T extends string>({ options, value, onChange, label, size = 'md', fullWidth, disabled, className }: SegmentedControlProps<T>) => {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} aria-disabled={disabled || undefined} className={cn('inline-flex rounded-lg bg-surface-sunken p-1 gap-1', fullWidth && 'flex w-full', disabled && 'opacity-50 pointer-events-none', className)}>
      {options.map((option, index) => {
        const selected = option.value === value;
        // With no segment selected (e.g. a custom period), the first one takes the tab stop.
        const tabStop = selected || (index === 0 && !options.some((o) => o.value === value));
        return (
          <button
            key={option.value}
            ref={(el) => { refs.current[index] = el; }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={tabStop ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={cn(
              'rounded-md font-semibold whitespace-nowrap transition-[background-color,color,box-shadow] duration-200 motion-reduce:transition-none',
              size === 'sm' ? 'h-7 px-3 text-xs' : 'h-9 px-4 text-sm',
              fullWidth && 'flex-1',
              selected ? 'bg-surface-elevated text-content shadow-sm dark:bg-gray-700' : 'text-content-secondary hover:text-content',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};
