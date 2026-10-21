import { useState } from 'react';
import { MoreHorizontal, Edit, Trash2, CheckCircle, Clock, Eye } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import { useI18n } from '../context/I18nContext';
import { Transaction } from '../types';

interface TransactionActionsMenuProps {
  transaction: Transaction;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  onMarkAsPaid: (id: string, paid: boolean) => void;
  onView?: (transaction: Transaction) => void;
  readOnly?: boolean; // If true, disable edit and delete actions
}

export const TransactionActionsMenu = ({
  transaction,
  onEdit,
  onDelete,
  onMarkAsPaid,
  onView,
  readOnly = false,
}: TransactionActionsMenuProps) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const isPaid = transaction.paid !== false; // undefined ou true = pago
  // An invoice payment can only be undone (deleted): editing it or flipping it to
  // pending would move one side of the payment without the other.
  const isInvoicePayment = transaction.attachmentUrl?.startsWith('invoice_pay:') ?? false;

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
          className="flex h-9 w-9 items-center justify-center rounded-lg text-content-tertiary hover:bg-surface-sunken hover:text-content data-[state=open]:bg-surface-sunken data-[state=open]:text-content transition-colors"
          aria-label={t.moreOptions || 'Mais opções'}
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="min-w-[14rem] bg-surface-elevated rounded-xl shadow-floating ring-1 ring-line-subtle z-50 p-1.5 animate-menu-in"
          sideOffset={4}
          align="end"
        >
          <div>
            {onView && (
              <button
                onClick={handleView}
                className="w-full flex items-center gap-3 h-10 px-3 text-[15px] text-content rounded-lg hover:bg-surface-sunken focus:outline-none focus-visible:bg-surface-sunken disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Eye className="h-[18px] w-[18px] shrink-0 opacity-80" aria-hidden="true" />
                <span>{t.viewDetails || 'Ver detalhes'}</span>
              </button>
            )}
            {!readOnly && (
              <>
                {isInvoicePayment ? null : !isPaid ? (
                  <button
                    onClick={handleMarkAsPaid}
                    className="w-full flex items-center gap-3 h-10 px-3 text-[15px] text-content rounded-lg hover:bg-surface-sunken focus:outline-none focus-visible:bg-surface-sunken disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <CheckCircle className="h-[18px] w-[18px] shrink-0 opacity-80" aria-hidden="true" />
                    <span>{t.markAsPaid || 'Marcar como pago'}</span>
                  </button>
                ) : (
                  <button
                    onClick={handleMarkAsPending}
                    className="w-full flex items-center gap-3 h-10 px-3 text-[15px] text-content rounded-lg hover:bg-surface-sunken focus:outline-none focus-visible:bg-surface-sunken disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Clock className="h-[18px] w-[18px] shrink-0 opacity-80" aria-hidden="true" />
                    <span>{t.markAsPending || 'Marcar como pendente'}</span>
                  </button>
                )}
                {!isInvoicePayment && (
                <button
                  onClick={handleEdit}
                  className="w-full flex items-center gap-3 h-10 px-3 text-[15px] text-content rounded-lg hover:bg-surface-sunken focus:outline-none focus-visible:bg-surface-sunken disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Edit className="h-[18px] w-[18px] shrink-0 opacity-80" aria-hidden="true" />
                  <span>{t.edit}</span>
                </button>
                )}
                <button
                  onClick={handleDelete}
                  className="w-full flex items-center gap-3 h-10 px-3 text-[15px] text-negative-on-soft rounded-lg hover:bg-negative-soft focus:outline-none focus-visible:bg-negative-soft transition-colors"
                >
                  <Trash2 className="h-[18px] w-[18px] shrink-0 opacity-80" aria-hidden="true" />
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

