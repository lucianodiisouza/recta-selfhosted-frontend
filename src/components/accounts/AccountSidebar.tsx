import { Account } from '../../types';
import { formatCurrency } from '../../utils/format';
import { getAccountBalance } from '../../utils/accountBalance';
import { AccountActionsMenu } from '../AccountActionsMenu';
import { ArrowRightLeft } from 'lucide-react';

interface AccountSidebarProps {
  account: Account;
  accountBalance: ReturnType<typeof getAccountBalance>;
  baseCurrency: string;
  accountOwnerInfo?: { name: string; email: string } | null;
  isAccountOwner: boolean;
  hasCreditCards: boolean;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
  onAdjustBalance?: (account: Account) => void;
  onAllocate: () => void;
  onDeallocate: () => void;
  t: Record<string, string>;
}

export const AccountSidebar = ({
  account,
  accountBalance,
  baseCurrency,
  accountOwnerInfo,
  isAccountOwner,
  hasCreditCards,
  onEdit,
  onDelete,
  onAdjustBalance,
  onAllocate,
  onDeallocate,
  t,
}: AccountSidebarProps) => {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-100 dark:border-gray-800">
        <div className="flex-1">
          <h3 className="text-lg font-light tracking-tight text-gray-900 dark:text-white">
            {t.account || "Conta"}
          </h3>
          {(account as any).isPersonal && accountOwnerInfo && (
            <p className="text-xs font-light text-gray-500 dark:text-gray-400 mt-1">
              Compartilhada por {accountOwnerInfo.name}
            </p>
          )}
        </div>
        <AccountActionsMenu
          account={account}
          onEdit={onEdit}
          onDelete={onDelete}
          onAdjustBalance={account.type === 'CREDIT' ? undefined : onAdjustBalance}
          isAccountOwner={isAccountOwner}
        />
      </div>

      <div className="space-y-6">
        <div>
          <div className="text-xs font-medium text-gray-500 dark:text-gray-300 mb-2">
            {t.currentBalance}
          </div>
          <div
            className={`text-2xl font-light tracking-tight ${
              accountBalance.totalBalance >= 0
                ? "text-green-500"
                : "text-red-500"
            }`}
          >
            {formatCurrency(accountBalance.totalBalance, baseCurrency)}
          </div>
        </div>

        {accountBalance.allocatedBalance > 0 && (
          <div className="grid grid-cols-2 gap-4 pt-6 border-t border-gray-100 dark:border-gray-800">
            <div className="p-4 border border-gray-100 dark:border-gray-800 rounded-lg">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-300 mb-2">
                {t.availableBalance || "Disponível"}
              </div>
              <div className="text-sm font-light text-green-500">
                {formatCurrency(accountBalance.availableBalance, baseCurrency)}
              </div>
            </div>
            <div className="p-4 border border-gray-100 dark:border-gray-800 rounded-lg">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-300 mb-2">
                {t.allocatedBalance || "Alocado"}
              </div>
              <div className="text-sm font-light text-blue-500">
                {formatCurrency(accountBalance.allocatedBalance, baseCurrency)}
              </div>
            </div>
          </div>
        )}

        {/* Botões de alocação - só mostrar se houver cartões de crédito e usuário for dono */}
        {hasCreditCards && isAccountOwner && (
          <div className="pt-4 space-y-2">
            <button
              onClick={onAllocate}
              className="w-full px-3 py-2.5 text-sm font-light tracking-tight text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-700 rounded-md hover:opacity-80 transition-opacity flex items-center justify-center gap-2"
            >
              <ArrowRightLeft className="h-4 w-4" />
              {t.allocateToCard}
            </button>
            {accountBalance.allocatedBalance > 0 && (
              <button
                onClick={onDeallocate}
                className="w-full px-3 py-2.5 text-sm font-light tracking-tight text-orange-600 dark:text-orange-400 border border-orange-300 dark:border-orange-700 rounded-md hover:opacity-80 transition-opacity flex items-center justify-center gap-2"
              >
                <ArrowRightLeft className="h-4 w-4 rotate-180" />
                {t.deallocate}
              </button>
            )}
          </div>
        )}
        {hasCreditCards && !isAccountOwner && (
          <div className="pt-4 p-3 border border-gray-100 dark:border-gray-800 rounded-md">
            <p className="text-xs font-light text-gray-500 dark:text-gray-400 text-center">
              Apenas o dono da conta pode alocar saldo
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
