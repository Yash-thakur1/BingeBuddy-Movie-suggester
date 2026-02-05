/**
 * Movie Details Cache System with Prefetching
 * 
 * Features:
 * - Per-movie-ID caching with SWR pattern
 * - Background prefetching on hover/scroll
 * - Phased data loading (essential vs deferred)
 * - Smart cache invalidation
 * - Prevents redundant API calls
 */

import { MovieDetails, Credits, VideosResponse, WatchProvidersResponse, PaginatedResponse, Movie, Cast, Crew } from '@/types/movie';

const MOVIE_CACHE_PREFIX = 'bingebuddy-movie';
const CACHE_VERSION = 'v1';

// Cache durations
const CACHE_MAX_AGE = 15 * 60 * 1000; // 15 minutes (fresh)
const CACHE_STALE_AGE = 24 * 60 * 60 * 1000; // 24 hours (stale but usable)

// Data field types for partial fetching
export type MovieDataField = 'details' | 'credits' | 'videos' | 'providers' | 'similar' | 'recommendations';

interface MovieCacheEntry {
  data: Partial<CachedMovieData>;
  timestamp: number;
  version: string;
}

export interface CachedMovieData {
  details: MovieDetails;
  credits: Credits;
  videos: VideosResponse;
  providers: WatchProvidersResponse;
  similar: PaginatedResponse<Movie>;
  recommendations: PaginatedResponse<Movie>;
}

// In-memory cache for ultra-fast access (session-based)
const memoryCache = new Map<number, { data: Partial<CachedMovieData>; timestamp: number }>();

// Prefetch queue to avoid duplicate requests
const prefetchQueue = new Set<number>();
const prefetchingInProgress = new Set<number>();

/**
 * Get cache key for a movie
 */
function getCacheKey(movieId: number): string {
  return `${MOVIE_CACHE_PREFIX}:${CACHE_VERSION}:${movieId}`;
}

/**
 * Get movie data from memory cache (fastest)
 */
function getFromMemory(movieId: number): Partial<CachedMovieData> | null {
  const entry = memoryCache.get(movieId);
  if (!entry) return null;
  
  const age = Date.now() - entry.timestamp;
  if (age > CACHE_STALE_AGE) {
    memoryCache.delete(movieId);
    return null;
  }
  
  return entry.data;
}

/**
 * Get movie data from localStorage cache
 */
function getFromStorage(movieId: number): { data: Partial<CachedMovieData>; isStale: boolean } | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const raw = localStorage.getItem(getCacheKey(movieId));
    if (!raw) return null;
    
    const entry: MovieCacheEntry = JSON.parse(raw);
    if (entry.version !== CACHE_VERSION) return null;
    
    const age = Date.now() - entry.timestamp;
    if (age > CACHE_STALE_AGE) {
      localStorage.removeItem(getCacheKey(movieId));
      return null;
    }
    
    // Also populate memory cache
    memoryCache.set(movieId, { data: entry.data, timestamp: entry.timestamp });
    
    return {
      data: entry.data,
      isStale: age > CACHE_MAX_AGE,
    };
  } catch {
    return null;
  }
}

/**
 * Save movie data to cache
 */
function saveToCache(movieId: number, data: Partial<CachedMovieData>, merge = true): void {
  const timestamp = Date.now();
  
  // Merge with existing data if specified
  let finalData = data;
  if (merge) {
    const existing = getFromMemory(movieId) || getFromStorage(movieId)?.data;
    if (existing) {
      finalData = { ...existing, ...data };
    }
  }
  
  // Save to memory cache
  memoryCache.set(movieId, { data: finalData, timestamp });
  
  // Save to localStorage
  if (typeof window !== 'undefined') {
    try {
      const entry: MovieCacheEntry = {
        data: finalData,
        timestamp,
        version: CACHE_VERSION,
      };
      localStorage.setItem(getCacheKey(movieId), JSON.stringify(entry));
    } catch (error) {
      console.warn('[MovieCache] Failed to save to localStorage:', error);
    }
  }
}

/**
 * Get cached movie data
 * Returns available data and flags for what needs fetching
 */
export function getMovieCache(movieId: number): {
  data: Partial<CachedMovieData> | null;
  isStale: boolean;
  timestamp: number | null;
  hasDetails: boolean;
  hasCredits: boolean;
  hasVideos: boolean;
  hasProviders: boolean;
  hasSimilar: boolean;
  hasRecommendations: boolean;
} {
  // Try memory first, then storage
  const memoryData = getFromMemory(movieId);
  const memoryEntry = memoryCache.get(movieId);
  if (memoryData && memoryEntry) {
    return {
      data: memoryData,
      isStale: false, // Memory cache is always fresh
      timestamp: memoryEntry.timestamp,
      hasDetails: !!memoryData.details,
      hasCredits: !!memoryData.credits,
      hasVideos: !!memoryData.videos,
      hasProviders: !!memoryData.providers,
      hasSimilar: !!memoryData.similar,
      hasRecommendations: !!memoryData.recommendations,
    };
  }
  
  const storageResult = getFromStorage(movieId);
  const storageEntry = memoryCache.get(movieId); // getFromStorage populates memoryCache
  if (storageResult) {
    return {
      data: storageResult.data,
      isStale: storageResult.isStale,
      timestamp: storageEntry?.timestamp ?? null,
      hasDetails: !!storageResult.data.details,
      hasCredits: !!storageResult.data.credits,
      hasVideos: !!storageResult.data.videos,
      hasProviders: !!storageResult.data.providers,
      hasSimilar: !!storageResult.data.similar,
      hasRecommendations: !!storageResult.data.recommendations,
    };
  }
  
  return {
    data: null,
    isStale: true,
    timestamp: null,
    hasDetails: false,
    hasCredits: false,
    hasVideos: false,
    hasProviders: false,
    hasSimilar: false,
    hasRecommendations: false,
  };
}

