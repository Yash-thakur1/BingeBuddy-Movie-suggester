/**
 * AI Chat Service
 * 
 * Main orchestration layer for the AI chat assistant.
 * Handles message processing, query execution, and response formatting.
 * Enhanced with diversity scoring, history tracking, ambiguity detection,
 * and cultural context awareness for "movies like X" queries.
 */

import { parseIntent, ParsedIntent } from './intentParser';
import { generateQueries, QueryResult, MovieQuery, buildTMDBParams } from './queryGenerator';
import { getSmartFallback } from './fallbackRecommendations';
import { 
  getRecommendationHistory, 
  resetRecommendationHistory,
  RecommendedItem,
  FilterRules
} from './recommendationHistory';
import { 
  scoreAndRankItems
} from './diversityScoring';
import { 
  analyzeAmbiguity, 
  generateClarificationResponse,
  isVarietyRequest,
  getSmartFollowUps,
  AmbiguityAnalysis
} from './ambiguityDetection';
import {
  analyzeReferenceFromQuery,
  CulturalFilterRules
} from './referenceMovieAnalyzer';
import { 
  getTrendingMovies, 
  getTopRatedMovies, 
  discoverMovies, 
  searchMovies,
  getTrendingTVShows,
  getTopRatedTVShows,
  discoverTVShows,
  searchTVShows
} from '@/lib/tmdb/api';
import { Movie, TVShow, PaginatedResponse } from '@/types/movie';
import { GENRES, TV_GENRES, QUICK_MOODS } from '@/lib/tmdb/config';

// ============================================
// Types
// ============================================

export type MessageRole = 'user' | 'assistant' | 'system';

export interface MediaItem {
  id: number;
  type: 'movie' | 'tv';
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string;
  releaseDate: string | null;
  voteAverage: number;
  genreIds: number[];
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  
  // Optional media attachments
  media?: MediaItem[];
  
  // Metadata about how the response was generated
  metadata?: {
    intent?: ParsedIntent;
    queryType?: string;
    source?: string;
    isLoading?: boolean;
    error?: string;
  };
}

export interface ChatResponse {
  message: ChatMessage;
  suggestedFollowUps?: string[];
}

// ============================================
// Helpers
// ============================================

/**
 * Generate a unique message ID
 */
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Convert Movie to MediaItem
 */
function movieToMediaItem(movie: Movie): MediaItem {
  return {
    id: movie.id,
    type: 'movie',
    title: movie.title,
    posterPath: movie.poster_path,
    backdropPath: movie.backdrop_path,
    overview: movie.overview,
    releaseDate: movie.release_date,
    voteAverage: movie.vote_average,
    genreIds: movie.genre_ids
  };
}

/**
 * Convert TVShow to MediaItem
 */
function tvShowToMediaItem(show: TVShow): MediaItem {
  return {
    id: show.id,
    type: 'tv',
    title: show.name,
    posterPath: show.poster_path,
    backdropPath: show.backdrop_path,
    overview: show.overview,
    releaseDate: show.first_air_date || null,
    voteAverage: show.vote_average,
    genreIds: show.genre_ids
  };
}

/**
 * Get genre names for media item
 */
export function getGenreNames(genreIds: number[], mediaType: 'movie' | 'tv'): string[] {
  const genreList = mediaType === 'tv' ? TV_GENRES : GENRES;
  const names: string[] = [];
  
  for (const id of genreIds) {
    const genre = genreList.find(g => g.id === id);
    if (genre) {
      names.push(genre.name);
    }
  }
  
  return names;
}

/**
 * Format a friendly time description
 */
function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// ============================================
// Query Execution
// ============================================

/**
 * Execute a single query and get results
 * Uses fetchMultiplier to get more results for diversity filtering
 */
