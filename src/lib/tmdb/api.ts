/**
 * TMDB API Client
 * Handles all API requests to The Movie Database
 * Includes performance tracking and robust error handling
 */

import {
  Movie,
  MovieDetails,
  TVShow,
  TVShowDetails,
  Credits,
  VideosResponse,
  WatchProvidersResponse,
  PaginatedResponse,
  Genre,
  GenresResponse,
  SortOption,
} from '@/types/movie';
import { TMDB_API_BASE, TMDB_API_KEY } from './config';

// ============================================
// API Request Utilities
// ============================================

interface FetchOptions {
  method?: string;
  cache?: RequestCache;
  next?: { revalidate?: number; tags?: string[] };
}

// API Error types for better error handling
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public endpoint?: string,
    public isNetworkError: boolean = false
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Track API call timing (only in browser)
 */
function trackAPITiming(endpoint: string, duration: number, success: boolean): void {
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    const color = success 
      ? (duration < 500 ? '#22c55e' : duration < 1000 ? '#eab308' : '#ef4444')
      : '#ef4444';
    console.log(
      `%c🌐 [API] ${endpoint}: ${duration.toFixed(0)}ms ${success ? '✓' : '✗'}`,
      `color: ${color}; font-weight: bold;`
    );
  }
}

/**
 * Make authenticated request to TMDB API with retry logic
 */
async function tmdbFetch<T>(
  endpoint: string,
  params: Record<string, string | number | undefined> = {},
  options: FetchOptions = {},
  retries: number = 3
): Promise<T> {
  const startTime = Date.now();
  
  // Check if API key is configured
  if (!TMDB_API_KEY) {
    throw new APIError(
      'TMDB API key is not configured. Please add NEXT_PUBLIC_TMDB_API_KEY to your .env.local file.',
      undefined,
      endpoint
    );
  }

  const url = new URL(`${TMDB_API_BASE}${endpoint}`);
  
  // Add API key
  url.searchParams.set('api_key', TMDB_API_KEY);
  
  // Add additional params
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const fetchOptions: RequestInit = {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      };

      // Only set cache if explicitly provided
      if (options.cache) {
        fetchOptions.cache = options.cache;
      }

      // Use Next.js revalidation by default
      if (options.next) {
        (fetchOptions as any).next = options.next;
      } else {
        // Default revalidation of 1 hour
        (fetchOptions as any).next = { revalidate: 3600 };
      }

      const response = await fetch(url.toString(), fetchOptions);

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('TMDB API Error:', response.status, errorText);
        throw new APIError(
          `TMDB API Error: ${response.status} ${response.statusText}`,
          response.status,
          endpoint
        );
      }

      const data = await response.json();
      
      // Track successful API call
      trackAPITiming(endpoint, Date.now() - startTime, true);
      
      return data;
    } catch (error) {
      lastError = error as Error;
      const isNetwork = (error as Error).name === 'AbortError' || 
        (error as Error).message.includes('fetch failed') ||
        (error as Error).message.includes('network');
      
      if (isNetwork && process.env.NODE_ENV === 'development') {
        console.warn(`TMDB Fetch Attempt ${attempt}/${retries} failed (network):`, (error as Error).message);
      }
      
      if (attempt < retries) {
        // Wait before retrying (exponential backoff)
        await sleep(1000 * attempt);
      }
    }
  }

  // Track failed API call
  trackAPITiming(endpoint, Date.now() - startTime, false);

  if (lastError instanceof APIError) {
    throw lastError;
  }
  
  throw new APIError(
    lastError?.message || 'Failed to fetch from TMDB API',
    undefined,
    endpoint,
    true
  );
}

// ============================================
// Movie Endpoints
// ============================================

/**
 * Get trending movies
 */
export async function getTrendingMovies(
  timeWindow: 'day' | 'week' = 'week',
  page: number = 1
): Promise<PaginatedResponse<Movie>> {
  return tmdbFetch(`/trending/movie/${timeWindow}`, { page }, { next: { revalidate: 3600 } });
}

/**
 * Get popular movies
 */
export async function getPopularMovies(page: number = 1): Promise<PaginatedResponse<Movie>> {
  return tmdbFetch('/movie/popular', { page }, { next: { revalidate: 3600 } });
}

