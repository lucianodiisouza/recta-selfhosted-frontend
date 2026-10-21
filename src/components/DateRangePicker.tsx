import { useState, useRef, useEffect } from 'react';
import { Calendar, X } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, isSameMonth, startOfDay, endOfDay } from 'date-fns';
import { ptBR as ptBRLocale } from 'date-fns/locale/pt-BR';
import { enUS as enUSLocale } from 'date-fns/locale/en-US';
import { es as esLocale } from 'date-fns/locale/es';
import { fr as frLocale } from 'date-fns/locale/fr';
import { ru as ruLocale } from 'date-fns/locale/ru';
import { ja as jaLocale } from 'date-fns/locale/ja';
import { zhCN as zhCNLocale } from 'date-fns/locale/zh-CN';
import { arSA as arSALocale } from 'date-fns/locale/ar-SA';
import type { Locale } from 'date-fns/locale';
import { useI18n } from '../context/I18nContext';
import { DatePicker } from './DatePicker';

export type DateRange = {
  startDate: Date | null;
  endDate: Date | null;
};

export type DateRangePreset = 'thisMonth' | 'lastMonth' | 'last3Months' | 'last6Months' | 'thisYear' | 'lastYear' | 'all' | 'custom';

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  presets?: DateRangePreset[];
  className?: string;
  applyImmediately?: boolean; // If false, onChange is only called for presets, not for custom date changes
  onApply?: (range: DateRange) => void; // Callback when preset is selected (only used when applyImmediately is false)
  disabled?: boolean;
}

const localeMap: Record<string, Locale> = {
  'pt-BR': ptBRLocale,
  'en-US': enUSLocale,
  'es-ES': esLocale,
  'fr-FR': frLocale,
  'ru-RU': ruLocale,
  'ja-JP': jaLocale,
  'zh-CN': zhCNLocale,
  'ar-SA': arSALocale,
};

