import { FormEvent, ReactNode, useEffect, useId, useRef, useState } from 'react';
import { useAppLock } from '../context/AppLockContext';
import { useCommandMenu } from '../context/CommandMenuContext';
import { useI18n } from '../context/I18nContext';
import { PIN_MAX_LENGTH, PIN_MIN_LENGTH, remainingDelayMs } from '../utils/appLock';
import RectaMark from './RectaMark';
import { Button } from './ui';

/** Keeps only digits, up to the longest PIN. */
export const sanitizePinInput = (value: string) => value.replace(/\D/g, '').slice(0, PIN_MAX_LENGTH);

export interface AppLockScreenProps {
  onUnlock: (pin: string) => Promise<{ ok: boolean; lockedUntil?: number }>;
  onForgotPin: () => void;
  /** Epoch ms until which attempts are refused (after too many wrong PINs). */
  lockedUntil: number;
}

/**
 * Full-screen PIN prompt in the brand look of the login screen. Pure UI: the gate below
 * wires it to the app lock, and the dev gallery can render it on its own.
 */
export const AppLockScreen = ({ onUnlock, onForgotPin, lockedUntil }: AppLockScreenProps) => {
  const { t } = useI18n();
  const inputId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const waitMs = remainingDelayMs({ count: 0, lockedUntil }, now);
  const waiting = waitMs > 0;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Countdown while attempts are refused; focus comes back when it ends.
  useEffect(() => {
    if (lockedUntil <= Date.now()) return;
    setNow(Date.now());
    const interval = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= lockedUntil) {
        window.clearInterval(interval);
        setError(null);
        window.setTimeout(() => inputRef.current?.focus(), 0);
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [lockedUntil]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (checking || waiting) return;
    if (pin.length < PIN_MIN_LENGTH) {
      // Same message as a wrong PIN: the screen never tells how many digits the PIN has.
      setPin('');
      setError(t.appLockWrongPin);
      inputRef.current?.focus();
      return;
    }
    setChecking(true);
    const result = await onUnlock(pin);
    setChecking(false);
    if (result.ok) return;
    setPin('');
    setError(t.appLockWrongPin);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const message = waiting
    ? t.appLockTooManyAttempts.replace('{seconds}', String(Math.ceil(waitMs / 1000)))
    : error;

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-surface py-12 px-4 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/15 blur-3xl" aria-hidden="true" />
      <div className="relative max-w-sm w-full bg-surface-elevated p-7 sm:p-8 rounded-2xl shadow-floating ring-1 ring-line-subtle">
        <div className="text-center">
          <div className="mx-auto flex w-fit justify-center">
            <RectaMark className="h-9 w-auto text-content" />
          </div>
          <h1 className="mt-5 font-rounded text-[28px] font-bold tracking-tight text-content">{t.appLockScreenTitle}</h1>
          <p className="mt-2 text-sm text-content-secondary">{t.appLockScreenSubtitle}</p>
        </div>

        <form className="mt-7 space-y-4" onSubmit={submit} noValidate>
          <div>
            <label htmlFor={inputId} className="sr-only">{t.appLockPinLabel}</label>
            <input
              ref={inputRef}
              id={inputId}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              maxLength={PIN_MAX_LENGTH}
              value={pin}
              disabled={waiting}
              onChange={(e) => {
                setPin(sanitizePinInput(e.target.value));
                if (error) setError(null);
              }}
              aria-invalid={message ? true : undefined}
              aria-describedby={errorId}
              className="field-control h-14 text-center font-rounded text-2xl tracking-[0.5em] disabled:opacity-60"
            />
            <p id={errorId} aria-live="assertive" className="mt-2 min-h-[1.25rem] text-center text-sm text-negative">
              {message}
            </p>
          </div>
          <Button type="submit" size="lg" fullWidth isLoading={checking} disabled={waiting || pin.length === 0}>
            {t.appLockUnlock}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={onForgotPin}
            className="text-sm font-semibold text-brand hover:opacity-75 rounded"
            aria-describedby={`${inputId}-forgot`}
          >
            {t.appLockForgotPin}
          </button>
          <p id={`${inputId}-forgot`} className="mt-1 text-xs text-content-tertiary">{t.appLockForgotPinHint}</p>
        </div>
      </div>
    </main>
  );
};

/**
 * Wraps the logged-in area. While locked, the children are not mounted at all (no data in
 * the DOM, no queries running) and only the PIN screen renders.
 */
export const AppLockGate = ({ children }: { children: ReactNode }) => {
  const { locked, unlock, forgotPin, failures } = useAppLock();
  const { setDisabled } = useCommandMenu();

  // The command menu lives above the routes; keep it closed while locked. When the app
  // mounts again, Layout sets it back from its own state.
  useEffect(() => {
    if (locked) setDisabled(true);
  }, [locked, setDisabled]);

  if (!locked) return <>{children}</>;
  return (
    <AppLockScreen
      lockedUntil={failures.lockedUntil}
      onUnlock={async (pin) => {
        const result = await unlock(pin);
        return result.ok ? { ok: true } : { ok: false, lockedUntil: result.failures.lockedUntil };
      }}
      onForgotPin={() => { void forgotPin(); }}
    />
  );
};
