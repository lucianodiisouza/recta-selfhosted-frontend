import { useState } from 'react';
import { MoreVertical, Settings } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import { useI18n } from '../context/I18nContext';

interface DashboardActionsMenuProps {
  onOpenConfig: () => void;
}

export const DashboardActionsMenu = ({
  onOpenConfig,
}: DashboardActionsMenuProps) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className="inline-flex items-center justify-center gap-2 h-10 px-3 rounded-lg border border-line bg-surface-elevated text-sm font-semibold text-content-secondary hover:bg-surface-sunken data-[state=open]:bg-surface-sunken transition-colors"
          aria-label={t.moreOptions}
        >
          <MoreVertical className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
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
              onClick={() => {
                onOpenConfig();
                setOpen(false);
              }}
              className="w-full flex items-center gap-3 h-10 px-3 text-[15px] text-content rounded-lg hover:bg-surface-sunken focus:outline-none focus-visible:bg-surface-sunken disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Settings className="h-[18px] w-[18px] shrink-0 opacity-80" aria-hidden="true" />
              <span>{t.configureWidgets}</span>
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

