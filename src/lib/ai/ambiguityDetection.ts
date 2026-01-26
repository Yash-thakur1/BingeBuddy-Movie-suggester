/**
 * Ambiguity Detection System
 * 
 * Detects when user input is too vague or ambiguous and generates
 * clarifying questions to improve recommendation precision.
 */

import { ParsedIntent, IntentType } from './intentParser';
import { GENRES, TV_GENRES, QUICK_MOODS, ERA_PRESETS } from '@/lib/tmdb/config';
import { RecommendationHistory } from './recommendationHistory';

// ============================================
// Types
// ============================================

export interface AmbiguityAnalysis {
  isAmbiguous: boolean;
  ambiguityScore: number; // 0-1, higher = more ambiguous
  missingInfo: string[];
  clarifyingQuestions: ClarifyingQuestion[];
  shouldAskFollowUp: boolean;
}

export interface ClarifyingQuestion {
  id: string;
  question: string;
  type: 'single-choice' | 'multi-choice' | 'open';
  options?: QuickOption[];
  priority: number; // 1-5, higher = more important
}

export interface QuickOption {
  label: string;
  value: string;
  icon?: string;
}

// ============================================
// Constants
// ============================================

const AMBIGUITY_THRESHOLD = 0.6; // Above this, we should ask for clarification
const MIN_CONFIDENCE_FOR_RECOMMENDATION = 0.4;

// Keywords that indicate user wants variety
const VARIETY_KEYWORDS = [
  'different', 'something else', 'new', 'fresh', 'another', 'change',
  'not like', 'switch', 'variety', 'diverse', 'mix it up', 'surprise'
];

// Keywords that indicate very specific requests
const SPECIFIC_KEYWORDS = [
  'exactly', 'specifically', 'only', 'must have', 'definitely', 
  'looking for', 'that one', 'the one with', 'similar to'
];

// Vague request indicators
const VAGUE_KEYWORDS = [
  'something', 'anything', 'whatever', 'idk', "don't know", 'maybe',
  'i guess', 'not sure', 'depends', 'could be', 'kinda'
];

// ============================================
// Analysis Functions
// ============================================

/**
 * Analyze intent for ambiguity
 */
