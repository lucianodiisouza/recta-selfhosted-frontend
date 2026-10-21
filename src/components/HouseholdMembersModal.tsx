import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import {
  useHouseholdMembers,
  useInviteMember,
  useRemoveMember,
  useUpdateMemberRole,
  useHouseholdInvites,
  useCancelInvite,
  useUpdatePersonalAccountAccess,
  useUpdateSharedAccountIds,
  useHouseholds,
  useDeleteHousehold,
  useLeaveHousehold,
} from '../hooks/api/useHouseholds';
import { useAccounts } from '../hooks/api/useAccounts';
import { useToastContext } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { useMemo, useState } from 'react';
import {
  HouseholdMembersModalHeader,
  HouseholdMembersList,
  InviteMemberForm,
  AccountSharingSection,
  JoinLinkCard,
  JoinWithCodeForm,
} from './households';
import { saveHouseholdToLocalStorage, clearHouseholdFromLocalStorage } from '../utils/householdStorage';
import ConfirmModal from './ConfirmModal';
import { analyticsHelpers } from '../utils/analytics';

const inviteMemberSchema = z.object({
  email: z.string().email('Email inválido'),
  role: z.enum(['EDITOR', 'VIEWER']),
});

type InviteMemberFormData = z.infer<typeof inviteMemberSchema>;

interface HouseholdMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  householdId: string;
  userRole: 'OWNER' | 'EDITOR' | 'VIEWER';
}

