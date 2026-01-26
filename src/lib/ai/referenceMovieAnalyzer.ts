/**
 * Reference Movie Analyzer
 * 
 * When a user requests "movies like X", this module:
 * 1. Identifies the reference movie from the query
 * 2. Fetches the reference movie's details from TMDB
 * 3. Analyzes language, industry, cultural context
 * 4. Generates culturally-aware filter rules
 */

import { searchMovies, searchTVShows, getMovieDetails, getTVShowDetails } from '@/lib/tmdb/api';
import { Movie, TVShow, MovieDetails, TVShowDetails } from '@/types/movie';

// ============================================
// Types
// ============================================

export interface ReferenceMovieInfo {
  id: number;
  title: string;
  type: 'movie' | 'tv';
  originalLanguage: string;
  originalTitle: string;
  productionCountries: string[];
  spokenLanguages: string[];
  genres: number[];
  releaseYear: number | null;
  voteAverage: number;
  
  // Derived cultural context
  industry: CinemaIndustry;
  industryDescription: string;  // Human-readable industry name
  preferredLanguages: string[];
  isIndianCinema: boolean;
  isBollywood: boolean;
  isHollywood: boolean;
  isKorean: boolean;
  isJapanese: boolean;
  isChinese: boolean;
  isEuropean: boolean;
  
  // Thematic analysis
  isEpic: boolean;
  isMassHero: boolean;
  isActionHeavy: boolean;
  budget: 'blockbuster' | 'mid-budget' | 'indie' | 'unknown';
}

export type CinemaIndustry = 
  | 'bollywood'      // Hindi cinema
  | 'tollywood'      // Telugu cinema
  | 'kollywood'      // Tamil cinema
  | 'mollywood'      // Malayalam cinema
  | 'sandalwood'     // Kannada cinema
  | 'indian-other'   // Other Indian regional cinema
  | 'hollywood'      // US/English mainstream
  | 'korean'         // Korean cinema
  | 'japanese'       // Japanese cinema
  | 'chinese'        // Chinese/Hong Kong cinema
  | 'european'       // European cinema
  | 'other';         // Other international

export interface CulturalFilterRules {
  preferredLanguages: string[];       // ISO 639-1 codes
  excludeLanguages: string[];         // Languages to avoid
  preferredCountries: string[];       // ISO 3166-1 codes
  industry: CinemaIndustry;
  
  // For TMDB query
  withOriginalLanguage?: string;      // Primary language filter
  withoutOriginalLanguage?: string;   // Language to exclude
  
  // Thematic preferences
  preferEpicScale: boolean;
  preferMassHeroNarrative: boolean;
  preferHighBudget: boolean;
  
  // Additional context
  referenceTitle: string;
  industryDescription: string;
}

// ============================================
// Constants
// ============================================

// Indian cinema language codes
const INDIAN_LANGUAGES = ['hi', 'te', 'ta', 'ml', 'kn', 'bn', 'mr', 'pa', 'gu'];
const HINDI_ACCESSIBLE = ['hi', 'te', 'ta', 'ml', 'kn']; // Commonly dubbed to Hindi

// Industry detection by language
const LANGUAGE_TO_INDUSTRY: Record<string, CinemaIndustry> = {
  'hi': 'bollywood',
  'te': 'tollywood',
  'ta': 'kollywood',
  'ml': 'mollywood',
  'kn': 'sandalwood',
  'bn': 'indian-other',
  'mr': 'indian-other',
  'pa': 'indian-other',
  'gu': 'indian-other',
  'en': 'hollywood',
  'ko': 'korean',
  'ja': 'japanese',
  'zh': 'chinese',
  'cn': 'chinese',
  'yue': 'chinese', // Cantonese
  'de': 'european',
  'fr': 'european',
  'es': 'european',
  'it': 'european',
};

