import { apiBaseUrl } from '../config/authMode';
import { clearLocalToken, getLocalToken, setLocalToken } from './localToken';

export const LOCAL_USER_KEY = 'recta_user';

export interface LocalSessionUser {
  id: string;
  email: string;
}

/** Why a local sign-in or sign-up failed, in terms the login page can translate. */
export type LocalAuthErrorCode = 'invalid-credentials' | 'email-taken' | 'invalid-input' | 'rate-limited' | 'registration-closed' | 'unknown';

export class LocalAuthError extends Error {
  constructor(public readonly code: LocalAuthErrorCode, message: string) {
    super(message);
    this.name = 'LocalAuthError';
  }
}

function errorCodeFor(status: number): LocalAuthErrorCode {
  if (status === 401) return 'invalid-credentials';
  if (status === 429) return 'rate-limited';
  if (status === 403) return 'registration-closed';
  if (status === 409) return 'email-taken';
  if (status === 400) return 'invalid-input';
  return 'unknown';
}

async function postCredentials<T>(path: '/auth/login' | '/auth/register', email: string, password: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new LocalAuthError('unknown', 'Could not reach the server');
  }

  if (!res.ok) {
    throw new LocalAuthError(errorCodeFor(res.status), `${path} -> HTTP ${res.status}`);
  }
  return ((await res.json()) as { data: T }).data;
}

/** Sign in against the backend and keep the JWT and the user for the next page load. */
export async function localLogin(email: string, password: string): Promise<LocalSessionUser> {
  const { token, id, email: userEmail } = await postCredentials<{ token: string; id: string; email: string }>(
    '/auth/login',
    email,
    password
  );
  setLocalToken(token);
  try {
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify({ id, email: userEmail }));
  } catch {
    // Storage unavailable: the session lasts until the page is closed.
  }
  return { id, email: userEmail };
}

/** Register, then sign in: the register route does not return a token. */
export async function localRegister(email: string, password: string): Promise<LocalSessionUser> {
  await postCredentials('/auth/register', email, password);
  return localLogin(email, password);
}

/** The user kept by the last local sign-in, if the token is still stored. */
export function readLocalSessionUser(): LocalSessionUser | null {
  if (!getLocalToken()) return null;
  try {
    const stored = localStorage.getItem(LOCAL_USER_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<LocalSessionUser>;
    return parsed?.id && parsed?.email ? { id: parsed.id, email: parsed.email } : null;
  } catch {
    return null;
  }
}

export function clearLocalSessionUser(): void {
  try {
    localStorage.removeItem(LOCAL_USER_KEY);
  } catch {
    // Storage unavailable: nothing was kept.
  }
}

/**
 * The backend rejected the stored JWT (expired, or the user is gone): forget the session and go to the login page.
 * Nothing refreshes a local token, so signing in again is the only way forward.
 */
export function endExpiredLocalSession(): void {
  clearLocalToken();
  clearLocalSessionUser();
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
}
