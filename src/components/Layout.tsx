import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import {
  Wallet,
  List,
  House,
  ChartPie,
  ArrowUpRight,
  Ellipsis,
  LogOut,
  Menu,
  X,
  LucideIcon,
  Target,
  Repeat,
  CreditCard,
  PiggyBank,
  User,
  Settings,
  MessageSquare,
  MessageCircle,
  Lightbulb,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import MobileBanner from "./MobileBanner";
import RectaMark from "./RectaMark";
import { OnboardingModal } from "./OnboardingModal";
import { VerificationModal } from "./VerificationModal";
import { FeedbackModal } from "./FeedbackModal";
import { useUser, useUpdateUserPreferences } from "../hooks/api/useUsers";
import { COMMUNITY_URL, FEEDBACK_BOARD_URL } from "../constants/links";
import { useCommandMenu } from "../context/CommandMenuContext";
import { HouseholdSelector } from "./HouseholdSelector";
import { InvitesNotification } from "./InvitesNotification";
import { InvitesModal } from "./InvitesModal";

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  external?: boolean;
}

const Layout = () => {
  const { logout, currentUser } = useAuth();
  const { t } = useI18n();
  const { setDisabled: setCommandMenuDisabled, registerHandler, unregisterHandler } = useCommandMenu();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState<boolean>(true);
  const [displayName, setDisplayName] = useState<string>("");
  const [showFeedbackModal, setShowFeedbackModal] = useState<boolean>(false);
  const [selectedInviteId, setSelectedInviteId] = useState<string | null>(null);

  const handleLogout = useCallback(async (): Promise<void> => {
    await logout();
    navigate("/login");
  }, [logout, navigate]);

  const { data: user } = useUser();
  const updatePreferences = useUpdateUserPreferences();
  
  const updatePreferencesRef = useRef(updatePreferences);
  updatePreferencesRef.current = updatePreferences;
  
  const handleRestartOnboarding = useCallback(async () => {
    if (!currentUser) return;
    try {
      await updatePreferencesRef.current.mutateAsync({
        onboardingCompleted: false,
        onboardingRestartedAt: new Date().toISOString(),
      });
    } catch (error) {
      // Error restarting onboarding
    }
  }, [currentUser]);

  // Sincronizar o estado do CMDK com o onboarding
  useEffect(() => {
    setCommandMenuDisabled(showOnboarding);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showOnboarding]); // setCommandMenuDisabled deve ser estável

  // Registrar handlers do CMDK - usar ref para evitar re-registros
  const handleRestartOnboardingRef = useRef(handleRestartOnboarding);
  handleRestartOnboardingRef.current = handleRestartOnboarding;
  
  useEffect(() => {
    const handler = () => handleRestartOnboardingRef.current();
    registerHandler('restartOnboarding', handler);
    return () => unregisterHandler('restartOnboarding');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Só registrar uma vez

  // Usar refs para rastrear valores anteriores e evitar loops
  const prevUserRef = useRef<typeof user>();
  const prevCurrentUserRef = useRef<typeof currentUser>();
  const hasInitializedRef = useRef(false);

  // Verificar se precisa mostrar onboarding e carregar displayName
  useEffect(() => {
    if (!currentUser) {
      if (hasInitializedRef.current) return; // Já foi inicializado, não fazer nada
      setCheckingOnboarding(false);
      setDisplayName("");
      setShowOnboarding(false);
      hasInitializedRef.current = true;
      return;
    }

    // Verificar se user realmente mudou (comparando IDs)
    const userChanged = user?.id !== prevUserRef.current?.id;
    const currentUserChanged = currentUser?.uid !== prevCurrentUserRef.current?.uid;
    // Verificar se onboardingCompleted mudou (importante para refazer onboarding)
    const onboardingStatusChanged = user?.onboardingCompleted !== prevUserRef.current?.onboardingCompleted;
    
    if (!currentUserChanged && !userChanged && !onboardingStatusChanged && hasInitializedRef.current) {
      return; // Nada mudou, não fazer nada
    }

    // Atualizar refs
    prevUserRef.current = user;
    prevCurrentUserRef.current = currentUser;

    if (user) {
      // Carregar displayName
      const newDisplayName = user.displayName || "";
      setDisplayName(newDisplayName);
      
      // Mostrar onboarding se não estiver completado
      setShowOnboarding(!user.onboardingCompleted);
      setCheckingOnboarding(false);
    } else {
      // Se não há dados do usuário ainda, aguardar
      if (!hasInitializedRef.current) {
        setCheckingOnboarding(false);
      }
    }
    
    hasInitializedRef.current = true;
  }, [currentUser, user, user?.onboardingCompleted]); // Adicionar user?.onboardingCompleted como dependência

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
  };

  const navItems: NavItem[] = [
    { path: "/app", label: t.dashboard, icon: House },
    { path: "/app/transactions", label: t.transactions, icon: List },
    { path: "/app/accounts", label: t.accounts, icon: Wallet },
    { path: "/app/credit-cards", label: `${t.creditCards}`, icon: CreditCard },
    { path: "/app/recurring", label: t.recurring, icon: Repeat },
    { path: "/app/goals", label: t.goals, icon: PiggyBank },
    { path: "/app/budgets", label: t.budgets, icon: Target },
    { path: "/app/reports", label: t.reports, icon: ChartPie },
    { path: "/app/settings", label: t.settings, icon: Settings },
  ];

  const externalItems: NavItem[] = [
    { path: COMMUNITY_URL, label: t.community, icon: MessageSquare, external: true },
    { path: FEEDBACK_BOARD_URL, label: t.feedbackBoardNav, icon: Lightbulb, external: true },
  ];

  // Phone tab bar (like the iOS tab bar): the most used destinations plus "More", which opens the full menu.
  const tabItems: NavItem[] = [
    { path: "/app", label: t.tabHome, icon: House },
    { path: "/app/transactions", label: t.transactions, icon: List },
    { path: "/app/accounts", label: t.tabAccounts, icon: Wallet },
    { path: "/app/credit-cards", label: t.tabCards, icon: CreditCard },
  ];

  const userName = displayName || currentUser?.email?.split("@")[0] || t.user;
  const userInitial = userName.trim().charAt(0).toUpperCase() || "?";

  const navItemClass = (isActive: boolean) =>
    `group flex items-center gap-3 h-10 rounded-lg text-[15px] transition-colors duration-150 ${
      sidebarCollapsed ? "justify-center px-0" : "px-3"
    } ${
      isActive
        ? "bg-brand-soft text-brand-on-soft font-semibold"
        : "text-content-secondary hover:bg-surface-sunken hover:text-content"
    }`;

  return (
    <div className="h-screen bg-surface flex overflow-hidden">
      {/* Sidebar */}
      <aside
        aria-label={t.landingNavAriaLabel || "Navegação principal"}
        className={`
          fixed inset-y-0 left-0 z-50 bg-surface-elevated border-r border-line-subtle transform transition-[transform,width] duration-300 ease-in-out h-screen
          ${sidebarCollapsed ? 'w-20' : 'w-64'}
          xl:translate-x-0
          ${sidebarOpen ? "translate-x-0 shadow-floating" : "-translate-x-full"}
        `}
      >
        <div className="flex flex-col h-screen">
          {/* Logo */}
          <div className={`flex items-center justify-between h-16 flex-shrink-0 ${sidebarCollapsed ? 'px-3' : 'px-5'}`}>
            <Link
              to="/home"
              className={`mark-hover flex items-center gap-2.5 hover:opacity-80 transition-opacity ${sidebarCollapsed ? 'mx-auto' : ''}`}
            >
              <RectaMark className="h-6 w-auto text-content" />
              {!sidebarCollapsed && (
                <span className="font-rounded text-lg font-semibold text-content">{t.appNameWithBeta}</span>
              )}
            </Link>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              aria-label={sidebarCollapsed ? "Expandir menu" : "Colapsar menu"}
              title={sidebarCollapsed ? "Expandir menu" : "Colapsar menu"}
              className={`hidden xl:flex h-8 w-8 items-center justify-center rounded-lg text-content-tertiary hover:bg-surface-sunken hover:text-content transition-colors ${sidebarCollapsed ? 'absolute -right-4 top-4 bg-surface-elevated border border-line-subtle shadow-card' : ''}`}
            >
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              aria-label={t.closeMenu}
              className="xl:hidden flex h-9 w-9 items-center justify-center rounded-full bg-surface-sunken text-content-secondary hover:text-content transition-colors"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {/* Navigation */}
          <nav className={`flex-1 pt-2 pb-4 overflow-y-auto ${sidebarCollapsed ? 'px-3' : 'px-3'}`}>
            <div className="space-y-0.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={navItemClass(isActive)}
                    title={sidebarCollapsed ? item.label : undefined}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon
                      aria-hidden="true"
                      strokeWidth={isActive ? 2.25 : 1.9}
                      className={`h-5 w-5 flex-shrink-0 ${isActive ? "text-brand" : "text-content-tertiary group-hover:text-content-secondary"}`}
                    />
                    {sidebarCollapsed ? <span className="sr-only">{item.label}</span> : item.label}
                  </Link>
                );
              })}
            </div>

            <div className="my-3 mx-3 border-t border-line-subtle" />

            <div className="space-y-0.5">
              {externalItems.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.path}
                    href={item.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setSidebarOpen(false)}
                    className={navItemClass(false)}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <Icon aria-hidden="true" strokeWidth={1.9} className="h-5 w-5 flex-shrink-0 text-content-tertiary group-hover:text-content-secondary" />
                    {sidebarCollapsed ? <span className="sr-only">{item.label}</span> : (
                      <span className="flex-1 truncate">{item.label}</span>
                    )}
                    {!sidebarCollapsed && <ArrowUpRight className="h-3.5 w-3.5 text-content-tertiary" aria-hidden="true" />}
                    <span className="sr-only"> {t.feedbackBoardOpensInNewTab}</span>
                  </a>
                );
              })}

              {/* Feedback Button */}
              <button
                onClick={() => {
                  setShowFeedbackModal(true);
                  setSidebarOpen(false);
                }}
                className={`${navItemClass(false)} w-full !text-brand-on-soft hover:!bg-brand-soft`}
                title={sidebarCollapsed ? t.giveFeedback : undefined}
              >
                <MessageCircle className="h-5 w-5 flex-shrink-0 text-brand" strokeWidth={2} aria-hidden="true" />
                {sidebarCollapsed ? <span className="sr-only">{t.giveFeedback}</span> : <span className="font-semibold">{t.giveFeedback}</span>}
              </button>
            </div>
          </nav>

          {/* User Section */}
          <div
            className={`border-t border-line-subtle flex-shrink-0 ${sidebarCollapsed ? 'p-3' : 'p-4'} xl:pb-4`}
            style={{
              paddingBottom: 'max(1rem, calc(0.75rem + env(safe-area-inset-bottom, 0px)))'
            }}
          >
            {/* Household Selector */}
            <div className="mb-3">
              <HouseholdSelector collapsed={sidebarCollapsed} />
            </div>

            <div className={`flex items-center ${sidebarCollapsed ? 'flex-col gap-2' : 'gap-3'}`}>
              <div
                className="h-10 w-10 flex-shrink-0 rounded-full bg-gradient-to-br from-[#6D4CFF] to-[#4A2EE0] flex items-center justify-center font-rounded text-base font-semibold text-white"
                aria-hidden="true"
                title={sidebarCollapsed ? userName : undefined}
              >
                {userInitial || <User className="h-5 w-5" />}
              </div>
              {!sidebarCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-content truncate">{userName}</p>
                  <p className="text-xs text-content-tertiary truncate">{currentUser?.email || ""}</p>
                </div>
              )}
              <button
                onClick={handleLogout}
                aria-label={t.logout}
                title={t.logout}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-content-tertiary hover:bg-negative-soft hover:text-negative transition-colors"
              >
                <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40 xl:hidden animate-modal-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main Content */}
      <div className={`flex-1 flex flex-col overflow-hidden transition-[margin] duration-300 ${sidebarCollapsed ? 'xl:ml-20' : 'xl:ml-64'}`}>
        {/* Top bar: menu on phones, notifications everywhere */}
        <header className="bg-surface/80 backdrop-blur-md border-b border-line-subtle xl:border-transparent flex-shrink-0">
          <div className="flex items-center justify-between h-14 px-3 xl:px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label={t.openMenu}
              aria-expanded={sidebarOpen}
              className="xl:hidden flex h-10 w-10 items-center justify-center rounded-lg text-content hover:bg-surface-sunken transition-colors"
            >
              <Menu className="h-6 w-6" aria-hidden="true" />
            </button>
            <div className="hidden xl:block" />

            <div className="flex items-center">
              <InvitesNotification
                onInviteClick={(inviteId) => setSelectedInviteId(inviteId)}
              />
            </div>
          </div>
        </header>

        {/* Cmd+K Hint - Hidden during onboarding */}
        {!showOnboarding && (
          <div className="hidden xl:block fixed bottom-4 right-4 z-30">
            <div className="bg-surface-elevated/90 backdrop-blur border border-line-subtle rounded-lg px-2.5 py-1.5 shadow-card flex items-center gap-1.5 text-xs text-content-tertiary">
              <kbd className="min-w-[22px] px-1.5 py-0.5 bg-surface-sunken rounded text-xs font-sans font-semibold text-content-secondary text-center">
                {navigator.platform.toLowerCase().includes("mac") ? "⌘" : "Ctrl"}
              </kbd>
              <kbd className="min-w-[22px] px-1.5 py-0.5 bg-surface-sunken rounded text-xs font-sans font-semibold text-content-secondary text-center">
                K
              </kbd>
            </div>
          </div>
        )}

        {/* Page Content */}
        <main id="main-content" className="flex-1 overflow-y-auto" role="main">
          <div className="max-w-7xl mx-auto pt-4 pb-28 xl:py-8 px-4 sm:px-6 xl:px-8">
            <Outlet />
          </div>
        </main>

        {/* Mobile Banner */}
        <MobileBanner />

        {/* Tab bar (phones and tablets) */}
        <nav
          aria-label={t.landingNavAriaLabel || "Navegação principal"}
          className="xl:hidden fixed inset-x-0 bottom-0 z-40 border-t border-line-subtle bg-surface-elevated/85 backdrop-blur-xl"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className="mx-auto flex max-w-lg items-stretch justify-around px-2">
            {tabItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex flex-1 flex-col items-center justify-center gap-0.5 pt-2 pb-1.5 min-h-[56px] text-[11px] font-medium transition-colors ${
                    isActive ? "text-brand" : "text-content-tertiary hover:text-content-secondary"
                  }`}
                >
                  <Icon className="h-6 w-6" strokeWidth={isActive ? 2.25 : 1.9} aria-hidden="true" />
                  <span className="max-w-full truncate px-1">{item.label}</span>
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-expanded={sidebarOpen}
              className="flex flex-1 flex-col items-center justify-center gap-0.5 pt-2 pb-1.5 min-h-[56px] text-[11px] font-medium text-content-tertiary hover:text-content-secondary transition-colors"
            >
              <Ellipsis className="h-6 w-6" strokeWidth={1.9} aria-hidden="true" />
              <span>{t.more}</span>
            </button>
          </div>
        </nav>
      </div>

      {/* Onboarding Modal */}
      {!checkingOnboarding && (
        <OnboardingModal
          isOpen={showOnboarding}
          onComplete={handleOnboardingComplete}
        />
      )}

      {/* Verification Modal */}
      <VerificationModal />

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
      />

      {/* Invites Modal - Opens when clicking on a notification */}
      <InvitesModal
        isOpen={!!selectedInviteId}
        onClose={() => setSelectedInviteId(null)}
        selectedInviteId={selectedInviteId}
      />
    </div>
  );
};

export default Layout;
