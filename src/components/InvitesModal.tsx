import { createPortal } from 'react-dom';
import { X, Check, XCircle, Clock, Mail } from 'lucide-react';
import { usePendingInvites, useAcceptInvite, useRejectInvite } from '../hooks/api/useHouseholds';
import { useToastContext } from '../context/ToastContext';
import { useI18n } from '../context/I18nContext';
import { analyticsHelpers } from '../utils/analytics';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { EmptyState } from './EmptyState';

interface InvitesModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedInviteId?: string | null;
}

export function InvitesModal({ isOpen, onClose, selectedInviteId }: InvitesModalProps) {
  const { data: invites, isLoading } = usePendingInvites();
  const acceptInvite = useAcceptInvite();
  const rejectInvite = useRejectInvite();
  const { success, error: showError } = useToastContext();
  const { t } = useI18n();

  const allPendingInvites = invites?.filter((invite) => invite.status === 'PENDING') || [];
  // If selectedInviteId is provided, show only that invite, otherwise show all
  const pendingInvites = selectedInviteId
    ? allPendingInvites.filter((invite) => invite.id === selectedInviteId)
    : allPendingInvites;
  const acceptedInvites = invites?.filter((invite) => invite.status === 'ACCEPTED') || [];
  const rejectedInvites = invites?.filter((invite) => invite.status === 'REJECTED') || [];

  const handleAccept = async (inviteId: string, householdName: string) => {
    try {
      await acceptInvite.mutateAsync(inviteId);
      success(t.youWereAddedToHousehold.replace('{{name}}', householdName));
      analyticsHelpers.logHouseholdMemberInviteAccepted();
      onClose();
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error || error?.message || t.errorAcceptingInvite;
      showError(errorMessage);
    }
  };

  const handleReject = async (inviteId: string) => {
    try {
      await rejectInvite.mutateAsync(inviteId);
      success(t.inviteRejected);
      analyticsHelpers.logHouseholdMemberInviteRejected();
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error || error?.message || t.errorRejectingInvite;
      showError(errorMessage);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'OWNER':
        return t.owner;
      case 'EDITOR':
        return t.editor;
      case 'VIEWER':
        return t.viewer;
      default:
        return role;
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Modal */}
        <div className="inline-block align-bottom bg-surface-elevated rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <div className="bg-surface-elevated px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-content">
                {t.myInvites}
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isLoading ? (
              <p className="text-sm text-content-tertiary">{t.loading}</p>
            ) : (
              <div className="space-y-6">
                {/* Pending Invites */}
                {pendingInvites.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-content mb-3 flex items-center">
                      <Clock className="h-4 w-4 mr-2 text-yellow-500" />
                      {t.invitesPending} ({pendingInvites.length})
                    </h4>
                    <div className="space-y-3">
                      {pendingInvites.map((invite) => {
                        const isExpired = new Date(invite.expiresAt) < new Date();
                        const expiresIn = formatDistanceToNow(new Date(invite.expiresAt), {
                          addSuffix: true,
                          locale: ptBR,
                        });

                        return (
                          <div
                            key={invite.id}
                            className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-content">
                                  {invite.household.name}
                                </p>
                                <p className="text-xs text-content-tertiary mt-1">
                                  Convite de {invite.inviter.displayName || invite.inviter.email}
                                </p>
                                <p className="text-xs text-content-tertiary mt-1">
                                  Permissão: {getRoleLabel(invite.role)}
                                </p>
                                <p className="text-xs text-content-tertiary mt-1">
                                  {isExpired ? (
                                    <span className="text-negative">Expirado</span>
                                  ) : (
                                    `Expira ${expiresIn}`
                                  )}
                                </p>
                              </div>
                            </div>

                            {!isExpired && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleAccept(invite.id, invite.household.name)}
                                  disabled={acceptInvite.isPending}
                                  className="flex-1 flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <Check className="h-4 w-4 mr-2" />
                                  {t.accept}
                                </button>
                                <button
                                  onClick={() => handleReject(invite.id)}
                                  disabled={rejectInvite.isPending}
                                  className="flex-1 flex items-center justify-center px-4 py-2 text-sm font-medium text-content-secondary bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  {t.reject}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Accepted Invites */}
                {acceptedInvites.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-content mb-3 flex items-center">
                      <Check className="h-4 w-4 mr-2 text-positive" />
                      {t.invitesAccepted} ({acceptedInvites.length})
                    </h4>
                    <div className="space-y-2">
                      {acceptedInvites.map((invite) => (
                        <div
                          key={invite.id}
                          className="p-3 bg-positive-soft rounded-lg border border-positive/25"
                        >
                          <p className="text-sm font-medium text-content">
                            {invite.household.name}
                          </p>
                          <p className="text-xs text-content-tertiary mt-1">
                            Aceito {invite.acceptedAt && formatDistanceToNow(new Date(invite.acceptedAt), { addSuffix: true, locale: ptBR })}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rejected Invites */}
                {rejectedInvites.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-content mb-3 flex items-center">
                      <XCircle className="h-4 w-4 mr-2 text-negative" />
                      {t.invitesRejected} ({rejectedInvites.length})
                    </h4>
                    <div className="space-y-2">
                      {rejectedInvites.map((invite) => (
                        <div
                          key={invite.id}
                          className="p-3 bg-negative-soft rounded-lg border border-negative/25"
                        >
                          <p className="text-sm font-medium text-content">
                            {invite.household.name}
                          </p>
                          <p className="text-xs text-content-tertiary mt-1">
                            Rejeitado {invite.rejectedAt && formatDistanceToNow(new Date(invite.rejectedAt), { addSuffix: true, locale: ptBR })}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {pendingInvites.length === 0 && acceptedInvites.length === 0 && rejectedInvites.length === 0 && (
                  <EmptyState
                    icon={Mail}
                    title={t.noInvitesFound}
                    description={t.youHaveNoPendingInvites}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
