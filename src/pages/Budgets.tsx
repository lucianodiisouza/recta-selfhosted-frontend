import { useState, useMemo, useEffect } from 'react';
import { useTransactions } from '../context/TransactionsContext';
import { useCurrency } from '../context/CurrencyContext';
import { useI18n } from '../context/I18nContext';
import { useCommandMenu } from '../context/CommandMenuContext';
import { Plus } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import { BudgetModal } from '../components/BudgetModal';
import { Budget } from '../types';
import { startOfMonth, format } from 'date-fns';
import { PageHeader } from '../components/PageHeader';
import { PageButton } from '../components/PageButton';
import { BudgetsSkeleton } from '../components/PageSkeletons';
import { DatePicker } from '../components/DatePicker';
import { BudgetList } from '../components/budgets';
import { useDefaultHousehold } from '../hooks/useDefaultHousehold';
import { useBudgetSummary } from '../hooks/api/useBudgets';

const Budgets = () => {
  const { budgets, deleteBudget, loading } = useTransactions();
  const { householdId } = useDefaultHousehold();
  const { baseCurrency } = useCurrency();
  const { t } = useI18n();
  const { registerHandler, unregisterHandler } = useCommandMenu();
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<Date>(startOfMonth(new Date()));
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; budgetId: string | null }>({
    isOpen: false,
    budgetId: null,
  });

  useEffect(() => {
    const handleNewBudget = () => {
      setEditingBudget(null);
      setIsModalOpen(true);
    };
    
    registerHandler('newBudget', handleNewBudget);
    
    // Escuta eventos do onboarding
    const handleTriggerCommand = (event: CustomEvent) => {
      if (event.detail?.handlerKey === 'newBudget') {
        handleNewBudget();
      }
    };
    
    window.addEventListener('triggerCommandHandler', handleTriggerCommand as EventListener);
    
    return () => {
      unregisterHandler('newBudget');
      window.removeEventListener('triggerCommandHandler', handleTriggerCommand as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const monthBudgets = useMemo(() => {
    if (!budgets || budgets.length === 0) {
      return [];
    }
    
    const filtered = budgets.filter(b => {
      if (!b.month) return false;
      const budgetMonth = startOfMonth(b.month);
      const selected = startOfMonth(selectedMonth);
      return budgetMonth.getTime() === selected.getTime();
    });
    
    return filtered;
  }, [budgets, selectedMonth]);

  // Spending comes from the backend so it covers the whole month, not only the
  // transactions this page happens to have loaded.
  const { data: summary } = useBudgetSummary({
    householdId: householdId ?? '',
    month: format(selectedMonth, 'yyyy-MM'),
  });
  const spendingByBudget = useMemo(
    () => new Map((summary?.budgets ?? []).map(b => [b.budgetId, Number(b.spending)])),
    [summary]
  );

  const budgetStatus = useMemo(() => {
    return monthBudgets.map(budget => {
      const spent = (budget.id && spendingByBudget.get(budget.id)) || 0;

      const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
      const remaining = budget.amount - spent;

      const status: 'ok' | 'warning' | 'exceeded' =
        percentage >= 100 ? 'exceeded' : percentage >= 80 ? 'warning' : 'ok';

      return {
        ...budget,
        spent,
        remaining,
        percentage,
        status,
      };
    });
  }, [monthBudgets, spendingByBudget]);

  const handleDelete = (id: string) => {
    setConfirmModal({ isOpen: true, budgetId: id });
  };

  const handleConfirmDelete = async () => {
    if (confirmModal.budgetId) {
      await deleteBudget(confirmModal.budgetId);
      setConfirmModal({ isOpen: false, budgetId: null });
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingBudget(null);
  };

  if (loading) {
    return <BudgetsSkeleton />;
  }

  return (
    <div className="dashboard-fade-in">
      <PageHeader
        title={t.budgets}
        description={t.budgetsDescription}
      >
        <DatePicker
          value={selectedMonth}
          onChange={(date) => {
            if (date) {
              setSelectedMonth(startOfMonth(date));
            }
          }}
          placeholder={t.month}
          className="w-full sm:w-auto"
        />
        <PageButton
          onClick={() => {
            setEditingBudget(null);
            setIsModalOpen(true);
          }}
          variant="primary"
          icon={Plus}
          aria-label={t.newBudget}
          className="h-10"
        >
          {t.newBudget}
        </PageButton>
      </PageHeader>

      <BudgetList
        budgets={budgetStatus}
        baseCurrency={baseCurrency}
        onEdit={(budget) => {
          setEditingBudget(budget);
          setIsModalOpen(true);
        }}
        onDelete={handleDelete}
        t={t}
      />

      <BudgetModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        editingBudget={editingBudget}
        selectedMonth={selectedMonth}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, budgetId: null })}
        onConfirm={handleConfirmDelete}
        title={t.delete}
        message={t.confirmDeleteBudget}
        variant="danger"
      />
    </div>
  );
};

export default Budgets;
