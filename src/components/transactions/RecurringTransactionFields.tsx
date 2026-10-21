import { useI18n } from '../../context/I18nContext';
import { DatePicker } from '../DatePicker';
import SelectCombobox from '../SelectCombobox';
import { addDays, addWeeks, addMonths, addYears } from 'date-fns';

interface RecurringTransactionFieldsProps {
  isRecurring: boolean;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';
  startDate: Date;
  endDate?: Date;
  nextDueDate: Date;
  onFrequencyChange: (frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly') => void;
  onStartDateChange: (date: Date) => void;
  onEndDateChange: (date: Date | undefined) => void;
  onNextDueDateChange: (date: Date) => void;
  disabled?: boolean;
}

const calculateNextDueDate = (startDate: Date, frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly'): Date => {
  switch (frequency) {
    case 'daily':
      return addDays(startDate, 1);
    case 'weekly':
      return addWeeks(startDate, 1);
    case 'biweekly':
      return addWeeks(startDate, 2);
    case 'monthly':
      return addMonths(startDate, 1);
    case 'yearly':
      return addYears(startDate, 1);
    default:
      return addMonths(startDate, 1);
  }
};

export const RecurringTransactionFields = ({
  isRecurring,
  frequency,
  startDate,
  endDate,
  nextDueDate,
  onFrequencyChange,
  onStartDateChange,
  onEndDateChange,
  onNextDueDateChange,
  disabled = false,
}: RecurringTransactionFieldsProps) => {
  const { t } = useI18n();

  if (!isRecurring) {
    return null;
  }

  const handleFrequencyChange = (value: string) => {
    const freq = value as 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';
    onFrequencyChange(freq);
    const newNextDueDate = calculateNextDueDate(startDate, freq);
    onNextDueDateChange(newNextDueDate);
  };

  const handleStartDateChange = (date: Date | null) => {
    if (date) {
      onStartDateChange(date);
      const newNextDueDate = calculateNextDueDate(date, frequency);
      onNextDueDateChange(newNextDueDate);
    }
  };

  return (
    <div className="space-y-4 border-t pt-4 mt-4">
      <div>
        <label className="block text-sm font-medium text-content-secondary mb-1">
          {t.frequency}
        </label>
        <SelectCombobox
          value={frequency}
          onValueChange={handleFrequencyChange}
          options={[
            { value: 'daily', label: t.daily },
            { value: 'weekly', label: t.weekly },
            { value: 'biweekly', label: t.biweekly },
            { value: 'monthly', label: t.monthly },
            { value: 'yearly', label: t.yearly },
          ]}
          placeholder={t.selectFrequency}
          disabled={disabled}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-content-secondary mb-1">
          {t.startDate}
        </label>
        <DatePicker
          value={startDate}
          onChange={handleStartDateChange}
          placeholder={t.startDate}
          useModal={true}
          disabled={disabled}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-content-secondary mb-1">
          {t.endDate} ({t.optional})
        </label>
        <DatePicker
          value={endDate || undefined}
          onChange={(date) => onEndDateChange(date || undefined)}
          placeholder={t.endDate}
          minDate={startDate}
          useModal={true}
          disabled={disabled}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-content-secondary mb-1">
          {t.nextDueDate}
        </label>
        <DatePicker
          value={nextDueDate}
          onChange={(date) => date && onNextDueDateChange(date)}
          placeholder={t.nextDueDate}
          minDate={startDate}
          useModal={true}
          disabled={disabled}
        />
        <p className="mt-1 text-xs text-content-tertiary">
          {t.optional}
        </p>
      </div>
    </div>
  );
};
