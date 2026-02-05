'use client';

/**
 * Firebase Auth Provider
 * 
 * Provides authentication context using Firebase Authentication.
 * Can be used alongside or as a replacement for NextAuth.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from 'firebase/auth';
import { 
  onAuthStateChange, 
  signInWithEmail, 
  signUpWithEmail, 
  signInWithGoogle, 
  firebaseSignOut,
  sendPasswordReset,
  getIdToken,
  type AuthState 
} from '@/lib/firebase';
import { setAnalyticsUserId, logAuthEvent } from '@/lib/firebase/analytics';
import { migrateGuestToUser, loadFromServer } from '@/lib/ai/preferenceLearning';

// ============================================
// Context Types
// ============================================

interface FirebaseAuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<{ success: boolean; error: string | null }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ success: boolean; error: string | null }>;
  signInGoogle: () => Promise<{ success: boolean; error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error: string | null }>;
  getToken: () => Promise<string | null>;
}

const FirebaseAuthContext = createContext<FirebaseAuthContextType | null>(null);

// ============================================
// Provider Component
// ============================================

interface FirebaseAuthProviderProps {
  children: React.ReactNode;
}

export function FirebaseAuthProvider({ children }: FirebaseAuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (firebaseUser) => {
      setUser(firebaseUser);
      setIsLoading(false);
      
      // Set analytics user ID
      if (firebaseUser) {
        await setAnalyticsUserId(firebaseUser.uid);
        
        // Load user's learning preferences from server
        await loadFromServer();
      } else {
        await setAnalyticsUserId(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Sign in with email/password
  const signIn = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    const { user: newUser, error } = await signInWithEmail(email, password);
    setIsLoading(false);
    
    if (newUser) {
      await logAuthEvent('login', 'email');
      
      // Migrate guest preferences
      const guestSessionId = sessionStorage.getItem('bingebuddy-guest-session-id');
      if (guestSessionId) {
        await migrateGuestToUser(guestSessionId);
        sessionStorage.removeItem('bingebuddy-guest-session-id');
      }
    }
    
    return { success: !!newUser, error };
  }, []);

  // Sign up with email/password
  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    setIsLoading(true);
    const { user: newUser, error } = await signUpWithEmail(email, password, name);
    setIsLoading(false);
    
    if (newUser) {
      await logAuthEvent('signup', 'email');
      
      // Migrate guest preferences
      const guestSessionId = sessionStorage.getItem('bingebuddy-guest-session-id');
      if (guestSessionId) {
        await migrateGuestToUser(guestSessionId);
        sessionStorage.removeItem('bingebuddy-guest-session-id');
      }
    }
    
    return { success: !!newUser, error };
  }, []);

  // Sign in with Google
  const signInGoogle = useCallback(async () => {
    setIsLoading(true);
    const { user: newUser, error } = await signInWithGoogle();
    setIsLoading(false);
    
    if (newUser) {
      await logAuthEvent('login', 'google');
      
      // Migrate guest preferences
      const guestSessionId = sessionStorage.getItem('bingebuddy-guest-session-id');
      if (guestSessionId) {
        await migrateGuestToUser(guestSessionId);
        sessionStorage.removeItem('bingebuddy-guest-session-id');
      }
    }
    
    return { success: !!newUser, error };
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    await logAuthEvent('logout');
    await firebaseSignOut();
    setUser(null);
  }, []);

  // Reset password
  const resetPassword = useCallback(async (email: string) => {
    return await sendPasswordReset(email);
  }, []);

  // Get ID token
  const getToken = useCallback(async () => {
    return await getIdToken();
  }, []);

  const value: FirebaseAuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    signIn,
    signUp,
    signInGoogle,
    signOut,
    resetPassword,
    getToken
  };

  return (
    <FirebaseAuthContext.Provider value={value}>
      {children}
    </FirebaseAuthContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function useFirebaseAuth(): FirebaseAuthContextType {
  const context = useContext(FirebaseAuthContext);
  if (!context) {
    throw new Error('useFirebaseAuth must be used within a FirebaseAuthProvider');
  }
  return context;
}

// ============================================
// Higher-Order Component for Protected Routes
// ============================================

interface WithFirebaseAuthProps {
  fallback?: React.ReactNode;
  redirectTo?: string;
}

export function withFirebaseAuth<P extends object>(
  Component: React.ComponentType<P>,
  options: WithFirebaseAuthProps = {}
): React.FC<P> {
  const { fallback = null, redirectTo } = options;
  
  return function ProtectedComponent(props: P) {
    const { isAuthenticated, isLoading } = useFirebaseAuth();
    
    useEffect(() => {
      if (!isLoading && !isAuthenticated && redirectTo) {
        window.location.href = redirectTo;
      }
    }, [isLoading, isAuthenticated]);
    
    if (isLoading) {
      return <>{fallback}</>;
    }
    
    if (!isAuthenticated) {
      return <>{fallback}</>;
    }
    
    return <Component {...props} />;
  };
}
