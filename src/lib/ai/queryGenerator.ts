/**
 * Query Generator for AI Chat Assistant
 * 
 * Converts parsed intents into structured queries that can be used
 * with the existing TMDB API and recommendation engine.
 * Now includes filter rules for deduplication and diversity.
 * Enhanced with cultural context awareness for "movies like X" queries.
 */

import { ParsedIntent, mapMoodsToGenres } from './intentParser';
import { ERA_PRESETS, GENRES, TV_GENRES } from '@/lib/tmdb/config';
import { FilterRules } from './recommendationHistory';
import { CulturalFilterRules, getEraYearRange, calculateEraSimilarity } from './referenceMovieAnalyzer';

export interface MovieQuery {
  type: 'discover' | 'search' | 'trending' | 'top_rated' | 'similar' | 'watchlist';
  mediaType: 'movie' | 'tv';
  
  // Discovery parameters
  genres?: number[];
  excludeGenres?: number[]; // Genres to avoid
  year?: number;
  yearRange?: { from: number; to: number };
  minRating?: number;
  maxRating?: number; // For hidden gems
  sortBy?: string;
  
  // Search parameters
  query?: string;
  
  // Similar content
  similarTo?: number; // Movie/TV ID
  
  // Pagination
  page?: number;
  limit?: number;
  
  // Additional filters
  includeAdult?: boolean;
  language?: string;
  
  // Cultural/language filters (for "movies like X" queries)
  withOriginalLanguage?: string;  // ISO 639-1 language code
  withoutOriginalLanguage?: string;  // Language to exclude
  region?: string;  // ISO 3166-1 country code
  
  // Source info for response formatting
  source: 'mood' | 'genre' | 'search' | 'trending' | 'top_rated' | 'similar' | 'random' | 'variety' | 'cultural';
  
  // Fetch more for diversity filtering
  fetchMultiplier?: number; // Fetch N times more results for filtering
  
  // Cultural context
  culturalContext?: CulturalFilterRules;
}

export interface QueryResult {
  queries: MovieQuery[];
  responseContext: {
    intro: string;
    explanation: string;
    followUp: string;
  };
  // Structured filter rules for the recommendation engine
  filterRules?: FilterRules;
  // Cultural filters for reference movie queries
  culturalFilters?: CulturalFilterRules;
  // Whether this is a clarification request
  needsClarification?: boolean;
  clarificationMessage?: string;
}

/**
 * Generate queries based on parsed intent
 * Now accepts optional cultural filters for "movies like X" queries
 */
export function generateQueries(
  intent: ParsedIntent, 
  filterRules?: FilterRules,
  culturalFilters?: CulturalFilterRules
): QueryResult {
  switch (intent.type) {
    case 'recommend':
    case 'mood':
      return generateRecommendationQueries(intent, filterRules);
    
    case 'search':
      return generateSearchQueries(intent);
    
    case 'trending':
      return generateTrendingQueries(intent, filterRules);
    
    case 'top_rated':
      return generateTopRatedQueries(intent, filterRules);
    
    case 'similar':
      return generateSimilarQueries(intent, filterRules, culturalFilters);
    
    case 'genre':
      return generateGenreQueries(intent, filterRules);
    
    case 'watchlist':
      return generateWatchlistQueries(intent);
    
    case 'greeting':
    case 'thanks':
    case 'unknown':
    default:
      // For non-actionable intents, return trending as fallback
      return generateFallbackQueries(intent);
  }
}

/**
 * Combine arrays and remove duplicates
 */
function uniqueNumbers(arr: number[]): number[] {
  const seen = new Set<number>();
  const result: number[] = [];
  for (const num of arr) {
    if (!seen.has(num)) {
      seen.add(num);
      result.push(num);
    }
  }
  return result;
}

/**
 * Get genres on cooldown from filter rules
 */
function getCooldownGenres(filterRules?: FilterRules): number[] {
  if (!filterRules) return [];
  const cooldownGenres: number[] = [];
  filterRules.cooldownGenres.forEach((turns, genreId) => {
    if (turns > 0) {
      cooldownGenres.push(genreId);
    }
  });
  return cooldownGenres;
}

