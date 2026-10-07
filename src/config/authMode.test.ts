import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blockedStorage, memoryStorage } from '../test/memoryStorage';
import { clearAuthModeCache, fetchAuthConfig, getCachedAuthMode } from './authMode';

const answer = (body: unknown, status = 200) => vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body });
const config = (authMode: unknown, registrationEnabled?: boolean) => ({
  success: true,
  data: { authMode, firebaseWebApiKey: null, ...(registrationEnabled === undefined ? {} : { registrationEnabled }) },
});

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubEnv('VITE_AUTH_MODE', '');
  vi.stubEnv('VITE_API_BASE_URL', 'http://api.test/');
  clearAuthModeCache();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('fetchAuthConfig', () => {
  it('asks the backend and returns the mode it reports', async () => {
    const fetchMock = answer(config('local'));
    vi.stubGlobal('fetch', fetchMock);

    expect((await fetchAuthConfig()).authMode).toBe('local');
    expect(fetchMock).toHaveBeenCalledWith('http://api.test/auth/config');
  });

  it('reports whether sign-up is open, and treats a backend that says nothing as open', async () => {
    vi.stubGlobal('fetch', answer(config('local', false)));
    expect((await fetchAuthConfig()).registrationEnabled).toBe(false);

    clearAuthModeCache();
    vi.stubGlobal('fetch', answer(config('local')));
    expect((await fetchAuthConfig()).registrationEnabled).toBe(true);
  });

  it('asks only once per session and remembers the mode for the next page load', async () => {
    const fetchMock = answer(config('local'));
    vi.stubGlobal('fetch', fetchMock);

    await fetchAuthConfig();
    await fetchAuthConfig();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('recta_auth_mode')).toBe('local');
  });

  it('falls back to Firebase when an older backend has no /auth/config', async () => {
    vi.stubGlobal('fetch', answer({ message: 'Not Found' }, 404));

    expect((await fetchAuthConfig()).authMode).toBe('firebase');
  });

  it('falls back to Firebase when the backend is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    expect((await fetchAuthConfig()).authMode).toBe('firebase');
  });

  it('ignores a mode it does not know', async () => {
    vi.stubGlobal('fetch', answer(config('ldap')));

    expect((await fetchAuthConfig()).authMode).toBe('firebase');
  });

  it('prefers the build-time mode, then the last mode seen, when the backend cannot answer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    vi.stubGlobal('localStorage', memoryStorage({ recta_auth_mode: 'local' }));
    expect((await fetchAuthConfig()).authMode).toBe('local');

    vi.stubEnv('VITE_AUTH_MODE', 'firebase');
    expect((await fetchAuthConfig()).authMode).toBe('firebase');
  });

  it('still answers when storage is blocked', async () => {
    vi.stubGlobal('localStorage', blockedStorage());
    vi.stubGlobal('fetch', answer(config('local')));

    expect((await fetchAuthConfig()).authMode).toBe('local');
  });
});

describe('getCachedAuthMode', () => {
  it('is null before anything is known', () => {
    expect(getCachedAuthMode()).toBeNull();
  });

  it('uses the stored mode, then the build-time one', () => {
    vi.stubEnv('VITE_AUTH_MODE', 'firebase');
    expect(getCachedAuthMode()).toBe('firebase');

    localStorage.setItem('recta_auth_mode', 'local');
    expect(getCachedAuthMode()).toBe('local');
  });

  it('is forgotten by clearAuthModeCache', async () => {
    vi.stubGlobal('fetch', answer(config('local')));
    await fetchAuthConfig();

    clearAuthModeCache();

    expect(getCachedAuthMode()).toBeNull();
  });
});
