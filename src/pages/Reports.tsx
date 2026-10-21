import { useState, useMemo, useCallback } from 'react';
import { useTransactions as useTransactionsContext } from '../context/TransactionsContext';
import { useCurrency } from '../context/CurrencyContext';
import { useI18n } from '../context/I18nContext';
import { 
  getTotalIncome, 
  getTotalExpense, 
  getBalance,
  getTransactionsByMonth,
  getMonthlyComparison,
  getTransactionsByCategory,
  isInvoicePayment,
} from '../utils/calculations';
import { formatCurrency, parseDateFromAPI } from '../utils/format';
import { format, startOfYear, endOfYear, startOfMonth, endOfMonth, subMonths, getDay, eachDayOfInterval, isSameDay } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { ExpensesByCategoryWidget, IncomeByCategoryWidget } from '../components/widgets';
import { MonthlyComparison, Transaction } from '../types';
import { TransactionType, CategoryName, getCategoryDisplayName, getCategoriesByType, CategoryType } from '../lib/enums';
import { useAllTransactions } from '../hooks/api/useTransactions';
import { useDefaultHousehold } from '../hooks/useDefaultHousehold';
import { useCategories } from '../hooks/api/useCategories';
import { PageHeader } from '../components/PageHeader';
import { ReportsSkeleton } from '../components/PageSkeletons';
import { DatePicker } from '../components/DatePicker';
import SelectCombobox from '../components/SelectCombobox';
import { TrendingUp, TrendingDown, PiggyBank, Target, AlertCircle, ArrowUpCircle, ArrowDownCircle, Download } from 'lucide-react';

