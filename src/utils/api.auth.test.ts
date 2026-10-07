import type { InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStorage } from '../test/memoryStorage';

const firebase = vi.hoisted(() => ({ getFirebaseAuth: vi.fn() }));
vi.mock('../config/firebase', () => firebase);

const { axiosInstance } = await import('./api');

// Answer every request from an adapter that reports the Authorization header it was given.
async function sentAuthorization(): Promise<string | undefined> {
  let sent: string | undefined;
  await axiosInstance.get('/ping', {
    adapter: async (config: InternalAxiosRequestConfig) => {
      sent = config.headers.get('Authorization') as string | undefined;
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
    },
  });
  return sent;
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  firebase.getFirebaseAuth.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('request authorization', () => {
  it('sends the local JWT and never touches Firebase', async () => {
    localStorage.setItem('recta_auth_mode', 'local');
    localStorage.setItem('recta_token', 'jwt-1');

    expect(await sentAuthorization()).toBe('Bearer jwt-1');
    expect(firebase.getFirebaseAuth).not.toHaveBeenCalled();
  });

  it('ignores a leftover local JWT in Firebase mode', async () => {
    localStorage.setItem('recta_auth_mode', 'firebase');
    localStorage.setItem('recta_token', 'stale-jwt');
    firebase.getFirebaseAuth.mockReturnValue({ currentUser: { getIdToken: async () => 'firebase-id-token' } });

    expect(await sentAuthorization()).toBe('Bearer firebase-id-token');
  });

  it('sends the Firebase ID token when there is no local JWT', async () => {
    firebase.getFirebaseAuth.mockReturnValue({ currentUser: { getIdToken: async () => 'firebase-id-token' } });

    expect(await sentAuthorization()).toBe('Bearer firebase-id-token');
  });

  it('sends no token, and does not fail, when Firebase is not configured', async () => {
    firebase.getFirebaseAuth.mockImplementation(() => {
      throw new Error('Firebase is not configured');
    });

    expect(await sentAuthorization()).toBeUndefined();
  });

  it('sends no token when nobody is signed in', async () => {
    firebase.getFirebaseAuth.mockReturnValue({ currentUser: null });

    expect(await sentAuthorization()).toBeUndefined();
  });
});

describe('a 401 answer', () => {
  const answerWith = (status: number) =>
    axiosInstance.get('/ping', {
      adapter: async (config: InternalAxiosRequestConfig) => {
        const response = { data: { success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } }, status, statusText: '', headers: {}, config };
        throw Object.assign(new Error('rejected'), { isAxiosError: true, config, response });
      },
    });
  const assign = vi.fn();

  beforeEach(() => {
    assign.mockReset();
    vi.stubGlobal('window', { location: { pathname: '/app', assign } });
  });

  it('ends a local session: token and user are dropped and the login page opens', async () => {
    localStorage.setItem('recta_auth_mode', 'local');
    localStorage.setItem('recta_token', 'expired-jwt');
    localStorage.setItem('recta_user', '{"id":"u","email":"a@b.c"}');

    await expect(answerWith(401)).rejects.toMatchObject({ status: 401 });

    expect(localStorage.getItem('recta_token')).toBeNull();
    expect(localStorage.getItem('recta_user')).toBeNull();
    expect(assign).toHaveBeenCalledWith('/login');
  });

  it('leaves a Firebase session alone', async () => {
    localStorage.setItem('recta_auth_mode', 'firebase');
    firebase.getFirebaseAuth.mockReturnValue({ currentUser: null });

    await expect(answerWith(401)).rejects.toMatchObject({ status: 401 });

    expect(assign).not.toHaveBeenCalled();
  });

  it('does not end a local session for other errors', async () => {
    localStorage.setItem('recta_auth_mode', 'local');
    localStorage.setItem('recta_token', 'jwt-1');

    await expect(answerWith(500)).rejects.toMatchObject({ status: 500 });

    expect(localStorage.getItem('recta_token')).toBe('jwt-1');
    expect(assign).not.toHaveBeenCalled();
  });
});
