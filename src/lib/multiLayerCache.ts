/**
 * Multi-Layer Cache System
 * 
 * Priority order:
 * 1. In-memory cache (instant, session-based)
 * 2. IndexedDB (persistent, fast)
 * 3. LocalStorage (persistent, limited size)
 * 4. Network (fallback)
 * 
 * Features:
 * - Automatic cache layer selection
 * - LRU eviction for memory cache
 * - Compression for large data
 * - Cache versioning and migration
 */

// ============================================
// Configuration
// ============================================

const CACHE_VERSION = 2;
const MEMORY_CACHE_MAX_SIZE = 100; // Max items in memory
const IDB_DB_NAME = 'bingebuddy-cache';
const IDB_STORE_NAME = 'data';
const STORAGE_PREFIX = 'flx:';

// Cache TTLs (in milliseconds)
const TTL = {
  short: 5 * 60 * 1000,        // 5 minutes
  medium: 30 * 60 * 1000,      // 30 minutes
  long: 24 * 60 * 60 * 1000,   // 24 hours
  persistent: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export type CacheTTL = keyof typeof TTL;

// ============================================
// Memory Cache (LRU)
// ============================================

interface MemoryCacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccess: number;
}

class LRUMemoryCache {
  private cache = new Map<string, MemoryCacheEntry<unknown>>();
  private maxSize: number;
  
  constructor(maxSize: number = MEMORY_CACHE_MAX_SIZE) {
    this.maxSize = maxSize;
  }
  
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    // Update access info
    entry.accessCount++;
    entry.lastAccess = Date.now();
    
    return entry.data as T;
  }
  
  set<T>(key: string, data: T, ttl: number): void {
    // Evict if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      accessCount: 1,
      lastAccess: Date.now(),
    });
  }
  
  delete(key: string): void {
    this.cache.delete(key);
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }
  
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;
    
    this.cache.forEach((entry, key) => {
      if (entry.lastAccess < oldestAccess) {
        oldestAccess = entry.lastAccess;
        oldestKey = key;
      }
    });
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
  
  getStats(): { size: number; maxSize: number; hitRate: number } {
    let totalAccess = 0;
    this.cache.forEach((entry) => {
      totalAccess += entry.accessCount;
    });
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: totalAccess / Math.max(this.cache.size, 1),
    };
  }
}

const memoryCache = new LRUMemoryCache();

// ============================================
// IndexedDB Cache
// ============================================

interface IDBCacheEntry<T> {
  key: string;
  data: T;
  timestamp: number;
  ttl: number;
  version: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB not available'));
  }
  
  if (dbPromise) return dbPromise;
  
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_DB_NAME, CACHE_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Delete old store if exists
      if (db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.deleteObjectStore(IDB_STORE_NAME);
      }
      
      // Create new store
      const store = db.createObjectStore(IDB_STORE_NAME, { keyPath: 'key' });
      store.createIndex('timestamp', 'timestamp');
    };
  });
  
  return dbPromise;
}

async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(IDB_STORE_NAME, 'readonly');
      const store = transaction.objectStore(IDB_STORE_NAME);
      const request = store.get(key);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entry = request.result as IDBCacheEntry<T> | undefined;
        
        if (!entry) {
          resolve(null);
          return;
        }
        
        // Check version
        if (entry.version !== CACHE_VERSION) {
          idbDelete(key);
          resolve(null);
          return;
        }
        
        // Check TTL
        if (Date.now() - entry.timestamp > entry.ttl) {
          idbDelete(key);
          resolve(null);
          return;
        }
        
        resolve(entry.data);
      };
    });
  } catch {
    return null;
  }
}

async function idbSet<T>(key: string, data: T, ttl: number): Promise<void> {
  try {
    const db = await getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(IDB_STORE_NAME);
      
      const entry: IDBCacheEntry<T> = {
        key,
        data,
        timestamp: Date.now(),
        ttl,
        version: CACHE_VERSION,
      };
      
      const request = store.put(entry);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch {
    // Silently fail for IDB errors
  }
}

async function idbDelete(key: string): Promise<void> {
  try {
    const db = await getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(IDB_STORE_NAME);
      const request = store.delete(key);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch {
    // Silently fail
  }
}

async function idbClear(): Promise<void> {
  try {
    const db = await getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(IDB_STORE_NAME);
      const request = store.clear();
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch {
    // Silently fail
  }
}

// ============================================
// LocalStorage Cache (fallback)
// ============================================

interface StorageCacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  version: number;
}

function storageGet<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    
    const entry: StorageCacheEntry<T> = JSON.parse(raw);
    
    // Check version
    if (entry.version !== CACHE_VERSION) {
      localStorage.removeItem(STORAGE_PREFIX + key);
      return null;
    }
    
    // Check TTL
    if (Date.now() - entry.timestamp > entry.ttl) {
      localStorage.removeItem(STORAGE_PREFIX + key);
      return null;
    }
    
    return entry.data;
  } catch {
    return null;
  }
}

