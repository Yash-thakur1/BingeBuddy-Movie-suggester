/**
 * Intent Parser for AI Chat Assistant
 * 
 * Analyzes natural language user messages and extracts:
 * - Intent (recommend, search, explain, compare, etc.)
 * - Media type (movie, tv, both)
 * - Mood/tone preferences
 * - Genre preferences
 * - Time period/era
 * - Rating preferences
 * - Keywords/themes
 * - Reference movies (for "movies like X" queries)
 */

import { GENRES, QUICK_MOODS, ERA_PRESETS, TV_GENRES, TV_QUICK_MOODS } from '@/lib/tmdb/config';

// Intent types the parser can recognize
export type IntentType = 
  | 'recommend'      // User wants recommendations
  | 'search'         // User is searching for something specific
  | 'explain'        // User wants explanation about a movie/show
  | 'similar'        // User wants similar content
  | 'compare'        // User wants to compare content
  | 'trending'       // User wants trending/popular content
  | 'top_rated'      // User wants top rated content
  | 'watchlist'      // User asking about watchlist
  | 'mood'           // User expressing a mood
  | 'genre'          // User asking for genre-specific content
  | 'greeting'       // User greeting
  | 'thanks'         // User thanking
  | 'unknown';       // Could not determine intent

export type MediaType = 'movie' | 'tv' | 'both';

export interface ParsedIntent {
  type: IntentType;
  mediaType: MediaType;
  confidence: number; // 0-1 confidence score
  
  // Extracted preferences
  genres: number[];
  genreNames: string[];
  moods: string[];
  era: keyof typeof ERA_PRESETS | null;
  
  // Additional context
  keywords: string[];
  actors: string[];
  directors: string[];
  year: number | null;
  minRating: number | null;
  
  // Reference movie (for "movies like X" queries)
  referenceTitle: string | null;
  hasReferenceMovie: boolean;
  
  // Original message for context
  originalMessage: string;
  
  // Suggested response starter
  responseHint: string;
}

// Keyword mappings for intent detection
const INTENT_KEYWORDS: Record<IntentType, string[]> = {
  recommend: [
    'recommend', 'suggestion', 'suggest', 'what should i watch', 
    'what to watch', 'looking for', 'find me', 'show me', 
    'give me', 'want to watch', 'in the mood for', 'feel like watching',
    'can you recommend', 'any good', 'something to watch'
  ],
  search: [
    'search', 'find', 'where can i', 'looking for', 'is there',
    'have you heard of', 'do you know', 'what about'
  ],
  explain: [
    'what is', 'tell me about', 'explain', 'describe', 'synopsis',
    'plot', 'story', 'what happens in', 'info about', 'details'
  ],
  similar: [
    'similar to', 'like', 'same as', 'movies like', 'shows like',
    'if i liked', 'fans of', 'remind me of', 'vibe as', 'more like'
  ],
  compare: [
    'compare', 'versus', 'vs', 'difference between', 'better than',
    'which is better', 'or', 'should i watch'
  ],
  trending: [
    'trending', 'popular', 'what\'s hot', 'everyone watching',
    'buzz', 'viral', 'new releases', 'just came out', 'latest'
  ],
  top_rated: [
    'best', 'top rated', 'highest rated', 'greatest', 'masterpiece',
    'must watch', 'essential', 'classics', 'all time', 'legendary'
  ],
  watchlist: [
    'watchlist', 'saved', 'my list', 'bookmarked', 'queue',
    'watch later', 'to watch'
  ],
  mood: [
    'mood', 'feel', 'feeling', 'vibe', 'tone', 'atmosphere',
    'something that makes me', 'want to feel'
  ],
  genre: [
    'genre', 'type', 'category', 'kind of'
  ],
  greeting: [
    'hi', 'hello', 'hey', 'good morning', 'good evening', 
    'good afternoon', 'what\'s up', 'howdy', 'greetings'
  ],
  thanks: [
    'thank', 'thanks', 'appreciate', 'helpful', 'great', 'awesome',
    'perfect', 'exactly what i needed'
  ],
  unknown: []
};

