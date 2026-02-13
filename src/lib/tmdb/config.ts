/**
 * TMDB API Configuration
 * All TMDB-related constants and utilities
 */

// API Configuration
export const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || '';
export const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN || '';
export const TMDB_API_BASE = process.env.NEXT_PUBLIC_TMDB_API_BASE || 'https://api.themoviedb.org/3';
export const TMDB_IMAGE_BASE = process.env.NEXT_PUBLIC_TMDB_IMAGE_BASE || 'https://image.tmdb.org/t/p';

// Image size configurations
export const IMAGE_SIZES = {
  poster: {
    small: 'w185',
    medium: 'w342',
    large: 'w500',
    original: 'original',
  },
  backdrop: {
    small: 'w300',
    medium: 'w780',
    large: 'w1280',
    original: 'original',
  },
  profile: {
    small: 'w45',
    medium: 'w185',
    large: 'h632',
    original: 'original',
  },
} as const;

// Genre mappings with additional metadata
export const GENRES = [
  { id: 28, name: 'Action', icon: '💥', color: '#ef4444' },
  { id: 12, name: 'Adventure', icon: '🗺️', color: '#f97316' },
  { id: 16, name: 'Animation', icon: '🎨', color: '#eab308' },
  { id: 35, name: 'Comedy', icon: '😂', color: '#22c55e' },
  { id: 80, name: 'Crime', icon: '🔪', color: '#6b7280' },
  { id: 99, name: 'Documentary', icon: '📹', color: '#3b82f6' },
  { id: 18, name: 'Drama', icon: '🎭', color: '#8b5cf6' },
  { id: 10751, name: 'Family', icon: '👨‍👩‍👧‍👦', color: '#ec4899' },
  { id: 14, name: 'Fantasy', icon: '🧙', color: '#a855f7' },
  { id: 36, name: 'History', icon: '📜', color: '#78716c' },
  { id: 27, name: 'Horror', icon: '👻', color: '#1f2937' },
  { id: 10402, name: 'Music', icon: '🎵', color: '#06b6d4' },
  { id: 9648, name: 'Mystery', icon: '🔍', color: '#4b5563' },
  { id: 10749, name: 'Romance', icon: '💕', color: '#f472b6' },
  { id: 878, name: 'Science Fiction', icon: '🚀', color: '#0ea5e9' },
  { id: 10770, name: 'TV Movie', icon: '📺', color: '#64748b' },
  { id: 53, name: 'Thriller', icon: '😰', color: '#dc2626' },
  { id: 10752, name: 'War', icon: '⚔️', color: '#57534e' },
  { id: 37, name: 'Western', icon: '🤠', color: '#ca8a04' },
] as const;

// Language codes with display names
export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
] as const;

// Quick mood presets for one-click suggestions
export const QUICK_MOODS = [
  {
    id: 'bored',
    label: 'I feel bored',
    icon: '😴',
    genres: [28, 12, 878],
    description: 'Action-packed adventures to wake you up',
  },
  {
    id: 'action',
    label: 'I want action',
    icon: '💪',
    genres: [28, 53, 80],
    description: 'High-octane thrills and excitement',
  },
  {
    id: 'laugh',
    label: 'Make me laugh',
    icon: '😂',
    genres: [35],
    description: 'Comedies to brighten your day',
  },
  {
    id: 'romance',
    label: 'Feeling romantic',
    icon: '💕',
    genres: [10749, 18],
    description: 'Love stories that touch the heart',
  },
  {
    id: 'scared',
    label: 'Scare me',
    icon: '👻',
    genres: [27, 53],
    description: 'Horror and thrillers for brave souls',
  },
  {
    id: 'think',
    label: 'Make me think',
    icon: '🧠',
    genres: [9648, 878, 18],
    description: 'Mind-bending mysteries and dramas',
  },
  {
    id: 'cry',
    label: 'Let me cry',
    icon: '😢',
    genres: [18, 10749],
    description: 'Emotional stories that touch the soul',
  },
  {
    id: 'surprise',
    label: 'Surprise me',
    icon: '🎲',
    genres: [],
    description: 'Random picks from top rated movies',
  },
] as const;

// Era presets for filtering
export const ERA_PRESETS = {
  all: { from: null, to: null }, // No date filtering - all eras combined
  latest: { from: new Date().getFullYear() - 1, to: new Date().getFullYear() },
  '2020s': { from: 2020, to: 2029 },
  '2010s': { from: 2010, to: 2019 },
  '2000s': { from: 2000, to: 2009 },
  '90s': { from: 1990, to: 1999 },
  classic: { from: 1900, to: 1989 },
} as const;

// TV Genre mappings
export const TV_GENRES = [
  { id: 10759, name: 'Action & Adventure', icon: '💥', color: '#ef4444' },
  { id: 16, name: 'Animation', icon: '🎨', color: '#eab308' },
  { id: 35, name: 'Comedy', icon: '😂', color: '#22c55e' },
  { id: 80, name: 'Crime', icon: '🔪', color: '#6b7280' },
  { id: 99, name: 'Documentary', icon: '📹', color: '#3b82f6' },
  { id: 18, name: 'Drama', icon: '🎭', color: '#8b5cf6' },
  { id: 10751, name: 'Family', icon: '👨‍👩‍👧‍👦', color: '#ec4899' },
  { id: 10762, name: 'Kids', icon: '🧒', color: '#f97316' },
  { id: 9648, name: 'Mystery', icon: '🔍', color: '#4b5563' },
  { id: 10763, name: 'News', icon: '📰', color: '#64748b' },
  { id: 10764, name: 'Reality', icon: '📺', color: '#06b6d4' },
  { id: 10765, name: 'Sci-Fi & Fantasy', icon: '🚀', color: '#0ea5e9' },
  { id: 10766, name: 'Soap', icon: '💕', color: '#f472b6' },
  { id: 10767, name: 'Talk', icon: '🎤', color: '#a855f7' },
  { id: 10768, name: 'War & Politics', icon: '⚔️', color: '#57534e' },
  { id: 37, name: 'Western', icon: '🤠', color: '#ca8a04' },
] as const;