/**
 * Get top rated movies
 */
export async function getTopRatedMovies(page: number = 1): Promise<PaginatedResponse<Movie>> {
  return tmdbFetch('/movie/top_rated', { page }, { next: { revalidate: 3600 } });
}

/**
 * Get now playing movies
 */
export async function getNowPlayingMovies(page: number = 1): Promise<PaginatedResponse<Movie>> {
  return tmdbFetch('/movie/now_playing', { page }, { next: { revalidate: 3600 } });
}

/**
 * Get upcoming movies
 */
export async function getUpcomingMovies(page: number = 1): Promise<PaginatedResponse<Movie>> {
  return tmdbFetch('/movie/upcoming', { page }, { next: { revalidate: 3600 } });
}

/**
 * Get movies by a specific genre ID
 */
export async function getMoviesByGenre(
  genreId: number,
  page: number = 1
): Promise<PaginatedResponse<Movie>> {
  return tmdbFetch(
    '/discover/movie',
    {
      with_genres: String(genreId),
      sort_by: 'popularity.desc',
      'vote_count.gte': 50,
      include_adult: 'false',
      page,
    },
    { next: { revalidate: 3600 } }
  );
}

/**
 * Get movie details
 */
export async function getMovieDetails(movieId: number): Promise<MovieDetails> {
  return tmdbFetch(`/movie/${movieId}`, {}, { next: { revalidate: 86400 } });
}

/**
 * Get movie credits (cast & crew)
 */
export async function getMovieCredits(movieId: number): Promise<Credits> {
  return tmdbFetch(`/movie/${movieId}/credits`, {}, { next: { revalidate: 86400 } });
}

/**
 * Get movie videos (trailers, teasers, etc.)
 */
export async function getMovieVideos(movieId: number): Promise<VideosResponse> {
  return tmdbFetch(`/movie/${movieId}/videos`, {}, { next: { revalidate: 86400 } });
}

/**
 * Get similar movies
 */
export async function getSimilarMovies(
  movieId: number,
  page: number = 1
): Promise<PaginatedResponse<Movie>> {
  return tmdbFetch(`/movie/${movieId}/similar`, { page }, { next: { revalidate: 86400 } });
}

/**
 * Get movie recommendations
 */
export async function getMovieRecommendations(
  movieId: number,
  page: number = 1
): Promise<PaginatedResponse<Movie>> {
  return tmdbFetch(`/movie/${movieId}/recommendations`, { page }, { next: { revalidate: 86400 } });
}

/**
 * Get watch providers for a movie
 * Returns streaming platforms where the movie is available
 */
export async function getMovieWatchProviders(movieId: number): Promise<WatchProvidersResponse> {
  return tmdbFetch(`/movie/${movieId}/watch/providers`, {}, { next: { revalidate: 3600 } });
}

// ============================================
// Discovery & Search
// ============================================

interface DiscoverParams {
  page?: number;
  with_genres?: string;
  primary_release_year?: number;
  'primary_release_date.gte'?: string;
  'primary_release_date.lte'?: string;
  'vote_average.gte'?: number;
  'vote_average.lte'?: number;
  'vote_count.gte'?: number;
  with_original_language?: string;
  'with_runtime.gte'?: number;
  'with_runtime.lte'?: number;
  sort_by?: SortOption;
  include_adult?: boolean;
}

/**
 * Discover movies with filters
 */
export async function discoverMovies(
  params: DiscoverParams = {}
): Promise<PaginatedResponse<Movie>> {
  return tmdbFetch(
    '/discover/movie',
    {
      ...params,
      include_adult: 'false',
      'vote_count.gte': params['vote_count.gte'] ?? 50, // Ensure quality results
    },
    { next: { revalidate: 3600 } }
  );
}

/**
 * Search movies by query
 */
export async function searchMovies(
  query: string,
  page: number = 1
): Promise<PaginatedResponse<Movie>> {
  return tmdbFetch(
    '/search/movie',
    { query, page, include_adult: 'false' },
    { next: { revalidate: 60 } } // Cache search results for 1 minute
  );
}

/**
 * Get all movie genres
 */
export async function getGenres(): Promise<Genre[]> {
  const response = await tmdbFetch<GenresResponse>(
    '/genre/movie/list',
    {},
    { next: { revalidate: 604800 } } // Cache for a week
  );
  return response.genres;
}

