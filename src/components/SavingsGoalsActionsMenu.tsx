import { useState } from 'react';
import { MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import { useI18n } from '../context/I18nContext';
import { SavingsGoal } from '../types';

interface SavingsGoalsActionsMenuProps {
  goal: SavingsGoal;
  onEdit: (goal: SavingsGoal) => void;
  onDelete: (id: string) => void;
}

export const SavingsGoalsActionsMenu = ({
  goal,
  onEdit,
  onDelete,
}: SavingsGoalsActionsMenuProps) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const handleEdit = () => {
    onEdit(goal);
    setOpen(false);
  };

  const handleDelete = () => {
    if (goal.id) {
      onDelete(goal.id);
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

