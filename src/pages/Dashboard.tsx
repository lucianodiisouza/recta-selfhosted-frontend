import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTransactions } from '../context/TransactionsContext';
import { useI18n } from '../context/I18nContext';
import { useNavigate } from 'react-router-dom';
import { WhatsNewModal, WHATS_NEW_DISMISSED_KEY } from '../components/WhatsNewModal';
import { useAuth } from '../context/AuthContext';
import { useUser } from '../hooks/api/useUsers';

import { DashboardWidgetConfig } from '../components/DashboardWidgetConfig';
import { useDashboardPreferences } from '../hooks/useDashboardPreferences';
import { WidgetId } from '../types';
import { QuickActionButton } from '../components/QuickActionButton';
import { PageHeader } from '../components/PageHeader';
import {
  startOfMonth,
  addMonths,
  subMonths,
  startOfYear,
  startOfQuarter,
} from 'date-fns';
import { Plus, Minus, Settings } from 'lucide-react';
import { TransactionType } from '../lib/enums';
import { useDemoBlur } from '../context/DemoBlurContext';
import {
  SummaryCards,
  BudgetAlerts,
} from '../components/widgets';
import { DashboardFilters, DashboardWidgetsRenderer } from '../components/dashboard';
import {
  useDashboardData,
  useDashboardForecast,
  useDashboardTrend,
  useAccountBalances,
  useMonthlyComparison,
  useBalanceEvolution,
} from '../hooks/useDashboardData';
import { useBudgetAlerts } from '../hooks/useBudgetAlerts';
import { MonthlyRecapModal, useMonthlyRecapCheck } from '../components/MonthlyRecap';
import { useDefaultHousehold } from '../hooks/useDefaultHousehold';
import { useCommandMenu } from '../context/CommandMenuContext';

