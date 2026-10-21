/**
 * App lock for the web app (fdbk #110): an optional PIN that hides the logged-in area of
 * this browser. Same idea as the iOS/Android App Lock: local to this device, nothing goes
 * to the backend.
 *
 * Only a salted PBKDF2-SHA-256 hash of the PIN is stored, in localStorage, keyed by the
 * Firebase uid. "Unlocked in this tab" and the last activity live in sessionStorage, so a
 * new browser session or a new tab starts locked.
 *
 * This file holds the pure rules (hashing, inactivity, retry delay) and thin storage
 * helpers that take the Storage as a parameter, so it runs in Node for tests.
 */

/** Minutes of inactivity before locking. 0 = lock only when the site is opened. */
export type LockTimeout = 0 | 1 | 5 | 15;
export const LOCK_TIMEOUTS: LockTimeout[] = [0, 1, 5, 15];
export const DEFAULT_LOCK_TIMEOUT: LockTimeout = 5;

export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 6;
export const PBKDF2_ITERATIONS = 310_000;
const SALT_BYTES = 16;

/** Wrong PINs in a row allowed before the retry delay starts. */
export const FREE_ATTEMPTS = 5;
const BASE_DELAY_MS = 30_000;
const MAX_DELAY_MS = 15 * 60_000;

/**
 * With "only when opened", a page load this long after the last activity counts as a new
 * opening. Browsers that restore the previous session also restore sessionStorage, so the
 * "unlocked" flag alone would survive closing and reopening the browser.
 */
export const REOPEN_GAP_MS = 30 * 60_000;

export interface PinHash {
  salt: string;
  hash: string;
  iterations: number;
}

export interface AppLockConfig extends PinHash {
  v: 1;
  timeoutMinutes: LockTimeout;
}

export interface FailureState {
  count: number;
  /** Epoch ms until which new attempts are refused. 0 = none. */
  lockedUntil: number;
}

// ---------------------------------------------------------------------------------------
// PIN hashing
// ---------------------------------------------------------------------------------------

export const isValidPin = (pin: string): boolean =>
  new RegExp(`^\\d{${PIN_MIN_LENGTH},${PIN_MAX_LENGTH}}$`).test(pin);

const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
};

const fromBase64 = (value: string): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const derive = async (pin: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> => {
  const subtle = globalThis.crypto.subtle;
  const key = await subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256);
  return new Uint8Array(bits);
};

/** Hashes a PIN with a fresh random salt. */
export const hashPin = async (pin: string, iterations: number = PBKDF2_ITERATIONS): Promise<PinHash> => {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(pin, salt, iterations);
  return { salt: toBase64(salt), hash: toBase64(hash), iterations };
};

/** Constant-time comparison of two byte arrays of the same length. */
const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
};

export const verifyPin = async (pin: string, stored: PinHash): Promise<boolean> => {
  if (!isValidPin(pin)) return false;
  try {
    const hash = await derive(pin, fromBase64(stored.salt), stored.iterations);
    return sameBytes(hash, fromBase64(stored.hash));
  } catch {
    return false;
  }
};

// ---------------------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------------------

/** True when the inactivity timeout has passed. Timeout 0 never locks while open. */
export const isIdleTooLong = (lastActivityAt: number, now: number, timeoutMinutes: LockTimeout): boolean =>
  timeoutMinutes > 0 && now - lastActivityAt >= timeoutMinutes * 60_000;

/** Whether a freshly loaded page (reload, new tab, restored session) must start locked. */
export const shouldLockOnLoad = (args: {
  unlockedInSession: boolean;
  lastActivityAt: number | null;
  now: number;
  timeoutMinutes: LockTimeout;
}): boolean => {
  const { unlockedInSession, lastActivityAt, now, timeoutMinutes } = args;
  if (!unlockedInSession || lastActivityAt === null) return true;
  if (timeoutMinutes === 0) return now - lastActivityAt >= REOPEN_GAP_MS;
  return isIdleTooLong(lastActivityAt, now, timeoutMinutes);
};

/** Delay imposed after `count` wrong PINs in a row: none for the first 5, then 30 s doubling, capped at 15 min. */
export const retryDelayMs = (count: number): number => {
  if (count < FREE_ATTEMPTS) return 0;
  return Math.min(BASE_DELAY_MS * 2 ** (count - FREE_ATTEMPTS), MAX_DELAY_MS);
};

