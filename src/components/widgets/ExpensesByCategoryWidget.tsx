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
import { AlertCircle } from 'lucide-react';
import { getCategoryDisplayName, CustomCategoryInfo } from '../../lib/enums';
import { useCategories } from '../../hooks/api/useCategories';
import { useDefaultHousehold } from '../../hooks/useDefaultHousehold';

const COLORS = [
  '#5B3DF5',
  '#12B76A',
  '#F79009',
  '#F04438',
  '#7A5AF8',
  '#EE46BC',
  '#15B79E',
  '#84cc16',
];

interface ExpensesByCategoryWidgetProps {
  expenseByCategory: Array<{ name: string; value: number }>;
  blurNumbers?: boolean;
  totalExpense?: number;
}

export const ExpensesByCategoryWidget = ({
  expenseByCategory,
  blurNumbers = false,
  totalExpense,
}: ExpensesByCategoryWidgetProps) => {
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

  // Calcular total de despesas se não fornecido
  const calculatedTotal = useMemo(() => {
    return totalExpense || expenseByCategory.reduce((sum, cat) => sum + cat.value, 0);
  }, [expenseByCategory, totalExpense]);

  // Identificar categorias dominantes (>30% do total)
  const dominantCategories = useMemo(() => {
    return expenseByCategory
      .filter(cat => (cat.value / calculatedTotal) * 100 > 30)
      .map(cat => ({
        ...cat,
        percentage: (cat.value / calculatedTotal) * 100,
      }));
  }, [expenseByCategory, calculatedTotal]);

  // Ordenar por valor para mostrar as top 3
  const topCategories = useMemo(() => {
    return [...expenseByCategory]
      .sort((a, b) => b.value - a.value)
      .slice(0, 3)
      .map(cat => ({
        ...cat,
        percentage: (cat.value / calculatedTotal) * 100,
      }));
  }, [expenseByCategory, calculatedTotal]);

  if (expenseByCategory.length === 0) {
    return (
      <div className="text-center text-content-tertiary py-8">
        {t.noExpensesByCategory}
      </div>
    );
  }

  return (
    <div className="surface-card p-4 sm:p-6 w-full h-full flex flex-col">
      <h2 className="card-title mb-3 sm:mb-4">
        {t.expensesByCategory}
      </h2>
      <ResponsiveContainer
        width="100%"
        height={200}
        className={`sm:h-[250px] lg:h-[300px] ${blurNumbers ? 'demo-blur' : ''}`}
      >
        <PieChart>
          <Pie
                  stroke="rgb(var(--bg-elevated))"
                  strokeWidth={2}
            data={expenseByCategory}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({
              percent,
            }: {
              percent: number;
            }) => {
              // Mostrar label apenas se for > 5% para não poluir
              if (percent < 0.05) return '';
              return `${(percent * 100).toFixed(0)}%`;
            }}
            outerRadius={80}
            fill="#5B3DF5"
            dataKey="value"
          >
            {expenseByCategory.map((_, index) => (
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
              color: '#2C2C38',
              fontWeight: 600,
              marginBottom: '8px',
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Top 3 categorias */}
      {topCategories.length > 0 && (
        <div className="mt-4 space-y-2">
          <h3 className="text-xs font-medium text-content-secondary mb-2">
            {t.topCategories}
          </h3>
          {topCategories.map((cat) => (
            <div key={cat.name} className="flex items-center justify-between p-2 rounded bg-surface-sunken">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: COLORS[expenseByCategory.findIndex(c => c.name === cat.name) % COLORS.length] }}
                />
                <span className="text-sm text-content-secondary truncate">
                  {resolveCategoryName(cat.name)}
                </span>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <span className={`text-sm font-rounded font-semibold tabular-nums text-content ${blurNumbers ? 'demo-blur' : ''}`}>
                  {blurNumbers ? '••••' : formatCurrency(cat.value, baseCurrency)}
                </span>
                <span className="text-xs text-content-tertiary">
                  {cat.percentage.toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Alerta para categorias dominantes */}
      {dominantCategories.length > 0 && (
        <div className="mt-4 p-3 rounded-lg bg-warning/10 border border-warning/25">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-medium text-yellow-800 dark:text-yellow-300 mb-1">
                {t.reportInsightDominantCategoryTitle}
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-400">
                {dominantCategories.map((cat, idx) => 
                  idx === 0 
                    ? t.reportInsightDominantCategoryDescription
                        .replace('{category}', resolveCategoryName(cat.name))
                        .replace('{percent}', cat.percentage.toFixed(0))
                    : `, ${resolveCategoryName(cat.name)} (${cat.percentage.toFixed(0)}%)`
                ).join('')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


