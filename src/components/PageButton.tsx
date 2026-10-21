import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface PageButtonProps {
  onClick: () => void;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: LucideIcon;
  className?: string;
  'aria-label'?: string;
  /** Optional short label used only on mobile to keep the button compact. */
  mobileLabel?: string;
  disabled?: boolean;
}

export const PageButton = ({
  onClick,
  children,
  variant = 'primary',
  icon: Icon,
  className = '',
  'aria-label': ariaLabel,
  mobileLabel,
  disabled = false,
}: PageButtonProps) => {
  const baseClasses = `inline-flex items-center justify-center h-10 px-3.5 sm:px-4 text-sm font-semibold rounded-lg whitespace-nowrap transition-[transform,background-color,opacity] duration-150 active:scale-[0.97] motion-reduce:active:scale-100 ${
    disabled ? 'opacity-50 cursor-not-allowed active:scale-100' : ''
  }`;

  // Same variants as components/ui/Button (primary, tertiary, destructive).
  const variantClasses = {
    primary: 'bg-brand-fill text-white shadow-sm hover:bg-brand-fill-hover',
    secondary: 'bg-surface-elevated text-content border border-line hover:bg-surface-sunken',
    danger: 'bg-negative-fill text-white shadow-sm hover:opacity-90',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} w-full sm:w-auto ${className}`}
      aria-label={ariaLabel}
    >
      {Icon && <Icon className="h-[18px] w-[18px] me-2 flex-shrink-0" strokeWidth={2.25} aria-hidden="true" />}
      <span className="hidden sm:inline whitespace-nowrap">{children}</span>
      <span className="sm:hidden whitespace-nowrap">
        {mobileLabel ?? (typeof children === 'string' ? children : children)}
      </span>
    </button>
  );
};

