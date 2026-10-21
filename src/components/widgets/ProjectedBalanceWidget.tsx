import { useMemo } from 'react';
import { useCurrency } from '../../context/CurrencyContext';
import { useI18n } from '../../context/I18nContext';
import { formatCurrency } from '../../utils/format';
import { TrendingUp, TrendingDown, Info, AlertCircle } from 'lucide-react';

interface ProjectedBalanceWidgetProps {
  totalProjectedBalance: number;
  totalAvailableBalance: number;
  blurNumbers?: boolean;
}

export const ProjectedBalanceWidget = ({
  totalProjectedBalance,
  totalAvailableBalance,
  blurNumbers = false,
}: ProjectedBalanceWidgetProps) => {
  const { baseCurrency } = useCurrency();
  const { t } = useI18n();

  const difference = totalProjectedBalance - totalAvailableBalance;
  const differencePercentage = useMemo(() => {
    if (totalAvailableBalance === 0) return 0;
    return (difference / Math.abs(totalAvailableBalance)) * 100;
  }, [difference, totalAvailableBalance]);

  // Determinar status da projeção
  const projectionStatus = useMemo(() => {
    const pct = Math.abs(differencePercentage).toFixed(1);
    if (difference > 0 && differencePercentage > 10) {
      return {
        type: 'positive',
        message: t.projectionIncrease.replace('{percent}', pct),
        icon: TrendingUp,
        color: 'text-positive',
        bgColor: 'bg-positive-soft',
      };
    }
    if (difference < 0 && Math.abs(differencePercentage) > 10) {
      return {
        type: 'negative',
        message: t.projectionDecrease.replace('{percent}', pct),
        icon: TrendingDown,
        color: 'text-negative',
        bgColor: 'bg-negative-soft',
      };
    }
    if (totalProjectedBalance < 0) {
      return {
        type: 'critical',
        message: t.projectionNegative,
        icon: AlertCircle,
        color: 'text-negative',
        bgColor: 'bg-negative-soft',
      };
    }
    return null;
  }, [difference, differencePercentage, totalProjectedBalance, t]);

  const StatusIcon = projectionStatus?.icon;

  return (
    <div className="surface-card p-4 sm:p-6 flex flex-col">
      <div className="flex items-center justify-between mb-2 gap-2">
        <h2 className="card-title">
          {t.projectedBalance}
        </h2>
        {projectionStatus && StatusIcon && (
          <StatusIcon className={`h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 ${projectionStatus.color}`} />
        )}
      </div>
      <p className="text-xs text-content-tertiary mb-3 sm:mb-4">
        {t.projectedBalanceDescription}
      </p>
      
      <div className="mb-3 sm:mb-4">
        <div
          className={`text-2xl sm:text-3xl lg:text-4xl font-rounded font-semibold tabular-nums mb-2 break-words ${
            totalProjectedBalance >= 0 ? 'text-positive' : 'text-negative'
          } ${blurNumbers ? 'demo-blur' : ''}`}
        >
          {blurNumbers ? '••••••' : formatCurrency(totalProjectedBalance, baseCurrency)}
        </div>
        
        {/* Saldo atual para comparação */}
        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-content-secondary">
          <span>{t.currentBalanceLabel}</span>
          <span className={`font-medium ${blurNumbers ? 'demo-blur' : ''}`}>
            {blurNumbers ? '••••' : formatCurrency(totalAvailableBalance, baseCurrency)}
          </span>
        </div>
      </div>

      {/* Diferença */}
      {difference !== 0 && (
        <div className="mb-3 sm:mb-4 p-2.5 sm:p-3 rounded-lg bg-surface-sunken">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs sm:text-sm text-content-secondary">{t.projectedDifference}</span>
            <span
              className={`text-xs sm:text-sm font-rounded font-semibold tabular-nums whitespace-nowrap ${
                difference >= 0
                  ? 'text-positive'
                  : 'text-negative'
              } ${blurNumbers ? 'demo-blur' : ''}`}
            >
              {difference >= 0 ? '+' : ''}
              {blurNumbers ? '••••' : formatCurrency(difference, baseCurrency)}
            </span>
          </div>
        </div>
      )}

      {/* Status da projeção */}
      {projectionStatus && (
        <div className={`mt-4 p-3 rounded-lg ${projectionStatus.bgColor} border ${projectionStatus.color.replace('text-', 'border-')} border-opacity-30`}>
          <p className={`text-xs ${projectionStatus.color}`}>
            {projectionStatus.message}
          </p>
        </div>
      )}

      {/* Informação adicional */}
      <div className="mt-4 flex items-start gap-2 text-xs text-content-tertiary">
        <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        <p>{t.projectedBalanceInfo}</p>
      </div>
    </div>
  );
};


