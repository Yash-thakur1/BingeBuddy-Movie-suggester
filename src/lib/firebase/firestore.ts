/**
 * Firestore User Learning Service
 * 
 * Handles persistence of AI preference learning data in Firebase Firestore.
 * This replaces the SQLite/Prisma storage for production deployment.
 * 
 * Collections:
 * - users/{userId}/learning - User's learning state
 * - users/{userId}/watchlist - User's watchlist
 * - users/{userId}/preferences - User's preferences
 * - users/{userId}/analytics - User's analytics data
 */

import { 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { getFirebaseDb } from './config';
import type { PreferenceLearningState } from '@/lib/ai/preferenceLearning';

// ============================================
// Types
// ============================================

export interface FirestoreLearningState {
  learningData: PreferenceLearningState;
  totalLikes: number;
  totalDislikes: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirestoreWatchlistItem {
  mediaId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  posterPath: string | null;
  voteAverage: number;
  releaseDate: string | null;
  addedAt: Timestamp;
}

export interface FirestoreUserPreferences {
  favoriteGenres: number[];
  preferredMood: string | null;
  preferredEra: string | null;
  preferredLanguages: string[];
  ratingPreference: string | null;
  updatedAt: Timestamp;
}

export interface FirestoreAnalyticsData {
  recommendationsShown: number;
  likes: number;
  dislikes: number;
  accuracy: number; // likes / (likes + dislikes)
  confidenceDistribution: Record<string, number>;
  lastUpdated: Timestamp;
}

// ============================================
// Learning State Operations
// ============================================

/**
 * Get user's learning state from Firestore
 */
export async function getUserLearningState(
  userId: string
): Promise<FirestoreLearningState | null> {
  try {
    const db = getFirebaseDb();
    const docRef = doc(db, 'users', userId, 'data', 'learning');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as FirestoreLearningState;
    }
    return null;
  } catch (error) {
    console.error('[Firestore] Error getting learning state:', error);
    return null;
  }
}

/**
 * Save user's learning state to Firestore
 */
export async function saveUserLearningState(
  userId: string,
  learningData: PreferenceLearningState
): Promise<boolean> {
  try {
    const db = getFirebaseDb();
    const docRef = doc(db, 'users', userId, 'data', 'learning');
    
    await setDoc(docRef, {
      learningData,
      totalLikes: learningData.totalLikes,
      totalDislikes: learningData.totalDislikes,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    return true;
  } catch (error) {
    console.error('[Firestore] Error saving learning state:', error);
    return false;
  }
}

/**
 * Delete user's learning state from Firestore
 */
export async function deleteUserLearningState(userId: string): Promise<boolean> {
  try {
    const db = getFirebaseDb();
    const docRef = doc(db, 'users', userId, 'data', 'learning');
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error('[Firestore] Error deleting learning state:', error);
    return false;
  }
}

// ============================================
// Watchlist Operations
// ============================================

/**
 * Get user's watchlist from Firestore
 */
export async function getUserWatchlist(
  userId: string
): Promise<FirestoreWatchlistItem[]> {
  try {
    const db = getFirebaseDb();
    const watchlistRef = collection(db, 'users', userId, 'watchlist');
    const querySnapshot = await getDocs(watchlistRef);
    
    return querySnapshot.docs.map(doc => doc.data() as FirestoreWatchlistItem);
  } catch (error) {
    console.error('[Firestore] Error getting watchlist:', error);
    return [];
  }
}

/**
 * Add item to user's watchlist
 */
export async function addToWatchlist(
  userId: string,
  item: Omit<FirestoreWatchlistItem, 'addedAt'>
): Promise<boolean> {
  try {
    const db = getFirebaseDb();
    const docId = `${item.mediaType}-${item.mediaId}`;
    const docRef = doc(db, 'users', userId, 'watchlist', docId);
    
    await setDoc(docRef, {
      ...item,
      addedAt: serverTimestamp()
    });
    
    return true;
  } catch (error) {
    console.error('[Firestore] Error adding to watchlist:', error);
    return false;
  }
}

/**
 * Remove item from user's watchlist
 */
export async function removeFromWatchlist(
  userId: string,
  mediaId: number,
  mediaType: 'movie' | 'tv'
): Promise<boolean> {
  try {
    const db = getFirebaseDb();
    const docId = `${mediaType}-${mediaId}`;
    const docRef = doc(db, 'users', userId, 'watchlist', docId);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error('[Firestore] Error removing from watchlist:', error);
    return false;
  }
}

// ============================================
// User Preferences Operations
// ============================================

/**
 * Get user's preferences from Firestore
 */
export async function getUserPreferences(
  userId: string
): Promise<FirestoreUserPreferences | null> {
  try {
    const db = getFirebaseDb();
    const docRef = doc(db, 'users', userId, 'data', 'preferences');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as FirestoreUserPreferences;
    }
    return null;
  } catch (error) {
    console.error('[Firestore] Error getting preferences:', error);
    return null;
  }
}

/**
 * Save user's preferences to Firestore
 */
export async function saveUserPreferences(
  userId: string,
  preferences: Partial<Omit<FirestoreUserPreferences, 'updatedAt'>>
): Promise<boolean> {
  try {
    const db = getFirebaseDb();
    const docRef = doc(db, 'users', userId, 'data', 'preferences');
    
    await setDoc(docRef, {
      ...preferences,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    return true;
  } catch (error) {
    console.error('[Firestore] Error saving preferences:', error);
    return false;
  }
}

// ============================================
// Analytics Operations
// ============================================

/**
 * Get user's analytics data
 */
export async function getUserAnalytics(
  userId: string
): Promise<FirestoreAnalyticsData | null> {
  try {
    const db = getFirebaseDb();
    const docRef = doc(db, 'users', userId, 'data', 'analytics');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as FirestoreAnalyticsData;
    }
    return null;
  } catch (error) {
    console.error('[Firestore] Error getting analytics:', error);
    return null;
  }
}

/**
 * Update user's analytics data
 */
export async function updateUserAnalytics(
  userId: string,
  updates: Partial<Omit<FirestoreAnalyticsData, 'lastUpdated'>>
): Promise<boolean> {
  try {
    const db = getFirebaseDb();
    const docRef = doc(db, 'users', userId, 'data', 'analytics');
    
    // Get current data
    const current = await getUserAnalytics(userId);
    
    const newData = {
      recommendationsShown: (current?.recommendationsShown || 0) + (updates.recommendationsShown || 0),
      likes: (current?.likes || 0) + (updates.likes || 0),
      dislikes: (current?.dislikes || 0) + (updates.dislikes || 0),
      confidenceDistribution: {
        ...(current?.confidenceDistribution || {}),
        ...(updates.confidenceDistribution || {})
      },
      accuracy: 0,
      lastUpdated: serverTimestamp()
    };
    
    // Calculate accuracy
    const totalFeedback = newData.likes + newData.dislikes;
    newData.accuracy = totalFeedback > 0 ? newData.likes / totalFeedback : 0;
    
    await setDoc(docRef, newData, { merge: true });
    
    return true;
  } catch (error) {
    console.error('[Firestore] Error updating analytics:', error);
    return false;
  }
}

/**
 * Log a recommendation event
 */
export async function logRecommendationEvent(
  userId: string,
  event: {
    type: 'shown' | 'like' | 'dislike';
    mediaId: number;
    mediaType: 'movie' | 'tv';
    confidenceLevel?: string;
  }
): Promise<void> {
  try {
    const updates: Partial<FirestoreAnalyticsData> = {};
    
    if (event.type === 'shown') {
      updates.recommendationsShown = 1;
    } else if (event.type === 'like') {
      updates.likes = 1;
    } else if (event.type === 'dislike') {
      updates.dislikes = 1;
    }
    
    if (event.confidenceLevel) {
      updates.confidenceDistribution = {
        [event.confidenceLevel]: 1
      };
    }
    
    await updateUserAnalytics(userId, updates);
  } catch (error) {
    console.error('[Firestore] Error logging event:', error);
  }
}