/**
 * Update movie cache with specific data
 */
export function updateMovieCache(movieId: number, data: Partial<CachedMovieData>): void {
  saveToCache(movieId, data, true);
}

/**
 * Clear movie from cache
 */
export function clearMovieCache(movieId: number): void {
  memoryCache.delete(movieId);
  if (typeof window !== 'undefined') {
    localStorage.removeItem(getCacheKey(movieId));
  }
}

/**
 * Prefetch essential movie data (details only) - for hover
 */
export async function prefetchMovieEssentials(movieId: number): Promise<void> {
  // Skip if already cached or being fetched
  if (prefetchingInProgress.has(movieId)) return;
  
  const cached = getMovieCache(movieId);
  if (cached.hasDetails && !cached.isStale) return;
  
  prefetchingInProgress.add(movieId);
  
  try {
    // Dynamic import to avoid circular dependencies
    const { getMovieDetails } = await import('@/lib/tmdb/api');
    const details = await getMovieDetails(movieId);
    updateMovieCache(movieId, { details });
    console.log(`[Prefetch] Fetched essentials for movie ${movieId}`);
  } catch (error) {
    console.warn(`[Prefetch] Failed to fetch movie ${movieId}:`, error);
  } finally {
    prefetchingInProgress.delete(movieId);
  }
}

/**
 * Prefetch full movie data (all fields) - for near-viewport movies
 */
export async function prefetchMovieFull(movieId: number): Promise<void> {
  if (prefetchingInProgress.has(movieId)) return;
  
  const cached = getMovieCache(movieId);
  
  // Check what's missing
  const needsDetails = !cached.hasDetails || cached.isStale;
  const needsCredits = !cached.hasCredits;
  const needsVideos = !cached.hasVideos;
  const needsProviders = !cached.hasProviders;
  
  if (!needsDetails && !needsCredits && !needsVideos && !needsProviders) return;
  
  prefetchingInProgress.add(movieId);
  
  try {
    const { getMovieDetails, getMovieCredits, getMovieVideos, getMovieWatchProviders } = await import('@/lib/tmdb/api');
    
    const promises: Promise<void>[] = [];
    
    if (needsDetails) {
      promises.push(
        getMovieDetails(movieId).then(details => updateMovieCache(movieId, { details }))
      );
    }
    if (needsCredits) {
      promises.push(
        getMovieCredits(movieId).then(credits => updateMovieCache(movieId, { credits }))
      );
    }
    if (needsVideos) {
      promises.push(
        getMovieVideos(movieId).then(videos => updateMovieCache(movieId, { videos }))
      );
    }
    if (needsProviders) {
      promises.push(
        getMovieWatchProviders(movieId).then(providers => updateMovieCache(movieId, { providers }))
      );
    }
    
    await Promise.all(promises);
    console.log(`[Prefetch] Fetched full data for movie ${movieId}`);
  } catch (error) {
    console.warn(`[Prefetch] Failed to fetch full movie ${movieId}:`, error);
  } finally {
    prefetchingInProgress.delete(movieId);
  }
}

/**
 * Queue movies for prefetching (batch prefetch for visible movies)
 */
export function queueMoviesForPrefetch(movieIds: number[]): void {
  movieIds.forEach(id => {
    if (!prefetchQueue.has(id) && !prefetchingInProgress.has(id)) {
      const cached = getMovieCache(id);
      if (!cached.hasDetails || cached.isStale) {
        prefetchQueue.add(id);
      }
    }
  });
  
  // Process queue in batches
  processPreFetchQueue();
}

let prefetchTimeout: NodeJS.Timeout | null = null;

function processPreFetchQueue(): void {
  if (prefetchTimeout) return;
  
  prefetchTimeout = setTimeout(async () => {
    prefetchTimeout = null;
    
    // Process up to 3 movies at a time
    const batch = Array.from(prefetchQueue).slice(0, 3);
    batch.forEach(id => prefetchQueue.delete(id));
    
    await Promise.all(batch.map(id => prefetchMovieEssentials(id)));
    
    // Continue if more in queue
    if (prefetchQueue.size > 0) {
      processPreFetchQueue();
    }
  }, 100);
}

/**
 * Clear expired movie caches
 */
export function clearExpiredMovieCaches(): void {
  if (typeof window === 'undefined') return;
  
  const prefix = `${MOVIE_CACHE_PREFIX}:${CACHE_VERSION}:`;
  const keysToRemove: string[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(prefix)) continue;
    
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      
      const entry: MovieCacheEntry = JSON.parse(raw);
      const age = Date.now() - entry.timestamp;
      
      if (age > CACHE_STALE_AGE) {
        keysToRemove.push(key);
      }
    } catch {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => localStorage.removeItem(key));
  
  if (keysToRemove.length > 0) {
    console.log(`[MovieCache] Cleared ${keysToRemove.length} expired entries`);
  }
}

// Clear expired caches on module load (browser only)
if (typeof window !== 'undefined') {
  setTimeout(clearExpiredMovieCaches, 5000);
}
