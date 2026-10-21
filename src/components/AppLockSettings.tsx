import { FormEvent, forwardRef, InputHTMLAttributes, useState } from 'react';
import { KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { useAppLock, PinCheck } from '../context/AppLockContext';
import { useI18n } from '../context/I18nContext';
import { useToastContext } from '../context/ToastContext';
import { DEFAULT_LOCK_TIMEOUT, isValidPin, LockTimeout, PIN_MAX_LENGTH, remainingDelayMs } from '../utils/appLock';
import { sanitizePinInput } from './AppLockScreen';
import { Button, Field, Input, Modal, SegmentedControl, Switch } from './ui';

type Dialog = 'enable' | 'disable' | 'change' | null;

const PinInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  value: string;
  onValueChange: (value: string) => void;
}>(({ value, onValueChange, ...rest }, ref) => (
  <Input
    ref={ref}
    type="password"
    inputMode="numeric"
    pattern="[0-9]*"
    autoComplete="off"
    maxLength={PIN_MAX_LENGTH}
    value={value}
    onChange={(e) => onValueChange(sanitizePinInput(e.target.value))}
    className="font-rounded text-lg tracking-[0.3em]"
    {...rest}
  />
));
PinInput.displayName = 'PinInput';

/** Settings card for the PIN lock of this browser (fdbk #110). Local only, never synced. */
const AppLockSettings = () => {
  const { t } = useI18n();
  const { success } = useToastContext();
  const lock = useAppLock();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [timeout, setTimeoutChoice] = useState<LockTimeout>(DEFAULT_LOCK_TIMEOUT);
  const [error, setError] = useState<{ field: 'current' | 'new' | 'confirm'; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const timeoutOptions: { value: `${LockTimeout}`; label: string }[] = [
    { value: '0', label: t.appLockTimeoutOnOpen },
    { value: '1', label: t.appLockTimeout1 },
    { value: '5', label: t.appLockTimeout5 },
    { value: '15', label: t.appLockTimeout15 },
  ];

  const open = (next: Dialog) => {
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setError(null);
    setTimeoutChoice(lock.enabled ? lock.timeoutMinutes : DEFAULT_LOCK_TIMEOUT);
    setDialog(next);
  };
  const close = () => {
    if (!busy) setDialog(null);
  };

  const wrongPinMessage = (result: PinCheck) => {
    if (result.ok) return '';
    const wait = remainingDelayMs(result.failures, Date.now());
    return wait > 0 ? t.appLockTooManyAttempts.replace('{seconds}', String(Math.ceil(wait / 1000))) : t.appLockWrongPin;
  };

  /** Validates the new PIN pair; returns false and sets the error when invalid. */
  const checkNewPin = () => {
    if (!isValidPin(newPin)) {
      setError({ field: 'new', message: t.appLockPinFormatError });
      return false;
    }
    if (newPin !== confirmPin) {
      setError({ field: 'confirm', message: t.appLockPinMismatch });
      return false;
    }
    return true;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (dialog !== 'disable' && !checkNewPin()) return;
    setBusy(true);
    try {
      if (dialog === 'enable') {
        await lock.enable(newPin, timeout);
        success(t.appLockEnabledToast);
      } else if (dialog === 'disable') {
        const result = await lock.disable(currentPin);
        if (!result.ok) {
          setCurrentPin('');
          setError({ field: 'current', message: wrongPinMessage(result) });
          return;
        }
        success(t.appLockDisabledToast);
      } else if (dialog === 'change') {
        const result = await lock.changePin(currentPin, newPin);
        if (!result.ok) {
          setCurrentPin('');
          setError({ field: 'current', message: wrongPinMessage(result) });
          return;
        }
        success(t.appLockPinChangedToast);
      }
      setDialog(null);
    } finally {
      setBusy(false);
    }
  };

  const errorFor = (field: 'current' | 'new' | 'confirm') => (error?.field === field ? error.message : undefined);
  const needsCurrent = dialog === 'disable' || dialog === 'change';
  const needsNew = dialog === 'enable' || dialog === 'change';

  return (
    <div className="surface-card p-4 sm:p-6 mb-4 sm:mb-6">
      <h2 className="card-title mb-4 flex items-center">
        <ShieldCheck className="h-5 w-5 mr-2" aria-hidden="true" />
        {t.appLockTitle}
      </h2>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-content">{t.appLockToggleLabel}</p>
          <p className="mt-1 text-sm font-light text-content-tertiary">{t.appLockDescription}</p>
        </div>
        <Switch
          checked={lock.enabled}
          onChange={(checked) => open(checked ? 'enable' : 'disable')}
          label={t.appLockToggleLabel}
        />
      </div>
      <p className="mt-3 text-xs font-light text-content-tertiary">{t.appLockLocalOnly}</p>

      {lock.enabled && (
        <div className="mt-4 pt-4 border-t border-line-subtle space-y-4">
          <div>
            <p className="text-sm font-medium text-content-secondary mb-2">{t.appLockTimeoutLabel}</p>
            <SegmentedControl
              label={t.appLockTimeoutLabel}
              options={timeoutOptions}
              value={String(lock.timeoutMinutes)}
              onChange={(value) => lock.setTimeoutMinutes(Number(value) as LockTimeout)}
              size="sm"
              className="max-w-full overflow-x-auto"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="tertiary" size="sm" icon={KeyRound} onClick={() => open('change')}>
              {t.appLockChangePin}
            </Button>
            <Button variant="secondary" size="sm" icon={Lock} onClick={lock.lockNow}>
              {t.appLockLockNow}
            </Button>
          </div>
        </div>
      )}

      <Modal
        isOpen={dialog !== null}
        onClose={close}
        dismissible={!busy}
        icon={dialog === 'disable' ? Lock : KeyRound}
        title={dialog === 'enable' ? t.appLockCreateTitle : dialog === 'disable' ? t.appLockDisableTitle : t.appLockChangePin}
        description={
          dialog === 'enable' ? t.appLockCreateDescription : dialog === 'disable' ? t.appLockDisableDescription : t.appLockChangeDescription
        }
        size="sm"
        footer={
          <>
            <Button variant="tertiary" onClick={close} disabled={busy}>{t.cancel}</Button>
            <Button
              type="submit"
              form="app-lock-form"
              variant={dialog === 'disable' ? 'destructive' : 'primary'}
              isLoading={busy}
            >
              {dialog === 'enable' ? t.appLockTurnOn : dialog === 'disable' ? t.appLockTurnOff : t.save}
            </Button>
          </>
        }
      >
        <form id="app-lock-form" className="space-y-4" onSubmit={submit} noValidate>
          {needsCurrent && (
            <Field label={t.appLockCurrentPin} error={errorFor('current')}>
              <PinInput value={currentPin} onValueChange={setCurrentPin} />
            </Field>
          )}
          {needsNew && (
            <>
              <Field label={t.appLockNewPin} error={errorFor('new')} hint={errorFor('new') ? undefined : t.appLockPinFormatError}>
                <PinInput value={newPin} onValueChange={setNewPin} />
              </Field>
              <Field label={t.appLockConfirmPin} error={errorFor('confirm')}>
                <PinInput value={confirmPin} onValueChange={setConfirmPin} />
              </Field>
            </>
          )}
          {dialog === 'enable' && (
            <div>
              <p className="text-sm font-medium text-content-secondary mb-1.5">{t.appLockTimeoutLabel}</p>
              <SegmentedControl
                label={t.appLockTimeoutLabel}
                options={timeoutOptions}
                value={String(timeout)}
                onChange={(value) => setTimeoutChoice(Number(value) as LockTimeout)}
                size="sm"
                fullWidth
                className="overflow-x-auto"
              />
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
};

export default AppLockSettings;