/**
 * Generate recommendation queries based on mood and preferences
 * Now includes diversity filtering
 */
function generateRecommendationQueries(intent: ParsedIntent, filterRules?: FilterRules): QueryResult {
  const queries: MovieQuery[] = [];
  
  // Combine explicit genres with mood-derived genres
  let genres = [...intent.genres];
  if (intent.moods.length > 0) {
    const moodGenres = mapMoodsToGenres(intent.moods, intent.mediaType);
    genres = uniqueNumbers([...genres, ...moodGenres]);
  }
  
  // Get genres to exclude (on cooldown)
  const excludeGenres = getCooldownGenres(filterRules);
  
  // If primary genres are on cooldown, try secondary genres
  if (filterRules && genres.length > 0) {
    const cooldownSet = new Set(excludeGenres);
    const availableGenres = genres.filter(g => !cooldownSet.has(g));
    
    // If all requested genres are on cooldown, use them anyway but note it
    if (availableGenres.length > 0) {
      genres = availableGenres;
    }
  }
  
  // Get year range from era
  let yearRange: { from: number; to: number } | undefined;
  if (intent.era) {
    const eraConfig = ERA_PRESETS[intent.era];
    if (eraConfig.from && eraConfig.to) {
      yearRange = { from: eraConfig.from, to: eraConfig.to };
    }
  } else if (filterRules && filterRules.preferredEras.length > 0) {
    // Use preferred era from filter rules if no explicit era
    const preferredEra = filterRules.preferredEras[0];
    if (preferredEra in ERA_PRESETS) {
      const eraConfig = ERA_PRESETS[preferredEra as keyof typeof ERA_PRESETS];
      if (eraConfig.from && eraConfig.to) {
        yearRange = { from: eraConfig.from, to: eraConfig.to };
      }
    }
  }
  
  // Determine rating range for variety
  let minRating = intent.minRating || undefined;
  let maxRating: number | undefined;
  
  if (filterRules) {
    const { min, max } = filterRules.preferredPopularityRange;
    if (min > 0) minRating = min;
    if (max < 10) maxRating = max;
  }
  
  // Generate query based on media type
  const mediaTypes: ('movie' | 'tv')[] = 
    intent.mediaType === 'both' ? ['movie', 'tv'] : [intent.mediaType];
  
  for (const mediaType of mediaTypes) {
    queries.push({
      type: 'discover',
      mediaType,
      genres: genres.length > 0 ? genres : undefined,
      excludeGenres: excludeGenres.length > 0 ? excludeGenres : undefined,
      year: intent.year || undefined,
      yearRange,
      minRating,
      maxRating,
      sortBy: 'popularity.desc',
      page: 1,
      limit: 6,
      source: intent.moods.length > 0 ? 'mood' : 'genre',
      fetchMultiplier: filterRules ? 3 : 1 // Fetch more for diversity filtering
    });
  }
  
  // Build response context
  const genreList = intent.mediaType === 'tv' ? TV_GENRES : GENRES;
  const genreNames = genres
    .map(id => genreList.find(g => g.id === id)?.name)
    .filter(Boolean)
    .slice(0, 3);
  
  const moodDescription = intent.moods.length > 0 
    ? `Based on your ${intent.moods.join(' and ')} mood`
    : '';
  
  const genreDescription = genreNames.length > 0
    ? `in the ${genreNames.join(', ')} ${genreNames.length > 1 ? 'genres' : 'genre'}`
    : '';
  
  const eraDescription = intent.era 
    ? `from the ${intent.era === 'latest' ? 'latest releases' : intent.era}`
    : '';
  
  return {
    queries,
    responseContext: {
      intro: intent.responseHint,
      explanation: [moodDescription, genreDescription, eraDescription]
        .filter(Boolean)
        .join(' ') || 'Here are some picks I think you\'ll enjoy!',
      followUp: 'Would you like me to find something more specific? Just tell me what you\'re in the mood for!'
    }
  };
}

/**
 * Generate search queries
 */
