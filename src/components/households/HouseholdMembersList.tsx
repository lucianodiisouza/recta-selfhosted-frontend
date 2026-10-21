import { Users } from 'lucide-react';
import { HouseholdMemberCard } from './HouseholdMemberCard';
import { useI18n } from '../../context/I18nContext';

interface MemberItem {
  id: string;
  userId?: string;
  email: string;
  displayName: string | null;
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
  allowPersonalAccountAccess: boolean;
  status: 'active' | 'pending';
  type: 'member' | 'invite';
  memberId?: string;
  inviteId?: string;
  expiresAt?: string;
  isExpired: boolean;
  sharedAccountIds?: string[];
}

interface HouseholdMembersListProps {
  allMembers: MemberItem[];
  totalCount: number;
  activeCount: number;
  pendingCount: number;
  isLoading: boolean;
  isOwner: boolean;
  currentUser?: { id: string } | null;
  isSharedHousehold: boolean;
  getRoleLabel: (role: string) => string;
  onCancelInvite?: (inviteId: string, email: string) => void;
  onRemoveMember?: (memberId: string, email: string) => void;
  onRoleChange?: (memberId: string, newRole: 'EDITOR' | 'VIEWER') => void;
}

export const HouseholdMembersList = ({
  allMembers,
  totalCount,
  activeCount,
  pendingCount,
  isLoading,
  isOwner,
  currentUser,
  isSharedHousehold,
  getRoleLabel,
  onCancelInvite,
  onRemoveMember,
  onRoleChange,
}: HouseholdMembersListProps) => {
  const { t } = useI18n();
  return (
    <div className="mb-6">
      <h4 className="text-sm font-medium text-content-secondary mb-3 flex items-center">
        <Users className="h-4 w-4 mr-2 text-brand" />
        Membros ({totalCount})
        {pendingCount > 0 && (
          <span className="ml-2 text-xs font-light text-content-tertiary">
            ({activeCount} ativos, {pendingCount} pendentes)
          </span>
        )}
      </h4>
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : allMembers.length > 0 ? (
        <div className="space-y-2">
          {allMembers.map((item) => {
            const isPending = item.status === 'pending';
            const isExpired = item.isExpired;
            
            return (
              <HouseholdMemberCard
                key={item.id}
                item={item}
                isPending={isPending}
                isExpired={isExpired}
                isOwner={isOwner}
                currentUser={currentUser}
                isSharedHousehold={isSharedHousehold}
                getRoleLabel={getRoleLabel}
                onCancelInvite={onCancelInvite}
                onRemoveMember={onRemoveMember}
                onRoleChange={onRoleChange}
              />
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 font-light text-content-tertiary">
          <p className="text-sm">{t.noMembersFound}</p>
        </div>
      )}
    </div>
  );
};
