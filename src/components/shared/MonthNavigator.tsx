import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addMonths, subMonths, format } from 'date-fns';
import { ptBR as ptBRLocale } from 'date-fns/locale/pt-BR';
import { enUS as enUSLocale } from 'date-fns/locale/en-US';
import { es as esLocale } from 'date-fns/locale/es';
import { fr as frLocale } from 'date-fns/locale/fr';
import { ru as ruLocale } from 'date-fns/locale/ru';
import { ja as jaLocale } from 'date-fns/locale/ja';
import { zhCN as zhCNLocale } from 'date-fns/locale/zh-CN';
import { arSA as arSALocale } from 'date-fns/locale/ar-SA';
import { Locale } from '../../context/I18nContext';

interface MonthNavigatorProps {
  selectedMonth: Date;
  onMonthChange: (month: Date) => void;
  locale?: Locale;
  className?: string;
}

const localeMap: Record<Locale, any> = {
  'pt-BR': ptBRLocale,
  'en-US': enUSLocale,
  'es-ES': esLocale,
  'fr-FR': frLocale,
  'ru-RU': ruLocale,
  'ja-JP': jaLocale,
  'zh-CN': zhCNLocale,
  'ar-SA': arSALocale,
};

export const MonthNavigator = ({ 
  selectedMonth, 
  onMonthChange, 
  locale = 'pt-BR',
  className = '' 
}: MonthNavigatorProps) => {
  const currentLocale = localeMap[locale] || ptBRLocale;

  const handlePrevMonth = () => {
    onMonthChange(subMonths(selectedMonth, 1));
  };

  const handleNextMonth = () => {
    onMonthChange(addMonths(selectedMonth, 1));
  };

  const formattedMonth = format(selectedMonth, 'MMMM yyyy', { locale: currentLocale });

  // Chevrons around the month, like the app's month switcher.
  return (
    <div className={`inline-flex items-center gap-1 rounded-full bg-surface-elevated p-1 shadow-card dark:shadow-none dark:ring-1 dark:ring-line/60 ${className}`}>
      <button
        onClick={handlePrevMonth}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-brand-on-soft hover:bg-brand/15 transition-colors rtl:rotate-180"
        aria-label="Mês anterior"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
      </button>

      <span className="min-w-[8.5rem] px-2 text-center text-[15px] font-semibold capitalize text-content" aria-live="polite">
        {formattedMonth}
      </span>

      <button
        onClick={handleNextMonth}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-brand-on-soft hover:bg-brand/15 transition-colors rtl:rotate-180"
        aria-label="Próximo mês"
      >
        <ChevronRight className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
      </button>
    </div>
  );
};