export const registerFailure = (state: FailureState, now: number): FailureState => {
  const count = state.count + 1;
  const delay = retryDelayMs(count);
  return { count, lockedUntil: delay > 0 ? now + delay : 0 };
};

/** Ms left before another attempt is allowed. */
export const remainingDelayMs = (state: FailureState, now: number): number => Math.max(0, state.lockedUntil - now);

export const NO_FAILURES: FailureState = { count: 0, lockedUntil: 0 };

// ---------------------------------------------------------------------------------------
// Storage (localStorage for the config, sessionStorage for this tab's state)
// ---------------------------------------------------------------------------------------

type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const configKey = (uid: string) => `recta:appLock:${uid}`;
const failuresKey = (uid: string) => `recta:appLock:${uid}:failures`;
const unlockedKey = (uid: string) => `recta:appLock:${uid}:unlocked`;
const activityKey = (uid: string) => `recta:appLock:${uid}:activity`;

const safeGet = (store: KV | undefined, key: string): string | null => {
  try { return store?.getItem(key) ?? null; } catch { return null; }
};
const safeSet = (store: KV | undefined, key: string, value: string) => {
  try { store?.setItem(key, value); } catch { /* storage blocked or full */ }
};
const safeRemove = (store: KV | undefined, key: string) => {
  try { store?.removeItem(key); } catch { /* storage blocked */ }
};

const isTimeout = (value: unknown): value is LockTimeout => LOCK_TIMEOUTS.includes(value as LockTimeout);

export const readConfig = (local: KV | undefined, uid: string): AppLockConfig | null => {
  const raw = safeGet(local, configKey(uid));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AppLockConfig>;
    if (parsed.v !== 1 || typeof parsed.salt !== 'string' || typeof parsed.hash !== 'string' || typeof parsed.iterations !== 'number') {
      return null;
    }
    return {
      v: 1,
      salt: parsed.salt,
      hash: parsed.hash,
      iterations: parsed.iterations,
      timeoutMinutes: isTimeout(parsed.timeoutMinutes) ? parsed.timeoutMinutes : DEFAULT_LOCK_TIMEOUT,
    };
  } catch {
    return null;
  }
};

export const writeConfig = (local: KV | undefined, uid: string, config: AppLockConfig) =>
  safeSet(local, configKey(uid), JSON.stringify(config));

/** Removes everything the lock stored for this user in this browser. */
export const clearAppLock = (local: KV | undefined, session: KV | undefined, uid: string) => {
  safeRemove(local, configKey(uid));
  safeRemove(local, failuresKey(uid));
  safeRemove(session, unlockedKey(uid));
  safeRemove(session, activityKey(uid));
};

export const readFailures = (local: KV | undefined, uid: string): FailureState => {
  const raw = safeGet(local, failuresKey(uid));
  if (!raw) return NO_FAILURES;
  try {
    const parsed = JSON.parse(raw) as Partial<FailureState>;
    return {
      count: Number.isFinite(parsed.count) ? Number(parsed.count) : 0,
      lockedUntil: Number.isFinite(parsed.lockedUntil) ? Number(parsed.lockedUntil) : 0,
    };
  } catch {
    return NO_FAILURES;
  }
};

export const writeFailures = (local: KV | undefined, uid: string, state: FailureState) => {
  if (state.count === 0) safeRemove(local, failuresKey(uid));
  else safeSet(local, failuresKey(uid), JSON.stringify(state));
};

export const isUnlockedInSession = (session: KV | undefined, uid: string) => safeGet(session, unlockedKey(uid)) === '1';

export const setUnlockedInSession = (session: KV | undefined, uid: string, unlocked: boolean) => {
  if (unlocked) safeSet(session, unlockedKey(uid), '1');
  else safeRemove(session, unlockedKey(uid));
};

export const readLastActivity = (session: KV | undefined, uid: string): number | null => {
  const raw = safeGet(session, activityKey(uid));
  const value = raw === null ? NaN : Number(raw);
  return Number.isFinite(value) ? value : null;
};

export const writeLastActivity = (session: KV | undefined, uid: string, at: number) =>
  safeSet(session, activityKey(uid), String(at));
