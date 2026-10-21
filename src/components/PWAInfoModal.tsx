import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Download, Smartphone, Monitor, Sparkles } from "lucide-react";
import { useI18n } from "../context/I18nContext";
import { analyticsHelpers } from "../utils/analytics";

interface PWAInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  source?: "landing_page" | "dashboard";
}

export const PWAInfoModal = ({
  isOpen,
  onClose,
  source = "dashboard",
}: PWAInfoModalProps) => {
  const { t } = useI18n();
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Verificar se já está instalado
    const checkIfInstalled = () => {
      if (window.matchMedia("(display-mode: standalone)").matches) {
        setIsInstalled(true);
        analyticsHelpers.logPWAAlreadyInstalled();
        return;
      }

      const nav = window.navigator as Navigator & { standalone?: boolean };
      if (nav.standalone === true) {
        setIsInstalled(true);
        analyticsHelpers.logPWAAlreadyInstalled();
        return;
      }
    };

    checkIfInstalled();
  }, []);

  // Log quando o modal é aberto
  useEffect(() => {
    if (isOpen && !isInstalled) {
      analyticsHelpers.logPWAInfoModalShown(source);
    }
  }, [isOpen, isInstalled, source]);

  const handleDontShowAgain = () => {
    localStorage.setItem("pwaInfoModalDismissed", "true");
    analyticsHelpers.logPWAInfoModalDontShowAgain(source);
    onClose();
  };

  const handleClose = () => {
    analyticsHelpers.logPWAInfoModalClosed(source);
    onClose();
  };

  if (!isOpen || isInstalled) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-gray-900 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-80 z-50 flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-info-title"
    >
      <div className="relative w-full max-w-md bg-surface-elevated rounded-2xl shadow-floating ring-1 ring-line-subtle animate-modal-panel">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-line">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-brand-soft rounded-lg">
              <Sparkles className="h-6 w-6 text-brand" />
            </div>
            <h2
              id="pwa-info-title"
              className="text-xl font-bold text-content"
            >
              {t.pwaInfoTitle || "Nova funcionalidade disponível!"}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-content-secondary transition-colors"
            aria-label={t.close}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-content-secondary">
            {t.pwaInfoDescription ||
              "Agora você pode instalar o Recta na tela inicial do seu celular ou computador para acesso rápido e melhor experiência!"}
          </p>

          <div className="space-y-3">
            <div className="flex items-start space-x-3 p-3 bg-surface-sunken rounded-lg">
              <Smartphone className="h-5 w-5 text-brand flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-content text-sm mb-1">
                  {t.pwaInfoMobileTitle || "No celular"}
                </h3>
                <p className="text-xs text-content-secondary">
                  {t.pwaInfoMobileDescription ||
                    'Toque no menu do navegador e selecione "Adicionar à tela inicial"'}
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-3 bg-surface-sunken rounded-lg">
              <Monitor className="h-5 w-5 text-brand flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-content text-sm mb-1">
                  {t.pwaInfoDesktopTitle || "No computador"}
                </h3>
                <p className="text-xs text-content-secondary">
                  {t.pwaInfoDesktopDescription ||
                    "Clique no ícone de instalação na barra de endereços ou no menu do navegador"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 p-3 bg-info/10 border border-info/25 rounded-lg">
            <Download className="h-5 w-5 text-info flex-shrink-0" />
            <p className="text-sm text-blue-800 dark:text-blue-200">
              {t.pwaInfoBenefit ||
                "Acesso rápido e experiência como app nativo!"}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-line">
          <button
            onClick={handleDontShowAgain}
            className="text-sm text-content-secondary hover:text-content transition-colors"
          >
            {t.dontShowAgain || "Não mostrar novamente"}
          </button>
          <button
            onClick={handleClose}
            className="inline-flex items-center justify-center gap-2 h-11 px-5 text-[15px] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-brand-fill text-white hover:bg-brand-fill-hover"
          >
            {t.gotIt || "Entendi!"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
