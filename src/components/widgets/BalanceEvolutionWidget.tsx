import { useCurrency } from '../../context/CurrencyContext';
import { useI18n } from '../../context/I18nContext';
import { formatCurrency } from '../../utils/format';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface BalanceEvolutionWidgetProps {
  balanceEvolution: Array<{ month: string; saldoAcumulado: number }>;
  totalAvailableBalance: number;
  blurNumbers?: boolean;
}

export const BalanceEvolutionWidget = ({
  balanceEvolution,
  totalAvailableBalance,
  blurNumbers = false,
}: BalanceEvolutionWidgetProps) => {
  const { baseCurrency } = useCurrency();
  const { t } = useI18n();

  return (
    <div className="surface-card p-4 sm:p-6 flex flex-col">
      <h2 className="card-title mb-1 sm:mb-2">
        {t.balanceEvolution}
      </h2>
      <p className="text-xs sm:text-sm font-medium text-content-tertiary mb-3 sm:mb-4">
        {t.balanceEvolutionDescription}
      </p>
      <ResponsiveContainer
        width="100%"
        height={200}
        className="sm:h-[250px] lg:h-[300px]"
      >
        <AreaChart data={balanceEvolution}>
          <defs>
            <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#5B3DF5" stopOpacity={0.4} />
              <stop offset="50%" stopColor="#5B3DF5" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#5B3DF5" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid 
            strokeDasharray="0" 
            stroke="#E6E6EE" 
            strokeOpacity={0.3}
            vertical={false}
          />
          <XAxis 
            dataKey="month" 
            stroke="#7F7F8D"
            tick={{ fill: '#6B6B78', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis 
            stroke="#7F7F8D"
            tick={{ fill: '#6B6B78', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value: number) =>
              formatCurrency(value, baseCurrency)
            }
            labelFormatter={(label) => `${t.monthLabel} ${label}`}
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: 'none',
              borderRadius: '12px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              padding: '12px',
            }}
            labelStyle={{
              color: '#2C2C38',
              fontWeight: 600,
              marginBottom: '8px',
            }}
          />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="circle"
          />
          <Area
            type="monotone"
            dataKey="saldoAcumulado"
            stroke="#5B3DF5"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#colorBalance)"
            name={t.accumulatedBalance}
          />
        </AreaChart>
      </ResponsiveContainer>
      {balanceEvolution.length > 0 && (
        <div className={`mt-6 pt-4 border-t border-line flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm ${blurNumbers ? 'demo-blur' : ''}`}>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-content-tertiary mb-1">
              {t.currentBalance}
            </span>
            <span className="text-base font-rounded font-semibold tabular-nums text-content">
              {formatCurrency(totalAvailableBalance, baseCurrency)}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs font-medium text-content-tertiary mb-1">
              {t.projectedYearEnd}
            </span>
            <span
              className={`text-base font-rounded font-semibold tabular-nums ${
                balanceEvolution[balanceEvolution.length - 1]?.saldoAcumulado >=
                0
                  ? 'text-positive'
                  : 'text-negative'
              }`}
            >
              {formatCurrency(
                balanceEvolution[balanceEvolution.length - 1]?.saldoAcumulado ||
                  0,
                baseCurrency
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};