function generateSearchQueries(intent: ParsedIntent): QueryResult {
  const queries: MovieQuery[] = [];
  
  // Use keywords as search query
  const searchQuery = intent.keywords.join(' ') || intent.originalMessage;
  
  const mediaTypes: ('movie' | 'tv')[] = 
    intent.mediaType === 'both' ? ['movie', 'tv'] : [intent.mediaType];
  
  for (const mediaType of mediaTypes) {
    queries.push({
      type: 'search',
      mediaType,
      query: searchQuery,
      page: 1,
      limit: 6,
      source: 'search'
    });
  }
  
  return {
    queries,
    responseContext: {
      intro: 'Here\'s what I found:',
      explanation: `Searching for "${searchQuery}"`,
      followUp: 'Is this what you were looking for? I can help narrow it down!'
    }
  };
}

/**
 * Generate trending content queries
 */
function generateTrendingQueries(intent: ParsedIntent, filterRules?: FilterRules): QueryResult {
  const queries: MovieQuery[] = [];
  
  const mediaTypes: ('movie' | 'tv')[] = 
    intent.mediaType === 'both' ? ['movie', 'tv'] : [intent.mediaType];
  
  // Get genres to avoid if on cooldown
  const excludeGenres = getCooldownGenres(filterRules);
  
  for (const mediaType of mediaTypes) {
    queries.push({
      type: 'trending',
      mediaType,
      genres: intent.genres.length > 0 ? intent.genres : undefined,
      excludeGenres: excludeGenres.length > 0 ? excludeGenres : undefined,
      page: 1,
      limit: 6,
      source: 'trending',
      fetchMultiplier: filterRules ? 2 : 1
    });
  }
  
  return {
    queries,
    responseContext: {
      intro: '🔥 Here\'s what\'s trending right now:',
      explanation: 'These are the most popular titles everyone\'s watching!',
      followUp: 'Want me to filter by genre or show you all-time favorites instead?'
    }
  };
}

/**
 * Generate top rated content queries
 */
function generateTopRatedQueries(intent: ParsedIntent, filterRules?: FilterRules): QueryResult {
  const queries: MovieQuery[] = [];
  
  const mediaTypes: ('movie' | 'tv')[] = 
    intent.mediaType === 'both' ? ['movie', 'tv'] : [intent.mediaType];
  
  let yearRange: { from: number; to: number } | undefined;
  if (intent.era) {
    const eraConfig = ERA_PRESETS[intent.era];
    if (eraConfig.from && eraConfig.to) {
      yearRange = { from: eraConfig.from, to: eraConfig.to };
    }
  }
  
  // Get genres to avoid if on cooldown
  const excludeGenres = getCooldownGenres(filterRules);
  
  for (const mediaType of mediaTypes) {
    queries.push({
      type: 'top_rated',
      mediaType,
      genres: intent.genres.length > 0 ? intent.genres : undefined,
      excludeGenres: excludeGenres.length > 0 ? excludeGenres : undefined,
      yearRange,
      minRating: 8,
      sortBy: 'vote_average.desc',
      page: 1,
      limit: 6,
      source: 'top_rated',
      fetchMultiplier: filterRules ? 2 : 1
    });
  }
  
  return {
    queries,
    responseContext: {
      intro: '⭐ Here are some of the highest-rated titles:',
      explanation: 'These are critically acclaimed and fan favorites!',
      followUp: 'Looking for something specific? Tell me a genre or mood!'
    }
  };
}

/**
 * Generate similar content queries with STRICT cultural matching
 * Treats the reference movie as a strict template, not loose inspiration
 */
function generateSimilarQueries(
  intent: ParsedIntent, 
  filterRules?: FilterRules,
  culturalFilters?: CulturalFilterRules
): QueryResult {
  const queries: MovieQuery[] = [];
  
  const mediaTypes: ('movie' | 'tv')[] = 
    intent.mediaType === 'both' ? ['movie', 'tv'] : [intent.mediaType];
  
  // Get genres to avoid if on cooldown
  const excludeGenres = getCooldownGenres(filterRules);
  
  // STRICT MODE: When we have cultural context, apply hard filtering
  if (culturalFilters) {
    return generateStrictCulturalQueries(intent, mediaTypes, excludeGenres, culturalFilters);
  }
  
  // Fallback to standard similar queries
  for (const mediaType of mediaTypes) {
    const query: MovieQuery = {
      type: 'discover',
      mediaType,
      genres: intent.genres.length > 0 ? intent.genres : undefined,
      excludeGenres: excludeGenres.length > 0 ? excludeGenres : undefined,
      minRating: 6.5,
      sortBy: 'popularity.desc',
      page: 1,
      limit: 8,
      source: 'similar',
      fetchMultiplier: 3
    };
    
    queries.push(query);
  }
  
  return {
    queries,
    responseContext: {
      intro: 'Based on what you mentioned, you might enjoy:',
      explanation: 'These have a similar vibe and style!',
      followUp: 'Tell me more about what you liked and I can find even better matches!'
    }
  };
}

