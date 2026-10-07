import { createContext, useContext, useEffect, useState, ReactNode, useMemo, useCallback, useRef } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  User,
  sendEmailVerification
} from 'firebase/auth';
import { getFirebaseAuth } from '../config/firebase';
import { AuthContextType } from '../types';
import { analyticsHelpers } from '../utils/analytics';
import { useSyncAuth } from '../hooks/api/useAuth';
import { isNetworkError } from '../utils/api';
import { queryClient } from '../lib/queryClient';
import { clearUserFromLocalStorage } from '../hooks/api/useUsers';
import { clearHouseholdFromLocalStorage } from '../utils/householdStorage';
import { fetchAuthConfig, getCachedAuthMode, type AuthConfig, type AuthMode } from '../config/authMode';
import { clearLocalToken } from '../utils/localToken';
import {
  clearLocalSessionUser,
  localLogin,
  localRegister,
  readLocalSessionUser,
  type LocalSessionUser,
} from '../utils/localAuth';

/**
 * Verificar se está em período de manutenção
 * Deve usar a mesma lógica do useMaintenanceMode
 * Controlado pela variável de ambiente VITE_FLAG_MAINTENANCE
 */
const isMaintenanceMode = (): boolean => {
  const maintenanceFlag = import.meta.env.VITE_FLAG_MAINTENANCE;
  return maintenanceFlag === 'true' || maintenanceFlag === true;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = (): AuthContextType => useContext(AuthContext);

// Local mode keeps no Firebase session, so the signed-in user is a minimal { uid, email } stand-in for the
// Firebase User; only the fields the app reads in local mode are filled.
const toStandInUser = (user: LocalSessionUser): User => ({ uid: user.id, email: user.email }) as unknown as User;

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authMode, setAuthMode] = useState<AuthMode>(() => getCachedAuthMode() ?? 'firebase');
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean>(true);
  const authModeRef = useRef<AuthMode>(authMode);
  authModeRef.current = authMode;
  const syncAuth = useSyncAuth();
  const syncAuthRef = useRef(syncAuth);
  syncAuthRef.current = syncAuth;

  const localSession = useCallback((user: LocalSessionUser): User => {
    const standIn = toStandInUser(user);
    setCurrentUser(standIn);
    return standIn;
  }, []);

  const signup = useCallback(async (email: string, password: string, referralCode?: string) => {
    if (isMaintenanceMode()) {
      throw new Error('O aplicativo está em manutenção. Por favor, tente novamente mais tarde.');
    }
    if (authModeRef.current === 'local') {
      const user = localSession(await localRegister(email, password));
      analyticsHelpers.logSignup('email');
      return { user };
    }
    const result = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
    await sendEmailVerification(result.user);
    analyticsHelpers.logSignup('email');
    // Sincronizar com backend após criar usuário e processar referral code se fornecido
    try {
      await syncAuth.mutateAsync(referralCode);
    } catch (error) {
      // Log apenas como warning se for erro de rede (backend pode estar offline)
      if (isNetworkError(error)) {
        // Backend não disponível para sincronização
      } else {
        // Error syncing user with backend
      }
    }
    return result;
  }, [syncAuth, localSession]);

  const login = useCallback(async (email: string, password: string) => {
    if (isMaintenanceMode()) {
      throw new Error('O aplicativo está em manutenção. Por favor, tente novamente mais tarde.');
    }
    if (authModeRef.current === 'local') {
      const user = localSession(await localLogin(email, password));
      analyticsHelpers.logLogin('email');
      return { user };
    }
    const result = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
    analyticsHelpers.logLogin('email');
    // Sincronizar com backend após login
    try {
      await syncAuth.mutateAsync(undefined);
    } catch (error) {
      // Log apenas como warning se for erro de rede (backend pode estar offline)
      if (isNetworkError(error)) {
        // Backend não disponível para sincronização
      } else {
        // Error syncing user with backend
      }
    }
    return result;
  }, [syncAuth, localSession]);

  const loginWithGoogle = useCallback(async (referralCode?: string) => {
    if (isMaintenanceMode()) {
      throw new Error('O aplicativo está em manutenção. Por favor, tente novamente mais tarde.');
    }
    if (authModeRef.current === 'local') {
      // The login page hides the Google button in local mode; this only guards against a direct call.
      throw new Error('Google sign-in is not available when the backend runs AUTH_MODE=local');
    }
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(getFirebaseAuth(), provider);
    analyticsHelpers.logLogin('google');
    // Sincronizar com backend após login e processar referral code se fornecido
    try {
      await syncAuth.mutateAsync(referralCode);
    } catch (error) {
      // Log apenas como warning se for erro de rede (backend pode estar offline)
      if (isNetworkError(error)) {
        // Backend não disponível para sincronização
      } else {
        // Error syncing user with backend
      }
    }
    return result;
  }, [syncAuth]);

  const logout = useCallback(async () => {
    analyticsHelpers.logLogout();
    
    // Limpar cache do React Query PRIMEIRO (antes de limpar storage)
    try {
      queryClient.clear();
      queryClient.removeQueries();
      queryClient.resetQueries();
    } catch (error) {
      // Error clearing React Query cache
    }
    
    // Limpar dados específicos do usuário do localStorage
    try {
      clearUserFromLocalStorage();
      clearHouseholdFromLocalStorage();
    } catch (error) {
      // Error clearing user data from localStorage
    }
    
    // Explicit removal so the local session does not depend on the localStorage.clear() below
    clearLocalToken();
    clearLocalSessionUser();

    // Limpar todo o localStorage (após limpar dados específicos)
    try {
      localStorage.clear();
    } catch (error) {
      // Error clearing localStorage
    }
    
    // Limpar sessionStorage
    try {
      sessionStorage.clear();
    } catch (error) {
      // Error clearing sessionStorage
    }
    
    // Limpar cache do Service Worker (segurança)
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      } catch (error) {
        // Error clearing cache
      }
    }
    
    // Firebase signs out through onAuthStateChanged; a local session has no such event, so drop the user here
    if (authModeRef.current === 'local') {
      setCurrentUser(null);
    } else {
      await signOut(getFirebaseAuth());
    }
    
    // Forçar limpeza adicional do React Query após logout
    // Isso garante que nenhum dado fique em cache
    try {
      queryClient.clear();
      queryClient.cancelQueries();
    } catch (error) {
      // Error clearing React Query cache after logout
    }
  }, []);

  // The backend decides the mode (GET /auth/config); the cached value only covers the first render.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const config: AuthConfig = await fetchAuthConfig();
      if (!cancelled) {
        setAuthMode(config.authMode);
        setRegistrationEnabled(config.registrationEnabled);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Local mode has no Firebase session to observe: restore the stored user, if any.
    if (authMode === 'local') {
      const stored = readLocalSessionUser();
      setCurrentUser(stored ? toStandInUser(stored) : null);
      setLoading(false);
      return;
    }
    let isMounted = true;
    let syncInProgress = false;
    let lastSyncedUid: string | null = null;
    let syncTimeout: NodeJS.Timeout | null = null;
    let unsubscribe: () => void = () => {};
    try {
      unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (user: User | null) => {
      if (!isMounted) return;
      
      // Limpar timeout anterior se existir
      if (syncTimeout) {
        clearTimeout(syncTimeout);
        syncTimeout = null;
      }
      
      setCurrentUser(user);
      
      if (user) {
        // Só sincronizar se o UID mudou ou se ainda não sincronizamos
        const shouldSync = user.uid !== lastSyncedUid && !syncInProgress;
        
        if (shouldSync) {
          syncInProgress = true;
          lastSyncedUid = user.uid;
          
          // Usar timeout para evitar múltiplas chamadas rápidas
          syncTimeout = setTimeout(async () => {
            if (!isMounted || user.uid !== lastSyncedUid) {
              syncInProgress = false;
              return;
            }
            
            try {
              // Pequeno delay adicional para garantir que o token do Firebase esteja pronto
              await new Promise(resolve => setTimeout(resolve, 200));
              if (isMounted && user.uid === lastSyncedUid) {
                await syncAuthRef.current.mutateAsync(undefined);
              }
            } catch (error) {
              // Log apenas como warning se for erro de rede (backend pode estar offline)
              // Não resetar lastSyncedUid para erros de rede, permitindo retry automático
              if (isNetworkError(error)) {
                // Backend não disponível para sincronização
                // Resetar flag apenas para permitir nova tentativa após delay maior
                if (user.uid === lastSyncedUid) {
                  lastSyncedUid = null;
                }
              } else {
                // Error syncing user with backend
                // Resetar flag em caso de erro para permitir nova tentativa após delay
                if (user.uid === lastSyncedUid) {
                  lastSyncedUid = null;
                }
              }
            } finally {
              if (user.uid === lastSyncedUid) {
                syncInProgress = false;
              }
            }
          }, 500); // Delay de 500ms para evitar múltiplas chamadas
        }
      } else {
        // Resetar quando usuário faz logout
        lastSyncedUid = null;
        syncInProgress = false;
        if (syncTimeout) {
          clearTimeout(syncTimeout);
          syncTimeout = null;
        }
      }
      
      if (isMounted) {
        setLoading(false);
      }
    });
    } catch {
      // Firebase is not configured (the backend runs in firebase mode but VITE_FIREBASE_* is empty):
      // there is no session to observe, so release the UI without a user.
      if (isMounted) {
        setLoading(false);
      }
    }

    return () => {
      isMounted = false;
      if (syncTimeout) {
        clearTimeout(syncTimeout);
      }
      unsubscribe();
    };
  }, [authMode]); // Runs again once /auth/config resolves the mode

  const value: AuthContextType = useMemo(() => ({
    currentUser,
    authMode,
    registrationEnabled,
    signup,
    login,
    loginWithGoogle,
    logout,
  }), [currentUser, authMode, registrationEnabled, signup, login, loginWithGoogle, logout]);

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

