/**
 * A join link opened while signed out: the code waits here (this tab only) until login, then the
 * app goes back to /join/<code> instead of the dashboard.
 */
const KEY = 'recta_pending_join_code';

export function savePendingJoin(code: string): void {
  try {
    sessionStorage.setItem(KEY, code);
  } catch {
    // Storage blocked: the user just lands on the dashboard after login
  }
}

export function clearPendingJoin(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Where to go after login: the pending join link, or the app. */
export function postLoginPath(): string {
  try {
    const code = sessionStorage.getItem(KEY);
    if (code) return `/join/${encodeURIComponent(code)}`;
  } catch {
    // ignore
  }
  return '/app';
}

/** "abcd-2345", " ABCD 2345 " or a pasted link, as the 8-char code. */
export function normalizeJoinCode(raw: string): string {
  const tail = raw.trim().split('/').pop() ?? '';
  return tail.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** ABCD2345 -> ABCD-2345 */
export function formatJoinCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}
