import { useMemo } from 'react';
import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/format';
import { Transaction } from '../../types';

interface CreditCardInvoiceSummaryProps {
  expenses: number;
  incomes: number;
  total: number;
  previousBalance: number;
  isPaid: boolean;
  paymentTransactions: Transaction[];
  baseCurrency: string;
  className?: string;
}

export const CreditCardInvoiceSummary = ({
  expenses,
  incomes,
  total,
  previousBalance,
  isPaid,
  paymentTransactions,
  baseCurrency,
  className = '',
}: CreditCardInvoiceSummaryProps) => {
  const summaryItems = useMemo(() => {
    return [
      {
        label: 'Saldo Anterior',
        value: previousBalance,
        show: previousBalance > 0,
      },
      {
        label: 'Despesas do Mês',
        value: expenses,
        show: true,
      },
      {
        label: 'Pagamentos',
        value: -incomes,
        show: incomes > 0,
      },
    ];
  }, [previousBalance, expenses, incomes]);

  return (
    <div className={`bg-surface-elevated rounded-lg border border-line p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-content">
          Resumo da Fatura
        </h3>
        {isPaid ? (
          <div className="flex items-center space-x-2 text-positive">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm font-medium">Paga</span>
          </div>
        ) : total > 0 ? (
          <div className="flex items-center space-x-2 text-warning">
            <Clock className="h-5 w-5" />
            <span className="text-sm font-medium">Pendente</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2 text-content-tertiary">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm font-medium">Sem fatura</span>
          </div>
        )}
      </div>

      <div className="space-y-3 mb-4">
        {summaryItems.map((item, index) => {
          if (!item.show) return null;
          return (
            <div key={index} className="flex justify-between items-center">
              <span className="text-sm text-content-secondary">
                {item.label}
              </span>
              <span
                className={`text-sm font-medium ${
                  item.value < 0
                    ? 'text-positive'
                    : 'text-content'
                }`}
              >
                {item.value < 0 ? '-' : '+'}
                {formatCurrency(Math.abs(item.value), baseCurrency)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="pt-4 border-t border-line">
        <div className="flex justify-between items-center">
          <span className="text-base font-semibold text-content">
            Total
          </span>
          <span className="text-lg font-bold text-content">
            {formatCurrency(total, baseCurrency)}
          </span>
        </div>
      </div>

      {paymentTransactions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-line">
          <p className="text-xs text-content-tertiary mb-2">
            Pagamentos realizados:
          </p>
          <div className="space-y-1">
            {paymentTransactions.map((payment) => (
              <div
                key={payment.id}
                className="flex justify-between text-sm text-content-secondary"
              >
                <span>{formatDate(payment.date)}</span>
                <span className="text-positive">
                  {formatCurrency(payment.amount, baseCurrency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
