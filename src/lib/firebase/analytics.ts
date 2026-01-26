/**
 * Firebase Analytics Service
 * 
 * Provides lightweight analytics for tracking recommendation accuracy
 * and user engagement metrics.
 */

import { logEvent, setUserId, setUserProperties } from 'firebase/analytics';
import { getFirebaseAnalytics } from './config';

// ============================================
// Event Types
// ============================================

export type AnalyticsEvent = 
  | 'recommendation_shown'
  | 'recommendation_liked'
  | 'recommendation_disliked'
  | 'search_performed'
  | 'movie_viewed'
  | 'tv_show_viewed'
  | 'watchlist_add'
  | 'watchlist_remove'
  | 'chat_message_sent'
  | 'chat_recommendation_received'
  | 'preference_updated'
  | 'login'
  | 'signup'
  | 'logout';

export interface RecommendationEventParams {
  media_id: number;
  media_type: 'movie' | 'tv';
  title: string;
  confidence_level?: 'exact' | 'high' | 'medium' | 'low' | 'ambiguous';
  reference_movie_id?: number;
  position?: number;
}

export interface SearchEventParams {
  query: string;
  results_count: number;
}

export interface MediaViewParams {
  media_id: number;
  media_type: 'movie' | 'tv';
  title: string;
  source: 'search' | 'recommendation' | 'browse' | 'watchlist';
}

// ============================================
// Analytics Functions
// ============================================

/**
 * Log an analytics event
 */
export async function logAnalyticsEvent(
  eventName: AnalyticsEvent,
  params?: Record<string, any>
): Promise<void> {
  try {
    const analytics = await getFirebaseAnalytics();
    if (analytics) {
      logEvent(analytics, eventName as string, params);
    }
  } catch (error) {
    // Silently fail - analytics should not break the app
    console.debug('[Analytics] Failed to log event:', eventName, error);
  }
}

/**
 * Set the user ID for analytics
 */
export async function setAnalyticsUserId(userId: string | null): Promise<void> {
  try {
    const analytics = await getFirebaseAnalytics();
    if (analytics && userId) {
      setUserId(analytics, userId);
    }
  } catch (error) {
    console.debug('[Analytics] Failed to set user ID:', error);
  }
}

/**
 * Set user properties for segmentation
 */
export async function setAnalyticsUserProperties(
  properties: Record<string, string>
): Promise<void> {
  try {
    const analytics = await getFirebaseAnalytics();
    if (analytics) {
      setUserProperties(analytics, properties);
    }
  } catch (error) {
    console.debug('[Analytics] Failed to set user properties:', error);
  }
}

// ============================================
// Convenience Functions
// ============================================

/**
 * Log recommendation shown event
 */
export async function logRecommendationShown(
  params: RecommendationEventParams
): Promise<void> {
  await logAnalyticsEvent('recommendation_shown', params);
}

/**
 * Log recommendation liked event
 */
export async function logRecommendationLiked(
  params: RecommendationEventParams
): Promise<void> {
  await logAnalyticsEvent('recommendation_liked', params);
}

/**
 * Log recommendation disliked event
 */
export async function logRecommendationDisliked(
  params: RecommendationEventParams
): Promise<void> {
  await logAnalyticsEvent('recommendation_disliked', params);
}

/**
 * Log search performed event
 */
export async function logSearchPerformed(params: SearchEventParams): Promise<void> {
  await logAnalyticsEvent('search_performed', params);
}

/**
 * Log media view event
 */
export async function logMediaView(params: MediaViewParams): Promise<void> {
  const eventName = params.media_type === 'movie' ? 'movie_viewed' : 'tv_show_viewed';
  await logAnalyticsEvent(eventName, params);
}

/**
 * Log chat interaction
 */
export async function logChatInteraction(
  type: 'message_sent' | 'recommendation_received',
  params?: { recommendation_count?: number; query_type?: string }
): Promise<void> {
  const eventName = type === 'message_sent' 
    ? 'chat_message_sent' 
    : 'chat_recommendation_received';
  await logAnalyticsEvent(eventName, params);
}

/**
 * Log auth events
 */
export async function logAuthEvent(
  type: 'login' | 'signup' | 'logout',
  method?: 'email' | 'google'
): Promise<void> {
  await logAnalyticsEvent(type, method ? { method } : undefined);
}
