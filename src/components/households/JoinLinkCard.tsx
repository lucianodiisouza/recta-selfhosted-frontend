import { useState } from 'react';
import { Copy, Link2, Share2, XCircle } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { useToastContext } from '../../context/ToastContext';
import { useActiveJoinCode, useCreateJoinCode, useRevokeJoinCode } from '../../hooks/api/useHouseholds';
import { formatJoinCode } from '../../utils/pendingJoin';
import { Button, SegmentedControl, Skeleton } from '../ui';

type Role = 'EDITOR' | 'VIEWER';

interface JoinLinkCardProps {
  householdId: string;
}

/**
 * Owner's invite link: a single-use code (48h) that whoever opens joins at once with the chosen
 * role. Works for anyone, whatever email they sign in with.
 */
export const JoinLinkCard = ({ householdId }: JoinLinkCardProps) => {
  const { t, locale } = useI18n();
  const { success, error: showError } = useToastContext();
  const [role, setRole] = useState<Role>('EDITOR');
  const active = useActiveJoinCode(householdId);
  const create = useCreateJoinCode();
  const revoke = useRevokeJoinCode();

  const joinCode = active.data;
  const link = joinCode ? `${window.location.origin}/join/${joinCode.code}` : '';
  const expires = joinCode
    ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(joinCode.expiresAt))
    : '';
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const generate = async () => {
    try {
      await create.mutateAsync({ householdId, role });
    } catch (err: unknown) {
      const c = (err as Error & { code?: string })?.code;
      showError(c === 'HOUSEHOLD_FULL' ? t.inviteErrorHouseholdFull : t.joinLinkFailed);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      success(t.joinLinkCopied);
    } catch {
      showError(t.joinLinkFailed);
    }
  };

  const share = async () => {
    if (!joinCode) return;
    try {
      await navigator.share({ title: 'Recta', text: t.joinLinkShareText.replace('{{code}}', formatJoinCode(joinCode.code)), url: link });
    } catch {
      // Dismissing the share sheet rejects too: nothing to report
    }
  };

  const doRevoke = async () => {
    if (!joinCode) return;
    try {
      await revoke.mutateAsync({ householdId, joinCodeId: joinCode.id });
      success(t.joinLinkRevoked);
    } catch {
      showError(t.joinLinkFailed);
    }
  };

  return (
    <section className="mb-6 rounded-2xl bg-surface-sunken p-4 sm:p-5" aria-labelledby="join-link-title">
      <h4 id="join-link-title" className="flex items-center text-sm font-semibold text-content">
        <Link2 className="h-4 w-4 mr-2 text-brand" aria-hidden="true" />
        {t.joinLinkTitle}
      </h4>
      <p className="mt-1 text-xs text-content-tertiary">{t.joinLinkHint}</p>

      {active.isLoading ? (
        <Skeleton className="mt-4 h-24 w-full" />
      ) : joinCode ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl bg-surface-elevated px-4 py-3 text-center ring-1 ring-line-subtle">
            <p className="font-mono text-2xl font-semibold tracking-[0.18em] text-content select-all">{formatJoinCode(joinCode.code)}</p>
            <p className="mt-1 truncate text-xs text-content-secondary select-all">{link}</p>
            <p className="mt-1 text-xs text-content-tertiary">
              {t.joinLinkExpires.replace('{{date}}', expires)} · {joinCode.role === 'EDITOR' ? t.editor : t.viewer}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {canShare ? (
              <Button icon={Share2} onClick={share}>{t.joinLinkShare}</Button>
            ) : (
              <Button icon={Copy} onClick={copy}>{t.joinLinkCopy}</Button>
            )}
            {canShare ? (
              <Button variant="secondary" icon={Copy} onClick={copy}>{t.joinLinkCopy}</Button>
            ) : (
              <Button variant="secondary" icon={XCircle} isLoading={revoke.isPending} onClick={doRevoke}>{t.joinLinkRevoke}</Button>
            )}
          </div>
          {canShare && (
            <Button variant="ghost" size="sm" fullWidth icon={XCircle} isLoading={revoke.isPending} onClick={doRevoke}>{t.joinLinkRevoke}</Button>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <SegmentedControl<Role>
            label={t.joinLinkRoleLabel}
            fullWidth
            value={role}
            onChange={setRole}
            options={[
              { value: 'EDITOR', label: t.editor },
              { value: 'VIEWER', label: t.viewer },
            ]}
          />
          <Button icon={Link2} fullWidth isLoading={create.isPending} onClick={generate}>{t.joinLinkCreate}</Button>
        </div>
      )}
    </section>
  );
};
