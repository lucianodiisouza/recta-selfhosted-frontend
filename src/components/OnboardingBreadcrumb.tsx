import { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTransactions } from '../context/TransactionsContext';
import { useI18n } from '../context/I18nContext';
import { TransactionType } from '../lib/enums';
import { 
  CheckCircle2, 
  Circle, 
  CreditCard, 
  Target, 
  ArrowUpCircle, 
  ArrowDownCircle,
} from 'lucide-react';

interface Goal {
  id: string;
  title: string;
  icon: React.ReactNode;
  completed: boolean;
  action: () => void;
}

const OnboardingBreadcrumb = () => {
  const { accounts, budgets, transactions } = useTransactions();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();

  const goals = useMemo<Goal[]>(() => {
    const hasAccount = accounts.length > 0;
    const hasBudget = budgets.length > 0;
    const hasIncome = transactions.some(t => t.type === TransactionType.INCOME);
    const hasExpense = transactions.some(t => t.type === TransactionType.EXPENSE);

    const handleAction = (path: string, handlerKey?: string, transactionType?: TransactionType) => {
      // Se for transação, salva o tipo no sessionStorage
      if (handlerKey === 'newTransaction' && transactionType) {
        sessionStorage.setItem('pendingTransactionType', transactionType);
      }
      
      // Se já estamos na página, chama o handler diretamente
      if (location.pathname === path && handlerKey) {
        setTimeout(() => {
          const event = new CustomEvent('triggerCommandHandler', { detail: { handlerKey } });
          window.dispatchEvent(event);
        }, 100);
      } else {
        // Navega para a página e depois tenta chamar o handler
        navigate(path);
        setTimeout(() => {
          if (handlerKey) {
            const event = new CustomEvent('triggerCommandHandler', { detail: { handlerKey } });
            window.dispatchEvent(event);
          }
        }, 300);
      }
    };

    return [
      {
        id: 'account',
        title: 'Criar uma Conta',
        icon: <CreditCard className="h-4 w-4" />,
        completed: hasAccount,
        action: () => handleAction('/app/accounts', 'newAccount'),
      },
      {
        id: 'budget',
        title: 'Definir um Orçamento',
        icon: <Target className="h-4 w-4" />,
        completed: hasBudget,
        action: () => handleAction('/app/budgets', 'newBudget'),
      },
      {
        id: 'income',
        title: 'Adicionar uma Receita',
        icon: <ArrowUpCircle className="h-4 w-4" />,
        completed: hasIncome,
        action: () => handleAction('/app/transactions', 'newTransaction', TransactionType.INCOME),
      },
      {
        id: 'expense',
        title: 'Adicionar uma Despesa',
        icon: <ArrowDownCircle className="h-4 w-4" />,
        completed: hasExpense,
        action: () => handleAction('/app/transactions', 'newTransaction', TransactionType.EXPENSE),
      },
    ];
  }, [accounts, budgets, transactions, navigate, location]);

  const completedCount = goals.filter(g => g.completed).length;
  const totalGoals = goals.length;
  const allCompleted = completedCount === totalGoals;

  // Não mostra se todas as metas estiverem completas
  if (allCompleted) {
    return null;
  }

  return (
    <div className="mb-6 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-line">
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <span className="text-xs font-medium text-content-secondary whitespace-nowrap mr-2 flex-shrink-0">
          {t.goals || 'Metas'}:
        </span>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {goals.map((goal, index) => (
            <div key={goal.id} className="flex items-center flex-shrink-0">
              {index > 0 && (
                <div className="mx-1 text-gray-300 dark:text-gray-600 flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
              <button
                onClick={() => !goal.completed && goal.action()}
                className={`
                  flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base font-medium transition-all duration-200 whitespace-nowrap flex-shrink-0
                  ${goal.completed 
                    ? 'bg-positive-soft text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700' 
                    : 'bg-warning/10 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-700 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 cursor-pointer'
                  }
                `}
              >
                {goal.completed ? (
                  <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 flex-shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-600 flex-shrink-0" />
                )}
                <span className="hidden sm:inline">{goal.title}</span>
                <span className="sm:hidden">{goal.icon}</span>
              </button>
            </div>
          ))}
        </div>
        <div className="ml-auto text-xs text-content-tertiary whitespace-nowrap flex-shrink-0">
          {completedCount}/{totalGoals}
        </div>
      </div>
    </div>
  );
};

export default OnboardingBreadcrumb;

