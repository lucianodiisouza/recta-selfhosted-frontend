import { useMemo } from 'react';
import { useTransactions } from '../../context/TransactionsContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useI18n } from '../../context/I18nContext';
import { formatCurrency } from '../../utils/format';
import { format } from 'date-fns';
import { CreditCard, Calendar } from 'lucide-react';
import { AccountType } from '../../lib/enums';

interface CreditCardsWidgetProps {
  accountBalances: Record<string, number>;
  blurNumbers?: boolean;
}

export const CreditCardsWidget = ({ accountBalances, blurNumbers = false }: CreditCardsWidgetProps) => {
  const { accounts } = useTransactions();
  const { baseCurrency } = useCurrency();
  const { t } = useI18n();

  const creditCardsInfo = useMemo(() => {
    const creditCards = accounts.filter((account) => account.type === AccountType.CREDIT);

    return creditCards.map((account) => {
      const currentDebt = Math.max(0, accountBalances[account.id || ''] || 0);
      const creditLimit = account.totalLimit || account.creditLimit || 0;
      const usedLimit = currentDebt;
      const availableLimit =
        creditLimit > 0 ? Math.max(0, creditLimit - usedLimit) : 0;

      // Calcular próximo vencimento
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      let nextDueDate: Date | null = null;

      if (account.dueDay) {
        const dueDay = account.dueDay;
        const thisMonthDue = new Date(currentYear, currentMonth, dueDay);

        if (thisMonthDue >= today) {
          nextDueDate = thisMonthDue;
        } else {
          nextDueDate = new Date(currentYear, currentMonth + 1, dueDay);
        }
      }

      return {
        account,
        currentDebt,
        creditLimit,
        usedLimit,
        availableLimit,
        nextDueDate,
        usagePercentage: creditLimit > 0 ? (usedLimit / creditLimit) * 100 : 0,
      };
    });
  }, [accounts, accountBalances]);

  if (creditCardsInfo.length === 0) {
    return (
      <div className="surface-card p-4 sm:p-6 flex flex-col">
        <h2 className="card-title mb-3 sm:mb-4">
          {t.creditCards}
        </h2>
        <div className="py-6 text-center text-sm text-content-tertiary">
          {t.noCreditCardsRegistered}
        </div>
      </div>
    );
  }

  return (
    <div className="surface-card p-4 sm:p-6 flex flex-col">
      <h2 className="card-title mb-3 sm:mb-4">
        {t.creditCards}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 auto-cols-max">
      {creditCardsInfo.map((cardInfo) => {
        const {
          account,
          currentDebt,
          availableLimit,
          creditLimit,
          usedLimit,
          nextDueDate,
          usagePercentage,
        } = cardInfo;
        const isNearLimit = usagePercentage > 80;
        const isOverLimit = usagePercentage >= 100;

        return (
          <div
            key={account.id}
            className="rounded-xl bg-surface-sunken/70 p-4 border-s-4"
            style={{
              borderLeftColor: isOverLimit
                ? '#F04438'
                : isNearLimit
                ? '#F79009'
                : account.color || '#5B3DF5',
            }}
          >
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="flex items-center min-w-0 flex-1">
                <div
                  className="p-1.5 sm:p-2 rounded-lg flex-shrink-0"
                  style={{
                    backgroundColor: `${account.color || '#5B3DF5'}20`,
                    color: account.color || '#5B3DF5',
                  }}
                >
                  <CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div className="ml-2 min-w-0 flex-1">
                  <h3 className="font-semibold text-content text-[15px] truncate">
                    {account.name}
                  </h3>
                  {nextDueDate && (
                    <div className="flex items-center text-xs font-medium text-content-tertiary mt-0.5">
                      <Calendar className="h-3 w-3 mr-1 flex-shrink-0" />
                      <span className="truncate">{t.date}: {format(nextDueDate, 'dd/MM/yyyy')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium text-content-tertiary">{t.currentDebt}</span>
                  <span
                    className={`font-rounded text-[15px] font-semibold tabular-nums ${
                      currentDebt > 0 ? 'text-negative' : 'text-positive'
                    } ${blurNumbers ? 'demo-blur' : ''}`}
                  >
                    {currentDebt > 0
                      ? formatCurrency(currentDebt, baseCurrency)
                      : t.noDebt}
                  </span>
                </div>
              </div>

              {creditLimit > 0 && (
                <>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-medium text-content-tertiary">{t.availableLimit}</span>
                      <span
                        className={`font-rounded text-[15px] font-semibold tabular-nums ${
                          availableLimit < creditLimit * 0.1
                            ? 'text-negative'
                            : availableLimit < creditLimit * 0.3
                            ? 'text-warning'
                            : 'text-positive'
                        } ${blurNumbers ? 'demo-blur' : ''}`}
                      >
                        {formatCurrency(availableLimit, baseCurrency)}
                      </span>
                    </div>
                    <div className="w-full bg-line rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          usagePercentage >= 100
                            ? 'bg-negative'
                            : usagePercentage > 80
                            ? 'bg-[#F79009]'
                            : 'bg-positive'
                        }`}
                        style={{
                          width: `${Math.min(usagePercentage, 100)}%`,
                        }}
                      />
                    </div>
                    <div className={`flex justify-between text-xs font-medium text-content-tertiary mt-2 ${blurNumbers ? 'demo-blur' : ''}`}>
                      <span>
                        {formatCurrency(usedLimit, baseCurrency)} {t.of}{' '}
                        {formatCurrency(creditLimit, baseCurrency)}
                      </span>
                      <span>
                        {usagePercentage.toFixed(1)}% {t.used}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
};


