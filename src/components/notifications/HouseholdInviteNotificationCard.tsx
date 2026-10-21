import { Users, Clock, Hourglass, Check, XCircle } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import type { Notification } from '../../hooks/api/useNotifications';

interface HouseholdInviteNotificationCardProps {
  notification: Notification;
  isExpired: boolean;
  expiresIn: string | null;
  role: string | undefined;
  inviteId: string | undefined;
  householdName: string | undefined;
  householdId: string | undefined;
  isClickable: boolean;
  isInvitePending: boolean;
  onAccept: (e: React.MouseEvent) => void;
  onReject: (e: React.MouseEvent) => void;
  onNotificationClick: (e: React.MouseEvent) => void;
  isAccepting: boolean;
  isRejecting: boolean;
}

export const HouseholdInviteNotificationCard = ({
  notification,
  isExpired,
  expiresIn,
  role,
  inviteId,
  householdName: _householdName,
  householdId: _householdId,
  isClickable,
  isInvitePending,
  onAccept,
  onReject,
  onNotificationClick,
  isAccepting,
  isRejecting,
}: HouseholdInviteNotificationCardProps) => {
  const { t } = useI18n();
  const cancelledByInviter = !!notification.metadata?.cancelledByInviter;
  const acceptedByMe = !!notification.metadata?.acceptedByMe;
  const resolvedLabel = notification.status === 'ARCHIVED' ? 'Rejeitado' : 'Lido';

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'EDITOR':
        return t.editor;
      case 'VIEWER':
        return t.viewer;
      default:
        return role;
    }
  };

  const isResolvedOther = !isInvitePending && !acceptedByMe && !cancelledByInviter;

  const bgStyles = cancelledByInviter
    ? 'bg-gray-50 dark:bg-gray-900/20 border-line'
    : acceptedByMe
      ? 'bg-positive-soft border-positive/25'
      : isResolvedOther
        ? 'bg-gray-50 dark:bg-gray-900/20 border-line'
        : isExpired
          ? 'bg-negative-soft border-negative/25 hover:bg-red-100 dark:hover:bg-red-900/30'
          : 'bg-warning/10 border-warning/25 hover:bg-yellow-100 dark:hover:bg-yellow-900/30';

  const iconBg = cancelledByInviter
    ? 'bg-gray-100 dark:bg-gray-800/50'
    : acceptedByMe
      ? 'bg-green-100 dark:bg-green-900/30'
      : isResolvedOther
        ? 'bg-gray-100 dark:bg-gray-800/50'
        : isExpired
          ? 'bg-negative-soft'
          : 'bg-yellow-100 dark:bg-yellow-900/30';

  return (
    <div
      onClick={isClickable ? onNotificationClick : undefined}
      className={`p-3 rounded-lg border mb-2 transition-colors ${
        !isClickable ? 'opacity-75 cursor-default' : 'cursor-pointer'
      } ${bgStyles} ${!isClickable ? 'hover:opacity-75' : ''}`}
    >
      <div className="flex items-start space-x-3">
        <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          {cancelledByInviter ? (
            <XCircle className="h-5 w-5 text-content-tertiary" />
          ) : acceptedByMe ? (
            <Check className="h-5 w-5 text-positive" />
          ) : isResolvedOther ? (
            <Check className="h-5 w-5 text-content-tertiary" />
          ) : isExpired ? (
            <Clock className="h-5 w-5 text-negative" />
          ) : (
            <Users className="h-5 w-5 text-warning" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-content break-words">
            {notification.title}
          </p>
          <p className="text-xs text-content-tertiary mt-0.5 break-words">
            {notification.message}
          </p>
          <div className="flex items-center space-x-2 mt-2 flex-wrap">
            {cancelledByInviter ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300">
                <XCircle className="h-3 w-3 mr-1" />
                {t.inviteRemoved}
              </span>
            ) : acceptedByMe ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-200 text-green-800 dark:bg-green-800/50 dark:text-green-200">
                <Check className="h-3 w-3 mr-1" />
                {t.inviteAccepted}
              </span>
            ) : isResolvedOther ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300">
                <Check className="h-3 w-3 mr-1" />
                {t.inviteResolved}
              </span>
            ) : !isClickable ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300">
                {resolvedLabel}
              </span>
            ) : isExpired ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-200 text-red-800 dark:bg-red-800/50 dark:text-red-200">
                <Clock className="h-3 w-3 mr-1" />
                Expirado
              </span>
            ) : (
              <>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-200 text-yellow-800 dark:bg-yellow-800/50 dark:text-yellow-200">
                  <Hourglass className="h-3 w-3 mr-1" />
                  Pendente
                </span>
                {expiresIn && (
                  <span className="text-xs text-content-tertiary">
                    Expira {expiresIn}
                  </span>
                )}
              </>
            )}
            {role && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                role === 'EDITOR'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
              }`}>
                {getRoleLabel(role)}
              </span>
            )}
          </div>
          {acceptedByMe && (
            <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                disabled
                className="flex-1 flex items-center justify-center px-3 py-1.5 text-xs font-medium text-white bg-green-600 dark:bg-green-700 rounded-lg opacity-90 cursor-default"
              >
                <Check className="h-3 w-3 mr-1" />
                {t.inviteAccepted}
              </button>
            </div>
          )}
          {!acceptedByMe && !cancelledByInviter && isClickable && isInvitePending && !isExpired && inviteId && (
            <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={onAccept}
                disabled={isAccepting}
                className="flex-1 flex items-center justify-center px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Check className="h-3 w-3 mr-1" />
                Aceitar
              </button>
              <button
                type="button"
                onClick={onReject}
                disabled={isRejecting}
                className="flex-1 flex items-center justify-center px-3 py-1.5 text-xs font-medium text-content-secondary bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <XCircle className="h-3 w-3 mr-1" />
                Rejeitar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
