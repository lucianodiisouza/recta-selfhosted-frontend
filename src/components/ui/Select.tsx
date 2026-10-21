import * as Popover from '@radix-ui/react-popover';
import { ButtonHTMLAttributes, forwardRef, KeyboardEvent, ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, LucideIcon, Search } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { cn } from './cn';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  /** Tint of the icon/swatch (category or account color). */
  color?: string;
}

export interface SelectProps<T extends string = string>
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'value' | 'onChange' | 'children'> {
  value: T | '' | null | undefined;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  /** Shows a search field. Defaults to on when there are more than 6 options. */
  searchable?: boolean;
  size?: 'sm' | 'md';
  /** Rendered before the label in the trigger (e.g. a leading icon). */
  leading?: ReactNode;
}

const triggerBase =
  'inline-flex w-full items-center justify-between gap-2 rounded-lg border border-line bg-surface-elevated text-content ' +
  'transition-[border-color,box-shadow] duration-150 hover:border-content-tertiary/60 ' +
  'focus:outline-none focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/15 ' +
  'data-[state=open]:border-brand disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-content-tertiary ' +
  'aria-[invalid=true]:border-negative';

/**
 * The app's select: a combobox (button + popover listbox) instead of the native <select>, so it
 * looks the same everywhere, supports search and icons, and follows the ARIA combobox pattern.
 */
const SelectInner = <T extends string>(
  { value, onChange, options, placeholder, searchable, size = 'md', leading, disabled, className, ...rest }: SelectProps<T>,
  ref: React.ForwardedRef<HTMLButtonElement>,
) => {
  const { t } = useI18n();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const withSearch = searchable ?? options.length > 6;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const selected = options.find((o) => o.value === value);

  // Opening highlights the selected option; typing resets to the first match.
  useEffect(() => {
    if (open) setActive(Math.max(0, filtered.findIndex((o) => o.value === value)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => { if (query) setActive(0); }, [query]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (v: T) => {
    onChange(v);
    setOpen(false);
    setQuery('');
  };

  const onListKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(filtered.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(filtered.length - 1); }
    else if (e.key === 'Enter' && filtered[active]) { e.preventDefault(); choose(filtered[active].value); }
  };

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !open) {
      e.preventDefault();
      setOpen(true);
    }
  };

  const SelectedIcon = selected?.icon;

  return (
    <Popover.Root open={disabled ? false : open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(''); }}>
      <Popover.Trigger asChild>
        <button
          ref={ref}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-haspopup="listbox"
          disabled={disabled}
          onKeyDown={onTriggerKeyDown}
          className={cn(triggerBase, size === 'sm' ? 'h-9 px-3 text-sm' : 'h-11 px-3.5 text-[15px]', className)}
          {...rest}
        >
          <span className="flex min-w-0 items-center gap-2">
            {leading}
            {SelectedIcon && <SelectedIcon className="h-4 w-4 shrink-0" style={{ color: selected?.color }} aria-hidden="true" />}
            <span className={cn('truncate', !selected && 'text-content-tertiary')}>{selected?.label ?? placeholder ?? t.select}</span>
          </span>
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-content-tertiary transition-transform duration-200', open && 'rotate-180')} aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="start"
          collisionPadding={12}
          onKeyDown={onListKeyDown}
          onOpenAutoFocus={(e) => {
            // Focus the search field, or the list itself so the arrow keys work right away.
            e.preventDefault();
            (withSearch ? (e.currentTarget as HTMLElement).querySelector('input') : listRef.current)?.focus();
          }}
          className="z-[100] flex max-h-[min(360px,var(--radix-popover-content-available-height))] w-[var(--radix-popover-trigger-width)] min-w-[12rem] flex-col overflow-hidden rounded-xl bg-surface-elevated p-1.5 shadow-floating ring-1 ring-line-subtle animate-menu-in"
        >
          {withSearch && (
            <div className="relative mb-1">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-tertiary" aria-hidden="true" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`${t.search}...`}
                aria-controls={listId}
                aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined}
                className="h-9 w-full rounded-lg border-0 bg-surface-sunken ps-8 pe-2 text-sm text-content placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
          )}
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={withSearch ? -1 : 0}
            aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined}
            className="min-h-0 flex-1 overflow-y-auto outline-none"
          >
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-center text-sm text-content-tertiary">{t.noOptionsFound}</div>
            ) : (
              filtered.map((option, index) => {
                const isSelected = option.value === value;
                const Icon = option.icon;
                return (
                  <div
                    key={option.value}
                    id={`${listId}-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={isSelected}
                    onMouseMove={() => setActive(index)}
                    onClick={() => choose(option.value)}
                    className={cn(
                      'flex h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[15px] text-content',
                      index === active && 'bg-surface-sunken',
                      isSelected && 'font-semibold',
                    )}
                  >
                    {Icon && <Icon className="h-4 w-4 shrink-0" style={{ color: option.color }} aria-hidden="true" />}
                    {!Icon && option.color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: option.color }} aria-hidden="true" />}
                    <span className="flex-1 truncate">{option.label}</span>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-brand" strokeWidth={2.5} aria-hidden="true" />}
                  </div>
                );
              })
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

export const Select = forwardRef(SelectInner) as <T extends string = string>(
  props: SelectProps<T> & { ref?: React.ForwardedRef<HTMLButtonElement> },
) => ReturnType<typeof SelectInner>;
