/**
 * Firebase Services Export
 * 
 * Central export point for all Firebase-related functionality.
 * Note: Admin SDK should only be imported in server-side code (API routes)
 */

// Configuration (client-side)
export { getFirebaseAuth, getFirebaseDb, getFirebaseAnalytics } from './config';

// Authentication (client-side)
export {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  firebaseSignOut,
  sendPasswordReset,
  getCurrentUser,
  onAuthStateChange,
  getIdToken,
  createAuthState,
  type AuthState
} from './auth';

// Firestore Operations (client-side)
export {
  // Learning State
  getUserLearningState,
  saveUserLearningState,
  deleteUserLearningState,
  // Watchlist
  getUserWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  // Preferences
  getUserPreferences,
  saveUserPreferences,
  // Analytics
  getUserAnalytics,
  updateUserAnalytics,
  logRecommendationEvent,
  // Types
  type FirestoreLearningState,
  type FirestoreWatchlistItem,
  type FirestoreUserPreferences,
  type FirestoreAnalyticsData
} from './firestore';

// Analytics (client-side)
export {
  logAnalyticsEvent,
  setAnalyticsUserId,
  setAnalyticsUserProperties,
  logRecommendationShown,
  logRecommendationLiked,
  logRecommendationDisliked,
  logSearchPerformed,
  logMediaView,
  logChatInteraction,
  logAuthEvent,
  type AnalyticsEvent,
  type RecommendationEventParams,
  type SearchEventParams,
  type MediaViewParams
} from './analytics';

// Engagement (client-side)
export {
  getEngagementCounts,
  getUserReaction,
  toggleReaction,
  subscribeToEngagement,
  type ReactionType,
  type EngagementCounts,
  type UserReaction,
} from './engagement';

// Note: Admin SDK exports are in a separate file (./admin.ts)
// Import directly from '@/lib/firebase/admin' in server-side code only
