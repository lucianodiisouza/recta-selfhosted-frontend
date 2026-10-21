import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react';
import { LucideIcon, Loader2 } from 'lucide-react';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap select-none ' +
  'transition-[transform,background-color,color,box-shadow,opacity] duration-150 ease-out ' +
  'active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 ' +
  'disabled:cursor-not-allowed disabled:active:scale-100';

// Mirrors RectaButton.Kind on iOS: primary = brand, secondary = brand-soft, tertiary = outlined.
const variants: Record<ButtonVariant, string> = {
  primary: 'bg-brand-fill text-white shadow-sm hover:bg-brand-fill-hover disabled:bg-surface-sunken disabled:text-content-tertiary disabled:shadow-none',
  secondary: 'bg-brand-soft text-brand-on-soft hover:bg-brand/15 disabled:bg-surface-sunken disabled:text-content-tertiary',
  tertiary: 'bg-surface-elevated text-content border border-line hover:bg-surface-sunken disabled:text-content-tertiary',
  ghost: 'bg-transparent text-content-secondary hover:bg-surface-sunken hover:text-content disabled:text-content-tertiary',
  destructive: 'bg-negative-fill text-white shadow-sm hover:opacity-90 disabled:bg-surface-sunken disabled:text-content-tertiary disabled:shadow-none',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-sm rounded-lg',
  md: 'h-11 px-5 text-[15px] rounded-lg',
  lg: 'h-12 px-6 text-base rounded-xl',
};

const iconSizes: Record<ButtonSize, string> = { sm: 'h-4 w-4', md: 'h-[18px] w-[18px]', lg: 'h-5 w-5' };

/** Class string of a button, for links or other elements that must look like one. */
export const buttonClasses = (
  { variant = 'primary', size = 'md', fullWidth = false }: { variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean } = {},
): string => cn(base, variants[variant], sizes[size], fullWidth && 'w-full');

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  /** Icon after the label (e.g. a chevron). */
  trailingIcon?: LucideIcon;
  fullWidth?: boolean;
  isLoading?: boolean;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'primary', size = 'md', icon: Icon, trailingIcon: TrailingIcon, fullWidth, isLoading, disabled, className, children, type = 'button', ...rest },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={cn(buttonClasses({ variant, size, fullWidth }), isLoading && 'cursor-wait', className)}
      {...rest}
    >
      {isLoading ? (
        <Loader2 className={cn(iconSizes[size], 'animate-spin')} aria-hidden="true" />
      ) : (
        Icon && <Icon className={cn(iconSizes[size], 'shrink-0')} strokeWidth={2.25} aria-hidden="true" />
      )}
      {children}
      {TrailingIcon && !isLoading && <TrailingIcon className={cn(iconSizes[size], 'shrink-0')} aria-hidden="true" />}
    </button>
  ),
);
Button.displayName = 'Button';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: LucideIcon;
  /** Required: icon-only buttons need an accessible name. */
  label: string;
  variant?: Exclude<ButtonVariant, 'destructive'>;
  size?: ButtonSize;
}

const iconButtonSizes: Record<ButtonSize, string> = { sm: 'h-9 w-9 rounded-lg', md: 'h-11 w-11 rounded-lg', lg: 'h-12 w-12 rounded-xl' };

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon: Icon, label, variant = 'ghost', size = 'md', className, type = 'button', ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(base, variants[variant], iconButtonSizes[size], 'px-0', className)}
      {...rest}
    >
      <Icon className={iconSizes[size]} aria-hidden="true" />
    </button>
  ),
);
IconButton.displayName = 'IconButton';
