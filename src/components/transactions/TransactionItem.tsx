import { Transaction } from '../../types';
import { TransactionActionsMenu } from '../TransactionActionsMenu';
import { TransactionType, getCategoryColor, getCategoryDisplayName, getCategoryNameFromDisplay, type CustomCategoryInfo } from '../../lib/enums';
import { Clock, CreditCard, type LucideIcon } from 'lucide-react';
import { Badge, IconBadge, MoneyText } from '../ui';
import type React from 'react';

interface TransactionItemProps {
  transaction: Transaction;
  accounts: Array<{ id?: string; name: string; type?: string }>;
  baseCurrency: string;
  customCategories?: Array<{ id: string; name: string; icon?: string | null }>;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  onMarkAsPaid: (id: string, paid: boolean) => Promise<void>;
  onView: (transaction: Transaction) => void;
  formatTransactionDescription: (transaction: Transaction) => string;
  getCategoryIcon: (categoryName: string | undefined, customCategories?: Array<{ id: string; name: string; icon?: string | null }>) => React.ComponentType<any>;
  readOnly?: boolean;
  t: Record<string, string>;
}

export const TransactionItem = ({
  transaction,
  accounts,
  baseCurrency,
  customCategories,
  onEdit,
  onDelete,
  onMarkAsPaid,
  onView,
  formatTransactionDescription,
  getCategoryIcon,
  readOnly = false,
  t,
}: TransactionItemProps) => {
  const categoryName = transaction.categoryName || getCategoryNameFromDisplay(transaction.category || '', t as unknown as Record<string, string>, customCategories);
  const IconComponent = getCategoryIcon(categoryName, customCategories);
  const isInvoicePayment = transaction.attachmentUrl?.startsWith('invoice_pay:');
  const categoryDisplay = categoryName 
    ? getCategoryDisplayName(categoryName, t as unknown as Record<string, string>, customCategories)
    : t.category;

  // Verificar se a transação está atrasada (data <= hoje e pendente)
  const isOverdue = (() => {
    if (transaction.paid !== false) return false; // Só verifica se estiver pendente
    const transactionDate = transaction.date instanceof Date ? transaction.date : new Date(transaction.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const transDate = new Date(transactionDate);
    transDate.setHours(0, 0, 0, 0);
    return transDate.getTime() <= today.getTime();
  })();

  const account = accounts.find((acc) => acc.id === transaction.accountId);
  const color = getCategoryColor(categoryName || '', customCategories as CustomCategoryInfo[] | undefined);
  const isNeutral = transaction.type === TransactionType.TRANSFER || transaction.type === TransactionType.ALLOCATION;
  const signedAmount = transaction.type === TransactionType.INCOME
    ? Math.abs(transaction.amount || 0)
    : -Math.abs(transaction.amount || 0);

  return (
    <li className="flex items-center gap-3 px-4 py-3 min-h-[64px]">
      <IconBadge icon={IconComponent as LucideIcon} color={color} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <p className="truncate text-[15px] font-medium text-content">
            {formatTransactionDescription(transaction)}
          </p>
          {isOverdue ? (
            <Badge tone="negative">{t.overdue || 'Atrasado'}</Badge>
          ) : transaction.paid === false ? (
            <Badge tone="warning">{t.pending}</Badge>
          ) : null}
        </div>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-content-secondary">
          {isInvoicePayment && (
            <span className="inline-flex items-center gap-1 text-brand font-medium" title="Pagamento de fatura de cartão de crédito">
              <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
              Fatura ·
            </span>
          )}
          <span className="truncate">{[account?.name, categoryDisplay].filter(Boolean).join(' · ')}</span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {transaction.paid === false && (
          <Clock className={`h-3.5 w-3.5 ${isOverdue ? 'text-negative' : 'text-warning'}`} aria-hidden="true" />
        )}
        {isNeutral ? (
          <MoneyText value={Math.abs(transaction.amount || 0)} currency={baseCurrency} sign="none" className="text-content-secondary" />
        ) : (
          <MoneyText value={signedAmount} currency={baseCurrency} sign="always" tone="semantic" />
        )}
        <TransactionActionsMenu
          transaction={transaction}
          onEdit={onEdit}
          onDelete={onDelete}
          onMarkAsPaid={onMarkAsPaid}
          onView={onView}
          readOnly={readOnly}
        />
      </div>
    </li>
  );
};
