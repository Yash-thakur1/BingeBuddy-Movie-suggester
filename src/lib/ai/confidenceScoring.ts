/**
 * Confidence Scoring System
 * 
 * Calculates confidence scores for movie identification and provides
 * behavior logic based on confidence levels.
 * 
 * Confidence is determined by:
 * 1. Title match quality (exact, fuzzy, partial)
 * 2. Year accuracy (if provided)
 * 3. Popularity/recognition of the movie
 * 4. Language/regional relevance
 * 5. Ambiguity (number of possible matches)
 */

import { Movie, TVShow } from '@/types/movie';

// ============================================
// Types
// ============================================

export type ConfidenceLevel = 'exact' | 'high' | 'medium' | 'low' | 'ambiguous';

export interface ConfidenceScore {
  level: ConfidenceLevel;
  score: number;  // 0-100 numeric score
  
  // Factor breakdown
  factors: ConfidenceFactors;
  
  // Behavior guidance
  behavior: ConfidenceBehavior;
  
  // Human-readable explanation
  explanation: string;
  
  // For transparency (optional display)
  displayLabel?: string;
}

export interface ConfidenceFactors {
  // Title matching quality (0-40)
  titleMatch: number;
  titleMatchType: 'exact' | 'case-insensitive' | 'partial' | 'fuzzy';
  
  // Year matching (0-20) - only if year was provided
  yearMatch: number;
  yearMatchType: 'exact' | 'close' | 'none' | 'not-provided';
  
  // Popularity/recognition (0-20)
  popularity: number;
  popularityTier: 'blockbuster' | 'popular' | 'known' | 'obscure';
  
  // Uniqueness (0-10)
  uniqueness: number;
  alternativeCount: number;
  
  // Regional relevance (0-10)
  relevance: number;
}

export interface ConfidenceBehavior {
  // Whether to proceed with recommendations
  shouldProceed: boolean;
  
  // Whether to ask for clarification
  shouldClarify: boolean;
  
  // How strict recommendations should be
  recommendationStrictness: 'strict' | 'moderate' | 'flexible';
  
  // Whether to show confidence indicator
  showConfidenceIndicator: boolean;
  
  // Suggested action
  action: 'recommend' | 'confirm' | 'clarify' | 'reject';
  
  // Clarification message if needed
  clarificationMessage?: string;
  
  // Alternative matches if ambiguous
  alternatives?: AlternativeMatch[];
}

export interface AlternativeMatch {
  id: number;
  title: string;
  year: number | null;
  language: string;
  type: 'movie' | 'tv';
  confidence: number;
}

export interface MatchContext {
  // Original user query
  query: string;
  
  // Extracted title
  extractedTitle: string;
  
  // Extracted year (if any)
  extractedYear: number | null;
  
  // Whether year was provided by user
  yearProvided: boolean;
  
  // All potential matches from search
  candidates: Array<Movie | TVShow>;
  
  // The best match (if any)
  bestMatch: Movie | TVShow | null;
  
  // Media type preference
  preferMovies: boolean;
}

// ============================================
// Constants
// ============================================

// Threshold scores for confidence levels
const CONFIDENCE_THRESHOLDS = {
  exact: 90,
  high: 75,
  medium: 55,
  low: 35
  // Below 35 = ambiguous
};

// Popularity thresholds (TMDB vote counts)
const POPULARITY_THRESHOLDS = {
  blockbuster: 10000,
  popular: 3000,
  known: 500,
  obscure: 0
};

// ============================================
// Main Scoring Function
// ============================================

/**
 * Calculate comprehensive confidence score for a movie match
 */
