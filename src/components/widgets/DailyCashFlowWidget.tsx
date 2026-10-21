import { useMemo } from 'react';
import { useTransactions } from '../../context/TransactionsContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useI18n } from '../../context/I18nContext';
import { formatCurrency } from '../../utils/format';
import { getTransactionsByMonth, getTotalIncome, getTotalExpense, getLiquidatedTransactions } from '../../utils/calculations';
import { format, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { TransactionType, AccountType } from '../../lib/enums';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingDown, Calendar } from 'lucide-react';

interface DailyCashFlowWidgetProps {
  selectedMonth: Date;
  totalAvailableBalance: number;
  blurNumbers?: boolean;
}

export const DailyCashFlowWidget = ({ selectedMonth, totalAvailableBalance, blurNumbers = false }: DailyCashFlowWidgetProps) => {
  const { transactions, accounts } = useTransactions();
  const { baseCurrency } = useCurrency();
  const { t } = useI18n();

  const dailyData = useMemo(() => {
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    const monthTransactions = getTransactionsByMonth(transactions, selectedMonth);
    const liquidated = getLiquidatedTransactions(monthTransactions).filter(t => {
      if (t.type === TransactionType.TRANSFER || t.type === TransactionType.ALLOCATION) return false;
      if (!t.accountId) return true;
      const account = accounts.find(a => a.id === t.accountId);
      if (account?.type === AccountType.CREDIT) return false;
      return true;
    });

    // Calcular saldo inicial do mês (saldo atual - transações do mês)
    const monthIncome = getTotalIncome(liquidated);
    const monthExpense = getTotalExpense(liquidated);
    const monthBalance = monthIncome - monthExpense;
    const initialBalance = totalAvailableBalance - monthBalance;

    let runningBalance = initialBalance;
    const dailyFlow: Array<{ date: string; income: number; expense: number; balance: number; day: number }> = [];

    days.forEach((day) => {
      const dayTransactions = liquidated.filter(t => {
        const transactionDate = typeof t.date === 'string' ? new Date(t.date) : t.date;
        return isSameDay(transactionDate, day);
      });

      const dayIncome = getTotalIncome(dayTransactions);
      const dayExpense = getTotalExpense(dayTransactions);
      runningBalance = runningBalance + dayIncome - dayExpense;

      dailyFlow.push({
        date: format(day, 'dd/MM'),
        income: dayIncome,
        expense: dayExpense,
        balance: runningBalance,
        day: day.getDate(),
      });
    });

    return dailyFlow;
  }, [transactions, selectedMonth, accounts, totalAvailableBalance]);

  // Calcular projeção até fim do mês
  const projection = useMemo(() => {
    const today = new Date();
    const monthEnd = endOfMonth(selectedMonth);
    const isCurrentMonth = isSameDay(startOfMonth(today), startOfMonth(selectedMonth));
    
    if (!isCurrentMonth || today >= monthEnd) return null;

    const daysPassed = today.getDate();
    const daysRemaining = monthEnd.getDate() - daysPassed;
    
    const currentData = dailyData.filter(d => d.day <= daysPassed);
    if (currentData.length === 0) return null;

    const avgDailyExpense = currentData.reduce((sum, d) => sum + d.expense, 0) / daysPassed;
    const avgDailyIncome = currentData.reduce((sum, d) => sum + d.income, 0) / daysPassed;
    
    const lastBalance = currentData[currentData.length - 1]?.balance || totalAvailableBalance;
    const projectedExpense = avgDailyExpense * daysRemaining;
    const projectedIncome = avgDailyIncome * daysRemaining;
    const projectedBalance = lastBalance + projectedIncome - projectedExpense;

    return {
      projectedBalance,
      projectedExpense,
      projectedIncome,
      daysRemaining,
    };
  }, [dailyData, selectedMonth, totalAvailableBalance]);

  const maxBalance = Math.max(...dailyData.map(d => d.balance), 0);
  const minBalance = Math.min(...dailyData.map(d => d.balance), 0);

  return (
    <div className="surface-card p-6 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-brand" />
          <h2 className="card-title">
            {t.dailyCashFlow}
          </h2>
        </div>
        {projection && (
          <div className="text-xs font-medium text-content-tertiary">
            {projection.daysRemaining} {t.daysRemaining}
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
        <AreaChart data={dailyData}>
          <defs>
            <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#5B3DF5" stopOpacity={0.4} />
              <stop offset="50%" stopColor="#5B3DF5" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#5B3DF5" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#12B76A" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#12B76A" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#F04438" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#F04438" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid 
            strokeDasharray="0" 
            stroke="#E6E6EE" 
            strokeOpacity={0.3}
            vertical={false}
          />
          <XAxis 
            dataKey="date" 
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
            formatter={(value: number, name: string) => [
              formatCurrency(value, baseCurrency),
              name === 'balance' ? t.balance : name === 'income' ? t.income : t.expense,
            ]}
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
          <Area
            type="monotone"
            dataKey="income"
            stroke="#12B76A"
            strokeWidth={2}
            fill="url(#colorIncome)"
            name={t.income}
          />
          <Area
            type="monotone"
            dataKey="expense"
            stroke="#F04438"
            strokeWidth={2}
            fill="url(#colorExpense)"
            name={t.expense}
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke="#5B3DF5"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#colorBalance)"
            name={t.balance}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Estatísticas */}
      <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-line">
        <div>
          <div className="text-xs font-medium text-content-tertiary mb-1">{t.maxBalance}</div>
          <div className={`text-sm font-rounded font-semibold tabular-nums text-positive ${blurNumbers ? 'demo-blur' : ''}`}>
            {blurNumbers ? '••••' : formatCurrency(maxBalance, baseCurrency)}
          </div>
        </div>
        <div>
          <div className="text-xs font-medium text-content-tertiary mb-1">{t.minBalance}</div>
          <div className={`text-sm font-rounded font-semibold tabular-nums ${minBalance >= 0 ? 'text-content' : 'text-negative'} ${blurNumbers ? 'demo-blur' : ''}`}>
            {blurNumbers ? '••••' : formatCurrency(minBalance, baseCurrency)}
          </div>
        </div>
        {projection && (
          <div>
            <div className="text-xs font-medium text-content-tertiary mb-1">{t.projectedEnd}</div>
            <div className={`text-sm font-rounded font-semibold tabular-nums ${projection.projectedBalance >= 0 ? 'text-positive' : 'text-negative'} ${blurNumbers ? 'demo-blur' : ''}`}>
              {blurNumbers ? '••••' : formatCurrency(projection.projectedBalance, baseCurrency)}
            </div>
          </div>
        )}
      </div>

      {/* Alerta se projeção for negativa */}
      {projection && projection.projectedBalance < 0 && (
        <div className="mt-4 p-3 rounded-lg bg-negative-soft border border-negative/25">
          <div className="flex items-start gap-2">
            <TrendingDown className="h-4 w-4 text-negative mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-red-800 dark:text-red-300 mb-1">
                {t.negativeProjectionWarning}
              </p>
              <p className="text-xs text-red-700 dark:text-red-300">
                {t.negativeProjectionMessage}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
