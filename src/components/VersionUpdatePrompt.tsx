import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { analyticsHelpers } from '../utils/analytics';

export const VersionUpdatePrompt = () => {
  const [hasError, setHasError] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    const handleError = (event: ErrorEvent | PromiseRejectionEvent) => {
      // Detect script loading errors (common in new builds where old hashes are gone)
      const errorText = event instanceof ErrorEvent 
        ? event.message 
        : (event as PromiseRejectionEvent).reason instanceof Error
          ? (event as PromiseRejectionEvent).reason.message
          : String((event as PromiseRejectionEvent).reason || '');
      
      const isChunkError = 
        errorText?.includes('Loading chunk') || 
        errorText?.includes('Load chunk') ||
        errorText?.includes('Failed to fetch dynamically imported module') ||
        errorText?.includes('Script error'); // Some browsers report it simply as Script error for cross-origin

      if (isChunkError) {
        setHasError(true);
        analyticsHelpers.logVersionUpdateDetected();
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleError);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleError);
    };
  }, []);

  if (!hasError) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-900/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-surface-elevated rounded-2xl p-8 max-w-md w-full shadow-2xl text-center border border-primary-500/30 animate-slide-in-bottom">
        <div className="w-20 h-20 bg-brand-soft rounded-full flex items-center justify-center mx-auto mb-6">
          <RefreshCw className="w-10 h-10 text-brand animate-spin-slow" />
        </div>
        <h2 className="text-2xl font-bold text-content mb-2">
          {t.versionUpdateTitle}
        </h2>
        <p className="text-content-secondary mb-8 leading-relaxed">
          {t.versionUpdateDescription}
        </p>
        <button
          onClick={() => {
            analyticsHelpers.logVersionUpdateReloaded();
            window.location.reload();
          }}
          className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg flex items-center justify-center space-x-2"
        >
          <RefreshCw className="w-5 h-5" />
          <span>{t.versionUpdateButton}</span>
        </button>
      </div>
    </div>
  );
};




