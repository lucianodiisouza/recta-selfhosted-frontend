// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ state: { authMode: 'firebase' as 'local' | 'firebase', currentUser: null as unknown } }));

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ ...auth.state, logout: vi.fn() }) }));
vi.mock('../context/I18nContext', () => ({ useI18n: () => ({ t: new Proxy({}, { get: (_target, key) => String(key) }) }) }));
vi.mock('../context/ToastContext', () => ({ useToastContext: () => ({ success: vi.fn(), error: vi.fn() }) }));

const { VerificationModal } = await import('./VerificationModal');

afterEach(cleanup);

// A signed-in user whose email is not verified yet, signed in with email and password.
const unverifiedUser = { email: 'ana@example.com', emailVerified: false, providerData: [{ providerId: 'password' }] };

describe('VerificationModal', () => {
  it('asks a Firebase user with an unverified email to verify it', () => {
    auth.state = { authMode: 'firebase', currentUser: unverifiedUser };

    render(<VerificationModal />);

    expect(document.body.textContent).toContain('ana@example.com');
  });

  it('stays hidden in local mode, whatever the user looks like', () => {
    auth.state = { authMode: 'local', currentUser: unverifiedUser };

    render(<VerificationModal />);

    expect(document.body.textContent).toBe('');
  });

  it('does not crash on a user without provider data, like the local stand-in', () => {
    auth.state = { authMode: 'firebase', currentUser: { uid: 'user-1', email: 'ana@example.com' } };

    expect(() => render(<VerificationModal />)).not.toThrow();
    expect(document.body.textContent).toBe('');
  });
});
