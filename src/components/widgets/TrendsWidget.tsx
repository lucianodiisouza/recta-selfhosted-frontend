import { useMemo } from 'react';
import { useI18n } from '../../context/I18nContext';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Trend {
  incomeChange: number;
  expenseChange: number;
  incomeTrend: 'up' | 'down' | 'stable';
  expenseTrend: 'up' | 'down' | 'stable';
}

interface TrendsWidgetProps {
  trend: Trend;
  blurNumbers?: boolean;
}

export const TrendsWidget = ({ trend, blurNumbers = false }: TrendsWidgetProps) => {
  const { t } = useI18n();

  // Determinar saúde geral da tendência
  const overallHealth = useMemo(() => {
    const incomeGood = trend.incomeTrend === 'up' || trend.incomeTrend === 'stable';
    const expenseGood = trend.expenseTrend === 'down' || trend.expenseTrend === 'stable';
    if (incomeGood && expenseGood) return { labelKey: 'healthExcellent' as const, color: 'text-positive', bgColor: 'bg-positive-soft' };
    if (incomeGood || expenseGood) return { labelKey: 'healthGood' as const, color: 'text-info', bgColor: 'bg-info/10' };
    return { labelKey: 'healthAttention' as const, color: 'text-warning', bgColor: 'bg-warning/10' };
  }, [trend]);

  return (
    <div className="surface-card p-4 sm:p-6 flex flex-col">
      <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
        <h2 className="card-title">
          {t.trends}
        </h2>
        <span className={`text-xs font-medium px-2 py-1 rounded flex-shrink-0 ${overallHealth.bgColor} ${overallHealth.color}`}>
          {t[overallHealth.labelKey]}
        </span>
      </div>
      
      <div className="space-y-3 sm:space-y-4">
        <div className="p-2.5 sm:p-3 rounded-lg bg-surface-sunken">
          <div className="flex items-center justify-between mb-1 gap-2">
            <span className="text-xs sm:text-sm font-medium text-content-secondary">{t.totalIncome}</span>
            <div className="flex items-center flex-shrink-0">
              {trend.incomeTrend === 'up' && (
                <>
                  <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-positive mr-1.5 sm:mr-2" />
                  <span className={`text-xs sm:text-sm font-rounded font-semibold tabular-nums text-positive whitespace-nowrap ${blurNumbers ? 'demo-blur' : ''}`}>
                    +{Math.abs(trend.incomeChange).toFixed(1)}%
                  </span>
                </>
              )}
              {trend.incomeTrend === 'down' && (
                <>
                  <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-negative mr-1.5 sm:mr-2" />
                  <span className={`text-xs sm:text-sm font-rounded font-semibold tabular-nums text-negative whitespace-nowrap ${blurNumbers ? 'demo-blur' : ''}`}>
                    -{Math.abs(trend.incomeChange).toFixed(1)}%
                  </span>
                </>
              )}
              {trend.incomeTrend === 'stable' && (
                <>
                  <Minus className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-content-tertiary mr-1.5 sm:mr-2" />
                  <span className="text-xs sm:text-sm font-medium text-content-secondary whitespace-nowrap">{t.noChange}</span>
                </>
              )}
            </div>
          </div>
          <p className="text-xs text-content-tertiary">
            {t.comparedToLastMonth}
          </p>
        </div>
        
        <div className="p-2.5 sm:p-3 rounded-lg bg-surface-sunken">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs sm:text-sm font-medium text-content-secondary">{t.totalExpense}</span>
            <div className="flex items-center flex-shrink-0">
              {trend.expenseTrend === 'up' && (
                <>
                  <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-negative mr-1.5 sm:mr-2" />
                  <span className={`text-xs sm:text-sm font-rounded font-semibold tabular-nums text-negative whitespace-nowrap ${blurNumbers ? 'demo-blur' : ''}`}>
                    +{Math.abs(trend.expenseChange).toFixed(1)}%
                  </span>
                </>
              )}
              {trend.expenseTrend === 'down' && (
                <>
                  <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-positive mr-1.5 sm:mr-2" />
                  <span className={`text-xs sm:text-sm font-rounded font-semibold tabular-nums text-positive whitespace-nowrap ${blurNumbers ? 'demo-blur' : ''}`}>
                    -{Math.abs(trend.expenseChange).toFixed(1)}%
                  </span>
                </>
              )}
              {trend.expenseTrend === 'stable' && (
                <>
                  <Minus className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-content-tertiary mr-1.5 sm:mr-2" />
                  <span className="text-xs sm:text-sm font-medium text-content-secondary whitespace-nowrap">{t.noChange}</span>
                </>
              )}
            </div>
          </div>
          <p className="text-xs text-content-tertiary">
            {t.comparedToLastMonth}
          </p>
        </div>
      </div>

      {/* Resumo da tendência */}
      {trend.incomeTrend === 'up' && trend.expenseTrend === 'down' && (
        <div className="mt-4 p-3 rounded-lg bg-positive-soft border border-positive/25">
          <p className="text-xs text-green-700 dark:text-green-300">
            {t.trendGreat}
          </p>
        </div>
      )}
      {trend.incomeTrend === 'down' && trend.expenseTrend === 'up' && (
        <div className="mt-4 p-3 rounded-lg bg-warning/10 border border-warning/25">
          <p className="text-xs text-yellow-700 dark:text-yellow-300">
            {t.trendAttention}
          </p>
        </div>
      )}
    </div>
  );
};


