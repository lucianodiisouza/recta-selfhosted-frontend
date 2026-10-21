import { DatePicker } from '../DatePicker';
import { PeriodFiltersMenu } from '../PeriodFiltersMenu';
import { Tooltip } from '../Tooltip';
import { RotateCcw } from 'lucide-react';
import { startOfMonth } from 'date-fns';
import { SegmentedControl } from '../ui';

interface DashboardFiltersProps {
  selectedMonth: Date;
  periodFilter: 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisYear' | 'custom';
  onMonthChange: (date: Date) => void;
  onPeriodFilter: (period: 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisYear') => void;
  onBackToCurrentMonth: () => void;
  isCurrentMonth: boolean;
  t: Record<string, string>;
}

export const DashboardFilters = ({
  selectedMonth,
  periodFilter,
  onMonthChange,
  onPeriodFilter,
  onBackToCurrentMonth,
  isCurrentMonth,
  t,
}: DashboardFiltersProps) => {
  return (
    <div className="flex flex-row flex-wrap gap-2 items-center w-full sm:w-auto" role="group" aria-label={t.periodFilters}>
      {/* Desktop: segmented control with the quick periods */}
      <div className="hidden sm:block" role="group" aria-label={t.quickPeriods}>
        <SegmentedControl
          label={t.quickPeriods}
          value={periodFilter}
          onChange={onPeriodFilter}
          options={[
            { value: 'thisMonth', label: t.thisMonth },
            { value: 'lastMonth', label: t.lastMonth },
            { value: 'thisQuarter', label: t.thisQuarter },
            { value: 'thisYear', label: t.thisYear },
          ]}
        />
      </div>

      {/* Mobile: mostra apenas o menu de filtros */}
      <div className="sm:hidden flex-shrink-0">
        <PeriodFiltersMenu
          periodFilter={periodFilter}
          onPeriodFilter={onPeriodFilter}
        />
      </div>

      {/* Seletor de mês */}
      <div className="flex items-center gap-2 flex-1 sm:flex-initial min-w-0">
        <DatePicker
          value={selectedMonth}
          onChange={(date) => {
            if (date) {
              onMonthChange(startOfMonth(date));
            }
          }}
          placeholder={t.selectMonth || t.month}
          className="w-full sm:w-auto min-w-[140px]"
        />
        <span id="month-selector-description" className="sr-only">
          {t.selectMonthDescription}
        </span>
        {!isCurrentMonth && (
          <Tooltip content={t.backToCurrentMonth}>
            <button
              onClick={onBackToCurrentMonth}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface-elevated text-content-secondary hover:bg-surface-sunken hover:text-content transition-colors flex-shrink-0"
              aria-label={t.backToCurrentMonth}
            >
              <RotateCcw className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
};