async function executeQuery(query: MovieQuery): Promise<MediaItem[]> {
  try {
    let response: PaginatedResponse<Movie | TVShow>;
    const multiplier = query.fetchMultiplier || 1;
    const fetchLimit = (query.limit || 6) * multiplier;
    
    switch (query.type) {
      case 'trending':
        if (query.mediaType === 'movie') {
          response = await getTrendingMovies('week', query.page || 1);
        } else {
          response = await getTrendingTVShows('week', query.page || 1);
        }
        break;
      
      case 'top_rated':
        if (query.mediaType === 'movie') {
          response = await getTopRatedMovies(query.page || 1);
        } else {
          response = await getTopRatedTVShows(query.page || 1);
        }
        break;
      
      case 'search':
        if (query.mediaType === 'movie') {
          response = await searchMovies(query.query || '', query.page || 1);
        } else {
          response = await searchTVShows(query.query || '', query.page || 1);
        }
        break;
      
      case 'discover':
      default:
        const params = buildTMDBParams(query);
        if (query.mediaType === 'movie') {
          response = await discoverMovies(params as Record<string, string | number | undefined>);
        } else {
          response = await discoverTVShows(params as Record<string, string | number | undefined>);
        }
        break;
    }
    
    // Return more results for diversity scoring
    const results = response.results.slice(0, fetchLimit);
    
    return results.map(item => {
      if ('title' in item) {
        return movieToMediaItem(item as Movie);
      }
      return tvShowToMediaItem(item as TVShow);
    });
  } catch (error) {
    console.error('Query execution error:', error);
    return [];
  }
}

/**
 * Execute all queries and combine results with diversity scoring
 * Falls back to trending content if no results found
 */
async function executeQueries(
  queryResult: QueryResult, 
  intent: ParsedIntent,
  applyDiversity: boolean = true
): Promise<{ media: MediaItem[]; usedFallback: boolean }> {
  if (queryResult.queries.length === 0) {
    return { media: [], usedFallback: false };
  }
  
  // Execute queries in parallel
  const results = await Promise.all(
    queryResult.queries.map(query => executeQuery(query))
  );
  
  // Flatten and deduplicate results
  const allMedia = results.flat();
  const seen = new Set<string>();
  let uniqueMedia: MediaItem[] = [];
  
  for (const item of allMedia) {
    const key = `${item.type}-${item.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueMedia.push(item);
    }
  }
  
  // Apply diversity scoring if enabled and we have enough items
  if (applyDiversity && uniqueMedia.length > 0) {
    const history = getRecommendationHistory();
    const filterRules = history.generateFilterRules();
    const targetCount = Math.min(queryResult.queries[0]?.limit || 6, uniqueMedia.length);
    
    // Score and rank items based on diversity criteria
    // scoreAndRankItems already handles batch diversity internally
    uniqueMedia = scoreAndRankItems(uniqueMedia, history, filterRules, targetCount);
  }
  
  // If no results, use fallback recommendations
  if (uniqueMedia.length === 0) {
    try {
      const fallback = await getSmartFallback({
        genres: intent.genres,
        moods: intent.moods,
        mediaType: intent.mediaType,
        wasError: false
      });
      return { media: fallback.items, usedFallback: true };
    } catch {
      return { media: [], usedFallback: true };
    }
  }
  
  return { media: uniqueMedia.slice(0, 12), usedFallback: false };
}

// ============================================
// Response Generation
// ============================================

/**
 * Format the assistant's response text
 */
function formatResponseText(queryResult: QueryResult, mediaCount: number): string {
  const { responseContext } = queryResult;
  
  if (mediaCount === 0) {
    return `${responseContext.intro}\n\nI couldn't find anything matching your criteria. ${responseContext.followUp}`;
  }
  
  let text = responseContext.intro;
  
  if (responseContext.explanation) {
    text += `\n\n${responseContext.explanation}`;
  }
  
  return text;
}

/**
 * Generate suggested follow-up questions
 */
