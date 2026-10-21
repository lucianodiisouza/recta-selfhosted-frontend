import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { analyticsHelpers } from '../utils/analytics';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    // Verificar se já está instalado
    const checkIfInstalled = () => {
      // Verificar se está em modo standalone (instalado)
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
        setShowPrompt(false);
        analyticsHelpers.logPWAAlreadyInstalled();
        return;
      }

      // Verificar se está em modo standalone no iOS
      const nav = window.navigator as Navigator & { standalone?: boolean };
      if (nav.standalone === true) {
        setIsInstalled(true);
        setShowPrompt(false);
        analyticsHelpers.logPWAAlreadyInstalled();
        return;
      }
    };

    checkIfInstalled();

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
      analyticsHelpers.logPWAInstallPromptShown();
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setShowPrompt(false);
        setIsInstalled(true);
        analyticsHelpers.logPWAInstallAccepted();
      } else {
        analyticsHelpers.logPWAInstallDismissed();
      }
      
      setDeferredPrompt(null);
    } catch (error) {
      analyticsHelpers.logPWAInstallAttempted(false, 'error');
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Salvar no localStorage para não mostrar novamente por um tempo
    localStorage.setItem('installPromptDismissed', Date.now().toString());
    analyticsHelpers.logPWAInstallLater();
  };

  // Não mostrar se foi dispensado recentemente (24 horas)
  useEffect(() => {
    const dismissed = localStorage.getItem('installPromptDismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      const hoursSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60);
      if (hoursSinceDismissed < 24) {
        setShowPrompt(false);
      }
    }
  }, []);

  if (!showPrompt || !deferredPrompt || isInstalled) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 bg-surface-elevated border border-line rounded-lg shadow-lg p-4 animate-slide-in-bottom">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <div className="p-2 bg-brand-soft rounded-lg flex-shrink-0">
            <Download className="h-5 w-5 text-brand" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-content text-sm">
              {t.installApp || 'Instalar Recta'}
            </h3>
            <p className="text-xs text-content-secondary mt-1">
              {t.installAppDescription || 'Instale o app para acesso rápido e melhor experiência'}
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-content-secondary flex-shrink-0 ml-2"
          aria-label={t.close || 'Fechar'}
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex gap-2 mt-4">
        <button
          onClick={handleInstall}
          className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
        >
          {t.installNow || 'Instalar Agora'}
        </button>
        <button
          onClick={handleDismiss}
          className="px-4 py-2 text-sm font-medium text-content-secondary hover:text-content transition-colors"
        >
          {t.later || 'Depois'}
        </button>
      </div>
    </div>
  );
};

