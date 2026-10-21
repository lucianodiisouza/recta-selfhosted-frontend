import { Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Notification } from '../../hooks/api/useNotifications';

interface GenericNotificationCardProps {
  notification: Notification;
  isClickable: boolean;
  onNotificationClick: (e: React.MouseEvent) => void;
}

export const GenericNotificationCard = ({
  notification,
  isClickable,
  onNotificationClick,
}: GenericNotificationCardProps) => {
  return (
    <div
      onClick={isClickable ? onNotificationClick : undefined}
      className={`p-3 rounded-lg border border-line bg-surface-elevated mb-2 transition-colors ${isClickable ? 'cursor-pointer hover:bg-surface-sunken' : 'cursor-default opacity-75'}`}
    >
      <div className="flex items-start space-x-3">
        <div className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 bg-brand-soft">
          <Bell className="h-5 w-5 text-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-content break-words">
            {notification.title}
          </p>
          <p className="text-xs text-content-tertiary mt-0.5 break-words whitespace-pre-wrap">
            {notification.message}
          </p>
          <span className="inline-block mt-2 text-xs text-content-tertiary">
            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: ptBR })}
          </span>
        </div>
      </div>
    </div>
  );
};