// Mood keywords with associated feelings
const MOOD_KEYWORDS: Record<string, string[]> = {
  happy: ['happy', 'cheerful', 'uplifting', 'feel-good', 'light', 'fun', 'joyful', 'positive'],
  sad: ['sad', 'cry', 'emotional', 'tearjerker', 'moving', 'touching', 'heartbreaking'],
  excited: ['excited', 'thrilling', 'adrenaline', 'action', 'intense', 'edge of seat', 'pumped'],
  scared: ['scared', 'scary', 'horror', 'creepy', 'terrifying', 'spooky', 'frightening'],
  relaxed: ['relax', 'chill', 'calm', 'cozy', 'easy', 'comfort', 'laid back', 'soothing'],
  romantic: ['romantic', 'love', 'romance', 'date night', 'couple', 'relationship', 'sweet'],
  curious: ['curious', 'think', 'mind-bending', 'mystery', 'puzzle', 'twist', 'intellectual'],
  bored: ['bored', 'something different', 'exciting', 'interesting', 'unique', 'surprising'],
  nostalgic: ['nostalgic', 'classic', 'old', 'retro', 'vintage', 'childhood', 'throwback'],
  inspired: ['inspired', 'motivational', 'inspirational', 'uplifting story', 'overcome']
};

// Media type detection keywords
const MEDIA_KEYWORDS = {
  movie: ['movie', 'film', 'movies', 'films', 'cinema', 'feature'],
  tv: ['tv', 'show', 'series', 'tv show', 'television', 'episode', 'season', 'binge']
};

// Era detection patterns
const ERA_PATTERNS: { pattern: RegExp; era: keyof typeof ERA_PRESETS }[] = [
  { pattern: /\b(new|latest|recent|2024|2023|this year|last year)\b/i, era: 'latest' },
  { pattern: /\b(2020s?|twenty twenties)\b/i, era: '2020s' },
  { pattern: /\b(2010s?|twenty tens)\b/i, era: '2010s' },
  { pattern: /\b(2000s?|two thousands|noughties)\b/i, era: '2000s' },
  { pattern: /\b(90s|nineties|1990s?)\b/i, era: '90s' },
  { pattern: /\b(classic|old|vintage|retro|80s|70s|60s)\b/i, era: 'classic' }
];

// Year extraction pattern
const YEAR_PATTERN = /\b(19|20)\d{2}\b/;

// Rating patterns
const RATING_PATTERNS = [
  { pattern: /highly rated|well rated|good ratings?/i, minRating: 7 },
  { pattern: /top rated|best rated|excellent/i, minRating: 8 },
  { pattern: /critically acclaimed|award.?winning/i, minRating: 7.5 }
];

// Reference movie patterns (for "movies like X" queries)
const REFERENCE_PATTERNS = [
  /movies?\s+like\s+['"]?([^'"]+?)['"]?\s*$/i,
  /similar\s+to\s+['"]?([^'"]+?)['"]?\s*$/i,
  /films?\s+like\s+['"]?([^'"]+?)['"]?\s*$/i,
  /shows?\s+like\s+['"]?([^'"]+?)['"]?\s*$/i,
  /more\s+like\s+['"]?([^'"]+?)['"]?\s*$/i,
  /recommend.*like\s+['"]?([^'"]+?)['"]?\s*$/i,
  /something\s+like\s+['"]?([^'"]+?)['"]?\s*$/i,
  /if\s+i\s+liked?\s+['"]?([^'"]+?)['"]?/i,
  /fans?\s+of\s+['"]?([^'"]+?)['"]?/i,
  /like\s+['"]?([^'"]+?)['"]?\s*$/i,
];

/**
 * Normalize text for comparison
 */
function normalizeText(text: string): string {
  return text.toLowerCase().trim();
}

/**
 * Extract reference movie title from "movies like X" queries
 */
function extractReferenceTitle(message: string): string | null {
  for (const pattern of REFERENCE_PATTERNS) {
    const match = message.match(pattern);
    if (match && match[1]) {
      // Clean up the extracted title
      let title = match[1].trim();
      // Remove trailing punctuation
      title = title.replace(/[,.!?]+$/, '').trim();
      // Remove common words that might be captured
      title = title.replace(/\s+(movie|film|show|series)s?$/i, '').trim();
      
      if (title.length >= 2) {
        return title;
      }
    }
  }
  
  return null;
}

/**
 * Check if text contains any of the keywords
 */
function containsKeyword(text: string, keywords: string[]): boolean {
  const normalized = normalizeText(text);
  return keywords.some(keyword => normalized.includes(keyword.toLowerCase()));
}

/**
 * Find all matching keywords in text
 */
function findMatchingKeywords(text: string, keywords: string[]): string[] {
  const normalized = normalizeText(text);
  return keywords.filter(keyword => normalized.includes(keyword.toLowerCase()));
}

/**
 * Extract genre IDs from user message
 */
