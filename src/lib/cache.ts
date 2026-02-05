/**
 * Per-User Cache System with Stale-While-Revalidate Strategy
 * 
 * Features:
 * - User-scoped cache keys to prevent data leakage
 * - Stale-while-revalidate for fast initial load
 * - Automatic expiration and cleanup
 * - Full cache clear on logout
 */

const CACHE_PREFIX = 'bingebuddy-cache';
const CACHE_VERSION = 'v1';
const DEFAULT_MAX_AGE = 5 * 60 * 1000; // 5 minutes
const DEFAULT_STALE_AGE = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  userId: string;
  version: string;
}

interface CacheOptions {
  maxAge?: number; // Fresh duration in ms
  staleAge?: number; // Maximum stale duration in ms
}

/**
 * Get a user-scoped cache key
 */
function getCacheKey(key: string, userId: string): string {
  return `${CACHE_PREFIX}:${CACHE_VERSION}:${userId}:${key}`;
}

/**
 * Get all cache keys for a specific user
 */
function getUserCacheKeys(userId: string): string[] {
  const keys: string[] = [];
  const prefix = `${CACHE_PREFIX}:${CACHE_VERSION}:${userId}:`;
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) {
      keys.push(key);
    }
  }
  
  return keys;
}

/**
 * Set cache data for a user
 */
export function setCache<T>(key: string, data: T, userId: string): void {
  if (typeof window === 'undefined' || !userId) return;
  
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      userId,
      version: CACHE_VERSION,
    };
    
    localStorage.setItem(getCacheKey(key, userId), JSON.stringify(entry));
  } catch (error) {
    console.warn('[Cache] Failed to set cache:', error);
    // If localStorage is full, clear old entries
    clearExpiredCache();
  }
}

/**
 * Get cached data for a user
 * Returns { data, isStale, isFresh } or null if not found/expired
 */
export function getCache<T>(
  key: string,
  userId: string,
  options: CacheOptions = {}
): { data: T; isStale: boolean; isFresh: boolean } | null {
  if (typeof window === 'undefined' || !userId) return null;
  
  const { maxAge = DEFAULT_MAX_AGE, staleAge = DEFAULT_STALE_AGE } = options;
  
  try {
    const raw = localStorage.getItem(getCacheKey(key, userId));
    if (!raw) return null;
    
    const entry: CacheEntry<T> = JSON.parse(raw);
    
    // Validate cache entry
    if (entry.userId !== userId || entry.version !== CACHE_VERSION) {
      return null;
    }
    
    const age = Date.now() - entry.timestamp;
    
    // If beyond stale age, treat as expired
    if (age > staleAge) {
      localStorage.removeItem(getCacheKey(key, userId));
      return null;
    }
    
    return {
      data: entry.data,
      isFresh: age <= maxAge,
      isStale: age > maxAge,
    };
  } catch {
    return null;
  }
}

/**
 * Remove specific cache entry
 */
export function removeCache(key: string, userId: string): void {
  if (typeof window === 'undefined' || !userId) return;
  localStorage.removeItem(getCacheKey(key, userId));
}

/**
 * Clear all cache for a specific user (call on logout)
 */
export function clearUserCache(userId: string): void {
  if (typeof window === 'undefined' || !userId) return;
  
  const keys = getUserCacheKeys(userId);
  keys.forEach((key) => localStorage.removeItem(key));
  
  console.log(`[Cache] Cleared ${keys.length} cache entries for user ${userId}`);
}

/**
 * Clear all expired cache entries
 */
export function clearExpiredCache(): void {
  if (typeof window === 'undefined') return;
  
  const prefix = `${CACHE_PREFIX}:${CACHE_VERSION}:`;
  const keysToRemove: string[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(prefix)) continue;
    
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      
      const entry: CacheEntry<unknown> = JSON.parse(raw);
      const age = Date.now() - entry.timestamp;
      
      if (age > DEFAULT_STALE_AGE) {
        keysToRemove.push(key);
      }
    } catch {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach((key) => localStorage.removeItem(key));
  
  if (keysToRemove.length > 0) {
    console.log(`[Cache] Cleared ${keysToRemove.length} expired cache entries`);
  }
}

/**
 * Stale-While-Revalidate fetch helper
 * Returns cached data immediately, fetches fresh data in background
 */
export async function fetchWithSWR<T>(
  key: string,
  userId: string,
  fetcher: () => Promise<T>,
  options: CacheOptions & {
    onFreshData?: (data: T) => void;
    onError?: (error: Error) => void;
  } = {}
): Promise<{ data: T | null; isFromCache: boolean; isFresh: boolean }> {
  const { onFreshData, onError, ...cacheOptions } = options;
  
  // Try to get from cache first
  const cached = getCache<T>(key, userId, cacheOptions);
  
  if (cached) {
    // If stale, revalidate in background
    if (cached.isStale) {
      fetcher()
        .then((freshData) => {
          setCache(key, freshData, userId);
          onFreshData?.(freshData);
        })
        .catch((error) => {
          console.error('[Cache] Background revalidation failed:', error);
          onError?.(error);
        });
    }
    
    return {
      data: cached.data,
      isFromCache: true,
      isFresh: cached.isFresh,
    };
  }
  
  // No cache, fetch fresh data
  try {
    const freshData = await fetcher();
    setCache(key, freshData, userId);
    return {
      data: freshData,
      isFromCache: false,
      isFresh: true,
    };
  } catch (error) {
    onError?.(error as Error);
    return {
      data: null,
      isFromCache: false,
      isFresh: false,
    };
  }
}

// Cache keys for different data types
export const CACHE_KEYS = {
  WATCHLIST: 'watchlist',
  PREFERENCES: 'preferences',
  SEARCH_HISTORY: 'search-history',
  TRENDING_MOVIES: 'trending-movies',
  TRENDING_TV: 'trending-tv',
} as const;