function generateFollowUps(intent: ParsedIntent): string[] {
  const followUps: string[] = [];
  
  // Based on media type
  if (intent.mediaType === 'movie') {
    followUps.push('Show me some TV series instead');
  } else if (intent.mediaType === 'tv') {
    followUps.push('Show me some movies instead');
  }
  
  // Based on intent type
  if (intent.type === 'trending') {
    followUps.push('Show me top-rated classics');
    followUps.push('Find me something by genre');
  } else if (intent.type === 'top_rated') {
    followUps.push('What\'s trending now?');
    followUps.push('Something from the 90s');
  } else if (intent.type === 'recommend') {
    followUps.push('Something more exciting');
    followUps.push('More emotional picks');
  }
  
  // Mood-based suggestions
  if (intent.moods.length === 0) {
    const moodSuggestions = ['I\'m feeling adventurous', 'Something relaxing', 'Make me laugh'];
    followUps.push(moodSuggestions[Math.floor(Math.random() * moodSuggestions.length)]);
  }
  
  // Genre suggestions if no genres specified
  if (intent.genres.length === 0) {
    const randomMood = QUICK_MOODS[Math.floor(Math.random() * QUICK_MOODS.length)];
    followUps.push(randomMood.label);
  }
  
  return followUps.slice(0, 3);
}

// ============================================
// Main Chat Processing
// ============================================

/**
 * Track current conversation turn for history
 */
let currentTurnIndex = 0;

/**
 * Reset conversation state (call when starting new chat)
 */
export function resetConversation(): void {
  currentTurnIndex = 0;
  resetRecommendationHistory();
}

/**
 * Add recommended items to history for tracking
 */
function trackRecommendedItems(media: MediaItem[]): void {
  const history = getRecommendationHistory();
  history.addRecommendations(media);
}

/**
 * Process a user message and generate a response
 * Enhanced with ambiguity detection, diversity scoring, and history tracking
 */
export async function processMessage(userMessage: string): Promise<ChatResponse> {
  // Increment turn counter
  currentTurnIndex++;
  
  // Start new turn in history (handles cooldown decrements)
  const history = getRecommendationHistory();
  history.startNewTurn();

  // Parse user intent
  const intent = parseIntent(userMessage);
  
  // Check for ambiguity before processing
  const ambiguityAnalysis = analyzeAmbiguity(intent, history);
  
  // If ambiguity is too high and user isn't asking for variety, ask for clarification
  if (ambiguityAnalysis.ambiguityScore > 0.7 && !isVarietyRequest(userMessage)) {
    const clarificationResult = generateClarificationResponse(ambiguityAnalysis);
    
    const message: ChatMessage = {
      id: generateMessageId(),
      role: 'assistant',
      content: clarificationResult.message,
      timestamp: new Date(),
      metadata: {
        intent,
        source: 'clarification'
      }
    };
    
    // Use options from clarification as follow-ups
    const smartFollowUps = clarificationResult.options.map(opt => opt.value);
    
    return {
      message,
      suggestedFollowUps: smartFollowUps.length > 0 ? smartFollowUps : getSmartFollowUps(intent, history, [])
    };
  }
  
  // Get filter rules from history
  const filterRules = history.generateFilterRules();
  
  // Analyze reference movie for cultural context (e.g., "movies like Baahubali")
  let culturalFilters: CulturalFilterRules | undefined;
  if (intent.hasReferenceMovie && intent.referenceTitle) {
    const refAnalysis = await analyzeReferenceFromQuery(userMessage);
    if (refAnalysis) {
      culturalFilters = refAnalysis.filters;
      // Use analyzed genres from reference movie if user didn't specify any
      if (refAnalysis.info.genres.length > 0 && intent.genres.length === 0) {
        intent.genres = refAnalysis.info.genres.slice(0, 3); // Take top 3 genres
      }
    }
  }
  
  // Generate queries based on intent with filter rules and cultural context
  const queryResult = generateQueries(intent, filterRules, culturalFilters);
  
  // Execute queries with diversity scoring
  const { media, usedFallback } = await executeQueries(queryResult, intent, true);
  
  // Track recommended items in history
  if (media.length > 0) {
    trackRecommendedItems(media);
  }
  
  // Format response text
  let responseText = formatResponseText(queryResult, media.length);
  
  // Add fallback note if applicable
  if (usedFallback && media.length > 0) {
    responseText = `I couldn't find an exact match, but here are some recommendations you might enjoy:\n\n${queryResult.responseContext.followUp}`;
  }
  
  // Add diversity note if we used history to filter
  const excludedCount = filterRules.excludeIds.size;
  if (excludedCount > 0 && media.length > 0) {
    responseText += `\n\n_These are fresh picks - avoiding ${excludedCount} titles I already recommended._`;
  }
  
  // Generate follow-up suggestions (use smart follow-ups if ambiguity detected)
  let suggestedFollowUps: string[];
  // Collect genres from recommended media
  const recommendedGenres = media.flatMap(m => m.genreIds).filter((v, i, a) => a.indexOf(v) === i);
  if (ambiguityAnalysis.ambiguityScore > 0.3) {
    suggestedFollowUps = getSmartFollowUps(intent, history, recommendedGenres);
  } else {
    suggestedFollowUps = generateFollowUps(intent);
  }
  
  // Create response message
  const message: ChatMessage = {
    id: generateMessageId(),
    role: 'assistant',
    content: responseText,
    timestamp: new Date(),
    media: media.length > 0 ? media : undefined,
    metadata: {
      intent,
      queryType: queryResult.queries[0]?.type,
      source: usedFallback ? 'fallback' : queryResult.queries[0]?.source
    }
  };
  
  return {
    message,
    suggestedFollowUps
  };
}

