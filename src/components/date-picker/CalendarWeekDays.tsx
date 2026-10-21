import { format, eachDayOfInterval, Locale } from 'date-fns';
import { useI18n } from '../../context/I18nContext';

interface CalendarWeekDaysProps {
  calendarStart: Date;
  currentLocale: Locale;
}

export const CalendarWeekDays = ({
  calendarStart,
  currentLocale,
}: CalendarWeekDaysProps) => {
  const { locale } = useI18n();

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  if (locale !== 'pt-BR') {
    const weekDayNames = eachDayOfInterval({
      start: calendarStart,
      end: new Date(calendarStart.getTime() + 6 * 24 * 60 * 60 * 1000),
    });
    weekDays.forEach((_, index) => {
      weekDays[index] = format(weekDayNames[index], 'EEE', { locale: currentLocale });
    });
  }

  return (
    <div className="grid grid-cols-7 gap-1 mb-2">
      {weekDays.map((day, index) => (
        <div
          key={index}
          className="text-center text-xs font-medium text-content-tertiary py-1"
        >
          {day}
        </div>
      ))}
    </div>
  );
};