/**
 * Generate STRICT cultural queries based on reference movie profile
 * This applies hard filtering to match the reference movie's DNA
 */
function generateStrictCulturalQueries(
  intent: ParsedIntent,
  mediaTypes: ('movie' | 'tv')[],
  excludeGenres: number[],
  culturalFilters: CulturalFilterRules
): QueryResult {
  const queries: MovieQuery[] = [];
  const profile = culturalFilters.referenceProfile;
  
  // Determine genres based on reference profile
  let targetGenres: number[] = intent.genres.length > 0 ? intent.genres : [];
  
  // For mass-appeal blockbusters, prioritize action/adventure genres
  if (profile && profile.massAppealScore >= 80) {
    if (profile.storytellingStyle === 'action-spectacle' || 
        profile.storytellingStyle === 'commercial-masala') {
      targetGenres = [28, 12]; // Action, Adventure
    }
  }
  
  // Add drama if the reference has emotional elements
  if (profile && profile.hasEmotionalDrama && !targetGenres.includes(18)) {
    targetGenres.push(18); // Drama
  }
  
  // Primary query: STRICT language match (original language only)
  for (const mediaType of mediaTypes) {
    queries.push({
      type: 'discover',
      mediaType,
      genres: targetGenres.length > 0 ? targetGenres : undefined,
      excludeGenres: excludeGenres.length > 0 ? excludeGenres : undefined,
      minRating: 6.0, // Slightly lower to include more culturally relevant content
      sortBy: 'popularity.desc',
      page: 1,
      limit: 10,
      source: 'cultural',
      fetchMultiplier: 4, // Fetch more for strict filtering
      withOriginalLanguage: culturalFilters.withOriginalLanguage,
      withoutOriginalLanguage: culturalFilters.withoutOriginalLanguage,
      culturalContext: culturalFilters
    });
  }
  
  // Secondary query: Related Indian languages (for Indian cinema)
  if (culturalFilters.strictLanguageMatch && culturalFilters.preferredLanguages.length > 1) {
    // Query for each preferred language
    const additionalLanguages = culturalFilters.preferredLanguages
      .filter(lang => lang !== culturalFilters.withOriginalLanguage)
      .slice(0, 2); // Top 2 additional languages
    
    for (const lang of additionalLanguages) {
      for (const mediaType of mediaTypes) {
        queries.push({
          type: 'discover',
          mediaType,
          genres: targetGenres.length > 0 ? targetGenres : [28, 12],
          minRating: 6.5,
          sortBy: 'popularity.desc',
          page: 1,
          limit: 4,
          source: 'cultural',
          fetchMultiplier: 2,
          withOriginalLanguage: lang,
          culturalContext: culturalFilters
        });
      }
    }
  }
  
  // Tertiary query: Era-based boost (SOFT ranking signal, not hard filter)
  // This adds a separate query for similar-era movies to boost their ranking
  if (culturalFilters.preferSimilarEra && culturalFilters.referenceEra !== 'unknown') {
    const eraYearRange = getEraYearRange(culturalFilters.referenceEra);
    
    if (eraYearRange && culturalFilters.eraFlexibility !== 'flexible') {
      // For strict/moderate era flexibility, add an era-specific query
      // Results from this will be boosted in ranking but not exclusive
      for (const mediaType of mediaTypes) {
        queries.push({
          type: 'discover',
          mediaType,
          genres: targetGenres.length > 0 ? targetGenres : undefined,
          yearRange: eraYearRange,
          minRating: 6.5,
          sortBy: 'popularity.desc',
          page: 1,
          limit: 5, // Smaller limit - just for era boosting
          source: 'cultural',
          fetchMultiplier: 2,
          withOriginalLanguage: culturalFilters.withOriginalLanguage,
          withoutOriginalLanguage: culturalFilters.withoutOriginalLanguage,
          culturalContext: culturalFilters
        });
      }
    }
  }
  
  // Generate detailed response text
  const intro = generateStrictIntro(culturalFilters);
  const explanation = generateStrictExplanation(culturalFilters);
  const followUp = 'Want me to expand the search to include other languages or Hollywood films?';
  
  return {
    queries,
    culturalFilters,
    responseContext: {
      intro,
      explanation,
      followUp
    }
  };
}

