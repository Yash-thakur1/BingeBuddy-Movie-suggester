/**
 * Preference Learning Engine
 * 
 * Implements attribute-based learning from Like/Dislike feedback.
 * Uses soft preference signals for balanced personalization without overfitting.
 * 
 * Key Principles:
 * 1. Learn from attributes (genre, language, tone, era), not just movie IDs
 * 2. Likes and dislikes are SOFT signals, not hard filters
 * 3. Reference movie similarity ALWAYS remains primary
 * 4. Include controlled diversity to avoid echo chambers
 * 5. Cap influence to maintain balanced recommendations
 */

import { ReleaseEra, CinemaIndustry, ThematicElement, calculateReleaseEra } from './referenceMovieAnalyzer';

// ============================================
// Types
// ============================================

/**
 * Feedback type for a recommendation
 */
export type FeedbackType = 'like' | 'dislike' | 'neutral';

/**
 * Attributes extracted from a movie for learning
 */
export interface MovieAttributes {
  id: number;
  title: string;
  type: 'movie' | 'tv';
  
  // Core attributes for learning
  genreIds: number[];
  originalLanguage: string;
  industry: CinemaIndustry;
  releaseEra: ReleaseEra;
  releaseYear: number | null;
  
  // Cinematic attributes
  voteAverage: number;
  popularity: number;
  
  // Inferred attributes (optional)
  themes?: ThematicElement[];
  narrativeScale?: 'epic' | 'large' | 'medium' | 'intimate';
  audienceType?: 'mass' | 'family' | 'youth' | 'mature' | 'niche' | 'universal';
  toneIndicators?: string[];
}

/**
 * User feedback on a recommendation
 */
export interface UserFeedback {
  id: string;
  mediaId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  feedback: FeedbackType;
  attributes: MovieAttributes;
  referenceMovieId?: number; // The movie this was recommended based on
  timestamp: number;
}

/**
 * Learned attribute weights
 * Positive = user tends to like this attribute
 * Negative = user tends to dislike this attribute
 * Range: -1.0 to 1.0
 */
export interface AttributeWeights {
  // Genre preferences (keyed by genre ID)
  genres: Record<number, number>;
  
  // Language preferences (keyed by ISO 639-1 code)
  languages: Record<string, number>;
  
  // Industry preferences
  industries: Record<CinemaIndustry, number>;
  
  // Era preferences
  eras: Record<ReleaseEra, number>;
  
  // Narrative scale preferences
  narrativeScales: Record<string, number>;
  
  // Audience type preferences
  audienceTypes: Record<string, number>;
  
  // Theme preferences
  themes: Record<ThematicElement, number>;
}

/**
 * Preference learning state
 */
export interface PreferenceLearningState {
  // All feedback given by the user
  feedbackHistory: UserFeedback[];
  
  // Computed attribute weights
  attributeWeights: AttributeWeights;
  
  // Learning configuration
  config: LearningConfig;
  
  // Stats
  totalLikes: number;
  totalDislikes: number;
  lastUpdated: number;
}

/**
 * Configuration for learning behavior
 */
export interface LearningConfig {
  // Maximum weight magnitude (caps influence)
  maxWeight: number;
  
  // How much each feedback affects weight (learning rate)
  learningRate: number;
  
  // Decay factor for old feedback (recency bias)
  decayFactor: number;
  
  // Minimum feedback count before applying weights
  minFeedbackThreshold: number;
  
  // Weight given to preference vs reference similarity
  preferenceInfluence: number; // 0-1, where 0.3 means 30% preference, 70% reference
  
  // Diversity exploration factor
  explorationFactor: number; // 0-1, higher = more diverse recommendations
}

/**
 * Scoring result for personalization
 */
export interface PersonalizationScore {
  // Base score from reference similarity (0-100)
  referenceScore: number;
  
  // Preference-based adjustment (-30 to +30)
  preferenceAdjustment: number;
  
  // Exploration bonus (0-10)
  explorationBonus: number;
  
