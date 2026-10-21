import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import {
  AppLockConfig,
  clearAppLock,
  FailureState,
  hashPin,
  isIdleTooLong,
  isUnlockedInSession,
  LockTimeout,
  NO_FAILURES,
  readConfig,
  readFailures,
  readLastActivity,
  registerFailure,
  remainingDelayMs,
  setUnlockedInSession,
  shouldLockOnLoad,
  verifyPin,
  writeConfig,
  writeFailures,
  writeLastActivity,
} from '../utils/appLock';

/**
 * App lock (fdbk #110): optional PIN that hides the logged-in area in this browser.
 * Local to this browser and user; never synced to the backend. See utils/appLock.ts.
 */

export type PinCheck = { ok: true } | { ok: false; failures: FailureState };

interface AppLockContextValue {
  enabled: boolean;
  timeoutMinutes: LockTimeout;
  locked: boolean;
  /** Wrong PINs in a row and the time until the next attempt is allowed. */
  failures: FailureState;
  enable: (pin: string, timeoutMinutes: LockTimeout) => Promise<void>;
  disable: (currentPin: string) => Promise<PinCheck>;
  changePin: (currentPin: string, newPin: string) => Promise<PinCheck>;
  setTimeoutMinutes: (timeoutMinutes: LockTimeout) => void;
  unlock: (pin: string) => Promise<PinCheck>;
  lockNow: () => void;
  /** Clears the PIN of this user in this browser and signs out. */
  forgotPin: () => Promise<void>;
}

const AppLockContext = createContext<AppLockContextValue | undefined>(undefined);

const local = (): Storage | undefined => {
  try { return window.localStorage; } catch { return undefined; }
};
const session = (): Storage | undefined => {
  try { return window.sessionStorage; } catch { return undefined; }
};

const lockedOnLoad = (uid: string, config: AppLockConfig | null): boolean =>
  config !== null &&
  shouldLockOnLoad({
    unlockedInSession: isUnlockedInSession(session(), uid),
    lastActivityAt: readLastActivity(session(), uid),
    now: Date.now(),
    timeoutMinutes: config.timeoutMinutes,
  });

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;
/** Activity is persisted to sessionStorage at most this often. */
const ACTIVITY_WRITE_MS = 5_000;
const IDLE_CHECK_MS = 10_000;

