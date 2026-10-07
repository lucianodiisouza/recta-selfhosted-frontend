import { Transaction } from '../../types';
import { formatCurrency } from '../../utils/format';
import { TransactionActionsMenu } from '../TransactionActionsMenu';
import { TransactionType, getCategoryDisplayName, getCategoryNameFromDisplay } from '../../lib/enums';
import { CreditCard } from 'lucide-react';
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
  /** Opens the split dialog; the action only shows for expenses. */
  onSplitShares?: (transaction: Transaction) => void;
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
  onSplitShares,
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

  return (
    <li 
      key={transaction.id} 
      className="px-4 sm:px-6 py-4 hover:bg-gray-50/50 dark:hover:bg-gray-900/50 transition-colors"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-base font-light text-gray-900 dark:text-white">
                  {formatTransactionDescription(transaction)}
                </p>
                {transaction.paid === false && (
                  <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-light text-yellow-600 dark:text-yellow-400 border border-yellow-300 dark:border-yellow-700 rounded-full">
                    {t.pending}
                  </span>
                )}
                {isOverdue && (
                  <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-light text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-full">
                    {t.overdue || 'Atrasado'}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <div className="flex items-center">
                  <IconComponent className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 mr-1.5" />
                  <span className="text-sm font-light text-gray-500 dark:text-gray-400">
                    {categoryDisplay}
                  </span>
                </div>
                {(() => {
                  const account = accounts.find((acc) => acc.id === transaction.accountId);
                  if (account) {
                    return (
                      <span className="text-xs font-light text-gray-400 dark:text-gray-500">
                        {account.name}
                      </span>
                    );
                  }
                  return null;
                })()}
                {isInvoicePayment && (
                  <div className="flex items-center gap-1.5" title="Pagamento de fatura de cartão de crédito">
                    <CreditCard className="h-3.5 w-3.5 text-primary-600 dark:text-primary-400" />
                    <span className="text-xs font-light text-primary-600 dark:text-primary-400">Fatura</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-3 sm:ml-4">
            <span className={`text-lg font-light ${
              transaction.type === TransactionType.INCOME 
                ? 'text-green-500' 
                : transaction.type === TransactionType.TRANSFER || transaction.type === TransactionType.ALLOCATION
                ? 'text-blue-500'
                : 'text-red-500'
            }`}>
              {transaction.type === TransactionType.INCOME 
                ? '+' 
                : transaction.type === TransactionType.TRANSFER || transaction.type === TransactionType.ALLOCATION
                ? ''
                : '-'}
              {formatCurrency(Math.abs(transaction.amount || 0), baseCurrency)}
            </span>
            <TransactionActionsMenu
              transaction={transaction}
              onEdit={onEdit}
              onDelete={onDelete}
              onMarkAsPaid={onMarkAsPaid}
              onView={onView}
              onSplitShares={onSplitShares && transaction.type === TransactionType.EXPENSE && !isInvoicePayment ? onSplitShares : undefined}
              readOnly={readOnly}
            />
          </div>
        </div>
    </li>
  );
};
