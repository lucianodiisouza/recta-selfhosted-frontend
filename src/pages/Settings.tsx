import { useCurrency } from "../context/CurrencyContext";
import { useI18n, Locale } from "../context/I18nContext";
import { useTheme } from "../context/ThemeContext";
import { useToastContext } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import { useReferral } from "../hooks/useReferral";
import { usePWAInstall } from "../hooks/usePWAInstall";
import {
  CurrencyCode,
  CURRENCY_LIST,
  CURRENCIES,
} from "../context/CurrencyContext";
import {
  Settings,
  DollarSign,
  Languages,
  Info,
  User,
  Lock,
  Moon,
  Sun,
  UserPlus,
  Copy,
  Check,
  Globe,
  RefreshCcw,
  Download,
  Smartphone,
  Monitor,
  Trash2,
  Tag,
  Pencil,
  Plus,
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import packageJson from "../../package.json";
import { PageHeader } from "../components/PageHeader";
import SelectCombobox from "../components/SelectCombobox";
import {
  COUNTRIES,
  LANGUAGES,
  COUNTRY_CURRENCY_MAP,
} from "../utils/onboardingData";
import {
  useUser,
  useUpdateUserPreferences,
  useDeleteUserAccount,
  useResetUserAccount,
} from "../hooks/api/useUsers";
import DeleteUserAccountModal from "../components/DeleteUserAccountModal";
import ResetAccountModal from "../components/ResetAccountModal";
import ConfirmModal from "../components/ConfirmModal";
import {
  useDefaultHousehold,
} from "../hooks/useDefaultHousehold";
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from "../hooks/api/useCategories";
import { CategoryType } from "../lib/enums";
import {
  deleteUser,
  GoogleAuthProvider,
  reauthenticateWithPopup,
} from "firebase/auth";

const SettingsPage = () => {
  const { baseCurrency, setBaseCurrency, getCurrencyInfo } = useCurrency();
  const { locale, setLocale, t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const { success, error: showError } = useToastContext();
  const { currentUser, authMode, logout } = useAuth();
  const { referralCount, getInviteLink } = useReferral();
  const { install, isInstalled, canInstall } = usePWAInstall();
  const [linkCopied, setLinkCopied] = useState(false);
  const { data: user } = useUser();
  const updatePreferences = useUpdateUserPreferences();
  const deleteUserAccount = useDeleteUserAccount();
  const resetUserAccount = useResetUserAccount();
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [isRestartingOnboarding, setIsRestartingOnboarding] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isResetAccountModalOpen, setIsResetAccountModalOpen] = useState(false);
  const [categoryDeleteConfirm, setCategoryDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [categoryForm, setCategoryForm] = useState<{ id: string | null; name: string; type: CategoryType } | null>(null);
  const currencyInfo = getCurrencyInfo();
  const { householdId } = useDefaultHousehold();
  const { data: categoriesList = [] } = useCategories({ householdId: householdId ?? undefined, type: undefined });
  const customCategories = categoriesList.filter((c) => !c.isSystem);
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  // Memoizar opções para performance
  const countryOptions = useMemo(
    () => COUNTRIES.map((c) => ({ value: c.code, label: c.name })),
    []
  );

  const languageOptions = useMemo(
    () =>
      LANGUAGES.map((lang) => ({
        value: lang.code,
        label: `${lang.name} (${lang.nativeName})`,
      })),
    []
  );

  const currencyOptions = useMemo(
    () =>
      CURRENCY_LIST.map((currency) => ({
        value: currency.code,
        label: `${currency.symbol} - ${currency.name} (${currency.code})`,
      })),
    []
  );

  // Carregar país e nome do usuário
  useEffect(() => {
    if (user) {
      if (user.country) {
        setSelectedCountry(user.country);
      }
      if (user.displayName) {
        setDisplayName(user.displayName);
      } else if (currentUser?.displayName) {
        setDisplayName(currentUser.displayName);
      }
    }
  }, [user, currentUser]);

  const handleUpdateName = useCallback(async () => {
    if (!currentUser || !displayName.trim()) return;

    setIsSavingName(true);
    try {
      await updatePreferences.mutateAsync({ displayName: displayName.trim() });
      success(t.accountUpdated || "Perfil atualizado com sucesso");
      const { analyticsHelpers } = await import('../utils/analytics');
      analyticsHelpers.logDisplayNameUpdated();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Erro ao atualizar perfil";
      showError(message);
    } finally {
      setIsSavingName(false);
    }
  }, [
    currentUser,
    displayName,
    updatePreferences,
    success,
    showError,
    t.accountUpdated,
  ]);

  const handleBaseCurrencyChange = useCallback(
    async (currency: string) => {
      const code = currency as CurrencyCode;
      setBaseCurrency(code);
      const newCurrencyInfo = CURRENCIES[code] || CURRENCIES["BRL"];
      success(`${t.currencyChanged}: ${newCurrencyInfo.name}`);
      const { analyticsHelpers } = await import('../utils/analytics');
      analyticsHelpers.logCurrencyChanged(code);
    },
    [setBaseCurrency, success, t.currencyChanged]
  );

  const handleLocaleChange = useCallback(
    async (newLocale: string) => {
      const code = newLocale as Locale;
      setLocale(code);
      success(t.languageChanged);
      const { analyticsHelpers } = await import('../utils/analytics');
      analyticsHelpers.logLanguageChanged(code);
    },
    [setLocale, success, t.languageChanged]
  );

  const handleCountryChange = useCallback(
    async (countryCode: string) => {
      if (!currentUser) return;

      setSelectedCountry(countryCode);

      try {
        const updateData: { country: string; baseCurrency?: CurrencyCode } = {
          country: countryCode,
        };

        const suggestedCurrency = COUNTRY_CURRENCY_MAP[countryCode];
        if (suggestedCurrency) {
          updateData.baseCurrency = suggestedCurrency;
          setBaseCurrency(suggestedCurrency);
        }

        await updatePreferences.mutateAsync(updateData);
        success(t.update);
        const { analyticsHelpers } = await import('../utils/analytics');
        analyticsHelpers.logCountryChanged(countryCode);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Erro ao atualizar país";
        showError(message);
      }
    },
    [
      currentUser,
      setBaseCurrency,
      updatePreferences,
      showError,
      success,
      t.update,
    ]
  );

  const handleRestartOnboarding = useCallback(async () => {
    if (!currentUser) return;

    setIsRestartingOnboarding(true);
    try {
      await updatePreferences.mutateAsync({
        onboardingCompleted: false,
        onboardingRestartedAt: new Date().toISOString(),
      });

      success(t.onboardingRestarted);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Erro ao reiniciar onboarding";
      showError(message);
    } finally {
      setIsRestartingOnboarding(false);
    }
  }, [
    currentUser,
    updatePreferences,
    success,
    t.onboardingRestarted,
    showError,
  ]);

  const handleCopyInviteLink = useCallback(() => {
    const inviteLink = getInviteLink();
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      success(t.inviteLinkCopied);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  }, [getInviteLink, success, t.inviteLinkCopied]);

  const handleDeleteUserAccount = useCallback(
    async (email: string) => {
      if (!currentUser || !currentUser.email) {
        showError("Usuário não está autenticado");
        return;
      }

      // Verificar se o email digitado corresponde ao email do usuário
      if (email.toLowerCase() !== currentUser.email.toLowerCase()) {
        showError(
          t.emailDoesNotMatch ||
          "O e-mail digitado não corresponde ao seu e-mail."
        );
        return;
      }

      try {
        // 1. Reautenticar o usuário antes de deletar (requisito do Firebase)
        // Verificar se o usuário fez login com Google
        const isGoogleUser =
          currentUser.providerData?.some(
            (provider) => provider.providerId === "google.com"
          ) ?? false;

        if (isGoogleUser) {
          // Para usuários Google, fazer reautenticação com Google
          const provider = new GoogleAuthProvider();
          await reauthenticateWithPopup(currentUser, provider);
        }
        // Para usuários com email/senha, tentar deletar diretamente
        // O Firebase pode exigir reautenticação, mas vamos tentar primeiro

        // 2. Deletar conta no backend primeiro
        await deleteUserAccount.mutateAsync();

        // A local account has no Firebase user to delete: the backend deletion was all of it. Signing out clears
        // the session, which sends the user to the login page.
        if (authMode === 'local') {
          await logout();
          return;
        }

        // 3. Depois deletar conta no Firebase Auth
        // Tentar deletar - se exigir reautenticação, o erro será capturado abaixo
        try {
          await deleteUser(currentUser);
        } catch (deleteError: any) {
          // Se o Firebase exigir reautenticação recente para email/senha
          if (
            deleteError.code === "auth/requires-recent-login" &&
            !isGoogleUser
          ) {
            showError(
              t.requiresRecentLogin ||
              "Por favor, faça logout e login novamente antes de deletar sua conta. Isso é necessário por segurança do Firebase."
            );
            return;
          }
          throw deleteError; // Re-lançar outros erros
        }

        // 4. Limpar cache do Service Worker
        if ("caches" in window) {
          try {
            const cacheNames = await caches.keys();
            await Promise.all(
              cacheNames.map((cacheName) => caches.delete(cacheName))
            );
          } catch (error) {
            // Error clearing cache
          }
        }

        // 5. Limpar localStorage e sessionStorage
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch (error) {
          // Error clearing storage
        }

        // Redirecionar para login será automático pelo AuthContext quando o usuário for deletado
      } catch (error: any) {

        // Se o erro for de reautenticação, mostrar mensagem específica
        if (error.code === "auth/requires-recent-login") {
          showError(
            t.requiresRecentLogin ||
            "Por favor, faça login novamente antes de deletar sua conta"
          );
        } else if (error.code === "auth/user-mismatch") {
          showError(
            "Erro de autenticação. Por favor, faça logout e login novamente."
          );
        } else if (
          error.code === "auth/popup-closed-by-user" ||
          error.code === "auth/cancelled-popup-request"
        ) {
          // Usuário cancelou o popup do Google
          showError(t.cancel || "Operação cancelada");
        } else {
          const message =
            error?.message || "Erro ao deletar conta. Tente novamente.";
          showError(message);
        }
      }
    },
    [currentUser, authMode, logout, deleteUserAccount, showError, t.cancel, t.emailDoesNotMatch, t.requiresRecentLogin]
  );

  const handleResetRectaAccount = useCallback(
    async () => {
      if (!currentUser) {
        showError("Usuário não está autenticado");
        return;
      }

      try {
        // Reset account data (deletes all data but keeps user)
        await resetUserAccount.mutateAsync();

        // Clear cache
        if ("caches" in window) {
          try {
            const cacheNames = await caches.keys();
            await Promise.all(
              cacheNames.map((cacheName) => caches.delete(cacheName))
            );
          } catch (error) {
            // Error clearing cache
          }
        }

        // Clear localStorage and sessionStorage
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch (error) {
          // Error clearing storage
        }

        // Reload page to trigger onboarding
        window.location.reload();
      } catch (error: any) {
        const message =
          error?.message || "Erro ao resetar conta. Tente novamente.";
        showError(message);
      }
    },
    [currentUser, resetUserAccount, showError]
  );

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <PageHeader
        title={
          <span className="flex items-center">
            <Settings className="h-6 w-6 sm:h-8 sm:w-8 mr-2 sm:mr-3" />
            {t.settings}
          </span>
        }
        description={t.preferences}
      />

      {/* Perfil - Bloqueado */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-light tracking-tight text-gray-900 dark:text-white mb-4 flex items-center">
          <User className="h-5 w-5 mr-2" />
          {t.profile}
        </h2>

        <div className="space-y-4">
          {/* Avatar */}
          <div>
            <label className="block text-sm font-light text-gray-500 dark:text-gray-400 mb-2">
              {t.avatar}
            </label>
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <div className="h-16 w-16 rounded-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center justify-center">
                  <User className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                </div>
              </div>
              <div className="flex-1">
                <div className="relative">
                  <input
                    type="text"
                    value=""
                    disabled
                    className="block w-full px-3 py-2.5 border border-gray-200 dark:border-gray-800 rounded-md bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 cursor-not-allowed pr-10 font-light"
                    placeholder={t.avatar}
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <Lock className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Nome */}
          <div>
            <label className="block text-sm font-light text-gray-500 dark:text-gray-400 mb-2">
              {t.name}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onBlur={handleUpdateName}
                  onKeyDown={(e) => e.key === "Enter" && handleUpdateName()}
                  className="block w-full px-3 py-2.5 border border-gray-200 dark:border-gray-800 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary-500 dark:focus:border-primary-500 pr-10 font-light tracking-tight"
                  placeholder={t.name}
                />
                {isSavingName && (
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <RefreshCcw className="h-4 w-4 text-primary-500 animate-spin" />
                  </div>
                )}
              </div>
              <button
                onClick={handleUpdateName}
                disabled={isSavingName || !displayName.trim()}
                className="px-4 py-2.5 text-sm font-light tracking-tight text-white bg-primary-600 dark:bg-primary-500 border border-primary-600 dark:border-primary-500 rounded-md hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t.save}
              </button>
            </div>
          </div>

          {/* Aviso de Privacidade */}
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <div className="border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">
                    {t.privacyNotice}
                  </h3>
                  <p className="text-sm font-light text-blue-600 dark:text-blue-400">
                    {t.privacyNoticeDescription}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Instalação do App */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-light tracking-tight text-gray-900 dark:text-white mb-4 flex items-center">
          <Download className="h-5 w-5 mr-2" />
          {t.installApp || "Instalar App"}
        </h2>
        <p className="text-sm font-light text-gray-500 dark:text-gray-400 mb-4">
          {t.pwaInfoDescription ||
            "Instale o Recta na tela inicial do seu celular ou computador para acesso rápido e melhor experiência!"}
        </p>

        {isInstalled ? (
          <div className="border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center">
              <Check className="h-5 w-5 text-green-500 dark:text-green-400 mr-2" />
              <p className="text-sm font-light text-green-600 dark:text-green-400">
                {t.pwaInstalled || "App instalado com sucesso!"}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {canInstall ? (
              <button
                onClick={async () => {
                  const installed = await install();
                  if (installed) {
                    success(t.installApp || "App instalado com sucesso!");
                  }
                }}
                className="w-full sm:w-auto px-4 py-2.5 text-sm font-light tracking-tight text-white bg-primary-600 dark:bg-primary-500 border border-primary-600 dark:border-primary-500 rounded-lg hover:opacity-80 transition-opacity flex items-center justify-center gap-2"
              >
                <Download className="h-5 w-5" />
                {t.installNow || "Instalar Agora"}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start space-x-3 p-3 border border-gray-100 dark:border-gray-800 rounded-lg">
                  <Smartphone className="h-5 w-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white text-sm mb-1">
                      {t.pwaInfoMobileTitle || "No celular"}
                    </h3>
                    <p className="text-xs font-light text-gray-500 dark:text-gray-400">
                      {t.pwaInfoMobileDescription ||
                        'Toque no menu do navegador e selecione "Adicionar à tela inicial"'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3 border border-gray-100 dark:border-gray-800 rounded-lg">
                  <Monitor className="h-5 w-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white text-sm mb-1">
                      {t.pwaInfoDesktopTitle || "No computador"}
                    </h3>
                    <p className="text-xs font-light text-gray-500 dark:text-gray-400">
                      {t.pwaInfoDesktopDescription ||
                        "Clique no ícone de instalação na barra de endereços ou no menu do navegador"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Aparência / Tema */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-light tracking-tight text-gray-900 dark:text-white mb-4 flex items-center">
          {theme === "dark" ? (
            <Moon className="h-5 w-5 mr-2" />
          ) : (
            <Sun className="h-5 w-5 mr-2" />
          )}
          {t.appearance}
        </h2>
        <p className="text-sm font-light text-gray-500 dark:text-gray-400 mb-4">
          {t.themeDescription}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-300">
              {t.theme}:
            </span>
            <span className="text-sm font-light text-gray-500 dark:text-gray-400">
              {theme === "dark" ? t.darkMode : t.lightMode}
            </span>
          </div>
          <button
            onClick={toggleTheme}
            className={`
              relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
              ${theme === "dark" ? "bg-primary-600" : "bg-gray-300"}
            `}
            aria-label={t.theme}
          >
            <span
              className={`
                inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                ${theme === "dark" ? "translate-x-6" : "translate-x-1"}
              `}
            />
          </button>
        </div>
      </div>

      {/* Categorias personalizadas */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-light tracking-tight text-gray-900 dark:text-white mb-4 flex items-center">
          <Tag className="h-5 w-5 mr-2" />
          {t.manageCategories}
        </h2>
        <p className="text-sm font-light text-gray-500 dark:text-gray-400 mb-4">
          {t.noCustomCategories}
        </p>

        {categoryForm ? (
          <div className="flex flex-wrap items-end gap-2 mb-4 p-3 border border-gray-100 dark:border-gray-800 rounded-lg">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-300 mb-1">{t.name}</label>
              <input
                value={categoryForm.name}
                onChange={(e) => setCategoryForm((f) => (f ? { ...f, name: e.target.value } : null))}
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-800 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm font-light tracking-tight"
                placeholder={t.name}
              />
            </div>
            {!categoryForm.id && (
              <div className="min-w-[120px]">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-300 mb-1">{t.type}</label>
                <select
                  value={categoryForm.type}
                  onChange={(e) => setCategoryForm((f) => (f ? { ...f, type: e.target.value as CategoryType } : null))}
                  className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-800 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm font-light tracking-tight"
                >
                  <option value={CategoryType.INCOME}>{t.income}</option>
                  <option value={CategoryType.EXPENSE}>{t.expense}</option>
                </select>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (!categoryForm?.name.trim() || !householdId) return;
                  try {
                    if (categoryForm.id) {
                      await updateCategory.mutateAsync({ id: categoryForm.id, name: categoryForm.name.trim() });
                      success(t.update);
                    } else {
                      await createCategory.mutateAsync({
                        householdId,
                        name: categoryForm.name.trim(),
                        type: categoryForm.type,
                      });
                      success(t.create);
                    }
                    setCategoryForm(null);
                  } catch (err: unknown) {
                    showError(err instanceof Error ? err.message : "Erro");
                  }
                }}
                disabled={!categoryForm.name.trim() || createCategory.isPending || updateCategory.isPending}
                className="px-3 py-2.5 text-sm font-light tracking-tight text-white bg-primary-600 dark:bg-primary-500 border border-primary-600 dark:border-primary-500 rounded-md hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {categoryForm.id ? t.save : t.create}
              </button>
              <button
                onClick={() => setCategoryForm(null)}
                className="px-3 py-2.5 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white text-sm font-light tracking-tight rounded-md hover:opacity-70 transition-opacity bg-white dark:bg-gray-900"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setCategoryForm({ id: null, name: "", type: CategoryType.EXPENSE })}
            className="mb-4 inline-flex items-center gap-2 px-3 py-2.5 text-sm font-light tracking-tight text-white bg-primary-600 dark:bg-primary-500 border border-primary-600 dark:border-primary-500 rounded-md hover:opacity-80 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            {t.addCategory}
          </button>
        )}

        <ul className="space-y-2">
          {customCategories.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between py-2 px-3 rounded-md border border-gray-100 dark:border-gray-800"
            >
              <span className="font-light text-gray-900 dark:text-white">{c.name}</span>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full border font-light ${c.type === CategoryType.INCOME ? "border-green-300 dark:border-green-700 text-green-600 dark:text-green-400" : "border-red-300 dark:border-red-700 text-red-600 dark:text-red-400"
                    }`}
                >
                  {c.type === CategoryType.INCOME ? t.income : t.expense}
                </span>
                <button
                  type="button"
                  onClick={() => setCategoryForm({ id: c.id, name: c.name, type: c.type })}
                  className="p-1.5 text-gray-500 hover:text-primary-600 dark:hover:text-primary-400"
                  aria-label={t.edit}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryDeleteConfirm({ id: c.id, name: c.name })}
                  className="p-1.5 text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                  aria-label={t.delete}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>

        <ConfirmModal
          isOpen={!!categoryDeleteConfirm}
          onClose={() => setCategoryDeleteConfirm(null)}
          onConfirm={async () => {
            if (!categoryDeleteConfirm) return;
            try {
              await deleteCategory.mutateAsync(categoryDeleteConfirm.id);
              success(t.delete);
              setCategoryDeleteConfirm(null);
            } catch (err: unknown) {
              const code = (err as Error & { code?: string }).code;
              if (code === "CATEGORY_IN_USE") {
                showError(t.categoryDeleteInUse);
              } else {
                showError(err instanceof Error ? err.message : t.error);
              }
            }
          }}
          title={t.delete}
          message={t.delete + ": " + (categoryDeleteConfirm?.name ?? "") + "?"}
          variant="danger"
          isLoading={deleteCategory.isPending}
        />
      </div>

      {/* Moeda Base */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-light tracking-tight text-gray-900 dark:text-white mb-4 flex items-center">
          <DollarSign className="h-5 w-5 mr-2" />
          {t.baseCurrency}
        </h2>
        <p className="text-sm font-light text-gray-500 dark:text-gray-400 mb-4">
          {t.baseCurrencyDescription}
        </p>
        <SelectCombobox
          value={baseCurrency}
          onValueChange={handleBaseCurrencyChange}
          options={currencyOptions}
          placeholder={t.selectCurrency}
          searchable={true}
        />
        <p className="mt-2 text-xs font-light text-gray-400 dark:text-gray-500">
          {t.baseCurrency}:{" "}
          <span className="font-light text-gray-900 dark:text-white">
            {currencyInfo.symbol} {currencyInfo.name}
          </span>
        </p>
      </div>

      {/* Idioma */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-light tracking-tight text-gray-900 dark:text-white mb-4 flex items-center">
          <Languages className="h-5 w-5 mr-2" />
          {t.language}
        </h2>
        <p className="text-sm font-light text-gray-500 dark:text-gray-400 mb-4">
          {t.languageDescription}
        </p>
        <SelectCombobox
          value={locale}
          onValueChange={handleLocaleChange}
          options={languageOptions}
          placeholder={t.selectLanguage}
          searchable={true}
        />
        <p className="mt-2 text-xs font-light text-gray-400 dark:text-gray-500">
          {t.language}:{" "}
          <span className="font-light text-gray-900 dark:text-white">
            {LANGUAGES.find((l) => l.code === locale)?.name || "Português"}
          </span>
        </p>
      </div>

      {/* País */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-light tracking-tight text-gray-900 dark:text-white mb-4 flex items-center">
          <Globe className="h-5 w-5 mr-2" />
          {t.country}
        </h2>
        <p className="text-sm font-light text-gray-500 dark:text-gray-400 mb-4">
          {t.onboardingStep3Description}
        </p>
        <SelectCombobox
          value={selectedCountry}
          onValueChange={handleCountryChange}
          options={countryOptions}
          placeholder={t.selectCountry}
          searchable={true}
        />
        <p className="mt-2 text-xs font-light text-gray-400 dark:text-gray-500">
          {t.country}:{" "}
          <span className="font-light text-gray-900 dark:text-white">
            {COUNTRIES.find((c) => c.code === selectedCountry)?.name || "-"}
          </span>
        </p>
      </div>

      {/* Reiniciar Onboarding */}
      <div className="bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-light tracking-tight text-gray-900 dark:text-white mb-4 flex items-center">
          <RefreshCcw className="h-5 w-5 mr-2 text-amber-500" />
          {t.restartOnboarding}
        </h2>
        <p className="text-sm font-light text-gray-500 dark:text-gray-400 mb-4">
          {t.restartOnboardingDescription}
        </p>
        <button
          onClick={handleRestartOnboarding}
          disabled={isRestartingOnboarding}
          className="inline-flex items-center px-4 py-2.5 text-sm font-light tracking-tight text-white bg-amber-500 dark:bg-amber-500 border border-amber-500 dark:border-amber-500 rounded-md hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRestartingOnboarding ? (
            <Check className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCcw className="h-4 w-4 mr-2" />
          )}
          {t.restartOnboardingButton}
        </button>
      </div>

      {/* Referrals / Convites */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-light tracking-tight text-gray-900 dark:text-white mb-4 flex items-center">
          <UserPlus className="h-5 w-5 mr-2" />
          {t.referralCount}
        </h2>
        <p className="text-sm font-light text-gray-500 dark:text-gray-400 mb-4">
          {t.referralCountDescription}
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-light text-gray-500 dark:text-gray-400 mb-2">
              {t.yourInviteLink}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={getInviteLink()}
                readOnly
                className="flex-1 block w-full px-3 py-2.5 border border-gray-200 dark:border-gray-800 rounded-md bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary-500 dark:focus:border-primary-500 text-sm font-light tracking-tight"
              />
              <button
                onClick={handleCopyInviteLink}
                className="inline-flex items-center px-3 py-2.5 border border-gray-200 dark:border-gray-800 rounded-md text-sm font-light tracking-tight text-gray-900 dark:text-white bg-white dark:bg-gray-900 hover:opacity-70 transition-opacity"
                aria-label={t.copyInviteLink}
              >
                {linkCopied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    {t.inviteLinkCopied}
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    {t.copyInviteLink}
                  </>
                )}
              </button>
            </div>
          </div>
          <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-300">
                  {t.referralCount}
                </p>
                <p className="text-xs font-light text-gray-400 dark:text-gray-500 mt-1">
                  {referralCount === 0
                    ? t.noReferralsYet
                    : `${referralCount} ${referralCount === 1 ? t.person : t.people
                    }`}
                </p>
              </div>
              <div className="text-3xl font-light tracking-tight text-primary-600 dark:text-primary-400">
                {referralCount}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Resetar Conta do Recta */}
      <div className="bg-white dark:bg-gray-900 border border-orange-200 dark:border-orange-800 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-light tracking-tight text-gray-900 dark:text-white mb-4 flex items-center">
          <RefreshCcw className="h-5 w-5 mr-2 text-orange-500" />
          {t.resetRectaAccount}
        </h2>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-light text-gray-500 dark:text-gray-400 mb-4">
              {t.resetRectaAccountDescription}
            </p>
            <button
              onClick={() => setIsResetAccountModalOpen(true)}
              className="inline-flex items-center px-4 py-2.5 text-sm font-light tracking-tight text-white bg-orange-500 dark:bg-orange-500 border border-orange-500 dark:border-orange-500 rounded-md hover:opacity-80 transition-opacity"
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              {t.resetRectaAccount}
            </button>
          </div>
        </div>
      </div>

      {/* Zona de Perigo - Deletar Conta */}
      <div className="bg-white dark:bg-gray-900 border border-red-200 dark:border-red-800 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-light tracking-tight text-gray-900 dark:text-white mb-4 flex items-center">
          <Trash2 className="h-5 w-5 mr-2 text-red-500" />
          {t.confirmDelete}
        </h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-300 mb-2">
              {t.deleteUserAccount}
            </h3>
            <p className="text-sm font-light text-gray-500 dark:text-gray-400 mb-4">
              {t.deleteUserAccountWarning}
            </p>
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="inline-flex items-center px-4 py-2.5 text-sm font-light tracking-tight text-white bg-red-500 dark:bg-red-500 border border-red-500 dark:border-red-500 rounded-md hover:opacity-80 transition-opacity"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t.delete}
            </button>
          </div>
        </div>
      </div>

      {/* Informações do App */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-light tracking-tight text-gray-900 dark:text-white mb-4 flex items-center">
          <Info className="h-5 w-5 mr-2" />
          {t.appInfo}
        </h2>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-light text-gray-500 dark:text-gray-400">
              {t.appVersion}:
            </span>
            <span className="text-sm font-light text-gray-900 dark:text-white">
              v{packageJson.version}
            </span>
          </div>
        </div>
      </div>

      {/* Modal de Resetar Conta */}
      <ResetAccountModal
        isOpen={isResetAccountModalOpen}
        onClose={() => setIsResetAccountModalOpen(false)}
        onConfirm={handleResetRectaAccount}
        isResetting={resetUserAccount.isPending}
      />

      {/* Modal de Deletar Conta */}
      <DeleteUserAccountModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteUserAccount}
        userEmail={currentUser?.email || user?.email || ""}
        isDeleting={deleteUserAccount.isPending}
      />
    </div>
  );
};

export default SettingsPage;
