import { useMemo } from 'react';
import { useTransactions } from '../../context/TransactionsContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useI18n } from '../../context/I18nContext';
import { formatCurrency } from '../../utils/format';
import { startOfMonth } from 'date-fns';
import { TransactionType, getCategoryDisplayName, CustomCategoryInfo } from '../../lib/enums';
import { Target, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getTransactionsByCategory, getTotalIncome, getTotalExpense } from '../../utils/calculations';
import { getTransactionsByMonth } from '../../utils/calculations';
import { isGeneralBudget } from '../../utils/categories';
import { useCategories } from '../../hooks/api/useCategories';
import { useDefaultHousehold } from '../../hooks/useDefaultHousehold';

interface BudgetVsRealizedWidgetProps {
  selectedMonth: Date;
  blurNumbers?: boolean;
}

export const BudgetVsRealizedWidget = ({ selectedMonth, blurNumbers = false }: BudgetVsRealizedWidgetProps) => {
  const { budgets, transactions } = useTransactions();
  const { baseCurrency } = useCurrency();
  const { t } = useI18n();
  const { householdId } = useDefaultHousehold();
  const { data: categoriesData = [] } = useCategories({ householdId: householdId || undefined });

  // Convert to CustomCategoryInfo for getCategoryDisplayName
  const customCategories: CustomCategoryInfo[] = useMemo(() => 
    categoriesData
      .filter(c => !c.isSystem)
      .map(c => ({ id: c.id, name: c.name, type: c.type, color: c.color, icon: c.icon })),
    [categoriesData]
  );

  // Helper to resolve category display name
  const resolveCategoryName = (categoryName: string): string => {
    return getCategoryDisplayName(categoryName, t as unknown as Record<string, string>, customCategories);
  };

  const budgetData = useMemo(() => {
    const monthBudgets = budgets.filter((b) => {
      const budgetMonth = startOfMonth(b.month);
      const selected = startOfMonth(selectedMonth);
      return budgetMonth.getTime() === selected.getTime();
    });

    if (monthBudgets.length === 0) return [];

    const monthTransactions = getTransactionsByMonth(transactions, selectedMonth);
    const categoryData = getTransactionsByCategory(monthTransactions);

    return monthBudgets.map((budget) => {
      let spent = 0;

      if (isGeneralBudget(budget)) {
        if (budget.type === TransactionType.EXPENSE) {
          spent = getTotalExpense(monthTransactions);
        } else {
          spent = getTotalIncome(monthTransactions);
        }
      } else {
        const categoryTransactions = categoryData.find(
          (c) => c.name === budget.category
        );
        spent =
          budget.type === TransactionType.EXPENSE
            ? categoryTransactions?.despesa || 0
            : categoryTransactions?.receita || 0;
      }

      // Calcular porcentagem, limitando a exibição para valores muito altos
      const rawPercentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
      // Limitar a porcentagem exibida a 1000% para evitar números extremos
      const percentage = Math.min(rawPercentage, 1000);
      const remaining = budget.amount - spent;
      const status: 'exceeded' | 'warning' | 'ok' =
        rawPercentage >= 100 ? 'exceeded' : rawPercentage >= 80 ? 'warning' : 'ok';

      return {
        category: budget.category,
        budget: budget.amount,
        spent,
        remaining,
        percentage,
        rawPercentage,
        status,
        type: budget.type,
      };
    }).sort((a, b) => {
      // Ordenar: exceeded primeiro, depois warning, depois ok
      const statusOrder = { exceeded: 0, warning: 1, ok: 2 };
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      // Se mesmo status, ordenar por porcentagem (maior primeiro)
      return b.percentage - a.percentage;
    });
  }, [budgets, selectedMonth, transactions]);

  if (budgetData.length === 0) {
    return (
      <div className="surface-card p-4 sm:p-6 flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          <Target className="h-5 w-5 text-brand" />
          <h2 className="card-title">
            {t.budgets}
          </h2>
        </div>
        <p className="text-sm font-medium text-content-tertiary">
          {t.noBudgetForMonth}
        </p>
      </div>
    );
  }

  return (
    <div className="surface-card p-6 flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Target className="h-5 w-5 text-brand" />
        <h2 className="card-title">
          {t.budgetsVsRealized}
        </h2>
      </div>
      <div className="space-y-4 flex-1 overflow-auto">
        {budgetData.map((budget) => {
          const StatusIcon = budget.status === 'exceeded' 
            ? AlertCircle 
            : budget.status === 'warning' 
            ? AlertCircle 
            : CheckCircle2;
          
          const statusColors = {
            exceeded: {
              bg: 'bg-negative-soft',
              border: 'border-negative/25',
              text: 'text-red-700 dark:text-red-300',
              icon: 'text-negative',
              bar: 'bg-red-600',
            },
            warning: {
              bg: 'bg-warning/10',
              border: 'border-warning/25',
              text: 'text-yellow-700 dark:text-yellow-300',
              icon: 'text-warning',
              bar: 'bg-yellow-500',
            },
            ok: {
              bg: 'bg-positive-soft',
              border: 'border-positive/25',
              text: 'text-green-700 dark:text-green-300',
              icon: 'text-positive',
              bar: 'bg-green-500',
            },
          };

          const colors = statusColors[budget.status];

          return (
            <div
              key={`${budget.category}-${budget.type}`}
              className={`p-4 rounded-lg border ${colors.bg} ${colors.border}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <StatusIcon className={`h-4 w-4 ${colors.icon}`} />
                  <span className="text-sm font-medium text-content">
                    {resolveCategoryName(budget.category)}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                    {budget.type === TransactionType.EXPENSE ? t.expense : t.income}
                  </span>
                </div>
                <span className={`text-sm font-rounded font-semibold tabular-nums ${colors.text} ${blurNumbers ? 'demo-blur' : ''}`}>
                  {blurNumbers ? '•••' : budget.rawPercentage > 1000 ? '1000%+' : `${budget.percentage.toFixed(1)}%`}
                </span>
              </div>
              
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                <div
                  className={`h-2 rounded-full transition-all ${colors.bar}`}
                  style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-content-tertiary">{t.budgeted}: </span>
                    <span className={`font-rounded font-semibold tabular-nums text-content ${blurNumbers ? 'demo-blur' : ''}`}>
                      {blurNumbers ? '••••' : formatCurrency(budget.budget, baseCurrency)}
                    </span>
                  </div>
                  <div>
                    <span className="text-content-tertiary">{t.spent}: </span>
                    <span className={`font-rounded font-semibold tabular-nums ${budget.status === 'exceeded' ? 'text-negative' : 'text-content'} ${blurNumbers ? 'demo-blur' : ''}`}>
                      {blurNumbers ? '••••' : formatCurrency(budget.spent, baseCurrency)}
                    </span>
                  </div>
                </div>
                {budget.remaining !== 0 && (
                  <div>
                    <span className={`font-medium ${budget.remaining > 0 ? 'text-positive' : 'text-negative'} ${blurNumbers ? 'demo-blur' : ''}`}>
                      {budget.remaining > 0 ? '+' : ''}
                      {blurNumbers ? '••••' : formatCurrency(budget.remaining, baseCurrency)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