export function calculateConfidenceScore(context: MatchContext): ConfidenceScore {
  const { extractedTitle, extractedYear, yearProvided, candidates, bestMatch } = context;
  
  // No match found
  if (!bestMatch || candidates.length === 0) {
    return createNoMatchScore(extractedTitle);
  }
  
  // Calculate factor scores
  const factors = calculateFactors(context, bestMatch);
  
  // Calculate total score (0-100)
  const totalScore = 
    factors.titleMatch + 
    factors.yearMatch + 
    factors.popularity + 
    factors.uniqueness + 
    factors.relevance;
  
  // Determine confidence level
  const level = determineLevel(totalScore, factors);
  
  // Generate behavior based on confidence
  const behavior = determineBehavior(level, factors, context);
  
  // Generate explanation
  const explanation = generateExplanation(level, factors, bestMatch, yearProvided);
  
  return {
    level,
    score: totalScore,
    factors,
    behavior,
    explanation,
    displayLabel: generateDisplayLabel(level, totalScore)
  };
}

// ============================================
// Factor Calculation
// ============================================

function calculateFactors(context: MatchContext, match: Movie | TVShow): ConfidenceFactors {
  const { extractedTitle, extractedYear, yearProvided, candidates } = context;
  
  // Title matching (0-40)
  const titleResult = calculateTitleMatch(extractedTitle, match);
  
  // Year matching (0-20)
  const yearResult = calculateYearMatch(extractedYear, yearProvided, match);
  
  // Popularity (0-20)
  const popularityResult = calculatePopularity(match);
  
  // Uniqueness based on alternatives (0-10)
  const uniquenessResult = calculateUniqueness(candidates, match);
  
  // Regional relevance (0-10)
  const relevanceResult = calculateRelevance(match);
  
  return {
    titleMatch: titleResult.score,
    titleMatchType: titleResult.type,
    yearMatch: yearResult.score,
    yearMatchType: yearResult.type,
    popularity: popularityResult.score,
    popularityTier: popularityResult.tier,
    uniqueness: uniquenessResult.score,
    alternativeCount: uniquenessResult.alternativeCount,
    relevance: relevanceResult
  };
}

function calculateTitleMatch(
  query: string,
  match: Movie | TVShow
): { score: number; type: 'exact' | 'case-insensitive' | 'partial' | 'fuzzy' } {
  const matchTitle = 'title' in match ? match.title : match.name;
  const originalTitle = 'original_title' in match 
    ? match.original_title 
    : ('original_name' in match ? match.original_name : matchTitle);
  
  const queryLower = query.toLowerCase().trim();
  const titleLower = matchTitle.toLowerCase().trim();
  const originalLower = originalTitle?.toLowerCase().trim() || titleLower;
  
  // Exact match (includes original title)
  if (queryLower === titleLower || queryLower === originalLower) {
    return { score: 40, type: 'exact' };
  }
  
  // Case-insensitive match with normalization
  const normalizedQuery = normalizeTitle(queryLower);
  const normalizedTitle = normalizeTitle(titleLower);
  const normalizedOriginal = normalizeTitle(originalLower);
  
  if (normalizedQuery === normalizedTitle || normalizedQuery === normalizedOriginal) {
    return { score: 38, type: 'case-insensitive' };
  }
  
  // Partial match (query is contained in title or vice versa)
  if (titleLower.includes(queryLower) || queryLower.includes(titleLower)) {
    const ratio = Math.min(queryLower.length, titleLower.length) / 
                  Math.max(queryLower.length, titleLower.length);
    return { score: Math.round(25 + ratio * 10), type: 'partial' };
  }
  
  // Fuzzy match using similarity
  const similarity = calculateSimilarity(normalizedQuery, normalizedTitle);
  if (similarity > 0.7) {
    return { score: Math.round(similarity * 30), type: 'fuzzy' };
  }
  
  // Low match
  return { score: Math.round(similarity * 20), type: 'fuzzy' };
}

