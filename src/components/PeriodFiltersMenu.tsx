import { useState } from 'react';
import { Calendar, Check } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import { useI18n } from '../context/I18nContext';

interface PeriodFiltersMenuProps {
  periodFilter: 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisYear' | 'custom';
  onPeriodFilter: (period: 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisYear') => void;
}

export const PeriodFiltersMenu = ({
  periodFilter,
  onPeriodFilter,
}: PeriodFiltersMenuProps) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const periods = [
    { id: 'thisMonth' as const, label: t.thisMonth },
    { id: 'lastMonth' as const, label: t.lastMonth },
    { id: 'thisQuarter' as const, label: t.thisQuarter },
    { id: 'thisYear' as const, label: t.thisYear },
  ];

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className="inline-flex items-center justify-center gap-2 h-10 px-3 rounded-lg border border-line bg-surface-elevated text-sm font-semibold text-content-secondary hover:bg-surface-sunken data-[state=open]:bg-surface-sunken transition-colors"
          aria-label={t.periodFilters}
        >
          <Calendar className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="min-w-[14rem] bg-surface-elevated rounded-xl shadow-floating ring-1 ring-line-subtle z-[100] p-1.5 animate-menu-in"
          sideOffset={4}
          align="end"
        >
          <div>
            {periods.map((period) => (
              <button
                key={period.id}
                onClick={() => {
                  onPeriodFilter(period.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-3 h-10 px-3 text-[15px] text-start rounded-lg focus:outline-none focus-visible:bg-surface-sunken transition-colors ${
                  periodFilter === period.id
                    ? 'bg-brand-soft text-brand-on-soft font-semibold'
                    : 'text-content hover:bg-surface-sunken'
                }`}
              >
                <span>{period.label}</span>
                {periodFilter === period.id && (
                  <Check className="ms-auto h-4 w-4 text-brand" strokeWidth={2.5} aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

