/**
 * BingeBuddy Service Worker
 * 
 * Caching strategies:
 * - Static assets: Cache First
 * - API calls: Stale While Revalidate
 * - Images: Cache First with fallback
 * - Pages: Network First with offline fallback
 */

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `bingebuddy-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `bingebuddy-dynamic-${CACHE_VERSION}`;
const IMAGE_CACHE = `bingebuddy-images-${CACHE_VERSION}`;
const API_CACHE = `bingebuddy-api-${CACHE_VERSION}`;

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
];

// API patterns to cache
const API_PATTERNS = [
  /api\.themoviedb\.org/,
];

// Image patterns to cache
const IMAGE_PATTERNS = [
  /image\.tmdb\.org/,
];

// ============================================
// Install Event
// ============================================

self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Some assets failed to cache:', err);
      });
    })
  );
  
  // Activate immediately
  self.skipWaiting();
});

// ============================================
// Activate Event
// ============================================

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return (
              name.startsWith('bingebuddy-') &&
              name !== STATIC_CACHE &&
              name !== DYNAMIC_CACHE &&
              name !== IMAGE_CACHE &&
              name !== API_CACHE
            );
          })
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  
  // Take control immediately
  self.clients.claim();
});

// ============================================
// Fetch Event
// ============================================

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;
  
  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) return;
  
  // API requests: Stale While Revalidate
  if (API_PATTERNS.some((pattern) => pattern.test(url.href))) {
    event.respondWith(staleWhileRevalidate(request, API_CACHE));
    return;
  }
  
  // Image requests: Cache First
  if (IMAGE_PATTERNS.some((pattern) => pattern.test(url.href))) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }
  
  // Static assets: Cache First
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }
  
  // Pages: Network First with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithFallback(request));
    return;
  }
  
  // Default: Network First
  event.respondWith(networkFirst(request, DYNAMIC_CACHE));
});

// ============================================
// Caching Strategies
// ============================================

/**
 * Cache First: Check cache, fallback to network
 */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.warn('[SW] Cache First failed:', error);
    return new Response('Offline', { status: 503 });
  }
}

/**
 * Network First: Try network, fallback to cache
 */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    
    if (cached) {
      return cached;
    }
    
    throw error;
  }
}

/**
 * Stale While Revalidate: Return cache immediately, update in background
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  // Update in background
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);
  
  // Return cached immediately, or wait for network
  if (cached) {
    return cached;
  }
  
  const networkResponse = await fetchPromise;
  if (networkResponse) {
    return networkResponse;
  }
  
  return new Response(JSON.stringify({ error: 'Offline' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Network First with offline fallback for navigation
 */
async function networkFirstWithFallback(request) {
  try {
    const response = await fetch(request);
    
    // Cache successful page responses
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Try to return cached version
    const cache = await caches.open(DYNAMIC_CACHE);
    const cached = await cache.match(request);
    
    if (cached) {
      return cached;
    }
    
    // Return offline page
    const offlinePage = await caches.match('/offline');
    if (offlinePage) {
      return offlinePage;
    }
    
    // Last resort: simple offline message
    return new Response(
      `<!DOCTYPE html>
      <html>
        <head>
          <title>Offline - BingeBuddy</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: system-ui, sans-serif;
              background: #0f0f1a;
              color: #fff;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              text-align: center;
            }
            h1 { font-size: 2rem; margin-bottom: 1rem; }
            p { color: #888; margin-bottom: 2rem; }
            button {
              background: #7c3aed;
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 8px;
              cursor: pointer;
              font-size: 1rem;
            }
          </style>
        </head>
        <body>
          <div>
            <h1>📴 You're Offline</h1>
            <p>Please check your internet connection and try again.</p>
            <button onclick="window.location.reload()">Retry</button>
          </div>
        </body>
      </html>`,
      {
        headers: { 'Content-Type': 'text/html' },
      }
    );
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Check if URL is a static asset
 */
function isStaticAsset(url) {
  const staticExtensions = ['.js', '.css', '.woff', '.woff2', '.ttf', '.svg', '.ico'];
  return staticExtensions.some((ext) => url.pathname.endsWith(ext));
}

// ============================================
// Message Handling
// ============================================

self.addEventListener('message', async (event) => {
  const { type, urls } = event.data;
  
  switch (type) {
    case 'PRECACHE':
      if (urls && urls.length > 0) {
        const cache = await caches.open(DYNAMIC_CACHE);
        await cache.addAll(urls);
        event.ports[0]?.postMessage({ success: true });
      }
      break;
      
    case 'CLEAR_CACHES':
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
      event.ports[0]?.postMessage({ success: true });
      break;
      
    case 'GET_STATS':
      const names = await caches.keys();
      let totalSize = 0;
      
      for (const name of names) {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        totalSize += keys.length;
      }
      
      event.ports[0]?.postMessage({
        cacheNames: names,
        totalSize,
      });
      break;
  }
});

// ============================================
// Background Sync
// ============================================

self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-watchlist') {
    event.waitUntil(syncWatchlist());
  }
});

async function syncWatchlist() {
  // Get pending watchlist changes from IndexedDB
  // and sync with server when back online
  console.log('[SW] Syncing watchlist...');
}

console.log('[SW] Service Worker loaded');
