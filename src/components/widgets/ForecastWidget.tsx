import { useMemo } from 'react';
import { useCurrency } from '../../context/CurrencyContext';
import { useI18n } from '../../context/I18nContext';
import { formatCurrency } from '../../utils/format';
import { TrendingUp, AlertCircle, Info } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { DashboardForecast } from '../../hooks/api/useTransactions';

type Forecast = DashboardForecast;

interface ForecastWidgetProps {
  forecast: Forecast;
  blurNumbers?: boolean;
}

export const ForecastWidget = ({ forecast, blurNumbers = false }: ForecastWidgetProps) => {
  const { baseCurrency } = useCurrency();
  const { t, locale } = useI18n();

  // Balance projected for the next 6 months (backend forecast.next6Months)
  const next6Months = useMemo(
    () =>
      (forecast.next6Months ?? []).map((m) => {
        const [year, month] = m.month.split('-').map(Number);
        return {
          label: new Date(year, month - 1, 1).toLocaleDateString(locale, { month: 'short' }),
          balance: Number(m.predictedBalance),
        };
      }),
    [forecast.next6Months, locale]
  );

  // Calcular taxa de poupança projetada
  const projectedSavingsRate = useMemo(() => {
    if (forecast.predictedIncome === 0) return 0;
    return (forecast.predictedBalance / forecast.predictedIncome) * 100;
  }, [forecast]);

  // Determinar status da projeção
  const forecastStatus = useMemo(() => {
    if (forecast.predictedBalance >= 0 && projectedSavingsRate >= 20) {
      return { 
        type: 'excellent', 
        icon: TrendingUp, 
        message: t.forecastExcellentMessage,
        color: 'text-positive',
        bgColor: 'bg-positive-soft',
        borderColor: 'border-positive/25'
      };
    }
    if (forecast.predictedBalance >= 0 && projectedSavingsRate >= 10) {
      return { 
        type: 'good', 
        icon: TrendingUp, 
        message: t.forecastGoodMessage,
        color: 'text-info',
        bgColor: 'bg-info/10',
        borderColor: 'border-info/25'
      };
    }
    if (forecast.predictedBalance >= 0) {
      return { 
        type: 'warning', 
        icon: AlertCircle, 
        message: t.forecastWarningMessage,
        color: 'text-warning',
        bgColor: 'bg-warning/10',
        borderColor: 'border-warning/25'
      };
    }
    return { 
      type: 'critical', 
      icon: AlertCircle, 
      message: t.forecastCriticalMessage,
      color: 'text-negative',
      bgColor: 'bg-negative-soft',
      borderColor: 'border-negative/25'
    };
  }, [forecast, projectedSavingsRate, t]);

  const StatusIcon = forecastStatus.icon;

  return (
    <div className="surface-card p-4 sm:p-6 flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 sm:mb-4">
        <h2 className="card-title">
          {t.forecast}
        </h2>
        <span className="text-xs text-content-tertiary">{t.forecastNextMonth}</span>
      </div>
      
      <div className="space-y-3 sm:space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          <div className="p-2.5 sm:p-3 rounded-lg bg-surface-sunken">
            <div className="text-xs text-content-tertiary mb-1">{t.predictedIncome}</div>
            <div className={`text-base sm:text-lg font-rounded font-semibold tabular-nums text-positive break-words ${blurNumbers ? 'demo-blur' : ''}`}>
              {blurNumbers ? '••••' : formatCurrency(forecast.predictedIncome, baseCurrency)}
            </div>
          </div>
          <div className="p-2.5 sm:p-3 rounded-lg bg-surface-sunken">
            <div className="text-xs font-medium text-content-tertiary mb-1">{t.predictedExpense}</div>
            <div className={`text-base sm:text-lg font-rounded font-semibold tabular-nums text-negative break-words ${blurNumbers ? 'demo-blur' : ''}`}>
              {blurNumbers ? '••••' : formatCurrency(forecast.predictedExpense, baseCurrency)}
            </div>
          </div>
        </div>

        <div className="pt-3 sm:pt-4 border-t border-line">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0 mb-2">
            <div className="text-xs sm:text-sm font-medium text-content-secondary">{t.predictedBalance}</div>
            {forecast.predictedIncome > 0 && (
              <div className="text-xs text-content-tertiary">
                {blurNumbers ? '••' : `${projectedSavingsRate.toFixed(1)}%`} {t.forecastSavingsRate}
              </div>
            )}
          </div>
          <div
            className={`text-xl sm:text-2xl font-rounded font-semibold tabular-nums break-words ${
              forecast.predictedBalance >= 0
                ? 'text-positive'
                : 'text-negative'
            } ${blurNumbers ? 'demo-blur' : ''}`}
          >
            {blurNumbers ? '••••' : formatCurrency(forecast.predictedBalance, baseCurrency)}
          </div>
        </div>

        {next6Months.length > 0 && !blurNumbers && (
          <div className="pt-3 sm:pt-4 border-t border-line">
            <div className="text-xs sm:text-sm font-medium text-content-secondary mb-2">
              {t.forecastNext6Months}
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={next6Months} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#6B6B78', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value, baseCurrency)}
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="balance"
                  name={t.predictedBalance}
                  stroke="#5B3DF5"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Status da projeção */}
        <div className={`mt-4 p-3 rounded-lg border ${forecastStatus.bgColor} ${forecastStatus.borderColor}`}>
          <div className="flex items-start gap-2">
            <StatusIcon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${forecastStatus.color}`} />
            <p className={`text-xs ${forecastStatus.color}`}>
              {forecastStatus.message}
            </p>
          </div>
        </div>

        {/* Nota sobre projeção */}
        <div className="flex items-start gap-2 text-xs text-content-tertiary">
          <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <p>
            {t.forecastNote}
          </p>
        </div>
      </div>
    </div>
  );
};