// ============================================
// Advanced Recommendation Logic
// ============================================

interface RecommendationParams {
  genres: number[];
  mood?: string;
  era?: { from: number; to: number };
  minRating?: number;
  maxRuntime?: number;
  language?: string;
  page?: number;
}

/**
 * Get AI-style recommendations based on user preferences
 */
export async function getSmartRecommendations(
  params: RecommendationParams
): Promise<PaginatedResponse<Movie>> {
  const discoverParams: DiscoverParams = {
    page: params.page || 1,
    sort_by: 'popularity.desc',
  };

  // Apply genre filter
  if (params.genres.length > 0) {
    discoverParams.with_genres = params.genres.join(',');
  }

  // Apply era filter
  if (params.era) {
    discoverParams['primary_release_date.gte'] = `${params.era.from}-01-01`;
    discoverParams['primary_release_date.lte'] = `${params.era.to}-12-31`;
  }

  // Apply rating filter
  if (params.minRating) {
    discoverParams['vote_average.gte'] = params.minRating;
    discoverParams['vote_count.gte'] = 100; // Higher threshold for rated movies
  }

  // Apply runtime filter
  if (params.maxRuntime) {
    discoverParams['with_runtime.lte'] = params.maxRuntime;
  }

  // Apply language filter
  if (params.language) {
    discoverParams.with_original_language = params.language;
  }

  return discoverMovies(discoverParams);
}

/**
 * Get movies by mood preset
 */