function extractGenres(text: string, mediaType: MediaType): { ids: number[]; names: string[] } {
  const normalized = normalizeText(text);
  const genreList = mediaType === 'tv' ? TV_GENRES : GENRES;
  const ids: number[] = [];
  const names: string[] = [];
  
  for (const genre of genreList) {
    if (normalized.includes(genre.name.toLowerCase())) {
      ids.push(genre.id);
      names.push(genre.name);
    }
  }
  
  // Check mood-based genres
  const moods = mediaType === 'tv' ? TV_QUICK_MOODS : QUICK_MOODS;
  for (const mood of moods) {
    if (normalized.includes(mood.label.toLowerCase()) || 
        normalized.includes(mood.id.toLowerCase())) {
      for (const genreId of mood.genres) {
        if (!ids.includes(genreId)) {
          ids.push(genreId);
          const genre = genreList.find(g => g.id === genreId);
          if (genre && !names.includes(genre.name)) {
            names.push(genre.name);
          }
        }
      }
    }
  }
  
  return { ids, names };
}

/**
 * Extract moods from user message
 */
function extractMoods(text: string): string[] {
  const moods: string[] = [];
  
  for (const [mood, keywords] of Object.entries(MOOD_KEYWORDS)) {
    if (containsKeyword(text, keywords)) {
      moods.push(mood);
    }
  }
  
  return moods;
}

/**
 * Determine media type from message
 */
function detectMediaType(text: string): MediaType {
  const hasMovie = containsKeyword(text, MEDIA_KEYWORDS.movie);
  const hasTV = containsKeyword(text, MEDIA_KEYWORDS.tv);
  
  if (hasMovie && hasTV) return 'both';
  if (hasTV) return 'tv';
  if (hasMovie) return 'movie';
  return 'both'; // Default to both if not specified
}

/**
 * Detect era preference from message
 */
function detectEra(text: string): keyof typeof ERA_PRESETS | null {
  for (const { pattern, era } of ERA_PATTERNS) {
    if (pattern.test(text)) {
      return era;
    }
  }
  return null;
}

/**
 * Extract specific year from message
 */
function extractYear(text: string): number | null {
  const match = text.match(YEAR_PATTERN);
  if (match) {
    const year = parseInt(match[0], 10);
    if (year >= 1900 && year <= new Date().getFullYear() + 1) {
      return year;
    }
  }
  return null;
}

/**
 * Detect minimum rating preference
 */
function detectMinRating(text: string): number | null {
  for (const { pattern, minRating } of RATING_PATTERNS) {
    if (pattern.test(text)) {
      return minRating;
    }
  }
  return null;
}

/**
 * Extract potential actor/director names (simple heuristic)
 */
function extractNames(text: string): { actors: string[]; directors: string[] } {
  const actors: string[] = [];
  const directors: string[] = [];
  
  // Look for "with [Name]" or "starring [Name]" patterns
  const actorPatterns = [
    /(?:with|starring|featuring|acted by)\s+([A-Z][a-z]+ [A-Z][a-z]+)/gi,
    /([A-Z][a-z]+ [A-Z][a-z]+)(?:\s+movie|\s+film)/gi
  ];
  
  for (const pattern of actorPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1] && !actors.includes(match[1])) {
        actors.push(match[1]);
      }
    }
  }
  
  // Look for "directed by [Name]" patterns
  const directorPattern = /(?:directed by|director)\s+([A-Z][a-z]+ [A-Z][a-z]+)/gi;
  let dirMatch: RegExpExecArray | null;
  while ((dirMatch = directorPattern.exec(text)) !== null) {
    if (dirMatch[1] && !directors.includes(dirMatch[1])) {
      directors.push(dirMatch[1]);
    }
  }
  
  return { actors, directors };
}

/**
 * Determine the primary intent from user message
 */
function detectIntent(text: string): { type: IntentType; confidence: number } {
  const scores: Partial<Record<IntentType, number>> = {};
  
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    const matches = findMatchingKeywords(text, keywords);
    if (matches.length > 0) {
      // Score based on number of matches and keyword specificity
      scores[intent as IntentType] = matches.length * (1 / keywords.length) * 100;
    }
  }
  
  // Find highest scoring intent
  let maxIntent: IntentType = 'recommend'; // Default intent
  let maxScore = 0;
  
  for (const [intent, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      maxIntent = intent as IntentType;
    }
  }
  
  // If greeting or thanks detected with high confidence, use those
  if (scores.greeting && scores.greeting > 50) {
    return { type: 'greeting', confidence: Math.min(scores.greeting / 100, 1) };
  }
  
  if (scores.thanks && scores.thanks > 50) {
    return { type: 'thanks', confidence: Math.min(scores.thanks / 100, 1) };
  }
  
  // Calculate confidence (normalize score)
  const confidence = Math.min(maxScore / 50, 1);
  
  return { type: maxIntent, confidence: Math.max(confidence, 0.3) };
}

