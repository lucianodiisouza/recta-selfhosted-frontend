import { useEffect, useState, useRef } from 'react';
import { Bell, Inbox } from 'lucide-react';
import { useNotifications, useMarkAllNotificationsAsRead, useMarkNotificationAsRead, useUpdateNotificationStatus } from '../hooks/api/useNotifications';
import { useAcceptInvite, useRejectInvite, usePendingInvites } from '../hooks/api/useHouseholds';
import { useToastContext } from '../context/ToastContext';
import { useI18n } from '../context/I18nContext';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { EmptyState } from './EmptyState';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { Notification } from '../hooks/api/useNotifications';
import {
  NotificationDropdownHeader,
  HouseholdInviteNotificationCard,
  BudgetAlertNotificationCard,
  GenericNotificationCard,
} from './notifications';

interface InvitesNotificationProps {
  onInviteClick?: (inviteId: string) => void;
}

export function InvitesNotification({ onInviteClick }: InvitesNotificationProps) {
  // Buscar todas (UNREAD, READ, ARCHIVED) para continuar vendo — lidas/arquivadas ficam não clicáveis
  const { data: notificationsResponse, isLoading } = useNotifications({ limit: 50 });
  const markAllAsRead = useMarkAllNotificationsAsRead();
  const markAsRead = useMarkNotificationAsRead();
  const updateStatus = useUpdateNotificationStatus();
  const acceptInvite = useAcceptInvite();
  const rejectInvite = useRejectInvite();
  const { data: pendingInvites } = usePendingInvites();
  const { success, error: showError } = useToastContext();
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Lista completa: ordenar UNREAD primeiro, depois por data
  const allNotifications = (notificationsResponse?.data || []).sort((a, b) => {
    if (a.status === 'UNREAD' && b.status !== 'UNREAD') return -1;
    if (a.status !== 'UNREAD' && b.status === 'UNREAD') return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  const unreadCount = allNotifications.filter((n) => n.status === 'UNREAD').length;

  // Check for new notifications
  useEffect(() => {
    if (unreadCount > 0) {
      setHasNewNotifications(true);
    }
  }, [unreadCount]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleAcceptInvite = async (inviteId: string, householdName: string, notificationId: string, householdId: string | undefined, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const member = await acceptInvite.mutateAsync(inviteId);
      // Mark notification as read
      await markAsRead.mutateAsync(notificationId);
      
      // Force refetch of members for the household where the invite was accepted
      // Use householdId from notification metadata if available, otherwise from member response
      const targetHouseholdId = householdId || member?.householdId;
      if (targetHouseholdId) {
        // Invalidate and refetch members list for this household to ensure UI updates
        queryClient.invalidateQueries({ queryKey: ['households', targetHouseholdId, 'members'] });
        queryClient.refetchQueries({ queryKey: ['households', targetHouseholdId, 'members'] });
        // Also invalidate invites for this household
        queryClient.invalidateQueries({ queryKey: ['households', targetHouseholdId, 'invites'] });
      }
      
      success(t.youWereAddedToHousehold.replace('{{name}}', householdName));
      setIsDropdownOpen(false);
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error || error?.message || t.errorAcceptingInvite;
      showError(errorMessage);
    }
  };

  const handleRejectInvite = async (inviteId: string, notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await rejectInvite.mutateAsync(inviteId);
      // Archive notification when rejected
      await updateStatus.mutateAsync({ notificationId, status: 'ARCHIVED' });
      success(t.inviteRejected);
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error || error?.message || t.errorRejectingInvite;
      showError(errorMessage);
    }
  };

  const handleNotificationClick = (notification: Notification, e: React.MouseEvent) => {
    e.stopPropagation();
    // Para HOUSEHOLD_INVITE: clicabilidade vem de convite ainda pendente, não de notification.status
    // Para os demais: READ/ARCHIVED não clicáveis
    if (notification.type !== 'HOUSEHOLD_INVITE' && notification.status !== 'UNREAD') return;

    // HOUSEHOLD_INVITE: não marcar como lida ao só abrir o modal — só ao aceitar/rejeitar
    if (notification.type !== 'HOUSEHOLD_INVITE') {
      markAsRead.mutateAsync(notification.id).catch((_err) => {});
    }

    if (notification.type === 'HOUSEHOLD_INVITE') {
      const inviteId = notification.metadata?.inviteId;
      if (inviteId && onInviteClick) {
        onInviteClick(inviteId);
        setIsDropdownOpen(false);
      }
    } else if (notification.deepLink) {
      navigate(notification.deepLink);
      setIsDropdownOpen(false);
    }
  };

  const handleMarkAllAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await markAllAsRead.mutateAsync();
      success('Todas as notificações foram marcadas como lidas');
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error || error?.message || 'Erro ao marcar notificações como lidas';
      showError(errorMessage);
    }
  };

  // Don't show button if loading
  if (isLoading) {
    return null;
  }

  const hasNotifications = allNotifications.length > 0;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          setIsDropdownOpen(!isDropdownOpen);
          setHasNewNotifications(false);
        }}
        className="relative p-2 text-content-secondary hover:text-content hover:bg-surface-sunken rounded-lg transition-colors flex-shrink-0"
        aria-label="Notificações"
        title={hasNotifications ? `${unreadCount} ${unreadCount === 1 ? 'notificação não lida' : 'notificações não lidas'}` : 'Notificações'}
      >
        <Bell className="h-5 w-5" />
        {hasNewNotifications && (
          <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 bg-primary-600 text-white text-xs rounded-full flex items-center justify-center font-medium">
            {unreadCount}
          </span>
        )}
      </button>

      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-surface-elevated border border-line rounded-lg shadow-xl z-50 max-h-[500px] overflow-y-auto">
          <NotificationDropdownHeader
            unreadCount={unreadCount}
            totalCount={allNotifications.length}
            onMarkAllAsRead={handleMarkAllAsRead}
            onClose={() => setIsDropdownOpen(false)}
            isMarkingAllAsRead={markAllAsRead.isPending}
          />

          {/* Notifications List */}
          <div className="p-2">
            {hasNotifications ? (
              allNotifications.map((notification) => {
                const isClickable = notification.status === 'UNREAD';
                const isExpired = notification.expiresAt ? new Date(notification.expiresAt) < new Date() : false;
                const expiresIn = notification.expiresAt
                  ? formatDistanceToNow(new Date(notification.expiresAt), {
                      addSuffix: true,
                      locale: ptBR,
                    })
                  : null;

                // Render different notification types
                if (notification.type === 'HOUSEHOLD_INVITE') {
                  const householdId = notification.metadata?.householdId as string | undefined;
                  const householdName = notification.metadata?.householdName as string | undefined;
                  const role = notification.metadata?.role as string | undefined;
                  // inviteId: metadata primeiro; fallback deepLink (?inviteId=uuid); fallback buscar na lista de pendentes por householdId
                  let inviteId = notification.metadata?.inviteId as string | undefined;
                  if (!inviteId && notification.deepLink) {
                    const m = notification.deepLink.match(/[?&]inviteId=([^&]+)/);
                    if (m) inviteId = m[1];
                  }
                  if (!inviteId && householdId && (pendingInvites || []).length) {
                    const p = (pendingInvites || []).find((i: { household?: { id?: string }; householdId?: string; id: string }) => (i.household?.id === householdId || i.householdId === householdId));
                    if (p) inviteId = p.id;
                  }
                  const cancelledByInviter = !!notification.metadata?.cancelledByInviter;
                  const acceptedByMe = !!notification.metadata?.acceptedByMe;
                  const isInvitePending = !!inviteId && !!(pendingInvites || []).some((i: { id: string }) => i.id === inviteId);
                  const isClickableInvite =
                    notification.status !== 'ARCHIVED' &&
                    !cancelledByInviter &&
                    !acceptedByMe &&
                    isInvitePending;

                  return (
                    <HouseholdInviteNotificationCard
                      key={notification.id}
                      notification={notification}
                      isExpired={isExpired}
                      expiresIn={expiresIn}
                      role={role}
                      inviteId={inviteId}
                      householdName={householdName}
                      householdId={householdId}
                      isClickable={isClickableInvite}
                      isInvitePending={isInvitePending}
                      onAccept={(e) => handleAcceptInvite(inviteId!, householdName || 'Household', notification.id, householdId, e)}
                      onReject={(e) => handleRejectInvite(inviteId!, notification.id, e)}
                      onNotificationClick={(e) => handleNotificationClick(notification, e)}
                      isAccepting={acceptInvite.isPending}
                      isRejecting={rejectInvite.isPending}
                    />
                  );
                }

                // Budget Alert notification
                if (notification.type === 'BUDGET_ALERT') {
                  const percentage = notification.metadata?.percentage as number | undefined;
                  const isOverBudget = percentage !== undefined && percentage >= 100;

                  return (
                    <BudgetAlertNotificationCard
                      key={notification.id}
                      notification={notification}
                      percentage={percentage}
                      isOverBudget={isOverBudget}
                      isClickable={isClickable}
                      onNotificationClick={(e) => handleNotificationClick(notification, e)}
                    />
                  );
                }

                // Generic notification fallback
                return (
                    <GenericNotificationCard
                      key={notification.id}
                      notification={notification}
                      isClickable={isClickable}
                      onNotificationClick={(e) => handleNotificationClick(notification, e)}
                    />
                  );
              })
            ) : (
              <div className="py-8 px-4">
                <EmptyState
                  icon={Inbox}
                  title={t.noNotifications}
                  description={t.youHaveNoUnreadNotifications}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
