import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { useToastContext } from '../context/ToastContext';
import { Mail, RefreshCw, Send, LogOut, Check } from 'lucide-react';
import { sendEmailVerification, reload } from 'firebase/auth';

export const VerificationModal = () => {
  const { currentUser, authMode, logout } = useAuth();
  const { t } = useI18n();
  const { success, error: showError } = useToastContext();
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResendEmail = async () => {
    if (!currentUser || cooldown > 0) return;

    setResendLoading(true);
    try {
      await sendEmailVerification(currentUser);
      success(t.verificationEmailSent);
      setCooldown(60);
    } catch (err: any) {
      showError(t.errorSendingVerification);
    } finally {
      setResendLoading(false);
    }
  };

  const handleCheckVerification = async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      await reload(currentUser);
      if (currentUser.emailVerified) {
        // Force token refresh to ensure Firestore rules recognize the verification
        await currentUser.getIdToken(true);
        success(t.emailVerifiedSuccess);
        window.location.reload(); 
      } else {
        showError(t.emailNotVerified);
      }
    } catch (err: any) {
      showError(t.error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = '/login';
    } catch (err) {
      // Error logging out
    }
  };

  if (!currentUser || currentUser.emailVerified) return null;

  // Email verification only exists in Firebase mode, and a local session has no providerData to inspect.
  if (authMode === 'local') return null;

  // Only show for email provider
  const isEmailProvider = currentUser.providerData?.some(
    (provider) => provider.providerId === 'password'
  ) ?? false;

  if (!isEmailProvider) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-8 border border-gray-200 dark:border-gray-700 animate-fade-in">
        <div className="flex flex-col items-center text-center">
          <div className="bg-primary-100 dark:bg-primary-900/30 p-4 rounded-full mb-6">
            <Mail className="h-12 w-12 text-primary-600 dark:text-primary-400" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            {t.verifyEmailTitle}
          </h2>
          
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mb-6 w-full">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 break-all">
              {currentUser.email}
            </p>
          </div>
          
          <p className="text-gray-600 dark:text-gray-400 mb-8 text-sm">
            {t.verifyEmailDescription}
          </p>
          
          <div className="w-full space-y-4">
            <button
              onClick={handleCheckVerification}
              disabled={loading}
              className="w-full flex items-center justify-center py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 shadow-lg shadow-primary-500/20"
            >
              {loading ? (
                <RefreshCw className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <Check className="h-5 w-5 mr-2" />
              )}
              {t.confirmVerification}
            </button>
            
            <button
              onClick={handleResendEmail}
              disabled={resendLoading || cooldown > 0}
              className="w-full flex items-center justify-center py-3 px-4 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 transition-all duration-200 disabled:opacity-50"
            >
              {resendLoading ? (
                <RefreshCw className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <Send className="h-5 w-5 mr-2" />
              )}
              {cooldown > 0 
                ? t.resendCooldown.replace('{{seconds}}', cooldown.toString()) 
                : t.resendVerificationEmail}
            </button>
            
            <div className="pt-4 border-t border-gray-100 dark:border-gray-700 w-full">
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 flex items-center justify-center mx-auto transition-colors"
              >
                <LogOut className="h-4 w-4 mr-2" />
                {t.logout}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
