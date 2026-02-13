/**
 * Request Deduplication Layer
 * 
 * Prevents duplicate in-flight requests by caching promises.
 * If the same API call is made while a previous one is still pending,
 * both callers will share the same promise instead of making duplicate network requests.
 * 
 * Features:
 * - In-memory promise cache with automatic cleanup
 * - Prevents thundering herd problem
 * - Works on both client and server
 * - Zero dependencies
 */

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

const pendingRequests = new Map<string, PendingRequest<any>>();
const CLEANUP_INTERVAL = 60000; // Clean up completed requests every minute
const MAX_PENDING_TIME = 30000; // Remove requests pending for more than 30s

/**
 * Periodic cleanup of completed/stale requests
 */
if (typeof window !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    pendingRequests.forEach((req, key) => {
      // Remove requests that have been pending too long (likely failed)
      if (now - req.timestamp > MAX_PENDING_TIME) {
        pendingRequests.delete(key);
      }
    });
  }, CLEANUP_INTERVAL);
}

/**
 * Generate cache key from function name and arguments
 */
function getCacheKey(fnName: string, args: any[]): string {
  try {
    return `${fnName}:${JSON.stringify(args)}`;
  } catch {
    // Fallback for non-serializable args
    return `${fnName}:${args.map(a => String(a)).join(':')}`;
  }
}

/**
 * Deduplicate API requests
 * 
 * @param fnName - Function name for cache key
 * @param fn - Async function to call
 * @param args - Arguments to pass to function
 */
export async function dedupedRequest<T>(
  fnName: string,
  fn: (...args: any[]) => Promise<T>,
  ...args: any[]
): Promise<T> {
  const key = getCacheKey(fnName, args);
  
  // Return existing in-flight request if found
  const existing = pendingRequests.get(key);
  if (existing) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`%c⚡ [DEDUP] ${fnName} - Using cached promise`, 'color: #3b82f6; font-weight: bold;');
    }
    return existing.promise;
  }
  
  // Create new request
  const promise = fn(...args);
  pendingRequests.set(key, { promise, timestamp: Date.now() });
  
  // Clean up after completion (success or failure)
  promise
    .then(() => {
      // Small delay before cleanup to allow concurrent requests to benefit
      setTimeout(() => pendingRequests.delete(key), 100);
    })
    .catch(() => {
      // Clean up immediately on error to allow retry
      pendingRequests.delete(key);
    });
  
  return promise;
}

/**
 * Get stats about current pending requests (for debugging)
 */
export function getDeduplicationStats() {
  const keys: string[] = [];
  pendingRequests.forEach((_, key) => keys.push(key));
  
  return {
    pending: pendingRequests.size,
    keys,
  };
}

/**
 * Clear all pending requests (useful for testing or hard refresh)
 */
export function clearPendingRequests() {
  pendingRequests.clear();
}
