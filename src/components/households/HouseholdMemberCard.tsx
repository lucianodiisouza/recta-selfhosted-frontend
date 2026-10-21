import { Select } from '../ui';
import { Mail, Hourglass, Clock, Wallet, Trash2, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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

interface HouseholdMemberCardProps {
  item: MemberItem;
  isPending: boolean;
  isExpired: boolean;
  isOwner: boolean;
  currentUser?: { id: string } | null;
  isSharedHousehold: boolean;
  getRoleLabel: (role: string) => string;
  onCancelInvite?: (inviteId: string, email: string) => void;
  onRemoveMember?: (memberId: string, email: string) => void;
  onRoleChange?: (memberId: string, newRole: 'EDITOR' | 'VIEWER') => void;
}

export const HouseholdMemberCard = ({
  item,
  isPending,
  isExpired,
  isOwner,
  currentUser,
  isSharedHousehold,
  getRoleLabel,
  onCancelInvite,
  onRemoveMember,
  onRoleChange,
}: HouseholdMemberCardProps) => {
  const { t } = useI18n();

  return (
    <div
      className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
        isPending
          ? isExpired
            ? 'border-negative/25'
            : 'border-warning/25'
          : 'border-line-subtle hover:bg-surface-sunken'
      }`}
    >
      <div className="flex items-center space-x-3 min-w-0 flex-1">
        <div className="flex-shrink-0">
          {isPending ? (
            <Hourglass className={`h-5 w-5 ${isExpired ? 'text-negative' : 'text-warning'}`} />
          ) : (
            <Mail className="h-5 w-5 text-brand" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-light text-content truncate">
            {item.displayName || item.email}
          </p>
          <p className="text-xs font-light text-content-tertiary truncate">
            {item.displayName && item.email}
          </p>
          <div className="flex items-center space-x-2 mt-1 flex-wrap">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-light border ${
              item.role === 'OWNER' 
                ? 'border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400'
                : item.role === 'EDITOR'
                ? 'border-blue-300 dark:border-blue-700 text-info'
                : 'border-gray-300 dark:border-gray-700 text-content-secondary'
            }`}>
              {getRoleLabel(item.role)}
            </span>
            {!isPending && item.userId === currentUser?.id && 
              ((item.sharedAccountIds && item.sharedAccountIds.length > 0) || item.allowPersonalAccountAccess) && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-light border border-green-300 dark:border-green-700 text-positive">
                  <Wallet className="h-3 w-3 mr-1" />
                  {item.sharedAccountIds && item.sharedAccountIds.length > 0 
                    ? t.sharedAccountsCount.replace('{{count}}', item.sharedAccountIds.length.toString())
                    : t.allAccountsShared}
                </span>
              )
            }
            {isPending && (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-light border ${
                isExpired
                  ? 'border-negative/60 text-negative'
                  : 'border-yellow-300 dark:border-yellow-700 text-warning'
              }`}>
                {isExpired ? (
                  <>
                    <Clock className="h-3 w-3 mr-1" />
                    Expirado
                  </>
                ) : (
                  <>
                    <Hourglass className="h-3 w-3 mr-1" />
                    Pendente
                  </>
                )}
              </span>
            )}
            {isPending && !isExpired && item.expiresAt && (
              <span className="text-xs font-light text-content-tertiary">
                Expira {formatDistanceToNow(new Date(item.expiresAt), { addSuffix: true, locale: ptBR })}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-2 flex-shrink-0 ml-3">
        {/* Personal Account Access Status - Only for current user */}
        {!isPending && item.userId === currentUser?.id && (
          <div className="flex items-center space-x-2 px-2 py-1 border border-line-subtle rounded-lg">
            <Wallet className="h-4 w-4 text-content-tertiary" />
            <span className="text-xs font-light text-content-tertiary whitespace-nowrap">
              {isSharedHousehold 
                ? (item.sharedAccountIds && item.sharedAccountIds.length > 0 
                    ? t.sharedAccountsCount.replace('{{count}}', item.sharedAccountIds.length.toString())
                    : item.allowPersonalAccountAccess 
                      ? t.allAccountsShared
                      : t.noSharedAccounts)
                : t.personalAccounts}
            </span>
          </div>
        )}

        {/* Owner controls for other members */}
        {isOwner && (
          <>
            {isPending && item.inviteId ? (
              <button
                type="button"
                onClick={() => {
                  if (item.inviteId && onCancelInvite) {
                    onCancelInvite(item.inviteId, item.email);
                  }
                }}
                className="p-2 text-negative hover:opacity-70 transition-opacity"
                title="Cancelar convite"
              >
                <XCircle className="h-4 w-4" />
              </button>
            ) : !isPending && item.memberId && item.role !== 'OWNER' && item.userId !== currentUser?.id ? (
              <>
                <Select
                  size="sm"
                  aria-label={t.memberRole}
                  value={item.role}
                  onChange={(role) => {
                    if (item.memberId && onRoleChange) {
                      onRoleChange(item.memberId, role);
                    }
                  }}
                  options={[
                    { value: 'EDITOR' as const, label: t.editor },
                    { value: 'VIEWER' as const, label: t.viewer },
                  ]}
                  className="!w-auto min-w-[8.5rem]"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (item.memberId && onRemoveMember) {
                      onRemoveMember(item.memberId, item.email);
                    }
                  }}
                  className="p-2 text-negative hover:opacity-70 transition-opacity"
                  title="Remover membro"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
};