export async function getMoviesByMood(
  moodGenres: number[],
  page: number = 1
): Promise<PaginatedResponse<Movie>> {
  // If no genres specified (surprise me), get top rated random selection
  if (moodGenres.length === 0) {
    return getTopRatedMovies(Math.floor(Math.random() * 10) + 1);
  }

  return discoverMovies({
    with_genres: moodGenres.join('|'), // OR operator for variety
    'vote_average.gte': 6,
    'vote_count.gte': 200,
    sort_by: 'popularity.desc',
    page,
  });
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get combined movie data (details + credits + videos)
 */
export async function getFullMovieData(movieId: number) {
  const [details, credits, videos] = await Promise.all([
    getMovieDetails(movieId),
    getMovieCredits(movieId),
    getMovieVideos(movieId),
  ]);

  return { details, credits, videos };
}

/**
 * Get movie trailer (prefer official YouTube trailers)
 */
export function getMainTrailer(videos: VideosResponse | null | undefined): string | null {
  if (!videos?.results?.length) return null;
  
  const trailers = videos.results.filter(
    (v) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
  );

  // Prefer official trailers
  const officialTrailer = trailers.find((t) => t.official && t.type === 'Trailer');
  if (officialTrailer) return officialTrailer.key;

  // Fall back to any trailer
  const anyTrailer = trailers.find((t) => t.type === 'Trailer');
  if (anyTrailer) return anyTrailer.key;

  // Fall back to teaser
  return trailers[0]?.key || null;
}

// ============================================
// TV Series Endpoints
// ============================================

/**
 * Get trending TV shows
 */
export async function getTrendingTVShows(
  timeWindow: 'day' | 'week' = 'week',
  page: number = 1
): Promise<PaginatedResponse<TVShow>> {
  return tmdbFetch(`/trending/tv/${timeWindow}`, { page }, { next: { revalidate: 3600 } });
}

/**
 * Get popular TV shows
 */
export async function getPopularTVShows(page: number = 1): Promise<PaginatedResponse<TVShow>> {
  return tmdbFetch('/tv/popular', { page }, { next: { revalidate: 3600 } });
}

/**
 * Get top rated TV shows
 */
export async function getTopRatedTVShows(page: number = 1): Promise<PaginatedResponse<TVShow>> {
  return tmdbFetch('/tv/top_rated', { page }, { next: { revalidate: 3600 } });
}

/**
 * Get TV shows airing today
 */
export async function getAiringTodayTVShows(page: number = 1): Promise<PaginatedResponse<TVShow>> {
  return tmdbFetch('/tv/airing_today', { page }, { next: { revalidate: 3600 } });
}

/**
 * Get TV shows on air this week
 */
export async function getOnTheAirTVShows(page: number = 1): Promise<PaginatedResponse<TVShow>> {
  return tmdbFetch('/tv/on_the_air', { page }, { next: { revalidate: 3600 } });
}

/**
 * Get TV show details
 */
export async function getTVShowDetails(tvId: number): Promise<TVShowDetails> {
  return tmdbFetch(`/tv/${tvId}`, {}, { next: { revalidate: 86400 } });
}

/**
 * Get TV show credits (cast & crew)
 */
export async function getTVShowCredits(tvId: number): Promise<Credits> {
  return tmdbFetch(`/tv/${tvId}/credits`, {}, { next: { revalidate: 86400 } });
}

/**
 * Get TV show videos (trailers, teasers, etc.)
 */
export async function getTVShowVideos(tvId: number): Promise<VideosResponse> {
  return tmdbFetch(`/tv/${tvId}/videos`, {}, { next: { revalidate: 86400 } });
}

/**
 * Get similar TV shows
 */
export async function getSimilarTVShows(
  tvId: number,
  page: number = 1
): Promise<PaginatedResponse<TVShow>> {
  return tmdbFetch(`/tv/${tvId}/similar`, { page }, { next: { revalidate: 86400 } });
}

/**
 * Get TV show recommendations
 */
export async function getTVShowRecommendations(
  tvId: number,
  page: number = 1
): Promise<PaginatedResponse<TVShow>> {
  return tmdbFetch(`/tv/${tvId}/recommendations`, { page }, { next: { revalidate: 86400 } });
}

/**
 * Get watch providers for a TV show
 */
export async function getTVShowWatchProviders(tvId: number): Promise<WatchProvidersResponse> {
  return tmdbFetch(`/tv/${tvId}/watch/providers`, {}, { next: { revalidate: 3600 } });
}

/**
 * Get all TV genres
 */
export async function getTVGenres(): Promise<Genre[]> {
  const response = await tmdbFetch<GenresResponse>(
    '/genre/tv/list',
    {},
    { next: { revalidate: 604800 } }
  );
  return response.genres;
}

interface DiscoverTVParams {
  page?: number;
  with_genres?: string;
  first_air_date_year?: number;
  'first_air_date.gte'?: string;
  'first_air_date.lte'?: string;
  'vote_average.gte'?: number;
  'vote_average.lte'?: number;
  'vote_count.gte'?: number;
  with_original_language?: string;
  sort_by?: string;
  [key: string]: string | number | undefined;
}

/**
 * Discover TV shows with filters
 */
export async function discoverTVShows(
  params: DiscoverTVParams = {}
): Promise<PaginatedResponse<TVShow>> {
  return tmdbFetch(
    '/discover/tv',
    {
      ...params,
      'vote_count.gte': params['vote_count.gte'] ?? 10,
    },
    { next: { revalidate: 3600 } }
  );
}

/**
 * Search TV shows by query
 */
export async function searchTVShows(
  query: string,
  page: number = 1
): Promise<PaginatedResponse<TVShow>> {
  return tmdbFetch(
    '/search/tv',
    { query, page },
    { next: { revalidate: 60 } }
  );
}

/**
 * Multi search (movies, TV shows, people)
 */
export async function multiSearch(
  query: string,
  page: number = 1
): Promise<PaginatedResponse<Movie | TVShow>> {
  return tmdbFetch(
    '/search/multi',
    { query, page, include_adult: 'false' },
    { next: { revalidate: 60 } }
  );
}

/**
 * Get TV shows by mood preset
 */
export async function getTVShowsByMood(
  moodGenres: number[],
  page: number = 1
): Promise<PaginatedResponse<TVShow>> {
  if (moodGenres.length === 0) {
    return getTopRatedTVShows(Math.floor(Math.random() * 10) + 1);
  }

  return discoverTVShows({
    with_genres: moodGenres.join('|'),
    'vote_average.gte': 6,
    'vote_count.gte': 200,
    sort_by: 'popularity.desc',
    page,
  });
}

/**
 * Get combined TV show data (details + credits + videos)
 */
export async function getFullTVShowData(tvId: number) {
  const [details, credits, videos] = await Promise.all([
    getTVShowDetails(tvId),
    getTVShowCredits(tvId),
    getTVShowVideos(tvId),
  ]);

  return { details, credits, videos };
}