// Quick moods for TV Shows
export const TV_QUICK_MOODS = [
  {
    id: 'binge',
    label: 'Binge-worthy',
    icon: '📺',
    genres: [18, 80, 9648],
    description: 'Addictive series you can\'t stop watching',
  },
  {
    id: 'action',
    label: 'Action-packed',
    icon: '💪',
    genres: [10759, 10765],
    description: 'Thrilling adventures and excitement',
  },
  {
    id: 'laugh',
    label: 'Make me laugh',
    icon: '😂',
    genres: [35],
    description: 'Comedies to brighten your day',
  },
  {
    id: 'drama',
    label: 'Deep dramas',
    icon: '🎭',
    genres: [18],
    description: 'Emotional and gripping stories',
  },
  {
    id: 'mystery',
    label: 'Mysteries',
    icon: '🔍',
    genres: [9648, 80],
    description: 'Puzzles and whodunits',
  },
  {
    id: 'scifi',
    label: 'Sci-Fi & Fantasy',
    icon: '🚀',
    genres: [10765],
    description: 'Otherworldly adventures',
  },
  {
    id: 'reality',
    label: 'Reality TV',
    icon: '🎬',
    genres: [10764],
    description: 'Unscripted entertainment',
  },
  {
    id: 'surprise',
    label: 'Surprise me',
    icon: '🎲',
    genres: [],
    description: 'Random picks from top rated shows',
  },
] as const;

// Sort options for movie lists
export const SORT_OPTIONS = [
  { value: '', label: 'Nothing (Default)' },
  { value: 'popularity.desc', label: 'Most Popular' },
  { value: 'vote_average.desc', label: 'Highest Rated' },
  { value: 'release_date.desc', label: 'Latest' },
  { value: 'release_date.asc', label: 'Oldest' },
  { value: 'revenue.desc', label: 'Box Office' },
] as const;

// Sort options for TV shows
export const TV_SORT_OPTIONS = [
  { value: '', label: 'Nothing (Default)' },
  { value: 'popularity.desc', label: 'Most Popular' },
  { value: 'vote_average.desc', label: 'Highest Rated' },
  { value: 'first_air_date.desc', label: 'Latest' },
  { value: 'first_air_date.asc', label: 'Oldest' },
] as const;

/**
 * Fallback poster as data URL to avoid Vercel image optimization quota
 * 342x513 dark placeholder matching poster aspect ratio
 */
export const FALLBACK_POSTER_DATA_URL = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='342' height='513'%3E%3Crect width='342' height='513' fill='%231a1b1e'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='system-ui' font-size='18' fill='%23666' opacity='0.5'%3ENo Image%3C/text%3E%3C/svg%3E`;

/**
 * Build full image URL from TMDB path
 */
export function getImageUrl(
  path: string | null,
  size: string = 'w500'
): string {
  if (!path) return FALLBACK_POSTER_DATA_URL;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

/**
 * Get YouTube thumbnail URL
 */
export function getYouTubeThumbnail(videoKey: string): string {
  return `https://img.youtube.com/vi/${videoKey}/maxresdefault.jpg`;
}

/**
 * Get genre name by ID
 */
export function getGenreName(genreId: number): string {
  return GENRES.find((g) => g.id === genreId)?.name || 'Unknown';
}

/**
 * Get TV genre name by ID
 */
export function getTVGenreName(genreId: number): string {
  return TV_GENRES.find((g) => g.id === genreId)?.name || 
         GENRES.find((g) => g.id === genreId)?.name || 'Unknown';
}

/**
 * Get genre by ID with full metadata
 */
export function getGenreById(genreId: number) {
  return GENRES.find((g) => g.id === genreId);
}

/**
 * Get TV genre by ID with full metadata
 */
export function getTVGenreById(genreId: number) {
  return TV_GENRES.find((g) => g.id === genreId) || GENRES.find((g) => g.id === genreId);
}

/**
 * Format runtime to hours and minutes
 */
export function formatRuntime(minutes: number): string {
  if (!minutes) return 'N/A';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

/**
 * Format date to readable string
 */
export function formatDate(dateString: string): string {
  if (!dateString) return 'TBA';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Get year from date string
 */
export function getYear(dateString: string): string {
  if (!dateString) return 'TBA';
  return new Date(dateString).getFullYear().toString();
}

/**
 * Format vote average to display rating
 */
export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

/**
 * Get rating color class based on score
 */
export function getRatingColor(rating: number): string {
  if (rating >= 8) return 'text-green-400';
  if (rating >= 6) return 'text-yellow-400';
  if (rating >= 4) return 'text-orange-400';
  return 'text-red-400';
}

/**
 * Get rating background class based on score
 */
export function getRatingBgColor(rating: number): string {
  if (rating >= 8) return 'bg-green-500/20 border-green-500/50';
  if (rating >= 6) return 'bg-yellow-500/20 border-yellow-500/50';
  if (rating >= 4) return 'bg-orange-500/20 border-orange-500/50';
  return 'bg-red-500/20 border-red-500/50';
}
