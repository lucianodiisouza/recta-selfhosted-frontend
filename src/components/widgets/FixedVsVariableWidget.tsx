import { useMemo } from 'react';
import { useTransactions } from '../../context/TransactionsContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useI18n } from '../../context/I18nContext';
import { formatCurrency } from '../../utils/format';
import { getTransactionsByMonth, getRecurringTransactionsForMonth, getTotalExpense } from '../../utils/calculations';
import { TransactionType, AccountType } from '../../lib/enums';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { PiePercentLabel } from './PiePercentLabel';
import type { PiePercentLabelProps } from './PiePercentLabel';
import { PIE_LEGEND_HEIGHT, pieOuterRadius } from '../../utils/pieLabel';
import { Lock, Zap } from 'lucide-react';

/** Real height of the chart: the inline height of ResponsiveContainer wins over any responsive class. */
const PIE_CHART_HEIGHT = 180;

interface FixedVsVariableWidgetProps {
  selectedMonth: Date;
  blurNumbers?: boolean;
}

const COLORS = ['#0ea5e9', '#10b981'];

export const FixedVsVariableWidget = ({ selectedMonth, blurNumbers = false }: FixedVsVariableWidgetProps) => {
  const { transactions, recurringTransactions, accounts } = useTransactions();
  const { baseCurrency } = useCurrency();
  const { t } = useI18n();

  const analysis = useMemo(() => {
    const monthTransactions = getTransactionsByMonth(transactions, selectedMonth);
    
    // Filtrar apenas transações de despesas (não receitas)
    const expenses = monthTransactions.filter(t => {
      if (t.type !== TransactionType.EXPENSE) return false;
      if (t.type === TransactionType.TRANSFER || t.type === TransactionType.ALLOCATION) return false;
      
      if (!t.accountId) return true;
      const account = accounts.find(a => a.id === t.accountId);
      if (account?.type === AccountType.CREDIT) return false;
      
      return true;
    });

    // Calcular gastos recorrentes (fixos)
    const projectedRecurring = getRecurringTransactionsForMonth(recurringTransactions, selectedMonth);
    const recurringExpenses = projectedRecurring.filter(t => {
      if (t.type !== TransactionType.EXPENSE) return false;
      if (!t.accountId) return true;
      const account = accounts.find(a => a.id === t.accountId);
      if (account?.type === AccountType.CREDIT) return false;
      return true;
    });

    const fixedExpenses = getTotalExpense(recurringExpenses);
    
    // Identificar gastos fixos reais (transações que são de recorrências)
    const recurringTransactionIds = new Set(recurringTransactions.map(rt => rt.id));
    const fixedRealExpenses = expenses
      .filter(t => t.recurringTransactionId && recurringTransactionIds.has(t.recurringTransactionId))
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    // Gastos fixos = recorrências projetadas + gastos fixos reais já pagos
    const totalFixed = fixedExpenses + fixedRealExpenses;
    
    // Gastos variáveis = total - fixos
    const totalExpenses = getTotalExpense(expenses);
    const variableExpenses = Math.max(0, totalExpenses - fixedRealExpenses);

    const total = totalFixed + variableExpenses;
    const fixedPercentage = total > 0 ? (totalFixed / total) * 100 : 0;
    const variablePercentage = total > 0 ? (variableExpenses / total) * 100 : 0;

    return {
      fixed: totalFixed,
      variable: variableExpenses,
      total,
      fixedPercentage,
      variablePercentage,
    };
  }, [transactions, recurringTransactions, selectedMonth, accounts]);

  const chartData = [
    { name: t.fixedExpenses, value: analysis.fixed },
    { name: t.variableExpenses, value: analysis.variable },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 sm:p-6 flex flex-col">
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600 dark:text-primary-400" />
        <h2 className="text-base sm:text-lg lg:text-xl font-light tracking-tight text-gray-900 dark:text-gray-100">
          {t.fixedVsVariable}
        </h2>
      </div>

      {analysis.total === 0 ? (
        <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 text-center py-6 sm:py-8">
          {t.noExpensesThisMonth}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="p-3 sm:p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-medium text-blue-700 dark:text-blue-300">{t.fixedExpenses}</span>
              </div>
              <div className={`text-lg sm:text-xl font-light tracking-tight text-blue-900 dark:text-blue-100 mb-1 break-words ${blurNumbers ? 'demo-blur' : ''}`}>
                {blurNumbers ? '••••' : formatCurrency(analysis.fixed, baseCurrency)}
              </div>
              <div className="text-xs font-medium text-blue-600 dark:text-blue-400">
                {analysis.fixedPercentage.toFixed(1)}% {t.ofTotal}
              </div>
            </div>

            <div className="p-3 sm:p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-xs font-medium text-green-700 dark:text-green-300">{t.variableExpenses}</span>
              </div>
              <div className={`text-lg sm:text-xl font-light tracking-tight text-green-900 dark:text-green-100 mb-1 break-words ${blurNumbers ? 'demo-blur' : ''}`}>
                {blurNumbers ? '••••' : formatCurrency(analysis.variable, baseCurrency)}
              </div>
              <div className="text-xs font-medium text-green-600 dark:text-green-400">
                {analysis.variablePercentage.toFixed(1)}% {t.ofTotal}
              </div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={PIE_CHART_HEIGHT} className={blurNumbers ? 'demo-blur' : ''}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(props: PiePercentLabelProps) => <PiePercentLabel {...props} />}
                // The legend below the pie takes part of the height, so the pie is sized for what is left.
                outerRadius={pieOuterRadius(PIE_CHART_HEIGHT - PIE_LEGEND_HEIGHT)}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => formatCurrency(value, baseCurrency)}
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: 'none',
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                  padding: '12px',
                }}
                labelStyle={{
                  color: '#374151',
                  fontWeight: 600,
                  marginBottom: '8px',
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>

          {analysis.fixedPercentage > 70 && (
            <div className="mt-4 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                <strong>{t.insights}:</strong> {t.fixedExpensesInsight}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
