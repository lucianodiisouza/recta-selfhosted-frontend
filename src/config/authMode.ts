export type AuthMode = 'local' | 'firebase';

interface AuthConfigResponse {
  success: boolean;
  data: {
    authMode: AuthMode;
    firebaseWebApiKey: string | null;
    /** Absent on backends that predate the setting: sign-up is open there. */
    registrationEnabled?: boolean;
  };
}

export interface AuthConfig {
  authMode: AuthMode;
  /** Whether the backend accepts new local sign-ups (AUTH_ALLOW_REGISTRATION). Always true in Firebase mode. */
  registrationEnabled: boolean;
}

const STORAGE_KEY = 'recta_auth_mode';

let cachedConfig: AuthConfig | null = null;

function isAuthMode(value: unknown): value is AuthMode {
  return value === 'local' || value === 'firebase';
}

function readStoredMode(): AuthMode | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isAuthMode(raw) ? raw : null;
  } catch {
    return null;
  }
}

function readEnvMode(): AuthMode | null {
  const raw = import.meta.env.VITE_AUTH_MODE;
  return isAuthMode(raw) ? raw : null;
}

export function apiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  return raw.replace(/\/$/, '');
}

/**
 * Ask the backend which sign-in mode it runs (public GET /auth/config).
 * Plain fetch on purpose: utils/api.ts imports the token helpers, so importing it here would be a cycle.
 * When the backend cannot be reached or does not know the route (an older backend), fall back to the build-time
 * VITE_AUTH_MODE, then to the last mode seen, then to Firebase, which is what the app did before local mode existed.
 */
export async function fetchAuthConfig(): Promise<AuthConfig> {
  if (cachedConfig) return cachedConfig;

  try {
    const res = await fetch(`${apiBaseUrl()}/auth/config`);
    if (!res.ok) throw new Error(`GET /auth/config -> HTTP ${res.status}`);
    const body = (await res.json()) as AuthConfigResponse;
    const mode = body?.data?.authMode;
    if (!isAuthMode(mode)) {
      throw new Error(`GET /auth/config -> invalid authMode: ${String(mode)}`);
    }
    cachedConfig = { authMode: mode, registrationEnabled: body.data.registrationEnabled !== false };
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Storage unavailable (private mode): the in-memory cache is enough for this session.
    }
    return cachedConfig;
  } catch {
    return { authMode: readEnvMode() ?? readStoredMode() ?? 'firebase', registrationEnabled: true };
  }
}

/** The mode known without a request: this session's answer, the last one seen, or the build-time setting. */
export function getCachedAuthMode(): AuthMode | null {
  return cachedConfig?.authMode ?? readStoredMode() ?? readEnvMode();
}

export function clearAuthModeCache(): void {
  cachedConfig = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing stored, or storage unavailable: either way the key is gone.
  }
}
