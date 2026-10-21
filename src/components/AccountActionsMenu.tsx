import { useState } from 'react';
import { MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import { useI18n } from '../context/I18nContext';
import { Account } from '../types';

interface AccountActionsMenuProps {
  account: Account;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
  isAccountOwner?: boolean; // If false, disable edit/delete actions
}

export const AccountActionsMenu = ({
  account,
  onEdit,
  onDelete,
  isAccountOwner = true,
}: AccountActionsMenuProps) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const handleEdit = () => {
    if (!isAccountOwner) return;
    onEdit(account);
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
              onClick={handleEdit}
              disabled={!isAccountOwner}
              className={`w-full flex items-center gap-3 h-10 px-3 text-[15px] rounded-lg focus:outline-none transition-colors ${
                isAccountOwner
                  ? 'text-content hover:bg-surface-sunken focus-visible:bg-surface-sunken'
                  : 'text-content-tertiary cursor-not-allowed opacity-50'
              }`}
              title={!isAccountOwner ? 'Apenas o dono da conta pode editar' : undefined}
            >
              <Edit className="h-[18px] w-[18px] shrink-0 opacity-80" aria-hidden="true" />
              <span>{t.edit}</span>
            </button>
            <button
              onClick={handleDelete}
              disabled={!isAccountOwner}
              className={`w-full flex items-center gap-3 h-10 px-3 text-[15px] rounded-lg focus:outline-none transition-colors ${
                isAccountOwner
                  ? 'text-negative-on-soft hover:bg-negative-soft focus-visible:bg-negative-soft'
                  : 'text-content-tertiary cursor-not-allowed opacity-50'
              }`}
              title={!isAccountOwner ? 'Apenas o dono da conta pode deletar' : undefined}
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
