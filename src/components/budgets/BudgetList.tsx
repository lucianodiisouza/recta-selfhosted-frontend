import { Target } from 'lucide-react';
import { EmptyState } from '../ui';
import { Budget } from '../../types';
import { BudgetItem } from './BudgetItem';
import { AlertCircle } from 'lucide-react';

interface BudgetListProps {
  budgets: Array<Budget & {
    spent: number;
    remaining: number;
    percentage: number;
    status: 'exceeded' | 'warning' | 'ok';
  }>;
  baseCurrency: string;
  onEdit: (budget: Budget) => void;
  onDelete: (id: string) => void;
  t: Record<string, string>;
}

export const BudgetList = ({
  budgets,
  baseCurrency,
  onEdit,
  onDelete,
  t,
}: BudgetListProps) => {
  const exceededCount = budgets.filter(b => b.status === 'exceeded').length;
  const warningCount = budgets.filter(b => b.status === 'warning').length;

  return (
    <>
      {/* Alertas */}
      {exceededCount > 0 || warningCount > 0 ? (
        <div className="mb-6 border-l-4 border-yellow-400 dark:border-yellow-500 bg-yellow-50/50 dark:bg-yellow-900/10 p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-warning" />
            <div className="ml-3">
              <p className="text-sm font-light text-yellow-700 dark:text-yellow-300">
                Você tem {exceededCount} orçamento(s) excedido(s) e{' '}
                {warningCount} próximo(s) do limite
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Lista de orçamentos */}
      <div className="surface-card overflow-hidden">
        {budgets.length === 0 ? (
          <EmptyState icon={Target} title={t.noBudgetForThisMonth} />
        ) : (
          <ul className="divide-y divide-line-subtle">
            {budgets.map((budget) => (
              <BudgetItem
                key={budget.id}
                budget={budget}
                baseCurrency={baseCurrency}
                onEdit={onEdit}
                onDelete={onDelete}
                t={t}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  );
};
