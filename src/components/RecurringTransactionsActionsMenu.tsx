import { useState } from 'react';
import { MoreHorizontal, Edit, Trash2, Play, Pause } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import { useI18n } from '../context/I18nContext';
import { RecurringTransaction } from '../types';
import { analyticsHelpers } from '../utils/analytics';

interface RecurringTransactionsActionsMenuProps {
  recurring: RecurringTransaction;
  onEdit: (recurring: RecurringTransaction) => void;
  onDelete: (id: string) => void;
  onToggleActive: (recurring: RecurringTransaction) => void;
  isToggling?: boolean;
}

export const RecurringTransactionsActionsMenu = ({
  recurring,
  onEdit,
  onDelete,
  onToggleActive,
  isToggling = false,
}: RecurringTransactionsActionsMenuProps) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const handleEdit = () => {
    analyticsHelpers.logRecurringTransactionMenuAction('edit', recurring.isActive);
    onEdit(recurring);
    setOpen(false);
  };

  const handleDelete = () => {
    if (recurring.id) {
      analyticsHelpers.logRecurringTransactionMenuAction('delete', recurring.isActive);
      onDelete(recurring.id);
      setOpen(false);
    }
  };

  const handleToggleActive = () => {
    analyticsHelpers.logRecurringTransactionMenuAction('toggle', recurring.isActive);
    onToggleActive(recurring);
    setOpen(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      analyticsHelpers.logRecurringTransactionMenuOpened();
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
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
            <button
              onClick={handleToggleActive}
              disabled={isToggling}
              className="w-full flex items-center gap-3 h-10 px-3 text-[15px] text-content rounded-lg hover:bg-surface-sunken focus:outline-none focus-visible:bg-surface-sunken disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {recurring.isActive ? (
                <>
                  <Pause className="h-[18px] w-[18px] shrink-0 opacity-80" aria-hidden="true" />
                  <span>{t.pause}</span>
                </>
              ) : (
                <>
                  <Play className="h-[18px] w-[18px] shrink-0 opacity-80" aria-hidden="true" />
                  <span>{t.activate}</span>
                </>
              )}
            </button>
            <button
              onClick={handleEdit}
              className="w-full flex items-center gap-3 h-10 px-3 text-[15px] text-content rounded-lg hover:bg-surface-sunken focus:outline-none focus-visible:bg-surface-sunken disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Edit className="h-[18px] w-[18px] shrink-0 opacity-80" aria-hidden="true" />
              <span>{t.edit}</span>
            </button>
            <button
              onClick={handleDelete}
              className="w-full flex items-center gap-3 h-10 px-3 text-[15px] text-negative-on-soft rounded-lg hover:bg-negative-soft focus:outline-none focus-visible:bg-negative-soft transition-colors"
            >
              <Trash2 className="h-[18px] w-[18px] shrink-0 opacity-80" aria-hidden="true" />
              <span>{t.delete}</span>
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