export const DateRangePicker = ({ value, onChange, presets = ['thisMonth', 'lastMonth', 'last3Months', 'thisYear', 'all', 'custom'], className = '', applyImmediately = true, onApply, disabled = false }: DateRangePickerProps) => {
  const { locale, t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<DateRangePreset | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentLocale = localeMap[locale] || ptBRLocale;

  const getPresetRange = (preset: DateRangePreset): DateRange => {
    const today = new Date();

    switch (preset) {
      case 'thisMonth': {
        return {
          startDate: startOfMonth(today),
          endDate: endOfMonth(today),
        };
      }
      case 'lastMonth': {
        const lastMonth = subMonths(today, 1);
        return {
          startDate: startOfMonth(lastMonth),
          endDate: endOfMonth(lastMonth),
        };
      }
      case 'last3Months': {
        return {
          startDate: startOfMonth(subMonths(today, 2)),
          endDate: endOfMonth(today),
        };
      }
      case 'last6Months': {
        return {
          startDate: startOfMonth(subMonths(today, 5)),
          endDate: endOfMonth(today),
        };
      }
      case 'thisYear': {
        return {
          startDate: new Date(today.getFullYear(), 0, 1),
          endDate: new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999),
        };
      }
      case 'lastYear': {
        const lastYear = today.getFullYear() - 1;
        return {
          startDate: new Date(lastYear, 0, 1),
          endDate: new Date(lastYear, 11, 31, 23, 59, 59, 999),
        };
      }
      case 'all':
        return {
          startDate: null,
          endDate: null,
        };
      case 'custom':
        return value;
      default:
        return { startDate: null, endDate: null };
    }
  };

  const handlePresetClick = (preset: DateRangePreset) => {
    if (preset === 'custom') {
      setSelectedPreset('custom');
      return;
    }

    const range = getPresetRange(preset);
    onChange(range);
    // If applyImmediately is false, also call onApply for presets with the range
    if (!applyImmediately && onApply) {
      onApply(range);
    }
    setSelectedPreset(preset);
    setIsOpen(false);
  };

  const handleStartDateChange = (date: Date | null) => {
    const newRange = {
      ...value,
      startDate: date ? startOfDay(date) : null,
    };
    if (applyImmediately) {
      onChange(newRange);
    } else {
      onChange(newRange); // Still update the value for display, but don't trigger query
    }
    setSelectedPreset('custom');
  };

  const handleEndDateChange = (date: Date | null) => {
    const newRange = {
      ...value,
      endDate: date ? endOfDay(date) : null,
    };
    if (applyImmediately) {
      onChange(newRange);
    } else {
      onChange(newRange); // Still update the value for display, but don't trigger query
    }
    setSelectedPreset('custom');
  };

  const clearRange = () => {
    onChange({ startDate: null, endDate: null });
    setSelectedPreset(null);
    setIsOpen(false);
  };

  const formatDateRange = () => {
    if (!value.startDate && !value.endDate) {
      return t.allPeriods;
    }
    if (value.startDate && value.endDate) {
      if (isSameMonth(value.startDate, value.endDate)) {
        return format(value.startDate, 'MMMM yyyy', { locale: currentLocale });
      }
      return `${format(value.startDate, 'dd/MM/yyyy', { locale: currentLocale })} - ${format(value.endDate, 'dd/MM/yyyy', { locale: currentLocale })}`;
    }
    if (value.startDate) {
      return `${t.fromDate} ${format(value.startDate, 'dd/MM/yyyy', { locale: currentLocale })}`;
    }
    if (value.endDate) {
      return `${t.toDate} ${format(value.endDate, 'dd/MM/yyyy', { locale: currentLocale })}`;
    }
    return t.selectPeriod;
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Detect preset based on current value
  useEffect(() => {
    if (!value.startDate && !value.endDate) {
      setSelectedPreset('all');
      return;
    }

    if (value.startDate && value.endDate) {
      const today = new Date();
      const thisMonthStart = startOfMonth(today);
      const thisMonthEnd = endOfMonth(today);
      const lastMonthStart = startOfMonth(subMonths(today, 1));
      const lastMonthEnd = endOfMonth(subMonths(today, 1));

      if (isSameMonth(value.startDate, thisMonthStart) && isSameMonth(value.endDate, thisMonthEnd)) {
        setSelectedPreset('thisMonth');
        return;
      }

      if (isSameMonth(value.startDate, lastMonthStart) && isSameMonth(value.endDate, lastMonthEnd)) {
        setSelectedPreset('lastMonth');
        return;
      }

      // Check other presets...
      setSelectedPreset('custom');
    } else {
      setSelectedPreset('custom');
    }
  }, [value]);

  const presetLabels: Record<DateRangePreset, string> = {
    thisMonth: t.thisMonth,
    lastMonth: t.lastMonth,
    last3Months: t.last3Months,
    last6Months: t.last6Months,
    thisYear: t.thisYear,
    lastYear: t.lastYear,
    all: t.allPeriods,
    custom: t.custom,
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center gap-2 px-3 h-10 w-full border border-line rounded-md shadow-sm bg-surface-elevated text-content-secondary focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-sm ${
          disabled 
            ? 'bg-gray-100 dark:bg-gray-900/50 text-content-tertiary cursor-not-allowed border-line' 
            : 'hover:bg-surface-sunken'
        }`}
      >
        <Calendar className="h-4 w-4" />
        <span className="text-sm font-medium">{formatDateRange()}</span>
        {value.startDate || value.endDate ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled) clearRange();
            }}
            disabled={disabled}
            className={`ml-2 text-gray-400 ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:text-content-secondary'}`}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 mt-2 w-80 bg-surface-elevated border border-line rounded-lg shadow-lg">
          <div className="p-4">
            <div className="space-y-2 mb-4">
              {presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handlePresetClick(preset)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedPreset === preset
                      ? 'bg-brand-soft text-primary-700 dark:text-primary-300'
                      : 'text-content-secondary hover:bg-surface-sunken'
                  }`}
                >
                  {presetLabels[preset]}
                </button>
              ))}
            </div>

            {selectedPreset === 'custom' && (
              <div className="space-y-3 pt-3 border-t border-line">
                <div>
                  <label className="block text-sm font-medium text-content-secondary mb-1">
                    {t.startDate}
                  </label>
                  <DatePicker
                    value={value.startDate}
                    onChange={handleStartDateChange}
                    placeholder={t.startDate}
                    maxDate={value.endDate || undefined}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-content-secondary mb-1">
                    {t.endDate}
                  </label>
                  <DatePicker
                    value={value.endDate}
                    onChange={handleEndDateChange}
                    placeholder={t.endDate}
                    minDate={value.startDate || undefined}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

