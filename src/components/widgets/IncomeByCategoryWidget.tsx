import { useMemo } from 'react';
import { useCurrency } from '../../context/CurrencyContext';
import { useI18n } from '../../context/I18nContext';
import { formatCurrency } from '../../utils/format';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { PiePercentLabel } from './PiePercentLabel';
import type { PiePercentLabelProps } from './PiePercentLabel';
import { pieOuterRadius } from '../../utils/pieLabel';
import { TrendingUp } from 'lucide-react';
import { getCategoryDisplayName, CustomCategoryInfo } from '../../lib/enums';
import { useCategories } from '../../hooks/api/useCategories';
import { useDefaultHousehold } from '../../hooks/useDefaultHousehold';

/** Real height of the chart: the inline height of ResponsiveContainer wins over any responsive class. */
const PIE_CHART_HEIGHT = 200;

const COLORS = [
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
];

interface IncomeByCategoryWidgetProps {
  incomeByCategory: Array<{ name: string; value: number }>;
  blurNumbers?: boolean;
  totalIncome?: number;
}

export const IncomeByCategoryWidget = ({
  incomeByCategory,
  blurNumbers = false,
  totalIncome,
}: IncomeByCategoryWidgetProps) => {
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

  // Calcular total de receitas se não fornecido
  const calculatedTotal = useMemo(() => {
    return totalIncome || incomeByCategory.reduce((sum, cat) => sum + cat.value, 0);
  }, [incomeByCategory, totalIncome]);

  // Ordenar por valor para mostrar as top 3
  const topCategories = useMemo(() => {
    return [...incomeByCategory]
      .sort((a, b) => b.value - a.value)
      .slice(0, 3)
      .map(cat => ({
        ...cat,
        percentage: (cat.value / calculatedTotal) * 100,
      }));
  }, [incomeByCategory, calculatedTotal]);

  if (incomeByCategory.length === 0) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 py-8">
        {t.noIncomeByCategory}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 sm:p-6 w-full h-full flex flex-col">
      <h2 className="text-base sm:text-lg lg:text-xl font-light tracking-tight text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">
        {t.incomeByCategory}
      </h2>
      <ResponsiveContainer
        width="100%"
        height={PIE_CHART_HEIGHT}
        className={blurNumbers ? 'demo-blur' : ''}
      >
        <PieChart>
          <Pie
            data={incomeByCategory}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={(props: PiePercentLabelProps) => <PiePercentLabel {...props} />}
            outerRadius={pieOuterRadius(PIE_CHART_HEIGHT)}
            fill="#8884d8"
            dataKey="value"
          >
            {incomeByCategory.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [
              formatCurrency(value, baseCurrency),
              resolveCategoryName(name),
            ]}
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: 'none',
              borderRadius: '12px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              padding: '12px',
            }}
            labelStyle={{
              color: '#374151',
              fontWeight: 600,
              marginBottom: '8px',
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Top 3 categorias */}
      {topCategories.length > 0 && (
        <div className="mt-4 space-y-2">
          <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
            {t.topCategories}
          </h3>
          {topCategories.map((cat) => (
            <div key={cat.name} className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-gray-700/50">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: COLORS[incomeByCategory.findIndex(c => c.name === cat.name) % COLORS.length] }}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                  {resolveCategoryName(cat.name)}
                </span>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <span className={`text-sm font-light tracking-tight text-gray-900 dark:text-gray-100 ${blurNumbers ? 'demo-blur' : ''}`}>
                  {blurNumbers ? '••••' : formatCurrency(cat.value, baseCurrency)}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {cat.percentage.toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


