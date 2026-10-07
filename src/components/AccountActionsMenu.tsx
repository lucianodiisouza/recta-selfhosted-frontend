import { useRef, useState } from 'react';
import { MoreHorizontal, Edit, Trash2, Scale } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import { useI18n } from '../context/I18nContext';
import { Account } from '../types';

interface AccountActionsMenuProps {
  account: Account;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
  /** When given, the menu offers "Adjust balance" (the owner only, like Edit). */
  onAdjustBalance?: (account: Account) => void;
  isAccountOwner?: boolean; // If false, disable edit/delete actions
}

export const AccountActionsMenu = ({
  account,
  onEdit,
  onDelete,
  onAdjustBalance,
  isAccountOwner = true,
}: AccountActionsMenuProps) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleEdit = () => {
    if (!isAccountOwner) return;
    onEdit(account);
    setOpen(false);
  };

  const handleAdjust = () => {
    if (!isAccountOwner || !onAdjustBalance) return;
    // The menu item unmounts with the popover; a dialog opened from it would remember a detached element and lose focus
    // when it closes. Focusing the always-mounted trigger first makes it the element the dialog gives focus back to.
    triggerRef.current?.focus();
    onAdjustBalance(account);
    setOpen(false);
  };

  const handleDelete = () => {
    if (!isAccountOwner) return;
    onDelete(account);
    setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          ref={triggerRef}
          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 rounded p-1 transition-colors"
          aria-label={t.moreOptions || 'Mais opções'}
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-50 p-1"
          sideOffset={4}
          align="end"
        >
          <div className="py-1">
            <button
              onClick={handleEdit}
              disabled={!isAccountOwner}
              className={`w-full flex items-center px-4 py-2 text-sm rounded-sm focus:outline-none ${
                isAccountOwner
                  ? 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700'
                  : 'text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
              }`}
              title={!isAccountOwner ? 'Apenas o dono da conta pode editar' : undefined}
            >
              <Edit className="h-4 w-4 mr-3" aria-hidden="true" />
              <span>{t.edit}</span>
            </button>
            {onAdjustBalance && (
              <button
                onClick={handleAdjust}
                disabled={!isAccountOwner}
                className={`w-full flex items-center px-4 py-2 text-sm rounded-sm focus:outline-none ${
                  isAccountOwner
                    ? 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700'
                    : 'text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
                }`}
                title={!isAccountOwner ? t.adjustBalanceOwnerOnly : undefined}
              >
                <Scale className="h-4 w-4 mr-3" aria-hidden="true" />
                <span>{t.adjustBalanceAction}</span>
              </button>
            )}
            <button
              onClick={handleDelete}
              disabled={!isAccountOwner}
              className={`w-full flex items-center px-4 py-2 text-sm rounded-sm focus:outline-none ${
                isAccountOwner
                  ? 'text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700'
                  : 'text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
              }`}
              title={!isAccountOwner ? 'Apenas o dono da conta pode deletar' : undefined}
            >
              <Trash2 className="h-4 w-4 mr-3" aria-hidden="true" />
              <span>{t.delete}</span>
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