function calculateYearMatch(
  queryYear: number | null,
  yearProvided: boolean,
  match: Movie | TVShow
): { score: number; type: 'exact' | 'close' | 'none' | 'not-provided' } {
  // If no year provided, give partial credit (it's optional)
  if (!yearProvided || !queryYear) {
    return { score: 10, type: 'not-provided' };
  }
  
  const releaseDate = 'release_date' in match ? match.release_date : match.first_air_date;
  if (!releaseDate) {
    return { score: 5, type: 'none' };
  }
  
  const matchYear = parseInt(releaseDate.substring(0, 4), 10);
  const yearDiff = Math.abs(matchYear - queryYear);
  
  if (yearDiff === 0) {
    return { score: 20, type: 'exact' };
  } else if (yearDiff === 1) {
    return { score: 15, type: 'close' };
  } else if (yearDiff <= 3) {
    return { score: 10, type: 'close' };
  } else {
    return { score: 3, type: 'none' };
  }
}

function calculatePopularity(
  match: Movie | TVShow
): { score: number; tier: 'blockbuster' | 'popular' | 'known' | 'obscure' } {
  const voteCount = match.vote_count || 0;
  const popularity = match.popularity || 0;
  
  // Combined score from votes and popularity
  let score = 0;
  let tier: 'blockbuster' | 'popular' | 'known' | 'obscure' = 'obscure';
  
  if (voteCount >= POPULARITY_THRESHOLDS.blockbuster || popularity >= 100) {
    score = 20;
    tier = 'blockbuster';
  } else if (voteCount >= POPULARITY_THRESHOLDS.popular || popularity >= 50) {
    score = 16;
    tier = 'popular';
  } else if (voteCount >= POPULARITY_THRESHOLDS.known || popularity >= 20) {
    score = 12;
    tier = 'known';
  } else {
    score = 6;
    tier = 'obscure';
  }
  
  return { score, tier };
}

function calculateUniqueness(
  candidates: Array<Movie | TVShow>,
  bestMatch: Movie | TVShow
): { score: number; alternativeCount: number } {
  // Count strong alternatives (could reasonably be what user meant)
  const strongAlternatives = candidates.filter(c => {
    if (c.id === bestMatch.id) return false;
    
    const cVotes = c.vote_count || 0;
    const bestVotes = bestMatch.vote_count || 0;
    
    // Alternative is "strong" if it has at least 30% of best match's votes
    // and at least 100 votes
    return cVotes >= 100 && cVotes >= bestVotes * 0.3;
  });
  
  const alternativeCount = strongAlternatives.length;
  
  // Fewer alternatives = higher uniqueness score
  if (alternativeCount === 0) return { score: 10, alternativeCount: 0 };
  if (alternativeCount === 1) return { score: 7, alternativeCount: 1 };
  if (alternativeCount <= 3) return { score: 4, alternativeCount };
  return { score: 2, alternativeCount };
}

function calculateRelevance(match: Movie | TVShow): number {
  // For now, give base relevance score
  // Could be enhanced with user's preferred language/region
  const language = match.original_language;
  
  // Popular languages get higher relevance
  const popularLanguages = ['en', 'hi', 'ko', 'ja', 'es', 'fr', 'te', 'ta'];
  if (popularLanguages.includes(language)) {
    return 10;
  }
  
  return 6;
}

// ============================================
// Level & Behavior Determination
// ============================================

function determineLevel(score: number, factors: ConfidenceFactors): ConfidenceLevel {
  // Special case: exact title + exact year = always exact
  if (factors.titleMatchType === 'exact' && factors.yearMatchType === 'exact') {
    return 'exact';
  }
  
  // Special case: many alternatives with similar scores = ambiguous
  if (factors.alternativeCount >= 3 && factors.titleMatchType !== 'exact') {
    return 'ambiguous';
  }
  
  // Standard threshold-based determination
  if (score >= CONFIDENCE_THRESHOLDS.exact) return 'exact';
  if (score >= CONFIDENCE_THRESHOLDS.high) return 'high';
  if (score >= CONFIDENCE_THRESHOLDS.medium) return 'medium';
  if (score >= CONFIDENCE_THRESHOLDS.low) return 'low';
  return 'ambiguous';
}

