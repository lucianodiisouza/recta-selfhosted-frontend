import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import {
  Wallet,
  List,
  BarChart3,
  LogOut,
  Menu,
  X,
  LucideIcon,
  Target,
  Repeat,
  CreditCard,
  PiggyBank,
  Users,
  User,
  Settings,
  MessageSquare,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import MobileBanner from "./MobileBanner";
import { OnboardingModal } from "./OnboardingModal";
import { VerificationModal } from "./VerificationModal";
import { FeedbackModal } from "./FeedbackModal";
import { useUser, useUpdateUserPreferences } from "../hooks/api/useUsers";
import { useCommandMenu } from "../context/CommandMenuContext";
import { HouseholdSelector } from "./HouseholdSelector";
import { usePeopleAvailable } from "../utils/peopleAvailability";
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
  const peopleAvailable = usePeopleAvailable();
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
    { path: "/app", label: t.dashboard, icon: BarChart3 },
    { path: "/app/transactions", label: t.transactions, icon: List },
    { path: "/app/accounts", label: t.accounts, icon: Wallet },
    { path: "/app/credit-cards", label: `${t.creditCards}`, icon: CreditCard },
    { path: "/app/recurring", label: t.recurring, icon: Repeat },
    { path: "/app/goals", label: t.goals, icon: PiggyBank },
    ...(peopleAvailable ? [{ path: "/app/people", label: t.peoplePage, icon: Users }] : []),
    { path: "/app/budgets", label: t.budgets, icon: Target },
    { path: "/app/reports", label: t.reports, icon: Wallet },
    { path: "/app/settings", label: t.settings, icon: Settings },
    { path: "https://www.reddit.com/r/RectaApp/", label: t.community, icon: MessageSquare, external: true },
  ];

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex overflow-hidden">
      {/* Sidebar */}
      <aside
        aria-label={t.landingNavAriaLabel || "Navegação principal"}
        className={`
          fixed inset-y-0 left-0 z-50 bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-800 transform transition-all duration-300 ease-in-out h-screen
          ${sidebarCollapsed ? 'w-20' : 'w-64'}
          xl:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex flex-col h-screen">
          {/* Logo */}
          <div className={`flex items-center justify-between h-16 border-b border-gray-100 dark:border-gray-800 ${sidebarCollapsed ? 'px-4' : 'px-6'}`}>
            {!sidebarCollapsed && (
              <Link to="/home" className="flex items-center hover:opacity-80 transition-opacity">
                <Wallet className="h-8 w-8 text-primary-600" />
                <span className="ml-2 text-xl font-light text-gray-900 dark:text-white">{t.appNameWithBeta}</span>
              </Link>
            )}
            {sidebarCollapsed && (
              <Link to="/home" className="flex items-center justify-center hover:opacity-80 transition-opacity">
                <Wallet className="h-8 w-8 text-primary-600" />
              </Link>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                aria-label={sidebarCollapsed ? "Expandir menu" : "Colapsar menu"}
                className="hidden xl:flex text-gray-400 dark:text-gray-500 hover:opacity-70 transition-opacity p-1.5"
                title={sidebarCollapsed ? "Expandir menu" : "Colapsar menu"}
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={() => setSidebarOpen(false)}
                aria-label={t.closeMenu}
                className="xl:hidden text-gray-900 dark:text-white hover:opacity-70 transition-opacity p-2"
              >
                <X className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className={`flex-1 py-6 space-y-1 overflow-y-auto ${sidebarCollapsed ? 'px-2' : 'px-4'}`}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = !item.external && location.pathname === item.path;
              const className = `
                flex items-center text-sm font-light tracking-tight rounded-lg transition-opacity
                ${sidebarCollapsed ? 'justify-center px-2 py-3' : 'px-4 py-3'}
                ${
                  isActive
                    ? "text-primary-600 dark:text-primary-400 border-l border-primary-600 dark:border-primary-400"
                    : "text-gray-600 dark:text-gray-400 hover:opacity-70"
                }
              `;
              
              if (item.external) {
                return (
                  <a
                    key={item.path}
                    href={item.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setSidebarOpen(false)}
                    className={className}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <Icon
                      className={`h-5 w-5 ${sidebarCollapsed ? '' : 'mr-3'} text-gray-400`}
                    />
                    {!sidebarCollapsed && item.label}
                  </a>
                );
              }
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={className}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <Icon
                    className={`h-5 w-5 ${sidebarCollapsed ? '' : 'mr-3'} ${
                      isActive ? "text-primary-600" : "text-gray-400"
                    }`}
                  />
                  {!sidebarCollapsed && item.label}
                </Link>
              );
            })}
            
            {/* Feedback Button */}
            <button
              onClick={() => {
                setShowFeedbackModal(true);
                setSidebarOpen(false);
              }}
              className={`flex items-center text-sm font-medium rounded-lg transition-all duration-300 bg-purple-lighter dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-light dark:hover:bg-purple-900/50 hover:text-purple-800 dark:hover:text-purple-200 w-full animate-bounce-soft shadow-sm hover:shadow-md ${sidebarCollapsed ? 'justify-center px-2 py-3' : 'px-4 py-3'}`}
              title={sidebarCollapsed ? t.giveFeedback : undefined}
            >
              <MessageCircle className={`h-5 w-5 ${sidebarCollapsed ? '' : 'mr-3'} text-purple-600 dark:text-purple-400`} />
              {!sidebarCollapsed && t.giveFeedback}
            </button>
          </nav>

          {/* User Section */}
          <div 
            className={`border-t border-gray-100 dark:border-gray-800 flex-shrink-0 ${sidebarCollapsed ? 'p-2' : 'p-4'} xl:pb-4`}
            style={{ 
              paddingBottom: 'max(2rem, calc(1.5rem + env(safe-area-inset-bottom, 0px) + 20px))'
            }}
          >
            {/* Household Selector */}
            <div className="mb-3">
              <HouseholdSelector collapsed={sidebarCollapsed} />
            </div>

            {!sidebarCollapsed && (
              <div className="flex items-center mb-3">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                  </div>
                </div>
                <div className="ml-3 flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {displayName || currentUser?.email?.split("@")[0] || t.user}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {currentUser?.email || ""}
                  </p>
                </div>
              </div>
            )}
            {sidebarCollapsed && (
              <div className="flex justify-center mb-3">
                <div className="h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                </div>
              </div>
            )}
            <button
              onClick={handleLogout}
              aria-label={t.logout}
              className={`w-full flex items-center justify-center text-sm font-light tracking-tight text-white bg-primary-600 dark:bg-primary-500 border border-primary-600 dark:border-primary-500 rounded-md hover:opacity-80 transition-opacity ${sidebarCollapsed ? 'px-2 py-2.5' : 'px-4 py-2.5'}`}
              title={sidebarCollapsed ? t.logout : undefined}
            >
              <LogOut className={`h-4 w-4 ${sidebarCollapsed ? '' : 'mr-2'}`} aria-hidden="true" />
              {!sidebarCollapsed && t.logout}
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-75 z-40 xl:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main Content */}
      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'xl:ml-20' : 'xl:ml-64'}`}>
        {/* Top Navbar - Always visible */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <div className="flex items-center justify-between h-16 px-4 xl:px-6">
            {/* Left side - Menu button (mobile) */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(true)}
                aria-label={t.openMenu}
                aria-expanded={sidebarOpen}
                className="xl:hidden text-gray-900 dark:text-white hover:opacity-70 transition-opacity p-2"
              >
                <Menu className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>

            {/* Right side - Notifications */}
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
            <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 shadow-md flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono text-gray-900 dark:text-gray-100">
                {navigator.platform.toLowerCase().includes("mac") ? "⌘" : "Ctrl"}
              </kbd>
              <span>+</span>
              <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono text-gray-900 dark:text-gray-100">
                K
              </kbd>
            </div>
          </div>
        )}

        {/* Page Content */}
        <main id="main-content" className="flex-1 overflow-y-auto" role="main">
          <div className="max-w-7xl mx-auto py-8 px-5 sm:px-6 xl:px-8">
            <Outlet />
          </div>
        </main>
        
        {/* Mobile Banner */}
        <MobileBanner />
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
