import { LucideIcon } from 'lucide-react';

interface QuickActionButtonProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  variant?: 'success' | 'danger' | 'primary';
}

export const QuickActionButton = ({
  icon: Icon,
  label,
  onClick,
  variant = 'primary',
}: QuickActionButtonProps) => {
  // Tinted pills, like the iOS QuickAction: the color names the action, the icon and label say it.
  const variantClasses = {
    success: 'bg-positive-soft text-positive hover:brightness-95 dark:hover:brightness-125',
    danger: 'bg-negative-soft text-negative-on-soft hover:brightness-95 dark:hover:brightness-125',
    primary: 'bg-brand-soft text-brand-on-soft hover:bg-brand/15',
  };

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-semibold rounded-lg transition-[filter,background-color,transform] duration-150 active:scale-[0.97] motion-reduce:active:scale-100 w-full sm:w-auto ${variantClasses[variant]}`}
      aria-label={label}
    >
      <Icon className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={2.5} aria-hidden="true" />
      <span className="hidden sm:inline whitespace-nowrap">{label}</span>
      <span className="sm:hidden whitespace-nowrap">{label.split(' ')[0]}</span>
    </button>
  );
};
