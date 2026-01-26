/**
 * AI Chat Module - Public Exports
 */

export { parseIntent, mapMoodsToGenres } from './intentParser';
export type { ParsedIntent, IntentType, MediaType } from './intentParser';

export { generateQueries, buildTMDBParams } from './queryGenerator';
export type { MovieQuery, QueryResult } from './queryGenerator';

export { 
  processMessage, 
  createUserMessage, 
  createWelcomeMessage,
  createLoadingMessage,
  createErrorMessage,
  getGenreNames,
  resetConversation,
  QUICK_ACTIONS 
} from './chatService';
export type { 
  ChatMessage, 
  ChatResponse, 
  MessageRole, 
  MediaItem,
  QuickAction
} from './chatService';

export {
  getTrendingFallback,
  getGenreFallback,
  getMoodFallback,
  getTopRatedFallback,
  getSurpriseFallback,
  getSmartFallback
} from './fallbackRecommendations';
export type { FallbackResult } from './fallbackRecommendations';

// Recommendation History
export {
  getRecommendationHistory,
  resetRecommendationHistory,
  RecommendationHistory
} from './recommendationHistory';
export type { RecommendedItem, FilterRules } from './recommendationHistory';

// Diversity Scoring
export {
  scoreItem,
  scoreAndRankItems,
  ensureBatchDiversity,
  getDiversitySummary
} from './diversityScoring';
export type { ScoredItem, DiversityConfig } from './diversityScoring';

// Ambiguity Detection
export {
  analyzeAmbiguity,
  generateClarificationResponse,
  isVarietyRequest,
  isRefinementRequest,
  extractRefinements,
  getSmartFollowUps
} from './ambiguityDetection';
export type { AmbiguityAnalysis, ClarifyingQuestion, QuickOption } from './ambiguityDetection';

// Reference Movie Analysis (Cultural Context)
export {
  analyzeReferenceFromQuery,
  findReferenceMovie,
  analyzeReferenceMovie,
  generateCulturalFilters,
  extractReferenceTitle
} from './referenceMovieAnalyzer';
export type { 
  ReferenceMovieInfo, 
  CinemaIndustry, 
  CulturalFilterRules 
} from './referenceMovieAnalyzer';