function storageSet<T>(key: string, data: T, ttl: number): void {
  if (typeof window === 'undefined') return;
  
  try {
    const entry: StorageCacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      version: CACHE_VERSION,
    };
    
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // Storage quota exceeded or other error
    // Try to clear old entries
    cleanupStorage();
  }
}

function storageDelete(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_PREFIX + key);
}

function cleanupStorage(): void {
  if (typeof window === 'undefined') return;
  
  const keysToRemove: string[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(STORAGE_PREFIX)) continue;
    
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      
      const entry = JSON.parse(raw);
      if (entry.version !== CACHE_VERSION || Date.now() - entry.timestamp > entry.ttl) {
        keysToRemove.push(key);
      }
    } catch {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

// ============================================
// Unified Cache API
// ============================================

export interface CacheOptions {
  ttl?: CacheTTL;
  skipMemory?: boolean;
  skipPersist?: boolean;
  priority?: 'memory' | 'idb' | 'storage';
}

/**
 * Get data from cache (memory → IDB → storage)
 */
export async function cacheGet<T>(
  key: string,
  options: CacheOptions = {}
): Promise<T | null> {
  // Try memory first
  if (!options.skipMemory) {
    const memResult = memoryCache.get<T>(key);
    if (memResult !== null) {
      return memResult;
    }
  }
  
  // Try IDB
  const idbResult = await idbGet<T>(key);
  if (idbResult !== null) {
    // Populate memory cache
    if (!options.skipMemory) {
      memoryCache.set(key, idbResult, TTL[options.ttl || 'medium']);
    }
    return idbResult;
  }
  
  // Try localStorage
  const storageResult = storageGet<T>(key);
  if (storageResult !== null) {
    // Populate higher cache layers
    if (!options.skipMemory) {
      memoryCache.set(key, storageResult, TTL[options.ttl || 'medium']);
    }
    return storageResult;
  }
  
  return null;
}

/**
 * Set data in cache (writes to all layers)
 */
export async function cacheSet<T>(
  key: string,
  data: T,
  options: CacheOptions = {}
): Promise<void> {
  const ttl = TTL[options.ttl || 'medium'];
  
  // Write to memory
  if (!options.skipMemory) {
    memoryCache.set(key, data, ttl);
  }
  
  // Write to persistent storage
  if (!options.skipPersist) {
    // Use IDB by default, fallback to storage for small data
    const dataSize = JSON.stringify(data).length;
    
    if (dataSize > 100 * 1024) {
      // Large data → IDB only
      await idbSet(key, data, ttl);
    } else {
      // Small data → both
      await idbSet(key, data, ttl);
      storageSet(key, data, ttl);
    }
  }
}

/**
 * Delete from all cache layers
 */
export async function cacheDelete(key: string): Promise<void> {
  memoryCache.delete(key);
  await idbDelete(key);
  storageDelete(key);
}

/**
 * Clear all caches
 */
export async function cacheClear(): Promise<void> {
  memoryCache.clear();
  await idbClear();
  cleanupStorage();
}

/**
 * Get cache stats
 */
export function getCacheStats(): {
  memory: { size: number; maxSize: number; hitRate: number };
} {
  return {
    memory: memoryCache.getStats(),
  };
}

// ============================================
// Specialized Cache Functions
// ============================================

/**
 * Cache movie data with appropriate TTL
 */
export async function cacheMovieData(
  movieId: number,
  type: 'details' | 'credits' | 'videos' | 'providers' | 'similar' | 'recommendations',
  data: unknown
): Promise<void> {
  const ttlMap: Record<string, CacheTTL> = {
    details: 'long',
    credits: 'long',
    videos: 'medium',
    providers: 'medium',
    similar: 'short',
    recommendations: 'short',
  };
  
  await cacheSet(`movie:${movieId}:${type}`, data, {
    ttl: ttlMap[type],
  });
}

/**
 * Get cached movie data
 */
export async function getCachedMovieData<T>(
  movieId: number,
  type: 'details' | 'credits' | 'videos' | 'providers' | 'similar' | 'recommendations'
): Promise<T | null> {
  return cacheGet<T>(`movie:${movieId}:${type}`);
}

/**
 * Cache list/page data
 */
export async function cacheListData(
  listType: string,
  page: number,
  data: unknown
): Promise<void> {
  await cacheSet(`list:${listType}:${page}`, data, {
    ttl: 'short',
  });
}

/**
 * Get cached list data
 */
export async function getCachedListData<T>(
  listType: string,
  page: number
): Promise<T | null> {
  return cacheGet<T>(`list:${listType}:${page}`);
}

// ============================================
// Cache Initialization
// ============================================

/**
 * Initialize cache system
 */
export async function initCache(): Promise<void> {
  // Warm up IDB connection
  try {
    await getDB();
  } catch {
    console.warn('[Cache] IndexedDB not available, using localStorage fallback');
  }
  
  // Schedule periodic cleanup
  if (typeof window !== 'undefined') {
    setInterval(cleanupStorage, 60 * 60 * 1000); // Every hour
  }
}

// Initialize on module load
if (typeof window !== 'undefined') {
  initCache();
}