  // Final combined score
  finalScore: number;
  
  // Confidence in preference scoring
  preferenceConfidence: 'high' | 'medium' | 'low';
  
  // Explanation for transparency
  explanation: string[];
}

// ============================================
// Constants
// ============================================

const DEFAULT_CONFIG: LearningConfig = {
  maxWeight: 0.8,           // Never let any attribute dominate completely
  learningRate: 0.15,       // Moderate learning per feedback
  decayFactor: 0.95,        // Slight recency bias
  minFeedbackThreshold: 3,  // Need at least 3 feedbacks to apply
  preferenceInfluence: 0.25, // 25% preference, 75% reference similarity
  explorationFactor: 0.15   // 15% of recommendations should be exploratory
};

const EMPTY_WEIGHTS: AttributeWeights = {
  genres: {},
  languages: {},
  industries: {} as Record<CinemaIndustry, number>,
  eras: {} as Record<ReleaseEra, number>,
  narrativeScales: {},
  audienceTypes: {},
  themes: {} as Record<ThematicElement, number>
};

// ============================================
// User-Scoped Storage
// ============================================

const STORAGE_KEY_PREFIX = 'bingebuddy-preference-learning';
const GUEST_SESSION_KEY = 'bingebuddy-guest-session-id';

/**
 * Get or create a guest session ID for unauthenticated users
 * This ensures guest preferences are isolated per browser session
 */
function getGuestSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  
  let sessionId = sessionStorage.getItem(GUEST_SESSION_KEY);
  if (!sessionId) {
    sessionId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem(GUEST_SESSION_KEY, sessionId);
  }
  return sessionId;
}

/**
 * Get the current user ID from the auth session
 * Returns null if not authenticated
 */
function getCurrentUserId(): string | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const authStorage = localStorage.getItem('bingebuddy-auth-session');
    if (authStorage) {
      const session = JSON.parse(authStorage);
      if (session?.user?.id && Date.now() < session.expiresAt) {
        return session.user.id;
      }
    }
  } catch {}
  
  return null;
}

/**
 * Get the storage key for the current user/session
 */
function getStorageKey(): string {
  const userId = getCurrentUserId();
  if (userId) {
    return `${STORAGE_KEY_PREFIX}-user-${userId}`;
  }
  return `${STORAGE_KEY_PREFIX}-guest-${getGuestSessionId()}`;
}

/**
 * Check if the current user is authenticated
 */
export function isAuthenticated(): boolean {
  return getCurrentUserId() !== null;
}

/**
 * Get the current user identifier (user ID or guest session ID)
 */
export function getCurrentUserIdentifier(): string {
  return getCurrentUserId() || getGuestSessionId();
}

/**
 * Load learning state from localStorage (user-scoped)
 */
export function loadLearningState(): PreferenceLearningState {
  if (typeof window === 'undefined') {
    return createEmptyState();
  }
  
  try {
    const storageKey = getStorageKey();
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const state = JSON.parse(stored) as PreferenceLearningState;
      // Ensure config has all fields (for backwards compatibility)
      state.config = { ...DEFAULT_CONFIG, ...state.config };
      return state;
    }
  } catch (e) {
    console.error('[PreferenceLearning] Failed to load state:', e);
  }
  
  return createEmptyState();
}

/**
 * Save learning state to localStorage (user-scoped)
 * For authenticated users, also triggers server sync
 */
export function saveLearningState(state: PreferenceLearningState): void {
  if (typeof window === 'undefined') return;
  
  try {
    const storageKey = getStorageKey();
    localStorage.setItem(storageKey, JSON.stringify(state));
    
    // If authenticated, sync to server (debounced)
    if (isAuthenticated()) {
      debouncedServerSync(state);
    }
  } catch (e) {
    console.error('[PreferenceLearning] Failed to save state:', e);
  }
}

// Debounce server sync to avoid too many API calls
let syncTimeout: NodeJS.Timeout | null = null;
const SYNC_DEBOUNCE_MS = 2000;