export function analyzeAmbiguity(
  intent: ParsedIntent,
  history: RecommendationHistory
): AmbiguityAnalysis {
  const missingInfo: string[] = [];
  let ambiguityScore = 0;
  const clarifyingQuestions: ClarifyingQuestion[] = [];
  
  const message = intent.originalMessage.toLowerCase();
  
  // Check for vague keywords
  const hasVagueKeywords = VAGUE_KEYWORDS.some(kw => message.includes(kw));
  if (hasVagueKeywords) {
    ambiguityScore += 0.2;
  }
  
  // Check for specific keywords (reduces ambiguity)
  const hasSpecificKeywords = SPECIFIC_KEYWORDS.some(kw => message.includes(kw));
  if (hasSpecificKeywords) {
    ambiguityScore -= 0.2;
  }
  
  // Check for variety request
  const wantsVariety = VARIETY_KEYWORDS.some(kw => message.includes(kw));
  
  // 1. Check if media type is specified
  if (intent.mediaType === 'both' && !message.includes('both') && !message.includes('any')) {
    missingInfo.push('media_type');
    ambiguityScore += 0.1;
    
    clarifyingQuestions.push({
      id: 'media_type',
      question: 'Are you looking for movies or TV series?',
      type: 'single-choice',
      options: [
        { label: 'Movies', value: 'movie', icon: '🎬' },
        { label: 'TV Series', value: 'tv', icon: '📺' },
        { label: 'Both', value: 'both', icon: '🎭' }
      ],
      priority: 3
    });
  }
  
  // 2. Check if genres are specified
  if (intent.genres.length === 0 && intent.moods.length === 0) {
    missingInfo.push('genre_or_mood');
    ambiguityScore += 0.25;
    
    // Pick random genre suggestions, excluding recently used
    const recentGenres = history.getRecentGenres();
    const availableGenres = GENRES.filter(g => {
      const count = recentGenres.get(g.id) || 0;
      return count < 3;
    });
    const shuffled = availableGenres.sort(() => Math.random() - 0.5).slice(0, 4);
    
    clarifyingQuestions.push({
      id: 'genre',
      question: 'What genre are you in the mood for?',
      type: 'multi-choice',
      options: shuffled.map(g => ({
        label: g.name,
        value: g.id.toString(),
        icon: g.icon
      })),
      priority: 5
    });
  }
  
  // 3. Check if mood is specified for recommend/mood intents
  if ((intent.type === 'recommend' || intent.type === 'mood') && 
      intent.moods.length === 0 && intent.genres.length === 0) {
    missingInfo.push('mood');
    ambiguityScore += 0.15;
    
    clarifyingQuestions.push({
      id: 'mood',
      question: 'What kind of mood are you in?',
      type: 'single-choice',
      options: QUICK_MOODS.slice(0, 5).map(m => ({
        label: m.label,
        value: m.id,
        icon: m.icon
      })),
      priority: 4
    });
  }
  
  // 4. Check confidence of intent detection
  if (intent.confidence < MIN_CONFIDENCE_FOR_RECOMMENDATION) {
    missingInfo.push('intent');
    ambiguityScore += 0.3;
    
    clarifyingQuestions.push({
      id: 'intent',
      question: "I want to make sure I understand. What would you like me to do?",
      type: 'single-choice',
      options: [
        { label: 'Recommend something', value: 'recommend', icon: '🎯' },
        { label: "Show what's trending", value: 'trending', icon: '🔥' },
        { label: 'Search for something specific', value: 'search', icon: '🔍' },
        { label: 'Show top-rated content', value: 'top_rated', icon: '⭐' }
      ],
      priority: 5
    });
  }
  
  // 5. If user just said "hello" or "hi" (greeting intent)
  if (intent.type === 'greeting') {
    ambiguityScore = 0.8; // High ambiguity for greetings
    
    clarifyingQuestions.push({
      id: 'initial',
      question: "What brings you here today?",
      type: 'single-choice',
      options: [
        { label: 'I want recommendations', value: 'recommend', icon: '🎯' },
        { label: "What's trending?", value: 'trending', icon: '🔥' },
        { label: "Surprise me!", value: 'surprise', icon: '🎲' },
        { label: "I'll browse myself", value: 'browse', icon: '👀' }
      ],
      priority: 5
    });
  }
  
  // 6. If history shows repetitive patterns, suggest variety
  if (history.shouldSuggestVariety() && !wantsVariety) {
    clarifyingQuestions.push({
      id: 'variety',
      question: "I've been recommending similar content. Would you like something different?",
      type: 'single-choice',
      options: [
        { label: 'Yes, surprise me!', value: 'variety', icon: '🎲' },
        { label: 'Try a different genre', value: 'different_genre', icon: '🔄' },
        { label: 'Keep going with similar', value: 'continue', icon: '👍' }
      ],
      priority: 2
    });
  }
  
  // 7. Very short messages are often ambiguous
  const wordCount = intent.originalMessage.trim().split(/\s+/).length;
  if (wordCount <= 3 && intent.type !== 'greeting' && intent.type !== 'thanks') {
    ambiguityScore += 0.15;
    missingInfo.push('context');
  }
  
  // Clamp score
  ambiguityScore = Math.max(0, Math.min(1, ambiguityScore));
  
  // Sort questions by priority
  clarifyingQuestions.sort((a, b) => b.priority - a.priority);
  
  // Determine if we should ask follow-up
  // Only ask if:
  // 1. Ambiguity is high
  // 2. We have meaningful questions
  // 3. It's not a greeting (we handle that differently)
  // 4. It's not a thank you or farewell
  const shouldAskFollowUp = 
    ambiguityScore >= AMBIGUITY_THRESHOLD &&
    clarifyingQuestions.length > 0 &&
    intent.type !== 'thanks' &&
    intent.type !== 'greeting' && // We provide options with greeting response
    missingInfo.length >= 2; // Require multiple missing pieces
  
  return {
    isAmbiguous: ambiguityScore >= AMBIGUITY_THRESHOLD,
    ambiguityScore,
    missingInfo,
    clarifyingQuestions: clarifyingQuestions.slice(0, 2), // Max 2 questions
    shouldAskFollowUp
  };
}

/**
 * Generate a clarification response
 */
export function generateClarificationResponse(analysis: AmbiguityAnalysis): {
  message: string;
  options: QuickOption[];
} {
  if (analysis.clarifyingQuestions.length === 0) {
    return {
      message: "I'm not quite sure what you're looking for. Could you give me more details?",
      options: [
        { label: 'Show trending', value: "What's trending?", icon: '🔥' },
        { label: 'Recommend something', value: 'Recommend something good', icon: '🎯' },
        { label: 'Surprise me', value: 'Surprise me with something random', icon: '🎲' }
      ]
    };
  }
  
  const topQuestion = analysis.clarifyingQuestions[0];
  
  return {
    message: topQuestion.question,
    options: topQuestion.options || []
  };
}

