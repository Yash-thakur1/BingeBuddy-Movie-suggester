/**
 * Firebase Authentication Service
 * 
 * Provides authentication functionality using Firebase Auth.
 * Supports Google Sign-In and Email/Password authentication.
 */

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User,
  UserCredential,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification
} from 'firebase/auth';
import { getFirebaseAuth } from './config';

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');

// ============================================
// Authentication Functions
// ============================================

/**
 * Sign in with email and password
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ user: User | null; error: string | null }> {
  try {
    const auth = getFirebaseAuth();
    const result = await signInWithEmailAndPassword(auth, email, password);
    return { user: result.user, error: null };
  } catch (error: any) {
    console.error('[Firebase Auth] Sign in error:', error);
    return { user: null, error: getAuthErrorMessage(error.code) };
  }
}

/**
 * Create account with email and password
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  displayName?: string
): Promise<{ user: User | null; error: string | null }> {
  try {
    const auth = getFirebaseAuth();
    const result = await createUserWithEmailAndPassword(auth, email, password);
    
    // Update profile with display name if provided
    if (displayName && result.user) {
      await updateProfile(result.user, { displayName });
    }
    
    // Send email verification
    if (result.user) {
      await sendEmailVerification(result.user);
    }
    
    return { user: result.user, error: null };
  } catch (error: any) {
    console.error('[Firebase Auth] Sign up error:', error);
    return { user: null, error: getAuthErrorMessage(error.code) };
  }
}

/**
 * Sign in with Google
 */
export async function signInWithGoogle(): Promise<{ user: User | null; error: string | null }> {
  try {
    const auth = getFirebaseAuth();
    const result = await signInWithPopup(auth, googleProvider);
    return { user: result.user, error: null };
  } catch (error: any) {
    console.error('[Firebase Auth] Google sign in error:', error);
    return { user: null, error: getAuthErrorMessage(error.code) };
  }
}

/**
 * Sign out current user
 */
export async function firebaseSignOut(): Promise<boolean> {
  try {
    const auth = getFirebaseAuth();
    await signOut(auth);
    return true;
  } catch (error) {
    console.error('[Firebase Auth] Sign out error:', error);
    return false;
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordReset(
  email: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const auth = getFirebaseAuth();
    await sendPasswordResetEmail(auth, email);
    return { success: true, error: null };
  } catch (error: any) {
    console.error('[Firebase Auth] Password reset error:', error);
    return { success: false, error: getAuthErrorMessage(error.code) };
  }
}

/**
 * Get current user
 */
export function getCurrentUser(): User | null {
  const auth = getFirebaseAuth();
  return auth.currentUser;
}

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChange(
  callback: (user: User | null) => void
): () => void {
  const auth = getFirebaseAuth();
  return onAuthStateChanged(auth, callback);
}

/**
 * Get ID token for API calls
 */
export async function getIdToken(): Promise<string | null> {
  const user = getCurrentUser();
  if (!user) return null;
  
  try {
    return await user.getIdToken();
  } catch (error) {
    console.error('[Firebase Auth] Failed to get ID token:', error);
    return null;
  }
}

/**
 * Convert Firebase auth error codes to user-friendly messages
 */
function getAuthErrorMessage(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'This email is already registered. Please sign in instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled. Please contact support.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/user-not-found':
      return 'No account found with this email. Please sign up.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    case 'auth/invalid-credential':
      return 'Invalid credentials. Please check your email and password.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in was cancelled. Please try again.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection.';
    default:
      return 'An error occurred. Please try again.';
  }
}

// ============================================
// Auth State Hook Helper
// ============================================

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

/**
 * Create auth state for React components
 */
export function createAuthState(user: User | null, isLoading: boolean): AuthState {
  return {
    user,
    isLoading,
    isAuthenticated: !!user
  };
}
