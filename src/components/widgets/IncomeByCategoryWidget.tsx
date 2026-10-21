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
import { TrendingUp } from 'lucide-react';
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
      <div className="text-center text-content-tertiary py-8">
        {t.noIncomeByCategory}
      </div>
    );
  }

  return (
    <div className="surface-card p-4 sm:p-6 w-full h-full flex flex-col">
      <h2 className="card-title mb-3 sm:mb-4">
        {t.incomeByCategory}
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
            data={incomeByCategory}
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
          <h3 className="text-xs font-medium text-content-secondary mb-2 flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5 text-positive" />
            {t.topCategories}
          </h3>
          {topCategories.map((cat) => (
            <div key={cat.name} className="flex items-center justify-between p-2 rounded bg-surface-sunken">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: COLORS[incomeByCategory.findIndex(c => c.name === cat.name) % COLORS.length] }}
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
    </div>
  );
};


