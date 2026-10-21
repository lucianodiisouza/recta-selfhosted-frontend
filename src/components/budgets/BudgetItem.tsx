import { Budget } from '../../types';
import { formatCurrency } from '../../utils/format';
import { BudgetActionsMenu } from '../BudgetActionsMenu';
import { isGeneralBudget } from '../../utils/categories';

interface BudgetItemProps {
  budget: Budget & {
    spent: number;
    remaining: number;
    percentage: number;
    status: 'exceeded' | 'warning' | 'ok';
  };
  baseCurrency: string;
  onEdit: (budget: Budget) => void;
  onDelete: (id: string) => void;
  t: Record<string, string>;
}

export const BudgetItem = ({
  budget,
  baseCurrency,
  onEdit,
  onDelete,
  t,
}: BudgetItemProps) => {
  return (
    <li key={budget.id} className="px-5 sm:px-6 py-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="card-title mb-4">
            {isGeneralBudget(budget) ? t.general : budget.category}
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-medium text-content-secondary mb-1">
                  {t.budgetAmount}
                </div>
                <div className="font-rounded text-lg font-semibold tabular-nums text-content">
                  {formatCurrency(budget.amount, baseCurrency)}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-content-secondary mb-1">
                  {t.spent}
                </div>
                <div className="font-rounded text-lg font-semibold tabular-nums text-content">
                  {formatCurrency(budget.spent, baseCurrency)}
                </div>
              </div>
            </div>
            <div className="pt-4 border-t border-line-subtle">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-content-secondary">
                  {budget.remaining >= 0 ? t.remaining : t.exceeded}
                </span>
                <span className={`font-rounded text-[15px] font-semibold tabular-nums ${
                  budget.remaining >= 0 ? 'text-positive' : 'text-negative'
                }`}>
                  {formatCurrency(Math.abs(budget.remaining), baseCurrency)}
                </span>
              </div>
              <div className="w-full bg-line rounded-full h-2 mb-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    budget.status === 'exceeded' ? 'bg-negative' :
                    budget.status === 'warning' ? 'bg-[#F79009]' : 'bg-positive'
                  }`}
                  style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                />
              </div>
              <div className="text-xs text-content-tertiary tabular-nums">
                {budget.percentage.toFixed(1)}% {t.used}
              </div>
            </div>
          </div>
        </div>
        <BudgetActionsMenu
          budget={budget}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
    </li>
  );
};
