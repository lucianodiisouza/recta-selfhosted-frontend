import { useMemo } from 'react';
import { useTransactions } from '../../context/TransactionsContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useI18n } from '../../context/I18nContext';
import { formatCurrency } from '../../utils/format';
import { getTransactionsByMonth, getRecurringTransactionsForMonth, getTotalExpense, isInvoicePayment } from '../../utils/calculations';
import { TransactionType } from '../../lib/enums';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Lock, Zap } from 'lucide-react';

interface FixedVsVariableWidgetProps {
  selectedMonth: Date;
  blurNumbers?: boolean;
}

const COLORS = ['#5B3DF5', '#12B76A'];

export const FixedVsVariableWidget = ({ selectedMonth, blurNumbers = false }: FixedVsVariableWidgetProps) => {
  const { transactions, recurringTransactions } = useTransactions();
  const { baseCurrency } = useCurrency();
  const { t } = useI18n();

  const analysis = useMemo(() => {
    const monthTransactions = getTransactionsByMonth(transactions, selectedMonth);
    
    // Filtrar apenas transações de despesas (não receitas)
    const expenses = monthTransactions.filter(t => {
      if (t.type !== TransactionType.EXPENSE) return false;
      if (t.type === TransactionType.TRANSFER || t.type === TransactionType.ALLOCATION) return false;
      // Compras no cartão contam; o pagamento da fatura não (fdbk #170)
      return !isInvoicePayment(t);
    });

    // Calcular gastos recorrentes (fixos)
    const projectedRecurring = getRecurringTransactionsForMonth(recurringTransactions, selectedMonth);
    const recurringExpenses = projectedRecurring.filter(t => {
      return t.type === TransactionType.EXPENSE;
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
  }, [transactions, recurringTransactions, selectedMonth]);

  const chartData = [
    { name: t.fixedExpenses, value: analysis.fixed },
    { name: t.variableExpenses, value: analysis.variable },
  ];

  return (
    <div className="surface-card p-4 sm:p-6 flex flex-col">
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-brand" />
        <h2 className="card-title">
          {t.fixedVsVariable}
        </h2>
      </div>

      {analysis.total === 0 ? (
        <p className="text-xs sm:text-sm font-medium text-content-tertiary text-center py-6 sm:py-8">
          {t.noExpensesThisMonth}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="p-3 sm:p-4 rounded-lg bg-info/10 border border-info/25">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="h-4 w-4 text-info" />
                <span className="text-xs font-medium text-blue-700 dark:text-blue-300">{t.fixedExpenses}</span>
              </div>
              <div className={`text-lg sm:text-xl font-rounded font-semibold tabular-nums text-blue-900 dark:text-blue-100 mb-1 break-words ${blurNumbers ? 'demo-blur' : ''}`}>
                {blurNumbers ? '••••' : formatCurrency(analysis.fixed, baseCurrency)}
              </div>
              <div className="text-xs font-medium text-info">
                {analysis.fixedPercentage.toFixed(1)}% {t.ofTotal}
              </div>
            </div>

            <div className="p-3 sm:p-4 rounded-lg bg-positive-soft border border-positive/25">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-positive" />
                <span className="text-xs font-medium text-green-700 dark:text-green-300">{t.variableExpenses}</span>
              </div>
              <div className={`text-lg sm:text-xl font-rounded font-semibold tabular-nums text-green-900 dark:text-green-100 mb-1 break-words ${blurNumbers ? 'demo-blur' : ''}`}>
                {blurNumbers ? '••••' : formatCurrency(analysis.variable, baseCurrency)}
              </div>
              <div className="text-xs font-medium text-positive">
                {analysis.variablePercentage.toFixed(1)}% {t.ofTotal}
              </div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={180} className={`sm:h-[200px] ${blurNumbers ? 'demo-blur' : ''}`}>
            <PieChart>
              <Pie
                  stroke="rgb(var(--bg-elevated))"
                  strokeWidth={2}
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ percent }: { percent: number }) => `${(percent * 100).toFixed(0)}%`}
                outerRadius={70}
                fill="#5B3DF5"
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
                  color: '#2C2C38',
                  fontWeight: 600,
                  marginBottom: '8px',
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>

          {analysis.fixedPercentage > 70 && (
            <div className="mt-4 p-3 rounded-lg bg-warning/10 border border-warning/25">
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