export function HouseholdMembersModal({
  isOpen,
  onClose,
  householdId,
  userRole,
}: HouseholdMembersModalProps) {
  const { success, error: showError } = useToastContext();
  const { currentUser } = useAuth();
  const { t } = useI18n();
  const { data: members, isLoading: membersLoading } = useHouseholdMembers(householdId);
  const isOwner = userRole === 'OWNER';
  // Only fetch invites if user is OWNER (API requires OWNER permission)
  const { data: invites, isLoading: invitesLoading } = useHouseholdInvites(householdId);
  const inviteMember = useInviteMember();
  const removeMember = useRemoveMember();
  const updateMemberRole = useUpdateMemberRole();
  const cancelInvite = useCancelInvite();
  const updatePersonalAccountAccess = useUpdatePersonalAccountAccess();
  const updateSharedAccountIds = useUpdateSharedAccountIds();
  const { data: households } = useHouseholds();
  const deleteHousehold = useDeleteHousehold();
  const leaveHousehold = useLeaveHousehold();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  
  const isLoading = membersLoading || invitesLoading;

  // Find current user's membership to check their allowPersonalAccountAccess and sharedAccountIds status
  const currentUserMembership = members?.find(m => m.userId === currentUser?.uid);
  
  // Find personal household (oldest household by createdAt)
  const personalHousehold = useMemo(() => {
    if (!households || households.length === 0) return null;
    // Sort by createdAt and get the oldest one (personal household)
    const sorted = [...households].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateA - dateB; // Oldest first
    });
    return sorted[0];
  }, [households]);
  
  // Fetch personal accounts
  const { data: personalAccountsData } = useAccounts({
    householdId: personalHousehold?.id || '',
  });
  
  const personalAccounts = personalAccountsData?.accounts || [];
  
  // State for selected account IDs (only show for current user in shared household)
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(() => {
    return currentUserMembership?.sharedAccountIds || [];
  });
  
  // Update selectedAccountIds when currentUserMembership changes
  useEffect(() => {
    if (currentUserMembership?.sharedAccountIds) {
      setSelectedAccountIds(currentUserMembership.sharedAccountIds);
    } else {
      setSelectedAccountIds([]);
    }
  }, [currentUserMembership?.sharedAccountIds]);
  
  // Check if this is a shared household (not personal)
  const isSharedHousehold = personalHousehold && personalHousehold.id !== householdId;
  
  // Debug logs removed

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<InviteMemberFormData>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: {
      role: 'EDITOR',
    },
  });

  const onSubmit = async (data: InviteMemberFormData) => {
    const invitedEmail = (data.email || '').trim().toLowerCase();
    const myEmail = (currentUser?.email || '').trim().toLowerCase();
    if (myEmail && invitedEmail === myEmail) {
      showError(t.cannotInviteYourself);
      return;
    }
    try {
      await inviteMember.mutateAsync({ householdId, ...data });
      success(t.inviteSent);
      analyticsHelpers.logHouseholdMemberInvited(data.role);
      reset();
    } catch (error: unknown) {
      const inviteErrors: Record<string, string> = {
        HOUSEHOLD_MEMBER_EXISTS: t.inviteErrorAlreadyMember,
        HOUSEHOLD_INVITE_PENDING: t.inviteErrorAlreadyPending,
        HOUSEHOLD_FULL: t.inviteErrorHouseholdFull,
      };
      const code = (error as Error & { code?: string })?.code;
      showError((code && inviteErrors[code]) || t.errorInvitingMember);
    }
  };

  const handleRemoveMember = async (memberId: string, memberEmail: string) => {
    if (!confirm(t.confirmRemoveMember.replace('{{email}}', memberEmail))) {
      return;
    }

    try {
      await removeMember.mutateAsync({ householdId, memberId });
      success(t.memberRemoved);
      analyticsHelpers.logHouseholdMemberRemoved();
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error || error?.message || t.errorRemovingMember;
      showError(errorMessage);
    }
  };

  const handleTogglePersonalAccountAccess = async (allowAccess: boolean) => {
    try {
      await updatePersonalAccountAccess.mutateAsync({ householdId, allowPersonalAccountAccess: allowAccess });
      success(allowAccess ? t.personalAccountsSharedSuccess : t.personalAccountsRevoked);
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error || error?.message || t.errorUpdatingPermission;
      showError(errorMessage);
    }
  };
  
  const handleToggleAccountSelection = (accountId: string) => {
    const newSelected = selectedAccountIds.includes(accountId)
      ? selectedAccountIds.filter(id => id !== accountId)
      : [...selectedAccountIds, accountId];
    setSelectedAccountIds(newSelected);
  };
  
  const handleSaveSharedAccountIds = async () => {
    try {
      await updateSharedAccountIds.mutateAsync({ householdId, sharedAccountIds: selectedAccountIds });
      success(selectedAccountIds.length > 0 
        ? t.sharedAccountsUpdatedSuccess.replace('{{count}}', selectedAccountIds.length.toString())
        : t.noAccountsShared);
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error || error?.message || t.errorUpdatingSharedAccounts;
      showError(errorMessage);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: 'EDITOR' | 'VIEWER') => {
    try {
      await updateMemberRole.mutateAsync({ householdId, memberId, role: newRole });
      success(t.permissionUpdatedSuccess);
      analyticsHelpers.logHouseholdMemberRoleUpdated(newRole);
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error || error?.message || t.errorUpdatingPermission;
      showError(errorMessage);
    }
  };

  const handleCancelInvite = async (inviteId: string, email: string) => {
    if (!confirm(t.confirmCancelInvite.replace('{{email}}', email))) {
      return;
    }

    try {
      await cancelInvite.mutateAsync(inviteId);
      success(t.inviteCancelled);
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error || error?.message || t.errorCancellingInvite;
      showError(errorMessage);
    }
  };

  const handleDeleteHousehold = async () => {
    const remaining = households?.filter((h: { id?: string }) => h?.id !== householdId) ?? [];
    const firstRemaining = remaining[0];
    try {
      await deleteHousehold.mutateAsync(householdId);
      if (firstRemaining) {
        saveHouseholdToLocalStorage(firstRemaining.id, firstRemaining.name, firstRemaining.role);
      } else {
        clearHouseholdFromLocalStorage();
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('householdStorageChange'));
      }
      success(t.householdDeleted);
      analyticsHelpers.logHouseholdDeleted();
      onClose();
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error || error?.message || t.errorDeletingHousehold;
      showError(errorMessage);
    }
  };

  const handleLeaveHousehold = async () => {
    const remaining = households?.filter((h: { id?: string }) => h?.id !== householdId) ?? [];
    const firstRemaining = remaining[0];
    try {
      await leaveHousehold.mutateAsync(householdId);
      if (firstRemaining) {
        saveHouseholdToLocalStorage(firstRemaining.id, firstRemaining.name, firstRemaining.role);
      } else {
        clearHouseholdFromLocalStorage();
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('householdStorageChange'));
      }
      success(t.leftHouseholdSuccess);
      analyticsHelpers.logHouseholdLeft();
      onClose();
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error || error?.message || t.errorLeavingHousehold;
      showError(errorMessage);
    }
  };

  const pendingInvites = invites?.filter((invite) => invite.status === 'PENDING') || [];

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

  // Combinar membros ativos e convites pendentes em uma única lista
  // Membros ativos primeiro, depois convites pendentes
  const allMembers = [
    // Membros ativos
    ...(members?.filter((m) => m && m.user && m.user.email).map((member) => ({
      id: member.id,
      userId: member.userId,
      email: member.user?.email || t.emailNotAvailable,
      displayName: member.user?.displayName || null,
      role: member.role,
      allowPersonalAccountAccess: member.allowPersonalAccountAccess || false,
      sharedAccountIds: member.sharedAccountIds || [],
      status: 'active' as const,
      type: 'member' as const,
      memberId: member.id,
      inviteId: undefined,
      expiresAt: undefined,
      isExpired: false,
    })) || []),
    // Convites pendentes (como se fossem membros pendentes)
    ...pendingInvites.map((invite) => {
      const isExpired = new Date(invite.expiresAt) < new Date();
      return {
        id: invite.id,
        userId: undefined,
        email: invite.email,
        displayName: null,
        role: invite.role,
        allowPersonalAccountAccess: false,
        status: 'pending' as const,
        type: 'invite' as const,
        memberId: undefined,
        inviteId: invite.id,
        expiresAt: invite.expiresAt,
        isExpired,
      };
    }),
  ];

  const totalCount = allMembers.length;
  const activeCount = members?.filter((m) => m && m.user && m.user.email).length || 0;
  const pendingCount = pendingInvites.length;
  
  // Limite: 2 membros ativos por household
  const MAX_MEMBERS = 2;
  const isAtMemberLimit = activeCount >= MAX_MEMBERS;

  // Prevenir scroll do body quando modal estiver aberto
  useEffect(() => {
    if (!isOpen) return;
    
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    
    return () => {
      document.body.style.overflow = originalStyle;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Renderizar no portal para aparecer no root, não dentro do navbar
  return createPortal(
    <div className="fixed inset-0 z-[60] overflow-y-auto" onClick={handleBackdropClick}>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] animate-modal-backdrop" 
        aria-hidden="true"
      />
      
      {/* Scrollable Container */}
      <div className="flex min-h-full items-end sm:items-center justify-center sm:p-4">
        {/* Modal Card */}
        <div 
          className="relative w-full sm:w-[600px] max-w-2xl p-6 bg-surface-elevated max-h-[90vh] overflow-y-auto min-w-0 rounded-t-[28px] sm:rounded-2xl shadow-floating ring-1 ring-line-subtle animate-modal-panel"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <HouseholdMembersModalHeader
            isSharedHousehold={isSharedHousehold}
            onClose={onClose}
          />

          {/* Members List */}
          <HouseholdMembersList
            allMembers={allMembers}
            totalCount={totalCount}
            activeCount={activeCount}
            pendingCount={pendingCount}
            isLoading={isLoading || invitesLoading}
            isOwner={isOwner}
            currentUser={currentUser}
            isSharedHousehold={isSharedHousehold}
            getRoleLabel={getRoleLabel}
            onCancelInvite={handleCancelInvite}
            onRemoveMember={handleRemoveMember}
            onRoleChange={handleRoleChange}
          />

          {/* Account Sharing Section */}
          {currentUserMembership && (
            <AccountSharingSection
              isInPersonalHousehold={!isSharedHousehold}
              isSharedHousehold={isSharedHousehold}
              personalAccounts={personalAccounts}
              selectedAccountIds={selectedAccountIds}
              onToggleAccountSelection={handleToggleAccountSelection}
              onSaveSharedAccountIds={handleSaveSharedAccountIds}
              onTogglePersonalAccountAccess={handleTogglePersonalAccountAccess}
              allowPersonalAccountAccess={currentUserMembership.allowPersonalAccountAccess || false}
              isSaving={updateSharedAccountIds.isPending}
            />
          )}

          {/* Invitees see everything in this household (fdbk #163) */}
          {isOwner && !isAtMemberLimit && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-line-subtle p-3">
              <Info className="h-4 w-4 mt-px shrink-0 text-brand" aria-hidden="true" />
              <p className="text-xs text-content-tertiary">{t.householdVisibilityNotice}</p>
            </div>
          )}

          {/* Invite link / code: joins at once, whatever email the person uses */}
          {isOwner && !isAtMemberLimit && <JoinLinkCard householdId={householdId} />}

          {/* Invite Form */}
          {isOwner && (
            <InviteMemberForm
              onSubmit={onSubmit}
              isSubmitting={isSubmitting}
              errors={errors}
              isAtMemberLimit={isAtMemberLimit}
              maxMembers={MAX_MEMBERS}
              currentCount={activeCount}
              register={register}
              handleSubmit={handleSubmit}
            />
          )}

          <JoinWithCodeForm onNavigate={onClose} />

          {/* Sair da household (membro não-dono em household compartilhada) */}
          {!isOwner && isSharedHousehold && (
            <div className="mt-6 pt-6 border-t border-line-subtle">
              <h4 className="text-sm font-medium text-content-secondary mb-2">
                {t.leaveHousehold}
              </h4>
              <p className="text-xs font-light text-content-tertiary mb-3">
                {t.leaveHouseholdDescription}
              </p>
              <button
                type="button"
                onClick={() => setShowLeaveConfirm(true)}
                className="inline-flex items-center justify-center gap-2 h-11 px-5 text-[15px] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-surface-elevated text-content border border-line hover:bg-surface-sunken"
              >
                {t.leaveHousehold}
              </button>
            </div>
          )}

          {/* Danger zone: deletar household (apenas OWNER em household compartilhada) */}
          {isOwner && isSharedHousehold && (
            <div className="mt-6 pt-6 border-t border-negative/25">
              <h4 className="text-sm font-medium text-negative mb-2">
                {t.dangerZone}
              </h4>
              <p className="text-xs font-light text-content-tertiary mb-3">
                {t.deleteHouseholdDescription}
              </p>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center justify-center gap-2 h-11 px-5 text-[15px] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-negative-soft text-negative-on-soft hover:brightness-95 dark:hover:brightness-125"
              >
                {t.deleteHousehold}
              </button>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteHousehold}
        title={t.deleteHousehold}
        message={t.deleteHouseholdConfirm}
        variant="danger"
        isLoading={deleteHousehold.isPending}
      />

      <ConfirmModal
        isOpen={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        onConfirm={handleLeaveHousehold}
        title={t.leaveHousehold}
        message={t.confirmLeaveHousehold}
        confirmText={t.leaveHousehold}
        variant="warning"
        isLoading={leaveHousehold.isPending}
      />
    </div>,
    document.body
  );
}
