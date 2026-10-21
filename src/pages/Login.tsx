import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import RectaMark from '../components/RectaMark';

// Sign in with Apple on the web needs Apple's OAuth code flow configured in Firebase (Services ID
// + key). Turn it on with VITE_APPLE_SIGNIN=true once that is done; iOS works without it.
const APPLE_SIGNIN_ENABLED = import.meta.env.VITE_APPLE_SIGNIN === 'true';
import { Mail, Lock, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { createSchemas, LoginFormData } from '../schemas';
import { useI18n } from '../context/I18nContext';
import { sanitizeFirebaseError } from '../utils/errorHandler';
import { postLoginPath } from '../utils/pendingJoin';

const Login = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();
  
  // Check URL parameters to determine initial mode
  const searchParams = new URLSearchParams(location.search);
  const action = searchParams.get('action');
  const initialMode = action === 'signup' ? false : true;
  
  const [isLogin, setIsLogin] = useState<boolean>(initialMode);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const { login, signup, loginWithGoogle, loginWithApple } = useAuth();
  const { loginSchema } = createSchemas(t);

  const isObviousFakeEmail = (email: string) => {
    const fakeDomains = ['teste.com', 'test.com', 'example.com', 'mailinator.com'];
    const domain = email.split('@')[1]?.toLowerCase();
    return fakeDomains.includes(domain);
  };

  // Get referral code from URL
  const referralCode = searchParams.get('ref') || undefined;

  // Sync state with URL changes
  useEffect(() => {
    const newAction = searchParams.get('action');
    const newMode = newAction === 'signup' ? false : true;
    if (newMode !== isLogin) {
      setIsLogin(newMode);
      setError(''); // Clear error when mode changes
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setError('');
    
    if (!isLogin && isObviousFakeEmail(data.email)) {
      setError(t.obviousFakeEmailError);
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        await login(data.email, data.password);
      } else {
        await signup(data.email, data.password, referralCode);
      }
      navigate(postLoginPath());
    } catch (err: any) {
      setError(sanitizeFirebaseError(err) || t.loginError);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async (): Promise<void> => {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle(referralCode);
      navigate(postLoginPath());
    } catch (err: any) {
      setError(sanitizeFirebaseError(err) || t.googleLoginError);
    } finally {
      setLoading(false);
    }
  };

  const handleAppleLogin = async (): Promise<void> => {
    setError('');
    setLoading(true);
    try {
      await loginWithApple(referralCode);
      navigate(postLoginPath());
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        // Closing Apple's window is not an error.
      } else if (code === 'auth/account-exists-with-different-credential') {
        setError(t.socialAccountExists);
      } else {
        setError(t.appleLoginError);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    const newMode = !isLogin;
    setIsLogin(newMode);
    setError('');
    reset();
    
    // Update URL to reflect the current mode
    const newSearchParams = new URLSearchParams(window.location.search);
    if (newMode) {
      newSearchParams.set('action', 'login');
    } else {
      newSearchParams.set('action', 'signup');
    }
    // Preserve referral code if it exists
    if (referralCode) {
      newSearchParams.set('ref', referralCode);
    }
    navigate(`/login?${newSearchParams.toString()}`, { replace: true });
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-surface py-12 px-4 sm:px-6 lg:px-8">
      {/* Soft brand glow behind the card */}
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/15 blur-3xl" aria-hidden="true" />
      {/* Back to Home Link */}
      <div className="relative w-full max-w-md mb-4">
        <Link
          to="/home"
          className="inline-flex items-center text-content-secondary hover:text-content text-sm font-medium transition-colors duration-200"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t.loginBackToHome}
        </Link>
      </div>
      
      <div className="relative max-w-md w-full space-y-7 bg-surface-elevated p-7 sm:p-8 rounded-2xl shadow-floating ring-1 ring-line-subtle">
        <div className="text-center">
          <div className="mark-hover mx-auto flex w-fit justify-center">
            <RectaMark className="h-9 w-auto text-content" />
          </div>
          <h2 className="mt-5 font-rounded text-[28px] font-bold tracking-tight text-content">
            {isLogin ? t.loginTitle : t.signupTitle}
          </h2>
          <p className="mt-2 text-sm text-content-secondary">
            {isLogin ? (
              <>
                {t.loginOr}{' '}
                <button
                  onClick={toggleMode}
                  className="font-semibold text-brand hover:opacity-75"
                >
                  {t.createNewAccount}
                </button>
              </>
            ) : (
              <>
                {t.loginSignupWithGoogle}{' '}
                <button
                  onClick={toggleMode}
                  className="font-semibold text-brand hover:opacity-75"
                >
                  {t.doLogin}
                </button>
              </>
            )}
          </p>
        </div>
        <div className="mt-8 space-y-6">
          {error && (
            <div className="bg-negative-soft text-negative-on-soft px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* Social login: Apple first, then Google */}
          <div className="space-y-3">
            {APPLE_SIGNIN_ENABLED && (
            <button
              type="button"
              onClick={handleAppleLogin}
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 h-12 px-4 rounded-xl bg-black text-white text-[15px] font-semibold hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="h-5 w-5 -mt-0.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
              </svg>
              {t.continueWithApple}
            </button>
            )}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full inline-flex items-center justify-center h-12 px-4 border border-line rounded-xl bg-surface-elevated text-[15px] font-semibold text-content hover:bg-surface-sunken transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span className="ml-2">{t.continueWithGoogle}</span>
            </button>
          </div>

          {/* Email/Password Form */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-line" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-surface-elevated text-content-tertiary">
                {t.continueWith}
              </span>
            </div>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-3">
              <div className="relative">
                <div className="absolute inset-y-0 start-0 z-10 ps-3.5 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-content-tertiary" aria-hidden="true" />
                </div>
                <input
                  type="email"
                  {...register('email')}
                  aria-invalid={errors.email ? true : undefined}
                  className="field-control h-12 ps-11"
                  placeholder={t.emailPlaceholder}
                />
              </div>
              {errors.email && (
                <p className="mt-1.5 text-sm text-negative px-1">{errors.email.message}</p>
              )}
              <div className="relative">
                <div className="absolute inset-y-0 start-0 z-10 ps-3.5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-content-tertiary" aria-hidden="true" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  {...register('password')}
                  aria-invalid={errors.password ? true : undefined}
                  className="field-control h-12 ps-11 pe-11"
                  placeholder={t.passwordPlaceholder}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 end-0 z-20 pe-3.5 flex items-center text-content-tertiary hover:text-content-secondary transition-colors"
                  aria-label={showPassword ? t.hidePasswordAriaLabel : t.showPasswordAriaLabel}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" aria-hidden />
                  ) : (
                    <Eye className="h-5 w-5" aria-hidden />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-sm text-negative px-1">{errors.password.message}</p>
              )}
            </div>

            <div>
              <button
                type="submit"
                disabled={loading || isSubmitting}
                className="w-full flex items-center justify-center h-12 px-4 text-base font-semibold rounded-xl text-white bg-brand-fill hover:bg-brand-fill-hover active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-[background-color,transform] duration-150"
              >
                {loading || isSubmitting ? t.loading : isLogin ? t.loginButton : t.signupButton}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
