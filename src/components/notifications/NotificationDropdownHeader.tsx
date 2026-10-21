import { Bell, X } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';

interface NotificationDropdownHeaderProps {
  unreadCount: number;
  totalCount: number;
  onMarkAllAsRead: (e: React.MouseEvent) => void;
  onClose: () => void;
  isMarkingAllAsRead: boolean;
}

export const NotificationDropdownHeader = ({
  unreadCount,
  totalCount,
  onMarkAllAsRead,
  onClose,
  isMarkingAllAsRead,
}: NotificationDropdownHeaderProps) => {
  const { t } = useI18n();

  return (
    <div className="sticky top-0 bg-surface-elevated border-b border-line px-4 py-3 flex items-center justify-between z-10">
      <div className="flex items-center space-x-2">
        <Bell className="h-4 w-4 text-brand" />
        <h3 className="text-sm font-semibold text-content">
          {t.notifications || 'Notificações'}
        </h3>
        {totalCount > 0 && (
          <span className="text-xs text-content-tertiary">
            ({unreadCount > 0 ? `${unreadCount} não lidas` : totalCount})
          </span>
        )}
      </div>
      <div className="flex items-center space-x-2">
        {unreadCount > 0 && (
          <button
            onClick={onMarkAllAsRead}
            disabled={isMarkingAllAsRead}
            className="text-xs text-brand hover:text-primary-700 dark:hover:text-primary-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title={t.markAllAsRead || 'Marcar todas como lidas'}
          >
            Marcar todas como lidas
          </button>
        )}
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400 transition-colors"
          aria-label={t.close}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