// Country to industry mapping
const COUNTRY_TO_INDUSTRY: Record<string, CinemaIndustry> = {
  'IN': 'indian-other', // Will be refined by language
  'US': 'hollywood',
  'GB': 'hollywood',
  'KR': 'korean',
  'JP': 'japanese',
  'CN': 'chinese',
  'HK': 'chinese',
  'TW': 'chinese',
  'DE': 'european',
  'FR': 'european',
  'ES': 'european',
  'IT': 'european',
};

// Epic/mass-hero movie indicators (keywords in titles/overview)
const EPIC_KEYWORDS = [
  'kingdom', 'empire', 'king', 'queen', 'warrior', 'battle', 'war', 'legend',
  'dynasty', 'throne', 'prince', 'princess', 'saga', 'epic', 'hero',
  'rajah', 'raja', 'rani', 'yoddha', 'sainik', 'yuddh', 'veera', 'veer'
];

// Known epic/mass-hero Indian films (for better detection)
const KNOWN_INDIAN_EPICS = [
  'baahubali', 'bahubali', 'rrr', 'kgf', 'pushpa', 'salaar', 'saaho',
  'magadheera', 'eega', 'robot', 'enthiran', 'robo', '2.0', 'padmaavat',
  'padmavati', 'bajirao mastani', 'jodha akbar', 'tanhaji', 'panipat',
  'manikarnika', 'sye raa', 'krish', 'kalki', 'devara', 'akhanda',
  'chatrapathi', 'vikramarkudu', 'simhadri', 'pokiri', 'gabbar singh'
];

// ============================================
// Reference Movie Extraction
// ============================================

/**
 * Extract movie title from a "movies like X" query
 */