function determineBehavior(
  level: ConfidenceLevel,
  factors: ConfidenceFactors,
  context: MatchContext
): ConfidenceBehavior {
  const { candidates, bestMatch, extractedTitle, extractedYear } = context;
  
  switch (level) {
    case 'exact':
      return {
        shouldProceed: true,
        shouldClarify: false,
        recommendationStrictness: 'strict',
        showConfidenceIndicator: false, // Don't show when confident
        action: 'recommend'
      };
      
    case 'high':
      return {
        shouldProceed: true,
        shouldClarify: false,
        recommendationStrictness: 'strict',
        showConfidenceIndicator: true,
        action: 'recommend'
      };
      
    case 'medium':
      return {
        shouldProceed: true,
        shouldClarify: false,
        recommendationStrictness: 'moderate',
        showConfidenceIndicator: true,
        action: 'recommend',
        clarificationMessage: generateMediumConfidenceNote(bestMatch, extractedTitle)
      };
      
    case 'low':
      // Proceed but with confirmation and flexible recommendations
      return {
        shouldProceed: true,
        shouldClarify: true,
        recommendationStrictness: 'flexible',
        showConfidenceIndicator: true,
        action: 'confirm',
        clarificationMessage: generateLowConfidenceQuestion(bestMatch, extractedTitle, extractedYear),
        alternatives: generateAlternatives(candidates, bestMatch)
      };
      
    case 'ambiguous':
      // Must clarify before proceeding
      return {
        shouldProceed: false,
        shouldClarify: true,
        recommendationStrictness: 'flexible',
        showConfidenceIndicator: true,
        action: 'clarify',
        clarificationMessage: generateAmbiguousQuestion(candidates, extractedTitle),
        alternatives: generateAlternatives(candidates, bestMatch)
      };
  }
}

// ============================================
// Message Generation
// ============================================

function generateExplanation(
  level: ConfidenceLevel,
  factors: ConfidenceFactors,
  match: Movie | TVShow,
  yearProvided: boolean
): string {
  const title = 'title' in match ? match.title : match.name;
  const parts: string[] = [];
  
  // Title match quality
  switch (factors.titleMatchType) {
    case 'exact':
      parts.push(`Exact title match for "${title}"`);
      break;
    case 'case-insensitive':
      parts.push(`Title matched "${title}"`);
      break;
    case 'partial':
      parts.push(`Partial title match found: "${title}"`);
      break;
    case 'fuzzy':
      parts.push(`Best fuzzy match: "${title}"`);
      break;
  }
  
  // Year info
  if (yearProvided && factors.yearMatchType === 'exact') {
    parts.push('year confirmed');
  } else if (yearProvided && factors.yearMatchType === 'close') {
    parts.push('year approximately matches');
  }
  
  // Popularity
  if (factors.popularityTier === 'blockbuster') {
    parts.push('widely recognized title');
  }
  
  // Alternatives
  if (factors.alternativeCount > 0) {
    parts.push(`${factors.alternativeCount} other possible match${factors.alternativeCount > 1 ? 'es' : ''}`);
  }
  
  return parts.join(', ');
}

function generateDisplayLabel(level: ConfidenceLevel, score: number): string {
  switch (level) {
    case 'exact': return '✓ Matched exactly';
    case 'high': return '✓ Matched with high confidence';
    case 'medium': return '○ Matched with moderate confidence';
    case 'low': return '? Low confidence match';
    case 'ambiguous': return '? Multiple possible matches';
  }
}

function generateMediumConfidenceNote(match: Movie | TVShow | null, query: string): string {
  if (!match) return '';
  
  const title = 'title' in match ? match.title : match.name;
  const releaseDate = 'release_date' in match ? match.release_date : match.first_air_date;
  const year = releaseDate ? ` (${releaseDate.substring(0, 4)})` : '';
  
  return `I'm showing recommendations based on **${title}${year}**. Let me know if you meant a different movie!`;
}

function generateLowConfidenceQuestion(
  match: Movie | TVShow | null, 
  query: string,
  year: number | null
): string {
  if (!match) {
    return `I couldn't find a movie matching "${query}". Could you provide more details or check the spelling?`;
  }
  
  const title = 'title' in match ? match.title : match.name;
  const releaseDate = 'release_date' in match ? match.release_date : match.first_air_date;
  const matchYear = releaseDate ? releaseDate.substring(0, 4) : 'unknown year';
  
  return `Did you mean **${title}** (${matchYear})? If not, please provide more details like the release year or director.`;
}

