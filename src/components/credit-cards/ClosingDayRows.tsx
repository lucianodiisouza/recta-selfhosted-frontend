import { Calendar, CheckCircle2 } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { effectiveClosingDay } from '../../utils/closingDay';

interface ClosingDayRowsProps {
  account: { closingDay?: number | null; dueDay?: number | null };
}

/** Closing day and best day to buy of a card: the same day, since a purchase on the closing day goes to the next invoice. */
export const ClosingDayRows = ({ account }: ClosingDayRowsProps) => {
  const { t } = useI18n();
  // A card with only a due day still closes 7 days before it (see effectiveClosingDay).
  const closingDay = effectiveClosingDay(account);
  if (!closingDay) return null;

  return (
    <>
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-300">
          <Calendar className="h-4 w-4" />
          {t.closingDay}
        </div>
        <span className="text-sm font-light text-gray-900 dark:text-white">{closingDay}</span>
      </div>

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-300">
          <CheckCircle2 className="h-4 w-4" />
          {t.bestDayToBuy}
        </div>
        <span className="text-sm font-light text-green-500">{closingDay}</span>
      </div>
    </>
  );
};
