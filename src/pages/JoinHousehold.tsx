import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Home, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { useToastContext } from '../context/ToastContext';
import { useJoinCodePreview, useRedeemJoinCode } from '../hooks/api/useHouseholds';
import { saveHouseholdToLocalStorage } from '../utils/householdStorage';
import { clearPendingJoin, formatJoinCode, normalizeJoinCode, savePendingJoin } from '../utils/pendingJoin';
import { Button, buttonClasses, Skeleton } from '../components/ui';
import RectaMark from '../components/RectaMark';

/**
 * /join/<code>: the household invite link. Signed out, it keeps the code and sends the person to
 * sign in (or up) and back here; signed in, it shows who invited them and joins in one tap.
 */
const JoinHousehold = () => {
  const { code: rawCode = '' } = useParams();
  const code = normalizeJoinCode(rawCode);
  const { currentUser } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { success, error: showError } = useToastContext();

  const preview = useJoinCodePreview(code, Boolean(currentUser) && code.length === 8);
  const redeem = useRedeemJoinCode();

  useEffect(() => {
    if (!currentUser) savePendingJoin(code);
    else clearPendingJoin();
  }, [currentUser, code]);

  const roleLabel = (role: 'EDITOR' | 'VIEWER') => (role === 'EDITOR' ? t.editor : t.viewer);
  const errorCode = (preview.error as (Error & { code?: string }) | null)?.code;
  const invalid = code.length !== 8 || (preview.isError && errorCode === 'JOIN_CODE_INVALID');

  const join = async () => {
    try {
      const joined = await redeem.mutateAsync(code);
      saveHouseholdToLocalStorage(joined.householdId, joined.householdName, joined.role);
      success(t.joinPageJoined.replace('{{name}}', joined.householdName));
      navigate('/app', { replace: true });
    } catch (err: unknown) {
      const byCode: Record<string, string> = {
        JOIN_CODE_INVALID: t.joinPageInvalid,
        HOUSEHOLD_MEMBER_EXISTS: t.joinPageAlreadyMember,
        HOUSEHOLD_FULL: t.inviteErrorHouseholdFull,
      };
      const c = (err as Error & { code?: string })?.code;
      showError((c && byCode[c]) || t.joinPageFailed);
    }
  };

  let body;
  if (!currentUser) {
    body = (
      <>
        <p className="text-[15px] text-content-secondary">{t.joinPageLoggedOut}</p>
        <div className="grid gap-3">
          <Link to="/login" className={buttonClasses({ fullWidth: true, size: 'lg' })}>{t.joinPageLogin}</Link>
          <Link to="/login?action=signup" className={buttonClasses({ variant: 'secondary', fullWidth: true, size: 'lg' })}>
            {t.joinPageSignup}
          </Link>
        </div>
      </>
    );
  } else if (invalid) {
    body = (
      <>
        <p className="text-[15px] text-content-secondary">{t.joinPageInvalid}</p>
        <Link to="/app" className={buttonClasses({ variant: 'secondary', fullWidth: true, size: 'lg' })}>{t.joinPageGoToApp}</Link>
      </>
    );
  } else if (preview.isLoading) {
    body = (
      <div className="space-y-3" aria-busy="true">
        <Skeleton className="h-6 w-2/3 mx-auto" />
        <Skeleton className="h-4 w-1/2 mx-auto" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  } else if (preview.isError || !preview.data) {
    body = (
      <>
        <p className="text-[15px] text-content-secondary">{t.joinPageFailed}</p>
        <Button variant="secondary" fullWidth size="lg" onClick={() => preview.refetch()}>{t.joinPageRetry}</Button>
      </>
    );
  } else if (preview.data.alreadyMember) {
    body = (
      <>
        <p className="font-rounded text-xl font-semibold text-content">{preview.data.householdName}</p>
        <p className="text-[15px] text-content-secondary">{t.joinPageAlreadyMember}</p>
        <Link to="/app" className={buttonClasses({ fullWidth: true, size: 'lg' })}>{t.joinPageGoToApp}</Link>
      </>
    );
  } else {
    const p = preview.data;
    body = (
      <>
        <div className="space-y-1">
          <p className="text-sm text-content-secondary">{t.joinPageInvitedBy.replace('{{name}}', p.inviterName)}</p>
          <p className="font-rounded text-2xl font-bold tracking-tight text-content">{p.householdName}</p>
          <p className="text-sm text-content-tertiary">{t.joinPageRole.replace('{{role}}', roleLabel(p.role))}</p>
        </div>
        <div className="grid gap-3">
          <Button icon={UserPlus} fullWidth size="lg" isLoading={redeem.isPending} onClick={join}>{t.joinPageAccept}</Button>
          <Link to="/app" className={buttonClasses({ variant: 'ghost', fullWidth: true })}>{t.joinPageNotNow}</Link>
        </div>
      </>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-surface py-12 px-4 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/15 blur-3xl" aria-hidden="true" />
      <main className="relative max-w-md w-full space-y-6 bg-surface-elevated p-7 sm:p-8 rounded-2xl shadow-floating ring-1 ring-line-subtle text-center">
        <div className="mark-hover mx-auto flex w-fit justify-center">
          <RectaMark className="h-9 w-auto text-content" />
        </div>
        <div className="flex items-center justify-center gap-2 text-brand">
          <Home className="h-4 w-4" aria-hidden="true" />
          <h1 className="text-sm font-semibold uppercase tracking-wide">{t.joinPageTitle}</h1>
        </div>
        {body}
        {code.length === 8 && (
          <p className="text-xs text-content-tertiary">
            {t.joinPageCodeLabel} <span className="font-mono tracking-wider">{formatJoinCode(code)}</span>
          </p>
        )}
      </main>
    </div>
  );
};

export default JoinHousehold;