/**
 * Create a user message object
 */
export function createUserMessage(content: string): ChatMessage {
  return {
    id: generateMessageId(),
    role: 'user',
    content,
    timestamp: new Date()
  };
}

/**
 * Create a welcome message
 */
export function createWelcomeMessage(): ChatMessage {
  const greeting = getTimeGreeting();
  
  return {
    id: generateMessageId(),
    role: 'assistant',
    content: `${greeting}! 👋 I'm your personal movie & TV discovery assistant.\n\nTell me what you're in the mood for, and I'll find the perfect thing to watch. You can say things like:\n\n• "I want something exciting"\n• "Show me romantic comedies from the 90s"\n• "What's trending this week?"\n• "I need a good thriller series"\n\nWhat are you in the mood for today?`,
    timestamp: new Date(),
    metadata: {
      source: 'welcome'
    }
  };
}

/**
 * Create a loading message placeholder
 */
export function createLoadingMessage(): ChatMessage {
  return {
    id: generateMessageId(),
    role: 'assistant',
    content: 'Searching for the perfect picks...',
    timestamp: new Date(),
    metadata: {
      isLoading: true
    }
  };
}

/**
 * Create an error message
 */
export function createErrorMessage(error: string): ChatMessage {
  return {
    id: generateMessageId(),
    role: 'assistant',
    content: `Oops! Something went wrong. ${error}\n\nLet me try with some trending picks instead.`,
    timestamp: new Date(),
    metadata: {
      error
    }
  };
}

// ============================================
// Quick Actions
// ============================================

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  prompt: string;
}

export const QUICK_ACTIONS: QuickAction[] = [
  { id: 'trending', label: 'Trending Now', icon: '🔥', prompt: 'What\'s trending right now?' },
  { id: 'action', label: 'Action Packed', icon: '💥', prompt: 'I want something action-packed and exciting' },
  { id: 'comedy', label: 'Make Me Laugh', icon: '😂', prompt: 'I need something funny to watch' },
  { id: 'romance', label: 'Romantic', icon: '💕', prompt: 'Show me some romantic movies' },
  { id: 'thriller', label: 'Thrilling', icon: '😰', prompt: 'I want an intense thriller' },
  { id: 'classic', label: 'Classic Hits', icon: '🎬', prompt: 'Show me some classic all-time favorites' },
  { id: 'scifi', label: 'Sci-Fi', icon: '🚀', prompt: 'I\'m in the mood for science fiction' },
  { id: 'tv', label: 'TV Series', icon: '📺', prompt: 'Recommend some binge-worthy TV series' },
];

export default {
  processMessage,
  createUserMessage,
  createWelcomeMessage,
  createLoadingMessage,
  createErrorMessage,
  resetConversation,
  QUICK_ACTIONS
};
