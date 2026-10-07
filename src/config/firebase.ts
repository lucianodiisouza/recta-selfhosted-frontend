import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getAnalytics, Analytics, isSupported } from 'firebase/analytics';

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

function readFirebaseConfig(): FirebaseConfig | null {
  const env = import.meta.env;
  const apiKey = env.VITE_FIREBASE_API_KEY;
  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN;
  const projectId = env.VITE_FIREBASE_PROJECT_ID;
  const storageBucket = env.VITE_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = env.VITE_FIREBASE_MESSAGING_SENDER_ID;
  const appId = env.VITE_FIREBASE_APP_ID;

  if (
    !apiKey ||
    !authDomain ||
    !projectId ||
    !storageBucket ||
    !messagingSenderId ||
    !appId
  ) {
    return null;
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
  };
}

function missingFirebaseError(): Error {
  return new Error(
    'Firebase is not configured. Set the VITE_FIREBASE_* variables, or run the backend with AUTH_MODE=local.'
  );
}

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let analyticsInstance: Analytics | null = null;
let analyticsInitStarted = false;

// Helper para verificar se está em localhost
const isLocalhost = () => {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'localhost' ||
         window.location.hostname === '127.0.0.1' ||
         window.location.hostname === '[::1]';
};

export function getFirebaseApp(): FirebaseApp {
  if (app) return app;
  const config = readFirebaseConfig();
  if (!config) throw missingFirebaseError();
  app = initializeApp(config);
  return app;
}

export function getFirebaseAuth(): Auth {
  if (authInstance) return authInstance;
  authInstance = getAuth(getFirebaseApp());
  return authInstance;
}

// Analytics starts on first use and only outside localhost (isSupported() is async).
// Returns the cached instance, or null until it resolves.
export function getFirebaseAnalytics(): Analytics | null {
  if (analyticsInstance) return analyticsInstance;
  if (analyticsInitStarted) return null;
  if (typeof window === 'undefined' || isLocalhost()) return null;
  analyticsInitStarted = true;
  const firebaseApp = getFirebaseApp();
  isSupported().then((supported: boolean) => {
    if (supported) {
      analyticsInstance = getAnalytics(firebaseApp);
    }
  });
  return null;
}