const Reports = () => {
  const { recurringTransactions, accounts, loading } = useTransactionsContext();
  const { baseCurrency } = useCurrency();
  const { t } = useI18n();
  const { householdId } = useDefaultHousehold();
  const { data: categoriesData = [] } = useCategories({ householdId: householdId ?? undefined, type: undefined });
  const [reportType, setReportType] = useState<'mensal' | 'anual'>('mensal');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<Date>(startOfMonth(new Date()));

  // Calcular range de datas baseado no tipo de relatório
  const dateRange = useMemo(() => {
    if (reportType === 'mensal') {
      return {
        startDate: startOfMonth(selectedMonth),
        endDate: endOfMonth(selectedMonth),
      };
    } else {
      return {
        startDate: startOfYear(new Date(selectedYear, 0, 1)),
        endDate: endOfYear(new Date(selectedYear, 11, 31)),
      };
    }
  }, [reportType, selectedMonth, selectedYear]);

  // Buscar transações dos últimos 12 meses para monthlyComparison
  const comparisonDateRange = useMemo(() => {
    const end = endOfMonth(new Date());
    const start = subMonths(startOfMonth(new Date()), 11);
    return { startDate: start, endDate: end };
  }, []);

  // Buscar transações dos últimos 5 anos para availableYears
  const yearsDateRange = useMemo(() => {
    const end = endOfYear(new Date());
    const start = startOfYear(new Date(new Date().getFullYear() - 4, 0, 1));
    return { startDate: start, endDate: end };
  }, []);

  // Buscar transações do período necessário (sem limite - busca todas)
  const transactionsData = useAllTransactions({
    householdId: householdId || undefined,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  // Buscar transações dos últimos 12 meses para monthlyComparison (sem limite)
  const comparisonTransactionsData = useAllTransactions({
    householdId: householdId || undefined,
    startDate: comparisonDateRange.startDate,
    endDate: comparisonDateRange.endDate,
  });

  // Buscar transações dos últimos 5 anos para availableYears (sem limite)
  const yearsTransactionsData = useAllTransactions({
    householdId: householdId || undefined,
    startDate: yearsDateRange.startDate,
    endDate: yearsDateRange.endDate,
  });

  // Converter transações do backend para formato do frontend
  const custom = useMemo(() =>
    categoriesData.filter((c: { isSystem: boolean }) => !c.isSystem).map((c: { id: string; name: string; type: string; color?: string | null; icon?: string | null }) =>
      ({ id: c.id, name: c.name, type: c.type, color: c.color, icon: c.icon })
    ), [categoriesData]);

  // Helper to resolve category display name
  const resolveCategoryName = useCallback((categoryName: string): string => {
    return getCategoryDisplayName(categoryName, t as unknown as Record<string, string>, custom);
  }, [t, custom]);

  // Função auxiliar para converter transações do backend
  const convertTransactions = useCallback((data: Transaction[] | undefined) => {
    if (!data || data.length === 0) return [];
    
    return data
      .map((t) => {
        const catName = t.categoryName || 'OTHER_EXPENSES';
        const disp = () => getCategoryDisplayName(catName as CategoryName, t as unknown as Record<string, string>, custom);
        
        const type = (t.type === 'INCOME' || t.type === 'EXPENSE')
          ? (t.type === 'INCOME' ? TransactionType.INCOME : TransactionType.EXPENSE)
          : (getCategoriesByType(CategoryType.INCOME).includes(catName as CategoryName) ? TransactionType.INCOME : TransactionType.EXPENSE);
        
        let parsedDate: Date;
        try {
          if (typeof t.date === 'string') {
            parsedDate = parseDateFromAPI(t.date);
          } else if (t.date && typeof t.date === 'object' && 'getTime' in t.date) {
            parsedDate = t.date as Date;
          } else {
            parsedDate = new Date(t.date);
          }
          
          if (isNaN(parsedDate.getTime())) {
            return null;
          }
        } catch (error) {
          return null;
        }
        
        return {
          id: t.id,
          description: t.description,
          amount: Number(t.amount),
          type,
          category: disp(),
          categoryName: catName as string,
          date: parsedDate,
          paid: t.paid,
          accountId: t.accountId,
          fromAccountId: (t as any).fromAccountId,
          toAccountId: (t as any).toAccountId,
          relatedEntityId: (t as any).relatedEntityId,
          recurringTransactionId: t.recurringTransactionId,
          attachmentUrl: t.attachmentUrl,
          installmentId: t.installmentId,
          installmentNumber: t.installmentNumber,
          totalInstallments: t.totalInstallments,
          notes: (t as any).notes,
          isSplit: (t as any).isSplit || false,
          splits: (t as any).splits ? (t as any).splits.map((split: any) => ({
            userId: split.userId,
            amount: typeof split.amount === 'number' ? split.amount : (split.amount?.toNumber ? split.amount.toNumber() : Number(split.amount)),
            accountId: split.accountId || undefined,
          })) : undefined,
        } as Transaction;
      })
      .filter((x): x is Transaction => x !== null)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [custom]);

  const transactions = useMemo(() => convertTransactions(transactionsData), [transactionsData, convertTransactions]);
  const comparisonTransactions = useMemo(() => convertTransactions(comparisonTransactionsData), [comparisonTransactionsData, convertTransactions]);
  const yearsTransactions = useMemo(() => convertTransactions(yearsTransactionsData), [yearsTransactionsData, convertTransactions]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    yearsTransactions.forEach(t => {
      if (t.date) {
        years.add(t.date.getFullYear());
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [yearsTransactions]);

  const monthlyComparison = useMemo(
    () => getMonthlyComparison(comparisonTransactions, 12, undefined, recurringTransactions, accounts),
    [comparisonTransactions, recurringTransactions, accounts]
  );

  const yearTransactions = useMemo(() => {
    const start = startOfYear(new Date(selectedYear, 0, 1));
    const end = endOfYear(new Date(selectedYear, 11, 31));
    return transactions.filter(t => {
      if (!t.date) return false;
      const transactionDate = typeof t.date === 'string' ? new Date(t.date) : t.date;
      return transactionDate >= start && transactionDate <= end && !isInvoicePayment(t);
    });
  }, [transactions, selectedYear]);

  // Relatórios: o pagamento da fatura não é gasto, as compras no cartão já são (fdbk #170)
  const monthTransactions = useMemo(
    () => getTransactionsByMonth(transactions, selectedMonth).filter(t => !isInvoicePayment(t)),
    [transactions, selectedMonth]
  );

  const categoryData = useMemo(() => {
    const data = reportType === 'mensal' ? monthTransactions : yearTransactions;
    return getTransactionsByCategory(data);
  }, [reportType, monthTransactions, yearTransactions]);

  const topCategories = useMemo(() => {
    return categoryData
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
      .slice(0, 10);
  }, [categoryData]);

  const monthlyData = useMemo((): MonthlyComparison[] => {
    if (reportType !== 'anual') return [];
    
    const monthly: MonthlyComparison[] = [];
    for (let i = 0; i < 12; i++) {
      const monthStart = startOfMonth(new Date(selectedYear, i, 1));
      const monthEnd = endOfMonth(new Date(selectedYear, i, 1));
      let monthTrans = transactions.filter(t => 
        t.date >= monthStart && t.date <= monthEnd
      );
      
      // Compras no cartão contam na data da compra; o pagamento da fatura não (fdbk #170)
      monthTrans = monthTrans.filter(transaction => !isInvoicePayment(transaction));
      
      monthly.push({
        month: format(monthStart, 'MMM'),
        receita: getTotalIncome(monthTrans),
        despesa: getTotalExpense(monthTrans),
        saldo: getBalance(monthTrans),
      });
    }
    return monthly;
  }, [reportType, selectedYear, transactions]);

  const currentData = reportType === 'mensal' ? monthTransactions : yearTransactions;
  const totalIncome = getTotalIncome(currentData);
  const totalExpense = getTotalExpense(currentData);
  const balance = getBalance(currentData);

  // Dados do período anterior para comparação
  const previousPeriodData = useMemo(() => {
    if (reportType === 'mensal') {
      const previousMonth = subMonths(selectedMonth, 1);
      return getTransactionsByMonth(transactions, previousMonth);
    } else {
      const previousYear = selectedYear - 1;
      const start = startOfYear(new Date(previousYear, 0, 1));
      const end = endOfYear(new Date(previousYear, 11, 31));
      return transactions.filter(t => {
        if (!t.date) return false;
        const transactionDate = typeof t.date === 'string' ? new Date(t.date) : t.date;
        return transactionDate >= start && transactionDate <= end;
      });
    }
  }, [reportType, selectedMonth, selectedYear, transactions]);

  const previousIncome = getTotalIncome(previousPeriodData);
  const previousExpense = getTotalExpense(previousPeriodData);
  const previousBalance = getBalance(previousPeriodData);

  // Calcular variações percentuais
  const incomeChange = useMemo(() => {
    if (previousIncome === 0) return totalIncome > 0 ? 100 : 0;
    return ((totalIncome - previousIncome) / previousIncome) * 100;
  }, [totalIncome, previousIncome]);

  const expenseChange = useMemo(() => {
    if (previousExpense === 0) return totalExpense > 0 ? 100 : 0;
    return ((totalExpense - previousExpense) / previousExpense) * 100;
  }, [totalExpense, previousExpense]);

  const balanceChange = useMemo(() => {
    if (previousBalance === 0) return balance !== 0 ? (balance > 0 ? 100 : -100) : 0;
    return ((balance - previousBalance) / Math.abs(previousBalance)) * 100;
  }, [balance, previousBalance]);

  // Calcular taxa de poupança
  const savingsRate = useMemo(() => {
    if (totalIncome === 0) return 0;
    return (balance / totalIncome) * 100;
  }, [totalIncome, balance]);

  // Calcular média mensal (para relatório anual)
  const monthlyAverage = useMemo(() => {
    if (reportType === 'mensal') return null;
    return {
      income: totalIncome / 12,
      expense: totalExpense / 12,
      balance: balance / 12,
    };
  }, [reportType, totalIncome, totalExpense, balance]);

  // Calcular média histórica (últimos 3-6 meses)
  const historicalAverage = useMemo(() => {
    const monthsToCompare = reportType === 'mensal' ? 6 : 3;
    const comparisonData = reportType === 'mensal' 
      ? monthlyComparison.slice(-monthsToCompare)
      : [];
    
    if (comparisonData.length === 0) return null;

    const avgIncome = comparisonData.reduce((sum, m) => sum + m.receita, 0) / comparisonData.length;
    const avgExpense = comparisonData.reduce((sum, m) => sum + m.despesa, 0) / comparisonData.length;
    const avgBalance = comparisonData.reduce((sum, m) => sum + m.saldo, 0) / comparisonData.length;

    return {
      income: avgIncome,
      expense: avgExpense,
      balance: avgBalance,
      months: comparisonData.length,
    };
  }, [reportType, monthlyComparison]);

  // Heatmap de gastos por dia da semana
  const spendingByDayOfWeek = useMemo(() => {
    if (reportType === 'anual') return null;
    
    const monthTransactions = getTransactionsByMonth(transactions, selectedMonth);
    const expenses = monthTransactions.filter(t => {
      if (t.type !== TransactionType.EXPENSE) return false;
      if (t.type === TransactionType.TRANSFER || t.type === TransactionType.ALLOCATION) return false;
      return !isInvoicePayment(t);
    });

    const daysOfWeek = [t.daySunday, t.dayMonday, t.dayTuesday, t.dayWednesday, t.dayThursday, t.dayFriday, t.daySaturday];
    const spendingByDay: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

    expenses.forEach(t => {
      const transactionDate = typeof t.date === 'string' ? new Date(t.date) : t.date;
      const dayOfWeek = getDay(transactionDate);
      spendingByDay[dayOfWeek] += t.amount || 0;
    });

    return daysOfWeek.map((day, index) => ({
      day,
      amount: spendingByDay[index],
    }));
  }, [reportType, selectedMonth, transactions, t.daySunday, t.dayMonday, t.dayTuesday, t.dayWednesday, t.dayThursday, t.dayFriday, t.daySaturday]);

  // Heatmap de gastos por dia do mês
  const spendingByDayOfMonth = useMemo(() => {
    if (reportType === 'anual') return null;
    
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    const monthTransactions = getTransactionsByMonth(transactions, selectedMonth);
    const expenses = monthTransactions.filter(t => {
      if (!t.date) return false;
      if (t.type !== TransactionType.EXPENSE) return false;
      if (t.type === TransactionType.TRANSFER || t.type === TransactionType.ALLOCATION) return false;
      return !isInvoicePayment(t);
    });

    const spendingByDay: Record<number, number> = {};
    days.forEach(day => {
      spendingByDay[day.getDate()] = 0;
    });

    expenses.forEach(t => {
      if (!t.date) return;
      const transactionDate = typeof t.date === 'string' ? new Date(t.date) : t.date;
      if (isSameDay(transactionDate, monthStart) || 
          (transactionDate >= monthStart && transactionDate <= monthEnd)) {
        const dayOfMonth = transactionDate.getDate();
        spendingByDay[dayOfMonth] = (spendingByDay[dayOfMonth] || 0) + (t.amount || 0);
      }
    });

    return Object.entries(spendingByDay).map(([day, amount]) => ({
      day: parseInt(day),
      amount,
    }));
  }, [reportType, selectedMonth, transactions]);

  // Análise de tendências de categorias (últimos 6 meses)
  const categoryTrends = useMemo(() => {
    if (reportType === 'anual') return null;
    
    const trends: Record<string, number[]> = {};
    const categoryNames = new Set<string>();
    
    // Coletar dados dos últimos 6 meses
    for (let i = 0; i < 6; i++) {
      const month = subMonths(selectedMonth, i);
      const monthTransactions = getTransactionsByMonth(transactions, month);
      const monthCategoryData = getTransactionsByCategory(monthTransactions);
      
      monthCategoryData.forEach(cat => {
        categoryNames.add(cat.name);
        if (!trends[cat.name]) {
          trends[cat.name] = [];
        }
        trends[cat.name].unshift(Math.abs(cat.despesa)); // unshift para manter ordem cronológica
      });
    }

    // Calcular tendência para cada categoria
    return Array.from(categoryNames)
      .map(categoryName => {
        const values = trends[categoryName] || [];
        if (values.length < 2) return null;
        
        const recent = values.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, values.length);
        const older = values.slice(0, -3).reduce((a, b) => a + b, 0) / Math.max(1, values.length - 3);
        const change = older > 0 ? ((recent - older) / older) * 100 : 0;
        
        return {
          category: categoryName,
          change,
          recent,
          trend: change > 10 ? 'up' : change < -10 ? 'down' : 'stable',
        };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null)
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
      .slice(0, 5);
  }, [reportType, selectedMonth, transactions]);

  // Identificar insights úteis
  const insights = useMemo(() => {
    const result: Array<{ type: 'success' | 'warning' | 'info'; icon: typeof TrendingUp; title: string; description: string }> = [];

    // Insight sobre taxa de poupança
    if (savingsRate >= 20) {
      result.push({
        type: 'success',
        icon: PiggyBank,
        title: t.reportInsightExcellentSavingsRateTitle,
        description: t.reportInsightExcellentSavingsRateDescription.replace('{percent}', savingsRate.toFixed(1)),
      });
    } else if (savingsRate >= 10) {
      result.push({
        type: 'info',
        icon: PiggyBank,
        title: t.reportInsightGoodSavingsRateTitle,
        description: t.reportInsightGoodSavingsRateDescription.replace('{percent}', savingsRate.toFixed(1)),
      });
    } else if (savingsRate < 0) {
      result.push({
        type: 'warning',
        icon: AlertCircle,
        title: t.reportInsightNegativeSavingsRateTitle,
        description: t.reportInsightNegativeSavingsRateDescription.replace('{percent}', Math.abs(savingsRate).toFixed(1)),
      });
    }

    // Insight sobre crescimento
    if (incomeChange > 15 && expenseChange < 5) {
      result.push({
        type: 'success',
        icon: TrendingUp,
        title: t.reportInsightHealthyGrowthTitle,
        description: t.reportInsightHealthyGrowthDescription
          .replace('{incomePercent}', incomeChange.toFixed(1))
          .replace('{expensePercent}', expenseChange.toFixed(1)),
      });
    }

    // Insight sobre categoria dominante
    if (topCategories.length > 0) {
      const topCategory = topCategories[0];
      const categoryPercentage = (Math.abs(topCategory.total) / Math.abs(totalExpense || totalIncome)) * 100;
      if (categoryPercentage > 40) {
        result.push({
          type: 'info',
          icon: Target,
          title: t.reportInsightDominantCategoryTitle,
          description: t.reportInsightDominantCategoryDescription
            .replace('{category}', resolveCategoryName(topCategory.name))
            .replace('{percent}', categoryPercentage.toFixed(0)),
        });
      }
    }

    return result.slice(0, 3);
  }, [savingsRate, incomeChange, expenseChange, topCategories, totalExpense, totalIncome, t]);

  // Função para exportar relatório
  const handleExportReport = useMemo(() => {
    return () => {
      const reportData = {
        type: reportType,
        period: reportType === 'mensal' 
          ? format(selectedMonth, 'MMMM yyyy')
          : selectedYear.toString(),
        summary: {
          totalIncome,
          totalExpense,
          balance,
          savingsRate,
        },
        categories: categoryData,
        monthlyData: reportType === 'mensal' ? monthlyComparison : monthlyData,
        insights,
        exportedAt: new Date().toISOString(),
      };

      // Criar CSV
      const csvRows: string[] = [];
      csvRows.push(t.reportFinancialReport);
      csvRows.push(`Tipo: ${reportType === 'mensal' ? t.reportTypeMonthly : t.reportTypeYearly}`);
      csvRows.push(`Período: ${reportData.period}`);
      csvRows.push('');
      csvRows.push(t.reportSummary);
      csvRows.push(`${t.reportTotalIncome},${formatCurrency(totalIncome, baseCurrency)}`);
      csvRows.push(`${t.reportTotalExpense},${formatCurrency(totalExpense, baseCurrency)}`);
      csvRows.push(`${t.reportBalance},${formatCurrency(balance, baseCurrency)}`);
      csvRows.push(`${t.reportSavingsRate},${savingsRate.toFixed(2)}%`);
      csvRows.push('');
      csvRows.push(t.reportCategories);
      csvRows.push(`${t.category},${t.totalIncome},${t.totalExpense},${t.balance},% ${t.totalIncome},% ${t.totalExpense}`);
      categoryData.forEach(cat => {
        // Calcular porcentagem de receita sobre o total de receita
        const incomePercentage = totalIncome > 0 && cat.receita > 0 
          ? (cat.receita / totalIncome) * 100 
          : 0;
        
        // Calcular porcentagem de despesa sobre o total de despesa
        const expensePercentage = totalExpense > 0 && cat.despesa > 0 
          ? (cat.despesa / totalExpense) * 100 
          : 0;
        
        csvRows.push(`${resolveCategoryName(cat.name)},${formatCurrency(cat.receita, baseCurrency)},${formatCurrency(cat.despesa, baseCurrency)},${formatCurrency(cat.total, baseCurrency)},${incomePercentage > 0 ? `${incomePercentage.toFixed(2)}%` : '-'},${expensePercentage > 0 ? `${expensePercentage.toFixed(2)}%` : '-'}`);
      });

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `relatorio_${reportType}_${reportType === 'mensal' ? format(selectedMonth, 'yyyy-MM') : selectedYear}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };
  }, [reportType, selectedMonth, selectedYear, totalIncome, totalExpense, balance, savingsRate, categoryData, monthlyComparison, monthlyData, insights, baseCurrency, t.reportFinancialReport, t.reportTypeMonthly, t.reportTypeYearly, t.reportSummary, t.reportTotalIncome, t.reportTotalExpense, t.reportBalance, t.reportSavingsRate, t.reportCategories, t.category, t.totalIncome, t.totalExpense, t.balance]);

  if (loading) {
    return <ReportsSkeleton />;
  }

  return (
    <div className="dashboard-fade-in">
      <PageHeader
        title={t.reports}
        description={t.overview}
      >
        <button
          onClick={handleExportReport}
          className="inline-flex items-center gap-2 px-4 py-2 border border-line rounded-md shadow-sm text-sm font-medium text-content-secondary bg-surface-elevated hover:bg-surface-sunken focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
        >
          <Download className="h-4 w-4" />
          {t.exportReport}
        </button>
      </PageHeader>

      {/* Filtros */}
      <div className="surface-card p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-w-0">
          <div>
            <label className="block text-sm font-light text-content-tertiary mb-2">
              {t.reportType}
            </label>
            <SelectCombobox
              value={reportType}
              onValueChange={(value) => setReportType(value as 'mensal' | 'anual')}
              options={[
                { value: 'mensal', label: t.monthly },
                { value: 'anual', label: t.yearly },
              ]}
              placeholder={t.reportType}
            />
          </div>

          {reportType === 'mensal' ? (
            <div className="min-w-0 flex-1">
              <label className="block text-sm font-light text-content-tertiary mb-2">
                {t.month}
              </label>
              <DatePicker
                value={selectedMonth}
                onChange={(date) => {
                  if (date) {
                    setSelectedMonth(startOfMonth(date));
                  }
                }}
                placeholder={t.month}
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-light text-content-tertiary mb-2">
                {t.year}
              </label>
              <SelectCombobox
                value={selectedYear.toString()}
                onValueChange={(value) => setSelectedYear(parseInt(value))}
                options={availableYears.map(year => ({
                  value: year.toString(),
                  label: year.toString()
                }))}
                placeholder={t.year}
              />
            </div>
          )}
        </div>
      </div>

      {/* Resumo Melhorado */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8">
        <div className="surface-card p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5 text-positive" />
              <div className="text-sm font-medium text-content-tertiary">{t.totalIncomeLabel}</div>
            </div>
            {incomeChange !== 0 && (
              <div className={`flex items-center gap-1 text-xs ${
                incomeChange > 0 ? 'text-positive' : 'text-negative'
              }`}>
                {incomeChange > 0 ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                <span>{Math.abs(incomeChange).toFixed(1)}%</span>
              </div>
            )}
          </div>
          <div className="text-2xl sm:text-3xl font-rounded font-semibold tabular-nums text-content mb-1">
            {formatCurrency(totalIncome, baseCurrency)}
          </div>
          {previousIncome > 0 && (
            <div className="text-xs font-medium text-content-tertiary">
              {reportType === 'mensal' ? t.reportPreviousMonth : t.reportPreviousYear}: {formatCurrency(previousIncome, baseCurrency)}
            </div>
          )}
        </div>

        <div className="surface-card p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ArrowDownCircle className="h-5 w-5 text-negative" />
              <div className="text-sm font-medium text-content-tertiary">{t.totalExpenseLabel}</div>
            </div>
            {expenseChange !== 0 && (
              <div className={`flex items-center gap-1 text-xs ${
                expenseChange > 0 ? 'text-negative' : 'text-positive'
              }`}>
                {expenseChange > 0 ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                <span>{Math.abs(expenseChange).toFixed(1)}%</span>
              </div>
            )}
          </div>
          <div className="text-2xl sm:text-3xl font-rounded font-semibold tabular-nums text-content mb-1">
            {formatCurrency(totalExpense, baseCurrency)}
          </div>
          {previousExpense > 0 && (
            <div className="text-xs font-medium text-content-tertiary">
              {reportType === 'mensal' ? t.reportPreviousMonth : t.reportPreviousYear}: {formatCurrency(previousExpense, baseCurrency)}
            </div>
          )}
        </div>

        <div className="surface-card p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-content-tertiary">{t.balanceLabel}</div>
            {balanceChange !== 0 && (
              <div className={`flex items-center gap-1 text-xs ${
                balanceChange > 0 ? 'text-positive' : 'text-negative'
              }`}>
                {balanceChange > 0 ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                <span>{Math.abs(balanceChange).toFixed(1)}%</span>
              </div>
            )}
          </div>
          <div className={`text-2xl sm:text-3xl font-rounded font-semibold tabular-nums mb-1 ${
            balance >= 0 ? 'text-positive' : 'text-negative'
          }`}>
            {formatCurrency(balance, baseCurrency)}
          </div>
          {totalIncome > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <PiggyBank className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-xs font-medium text-content-tertiary">
                {t.reportSavingsRateLabel} {savingsRate.toFixed(1)}%
              </span>
            </div>
          )}
          {monthlyAverage && (
            <div className="text-xs font-medium text-content-tertiary mt-1">
              {t.reportMonthlyAverage} {formatCurrency(monthlyAverage.balance, baseCurrency)}
            </div>
          )}
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          {insights.map((insight, idx) => {
            const Icon = insight.icon;
            const bgColors = {
              success: 'bg-positive-soft border-positive/25',
              warning: 'bg-warning/10 border-warning/25',
              info: 'bg-info/10 border-info/25',
            };
            const textColors = {
              success: 'text-green-700 dark:text-green-300',
              warning: 'text-yellow-700 dark:text-yellow-300',
              info: 'text-blue-700 dark:text-blue-300',
            };
            return (
              <div key={idx} className={`p-4 rounded-lg border ${bgColors[insight.type]}`}>
                <div className="flex items-start gap-3">
                  <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${textColors[insight.type]}`} />
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-sm font-medium mb-1 ${textColors[insight.type]}`}>
                      {insight.title}
                    </h3>
                    <p className={`text-xs ${textColors[insight.type]} opacity-90`}>
                      {insight.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 mb-6 sm:mb-8">
        {/* Comparativo */}
        <div className="surface-card p-6">
          <h2 className="card-title mb-4">
            {reportType === 'mensal' ? t.annualComparison : t.monthlyComparisonOfYear}
          </h2>
          <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
            {reportType === 'mensal' ? (
              <BarChart data={monthlyComparison}>
                <CartesianGrid 
                  strokeDasharray="0" 
                  stroke="#E6E6EE" 
                  strokeOpacity={0.3}
                  vertical={false}
                />
                <XAxis 
                  dataKey="month" 
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
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="circle"
                />
                <Bar dataKey="receita" fill="#12B76A" name={t.totalIncome} radius={[8, 8, 0, 0]} />
                <Bar dataKey="despesa" fill="#F04438" name={t.totalExpense} radius={[8, 8, 0, 0]} />
              </BarChart>
            ) : (
              <BarChart data={monthlyData}>
                <CartesianGrid 
                  strokeDasharray="0" 
                  stroke="#E6E6EE" 
                  strokeOpacity={0.3}
                  vertical={false}
                />
                <XAxis 
                  dataKey="month" 
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
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="circle"
                />
                <Bar dataKey="receita" fill="#12B76A" name={t.totalIncome} radius={[8, 8, 0, 0]} />
                <Bar dataKey="despesa" fill="#F04438" name={t.totalExpense} radius={[8, 8, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Gráfico de área - Saldo */}
        <div className="surface-card p-6">
          <h2 className="card-title mb-4">
            {t.balanceEvolution}
          </h2>
          <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
            <AreaChart data={reportType === 'mensal' ? monthlyComparison : monthlyData}>
              <defs>
                <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#5B3DF5" stopOpacity={0.4} />
                  <stop offset="50%" stopColor="#5B3DF5" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#5B3DF5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid 
                strokeDasharray="0" 
                stroke="#E6E6EE" 
                strokeOpacity={0.3}
                vertical={false}
              />
              <XAxis 
                dataKey="month" 
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
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="circle"
              />
              <Area 
                type="monotone" 
                dataKey="saldo" 
                stroke="#5B3DF5" 
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorBalance)"
                name={t.balance}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gráficos de Categoria - Despesas e Receitas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 mb-6 sm:mb-8">
        <ExpensesByCategoryWidget 
          expenseByCategory={categoryData.map(cat => ({ name: cat.name, value: cat.despesa }))} 
          blurNumbers={false}
          totalExpense={totalExpense}
        />
        <IncomeByCategoryWidget 
          incomeByCategory={categoryData.map(cat => ({ name: cat.name, value: cat.receita }))} 
          blurNumbers={false}
          totalIncome={totalIncome}
        />
      </div>

      {/* Comparação com Média Histórica */}
      {historicalAverage && (
        <div className="surface-card p-6 mb-8">
          <h2 className="card-title mb-4">
            {t.historicalAverageComparison}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-surface-sunken">
              <div className="text-xs font-medium text-content-tertiary mb-1">{t.averageIncome}</div>
              <div className="text-lg font-light tracking-tight text-content mb-1">
                {formatCurrency(historicalAverage.income, baseCurrency)}
              </div>
              <div className={`text-xs font-medium ${
                totalIncome >= historicalAverage.income ? 'text-positive' : 'text-negative'
              }`}>
                {totalIncome >= historicalAverage.income ? '+' : ''}
                {((totalIncome - historicalAverage.income) / historicalAverage.income * 100).toFixed(1)}% {t.vsAverage}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-surface-sunken">
              <div className="text-xs font-medium text-content-tertiary mb-1">{t.averageExpense}</div>
              <div className="text-lg font-light tracking-tight text-content mb-1">
                {formatCurrency(historicalAverage.expense, baseCurrency)}
              </div>
              <div className={`text-xs font-medium ${
                totalExpense <= historicalAverage.expense ? 'text-positive' : 'text-negative'
              }`}>
                {totalExpense <= historicalAverage.expense ? '-' : '+'}
                {Math.abs((totalExpense - historicalAverage.expense) / historicalAverage.expense * 100).toFixed(1)}% {t.vsAverage}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-surface-sunken">
              <div className="text-xs font-medium text-content-tertiary mb-1">{t.averageBalance}</div>
              <div className="text-lg font-light tracking-tight text-content mb-1">
                {formatCurrency(historicalAverage.balance, baseCurrency)}
              </div>
              <div className={`text-xs font-medium ${
                balance >= historicalAverage.balance ? 'text-positive' : 'text-negative'
              }`}>
                {balance >= historicalAverage.balance ? '+' : ''}
                {((balance - historicalAverage.balance) / Math.abs(historicalAverage.balance || 1) * 100).toFixed(1)}% {t.vsAverage}
              </div>
            </div>
          </div>
          <p className="text-xs font-medium text-content-tertiary mt-3">
            {t.basedOnLastMonths?.replace('{months}', historicalAverage.months.toString()) || `Baseado na média dos últimos ${historicalAverage.months} meses`}
          </p>
        </div>
      )}

      {/* Heatmap de Gastos por Dia da Semana */}
      {spendingByDayOfWeek && reportType === 'mensal' && (
        <div className="surface-card p-6 mb-8">
          <h2 className="card-title mb-4">
            {t.spendingByDayOfWeek}
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={spendingByDayOfWeek}>
              <CartesianGrid 
                strokeDasharray="0" 
                stroke="#E6E6EE" 
                strokeOpacity={0.3}
                vertical={false}
              />
              <XAxis 
                dataKey="day" 
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
              <Bar dataKey="amount" fill="#F04438" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Heatmap de Gastos por Dia do Mês */}
      {spendingByDayOfMonth && reportType === 'mensal' && (
        <div className="surface-card p-6 mb-8">
          <h2 className="card-title mb-4">
            {t.spendingByDayOfMonth}
          </h2>
          <div className="grid grid-cols-7 gap-1">
            {spendingByDayOfMonth.map(({ day, amount }) => {
              const maxAmount = Math.max(...spendingByDayOfMonth.map(d => d.amount));
              const intensity = maxAmount > 0 ? (amount / maxAmount) : 0;
              const bgIntensity = Math.floor(intensity * 5); // 0-5 levels
              const bgColors = [
                'bg-surface-sunken',
                'bg-negative-soft',
                'bg-red-200 dark:bg-red-900/50',
                'bg-red-300 dark:bg-red-800/60',
                'bg-red-400 dark:bg-red-700/70',
                'bg-red-500 dark:bg-red-600/80',
              ];
              
              return (
                <div
                  key={day}
                  className={`${bgColors[bgIntensity]} p-2 rounded text-center relative group`}
                  title={`${t.reportDay} ${day}: ${formatCurrency(amount, baseCurrency)}`}
                >
                  <div className="text-xs font-medium text-content-secondary mb-1">
                    {day}
                  </div>
                  {amount > 0 && (
                    <div className="text-xs font-light text-content">
                      {formatCurrency(amount, baseCurrency)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Análise de Tendências de Categorias */}
      {categoryTrends && categoryTrends.length > 0 && (
        <div className="surface-card p-6 mb-8">
            <h2 className="card-title mb-4">
              {t.categoryTrends}
            </h2>
          <div className="space-y-3">
            {categoryTrends.map((trend) => (
              <div key={trend.category} className="flex items-center justify-between p-3 rounded-lg bg-surface-sunken">
                <div className="flex items-center gap-3">
                  {trend.trend === 'up' && <TrendingUp className="h-4 w-4 text-negative" />}
                  {trend.trend === 'down' && <TrendingDown className="h-4 w-4 text-positive" />}
                  {trend.trend === 'stable' && <div className="h-4 w-4 rounded-full bg-gray-400" />}
                  <span className="text-sm font-light text-content">
                    {trend.category}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs font-medium text-content-tertiary">
                    {t.recentAverage}: {formatCurrency(trend.recent, baseCurrency)}
                  </span>
                  <span className={`text-sm font-light tracking-tight ${
                    trend.change > 0 ? 'text-negative' : 
                    trend.change < 0 ? 'text-positive' : 
                    'text-content-secondary'
                  }`}>
                    {trend.change > 0 ? '+' : ''}{trend.change.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs font-medium text-content-tertiary mt-4">
            {t.comparisonLastMonths}
          </p>
        </div>
      )}

      {/* Top Categorias */}
      {topCategories.length > 0 && (
        <div className="surface-card p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="card-title">
              {t.topCategories}
            </h2>
            <div className="text-xs font-medium text-content-tertiary">
              {t.reportTopCategories.replace('{count}', topCategories.length.toString())}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300} className="sm:h-[400px]">
            <BarChart 
              data={topCategories}
              layout="vertical"
            >
              <CartesianGrid 
                strokeDasharray="0" 
                stroke="#E6E6EE" 
                strokeOpacity={0.3}
                horizontal={false}
              />
              <XAxis 
                type="number" 
                stroke="#7F7F8D"
                tick={{ fill: '#6B6B78', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                dataKey="name" 
                type="category" 
                width={120} 
                stroke="#7F7F8D"
                tick={{ fill: '#6B6B78', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
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
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="circle"
              />
              <Bar dataKey="receita" fill="#12B76A" name={t.totalIncome} radius={[0, 8, 8, 0]} />
              <Bar dataKey="despesa" fill="#F04438" name={t.totalExpense} radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabela de categorias */}
      {categoryData.length > 0 && (
        <div className="surface-card overflow-hidden">
          <div className="px-6 py-4 border-b border-line">
            <div className="flex items-center justify-between">
              <h2 className="card-title">
                {t.categoryDetails}
              </h2>
              <div className="text-xs font-medium text-content-tertiary">
                {categoryData.length} {categoryData.length === 1 ? t.reportCategory : t.reportCategoriesPlural}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-line-subtle">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-content-tertiary uppercase tracking-wider">
                    {t.category}
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-content-tertiary uppercase tracking-wider">
                    {t.totalIncome}
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-content-tertiary uppercase tracking-wider">
                    {t.totalExpense}
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-content-tertiary uppercase tracking-wider">
                    {t.balance}
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-content-tertiary uppercase tracking-wider">
                    % {t.totalIncome}
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-content-tertiary uppercase tracking-wider">
                    % {t.totalExpense}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-surface-elevated divide-y divide-line-subtle">
                {categoryData
                  .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
                  .map((cat, index) => {
                    // Calcular porcentagem de receita sobre o total de receita
                    const incomePercentage = totalIncome > 0 && cat.receita > 0 
                      ? (cat.receita / totalIncome) * 100 
                      : 0;
                    
                    // Calcular porcentagem de despesa sobre o total de despesa
                    const expensePercentage = totalExpense > 0 && cat.despesa > 0 
                      ? (cat.despesa / totalExpense) * 100 
                      : 0;
                    
                    return (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-light text-content">
                          {resolveCategoryName(cat.name)}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-right font-light tracking-tight text-positive">
                          {cat.receita > 0 ? formatCurrency(cat.receita, baseCurrency) : '-'}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-right font-light tracking-tight text-negative">
                          {cat.despesa > 0 ? formatCurrency(cat.despesa, baseCurrency) : '-'}
                        </td>
                        <td className={`px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-right font-light tracking-tight ${
                          cat.total >= 0 ? 'text-positive' : 'text-negative'
                        }`}>
                          {formatCurrency(cat.total, baseCurrency)}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-positive">
                          {incomePercentage > 0 ? `${incomePercentage.toFixed(1)}%` : '-'}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-negative">
                          {expensePercentage > 0 ? `${expensePercentage.toFixed(1)}%` : '-'}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;

