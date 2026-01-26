'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { clearUserCache } from '@/lib/cache';

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

// Use localStorage for persistence across browser sessions
const AUTH_STORAGE_KEY = 'flixora-auth-session';
const TOKEN_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

interface StoredSession {
  user: AuthUser;
  token: string;
  expiresAt: number;
}

/**
 * Get stored session from localStorage
 */
function getStoredSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;
    
    const session: StoredSession = JSON.parse(stored);
    
    // Check if session is expired (7 days)
    if (Date.now() > session.expiresAt) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
    
    return session;
  } catch {
    return null;
  }
}

/**
 * Save session to localStorage
 */
function saveStoredSession(user: AuthUser, token: string): void {
  if (typeof window === 'undefined') return;
  
  const session: StoredSession = {
    user,
    token,
    expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
  };
  
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

/**
 * Clear session from localStorage
 */
function clearStoredSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

/**
 * Persistent Authentication Provider
 * - Uses localStorage for persistent sessions across browser restarts
 * - Automatically refreshes tokens
 * - Clears all user cache on logout
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession>({
    user: null,
    token: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Verify token function
  const verifyToken = useCallback(async (token: string, onInvalid: () => void) => {
    try {
      const res = await fetch('/api/auth/tab-verify', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!res.ok) {
        onInvalid();
      }
    } catch {
      console.warn('[Auth] Token verification failed, will retry');
    }
  }, []);

  // Load session from localStorage on mount
  useEffect(() => {
    const stored = getStoredSession();
    
    if (stored) {
      setSession({
        user: stored.user,
        token: stored.token,
        isLoading: false,
        isAuthenticated: true,
      });
      
      // Verify token is still valid in background
      verifyToken(stored.token, () => {
        clearStoredSession();
        setSession({
          user: null,
          token: null,
          isLoading: false,
          isAuthenticated: false,
        });
      });
    } else {
      setSession((s) => ({ ...s, isLoading: false }));
    }
  }, [verifyToken]);

  // Set up token refresh interval
  useEffect(() => {
    if (!session.token) return;
    
    const interval = setInterval(() => {
      verifyToken(session.token!, () => {
        clearStoredSession();
        if (session.user?.id) {
          clearUserCache(session.user.id);
        }
        setSession({
          user: null,
          token: null,
          isLoading: false,
          isAuthenticated: false,
        });
      });
    }, TOKEN_REFRESH_INTERVAL);
    
    return () => clearInterval(interval);
  }, [session.token, session.user?.id, verifyToken]);

  /**
   * Save session and update state
   * Also handles migrating guest learning preferences to the authenticated user
   */
  const saveSession = useCallback(async (user: AuthUser | null, token: string | null) => {
    if (user && token) {
      // Capture guest session ID before it's cleared
      const guestSessionId = sessionStorage.getItem('flixora-guest-session-id');
      
      saveStoredSession(user, token);
      setSession({
        user,
        token,
        isLoading: false,
        isAuthenticated: true,
      });
      
      // Migrate guest preferences to authenticated user
      if (guestSessionId) {
        try {
          const { migrateGuestToUser } = await import('@/lib/ai/preferenceLearning');
          await migrateGuestToUser(guestSessionId);
          // Clear guest session ID after migration
          sessionStorage.removeItem('flixora-guest-session-id');
        } catch (e) {
          console.error('[Auth] Failed to migrate guest preferences:', e);
        }
      }
    } else {
      clearStoredSession();
      setSession({
        user: null,
        token: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  }, []);

  /**
   * Login with email/password
   */
  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/tab-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        return false;
      }

      saveSession(data.user, data.token);
      return true;
    } catch (error) {
      console.error('[Auth] Login failed:', error);
      return false;
    }
  }, [saveSession]);

  /**
   * Login with Google (opens popup)
   */
  const loginWithGoogle = useCallback(async (callbackUrl: string = '/') => {
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const popup = window.open(
      '/api/auth/google-popup',
      'google-login',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    // Listen for message from popup
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data.type === 'google-auth-success') {
        saveSession(event.data.user, event.data.token);
        popup?.close();
      }
      window.removeEventListener('message', handleMessage);
    };

    window.addEventListener('message', handleMessage);
  }, [saveSession]);

  /**
   * Handle logout - clear session and all user cache
   */
  const handleLogout = useCallback(() => {
    const userId = session.user?.id;
    
    // Clear session
    saveSession(null, null);
    
    // Clear all user cache to prevent data leakage
    if (userId) {
      clearUserCache(userId);
      
      // Clear user-specific learning data from localStorage
      // Note: Guest session data is already isolated and will be fresh on new session
      try {
        const userLearningKey = `flixora-preference-learning-user-${userId}`;
        localStorage.removeItem(userLearningKey);
      } catch {}
    }
  }, [session.user?.id, saveSession]);

  /**
   * Refresh session - verify token and update state
   */
  const refreshSession = useCallback(async () => {
    if (!session.token) return;
    await verifyToken(session.token, () => {
      handleLogout();
    });
  }, [session.token, verifyToken, handleLogout]);

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
 * Helper to get auth headers for API calls
 */
export function getAuthHeaders(): HeadersInit {
  if (typeof window === 'undefined') return { 'Content-Type': 'application/json' };
  
  const stored = getStoredSession();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  
  if (stored?.token) {
    headers['Authorization'] = `Bearer ${stored.token}`;
  }
  
  return headers;
}

/**
 * Helper to get current user ID (for cache keys)
 */
export function getCurrentUserId(): string | null {
  if (typeof window === 'undefined') return null;
  
  const stored = getStoredSession();
  return stored?.user?.id || null;
}
