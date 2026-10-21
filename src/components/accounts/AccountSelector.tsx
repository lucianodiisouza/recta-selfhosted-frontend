import { Account } from '../../types';
import { getAccountBalance } from '../../utils/accountBalance';
import { Plus, Share2 } from 'lucide-react';
import { AccountType } from '../../lib/enums';
import { MoneyText, PaymentCard } from '../ui';
import { getAccountTypeLabel } from '../../constants/accountTypes';

interface AccountSelectorProps {
  accounts: Account[];
  selectedAccountId: string | null;
  onSelectAccount: (accountId: string | null) => void;
  onAddAccount: () => void;
  baseCurrency: string;
  selectedMonth: Date;
  householdMembers?: Array<{ userId: string; user?: { displayName?: string; email?: string } }>;
  currentUserId?: string;
  t: Record<string, string>;
}

export const AccountSelector = ({
  accounts,
  selectedAccountId,
  onSelectAccount,
  onAddAccount,
  baseCurrency,
  selectedMonth: _selectedMonth,
  householdMembers,
  currentUserId: _currentUserId,
  t,
}: AccountSelectorProps) => {
  return (
    // Carousel of account cards, like the app's Home and Cards screens.
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 pt-1 scrollbar-hide sm:mx-0 sm:px-1">
      {accounts.map((account) => {
        const balances = getAccountBalance(account);
        const isSharedAccount = (account as any).isPersonal && (account as any).accountOwnerId;
        const accountOwnerMember = isSharedAccount && householdMembers
          ? householdMembers.find(m => m.userId === (account as any).accountOwnerId)
          : null;
        const ownerName = accountOwnerMember
          ? accountOwnerMember.user?.displayName || accountOwnerMember.user?.email?.split('@')[0] || 'Compartilhada'
          : null;
        const isSelected = selectedAccountId === account.id;

        return (
          <div key={account.id} className="w-[220px] flex-shrink-0 snap-start">
            <PaymentCard
              compact
              type={account.type as AccountType}
              color={account.color}
              onClick={() => onSelectAccount(account.id || null)}
              selected={isSelected}
              className={isSelected ? undefined : 'opacity-75 hover:opacity-100'}
              title={
                <span className="flex items-center gap-1.5">
                  <span className="truncate">{account.name}</span>
                  {isSharedAccount && <Share2 className="h-3 w-3 shrink-0" aria-label="Conta compartilhada" />}
                </span>
              }
              subtitle={`${getAccountTypeLabel(account.type as any, t)}${ownerName ? ` · ${ownerName}` : ''}`}
              amount={<MoneyText value={balances.totalBalance} currency={baseCurrency} size="md" className="text-white" />}
            />
          </div>
        );
      })}

      {/* Botão para Adicionar Nova Conta */}
      <button
        onClick={onAddAccount}
        className="group flex h-[120px] w-[220px] flex-shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-line text-content-tertiary transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-sunken group-hover:bg-brand group-hover:text-white transition-colors">
          <Plus className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="text-sm font-semibold">{t.newAccount}</span>
      </button>
    </div>
  );
};
