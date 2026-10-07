// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalAuthError } from '../utils/localAuth';

const auth = vi.hoisted(() => ({
  state: { authMode: 'local' as 'local' | 'firebase', registrationEnabled: true },
  login: vi.fn(),
  signup: vi.fn(),
  loginWithGoogle: vi.fn(),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ authMode: auth.state.authMode, registrationEnabled: auth.state.registrationEnabled, login: auth.login, signup: auth.signup, loginWithGoogle: auth.loginWithGoogle }),
}));
// Every translation key reads back as its own name, so assertions name the key that should be shown.
vi.mock('../context/I18nContext', () => ({
  useI18n: () => ({ t: new Proxy({}, { get: (_target, key) => String(key) }) }),
}));

const { default: Login } = await import('./Login');

const renderLogin = () =>
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Login />
    </MemoryRouter>
  );

async function submit(email = 'ana@example.com', password = 'correct horse') {
  const [emailInput, passwordInput] = [document.querySelector('input[type="email"]')!, document.querySelector('input[type="password"]')!];
  fireEvent.change(emailInput, { target: { value: email } });
  fireEvent.change(passwordInput, { target: { value: password } });
  fireEvent.submit(document.querySelector('form')!);
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.state.authMode = 'local';
  auth.state.registrationEnabled = true;
});
afterEach(cleanup);

describe('Login page', () => {
  it('does not offer Google sign-in when the backend runs local auth', () => {
    renderLogin();

    expect(screen.queryByText('google')).toBeNull();
    expect(screen.queryByText('continueWith')).toBeNull();
    expect(document.querySelector('form')).not.toBeNull();
  });

  it('offers Google sign-in in Firebase mode', () => {
    auth.state.authMode = 'firebase';

    renderLogin();

    expect(screen.getByText('google')).toBeTruthy();
    expect(screen.getByText('continueWith')).toBeTruthy();
  });

  it.each([
    ['invalid-credentials', 'localAuthInvalidCredentials'],
    ['email-taken', 'localAuthEmailTaken'],
    ['invalid-input', 'localAuthInvalidInput'],
    ['rate-limited', 'localAuthRateLimited'],
    ['registration-closed', 'localAuthRegistrationClosed'],
    ['unknown', 'loginError'],
  ] as const)('words a %s local failure with the %s message', async (code, key) => {
    auth.login.mockRejectedValue(new LocalAuthError(code, 'boom'));

    renderLogin();
    await submit();

    expect(await screen.findByText(key)).toBeTruthy();
  });

  it('offers the sign-up link while registration is open', () => {
    renderLogin();

    expect(screen.getByText('createNewAccount')).toBeTruthy();
  });

  it('hides the sign-up link, and ignores ?action=signup, when registration is closed', () => {
    auth.state.registrationEnabled = false;

    render(
      <MemoryRouter initialEntries={['/login?action=signup']}>
        <Login />
      </MemoryRouter>
    );

    expect(screen.queryByText('createNewAccount')).toBeNull();
    expect(screen.getByText('loginTitle')).toBeTruthy();
  });

  it('does not mention Google in the sign-up subtitle in local mode', () => {
    render(
      <MemoryRouter initialEntries={['/login?action=signup']}>
        <Login />
      </MemoryRouter>
    );

    expect(screen.getByText('localAuthHaveAccount')).toBeTruthy();
    expect(screen.queryByText('loginSignupWithGoogle')).toBeNull();
  });

  it('keeps the Google wording in the sign-up subtitle in Firebase mode', () => {
    auth.state.authMode = 'firebase';

    render(
      <MemoryRouter initialEntries={['/login?action=signup']}>
        <Login />
      </MemoryRouter>
    );

    expect(screen.getByText('loginSignupWithGoogle')).toBeTruthy();
  });

  it('signs in and leaves the page on success', async () => {
    auth.login.mockResolvedValue({ user: {} });

    renderLogin();
    await submit();

    await waitFor(() => expect(auth.login).toHaveBeenCalledWith('ana@example.com', 'correct horse'));
  });
});
