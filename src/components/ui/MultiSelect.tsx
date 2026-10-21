import * as Popover from '@radix-ui/react-popover';
import { ButtonHTMLAttributes, KeyboardEvent, ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { Button } from './Button';
import type { SelectOption } from './Select';
import { cn } from './cn';

export interface MultiSelectProps<T extends string = string>
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'value' | 'onChange' | 'children'> {
  /** Chosen values; an empty list means "all" when `allLabel` is set. */
  values: T[];
  onChange: (values: T[]) => void;
  options: SelectOption<T>[];
  /** Text of the trigger. Defaults to the labels of the chosen options joined by commas. */
  summary?: string;
  placeholder?: string;
  /** Adds a first row that clears the selection (e.g. "All"). It shows as checked when nothing is chosen. */
  allLabel?: string;
  /** Shows a search field. Defaults to on when there are more than 6 options. */
  searchable?: boolean;
  size?: 'sm' | 'md';
  leading?: ReactNode;
}

const triggerBase =
  'inline-flex w-full items-center justify-between gap-2 rounded-lg border border-line bg-surface-elevated text-content ' +
  'transition-[border-color,box-shadow] duration-150 hover:border-content-tertiary/60 ' +
  'focus:outline-none focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/15 ' +
  'data-[state=open]:border-brand disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-content-tertiary';

const ALL = '\u0000all';

/**
 * Multi-select sibling of `Select`: same trigger and popover, but the listbox is
 * `aria-multiselectable`, rows toggle with click, Enter or Space and show a checkbox, and the popover
 * stays open until "Done", Escape or a click outside.
 */
export function MultiSelect<T extends string>({
  values,
  onChange,
  options,
  summary,
  placeholder,
  allLabel,
  searchable,
  size = 'md',
  leading,
  disabled,
  className,
  ...rest
}: MultiSelectProps<T>) {
  const { t } = useI18n();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const withSearch = searchable ?? options.length > 6;

  // Rows of the list: the "all" row (only while not searching) and the matching options.
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matching = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
    const list: Array<SelectOption<T> | { value: typeof ALL; label: string }> = [...matching];
    if (allLabel && !q) list.unshift({ value: ALL, label: allLabel });
    return list;
  }, [options, query, allLabel]);

  const isChecked = (value: string) => (value === ALL ? values.length === 0 : values.includes(value as T));

  useEffect(() => { if (open) setActive(0); }, [open]);
  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const toggle = (value: string) => {
    if (value === ALL) onChange([]);
    else onChange(values.includes(value as T) ? values.filter((v) => v !== value) : [...values, value as T]);
  };

  const close = () => { setOpen(false); setQuery(''); };

  const onListKeyDown = (e: KeyboardEvent) => {
    const inSearch = (e.target as HTMLElement).tagName === 'INPUT';
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(rows.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Home' && !inSearch) { e.preventDefault(); setActive(0); }
    else if (e.key === 'End' && !inSearch) { e.preventDefault(); setActive(rows.length - 1); }
    else if ((e.key === 'Enter' || (e.key === ' ' && !inSearch)) && rows[active] && (e.target as HTMLElement).tagName !== 'BUTTON') {
      e.preventDefault();
      toggle(rows[active].value);
    }
  };

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !open) {
      e.preventDefault();
      setOpen(true);
    }
  };

  const chosenLabels = options.filter((o) => values.includes(o.value)).map((o) => o.label);
  const label = summary ?? (chosenLabels.length ? chosenLabels.join(', ') : allLabel);
  const showsPlaceholder = !label;

  return (
    <Popover.Root open={disabled ? false : open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <Popover.Trigger asChild>
        <button
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
            <span className={cn('truncate', showsPlaceholder && 'text-content-tertiary')}>{label ?? placeholder ?? t.select}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            {values.length > 1 && (
              <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-soft px-1.5 text-xs font-semibold text-brand-on-soft" aria-hidden="true">
                {values.length}
              </span>
            )}
            <ChevronDown className={cn('h-4 w-4 text-content-tertiary transition-transform duration-200', open && 'rotate-180')} aria-hidden="true" />
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="start"
          collisionPadding={12}
          onKeyDown={onListKeyDown}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (withSearch ? (e.currentTarget as HTMLElement).querySelector('input') : listRef.current)?.focus();
          }}
          className="z-[100] flex max-h-[min(420px,var(--radix-popover-content-available-height))] w-[var(--radix-popover-trigger-width)] min-w-[14rem] flex-col overflow-hidden rounded-xl bg-surface-elevated p-1.5 shadow-floating ring-1 ring-line-subtle animate-menu-in"
        >
          {withSearch && (
            <div className="relative mb-1">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-tertiary" aria-hidden="true" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`${t.search}...`}
                aria-controls={listId}
                aria-activedescendant={rows[active] ? `${listId}-${active}` : undefined}
                className="h-9 w-full rounded-lg border-0 bg-surface-sunken ps-8 pe-2 text-sm text-content placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
          )}
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-multiselectable="true"
            tabIndex={withSearch ? -1 : 0}
            aria-activedescendant={rows[active] ? `${listId}-${active}` : undefined}
            className="min-h-0 flex-1 overflow-y-auto outline-none"
          >
            {rows.length === 0 ? (
              <div className="px-3 py-3 text-center text-sm text-content-tertiary">{t.noOptionsFound}</div>
            ) : (
              rows.map((row, index) => {
                const checked = isChecked(row.value);
                const option = row.value === ALL ? undefined : (row as SelectOption<T>);
                const Icon = option?.icon;
                return (
                  <div
                    key={row.value}
                    id={`${listId}-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={checked}
                    onMouseMove={() => setActive(index)}
                    onClick={() => toggle(row.value)}
                    className={cn(
                      'flex h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[15px] text-content',
                      index === active && 'bg-surface-sunken',
                      row.value === ALL && allLabel && 'mb-0.5',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors duration-150',
                        checked ? 'border-brand-fill bg-brand-fill text-white' : 'border-line bg-surface-elevated',
                      )}
                      aria-hidden="true"
                    >
                      {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    {Icon && <Icon className="h-4 w-4 shrink-0" style={{ color: option?.color }} aria-hidden="true" />}
                    {!Icon && option?.color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: option.color }} aria-hidden="true" />}
                    <span className={cn('flex-1 truncate', checked && 'font-semibold')}>{row.label}</span>
                  </div>
                );
              })
            )}
          </div>
          <div className="mt-1 border-t border-line-subtle pt-1.5">
            <Button type="button" size="sm" className="w-full" onClick={close}>
              {t.done}
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
