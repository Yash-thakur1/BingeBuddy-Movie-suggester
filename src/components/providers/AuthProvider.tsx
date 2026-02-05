'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { clearUserCache } from '@/lib/cache';
import {
  onAuthStateChange,
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  firebaseSignOut,
  getIdToken,
} from '@/lib/firebase';

interface AuthUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface AuthSession {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthSession {
  login: (email: string, password: string) => Promise<boolean>;
  loginWithGoogle: (callbackUrl?: string) => Promise<void>;
  logout: () => void;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Keep localStorage in sync so the Zustand store can read the token
const AUTH_STORAGE_KEY = 'bingebuddy-auth-session';

function syncToLocalStorage(user: AuthUser, token: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
    user,
    token,
    expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000),
  }));
}

function clearLocalStorage() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

/**
 * Firebase-based Authentication Provider
 * - Uses Firebase Auth for login/signup/Google
 * - Automatically refreshes tokens via onAuthStateChanged
 * - Clears all user cache on logout
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession>({
    user: null,
    token: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (firebaseUser) => {
      if (firebaseUser) {
        const token = await getIdToken();
        const authUser: AuthUser = {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || null,
          email: firebaseUser.email || null,
          image: firebaseUser.photoURL || null,
        };
        
        if (token) {
          syncToLocalStorage(authUser, token);
        }
        
        setSession({
          user: authUser,
          token,
          isLoading: false,
          isAuthenticated: true,
        });
      } else {
        clearLocalStorage();
        setSession({
          user: null,
          token: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    });

    return () => unsubscribe();
  }, []);

  /**
   * Login with email/password via Firebase Auth
   */
  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const { user, error } = await signInWithEmail(email, password);
      if (error || !user) {
        return false;
      }
      // onAuthStateChanged will handle session update
      return true;
    } catch (error) {
      console.error('[Auth] Login failed:', error);
      return false;
    }
  }, []);

  /**
   * Login with Google via Firebase Auth popup
   */
  const loginWithGoogle = useCallback(async (_callbackUrl: string = '/') => {
    try {
      await signInWithGoogle();
      // onAuthStateChanged will handle session update
    } catch (error) {
      console.error('[Auth] Google login failed:', error);
    }
  }, []);

  /**
   * Handle logout - clear session and all user cache
   */
  const handleLogout = useCallback(async () => {
    const userId = session.user?.id;
    
    try {
      await firebaseSignOut();
    } catch (e) {
      console.error('[Auth] Signout error:', e);
    }
    
    clearLocalStorage();
    
    // Clear all user cache to prevent data leakage
    if (userId) {
      clearUserCache(userId);
      try {
        const userLearningKey = `bingebuddy-preference-learning-user-${userId}`;
        localStorage.removeItem(userLearningKey);
      } catch {}
    }
  }, [session.user?.id]);

  /**
   * Refresh session - get a fresh Firebase ID token
   */
  const refreshSession = useCallback(async () => {
    try {
      const token = await getIdToken();
      if (token) {
        setSession(prev => ({ ...prev, token }));
      }
    } catch {
      console.warn('[Auth] Token refresh failed');
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...session,
        login,
        loginWithGoogle,
        logout: handleLogout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth context
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

/**
 * Helper to get auth headers for API calls (uses Firebase ID token from localStorage)
 */
export function getAuthHeaders(): HeadersInit {
  if (typeof window === 'undefined') return { 'Content-Type': 'application/json' };
  
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      const session = JSON.parse(stored);
      if (session?.token) {
        headers['Authorization'] = `Bearer ${session.token}`;
      }
    }
  } catch {}
  
  return headers;
}

/**
 * Helper to get current user ID
 */
export function getCurrentUserId(): string | null {
  return null; // Firebase manages this internally
}