function generateAmbiguousQuestion(
  candidates: Array<Movie | TVShow>,
  query: string
): string {
  const topCandidates = candidates.slice(0, 4);
  
  if (topCandidates.length === 0) {
    return `I couldn't find any movies matching "${query}". Could you check the spelling or provide more details?`;
  }
  
  const options = topCandidates.map((c, i) => {
    const title = 'title' in c ? c.title : c.name;
    const releaseDate = 'release_date' in c ? c.release_date : c.first_air_date;
    const year = releaseDate ? releaseDate.substring(0, 4) : '?';
    const lang = c.original_language.toUpperCase();
    return `${i + 1}. **${title}** (${year}) [${lang}]`;
  });
  
  return `I found multiple movies matching "${query}". Which one did you mean?\n\n${options.join('\n')}\n\nJust reply with the number or provide the release year for clarity.`;
}

function generateAlternatives(
  candidates: Array<Movie | TVShow>,
  bestMatch: Movie | TVShow | null
): AlternativeMatch[] {
  return candidates
    .filter(c => !bestMatch || c.id !== bestMatch.id)
    .slice(0, 4)
    .map(c => ({
      id: c.id,
      title: 'title' in c ? c.title : c.name,
      year: (() => {
        const date = 'release_date' in c ? c.release_date : c.first_air_date;
        return date ? parseInt(date.substring(0, 4), 10) : null;
      })(),
      language: c.original_language,
      type: 'title' in c ? 'movie' as const : 'tv' as const,
      confidence: Math.round((c.vote_count || 0) / 100)
    }));
}

// ============================================
// Utility Functions
// ============================================

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ')        // Normalize whitespace
    .replace(/\b(the|a|an)\b/g, '') // Remove articles
    .trim();
}

function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (str1.length === 0 || str2.length === 0) return 0;
  
  // Simple Jaccard-like similarity on words
  const words1 = str1.split(' ').filter(w => w.length > 0);
  const words2Set = new Set(str2.split(' ').filter(w => w.length > 0));
  
  let intersection = 0;
  for (const word of words1) {
    if (words2Set.has(word)) intersection++;
  }
  
  const union = words1.length + words2Set.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function createNoMatchScore(query: string): ConfidenceScore {
  return {
    level: 'ambiguous',
    score: 0,
    factors: {
      titleMatch: 0,
      titleMatchType: 'fuzzy',
      yearMatch: 0,
      yearMatchType: 'none',
      popularity: 0,
      popularityTier: 'obscure',
      uniqueness: 0,
      alternativeCount: 0,
      relevance: 0
    },
    behavior: {
      shouldProceed: false,
      shouldClarify: true,
      recommendationStrictness: 'flexible',
      showConfidenceIndicator: true,
      action: 'reject',
      clarificationMessage: `I couldn't find any movies or shows matching "${query}". Could you check the spelling or provide more details?`
    },
    explanation: 'No matches found',
    displayLabel: '✗ No match found'
  };
}

// ============================================
// Integration Helper
// ============================================

/**
 * Quick check if we should proceed with recommendations
 */
export function shouldProceedWithRecommendations(confidence: ConfidenceScore): boolean {
  return confidence.behavior.shouldProceed;
}

/**
 * Get clarification message if needed
 */
export function getClarificationMessage(confidence: ConfidenceScore): string | null {
  if (confidence.behavior.shouldClarify && confidence.behavior.clarificationMessage) {
    return confidence.behavior.clarificationMessage;
  }
  return null;
}

/**
 * Get recommendation strictness setting
 */
export function getRecommendationStrictness(confidence: ConfidenceScore): 'strict' | 'moderate' | 'flexible' {
  return confidence.behavior.recommendationStrictness;
}