function debouncedServerSync(state: PreferenceLearningState): void {
  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }
  
  syncTimeout = setTimeout(() => {
    syncToServer(state);
  }, SYNC_DEBOUNCE_MS);
}

/**
 * Sync learning state to server for authenticated users
 * Supports both API route (Prisma) and Firestore
 */
async function syncToServer(state: PreferenceLearningState): Promise<void> {
  try {
    // Try Firestore first if available
    if (typeof window !== 'undefined') {
      try {
        const { saveUserLearningState, getCurrentUser } = await import('@/lib/firebase');
        const user = getCurrentUser();
        if (user) {
          await saveUserLearningState(user.uid, state);
          return;
        }
      } catch {
        // Firestore not available, fall back to API
      }
    }
    
    // Fall back to API route
    const response = await fetch('/api/user/learning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        learningData: state,
        totalLikes: state.totalLikes,
        totalDislikes: state.totalDislikes
      })
    });
    
    if (!response.ok) {
      console.error('[PreferenceLearning] Server sync failed:', response.status);
    }
  } catch (e) {
    console.error('[PreferenceLearning] Server sync error:', e);
  }
}

/**
 * Load learning state from server for authenticated users
 * Should be called on login to restore preferences
 * Supports both Firestore and API route
 */
export async function loadFromServer(): Promise<PreferenceLearningState | null> {
  if (!isAuthenticated()) return null;
  
  try {
    // Try Firestore first if available
    if (typeof window !== 'undefined') {
      try {
        const { getUserLearningState, getCurrentUser } = await import('@/lib/firebase');
        const user = getCurrentUser();
        if (user) {
          const firestoreState = await getUserLearningState(user.uid);
          if (firestoreState?.learningData) {
            const state = firestoreState.learningData;
            state.config = { ...DEFAULT_CONFIG, ...state.config };
            
            // Save to local storage for offline access
            const storageKey = getStorageKey();
            localStorage.setItem(storageKey, JSON.stringify(state));
            
            return state;
          }
        }
      } catch {
        // Firestore not available, fall back to API
      }
    }
    
    // Fall back to API route
    const response = await fetch('/api/user/learning');
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.learningData) {
      const state = data.learningData as PreferenceLearningState;
      state.config = { ...DEFAULT_CONFIG, ...state.config };
      
      // Save to local storage for offline access
      const storageKey = getStorageKey();
      localStorage.setItem(storageKey, JSON.stringify(state));
      
      return state;
    }
  } catch (e) {
    console.error('[PreferenceLearning] Failed to load from server:', e);
  }
  
  return null;
}

/**
 * Migrate guest preferences to authenticated user
 * Called when a guest user logs in
 */
export async function migrateGuestToUser(guestSessionId: string): Promise<void> {
  if (!isAuthenticated()) return;
  
  try {
    const guestKey = `${STORAGE_KEY_PREFIX}-guest-${guestSessionId}`;
    const guestData = localStorage.getItem(guestKey);
    
    if (guestData) {
      const guestState = JSON.parse(guestData) as PreferenceLearningState;
      
      // Load existing user state from server
      const serverState = await loadFromServer();
      
      // If user has no existing preferences, use guest preferences
      if (!serverState || serverState.feedbackHistory.length === 0) {
        saveLearningState(guestState);
      } else if (guestState.feedbackHistory.length > 0) {
        // Merge guest feedback with existing user feedback
        const mergedState = mergeLearningStates(serverState, guestState);
        saveLearningState(mergedState);
      }
      
      // Clean up guest data
      localStorage.removeItem(guestKey);
    }
  } catch (e) {
    console.error('[PreferenceLearning] Migration failed:', e);
  }
}

/**
 * Merge two learning states (for migration)
 */
