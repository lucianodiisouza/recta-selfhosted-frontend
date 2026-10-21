import { cn } from './cn';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}

/** iOS-style toggle. */
export const Switch = ({ checked, onChange, label, disabled, className }: SwitchProps) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={cn(
      'relative inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-full transition-colors duration-200 motion-reduce:transition-none disabled:opacity-50',
      checked ? 'bg-positive' : 'bg-gray-300 dark:bg-gray-700',
      className,
    )}
  >
    <span
      aria-hidden="true"
      className={cn(
        'inline-block h-[27px] w-[27px] rounded-full bg-white shadow-md transition-transform duration-200 motion-reduce:transition-none',
        checked ? 'translate-x-[22px] rtl:-translate-x-[22px]' : 'translate-x-[2px] rtl:-translate-x-[2px]',
      )}
    />
  </button>
);
