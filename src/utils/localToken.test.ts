import { afterEach, describe, expect, it, vi } from 'vitest';
import { blockedStorage, memoryStorage } from '../test/memoryStorage';
import { TOKEN_KEY, clearLocalToken, getLocalToken, setLocalToken } from './localToken';

afterEach(() => vi.unstubAllGlobals());

describe('local token storage', () => {
  it('keeps the token under recta_token until it is cleared', () => {
    vi.stubGlobal('localStorage', memoryStorage());

    expect(getLocalToken()).toBeNull();
    setLocalToken('jwt-1');
    expect(localStorage.getItem('recta_token')).toBe('jwt-1');
    expect(TOKEN_KEY).toBe('recta_token');
    expect(getLocalToken()).toBe('jwt-1');

    clearLocalToken();
    expect(getLocalToken()).toBeNull();
  });

  it('never throws when storage is blocked', () => {
    vi.stubGlobal('localStorage', blockedStorage());

    expect(() => setLocalToken('jwt-1')).not.toThrow();
    expect(getLocalToken()).toBeNull();
    expect(() => clearLocalToken()).not.toThrow();
  });

  it('never throws when there is no storage at all', () => {
    vi.stubGlobal('localStorage', undefined);

    expect(getLocalToken()).toBeNull();
    expect(() => setLocalToken('jwt-1')).not.toThrow();
  });
});