function mergeLearningStates(
  primary: PreferenceLearningState,
  secondary: PreferenceLearningState
): PreferenceLearningState {
  // Combine feedback history, avoiding duplicates
  const existingIds = new Set(
    primary.feedbackHistory.map(fb => `${fb.mediaType}-${fb.mediaId}`)
  );
  
  const newFeedback = secondary.feedbackHistory.filter(
    fb => !existingIds.has(`${fb.mediaType}-${fb.mediaId}`)
  );
  
  const mergedHistory = [...primary.feedbackHistory, ...newFeedback];
  
  // Recalculate weights with merged history
  return recalculateWeights({
    ...primary,
    feedbackHistory: mergedHistory,
    totalLikes: mergedHistory.filter(fb => fb.feedback === 'like').length,
    totalDislikes: mergedHistory.filter(fb => fb.feedback === 'dislike').length,
    lastUpdated: Date.now()
  });
}

/**
 * Clear all learning data for current user
 */
export function clearUserLearningData(): void {
  if (typeof window === 'undefined') return;
  
  const storageKey = getStorageKey();
  localStorage.removeItem(storageKey);
  
  // If authenticated, also clear from server
  if (isAuthenticated()) {
    fetch('/api/user/learning', { method: 'DELETE' }).catch(console.error);
  }
}

/**
 * Create empty state
 */
export function createEmptyState(): PreferenceLearningState {
  return {
    feedbackHistory: [],
    attributeWeights: { ...EMPTY_WEIGHTS },
    config: { ...DEFAULT_CONFIG },
    totalLikes: 0,
    totalDislikes: 0,
    lastUpdated: Date.now()
  };
}

// ============================================
// Core Learning Functions
// ============================================

/**
 * Record user feedback on a recommendation
 */
