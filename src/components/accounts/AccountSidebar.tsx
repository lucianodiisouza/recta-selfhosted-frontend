import { Account } from '../../types';
import { getAccountBalance } from '../../utils/accountBalance';
import { AccountActionsMenu } from '../AccountActionsMenu';
import { ArrowRightLeft, Undo2 } from 'lucide-react';
import { AccountType } from '../../lib/enums';
import { Button, MoneyText, PaymentCard } from '../ui';

interface AccountSidebarProps {
  account: Account;
  accountBalance: ReturnType<typeof getAccountBalance>;
  baseCurrency: string;
  accountOwnerInfo?: { name: string; email: string } | null;
  isAccountOwner: boolean;
  hasCreditCards: boolean;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
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
  onAllocate,
  onDeallocate,
  t,
}: AccountSidebarProps) => {
  return (
    <div className="surface-card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <h3 className="card-title">
            {t.account || "Conta"}
          </h3>
          {(account as any).isPersonal && accountOwnerInfo && (
            <p className="text-xs text-content-tertiary mt-0.5">
              Compartilhada por {accountOwnerInfo.name}
            </p>
          )}
        </div>
        <AccountActionsMenu
          account={account}
          onEdit={onEdit}
          onDelete={onDelete}
          isAccountOwner={isAccountOwner}
        />
      </div>

      <PaymentCard
        type={account.type as AccountType}
        color={account.color}
        title={account.name}
        subtitle={t.currentBalance}
        amount={<MoneyText value={accountBalance.totalBalance} currency={baseCurrency} size="xl" className="text-white" />}
      />

      {accountBalance.allocatedBalance > 0 && (
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="p-4 rounded-xl bg-surface-sunken/70">
            <div className="text-xs font-medium text-content-secondary mb-1">
              {t.availableBalance || "Disponível"}
            </div>
            <MoneyText value={accountBalance.availableBalance} currency={baseCurrency} className="text-positive" />
          </div>
          <div className="p-4 rounded-xl bg-surface-sunken/70">
            <div className="text-xs font-medium text-content-secondary mb-1">
              {t.allocatedBalance || "Alocado"}
            </div>
            <MoneyText value={accountBalance.allocatedBalance} currency={baseCurrency} className="text-info" />
          </div>
        </div>
      )}

      {/* Botões de alocação - só mostrar se houver cartões de crédito e usuário for dono */}
      {hasCreditCards && isAccountOwner && (
        <div className="mt-4 space-y-2">
          <Button variant="secondary" fullWidth icon={ArrowRightLeft} onClick={onAllocate}>
            {t.allocateToCard}
          </Button>
          {accountBalance.allocatedBalance > 0 && (
            <Button variant="tertiary" fullWidth icon={Undo2} onClick={onDeallocate}>
              {t.deallocate}
            </Button>
          )}
        </div>
      )}
      {hasCreditCards && !isAccountOwner && (
        <p className="mt-4 rounded-xl bg-surface-sunken/70 p-3 text-center text-xs text-content-tertiary">
          Apenas o dono da conta pode alocar saldo
        </p>
      )}
    </div>
  );
};
