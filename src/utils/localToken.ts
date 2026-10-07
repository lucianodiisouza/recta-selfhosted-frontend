/**
 * Storage of the JWT issued by POST /auth/login when the backend runs AUTH_MODE=local.
 * utils/api.ts sends it as `Authorization: Bearer <token>`.
 */

export const TOKEN_KEY = 'recta_token';

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

/** The stored JWT, or null when absent or storage is unreadable. Expiry is not checked: the backend answers 401. */
export function getLocalToken(): string | null {
  try {
    return storage()?.getItem(TOKEN_KEY) ?? null;
  } catch {
    return null;
  }
}

export function setLocalToken(token: string): void {
  try {
    storage()?.setItem(TOKEN_KEY, token);
  } catch {
    // Quota exceeded or private mode: the caller keeps the session in memory only.
  }
}

export function clearLocalToken(): void {
  try {
    storage()?.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable: no token can be read back either.
  }
}
