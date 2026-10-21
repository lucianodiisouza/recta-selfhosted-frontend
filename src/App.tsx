import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { lazy, Suspense, ReactNode, Component, ErrorInfo, ReactElement } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TransactionsProvider } from './context/TransactionsContext';
import { ToastProvider } from './context/ToastContext';
import { CommandMenuProvider } from './context/CommandMenuContext';
import { ConfettiProvider } from './context/ConfettiContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { I18nProvider } from './context/I18nContext';
import { ThemeProvider } from './context/ThemeContext';
import { DemoBlurProvider } from './context/DemoBlurContext';
import { AppLockProvider } from './context/AppLockContext';
import { AppLockGate } from './components/AppLockScreen';
import { queryClient } from './lib/queryClient';
import Layout from './components/Layout';
import { AnalyticsTracker } from './components/AnalyticsTracker';
import { RouteMeta } from './seo/RouteMeta';
import { LoadingSpinner } from './components/LoadingSpinner';
import { VersionUpdatePrompt } from './components/VersionUpdatePrompt';
// import { InstallPrompt } from './components/InstallPrompt'; // Desativado temporariamente
import { MaintenanceModal } from './components/MaintenanceModal';
import { useMaintenanceMode } from './hooks/useMaintenanceMode';
import { postLoginPath } from './utils/pendingJoin';

// Lazy load pages for better code splitting and initial bundle size
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Login = lazy(() => import('./pages/Login'));
const JoinHousehold = lazy(() => import('./pages/JoinHousehold'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
// Design system catalog, development builds only.
const UiGallery = import.meta.env.DEV ? lazy(() => import('./pages/dev/UiGallery')) : null;
const Transactions = lazy(() => import('./pages/Transactions'));
const Reports = lazy(() => import('./pages/Reports'));
const Budgets = lazy(() => import('./pages/Budgets'));
const RecurringTransactions = lazy(() => import('./pages/RecurringTransactions'));
const Accounts = lazy(() => import('./pages/Accounts'));
const SavingsGoals = lazy(() => import('./pages/SavingsGoals'));
const CreditCards = lazy(() => import('./pages/CreditCards'));
const Settings = lazy(() => import('./pages/Settings'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const Support = lazy(() => import('./pages/Support'));

interface PrivateRouteProps {
  children: ReactNode;
}

const PrivateRoute = ({ children }: PrivateRouteProps) => {
  const { currentUser } = useAuth();
  return currentUser ? <>{children}</> : <Navigate to="/login" />;
};

const PublicRoute = ({ children }: PrivateRouteProps) => {
  const { currentUser } = useAuth();
  return !currentUser ? <>{children}</> : <Navigate to={postLoginPath()} />;
};

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <LoadingSpinner />
  </div>
);

// Error fallback for lazy loaded modules
const LazyLoadErrorFallback = ({ error, retry }: { error: Error; retry: () => void }) => {
  const isChunkError = 
    error.message?.includes('Failed to fetch dynamically imported module') ||
    error.message?.includes('Loading chunk') ||
    error.message?.includes('Load chunk') ||
    error.message?.includes('text/html');

  if (isChunkError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="max-w-md w-full bg-surface-elevated rounded-lg shadow-lg p-6 text-center">
          <h2 className="text-xl font-bold text-content mb-4">
            Nova versão disponível
          </h2>
          <p className="text-content-secondary mb-6">
            Uma nova versão do aplicativo está disponível. Por favor, recarregue a página para continuar.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            Recarregar página
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="max-w-md w-full bg-surface-elevated rounded-lg shadow-lg p-6 text-center">
        <h2 className="text-xl font-bold text-content mb-4">
          Erro ao carregar página
        </h2>
        <p className="text-content-secondary mb-6">
          Ocorreu um erro ao carregar esta página. Tente novamente.
        </p>
        <button
          onClick={retry}
          className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
};

// Error Boundary for lazy loaded modules
class LazyLoadErrorBoundary extends Component<
  { children: ReactNode; fallback?: (error: Error, retry: () => void) => ReactElement },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode; fallback?: (error: Error, retry: () => void) => ReactElement }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
    // Lazy load error
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }
      return <LazyLoadErrorFallback error={this.state.error} retry={this.handleRetry} />;
    }

    return this.props.children;
  }
}

