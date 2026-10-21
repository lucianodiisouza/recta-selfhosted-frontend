import { useTransactions } from '../../context/TransactionsContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useI18n } from '../../context/I18nContext';
import { formatCurrency } from '../../utils/format';
import { Target } from 'lucide-react';
import { differenceInDays } from 'date-fns';

interface SavingsGoalsWidgetProps {
  blurNumbers?: boolean;
}

export const SavingsGoalsWidget = ({ blurNumbers = false }: SavingsGoalsWidgetProps) => {
  const { savingsGoals } = useTransactions();
  const { baseCurrency } = useCurrency();
  const { t } = useI18n();

  if (savingsGoals.length === 0) {
    return (
      <div className="surface-card p-4 sm:p-6 flex flex-col">
        <h2 className="card-title mb-4">
          {t.savingsGoals}
        </h2>
        <div className="py-6 text-center text-sm text-content-tertiary">
          {t.noSavingsGoals}
        </div>
      </div>
    );
  }

  // Função para calcular quanto precisa guardar mensalmente
  const calculateMonthlySavings = (goal: typeof savingsGoals[0]) => {
    if (!goal.targetDate || goal.targetAmount <= 0) {
      return null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const target = goal.targetDate instanceof Date ? goal.targetDate : new Date(goal.targetDate);
    target.setHours(0, 0, 0, 0);
    
    // Verifica se a data alvo é no futuro
    if (target <= today) {
      return null;
    }

    // Calcula a diferença em dias
    const daysRemaining = differenceInDays(target, today);
    
    // Só mostra se for maior que um mês (mais de 30 dias)
    if (daysRemaining <= 30) {
      return null;
    }

    const remainingAmount = goal.targetAmount - goal.currentAmount;
    
    if (remainingAmount <= 0) {
      return null;
    }

    // Calcula o valor mensal necessário baseado nos dias restantes
    // Converte dias para meses (aproximadamente 30 dias por mês)
    const monthlyRate = (remainingAmount / daysRemaining) * 30;
    return monthlyRate;
  };

  return (
    <div className="surface-card p-4 sm:p-6 flex flex-col">
      <h2 className="card-title mb-3 sm:mb-4">
        {t.savingsGoals}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 auto-cols-max">
      {savingsGoals.map((goal) => {
        const progress = (goal.currentAmount / goal.targetAmount) * 100;
        const monthlySavings = calculateMonthlySavings(goal);
        
        return (
          <div key={goal.id} className="rounded-xl bg-surface-sunken/70 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-content text-[15px] truncate">{goal.name}</h3>
              <Target className="h-4 w-4 text-brand" />
            </div>
            <div className={`font-rounded text-[15px] font-semibold tabular-nums text-content mb-3 ${blurNumbers ? 'demo-blur' : ''}`}>
              {formatCurrency(goal.currentAmount, baseCurrency)} /{' '}
              {formatCurrency(goal.targetAmount, baseCurrency)}
            </div>
            <div className="w-full bg-line rounded-full h-1.5 mb-2">
              <div
                className="bg-brand h-1.5 rounded-full transition-all"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <div className={`text-xs font-medium text-content-tertiary mb-3 ${blurNumbers ? 'demo-blur' : ''}`}>
              {progress.toFixed(1)}% {t.completed}
            </div>
            {monthlySavings !== null && monthlySavings > 0 && (
              <div className="pt-3 border-t border-line-subtle">
                <p className="text-xs font-medium text-content-secondary">
                  <span className="text-content">
                    {t.monthlySavingsNeeded}
                  </span>
                  {' '}
                  <span className={`font-rounded font-semibold tabular-nums text-brand ${blurNumbers ? 'demo-blur' : ''}`}>
                    {formatCurrency(monthlySavings, baseCurrency)}
                  </span>
                  {' '}
                  <span className="text-content-secondary">
                    {t.perMonth} {t.toReachGoal}
                  </span>
                </p>
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
};


