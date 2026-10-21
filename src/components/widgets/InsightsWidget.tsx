import { useMemo } from 'react';
import { useI18n } from '../../context/I18nContext';
import { useCurrency } from '../../context/CurrencyContext';
import { formatCurrency } from '../../utils/format';
import { TrendingUp, TrendingDown, AlertCircle, Target, Info, PiggyBank, Lightbulb, Zap } from 'lucide-react';
import { CategoryData } from '../../types';
import { getCategoryDisplayName, CustomCategoryInfo } from '../../lib/enums';
import { useCategories } from '../../hooks/api/useCategories';
import { useDefaultHousehold } from '../../hooks/useDefaultHousehold';

interface Insight {
  id: string;
  type: 'success' | 'warning' | 'info';
  icon: typeof TrendingUp;
  title: string;
  description: string;
}

interface InsightsWidgetProps {
  incomeChange?: number;
  expenseChange?: number;
  balanceChange?: number;
  totalIncome: number;
  totalExpense: number;
  categoryData: CategoryData[];
  blurNumbers?: boolean;
}

export const InsightsWidget = ({
  incomeChange,
  expenseChange,
  balanceChange,
  totalIncome,
  totalExpense,
  categoryData,
  blurNumbers = false,
}: InsightsWidgetProps) => {
  const { t, locale } = useI18n();
  const { baseCurrency } = useCurrency();
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

  const insights = useMemo<Insight[]>(() => {
    // Helper function to get plural suffix based on locale and count
    const getPluralSuffix = (count: number): string => {
      if (count >= 2) {
        // Return appropriate plural suffix based on locale
        if (locale === 'pt-BR' || locale === 'es-ES') {
          return 'es';
        } else if (locale === 'en-US' || locale === 'fr-FR') {
          return 's';
        }
        // For other languages (ja-JP, ru-RU, zh-CN, ar-SA), return empty as they handle plural differently
        return '';
      }
      return '';
    };
    const result: Insight[] = [];
    const balance = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? (balance / totalIncome) * 100 : 0;

    // 1. Insight sobre Taxa de Poupança (prioridade alta)
    if (totalIncome > 0) {
      if (savingsRate >= 20) {
        result.push({
          id: 'excellent-savings-rate',
          type: 'success',
          icon: PiggyBank,
          title: t.insightExcellentSavingsRateTitle,
          description: t.insightExcellentSavingsRateDescription.replace('{percent}', savingsRate.toFixed(1)),
        });
      } else if (savingsRate >= 10 && savingsRate < 20) {
        result.push({
          id: 'good-savings-rate',
          type: 'info',
          icon: PiggyBank,
          title: t.insightGoodSavingsRateTitle,
          description: t.insightGoodSavingsRateDescription.replace('{percent}', savingsRate.toFixed(1)),
        });
      } else if (savingsRate >= 0 && savingsRate < 10) {
        result.push({
          id: 'low-savings-rate',
          type: 'warning',
          icon: AlertCircle,
          title: t.insightLowSavingsRateTitle,
          description: t.insightLowSavingsRateDescription.replace('{percent}', savingsRate.toFixed(1)),
        });
      } else if (savingsRate < 0) {
        result.push({
          id: 'negative-savings-rate',
          type: 'warning',
          icon: AlertCircle,
          title: t.insightNegativeSavingsRateTitle,
          description: t.insightNegativeSavingsRateDescription.replace('{percent}', Math.abs(savingsRate).toFixed(1)),
        });
      }
    }

    // 2. Insight sobre receita (com contexto mais rico)
    if (incomeChange !== undefined && incomeChange > 15) {
      result.push({
        id: 'income-significant-increase',
        type: 'success',
        icon: TrendingUp,
        title: t.insightIncomeIncreaseTitle,
        description: t.insightIncomeIncreaseDescription
          .replace('{percent}', incomeChange.toFixed(1))
          .replace('{amount}', formatCurrency(totalIncome, baseCurrency)),
      });
    } else if (incomeChange !== undefined && incomeChange < -15) {
      result.push({
        id: 'income-significant-decrease',
        type: 'warning',
        icon: TrendingDown,
        title: t.insightIncomeDecreaseTitle,
        description: t.insightIncomeDecreaseDescription.replace('{percent}', Math.abs(incomeChange).toFixed(1)),
      });
    }

    // 3. Insight sobre despesas (com recomendações)
    if (expenseChange !== undefined && expenseChange > 20) {
      // Calculate the excess amount correctly:
      // If expenseChange = ((totalExpense - previousExpense) / previousExpense) * 100
      // Then: excessAmount = totalExpense - previousExpense
      // We can derive: previousExpense = totalExpense / (1 + expenseChange/100)
      // So: excessAmount = totalExpense - (totalExpense / (1 + expenseChange/100))
      // Simplifying: excessAmount = totalExpense * (expenseChange / (100 + expenseChange))
      const excessAmount = totalExpense * (expenseChange / (100 + expenseChange));
      result.push({
        id: 'expense-significant-increase',
        type: 'warning',
        icon: AlertCircle,
        title: t.insightExpenseIncreaseTitle,
        description: t.insightExpenseIncreaseDescription
          .replace('{percent}', expenseChange.toFixed(1))
          .replace('{amount}', formatCurrency(excessAmount, baseCurrency)),
      });
    } else if (expenseChange !== undefined && expenseChange < -15) {
      result.push({
        id: 'expense-significant-decrease',
        type: 'success',
        icon: TrendingDown,
        title: t.insightExpenseDecreaseTitle,
        description: t.insightExpenseDecreaseDescription.replace('{percent}', Math.abs(expenseChange).toFixed(1)),
      });
    }

    // 4. Insight sobre categoria dominante (mais acionável)
    if (categoryData.length > 0 && totalExpense > 0) {
      const expenseCategories = categoryData
        .filter(c => c.despesa > 0)
        .sort((a, b) => b.despesa - a.despesa);
      
      if (expenseCategories.length > 0) {
        const topCategory = expenseCategories[0];
        const topCategoryPercentage = (topCategory.despesa / totalExpense) * 100;
        
        if (topCategoryPercentage > 40) {
          result.push({
            id: 'dominant-expense-category',
            type: 'info',
            icon: Target,
            title: t.insightDominantCategoryTitle,
            description: t.insightDominantCategoryDescription
              .replace('{category}', resolveCategoryName(topCategory.name))
              .replace('{percent}', topCategoryPercentage.toFixed(0))
              .replace('{amount}', formatCurrency(topCategory.despesa, baseCurrency)),
          });
        } else if (topCategoryPercentage > 30) {
          result.push({
            id: 'major-expense-category',
            type: 'info',
            icon: Target,
            title: t.insightMajorCategoryTitle,
            description: t.insightMajorCategoryDescription
              .replace('{category}', resolveCategoryName(topCategory.name))
              .replace('{amount}', formatCurrency(topCategory.despesa, baseCurrency))
              .replace('{percent}', topCategoryPercentage.toFixed(0)),
          });
        }
      }
    }

    // 5. Insight sobre saldo (com contexto de saúde financeira)
    if (balance > 0) {
      const monthsOfExpenses = totalExpense > 0 ? balance / totalExpense : 0;
      if (monthsOfExpenses >= 3) {
        result.push({
          id: 'strong-emergency-fund',
          type: 'success',
          icon: Zap,
          title: t.insightStrongEmergencyFundTitle,
          description: t.insightStrongEmergencyFundDescription.replace('{months}', monthsOfExpenses.toFixed(1)),
        });
      } else if (monthsOfExpenses >= 1) {
        result.push({
          id: 'decent-emergency-fund',
          type: 'info',
          icon: Lightbulb,
          title: t.insightDecentEmergencyFundTitle,
          description: t.insightDecentEmergencyFundDescription
            .replace('{months}', monthsOfExpenses.toFixed(1))
            .replace('{plural}', getPluralSuffix(monthsOfExpenses)),
        });
      }
    } else if (balance < 0 && Math.abs(balance) > totalIncome * 0.1) {
      result.push({
        id: 'critical-negative-balance',
        type: 'warning',
        icon: AlertCircle,
        title: t.insightCriticalNegativeBalanceTitle,
        description: t.insightCriticalNegativeBalanceDescription.replace('{amount}', formatCurrency(Math.abs(balance), baseCurrency)),
      });
    }

    // 6. Insight sobre crescimento consistente
    if (incomeChange !== undefined && expenseChange !== undefined && 
        incomeChange > 5 && expenseChange < 5 && balanceChange !== undefined && balanceChange > 10) {
      result.push({
        id: 'healthy-growth',
        type: 'success',
        icon: TrendingUp,
        title: t.insightHealthyGrowthTitle,
        description: t.insightHealthyGrowthDescription.replace('{percent}', balanceChange.toFixed(1)),
      });
    }

    // Ordenar por prioridade: warning > info > success
    const priorityOrder = { warning: 0, info: 1, success: 2 };
    result.sort((a, b) => priorityOrder[a.type] - priorityOrder[b.type]);

    return result.slice(0, 5); // Limitar a 5 insights mais relevantes
  }, [incomeChange, expenseChange, balanceChange, totalIncome, totalExpense, categoryData, baseCurrency, t, locale, customCategories]);

  if (insights.length === 0) {
    return null;
  }

  const getIconColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'text-positive';
      case 'warning':
        return 'text-warning';
      case 'info':
        return 'text-info';
      default:
        return 'text-content-secondary';
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-positive-soft border-positive/25';
      case 'warning':
        return 'bg-warning/10 border-warning/25';
      case 'info':
        return 'bg-info/10 border-info/25';
      default:
        return 'bg-surface-sunken border-line';
    }
  };

  return (
    <div className="surface-card p-4 sm:p-6 flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Info className="h-5 w-5 text-brand" />
        <h2 className="card-title">
          {t.insights}
        </h2>
      </div>
      <div className="space-y-3">
        {insights.map((insight) => {
          const Icon = insight.icon;
          return (
            <div
              key={insight.id}
              className={`flex items-start gap-3 p-3 rounded-lg border ${getBgColor(insight.type)}`}
            >
              <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${getIconColor(insight.type)}`} />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-content">
                  {insight.title}
                </h3>
                <p className={`text-sm mt-1 ${blurNumbers ? 'demo-blur' : ''}`}>
                  {insight.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

