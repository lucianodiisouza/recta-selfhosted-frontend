import { format, isSameMonth, isToday, Locale } from 'date-fns';

interface CalendarGridProps {
  days: Date[];
  currentMonth: Date;
  selectedDate: Date | null;
  minDate?: Date;
  maxDate?: Date;
  currentLocale: Locale;
  onDateSelect: (date: Date) => void;
}

export const CalendarGrid = ({
  days,
  currentMonth,
  selectedDate,
  minDate,
  maxDate,
  currentLocale: _currentLocale,
  onDateSelect,
}: CalendarGridProps) => {

  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((day, index) => {
        const dayYear = day.getFullYear();
        const dayMonth = day.getMonth();
        const dayDate = day.getDate();
        
        const isCurrentMonth = isSameMonth(day, currentMonth);
        
        const isSelected = selectedDate && 
          selectedDate.getFullYear() === dayYear &&
          selectedDate.getMonth() === dayMonth &&
          selectedDate.getDate() === dayDate;
        
        const isTodayDate = isToday(day);
        
        const isDisabled = (() => {
          if (!isCurrentMonth) return true;
          if (minDate) {
            const minYear = minDate.getFullYear();
            const minMonth = minDate.getMonth();
            const minDay = minDate.getDate();
            if (dayYear < minYear || (dayYear === minYear && dayMonth < minMonth) || 
                (dayYear === minYear && dayMonth === minMonth && dayDate < minDay)) {
              return true;
            }
          }
          if (maxDate) {
            const maxYear = maxDate.getFullYear();
            const maxMonth = maxDate.getMonth();
            const maxDay = maxDate.getDate();
            if (dayYear > maxYear || (dayYear === maxYear && dayMonth > maxMonth) || 
                (dayYear === maxYear && dayMonth === maxMonth && dayDate > maxDay)) {
              return true;
            }
          }
          return false;
        })();

        return (
          <button
            key={index}
            type="button"
            onClick={() => {
              if (!isDisabled) {
                const selectedDate = new Date(dayYear, dayMonth, dayDate, 12, 0, 0, 0);
                selectedDate.setHours(0, 0, 0, 0);
                onDateSelect(selectedDate);
              }
            }}
            disabled={isDisabled}
            className={`
              h-9 w-9 text-sm rounded-md transition-colors
              ${
                isDisabled
                  ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                  : 'hover:bg-surface-sunken cursor-pointer'
              }
              ${
                isSelected
                  ? 'bg-primary-600 text-white hover:bg-primary-700'
                  : isCurrentMonth
                  ? 'text-content'
                  : 'text-content-tertiary'
              }
              ${isTodayDate && !isSelected ? 'ring-2 ring-primary-500' : ''}
            `}
          >
            {format(day, 'd')}
          </button>
        );
      })}
    </div>
  );
};