/**
 * Generate intro text for strict cultural matching
 */
function generateStrictIntro(filters: CulturalFilterRules): string {
  const profile = filters.referenceProfile;
  
  if (!profile) {
    return `Since you loved **${filters.referenceTitle}**, here are similar ${filters.industryDescription} films:`;
  }
  
  // Build a detailed intro based on the profile
  if (profile.massAppealScore >= 90 && profile.narrativeScale === 'epic') {
    return `Since you loved **${filters.referenceTitle}**, I've found these ${filters.industryDescription} blockbusters with the same epic scale, mass-hero appeal, and grand storytelling:`;
  }
  
  if (profile.hasHeroCentricElevation && profile.hasPowerFantasy) {
    return `Since you loved **${filters.referenceTitle}**, here are ${filters.industryDescription} films with similar hero-centric power fantasy narratives:`;
  }
  
  if (profile.storytellingStyle === 'emotional-drama') {
    return `Since you loved **${filters.referenceTitle}**, these ${filters.industryDescription} films share its emotional depth and storytelling style:`;
  }
  
  return `Since you loved **${filters.referenceTitle}**, here are similar ${filters.industryDescription} films:`;
}

/**
 * Generate explanation for strict cultural matching
 */
function generateStrictExplanation(filters: CulturalFilterRules): string {
  const profile = filters.referenceProfile;
  const parts: string[] = [];
  
  if (!profile) {
    return `These films are from the same ${filters.industryDescription} with similar appeal.`;
  }
  
  // Industry match
  parts.push(`All from ${filters.industryDescription}`);
  
  // Scale/style match
  if (profile.narrativeScale === 'epic') {
    parts.push('epic-scale storytelling');
  }
  if (profile.hasHeroCentricElevation) {
    parts.push('hero-centric elevation');
  }
  if (profile.storytellingStyle === 'commercial-masala') {
    parts.push('commercial masala entertainment');
  } else if (profile.storytellingStyle === 'action-spectacle') {
    parts.push('action spectacle');
  }
  
  // Note about exclusions
  if (filters.excludeLanguages.includes('en')) {
    parts.push('(excluding English-language films)');
  }
  
  return parts.join(' • ');
}

/**
 * Generate genre-specific queries
 */
function generateGenreQueries(intent: ParsedIntent, filterRules?: FilterRules): QueryResult {
  const queries: MovieQuery[] = [];
  
  const mediaTypes: ('movie' | 'tv')[] = 
    intent.mediaType === 'both' ? ['movie', 'tv'] : [intent.mediaType];
  
  // Get genres to avoid if on cooldown
  const excludeGenres = getCooldownGenres(filterRules);
  
  for (const mediaType of mediaTypes) {
    queries.push({
      type: 'discover',
      mediaType,
      genres: intent.genres.length > 0 ? intent.genres : undefined,
      excludeGenres: excludeGenres.length > 0 ? excludeGenres : undefined,
      minRating: intent.minRating || undefined,
      sortBy: 'popularity.desc',
      page: 1,
      limit: 6,
      source: 'genre',
      fetchMultiplier: filterRules ? 2 : 1
    });
  }
  
  const genreList = intent.mediaType === 'tv' ? TV_GENRES : GENRES;
  const genreNames = intent.genres
    .map(id => genreList.find(g => g.id === id)?.name)
    .filter(Boolean);
  
  return {
    queries,
    responseContext: {
      intro: `Here are some great ${genreNames.join(' & ')} picks:`,
      explanation: `Popular titles in ${genreNames.join(', ') || 'this genre'}`,
      followUp: 'Want me to filter by year or rating?'
    }
  };
}