export const AppLockProvider = ({ children }: { children: ReactNode }) => {
  const { currentUser, logout } = useAuth();
  const uid = currentUser?.uid ?? null;

  // AuthProvider only renders children once the auth state is known, so on mount `uid` is
  // the restored session (or null) and the initial lock state is computed before the first paint.
  const [trackedUid, setTrackedUid] = useState<string | null>(uid);
  const [config, setConfig] = useState<AppLockConfig | null>(() => (uid ? readConfig(local(), uid) : null));
  const [locked, setLocked] = useState<boolean>(() => (uid ? lockedOnLoad(uid, config) : false));
  const [failures, setFailures] = useState<FailureState>(() => (uid ? readFailures(local(), uid) : NO_FAILURES));

  if (trackedUid !== uid) {
    // User changed while mounted. A sign-in in this tab just proved the account password,
    // so it starts unlocked; any other change re-reads the stored state.
    const nextConfig = uid ? readConfig(local(), uid) : null;
    setTrackedUid(uid);
    setConfig(nextConfig);
    setLocked(uid && trackedUid !== null ? lockedOnLoad(uid, nextConfig) : false);
    setFailures(uid ? readFailures(local(), uid) : NO_FAILURES);
  }

  const lastActivityRef = useRef<number>(Date.now());
  const lastWriteRef = useRef<number>(0);

  const lockedRef = useRef(locked);
  lockedRef.current = locked;

  // Keep "unlocked in this tab" in sessionStorage in step with the state.
  useEffect(() => {
    if (uid) setUnlockedInSession(session(), uid, !locked);
  }, [uid, locked]);

  // Inactivity: record activity while unlocked and lock once the timeout passes.
  const timeoutMinutes = config?.timeoutMinutes ?? 0;
  useEffect(() => {
    if (!uid || !config || locked) return;

    // Unlocking, turning the lock on or changing it are all activity.
    const start = Date.now();
    lastActivityRef.current = start;
    lastWriteRef.current = start;
    writeLastActivity(session(), uid, start);

    const lockIfIdle = () => {
      if (isIdleTooLong(lastActivityRef.current, Date.now(), timeoutMinutes)) {
        setLocked(true);
        return true;
      }
      return false;
    };
    const onActivity = () => {
      // Coming back after the timeout: the first move or key must not count as activity.
      if (lockIfIdle()) return;
      const now = Date.now();
      lastActivityRef.current = now;
      if (now - lastWriteRef.current >= ACTIVITY_WRITE_MS) {
        lastWriteRef.current = now;
        writeLastActivity(session(), uid, now);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') lockIfIdle();
    };

    ACTIVITY_EVENTS.forEach((type) => window.addEventListener(type, onActivity, { capture: true, passive: true }));
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onVisibility);
    window.addEventListener('pageshow', onVisibility);
    const interval = window.setInterval(lockIfIdle, IDLE_CHECK_MS);
    return () => {
      ACTIVITY_EVENTS.forEach((type) => window.removeEventListener(type, onActivity, { capture: true }));
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onVisibility);
      window.removeEventListener('pageshow', onVisibility);
      window.clearInterval(interval);
    };
  }, [uid, config, locked, timeoutMinutes]);

  // Another tab changed the PIN or the timeout. A removal never unlocks this tab: it may be
  // a sign-out elsewhere, which reaches this tab through Firebase a moment later.
  useEffect(() => {
    if (!uid) return;
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== window.localStorage) return;
      const next = readConfig(local(), uid);
      if (next) setConfig(next);
      else if (!lockedRef.current) setConfig(null);
      setFailures(readFailures(local(), uid));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [uid]);

  /** Verifies a PIN against the stored hash, applying the retry delay to wrong attempts. */
  const checkPin = useCallback(async (pin: string): Promise<PinCheck> => {
    if (!uid || !config) return { ok: false, failures: NO_FAILURES };
    const current = readFailures(local(), uid);
    if (remainingDelayMs(current, Date.now()) > 0) {
      setFailures(current);
      return { ok: false, failures: current };
    }
    if (await verifyPin(pin, config)) {
      writeFailures(local(), uid, NO_FAILURES);
      setFailures(NO_FAILURES);
      return { ok: true };
    }
    const next = registerFailure(current, Date.now());
    writeFailures(local(), uid, next);
    setFailures(next);
    return { ok: false, failures: next };
  }, [uid, config]);

  const enable = useCallback(async (pin: string, timeout: LockTimeout) => {
    if (!uid) return;
    const next: AppLockConfig = { v: 1, ...(await hashPin(pin)), timeoutMinutes: timeout };
    writeConfig(local(), uid, next);
    writeFailures(local(), uid, NO_FAILURES);
    setFailures(NO_FAILURES);
    setConfig(next);
    setUnlockedInSession(session(), uid, true);
  }, [uid]);

  const disable = useCallback(async (currentPin: string) => {
    const result = await checkPin(currentPin);
    if (result.ok && uid) {
      clearAppLock(local(), undefined, uid);
      setConfig(null);
    }
    return result;
  }, [checkPin, uid]);

  const changePin = useCallback(async (currentPin: string, newPin: string) => {
    const result = await checkPin(currentPin);
    if (result.ok && uid && config) {
      const next: AppLockConfig = { ...config, ...(await hashPin(newPin)) };
      writeConfig(local(), uid, next);
      setConfig(next);
    }
    return result;
  }, [checkPin, uid, config]);

  const setTimeoutMinutes = useCallback((timeout: LockTimeout) => {
    if (!uid || !config) return;
    const next: AppLockConfig = { ...config, timeoutMinutes: timeout };
    writeConfig(local(), uid, next);
    setConfig(next);
  }, [uid, config]);

  const unlock = useCallback(async (pin: string) => {
    const result = await checkPin(pin);
    if (result.ok) setLocked(false);
    return result;
  }, [checkPin]);

  const lockNow = useCallback(() => {
    if (config) setLocked(true);
  }, [config]);

  const forgotPin = useCallback(async () => {
    // The lock state stays as is: the screen keeps covering the app until sign-out lands.
    if (uid) clearAppLock(local(), session(), uid);
    await logout();
  }, [uid, logout]);

  const value = useMemo<AppLockContextValue>(() => ({
    enabled: config !== null,
    timeoutMinutes: config?.timeoutMinutes ?? 5,
    locked: config !== null && locked,
    failures,
    enable,
    disable,
    changePin,
    setTimeoutMinutes,
    unlock,
    lockNow,
    forgotPin,
  }), [config, locked, failures, enable, disable, changePin, setTimeoutMinutes, unlock, lockNow, forgotPin]);

  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>;
};

export const useAppLock = (): AppLockContextValue => {
  const context = useContext(AppLockContext);
  if (!context) throw new Error('useAppLock must be used within AppLockProvider');
  return context;
};
