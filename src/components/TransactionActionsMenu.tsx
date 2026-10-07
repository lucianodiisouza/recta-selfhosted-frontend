import { useState } from 'react';
import { MoreHorizontal, Edit, Trash2, CheckCircle, Clock, Eye, Users } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import { useI18n } from '../context/I18nContext';
import { Transaction } from '../types';

interface TransactionActionsMenuProps {
  transaction: Transaction;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  onMarkAsPaid: (id: string, paid: boolean) => void;
  onView?: (transaction: Transaction) => void;
  /** Opens the dialog that splits the transaction with people. Omit to hide the action (viewers, transfers, invoice payments). */
  onSplitShares?: (transaction: Transaction) => void;
  readOnly?: boolean; // If true, disable edit and delete actions
}

export const TransactionActionsMenu = ({
  transaction,
  onEdit,
  onDelete,
  onMarkAsPaid,
  onView,
  onSplitShares,
  readOnly = false,
}: TransactionActionsMenuProps) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const isPaid = transaction.paid !== false; // undefined ou true = pago

  const handleMarkAsPaid = () => {
    if (transaction.id) {
      onMarkAsPaid(transaction.id, true);
      setOpen(false);
    }
  };

  const handleMarkAsPending = () => {
    if (transaction.id) {
      onMarkAsPaid(transaction.id, false);
      setOpen(false);
    }
  };

  const handleEdit = () => {
    onEdit(transaction);
    setOpen(false);
  };

  const handleView = () => {
    if (onView) {
      onView(transaction);
      setOpen(false);
    }
  };

  const handleSplitShares = () => {
    if (onSplitShares) {
      onSplitShares(transaction);
      setOpen(false);
    }
  };

  const handleDelete = () => {
    if (transaction.id) {
      onDelete(transaction.id);
      setOpen(false);
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none rounded p-1.5 transition-opacity hover:opacity-70"
          aria-label={t.moreOptions || 'Mais opções'}
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="w-56 bg-white dark:bg-gray-900 rounded-md border border-gray-100 dark:border-gray-800 z-50 p-1"
          sideOffset={4}
          align="end"
        >
          <div className="py-1">
            {onView && (
              <button
                onClick={handleView}
                className="w-full flex items-center px-4 py-2.5 text-sm font-light text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 rounded-sm focus:outline-none transition-colors"
              >
                <Eye className="h-4 w-4 mr-3" aria-hidden="true" />
                <span>{t.viewDetails || 'Ver detalhes'}</span>
              </button>
            )}
            {!readOnly && (
              <>
                {!isPaid ? (
                  <button
                    onClick={handleMarkAsPaid}
                    className="w-full flex items-center px-4 py-2.5 text-sm font-light text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 rounded-sm focus:outline-none transition-colors"
                  >
                    <CheckCircle className="h-4 w-4 mr-3" aria-hidden="true" />
                    <span>{t.markAsPaid || 'Marcar como pago'}</span>
                  </button>
                ) : (
                  <button
                    onClick={handleMarkAsPending}
                    className="w-full flex items-center px-4 py-2.5 text-sm font-light text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 rounded-sm focus:outline-none transition-colors"
                  >
                    <Clock className="h-4 w-4 mr-3" aria-hidden="true" />
                    <span>{t.markAsPending || 'Marcar como pendente'}</span>
                  </button>
                )}
                <button
                  onClick={handleEdit}
                  className="w-full flex items-center px-4 py-2.5 text-sm font-light text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 rounded-sm focus:outline-none transition-colors"
                >
                  <Edit className="h-4 w-4 mr-3" aria-hidden="true" />
                  <span>{t.edit}</span>
                </button>
                {onSplitShares && transaction.id && (
                  <button
                    onClick={handleSplitShares}
                    className="w-full flex items-center px-4 py-2.5 text-sm font-light text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 rounded-sm focus:outline-none transition-colors"
                  >
                    <Users className="h-4 w-4 mr-3" aria-hidden="true" />
                    <span>{t.peopleDivideAction}</span>
                  </button>
                )}
                <button
                  onClick={handleDelete}
                  className="w-full flex items-center px-4 py-2.5 text-sm font-light text-red-500 dark:text-red-500 hover:bg-gray-50 dark:hover:bg-gray-900 rounded-sm focus:outline-none transition-colors"
                >
                  <Trash2 className="h-4 w-4 mr-3" aria-hidden="true" />
                  <span>{t.delete}</span>
                </button>
              </>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