/**
 * Check if user is requesting variety explicitly
 */
export function isVarietyRequest(message: string): boolean {
  const lower = message.toLowerCase();
  return VARIETY_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * Check if user is making a refined request (building on previous)
 */
export function isRefinementRequest(message: string): boolean {
  const refinementPatterns = [
    'but also', 'with more', 'with less', 'but not', 'and also',
    'like that but', 'similar but', 'same but', 'maybe more',
    'less', 'more', 'darker', 'lighter', 'funnier', 'scarier',
    'newer', 'older', 'recent', 'classic'
  ];
  
  const lower = message.toLowerCase();
  return refinementPatterns.some(p => lower.includes(p));
}

/**
 * Extract refinement details from message
 */
export function extractRefinements(message: string): {
  addGenres: number[];
  removeGenres: number[];
  preferNewer: boolean;
  preferOlder: boolean;
  preferHigherRating: boolean;
  wantsMore: string[];
  wantsLess: string[];
} {
  const lower = message.toLowerCase();
  
  const addGenres: number[] = [];
  const removeGenres: number[] = [];
  let preferNewer = false;
  let preferOlder = false;
  let preferHigherRating = false;
  const wantsMore: string[] = [];
  const wantsLess: string[] = [];
  
  // Check for "more X" or "less X" patterns
  const moreMatch = lower.match(/more (\w+)/g);
  const lessMatch = lower.match(/less (\w+)/g);
  
  if (moreMatch) {
    for (const match of moreMatch) {
      const word = match.replace('more ', '');
      wantsMore.push(word);
      
      // Map to genres
      const genre = [...GENRES, ...TV_GENRES].find(g => 
        g.name.toLowerCase().includes(word)
      );
      if (genre) {
        addGenres.push(genre.id);
      }
    }
  }
  
  if (lessMatch) {
    for (const match of lessMatch) {
      const word = match.replace('less ', '');
      wantsLess.push(word);
      
      const genre = [...GENRES, ...TV_GENRES].find(g => 
        g.name.toLowerCase().includes(word)
      );
      if (genre) {
        removeGenres.push(genre.id);
      }
    }
  }
  
  // Era preferences
  if (lower.includes('newer') || lower.includes('recent') || lower.includes('latest')) {
    preferNewer = true;
  }
  if (lower.includes('older') || lower.includes('classic') || lower.includes('vintage')) {
    preferOlder = true;
  }
  
  // Rating preferences
  if (lower.includes('better rated') || lower.includes('higher rated') || lower.includes('top rated')) {
    preferHigherRating = true;
  }
  
  return {
    addGenres,
    removeGenres,
    preferNewer,
    preferOlder,
    preferHigherRating,
    wantsMore,
    wantsLess
  };
}

/**
 * Get smart follow-up suggestions based on context
 */
export function getSmartFollowUps(
  intent: ParsedIntent,
  history: RecommendationHistory,
  recommendedGenres: number[]
): string[] {
  const suggestions: string[] = [];
  const stats = history.getStats();
  
  // If we've recommended a lot from one genre, suggest alternatives
  if (stats.topGenres.length > 0) {
    const topGenreId = stats.topGenres[0][0];
    const topGenreCount = stats.topGenres[0][1];
    
    if (topGenreCount >= 3) {
      // Find an underrepresented genre
      const allGenreIds = new Set(GENRES.map(g => g.id));
      const usedGenreIds = new Set(stats.topGenres.map(([id]) => id));
      const unusedGenres = GENRES.filter(g => !usedGenreIds.has(g.id));
      
      if (unusedGenres.length > 0) {
        const randomUnused = unusedGenres[Math.floor(Math.random() * unusedGenres.length)];
        suggestions.push(`Try some ${randomUnused.name.toLowerCase()}s`);
      }
    }
  }
  
  // Suggest different era if we've been focused on one
  if (stats.eraBreakdown.length > 0 && stats.eraBreakdown[0][1] >= 3) {
    const topEra = stats.eraBreakdown[0][0];
    if (topEra === '2020s' || topEra === '2010s') {
      suggestions.push('Show me some classic films');
    } else {
      suggestions.push('Show me something more recent');
    }
  }
  
  // Media type switch
  if (intent.mediaType === 'movie') {
    suggestions.push('Switch to TV series');
  } else if (intent.mediaType === 'tv') {
    suggestions.push('Show me movies instead');
  }
  
  // Mood-based suggestions
  if (intent.moods.length > 0) {
    const oppositeMoods: Record<string, string> = {
      'happy': 'Something more serious',
      'sad': 'Something uplifting',
      'excited': 'Something calming',
      'scared': 'Something lighthearted',
      'romantic': 'Something action-packed'
    };
    
    for (const mood of intent.moods) {
      if (oppositeMoods[mood]) {
        suggestions.push(oppositeMoods[mood]);
        break;
      }
    }
  }
  
  // General variety
  if (stats.totalRecommended > 6) {
    suggestions.push('Surprise me with something different');
  }
  
  // Limit and shuffle
  const shuffled = suggestions.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

/**
 * Generate smart clarifying questions for low-confidence movie matches
 * Used when the system finds multiple possible matches for a reference movie
 */
export function generateMovieMatchClarification(
  queryTitle: string,
  alternatives: Array<{
    id: number;
    title: string;
    year: number | null;
    language: string;
    type: 'movie' | 'tv';
  }>
): {
  message: string;
  options: QuickOption[];
} {
  if (alternatives.length === 0) {
    return {
      message: `I couldn't find any movies matching "${queryTitle}". Could you check the spelling or provide more details like the release year?`,
      options: [
        { label: 'Search trending', value: "What's trending?", icon: '🔥' },
        { label: 'Try different title', value: 'Let me try a different movie', icon: '🔄' }
      ]
    };
  }
  
  // Build options from alternatives
  const movieOptions: QuickOption[] = alternatives.slice(0, 4).map((alt, idx) => {
    const yearStr = alt.year ? ` (${alt.year})` : '';
    const langStr = alt.language.toUpperCase();
    return {
      label: `${alt.title}${yearStr} [${langStr}]`,
      value: `movies like ${alt.title}${alt.year ? ` (${alt.year})` : ''}`,
      icon: alt.type === 'movie' ? '🎬' : '📺'
    };
  });
  
  // Add a "none of these" option
  movieOptions.push({
    label: 'None of these',
    value: `I meant a different "${queryTitle}"`,
    icon: '❌'
  });
  
  const message = `I found multiple matches for "${queryTitle}". Which one did you mean?`;
  
  return {
    message,
    options: movieOptions
  };
}

/**
 * Generate a disambiguation message for ambiguous movie references
 */
export function generateDisambiguationMessage(
  bestMatch: { title: string; year: number | null; language: string },
  confidence: 'medium' | 'low',
  alternativeCount: number
): string {
  const yearStr = bestMatch.year ? ` (${bestMatch.year})` : '';
  
  if (confidence === 'medium') {
    return `I'm showing recommendations based on **${bestMatch.title}${yearStr}**. ` +
           `If you meant a different movie, just let me know!`;
  }
  
  if (alternativeCount > 0) {
    return `I found "${bestMatch.title}${yearStr}" but there are ${alternativeCount} other possible matches. ` +
           `If this isn't right, please provide the release year or more details.`;
  }
  
  return `I matched "${bestMatch.title}${yearStr}" but I'm not 100% certain. ` +
         `You can add the year (e.g., "${bestMatch.title} 2015") for more precise results.`;
}

/**
 * Generate smart year-based clarification
 * Used when multiple movies share the same title but different years
 */
export function generateYearClarification(
  title: string,
  yearOptions: number[]
): {
  message: string;
  options: QuickOption[];
} {
  const sortedYears = [...yearOptions].sort((a, b) => b - a); // Newest first
  
  const options: QuickOption[] = sortedYears.slice(0, 5).map(year => ({
    label: `${title} (${year})`,
    value: `movies like ${title} (${year})`,
    icon: year >= 2020 ? '🆕' : year >= 2010 ? '📽️' : '🎞️'
  }));
  
  return {
    message: `There are multiple versions of "${title}". Which year are you looking for?`,
    options
  };
}

export default {
  analyzeAmbiguity,
  generateClarificationResponse,
  isVarietyRequest,
  isRefinementRequest,
  extractRefinements,
  getSmartFollowUps,
  generateMovieMatchClarification,
  generateDisambiguationMessage,
  generateYearClarification
};