const Dashboard = () => {
  const { loading } = useTransactions();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { isBlurred } = useDemoBlur();
  const { currentUser } = useAuth();
  const { data: user } = useUser();
  const {
    preferences,
    loading: preferencesLoading,
  } = useDashboardPreferences();
  const [showWhatsNewModal, setShowWhatsNewModal] = useState(false);
  const { householdId } = useDefaultHousehold();
  const { shouldShow: shouldShowRecap, markAsSeen: markRecapAsSeen } = useMonthlyRecapCheck();
  const [showRecapModal, setShowRecapModal] = useState(false);

  // Verificar se deve mostrar o modal de novidades (uma vez por release)
  useEffect(() => {
    const checkShouldShowWhatsNewModal = () => {
      if (!currentUser) {
        setShowWhatsNewModal(false);
        return;
      }

      // Verificar se já foi dispensado nesta versão
      const dismissed = localStorage.getItem(WHATS_NEW_DISMISSED_KEY);
      if (dismissed === 'true') {
        setShowWhatsNewModal(false);
        return;
      }

      // Só mostrar após o onboarding
      if (user?.onboardingCompleted === true) {
        setTimeout(() => {
          setShowWhatsNewModal(true);
        }, 1000);
      }
    };

    const timer = setTimeout(() => {
      checkShouldShowWhatsNewModal();
    }, 500);

    return () => clearTimeout(timer);
  }, [currentUser, user]);

  // Verificar se deve mostrar o Monthly Recap
  useEffect(() => {
    if (shouldShowRecap && householdId) {
      // Pequeno delay para não aparecer imediatamente
      setTimeout(() => {
        setShowRecapModal(true);
      }, 2000);
    }
  }, [shouldShowRecap, householdId]);

  const handleCloseRecap = () => {
    setShowRecapModal(false);
    markRecapAsSeen();
  };

  // Registrar handler para o CommandMenu
  const { registerHandler, unregisterHandler } = useCommandMenu();

  // Função para abrir o modal manualmente (para desenvolvimento/teste)
  const handleOpenRecap = useCallback(() => {
    if (householdId) {
      setShowRecapModal(true);
      // Track analytics
      import('../utils/analytics').then(({ analyticsHelpers }) => {
        analyticsHelpers.logMonthlyRecapViewed();
      });
    }
  }, [householdId]);
  
  useEffect(() => {
    registerHandler('showMonthlyRecap', handleOpenRecap);
    return () => {
      unregisterHandler('showMonthlyRecap');
    };
  }, [registerHandler, unregisterHandler, handleOpenRecap]);

  // Expor função globalmente para poder chamar do console do navegador
  useEffect(() => {
    (window as any).openMonthlyRecap = handleOpenRecap;
    // Também adicionar função para limpar o localStorage
    (window as any).resetMonthlyRecap = () => {
      localStorage.removeItem('monthlyRecapLastShown');
      handleOpenRecap();
    };
    return () => {
      delete (window as any).openMonthlyRecap;
      delete (window as any).resetMonthlyRecap;
    };
  }, [handleOpenRecap]);

  // Persistência do mês selecionado
  const currentMonth = startOfMonth(new Date());
  const getInitialMonth = () => {
    const saved = localStorage.getItem('dashboard-selected-month');
    if (saved) {
      try {
        const parsed = new Date(saved);
        if (!isNaN(parsed.getTime())) {
          return startOfMonth(parsed);
        }
      } catch (e) {
        // Ignora erro e usa mês atual
      }
    }
    return currentMonth;
  };

  const [selectedMonth, setSelectedMonth] = useState<Date>(getInitialMonth);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisYear' | 'custom'>('thisMonth');

  // Salvar mês selecionado no localStorage
  useEffect(() => {
    localStorage.setItem('dashboard-selected-month', selectedMonth.toISOString());
  }, [selectedMonth]);

  const orderedWidgets = useMemo(() => {
    return [...preferences.widgets].sort((a, b) => a.order - b.order);
  }, [preferences.widgets]);

  const {
    totalIncome,
    totalExpense,
    categoryData,
    incomeChange,
    expenseChange,
    balanceChange,
    dashboardData: _dashboardData,
  } = useDashboardData(selectedMonth);

  const {
    accountBalances,
    totalAvailableBalance,
    totalProjectedBalance,
  } = useAccountBalances();

  const forecast = useDashboardForecast(selectedMonth);
  const trend = useDashboardTrend(selectedMonth, totalIncome, totalExpense);
  const budgetAlerts = useBudgetAlerts(selectedMonth, categoryData, totalExpense, totalIncome);

  // Use data from the optimized backend endpoint
  const monthlyComparisonFromBackend = useMonthlyComparison(selectedMonth);
  const balanceEvolutionFromBackend = useBalanceEvolution(selectedMonth);

  // Convert backend format to expected widget format
  const monthlyComparison = useMemo(() => {
    return monthlyComparisonFromBackend.map(item => ({
      month: item.month,
      receita: item.income,
      despesa: item.expense,
    }));
  }, [monthlyComparisonFromBackend]);

  const balanceEvolution = useMemo(() => {
    return balanceEvolutionFromBackend.map(item => ({
      month: item.month,
      saldoAcumulado: item.balance,
    }));
  }, [balanceEvolutionFromBackend]);

  // Monthly comparison navigation is now based on selectedMonth
  // The backend provides 6 months of data ending at the selected month
  const canGoBack = false; // Navigation via main month selector
  const canGoForward = false; // Navigation via main month selector

  const handlePreviousMonths = () => {
    // Navigate via main month selector instead
    setSelectedMonth(subMonths(selectedMonth, 1));
  };

  const handleNextMonths = () => {
    // Navigate via main month selector instead
    setSelectedMonth(addMonths(selectedMonth, 1));
  };

  const handleResetToCurrent = () => {
    setSelectedMonth(currentMonth);
  };

  // Handlers para atalhos rápidos
  const handleQuickAddIncome = () => {
    sessionStorage.setItem('pendingTransactionType', TransactionType.INCOME);
    navigate('/app/transactions');
    setTimeout(() => {
      const event = new CustomEvent('triggerCommandHandler', { detail: { handlerKey: 'newTransaction' } });
      window.dispatchEvent(event);
    }, 200);
  };

  const handleQuickAddExpense = () => {
    sessionStorage.setItem('pendingTransactionType', TransactionType.EXPENSE);
    navigate('/app/transactions');
    setTimeout(() => {
      const event = new CustomEvent('triggerCommandHandler', { detail: { handlerKey: 'newTransaction' } });
      window.dispatchEvent(event);
    }, 200);
  };

  // Handler para voltar ao mês atual
  const handleBackToCurrentMonth = () => {
    setSelectedMonth(currentMonth);
    setPeriodFilter('thisMonth');
  };

  // Handlers para filtros rápidos
  const handlePeriodFilter = (period: 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisYear') => {
    setPeriodFilter(period);
    let targetMonth = currentMonth;
    
    switch (period) {
      case 'thisMonth':
        targetMonth = currentMonth;
        break;
      case 'lastMonth':
        targetMonth = subMonths(currentMonth, 1);
        break;
      case 'thisQuarter':
        targetMonth = startOfQuarter(new Date());
        break;
      case 'thisYear':
        targetMonth = startOfYear(new Date());
        break;
    }
    
    setSelectedMonth(startOfMonth(targetMonth));
  };


  const renderWidget = (widgetId: WidgetId) => {
    return (
      <DashboardWidgetsRenderer
        widgetId={widgetId}
        loading={loading}
        preferencesLoading={preferencesLoading}
        isBlurred={isBlurred}
        selectedMonth={selectedMonth}
        accountBalances={accountBalances}
        trend={trend}
        forecast={forecast}
        totalProjectedBalance={totalProjectedBalance}
        totalAvailableBalance={totalAvailableBalance}
        balanceEvolution={balanceEvolution}
        monthlyComparison={monthlyComparison}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onPreviousMonths={handlePreviousMonths}
        onNextMonths={handleNextMonths}
        onResetToCurrent={handleResetToCurrent}
        incomeChange={incomeChange}
        expenseChange={expenseChange}
        balanceChange={balanceChange}
        totalIncome={totalIncome}
        totalExpense={totalExpense}
        categoryData={categoryData}
        t={t}
      />
    );
  };


  const isCurrentMonth = selectedMonth.getTime() === currentMonth.getTime();

  return (
    <div className="max-w-7xl mx-auto" role="main" aria-label={t.dashboard}>
      <div className="mb-3 sm:mb-6 flex flex-col gap-2 sm:gap-4">
        <PageHeader
          title={t.dashboard}
          description={t.overview}
        >
          <QuickActionButton
            icon={Plus}
            label={t.income}
            onClick={handleQuickAddIncome}
            variant="success"
          />
          <QuickActionButton
            icon={Minus}
            label={t.expense}
            onClick={handleQuickAddExpense}
            variant="danger"
          />
          <button
            onClick={() => setIsConfigOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface-elevated text-content-secondary hover:bg-surface-sunken hover:text-content transition-colors"
            aria-label={t.configureWidgets}
          >
            <Settings className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </PageHeader>

        {/* Filtros rápidos e seletor de mês */}
        <DashboardFilters
          selectedMonth={selectedMonth}
          periodFilter={periodFilter}
          onMonthChange={(date) => {
            setSelectedMonth(startOfMonth(date));
            setPeriodFilter('custom');
          }}
          onPeriodFilter={handlePeriodFilter}
          onBackToCurrentMonth={handleBackToCurrentMonth}
          isCurrentMonth={isCurrentMonth}
          t={t}
        />
      </div>

      <BudgetAlerts budgetAlerts={budgetAlerts} blurNumbers={isBlurred} />

      <section 
        key={selectedMonth.toString()} 
        className="mb-6 sm:mb-8 dashboard-fade-in"
        aria-label={t.financialSummary}
      >
        <SummaryCards
          totalIncome={totalIncome}
          totalExpense={totalExpense}
          totalAvailableBalance={totalAvailableBalance}
          loading={loading || preferencesLoading}
          blurNumbers={isBlurred}
          incomeChange={incomeChange}
          expenseChange={expenseChange}
          balanceChange={balanceChange}
          onIncomeClick={() => navigate('/app/transactions?type=INCOME')}
          onExpenseClick={() => navigate('/app/transactions?type=EXPENSE')}
        />
      </section>

      <section key={`widgets-${selectedMonth.toString()}`} className="widget-transition dashboard-fade-in space-y-4 sm:space-y-6 lg:space-y-8" aria-label={t.dashboardWidgets}>
        {orderedWidgets
          .filter(widget => widget.enabled)
          .map((widget) => (
            <div key={widget.id}>
              {renderWidget(widget.id)}
            </div>
          ))}
      </section>

      <DashboardWidgetConfig
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
      />

      <WhatsNewModal
        isOpen={showWhatsNewModal}
        onClose={() => setShowWhatsNewModal(false)}
      />

      {householdId && (
        <MonthlyRecapModal
          isOpen={showRecapModal}
          onClose={handleCloseRecap}
          householdId={householdId}
        />
      )}
    </div>
  );
};

export default Dashboard;
