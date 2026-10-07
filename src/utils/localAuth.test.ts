import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStorage } from '../test/memoryStorage';
import { getLocalToken } from './localToken';
import { LocalAuthError, clearLocalSessionUser, localLogin, localRegister, readLocalSessionUser } from './localAuth';

const reply = (status: number, data: unknown = {}) => ({ ok: status < 400, status, json: async () => ({ success: status < 400, data }) });
const LOGIN_OK = reply(200, { token: 'jwt-1', id: 'user-1', email: 'ana@example.com' });

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubEnv('VITE_API_BASE_URL', 'http://api.test');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('localLogin', () => {
  it('posts the credentials and keeps the token and the user', async () => {
    const fetchMock = vi.fn().mockResolvedValue(LOGIN_OK);
    vi.stubGlobal('fetch', fetchMock);

    const user = await localLogin('ana@example.com', 'correct horse');

    expect(user).toEqual({ id: 'user-1', email: 'ana@example.com' });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/auth/login',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'ana@example.com', password: 'correct horse' }) })
    );
    expect(getLocalToken()).toBe('jwt-1');
    expect(readLocalSessionUser()).toEqual(user);
  });

  it.each([
    [401, 'invalid-credentials'],
    [409, 'email-taken'],
    [400, 'invalid-input'],
    [429, 'rate-limited'],
    [403, 'registration-closed'],
    [500, 'unknown'],
  ])('reports HTTP %i as %s and stores nothing', async (status, code) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(status)));

    await expect(localLogin('ana@example.com', 'wrong password')).rejects.toMatchObject({ code });
    expect(getLocalToken()).toBeNull();
    expect(readLocalSessionUser()).toBeNull();
  });

  it('reports an unreachable server as unknown', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const failure = await localLogin('ana@example.com', 'correct horse').catch((e) => e);

    expect(failure).toBeInstanceOf(LocalAuthError);
    expect(failure.code).toBe('unknown');
  });
});

describe('localRegister', () => {
  it('registers, then signs in to get the token', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(reply(201, { id: 'user-1' })).mockResolvedValueOnce(LOGIN_OK);
    vi.stubGlobal('fetch', fetchMock);

    await localRegister('ana@example.com', 'correct horse');

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['http://api.test/auth/register', 'http://api.test/auth/login']);
    expect(getLocalToken()).toBe('jwt-1');
  });

  it('stops at a taken email without signing in', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(409));
    vi.stubGlobal('fetch', fetchMock);

    await expect(localRegister('ana@example.com', 'correct horse')).rejects.toMatchObject({ code: 'email-taken' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('readLocalSessionUser', () => {
  it('is null without the token, even when the user was kept', () => {
    localStorage.setItem('recta_user', JSON.stringify({ id: 'user-1', email: 'ana@example.com' }));

    expect(readLocalSessionUser()).toBeNull();
  });

  it('is null for a damaged record', () => {
    localStorage.setItem('recta_token', 'jwt-1');
    localStorage.setItem('recta_user', '{not json');

    expect(readLocalSessionUser()).toBeNull();
  });

  it('is forgotten by clearLocalSessionUser', () => {
    localStorage.setItem('recta_token', 'jwt-1');
    localStorage.setItem('recta_user', JSON.stringify({ id: 'user-1', email: 'ana@example.com' }));

    clearLocalSessionUser();

    expect(readLocalSessionUser()).toBeNull();
  });
});