/**
 * Generate watchlist-related queries
 */
function generateWatchlistQueries(intent: ParsedIntent): QueryResult {
  return {
    queries: [{
      type: 'watchlist',
      mediaType: intent.mediaType === 'both' ? 'movie' : intent.mediaType,
      page: 1,
      limit: 10,
      source: 'random'
    }],
    responseContext: {
      intro: '📋 Here\'s what\'s in your watchlist:',
      explanation: 'These are the movies and shows you\'ve saved for later.',
      followUp: 'Want me to suggest what to watch first based on your mood?'
    }
  };
}

/**
 * Generate fallback queries for unknown intents
 */
function generateFallbackQueries(intent: ParsedIntent): QueryResult {
  const queries: MovieQuery[] = [];
  
  if (intent.type === 'greeting') {
    // For greetings, show trending content
    queries.push({
      type: 'trending',
      mediaType: 'movie',
      page: 1,
      limit: 4,
      source: 'trending'
    });
    
    return {
      queries,
      responseContext: {
        intro: '👋 Hey there! I\'m your movie discovery assistant.',
        explanation: 'Here\'s what\'s popular right now to get you started:',
        followUp: 'Tell me what you\'re in the mood for and I\'ll find the perfect watch!'
      }
    };
  }
  
  if (intent.type === 'thanks') {
    return {
      queries: [],
      responseContext: {
        intro: '😊 You\'re welcome!',
        explanation: 'I\'m glad I could help you find something to watch.',
        followUp: 'Feel free to ask whenever you need more recommendations!'
      }
    };
  }
  
  // Default fallback: trending content
  queries.push({
    type: 'trending',
    mediaType: 'movie',
    page: 1,
    limit: 4,
    source: 'trending'
  });
  queries.push({
    type: 'trending',
    mediaType: 'tv',
    page: 1,
    limit: 4,
    source: 'trending'
  });
  
  return {
    queries,
    responseContext: {
      intro: 'I\'d love to help you find something great to watch!',
      explanation: 'Here\'s what\'s popular right now:',
      followUp: 'Try telling me your mood, a genre you like, or an actor you enjoy!'
    }
  };
}

/**
 * Build TMDB API query parameters from MovieQuery
 * Enhanced with cultural/language filtering support
 */
export function buildTMDBParams(query: MovieQuery): Record<string, string | number | boolean | undefined> {
  const params: Record<string, string | number | boolean | undefined> = {
    page: query.page || 1
  };
  
  if (query.genres && query.genres.length > 0) {
    params.with_genres = query.genres.join(',');
  }
  
  if (query.excludeGenres && query.excludeGenres.length > 0) {
    params.without_genres = query.excludeGenres.join(',');
  }
  
  if (query.year) {
    params.primary_release_year = query.year;
  }
  
  if (query.yearRange) {
    if (query.mediaType === 'movie') {
      params['primary_release_date.gte'] = `${query.yearRange.from}-01-01`;
      params['primary_release_date.lte'] = `${query.yearRange.to}-12-31`;
    } else {
      params['first_air_date.gte'] = `${query.yearRange.from}-01-01`;
      params['first_air_date.lte'] = `${query.yearRange.to}-12-31`;
    }
  }
  
  if (query.minRating) {
    params['vote_average.gte'] = query.minRating;
    params['vote_count.gte'] = 100; // Ensure enough votes
  }
  
  if (query.maxRating) {
    params['vote_average.lte'] = query.maxRating;
  }
  
  if (query.sortBy) {
    params.sort_by = query.sortBy;
  }
  
  if (query.query) {
    params.query = query.query;
  }
  
  // Language filtering (critical for cultural context)
  if (query.withOriginalLanguage) {
    params.with_original_language = query.withOriginalLanguage;
  } else if (query.language) {
    params.with_original_language = query.language;
  }
  
  // Region filter
  if (query.region) {
    params.region = query.region;
  }
  
  params.include_adult = query.includeAdult || false;
  
  return params;
}

export default generateQueries;
