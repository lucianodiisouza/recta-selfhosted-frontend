import { useMemo } from 'react';
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { Account } from '../../types';
import { formatCurrency } from '../../utils/format';
import { getAccountBalance } from '../../utils/accountBalance';

interface AccountBalanceCardProps {
  account: Account;
  baseCurrency: string;
  transactions?: any[];
  className?: string;
}

export const AccountBalanceCard = ({
  account,
  baseCurrency,
  transactions = [],
  className = '',
}: AccountBalanceCardProps) => {
  const balance = useMemo(() => {
    return getAccountBalance(account, transactions);
  }, [account, transactions]);

  const isPositive = balance >= 0;

  return (
    <div className={`bg-surface-elevated rounded-lg border border-line p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <Wallet className="h-5 w-5 text-content-secondary" />
          <div>
            <h3 className="text-lg font-semibold text-content">
              {account.name}
            </h3>
            <p className="text-sm text-content-tertiary">
              {account.type}
            </p>
          </div>
        </div>
        {isPositive ? (
          <TrendingUp className="h-5 w-5 text-positive" />
        ) : (
          <TrendingDown className="h-5 w-5 text-negative" />
        )}
      </div>

      <div className="pt-4 border-t border-line">
        <div className="flex justify-between items-center">
          <span className="text-sm text-content-secondary">
            Saldo Atual
          </span>
          <span
            className={`text-2xl font-bold ${
              isPositive
                ? 'text-positive'
                : 'text-negative'
            }`}
          >
            {formatCurrency(balance, baseCurrency)}
          </span>
        </div>
      </div>
    </div>
  );
};