/**
 * Generate a response hint based on intent
 */
function generateResponseHint(intent: IntentType, mediaType: MediaType): string {
  const mediaLabel = mediaType === 'both' ? 'movies and shows' : 
                     mediaType === 'tv' ? 'TV shows' : 'movies';
  
  const hints: Record<IntentType, string> = {
    recommend: `Here are some ${mediaLabel} I think you'll enjoy:`,
    search: `Let me help you find what you're looking for:`,
    explain: `Here's what I know about this:`,
    similar: `If you enjoyed that, you might also like:`,
    compare: `Here's how they compare:`,
    trending: `Here's what's trending right now:`,
    top_rated: `Here are some of the highest-rated ${mediaLabel}:`,
    watchlist: `Here's what's in your watchlist:`,
    mood: `Based on your mood, here are some perfect picks:`,
    genre: `Here are some great options in that genre:`,
    greeting: `Hello! I'm here to help you discover amazing ${mediaLabel}. What are you in the mood for?`,
    thanks: `You're welcome! Let me know if you'd like more recommendations.`,
    unknown: `I'd be happy to help you find something to watch. Could you tell me more about what you're looking for?`
  };
  
  return hints[intent];
}

/**
 * Extract keywords/themes from message
 */
function extractKeywords(text: string): string[] {
  // Remove common words and extract meaningful keywords
  const stopWords = new Set([
    'i', 'me', 'my', 'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was',
    'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'to',
    'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'about',
    'like', 'want', 'watch', 'see', 'find', 'show', 'movie', 'movies', 'film',
    'films', 'tv', 'series', 'something', 'anything', 'some', 'any', 'that',
    'this', 'what', 'which', 'who', 'how', 'when', 'where', 'why', 'it', 'its',
    'just', 'really', 'very', 'more', 'good', 'great', 'nice', 'please', 'thanks',
    'looking', 'need', 'give', 'suggest', 'recommend', 'recommendation', 'suggestions'
  ]);
  
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
  
  // Get unique keywords
  const uniqueWords: string[] = [];
  const seen = new Set<string>();
  for (const word of words) {
    if (!seen.has(word)) {
      seen.add(word);
      uniqueWords.push(word);
    }
  }
  
  return uniqueWords.slice(0, 10); // Max 10 keywords
}

/**
 * Main parsing function - analyzes user message and extracts structured intent
 */
export function parseIntent(message: string): ParsedIntent {
  const { type, confidence } = detectIntent(message);
  const mediaType = detectMediaType(message);
  const { ids: genres, names: genreNames } = extractGenres(message, mediaType);
  const moods = extractMoods(message);
  const era = detectEra(message);
  const year = extractYear(message);
  const minRating = detectMinRating(message);
  const { actors, directors } = extractNames(message);
  const keywords = extractKeywords(message);
  const responseHint = generateResponseHint(type, mediaType);
  
  // Extract reference movie title for "movies like X" queries
  const referenceTitle = extractReferenceTitle(message);
  const hasReferenceMovie = referenceTitle !== null;
  
  return {
    type: hasReferenceMovie ? 'similar' : type, // Override type if reference found
    mediaType,
    confidence: hasReferenceMovie ? Math.max(confidence, 0.9) : confidence,
    genres,
    genreNames,
    moods,
    era,
    keywords,
    actors,
    directors,
    year,
    minRating,
    referenceTitle,
    hasReferenceMovie,
    originalMessage: message,
    responseHint: hasReferenceMovie 
      ? `Finding movies similar to "${referenceTitle}"...`
      : responseHint
  };
}

/**
 * Map moods to genre IDs for recommendations
 */
export function mapMoodsToGenres(moods: string[], mediaType: MediaType): number[] {
  const genreIds: Set<number> = new Set();
  const moodList = mediaType === 'tv' ? TV_QUICK_MOODS : QUICK_MOODS;
  
  const moodToQuickMood: Record<string, string[]> = {
    happy: ['laugh'],
    sad: ['cry'],
    excited: ['action', 'bored'],
    scared: ['scared'],
    relaxed: ['laugh'],
    romantic: ['romance'],
    curious: ['think', 'mystery'],
    bored: ['bored', 'surprise'],
    nostalgic: ['cry'],
    inspired: ['think']
  };
  
  for (const mood of moods) {
    const quickMoodIds = moodToQuickMood[mood] || [];
    for (const quickMoodId of quickMoodIds) {
      const quickMood = moodList.find(m => m.id === quickMoodId);
      if (quickMood) {
        for (const genreId of quickMood.genres) {
          genreIds.add(genreId);
        }
      }
    }
  }
  
  return Array.from(genreIds);
}

export default parseIntent;
