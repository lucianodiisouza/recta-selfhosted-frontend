import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrency } from '../../context/CurrencyContext';
import { useI18n } from '../../context/I18nContext';
import { formatCurrency } from '../../utils/format';
import { 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  format,
  getDay,
  addMonths,
  subMonths,
  startOfDay,
  endOfDay
} from 'date-fns';
import { ptBR as ptBRLocale } from 'date-fns/locale/pt-BR';
import { enUS as enUSLocale } from 'date-fns/locale/en-US';
import { es as esLocale } from 'date-fns/locale/es';
import { fr as frLocale } from 'date-fns/locale/fr';
import { ru as ruLocale } from 'date-fns/locale/ru';
import { ja as jaLocale } from 'date-fns/locale/ja';
import { zhCN as zhCNLocale } from 'date-fns/locale/zh-CN';
import { arSA as arSALocale } from 'date-fns/locale/ar-SA';
import { useSpendingHeatmap } from '../../hooks/api/useTransactions';
import { useDefaultHousehold } from '../../hooks/useDefaultHousehold';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface SpendingHeatmapWidgetProps {
  selectedMonth?: Date;
}

export const SpendingHeatmapWidget = ({ 
  selectedMonth = new Date() 
}: SpendingHeatmapWidgetProps) => {
  const navigate = useNavigate();
  const { baseCurrency } = useCurrency();
  const { t, locale } = useI18n();
  const { householdId } = useDefaultHousehold();
  
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(selectedMonth));
  const today = useMemo(() => new Date(), []);
  const currentMonthStart = useMemo(() => startOfMonth(today), [today]);
  
  // Atualizar quando selectedMonth mudar externamente
  useEffect(() => {
    setCurrentMonth(startOfMonth(selectedMonth));
  }, [selectedMonth]);
  
  // Calcular limites de navegação (3 meses para frente e para trás)
  const minMonth = useMemo(() => subMonths(currentMonthStart, 3), [currentMonthStart]);
  const maxMonth = useMemo(() => addMonths(currentMonthStart, 3), [currentMonthStart]);
  
  const canGoBack = currentMonth > minMonth;
  const canGoForward = currentMonth < maxMonth;
  
  const handlePreviousMonth = () => {
    if (canGoBack) {
      setCurrentMonth(subMonths(currentMonth, 1));
    }
  };
  
  const handleNextMonth = () => {
    if (canGoForward) {
      setCurrentMonth(addMonths(currentMonth, 1));
    }
  };

  // Format month for API (YYYY-MM)
  const monthParam = useMemo(() => {
    return format(currentMonth, 'yyyy-MM');
  }, [currentMonth]);

  // Fetch heatmap data using optimized endpoint
  const { data: heatmapData, isLoading } = useSpendingHeatmap({
    householdId: householdId || undefined,
    month: monthParam,
  });

  const currentLocale = useMemo(() => {
    switch (locale) {
      case 'pt-BR':
        return ptBRLocale;
      case 'en-US':
        return enUSLocale;
      case 'es-ES':
        return esLocale;
      case 'fr-FR':
        return frLocale;
      case 'ru-RU':
        return ruLocale;
      case 'ja-JP':
        return jaLocale;
      case 'zh-CN':
        return zhCNLocale;
      case 'ar-SA':
        return arSALocale;
      default:
        return enUSLocale;
    }
  }, [locale]);

  // Get spending data from backend response
  const spendingByDayOfMonth = useMemo(() => {
    if (!heatmapData?.data) return [];
    return heatmapData.data;
  }, [heatmapData]);

  const maxAmount = useMemo(() => {
    if (spendingByDayOfMonth.length === 0) return 1;
    return Math.max(...spendingByDayOfMonth.map(d => d.amount), 1);
  }, [spendingByDayOfMonth]);

  // Calculate month boundaries for week grid
  const monthStart = useMemo(() => startOfMonth(currentMonth), [currentMonth]);
  const monthEnd = useMemo(() => endOfMonth(currentMonth), [currentMonth]);

  // Organizar por semanas (estilo GitHub) - sempre 6 semanas para altura fixa
  const weeks = useMemo(() => {
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    const weeks: Array<Array<{ day: number; amount: number; date: Date }>> = [];
    let currentWeek: Array<{ day: number; amount: number; date: Date }> = [];
    
    // Preencher dias vazios no início da primeira semana
    const firstDayOfWeek = getDay(monthStart);
    for (let i = 0; i < firstDayOfWeek; i++) {
      currentWeek.push({ day: 0, amount: 0, date: new Date() });
    }
    
    days.forEach(day => {
      const dayData = spendingByDayOfMonth.find(d => d.day === day.getDate());
      currentWeek.push({
        day: day.getDate(),
        amount: dayData?.amount || 0,
        date: day,
      });
      
      if (getDay(day) === 6) { // Domingo = 0, Sábado = 6
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });
    
    // Preencher dias vazios no final da última semana
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push({ day: 0, amount: 0, date: new Date() });
      }
      weeks.push(currentWeek);
    }
    
    // Garantir sempre 6 semanas para altura fixa
    while (weeks.length < 6) {
      weeks.push(Array(7).fill({ day: 0, amount: 0, date: new Date() }));
    }
    
    return weeks;
  }, [monthStart, monthEnd, spendingByDayOfMonth]);

  const getIntensity = (amount: number): number => {
    if (amount === 0) return 0;
    const intensity = Math.min(amount / maxAmount, 1);
    return Math.ceil(intensity * 4); // 0-4 levels (5 níveis total)
  };

  const getColorClass = (intensity: number): string => {
    // Cores para gastos - gradiente vermelho/laranja (quanto mais escuro, mais gasto)
    const colors = [
      'bg-surface-sunken border border-line', // 0 - nenhum gasto
      'bg-[#ffc1cc] dark:bg-[#4a1a1a]', // 1 - baixo (rosa claro)
      'bg-[#ff8a95] dark:bg-[#6b1f1f]', // 2 - médio-baixo (rosa médio)
      'bg-[#ff6b7a] dark:bg-[#8b2525]', // 3 - médio (vermelho claro)
      'bg-[#ff4757] dark:bg-[#b82e2e]', // 4 - alto (vermelho)
      'bg-[#ee2c3c] dark:bg-[#d63031]', // 5 - muito alto (vermelho escuro)
    ];
    return colors[intensity] || colors[0];
  };

  const handleDayClick = (dayDate: Date) => {
    // Navegar para transações filtradas por despesas do dia específico
    const dayStart = startOfDay(dayDate);
    const dayEnd = endOfDay(dayDate);
    
    // Formatar datas no formato ISO (YYYY-MM-DD)
    const startDateStr = format(dayStart, 'yyyy-MM-dd');
    const endDateStr = format(dayEnd, 'yyyy-MM-dd');
    
    navigate(`/app/transactions?type=EXPENSE&startDate=${startDateStr}&endDate=${endDateStr}`);
  };

  const totalSpending = useMemo(() => {
    return heatmapData?.total || 0;
  }, [heatmapData]);

  const daysOfWeek = useMemo(() => {
    // Get localized day names
    const baseDate = new Date(2024, 0, 7); // Sunday
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(baseDate);
      date.setDate(baseDate.getDate() + i);
      return format(date, 'EEE', { locale: currentLocale });
    });
  }, [currentLocale]);

  return (
    <div className="surface-card p-4 sm:p-6 flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-brand" aria-hidden="true" />
          <h3 className="card-title">
            {t.spendingByDayOfMonth}
          </h3>
        </div>
        
        {/* Navegação de meses */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePreviousMonth}
            disabled={!canGoBack}
            className={`p-1 rounded-md transition-colors ${
              canGoBack
                ? 'text-content-secondary hover:bg-surface-sunken hover:text-brand'
                : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
            }`}
            aria-label={t.previousMonth}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          
          <div className="text-xs text-content-secondary font-medium min-w-[80px] text-center">
            {format(currentMonth, 'MMM yyyy', { locale: currentLocale })}
          </div>
          
          <button
            onClick={handleNextMonth}
            disabled={!canGoForward}
            className={`p-1 rounded-md transition-colors ${
              canGoForward
                ? 'text-content-secondary hover:bg-surface-sunken hover:text-brand'
                : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
            }`}
            aria-label={t.nextMonth}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Legenda - cores para gastos */}
      <div className="flex items-center justify-end gap-2.5 mb-4 text-[10px] text-content-tertiary">
        <span className="text-content-tertiary">{t.less}</span>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm bg-surface-sunken border border-line" />
          <div className="w-2.5 h-2.5 rounded-sm bg-[#ffc1cc] dark:bg-[#4a1a1a]" />
          <div className="w-2.5 h-2.5 rounded-sm bg-[#ff8a95] dark:bg-[#6b1f1f]" />
          <div className="w-2.5 h-2.5 rounded-sm bg-[#ff6b7a] dark:bg-[#8b2525]" />
          <div className="w-2.5 h-2.5 rounded-sm bg-[#ff4757] dark:bg-[#b82e2e]" />
        </div>
        <span className="text-content-tertiary">{t.more}</span>
      </div>

      {/* Calendário Heatmap - layout tradicional */}
      <div className="mb-5">
        {/* Cabeçalho dos dias da semana */}
        <div className="grid grid-cols-7 gap-1.5 mb-2">
          {daysOfWeek.map((day, index) => (
            <div 
              key={`${day}-${index}`} 
              className="text-xs text-center text-content-secondary font-semibold uppercase tracking-wide"
            >
              {day.substring(0, 3)}
            </div>
          ))}
        </div>

        {/* Grid do calendário - 7 colunas, sempre 6 semanas para altura fixa */}
        <div className="grid grid-cols-7 gap-1.5">
          {isLoading ? (
            // Loading skeleton
            Array.from({ length: 42 }).map((_, i) => (
              <div
                key={`skeleton-${i}`}
                className="w-full h-10 sm:h-12 rounded-lg bg-surface-sunken animate-pulse"
              />
            ))
          ) : (
            weeks.flatMap((week, weekIndex) =>
              week.map((dayData, dayIndex) => {
                if (dayData.day === 0) {
                  return (
                    <div 
                      key={`empty-${weekIndex}-${dayIndex}`} 
                      className="w-full h-10 sm:h-12"
                    />
                  );
                }
                
                const intensity = getIntensity(dayData.amount);
                const colorClass = getColorClass(intensity);
                
                return (
                  <div
                    key={`${dayData.day}-${weekIndex}-${dayIndex}`}
                    onClick={() => handleDayClick(dayData.date)}
                    className={`${colorClass} w-full h-10 sm:h-12 rounded-lg relative group cursor-pointer transition-[transform,box-shadow] duration-150 hover:ring-2 hover:ring-brand hover:scale-[1.04] flex items-center justify-center motion-reduce:hover:scale-100`}
                    title={`${dayData.day} ${format(dayData.date, 'MMM', { locale: currentLocale })}: ${formatCurrency(dayData.amount, baseCurrency)}`}
                  >
                    {/* Número do dia */}
                    <span className={`text-[11px] font-semibold ${
                      intensity === 0
                        ? 'text-content-secondary'
                        : intensity >= 3
                        ? 'text-white dark:text-gray-100'
                        : 'text-content-secondary'
                    }`}>
                      {dayData.day}
                    </span>
                    
                    {/* Tooltip - apenas no hover */}
                    {dayData.amount > 0 && (
                      <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[9999]">
                        <div className="bg-surface-elevated text-content text-xs px-3 py-2 rounded-lg shadow-floating ring-1 ring-line-subtle whitespace-nowrap">
                          <div className="font-semibold mb-1 text-center">
                            {dayData.day} {format(dayData.date, 'MMM', { locale: currentLocale })}
                          </div>
                          <div className="font-medium text-center text-primary-300 dark:text-primary-600">
                            {formatCurrency(dayData.amount, baseCurrency)}
                          </div>
                        </div>
                        {/* Seta do tooltip */}
                        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                          <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-gray-900 dark:border-t-gray-100"></div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-line flex items-center justify-between">
        <span className="text-xs text-content-tertiary">
          {t.monthlyTotal}:
        </span>
        <span className="text-sm font-semibold text-content">
          {formatCurrency(totalSpending, baseCurrency)}
        </span>
      </div>
    </div>
  );
};