export function recordFeedback(
  state: PreferenceLearningState,
  attributes: MovieAttributes,
  feedback: FeedbackType,
  referenceMovieId?: number
): PreferenceLearningState {
  // Create feedback record
  const feedbackRecord: UserFeedback = {
    id: `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    mediaId: attributes.id,
    mediaType: attributes.type,
    title: attributes.title,
    feedback,
    attributes,
    referenceMovieId,
    timestamp: Date.now()
  };
  
  // Check if we already have feedback for this item (update instead of add)
  const existingIndex = state.feedbackHistory.findIndex(
    fb => fb.mediaId === attributes.id && fb.mediaType === attributes.type
  );
  
  let newHistory: UserFeedback[];
  if (existingIndex >= 0) {
    // Update existing feedback
    newHistory = [...state.feedbackHistory];
    const oldFeedback = newHistory[existingIndex].feedback;
    newHistory[existingIndex] = feedbackRecord;
    
    // Adjust counts
    const likesDelta = (feedback === 'like' ? 1 : 0) - (oldFeedback === 'like' ? 1 : 0);
    const dislikesDelta = (feedback === 'dislike' ? 1 : 0) - (oldFeedback === 'dislike' ? 1 : 0);
    
    return recalculateWeights({
      ...state,
      feedbackHistory: newHistory,
      totalLikes: state.totalLikes + likesDelta,
      totalDislikes: state.totalDislikes + dislikesDelta,
      lastUpdated: Date.now()
    });
  } else {
    // Add new feedback
    newHistory = [...state.feedbackHistory, feedbackRecord];
    
    return recalculateWeights({
      ...state,
      feedbackHistory: newHistory,
      totalLikes: state.totalLikes + (feedback === 'like' ? 1 : 0),
      totalDislikes: state.totalDislikes + (feedback === 'dislike' ? 1 : 0),
      lastUpdated: Date.now()
    });
  }
}

/**
 * Remove feedback for a specific item
 */
export function removeFeedback(
  state: PreferenceLearningState,
  mediaId: number,
  mediaType: 'movie' | 'tv'
): PreferenceLearningState {
  const existingIndex = state.feedbackHistory.findIndex(
    fb => fb.mediaId === mediaId && fb.mediaType === mediaType
  );
  
  if (existingIndex < 0) return state;
  
  const removed = state.feedbackHistory[existingIndex];
  const newHistory = state.feedbackHistory.filter((_, i) => i !== existingIndex);
  
  return recalculateWeights({
    ...state,
    feedbackHistory: newHistory,
    totalLikes: state.totalLikes - (removed.feedback === 'like' ? 1 : 0),
    totalDislikes: state.totalDislikes - (removed.feedback === 'dislike' ? 1 : 0),
    lastUpdated: Date.now()
  });
}

/**
 * Get feedback for a specific item
 */
export function getFeedback(
  state: PreferenceLearningState,
  mediaId: number,
  mediaType: 'movie' | 'tv'
): FeedbackType {
  const fb = state.feedbackHistory.find(
    f => f.mediaId === mediaId && f.mediaType === mediaType
  );
  return fb?.feedback || 'neutral';
}

/**
 * Recalculate all attribute weights from feedback history
 */
function recalculateWeights(state: PreferenceLearningState): PreferenceLearningState {
  const weights: AttributeWeights = {
    genres: {},
    languages: {},
    industries: {} as Record<CinemaIndustry, number>,
    eras: {} as Record<ReleaseEra, number>,
    narrativeScales: {},
    audienceTypes: {},
    themes: {} as Record<ThematicElement, number>
  };
  
  const { config, feedbackHistory } = state;
  const now = Date.now();
  
  // Count occurrences for normalization
  const genreCounts: Record<number, number> = {};
  const languageCounts: Record<string, number> = {};
  const industryCounts: Record<string, number> = {};
  const eraCounts: Record<string, number> = {};
  
  // Process each feedback with recency decay
  for (const fb of feedbackHistory) {
    if (fb.feedback === 'neutral') continue;
    
    // Calculate recency multiplier (older feedback has less weight)
    const ageInDays = (now - fb.timestamp) / (1000 * 60 * 60 * 24);
    const recencyMultiplier = Math.pow(config.decayFactor, ageInDays / 7); // Decay weekly
    
    // Direction: +1 for like, -1 for dislike
    const direction = fb.feedback === 'like' ? 1 : -1;
    const delta = direction * config.learningRate * recencyMultiplier;
    
    const attrs = fb.attributes;
    
    // Update genre weights
    for (const genreId of attrs.genreIds) {
      weights.genres[genreId] = (weights.genres[genreId] || 0) + delta;
      genreCounts[genreId] = (genreCounts[genreId] || 0) + 1;
    }
    
    // Update language weights
    if (attrs.originalLanguage) {
      weights.languages[attrs.originalLanguage] = 
        (weights.languages[attrs.originalLanguage] || 0) + delta;
      languageCounts[attrs.originalLanguage] = 
        (languageCounts[attrs.originalLanguage] || 0) + 1;
    }
    
    // Update industry weights
    if (attrs.industry) {
      weights.industries[attrs.industry] = 
        (weights.industries[attrs.industry] || 0) + delta;
      industryCounts[attrs.industry] = (industryCounts[attrs.industry] || 0) + 1;
    }
    
    // Update era weights
    if (attrs.releaseEra) {
      weights.eras[attrs.releaseEra] = 
        (weights.eras[attrs.releaseEra] || 0) + delta;
      eraCounts[attrs.releaseEra] = (eraCounts[attrs.releaseEra] || 0) + 1;
    }
    
    // Update theme weights
    if (attrs.themes) {
      for (const theme of attrs.themes) {
        weights.themes[theme] = (weights.themes[theme] || 0) + delta;
      }
    }
    
    // Update narrative scale weights
    if (attrs.narrativeScale) {
      weights.narrativeScales[attrs.narrativeScale] = 
        (weights.narrativeScales[attrs.narrativeScale] || 0) + delta;
    }
    
    // Update audience type weights
    if (attrs.audienceType) {
      weights.audienceTypes[attrs.audienceType] = 
        (weights.audienceTypes[attrs.audienceType] || 0) + delta;
    }
  }
  
  // Normalize and cap weights
  const capWeight = (w: number): number => 
    Math.max(-config.maxWeight, Math.min(config.maxWeight, w));
  
  for (const key of Object.keys(weights.genres)) {
    weights.genres[parseInt(key)] = capWeight(weights.genres[parseInt(key)]);
  }
  for (const key of Object.keys(weights.languages)) {
    weights.languages[key] = capWeight(weights.languages[key]);
  }
  for (const key of Object.keys(weights.industries)) {
    weights.industries[key as CinemaIndustry] = capWeight(weights.industries[key as CinemaIndustry]);
  }
  for (const key of Object.keys(weights.eras)) {
    weights.eras[key as ReleaseEra] = capWeight(weights.eras[key as ReleaseEra]);
  }
  for (const key of Object.keys(weights.themes)) {
    weights.themes[key as ThematicElement] = capWeight(weights.themes[key as ThematicElement]);
  }
  for (const key of Object.keys(weights.narrativeScales)) {
    weights.narrativeScales[key] = capWeight(weights.narrativeScales[key]);
  }
  for (const key of Object.keys(weights.audienceTypes)) {
    weights.audienceTypes[key] = capWeight(weights.audienceTypes[key]);
  }
  
  return {
    ...state,
    attributeWeights: weights
  };
}

// ============================================
// Personalization Scoring
// ============================================

/**
 * Calculate a personalized score for a candidate movie
 * This is used to re-rank recommendations while keeping reference similarity primary
 */
export function calculatePersonalizationScore(
  state: PreferenceLearningState,
  candidateAttributes: MovieAttributes,
  referenceScore: number // 0-100, from reference movie matching
): PersonalizationScore {
  const { attributeWeights, config, totalLikes, totalDislikes } = state;
  const totalFeedback = totalLikes + totalDislikes;
  
  // Default result when not enough feedback
  if (totalFeedback < config.minFeedbackThreshold) {
    return {
      referenceScore,
      preferenceAdjustment: 0,
      explorationBonus: calculateExplorationBonus(state, candidateAttributes),
      finalScore: referenceScore,
      preferenceConfidence: 'low',
      explanation: ['Not enough feedback yet for personalization']
    };
  }
  
  const explanation: string[] = [];
  let preferenceScore = 0;
  let attributeCount = 0;
  
  // Genre contribution
  for (const genreId of candidateAttributes.genreIds) {
    const weight = attributeWeights.genres[genreId];
    if (weight !== undefined) {
      preferenceScore += weight;
      attributeCount++;
      if (Math.abs(weight) > 0.3) {
        explanation.push(`${weight > 0 ? 'Liked' : 'Disliked'} genre`);
      }
    }
  }
  
  // Language contribution
  const langWeight = attributeWeights.languages[candidateAttributes.originalLanguage];
  if (langWeight !== undefined) {
    preferenceScore += langWeight * 1.5; // Language is weighted more heavily
    attributeCount++;
    if (Math.abs(langWeight) > 0.3) {
      explanation.push(`${langWeight > 0 ? 'Preferred' : 'Less preferred'} language`);
    }
  }
  
  // Industry contribution
  const industryWeight = attributeWeights.industries[candidateAttributes.industry];
  if (industryWeight !== undefined) {
    preferenceScore += industryWeight * 1.2;
    attributeCount++;
  }
  
  // Era contribution
  const eraWeight = attributeWeights.eras[candidateAttributes.releaseEra];
  if (eraWeight !== undefined) {
    preferenceScore += eraWeight;
    attributeCount++;
  }
  
  // Theme contributions
  if (candidateAttributes.themes) {
    for (const theme of candidateAttributes.themes) {
      const themeWeight = attributeWeights.themes[theme];
      if (themeWeight !== undefined) {
        preferenceScore += themeWeight * 0.5;
        attributeCount++;
      }
    }
  }
  
  // Normalize preference score to -30 to +30 range
  const normalizedPreference = attributeCount > 0
    ? (preferenceScore / attributeCount) * 30 / config.maxWeight
    : 0;
  
  // Apply preference influence cap
  const cappedPreference = normalizedPreference * config.preferenceInfluence;
  
  // Calculate exploration bonus for diverse recommendations
  const explorationBonus = calculateExplorationBonus(state, candidateAttributes);
  
  // Calculate final score: reference remains primary (75%), preference adjusts (25%)
  const finalScore = referenceScore + cappedPreference + explorationBonus;
  
  // Determine confidence
  const confidence: 'high' | 'medium' | 'low' = 
    totalFeedback >= 10 ? 'high' :
    totalFeedback >= 5 ? 'medium' : 'low';
  
  return {
    referenceScore,
    preferenceAdjustment: Math.round(cappedPreference * 10) / 10,
    explorationBonus,
    finalScore: Math.max(0, Math.min(100, finalScore)),
    preferenceConfidence: confidence,
    explanation: explanation.length > 0 ? explanation : ['Based on your feedback patterns']
  };
}

/**
 * Calculate exploration bonus to maintain diversity
 * Gives a small boost to items that are different from what the user usually likes
 */
function calculateExplorationBonus(
  state: PreferenceLearningState,
  attributes: MovieAttributes
): number {
  const { attributeWeights, config, totalLikes } = state;
  
  // No exploration needed without enough data
  if (totalLikes < 3) return 0;
  
  // Check if this is an "unexplored" combination
  let noveltyScore = 0;
  
  // Genres the user hasn't rated much
  let hasNovelGenre = false;
  for (const genreId of attributes.genreIds) {
    if (attributeWeights.genres[genreId] === undefined) {
      hasNovelGenre = true;
      break;
    }
  }
  if (hasNovelGenre) noveltyScore += 3;
  
  // Language user hasn't explored
  if (attributeWeights.languages[attributes.originalLanguage] === undefined) {
    noveltyScore += 3;
  }
  
  // Era user hasn't explored much
  if (attributeWeights.eras[attributes.releaseEra] === undefined) {
    noveltyScore += 2;
  }
  
  // Apply exploration factor
  return Math.min(10, noveltyScore * config.explorationFactor);
}

// ============================================
// Ranking Integration
// ============================================

/**
 * Re-rank a list of recommendations using personalization
 * Maintains reference similarity as primary while applying preference adjustments
 */
export function applyPersonalizedRanking<T extends { id: number }>(
  state: PreferenceLearningState,
  items: T[],
  getAttributes: (item: T) => MovieAttributes,
  getReferenceScore: (item: T) => number
): Array<T & { personalizationScore: PersonalizationScore }> {
  // Score each item
  const scored = items.map(item => ({
    ...item,
    personalizationScore: calculatePersonalizationScore(
      state,
      getAttributes(item),
      getReferenceScore(item)
    )
  }));
  
  // Sort by final score (descending)
  scored.sort((a, b) => b.personalizationScore.finalScore - a.personalizationScore.finalScore);
  
  // Ensure diversity in top results
  return ensureTopDiversity(scored, state);
}

/**
 * Ensure the top recommendations maintain diversity
 * Prevents echo chamber where all top results are too similar
 */
function ensureTopDiversity<T extends { personalizationScore: PersonalizationScore }>(
  items: T[],
  state: PreferenceLearningState
): T[] {
  // If not enough items or not enough feedback, return as-is
  if (items.length <= 5 || state.totalLikes < 5) return items;
  
  // Calculate target exploration slots
  const explorationFactor = state.config.explorationFactor;
  const topCount = Math.min(10, items.length);
  const explorationSlots = Math.max(1, Math.floor(topCount * explorationFactor));
  
  // Find items with high exploration bonus that aren't already in top positions
  const top = items.slice(0, topCount);
  const rest = items.slice(topCount);
  
  // Find exploratory items from rest of list
  const exploratory = rest
    .filter(item => item.personalizationScore.explorationBonus >= 2)
    .slice(0, explorationSlots);
  
  if (exploratory.length === 0) return items;
  
  // Insert exploratory items into positions 5-10
  const insertPosition = Math.min(5, topCount - explorationSlots);
  const result = [
    ...top.slice(0, insertPosition),
    ...exploratory,
    ...top.slice(insertPosition, topCount - exploratory.length),
    ...rest.filter(item => !exploratory.includes(item))
  ];
  
  return result;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get a summary of learned preferences for display
 */
export function getPreferenceSummary(state: PreferenceLearningState): {
  likedGenres: number[];
  dislikedGenres: number[];
  likedLanguages: string[];
  preferredEras: ReleaseEra[];
  totalFeedback: number;
  learningActive: boolean;
} {
  const { attributeWeights, totalLikes, totalDislikes, config } = state;
  
  // Extract liked/disliked genres (threshold: 0.3)
  const likedGenres = Object.entries(attributeWeights.genres)
    .filter(([, w]) => w >= 0.3)
    .map(([id]) => parseInt(id));
  
  const dislikedGenres = Object.entries(attributeWeights.genres)
    .filter(([, w]) => w <= -0.3)
    .map(([id]) => parseInt(id));
  
  // Extract preferred languages
  const likedLanguages = Object.entries(attributeWeights.languages)
    .filter(([, w]) => w >= 0.3)
    .map(([lang]) => lang);
  
  // Extract preferred eras
  const preferredEras = Object.entries(attributeWeights.eras)
    .filter(([, w]) => w >= 0.2)
    .map(([era]) => era as ReleaseEra);
  
  const totalFeedback = totalLikes + totalDislikes;
  
  return {
    likedGenres,
    dislikedGenres,
    likedLanguages,
    preferredEras,
    totalFeedback,
    learningActive: totalFeedback >= config.minFeedbackThreshold
  };
}

/**
 * Reset all learning data
 */
export function resetLearning(): PreferenceLearningState {
  const emptyState = createEmptyState();
  saveLearningState(emptyState);
  return emptyState;
}

/**
 * Update learning configuration
 */
export function updateConfig(
  state: PreferenceLearningState,
  updates: Partial<LearningConfig>
): PreferenceLearningState {
  return {
    ...state,
    config: { ...state.config, ...updates },
    lastUpdated: Date.now()
  };
}

/**
 * Extract movie attributes from a movie object
 */
export function extractAttributesFromMovie(
  movie: {
    id: number;
    title?: string;
    name?: string;
    original_language: string;
    genre_ids: number[];
    release_date?: string;
    first_air_date?: string;
    vote_average: number;
    popularity: number;
  },
  type: 'movie' | 'tv',
  industry?: CinemaIndustry
): MovieAttributes {
  const releaseDate = type === 'movie' ? movie.release_date : movie.first_air_date;
  const releaseYear = releaseDate ? parseInt(releaseDate.substring(0, 4), 10) : null;
  
  // Infer industry from language if not provided
  const inferredIndustry = industry || inferIndustryFromLanguage(movie.original_language);
  
  return {
    id: movie.id,
    title: movie.title || movie.name || 'Unknown',
    type,
    genreIds: movie.genre_ids,
    originalLanguage: movie.original_language,
    industry: inferredIndustry,
    releaseEra: calculateReleaseEra(releaseYear),
    releaseYear,
    voteAverage: movie.vote_average,
    popularity: movie.popularity
  };
}

/**
 * Infer cinema industry from language
 */
function inferIndustryFromLanguage(language: string): CinemaIndustry {
  const langToIndustry: Record<string, CinemaIndustry> = {
    'hi': 'bollywood',
    'te': 'tollywood',
    'ta': 'kollywood',
    'ml': 'mollywood',
    'kn': 'sandalwood',
    'bn': 'indian-other',
    'mr': 'indian-other',
    'pa': 'indian-other',
    'en': 'hollywood',
    'ko': 'korean',
    'ja': 'japanese',
    'zh': 'chinese',
    'es': 'other',
    'fr': 'other'
  };
  
  return langToIndustry[language] || 'other';
}
