import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, Locale } from 'date-fns';
import { useI18n } from '../../context/I18nContext';

interface CalendarHeaderProps {
  currentMonth: Date;
  currentLocale: Locale;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onGoToToday: () => void;
}

export const CalendarHeader = ({
  currentMonth,
  currentLocale,
  onPreviousMonth,
  onNextMonth,
  onGoToToday,
}: CalendarHeaderProps) => {
  const { locale } = useI18n();

  return (
    <div className="flex items-center justify-between mb-4">
      <button
        type="button"
        onClick={onPreviousMonth}
        className="p-1 hover:bg-surface-sunken rounded"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-content">
          {format(currentMonth, 'MMMM yyyy', { locale: currentLocale })}
        </h3>
        <button
          type="button"
          onClick={onGoToToday}
          className="text-xs text-brand hover:underline"
        >
          {locale === 'pt-BR' ? 'Hoje' : 'Today'}
        </button>
      </div>
      <button
        type="button"
        onClick={onNextMonth}
        className="p-1 hover:bg-surface-sunken rounded"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
};
