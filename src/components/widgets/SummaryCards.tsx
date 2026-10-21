import { useMemo } from 'react';
import { useI18n } from '../../context/I18nContext';
import { ArrowDownLeft, ArrowUpRight, TrendingUp, TrendingDown, Eye, EyeOff, PiggyBank } from 'lucide-react';
import { Badge, BrandCard, Card, MoneyText, Skeleton } from '../ui';
import RectaMark from '../RectaMark';
import { useDemoBlur } from '../../context/DemoBlurContext';

interface SummaryCardsProps {
  totalIncome: number;
  totalExpense: number;
  totalAvailableBalance: number;
  loading?: boolean;
  blurNumbers?: boolean;
  incomeChange?: number;
  expenseChange?: number;
  balanceChange?: number;
  onIncomeClick?: () => void;
  onExpenseClick?: () => void;
}

export const SummaryCards = ({
  totalIncome,
  totalExpense,
  totalAvailableBalance,
  loading,
  blurNumbers = false,
  incomeChange,
  expenseChange,
  balanceChange,
  onIncomeClick,
  onExpenseClick,
}: SummaryCardsProps) => {
  const { t } = useI18n();
  const { toggleBlur } = useDemoBlur();

  // Calcular taxa de poupança (savings rate)
  const savingsRate = useMemo(() => {
    if (totalIncome === 0) return 0;
    const netSavings = totalIncome - totalExpense;
    return (netSavings / totalIncome) * 100;
  }, [totalIncome, totalExpense]);

  // Calcular saldo líquido do mês
  const netBalance = useMemo(() => {
    return totalIncome - totalExpense;
  }, [totalIncome, totalExpense]);

  // Determinar status da saúde financeira baseado na taxa de poupança
  const financialHealthStatus = useMemo(() => {
    if (savingsRate >= 20) return { labelKey: 'healthExcellent' as const, tone: 'positive' as const };
    if (savingsRate >= 10) return { labelKey: 'healthGood' as const, tone: 'info' as const };
    if (savingsRate >= 0) return { labelKey: 'healthAttention' as const, tone: 'warning' as const };
    return { labelKey: 'healthCritical' as const, tone: 'negative' as const };
  }, [savingsRate]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[168px] rounded-2xl" />
        <Skeleton className="h-[156px] rounded-xl" />
      </div>
    );
  }

  // Percent change chip. For expenses, going up is bad, so `invert` flips the color.
  const TrendChip = ({ value, invert = false }: { value?: number; invert?: boolean }) => {
    if (value === undefined || value === 0) return null;
    const up = value > 0;
    const good = invert ? !up : up;
    const Icon = up ? TrendingUp : TrendingDown;
    const color = good ? 'bg-positive-soft text-positive' : 'bg-negative-soft text-negative-on-soft';
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${color} ${blurNumbers ? 'demo-blur' : ''}`}>
        <Icon className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
        {Math.abs(value).toFixed(1)}%
      </span>
    );
  };

  const FlowColumn = ({
    label, value, change, invert, icon: Icon, tint, onClick, ariaLabel,
  }: {
    label: string; value: number; change?: number; invert?: boolean; icon: typeof ArrowUpRight;
    tint: string; onClick?: () => void; ariaLabel?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-label={ariaLabel}
      className={`flex-1 min-w-0 rounded-lg p-3 -m-3 text-start transition-colors ${onClick ? 'hover:bg-surface-sunken cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className={`h-4 w-4 ${tint}`} strokeWidth={2.5} aria-hidden="true" />
        <span className="text-sm text-content-secondary">{label}</span>
      </div>
      <MoneyText value={value} size="xl" className="block truncate" />
      <div className="mt-1.5 h-5"><TrendChip value={change} invert={invert} /></div>
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Saldo disponível: cartão de destaque da marca, como o saldo total do app */}
      <BrandCard className="sm:p-7">
        <RectaMarkWatermark />
        <div className="relative flex items-center justify-between">
          <p className="text-[15px] font-medium text-white/80">{t.availableBalance}</p>
          {toggleBlur && (
            <button
              onClick={toggleBlur}
              className="-me-2 flex h-9 w-9 items-center justify-center rounded-full text-white/80 hover:bg-white/15 hover:text-white transition-colors"
              aria-label={blurNumbers ? t.showValues : t.hideValues}
            >
              {blurNumbers ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
            </button>
          )}
        </div>
        <MoneyText value={totalAvailableBalance} size="display" animate className="relative mt-2 block break-words text-white" />
        {balanceChange !== undefined && balanceChange !== 0 && (
          <div className={`relative mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-sm font-medium text-white ${blurNumbers ? 'demo-blur' : ''}`}>
            {balanceChange > 0 ? <TrendingUp className="h-4 w-4" aria-hidden="true" /> : <TrendingDown className="h-4 w-4" aria-hidden="true" />}
            {t.balanceVsLastMonth.replace('{percent}', Math.abs(balanceChange).toFixed(1))}
          </div>
        )}
      </BrandCard>

      {/* Resumo do mês: entradas, saídas e taxa de poupança */}
      <Card padding="lg">
        <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
          <FlowColumn
            label={t.totalIncome}
            value={totalIncome}
            change={incomeChange}
            icon={ArrowDownLeft}
            tint="text-positive"
            onClick={onIncomeClick}
            ariaLabel={onIncomeClick ? t.viewAllIncome : undefined}
          />
          <div className="hidden sm:block w-px bg-line-subtle" aria-hidden="true" />
          <FlowColumn
            label={t.totalExpense}
            value={totalExpense}
            change={expenseChange}
            invert
            icon={ArrowUpRight}
            tint="text-negative"
            onClick={onExpenseClick}
            ariaLabel={onExpenseClick ? t.viewAllExpenses : undefined}
          />
        </div>

        {totalIncome > 0 && (
          <div className="mt-5 pt-4 border-t border-line-subtle flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand-on-soft">
              <PiggyBank className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-content">{t.savingsRate}</p>
              {netBalance !== 0 && (
                <p className="text-[13px] text-content-secondary">
                  <MoneyText value={Math.abs(netBalance)} size="sm" className="!font-medium" />{' '}
                  {netBalance >= 0 ? t.savingsSavedThisMonth : t.savingsOverspentThisMonth} {t.thisMonthSuffix}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className={`font-rounded text-lg font-semibold tabular-nums text-content ${blurNumbers ? 'demo-blur' : ''}`}>
                {`${savingsRate.toFixed(1)}%`}
              </span>
              <Badge tone={financialHealthStatus.tone}>{t[financialHealthStatus.labelKey]}</Badge>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

/** Big faded Equilíbrio mark in the corner of the balance card, like the marketing banners. */
const RectaMarkWatermark = () => (
  <RectaMark
    className="pointer-events-none absolute right-6 bottom-6 h-24 w-auto text-white"
    topColor="#FFFFFF"
    opacity={0.1}
  />
);
