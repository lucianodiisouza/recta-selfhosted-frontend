import { cloneElement, CSSProperties, forwardRef, InputHTMLAttributes, isValidElement, ReactElement, ReactNode, TextareaHTMLAttributes, useId } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from './cn';

// Shared look of every text control. `aria-invalid` switches it to the error state.
const control =
  'w-full rounded-lg border border-line bg-surface-elevated text-content text-[15px] ' +
  'placeholder:text-content-tertiary transition-[border-color,box-shadow] duration-150 ' +
  'hover:border-content-tertiary/60 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 ' +
  'disabled:bg-surface-sunken disabled:text-content-tertiary disabled:cursor-not-allowed ' +
  'aria-[invalid=true]:border-negative aria-[invalid=true]:focus:ring-negative/15';

export interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** The control. Its id, aria-describedby and aria-invalid are wired automatically. */
  children: ReactElement;
  className?: string;
  required?: boolean;
}

/** Label + control + hint/error, with the accessibility attributes connected. */
export const Field = ({ label, hint, error, children, className, required }: FieldProps) => {
  const autoId = useId();
  const id = (isValidElement(children) && (children.props as { id?: string }).id) || autoId;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-content-secondary">
          {label}
          {required && <span className="text-negative ms-0.5" aria-hidden="true">*</span>}
        </label>
      )}
      {cloneElement(children, { id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined } as Record<string, unknown>)}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-negative" role="alert">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-content-tertiary">{hint}</p>
      ) : null}
    </div>
  );
};

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: LucideIcon;
  /** Text or node glued to the end (currency symbol, unit). */
  suffix?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ icon: Icon, suffix, className, ...rest }, ref) => (
  <div className="relative">
    {Icon && <Icon className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-content-tertiary" aria-hidden="true" />}
    <input ref={ref} className={cn(control, 'h-11 px-3.5', Icon && 'ps-10', suffix ? 'pe-12' : undefined, className)} {...rest} />
    {suffix && <span className="pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2 text-sm text-content-tertiary">{suffix}</span>}
  </div>
));
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, rows = 3, ...rest }, ref) => (
  <textarea ref={ref} rows={rows} className={cn(control, 'px-3.5 py-2.5 resize-y min-h-[88px]', className)} {...rest} />
));
Textarea.displayName = 'Textarea';

/** Big money input (iOS `AmountField(.hero)`): rounded digits, currency prefix, centered. */
export const AmountInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { currencySymbol: string }>(
  ({ currencySymbol, className, ...rest }, ref) => (
    <div className="flex items-baseline justify-center gap-1.5 rounded-xl bg-surface-sunken px-4 py-5 focus-within:ring-4 focus-within:ring-brand/15">
      <span className="font-rounded text-2xl font-semibold text-content-tertiary">{currencySymbol}</span>
      {/* Grows with the typed value (field-sizing) so the symbol stays next to the digits. */}
      <input
        ref={ref}
        inputMode="decimal"
        size={7} // fallback width where field-sizing is unsupported
        style={{ fieldSizing: 'content' } as CSSProperties}
        className={cn('min-w-[4ch] max-w-full bg-transparent border-0 p-0 font-rounded text-5xl font-bold tabular-nums text-content placeholder:text-content-tertiary focus:outline-none focus:ring-0', className)}
        {...rest}
      />
    </div>
  ),
);
AmountInput.displayName = 'AmountInput';
