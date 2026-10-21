import { useState } from 'react';
import { DateRangePicker, type DateRange } from '../DateRangePicker';
import CategoryMultiCombobox from '../CategoryMultiCombobox';
import SelectCombobox from '../SelectCombobox';
import { ChevronDown, Filter, X } from 'lucide-react';
import { TransactionType } from '../../lib/enums';
import { TransactionSearchBar } from '../shared';

interface TransactionFiltersProps {
  searchInput: string;
  onSearchChange: (value: string) => void;
  dateRange: DateRange;
  tempDateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  onDateRangeApply: (range: DateRange) => void;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  /** Chosen categoryNames; empty = all (fdbk #123). */
  categoryFilter: string[];
  onCategoryFilterChange: (value: string[]) => void;
  paidFilter: string;
  onPaidFilterChange: (value: string) => void;
  activeTab: 'transactions' | 'scheduled';
  householdId?: string;
  t: Record<string, string>;
  locale: string;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  disabled?: boolean;
}

export const TransactionFilters = ({
  searchInput,
  onSearchChange,
  dateRange: _dateRange,
  tempDateRange,
  onDateRangeChange,
  onDateRangeApply,
  typeFilter,
  onTypeFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  paidFilter,
  onPaidFilterChange,
  activeTab,
  householdId,
  t,
  locale: _locale,
  onClearFilters,
  hasActiveFilters,
  disabled = false,
}: TransactionFiltersProps) => {
  // On mobile, hide secondary filters behind a collapsible accordion so the user
  // can immediately see the transaction list. Expanded by default on desktop.
  const [isExpanded, setIsExpanded] = useState(false);
  const hasNonSearchFilters =
    typeFilter !== 'todos' ||
    categoryFilter.length > 0 ||
    paidFilter !== 'todos' ||
    !!tempDateRange.startDate ||
    !!tempDateRange.endDate;

  return (
    <div className="surface-card p-4 mb-6">
      <div className="space-y-4">
        {/* Primeira linha: Busca e Data (Data oculta na aba Próximos agendamentos) */}
        <div className={`grid gap-4 ${activeTab === 'scheduled' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'}`}>
          <div className={activeTab === 'scheduled' ? '' : 'md:col-span-2'}>
            <TransactionSearchBar
              value={searchInput}
              onChange={onSearchChange}
              placeholder={t.search}
              disabled={disabled}
            />
          </div>
          {activeTab !== 'scheduled' && (
            <>
              {/* Mobile: collapsed accordion trigger for date range + secondary filters */}
              <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                className="md:hidden inline-flex items-center justify-between w-full px-3.5 h-10 text-sm font-semibold border border-line text-content-secondary bg-surface-elevated rounded-lg hover:bg-surface-sunken transition-colors"
                aria-expanded={isExpanded}
              >
                <span className="inline-flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  {t.filters || t.filter || 'Filtros'}
                  {hasNonSearchFilters && (
                    <span className="ml-1 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-xs font-medium text-white bg-brand-fill rounded-full">
                      •
                    </span>
                  )}
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                />
              </button>
              {/* Desktop: always show date range side by side with search */}
              <div className="hidden md:flex gap-2">
                <div className="flex-1">
                  <DateRangePicker
                    value={tempDateRange}
                    onChange={onDateRangeChange}
                    applyImmediately={false}
                    onApply={onDateRangeApply}
                    disabled={disabled}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onDateRangeApply(tempDateRange)}
                  disabled={disabled || (!tempDateRange.startDate && !tempDateRange.endDate)}
                  className="px-4 h-10 text-sm font-semibold text-white bg-brand-fill rounded-lg hover:bg-brand-fill-hover focus:outline-none transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t.filter}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Mobile: collapsible content (date range + secondary filters) */}
        {activeTab !== 'scheduled' && isExpanded && (
          <div className="md:hidden space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <DateRangePicker
                  value={tempDateRange}
                  onChange={onDateRangeChange}
                  applyImmediately={false}
                  onApply={onDateRangeApply}
                  disabled={disabled}
                />
              </div>
              <button
                type="button"
                onClick={() => onDateRangeApply(tempDateRange)}
                disabled={disabled || (!tempDateRange.startDate && !tempDateRange.endDate)}
                className="px-4 h-10 text-sm font-semibold text-white bg-brand-fill rounded-lg hover:bg-brand-fill-hover focus:outline-none transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t.filter}
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-content-secondary mb-1">
                  {t.type}
                </label>
                <SelectCombobox
                  value={typeFilter}
                  onValueChange={onTypeFilterChange}
                  options={[
                    { value: 'todos', label: t.all },
                    { value: TransactionType.INCOME, label: t.income },
                    { value: TransactionType.EXPENSE, label: t.expense },
                  ]}
                  placeholder={t.allTypes || t.all}
                  disabled={disabled}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-content-secondary mb-1">
                  {t.category}
                </label>
                <CategoryMultiCombobox
                  values={categoryFilter}
                  onValuesChange={onCategoryFilterChange}
                  householdId={householdId}
                  disabled={disabled}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-content-secondary mb-1">
                  {t.paymentStatus}
                </label>
                <SelectCombobox
                  value={paidFilter}
                  onValueChange={onPaidFilterChange}
                  options={[
                    { value: 'todos', label: t.all },
                    { value: 'paid', label: t.paid },
                    { value: 'pending', label: t.pending },
                  ]}
                  placeholder={t.allStatus || t.all}
                  disabled={disabled}
                />
              </div>
            </div>
          </div>
        )}

        {/* Segunda linha: Filtros de Tipo, Categoria e Status (desktop) */}
        <div className="hidden md:grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1">
              {t.type}
            </label>
            <SelectCombobox
              value={typeFilter}
              onValueChange={onTypeFilterChange}
              options={[
                { value: 'todos', label: t.all },
                { value: TransactionType.INCOME, label: t.income },
                { value: TransactionType.EXPENSE, label: t.expense },
              ]}
              placeholder={t.allTypes || t.all}
              disabled={disabled}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1">
              {t.category}
            </label>
            <CategoryMultiCombobox
              values={categoryFilter}
              onValuesChange={onCategoryFilterChange}
              householdId={householdId}
              disabled={disabled}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1">
              {t.paymentStatus}
            </label>
            <SelectCombobox
              value={paidFilter}
              onValueChange={onPaidFilterChange}
              options={[
                { value: 'todos', label: t.all },
                { value: 'paid', label: t.paid },
                { value: 'pending', label: t.pending },
              ]}
              placeholder={t.allStatus || t.all}
              disabled={disabled}
            />
          </div>
        </div>
      </div>

      {hasActiveFilters && (
        <button
          onClick={onClearFilters}
          disabled={disabled}
          className={`mt-3 inline-flex items-center gap-1 rounded-full bg-brand-soft px-3 h-8 text-sm font-semibold text-brand-on-soft ${
            disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-brand/15'
          }`}
        >
          <X className="h-4 w-4" aria-hidden="true" />
          {t.clearFilters}
        </button>
      )}
    </div>
  );
};