const LandingRoute = () => {
  const { currentUser } = useAuth();
  if (currentUser) {
    return <Navigate to="/app" replace />;
  }
  return <LandingPage />;
};

// Legacy route redirect component that preserves query strings
const LegacyRouteRedirect = ({ to }: { to: string }) => {
  const location = useLocation();
  const search = location.search;
  return <Navigate to={`${to}${search}`} replace />;
};

// Wrapper component for private routes that need TransactionsProvider
const PrivateRoutesWrapper = ({ children }: { children: ReactNode }) => {
  return (
    <TransactionsProvider>
      {children}
    </TransactionsProvider>
  );
};

function AppRoutes() {
  const { isMaintenanceMode, endTime } = useMaintenanceMode();
  const location = useLocation();

  // Se estiver em manutenção, mostrar o modal apenas em login e rotas autenticadas (não na landing page)
  const isLandingPage = location.pathname === '/' || location.pathname === '/home';
  if (isMaintenanceMode && !isLandingPage) {
    return <MaintenanceModal endTime={endTime} />;
  }

  return (
    <>
      <AnalyticsTracker />
      <RouteMeta />
      <VersionUpdatePrompt />
      {/* InstallPrompt desativado temporariamente */}
      {/* <InstallPrompt /> */}
      <LazyLoadErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/join/:code" element={<JoinHousehold />} />
          {/* Landing page route - always accessible, even when logged in */}
          <Route path="/home" element={<LandingPage />} />
          <Route path="/" element={<LandingRoute />} />
          {/* Legal and support pages - always accessible */}
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/support" element={<Support />} />
          {/* Legacy route redirects - redirect old routes to new /app/* routes (preserves query strings) */}
          <Route path="/transactions" element={<LegacyRouteRedirect to="/app/transactions" />} />
          <Route path="/budgets" element={<LegacyRouteRedirect to="/app/budgets" />} />
          <Route path="/recurring" element={<LegacyRouteRedirect to="/app/recurring" />} />
          <Route path="/accounts" element={<LegacyRouteRedirect to="/app/accounts" />} />
          <Route path="/goals" element={<LegacyRouteRedirect to="/app/goals" />} />
          <Route path="/reports" element={<LegacyRouteRedirect to="/app/reports" />} />
          <Route path="/settings" element={<LegacyRouteRedirect to="/app/settings" />} />
          <Route
            path="/app"
            element={
              <PrivateRoute>
                {/* App lock (fdbk #110): while locked, nothing below mounts */}
                <AppLockGate>
                  <PrivateRoutesWrapper>
                    <Layout />
                  </PrivateRoutesWrapper>
                </AppLockGate>
              </PrivateRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="budgets" element={<Budgets />} />
            <Route path="recurring" element={<RecurringTransactions />} />
            <Route path="accounts" element={<Accounts />} />
            <Route path="credit-cards" element={<CreditCards />} />
            <Route path="goals" element={<SavingsGoals />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
            {UiGallery && <Route path="dev/ui" element={<UiGallery />} />}
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      </LazyLoadErrorBoundary>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <AppLockProvider>
            <ThemeProvider>
              <ToastProvider>
                <I18nProvider>
                  <CurrencyProvider>
                    <DemoBlurProvider>
                      <CommandMenuProvider>
                        <ConfettiProvider>
                          <AppRoutes />
                        </ConfettiProvider>
                      </CommandMenuProvider>
                    </DemoBlurProvider>
                  </CurrencyProvider>
                </I18nProvider>
              </ToastProvider>
            </ThemeProvider>
          </AppLockProvider>
        </AuthProvider>
      </Router>
      {/* React Query DevTools - só aparece em desenvolvimento */}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

export default App;

