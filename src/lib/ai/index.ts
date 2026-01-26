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
  getSmartFollowUps,
  generateMovieMatchClarification,
  generateDisambiguationMessage,
  generateYearClarification
} from './ambiguityDetection';
export type { AmbiguityAnalysis, ClarifyingQuestion, QuickOption } from './ambiguityDetection';

// Reference Movie Analysis (Cultural Context) - Enhanced Strict Matching with Optional Year
export {
  analyzeReferenceFromQuery,
  findReferenceMovie,
  analyzeReferenceMovie,
  generateCulturalFilters,
  extractReferenceTitle,
  extractReferenceTitleWithYear,
  generateSimilarMovieIntro,
  generateMatchJustification,
  generateMatchExplanation,
  calculateReleaseEra,
  getEraYearRange,
  calculateEraSimilarity
} from './referenceMovieAnalyzer';
export type { 
  ReferenceMovieInfo, 
  CinemaIndustry, 
  CulturalFilterRules,
  CinematicProfile,
  ThematicElement,
  ExtractedReference,
  ReleaseEra
} from './referenceMovieAnalyzer';

// Confidence Scoring
export {
  calculateConfidenceScore,
  shouldProceedWithRecommendations,
  getClarificationMessage,
  getRecommendationStrictness
} from './confidenceScoring';
export type {
  ConfidenceLevel,
  ConfidenceScore,
  ConfidenceFactors,
  ConfidenceBehavior,
  AlternativeMatch,
  MatchContext
} from './confidenceScoring';

// Preference Learning
export {
  loadLearningState,
  saveLearningState,
  recordFeedback,
  removeFeedback,
  getFeedback,
  calculatePersonalizationScore,
  applyPersonalizedRanking,
  getPreferenceSummary,
  resetLearning,
  updateConfig,
  extractAttributesFromMovie
} from './preferenceLearning';
export type {
  FeedbackType,
  MovieAttributes,
  UserFeedback,
  AttributeWeights,
  PreferenceLearningState,
  LearningConfig,
  PersonalizationScore
} from './preferenceLearning';