export function extractReferenceTitle(message: string): string | null {
  const patterns = [
    /movies?\s+like\s+['"]?([^'"]+?)['"]?\s*$/i,
    /similar\s+to\s+['"]?([^'"]+?)['"]?\s*$/i,
    /like\s+['"]?([^'"]+?)['"]?\s*$/i,
    /films?\s+like\s+['"]?([^'"]+?)['"]?\s*$/i,
    /shows?\s+like\s+['"]?([^'"]+?)['"]?\s*$/i,
    /more\s+like\s+['"]?([^'"]+?)['"]?\s*$/i,
    /recommend.*like\s+['"]?([^'"]+?)['"]?\s*$/i,
    /something\s+like\s+['"]?([^'"]+?)['"]?\s*$/i,
    /if\s+i\s+liked?\s+['"]?([^'"]+?)['"]?/i,
    /fans?\s+of\s+['"]?([^'"]+?)['"]?/i,
  ];
  
  for (const pattern of patterns) {
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
 * Search for the reference movie in TMDB
 */
export async function findReferenceMovie(
  title: string,
  preferMovies: boolean = true
): Promise<{ movie: Movie | TVShow | null; type: 'movie' | 'tv' }> {
  try {
    // Try movie search first if preferring movies
    if (preferMovies) {
      const movieResults = await searchMovies(title, 1);
      if (movieResults.results.length > 0) {
        // Find best match (exact or close title match)
        const bestMatch = findBestTitleMatch(movieResults.results, title);
        if (bestMatch) {
          return { movie: bestMatch, type: 'movie' };
        }
      }
    }
    
    // Try TV search
    const tvResults = await searchTVShows(title, 1);
    if (tvResults.results.length > 0) {
      const bestMatch = findBestTitleMatch(tvResults.results, title);
      if (bestMatch) {
        return { movie: bestMatch, type: 'tv' };
      }
    }
    
    // If preferring movies failed, try the top movie result
    if (preferMovies) {
      const movieResults = await searchMovies(title, 1);
      if (movieResults.results.length > 0) {
        return { movie: movieResults.results[0], type: 'movie' };
      }
    }
    
    return { movie: null, type: 'movie' };
  } catch (error) {
    console.error('Error finding reference movie:', error);
    return { movie: null, type: 'movie' };
  }
}

/**
 * Find best matching title from search results
 */
function findBestTitleMatch<T extends Movie | TVShow>(
  results: T[],
  searchTitle: string
): T | null {
  const normalizedSearch = searchTitle.toLowerCase().trim();
  
  // First try exact match
  for (const result of results) {
    const title = 'title' in result ? result.title : result.name;
    if (title.toLowerCase() === normalizedSearch) {
      return result;
    }
  }
  
  // Then try starts-with match
  for (const result of results) {
    const title = 'title' in result ? result.title : result.name;
    if (title.toLowerCase().startsWith(normalizedSearch)) {
      return result;
    }
  }
  
  // Then try contains match
  for (const result of results) {
    const title = 'title' in result ? result.title : result.name;
    if (title.toLowerCase().includes(normalizedSearch)) {
      return result;
    }
  }
  
  // Return first result as fallback
  return results[0] || null;
}

// ============================================
// Movie Analysis
// ============================================

/**
 * Analyze a reference movie and extract cultural context
 */
export async function analyzeReferenceMovie(
  movieOrShow: Movie | TVShow,
  type: 'movie' | 'tv'
): Promise<ReferenceMovieInfo> {
  // Get detailed information
  let details: MovieDetails | TVShowDetails | null = null;
  
  try {
    if (type === 'movie') {
      details = await getMovieDetails(movieOrShow.id);
    } else {
      details = await getTVShowDetails(movieOrShow.id);
    }
  } catch (error) {
    console.error('Error fetching details:', error);
  }
  
  const title = 'title' in movieOrShow ? movieOrShow.title : movieOrShow.name;
  const originalTitle = 'original_title' in movieOrShow 
    ? (movieOrShow.original_title || title) 
    : ('original_name' in movieOrShow ? (movieOrShow.original_name || title) : title);
  const releaseDate = 'release_date' in movieOrShow 
    ? movieOrShow.release_date 
    : movieOrShow.first_air_date;
  const releaseYear = releaseDate ? new Date(releaseDate).getFullYear() : null;
  
  // Get production countries and languages from details
  const productionCountries: string[] = [];
  const spokenLanguages: string[] = [];
  
  if (details) {
    if ('production_countries' in details && details.production_countries) {
      for (const country of details.production_countries) {
        productionCountries.push(country.iso_3166_1);
      }
    }
    if ('spoken_languages' in details && details.spoken_languages) {
      for (const lang of details.spoken_languages) {
        spokenLanguages.push(lang.iso_639_1);
      }
    }
  }
  
  const originalLanguage = movieOrShow.original_language;
  
  // Determine industry
  const industry = determineIndustry(originalLanguage, productionCountries, title);
  
  // Determine preferred languages based on industry
  const preferredLanguages = getPreferredLanguages(industry, originalLanguage);
  
  // Check cultural flags
  const isIndianCinema = INDIAN_LANGUAGES.includes(originalLanguage) || 
    productionCountries.includes('IN');
  const isBollywood = industry === 'bollywood';
  const isHollywood = industry === 'hollywood';
  const isKorean = industry === 'korean';
  const isJapanese = industry === 'japanese';
  const isChinese = industry === 'chinese';
  const isEuropean = industry === 'european';
  
  // Thematic analysis
  const titleLower = title.toLowerCase();
  const isKnownEpic = KNOWN_INDIAN_EPICS.some(epic => titleLower.includes(epic));
  const hasEpicKeywords = EPIC_KEYWORDS.some(kw => titleLower.includes(kw));
  const isEpic = isKnownEpic || hasEpicKeywords;
  
  // Mass-hero detection (common in Indian cinema)
  const isMassHero = isIndianCinema && (isEpic || isKnownEpic);
  
  // Action-heavy detection
  const actionGenres = [28, 12, 53]; // Action, Adventure, Thriller
  const isActionHeavy = movieOrShow.genre_ids.some(g => actionGenres.includes(g));
  
  // Budget estimation (rough)
  let budget: 'blockbuster' | 'mid-budget' | 'indie' | 'unknown' = 'unknown';
  if (isKnownEpic || (movieOrShow.vote_count > 5000 && isActionHeavy)) {
    budget = 'blockbuster';
  } else if (movieOrShow.vote_count > 1000) {
    budget = 'mid-budget';
  } else if (movieOrShow.vote_count < 500) {
    budget = 'indie';
  }
  
  return {
    id: movieOrShow.id,
    title,
    type,
    originalLanguage,
    originalTitle,
    productionCountries,
    spokenLanguages,
    genres: movieOrShow.genre_ids,
    releaseYear,
    voteAverage: movieOrShow.vote_average,
    industry,
    industryDescription: getIndustryDescription(industry),
    preferredLanguages,
    isIndianCinema,
    isBollywood,
    isHollywood,
    isKorean,
    isJapanese,
    isChinese,
    isEuropean,
    isEpic,
    isMassHero,
    isActionHeavy,
    budget
  };
}

/**
 * Determine the cinema industry based on language and country
 */
function determineIndustry(
  originalLanguage: string,
  productionCountries: string[],
  title: string
): CinemaIndustry {
  // Check language first
  if (LANGUAGE_TO_INDUSTRY[originalLanguage]) {
    const industry = LANGUAGE_TO_INDUSTRY[originalLanguage];
    
    // For Indian languages, be more specific
    if (originalLanguage === 'hi') return 'bollywood';
    if (originalLanguage === 'te') return 'tollywood';
    if (originalLanguage === 'ta') return 'kollywood';
    if (originalLanguage === 'ml') return 'mollywood';
    if (originalLanguage === 'kn') return 'sandalwood';
    
    return industry;
  }
  
  // Check production countries
  for (const country of productionCountries) {
    if (COUNTRY_TO_INDUSTRY[country]) {
      return COUNTRY_TO_INDUSTRY[country];
    }
  }
  
  // Check for known Indian film patterns in title
  const titleLower = title.toLowerCase();
  if (KNOWN_INDIAN_EPICS.some(epic => titleLower.includes(epic))) {
    return 'tollywood'; // Most known epics are Telugu
  }
  
  return 'other';
}

/**
 * Get preferred languages for recommendations based on industry
 */
function getPreferredLanguages(industry: CinemaIndustry, originalLanguage: string): string[] {
  switch (industry) {
    case 'bollywood':
      return ['hi', 'te', 'ta']; // Hindi and commonly dubbed languages
    case 'tollywood':
      return ['te', 'hi', 'ta', 'kn']; // Telugu, Hindi (dubbed), Tamil, Kannada
    case 'kollywood':
      return ['ta', 'hi', 'te', 'ml']; // Tamil, Hindi (dubbed), Telugu, Malayalam
    case 'mollywood':
      return ['ml', 'hi', 'ta']; // Malayalam, Hindi (dubbed), Tamil
    case 'sandalwood':
      return ['kn', 'hi', 'te', 'ta']; // Kannada, Hindi (dubbed), Telugu, Tamil
    case 'indian-other':
      return ['hi', ...INDIAN_LANGUAGES]; // Hindi first, then other Indian languages
    case 'korean':
      return ['ko']; // Korean only
    case 'japanese':
      return ['ja']; // Japanese only
    case 'chinese':
      return ['zh', 'cn', 'yue']; // Chinese languages
    case 'european':
      return [originalLanguage, 'en']; // Original + English
    case 'hollywood':
      return ['en']; // English
    default:
      return [originalLanguage];
  }
}

// ============================================
// Filter Generation
// ============================================

/**
 * Generate cultural filter rules based on reference movie analysis
 */
export function generateCulturalFilters(info: ReferenceMovieInfo): CulturalFilterRules {
  const rules: CulturalFilterRules = {
    preferredLanguages: info.preferredLanguages,
    excludeLanguages: [],
    preferredCountries: [],
    industry: info.industry,
    preferEpicScale: info.isEpic,
    preferMassHeroNarrative: info.isMassHero,
    preferHighBudget: info.budget === 'blockbuster',
    referenceTitle: info.title,
    industryDescription: getIndustryDescription(info.industry)
  };
  
  // For Indian cinema, strongly prefer Indian languages over English
  if (info.isIndianCinema) {
    rules.preferredCountries = ['IN'];
    rules.excludeLanguages = ['en']; // Exclude English unless explicitly requested
    
    // Set TMDB language filter
    if (info.preferredLanguages.length > 0) {
      // Use the original language as primary filter
      rules.withOriginalLanguage = info.originalLanguage;
    }
  } else if (info.isKorean) {
    rules.preferredCountries = ['KR'];
    rules.withOriginalLanguage = 'ko';
  } else if (info.isJapanese) {
    rules.preferredCountries = ['JP'];
    rules.withOriginalLanguage = 'ja';
  } else if (info.isChinese) {
    rules.preferredCountries = ['CN', 'HK', 'TW'];
    rules.withOriginalLanguage = 'zh';
  } else if (info.isHollywood) {
    rules.withOriginalLanguage = 'en';
  }
  
  return rules;
}

/**
 * Get human-readable industry description
 */
function getIndustryDescription(industry: CinemaIndustry): string {
  const descriptions: Record<CinemaIndustry, string> = {
    'bollywood': 'Hindi cinema (Bollywood)',
    'tollywood': 'Telugu cinema (Tollywood)',
    'kollywood': 'Tamil cinema (Kollywood)',
    'mollywood': 'Malayalam cinema (Mollywood)',
    'sandalwood': 'Kannada cinema (Sandalwood)',
    'indian-other': 'Indian regional cinema',
    'hollywood': 'English/Hollywood cinema',
    'korean': 'Korean cinema (K-movies)',
    'japanese': 'Japanese cinema',
    'chinese': 'Chinese cinema',
    'european': 'European cinema',
    'other': 'International cinema'
  };
  
  return descriptions[industry];
}

// ============================================
// Main Analysis Function
// ============================================

/**
 * Complete reference movie analysis pipeline
 */
export async function analyzeReferenceFromQuery(
  message: string
): Promise<{ info: ReferenceMovieInfo; filters: CulturalFilterRules } | null> {
  // Extract title from query
  const title = extractReferenceTitle(message);
  if (!title) {
    return null;
  }
  
  // Find the movie in TMDB
  const { movie, type } = await findReferenceMovie(title);
  if (!movie) {
    return null;
  }
  
  // Analyze the movie
  const info = await analyzeReferenceMovie(movie, type);
  
  // Generate cultural filters
  const filters = generateCulturalFilters(info);
  
  return { info, filters };
}

/**
 * Generate response intro based on reference movie
 */
export function generateSimilarMovieIntro(info: ReferenceMovieInfo): string {
  const parts: string[] = [];
  
  parts.push(`If you liked **${info.title}**`);
  
  if (info.isIndianCinema) {
    if (info.isEpic || info.isMassHero) {
      parts.push(`you might enjoy these ${info.industryDescription} epic action movies`);
    } else {
      parts.push(`you might enjoy these ${info.industryDescription} films`);
    }
  } else if (info.isKorean) {
    parts.push('you might enjoy these Korean films');
  } else if (info.isJapanese) {
    parts.push('you might enjoy these Japanese films');
  } else {
    parts.push('you might enjoy these similar films');
  }
  
  return parts.join(', ') + ':';
}

export default {
  extractReferenceTitle,
  findReferenceMovie,
  analyzeReferenceMovie,
  generateCulturalFilters,
  analyzeReferenceFromQuery,
  generateSimilarMovieIntro
};
