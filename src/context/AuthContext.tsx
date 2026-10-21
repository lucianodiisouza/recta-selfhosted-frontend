import { createContext, useContext, useEffect, useState, ReactNode, useMemo, useCallback, useRef } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  User,
  sendEmailVerification
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { AuthContextType } from '../types';
import { analyticsHelpers } from '../utils/analytics';
import { useSyncAuth } from '../hooks/api/useAuth';
import { isNetworkError } from '../utils/api';
import { queryClient } from '../lib/queryClient';
import { clearUserFromLocalStorage } from '../hooks/api/useUsers';
import { clearHouseholdFromLocalStorage } from '../utils/householdStorage';

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

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const syncAuth = useSyncAuth();
  const syncAuthRef = useRef(syncAuth);
  syncAuthRef.current = syncAuth;

  const signup = useCallback(async (email: string, password: string, referralCode?: string) => {
    if (isMaintenanceMode()) {
      throw new Error('O aplicativo está em manutenção. Por favor, tente novamente mais tarde.');
    }
    const result = await createUserWithEmailAndPassword(auth, email, password);
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
  }, [syncAuth]);

  const login = useCallback(async (email: string, password: string) => {
    if (isMaintenanceMode()) {
      throw new Error('O aplicativo está em manutenção. Por favor, tente novamente mais tarde.');
    }
    const result = await signInWithEmailAndPassword(auth, email, password);
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
  }, [syncAuth]);

  const loginWithGoogle = useCallback(async (referralCode?: string) => {
    if (isMaintenanceMode()) {
      throw new Error('O aplicativo está em manutenção. Por favor, tente novamente mais tarde.');
    }
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
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

  // Same Firebase provider as the iOS app ("apple.com"), so the account is the same everywhere.
  const loginWithApple = useCallback(async (referralCode?: string) => {
    if (isMaintenanceMode()) {
      throw new Error('O aplicativo está em manutenção. Por favor, tente novamente mais tarde.');
    }
    const provider = new OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');
    provider.setCustomParameters({ locale: document.documentElement.lang || 'pt_BR' });
    const result = await signInWithPopup(auth, provider);
    analyticsHelpers.logLogin('apple');
    try {
      await syncAuth.mutateAsync(referralCode);
    } catch (error) {
      // Backend indisponível: o login no Firebase vale mesmo assim, igual ao Google.
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
    
    // Fazer logout do Firebase
    await signOut(auth);
    
    // Forçar limpeza adicional do React Query após logout
    // Isso garante que nenhum dado fique em cache
    try {
      queryClient.clear();
      queryClient.cancelQueries();
    } catch (error) {
      // Error clearing React Query cache after logout
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    let syncInProgress = false;
    let lastSyncedUid: string | null = null;
    let syncTimeout: NodeJS.Timeout | null = null;
    
    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
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

    return () => {
      isMounted = false;
      if (syncTimeout) {
        clearTimeout(syncTimeout);
      }
      unsubscribe();
    };
  }, []); // Remover syncAuth da dependência para evitar loops

  const value: AuthContextType = useMemo(() => ({
    currentUser,
    signup,
    login,
    loginWithGoogle,
    loginWithApple,
    logout,
  }), [currentUser, signup, login, loginWithGoogle, loginWithApple, logout]);

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

