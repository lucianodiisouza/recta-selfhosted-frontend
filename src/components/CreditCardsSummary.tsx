import { useMemo } from "react";
import { useTransactions } from "../context/TransactionsContext";
import { useCurrency } from "../context/CurrencyContext";
import { useI18n } from "../context/I18nContext";
import { formatCurrency } from "../utils/format";
import { AccountType } from "../lib/enums";
import { getCreditCardUsage } from "../utils/accountBalance";
import { CreditCard } from "lucide-react";

export const CreditCardsSummary = () => {
  const { accounts } = useTransactions();
  const { baseCurrency } = useCurrency();
  const { t } = useI18n();

  // Filtrar apenas cartões de crédito
  const creditCards = useMemo(() => {
    return accounts.filter(
      (account) => account.type === AccountType.CREDIT
    );
  }, [accounts]);

  // Consolidated totals from each card's backend limit usage
  const summary = useMemo(() => {
    const usages = creditCards.map(getCreditCardUsage);
    const totalCreditLimit = usages.reduce((sum, u) => sum + u.limit, 0);
    const totalUsed = usages.reduce((sum, u) => sum + u.used, 0);
    const totalAvailable = Math.max(0, totalCreditLimit - totalUsed);
    const usagePercent = totalCreditLimit > 0
      ? (totalUsed / totalCreditLimit) * 100
      : 0;

    return {
      totalCreditLimit,
      totalUsed,
      totalAvailable,
      usagePercent,
    };
  }, [creditCards]);

  if (creditCards.length === 0) return null;

  return (
    <div className="surface-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="h-5 w-5 text-brand" aria-hidden="true" />
        <h3 className="card-title">
          {t.totalCreditLimit || "Total Consolidado"}
        </h3>
      </div>

      <div className="space-y-4">
        {/* Gráfico de barra com duas cores */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium text-content-tertiary">
              {t.usedLimit || "Limite Usado"}
            </span>
            <span className="text-[15px] font-rounded font-semibold tabular-nums text-content">
              {summary.usagePercent.toFixed(1)}%
            </span>
          </div>
          
          <div className="relative h-2 w-full bg-line rounded-full overflow-hidden">
            {/* Parte usada (vermelha/laranja) */}
            {summary.totalUsed > 0 && (
              <div
                className={`absolute left-0 top-0 h-full transition-all duration-500 ${
                  summary.usagePercent > 90
                    ? "bg-negative"
                    : summary.usagePercent > 70
                    ? "bg-orange-500"
                    : "bg-yellow-500"
                } ${
                  summary.totalAvailable > 0 && summary.usagePercent < 100
                    ? "rounded-l-full"
                    : "rounded-full"
                }`}
                style={{
                  width: `${Math.min(100, summary.usagePercent)}%`,
                }}
              />
            )}
            
            {/* Parte disponível (verde) */}
            {summary.totalAvailable > 0 && (
              <div
                className={`absolute right-0 top-0 h-full bg-positive transition-all duration-500 ${
                  summary.totalUsed > 0 && summary.usagePercent > 0 && summary.usagePercent < 100
                    ? "rounded-r-full"
                    : "rounded-full"
                }`}
                style={{
                  width: `${Math.max(0, 100 - summary.usagePercent)}%`,
                }}
              />
            )}
          </div>
        </div>

        {/* Valores detalhados */}
        <div className="grid grid-cols-3 gap-4 pt-4">
          <div className="text-center">
            <div className="text-xs font-medium text-content-tertiary mb-1">
              {t.totalLimit || "Limite Total"}
            </div>
            <div className="text-[15px] font-rounded font-semibold tabular-nums text-content">
              {formatCurrency(summary.totalCreditLimit, baseCurrency)}
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-xs font-medium text-content-tertiary mb-1">
              {t.used || "Usado"}
            </div>
            <div className={`text-[15px] font-rounded font-semibold tabular-nums ${
              summary.usagePercent > 70 ? "text-negative" : "text-orange-500"
            }`}>
              {formatCurrency(summary.totalUsed, baseCurrency)}
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-xs font-medium text-content-tertiary mb-1">
              {t.availableLimit || "Disponível"}
            </div>
            <div className="text-[15px] font-rounded font-semibold tabular-nums text-positive">
              {formatCurrency(summary.totalAvailable, baseCurrency)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

