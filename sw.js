const CACHE_NAME = 'handleliste-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/defaultItems.json'
  // Add icon paths here if/when you create them, e.g.:
  // '/icons/icon-192x192.png',
  // '/icons/icon-512x512.png'
];

// Install event: Cache core application files
self.addEventListener('install', event => {
  console.log('[Service Worker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('[Service Worker] Failed to cache app shell:', error);
      })
  );
});

// Activate event: Clean up old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activate');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim(); // Take control immediately
});

// Fetch event: Serve cached content when offline
self.addEventListener('fetch', event => {
    // console.log('[Service Worker] Fetching:', event.request.url);
    // Cache-First strategy for cached assets
    if (urlsToCache.some(url => event.request.url.endsWith(url))) {
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    if (response) {
                        // console.log('[Service Worker] Serving from cache:', event.request.url);
                        return response; // Serve from cache
                    }
                    // console.log('[Service Worker] Fetching from network:', event.request.url);
                    return fetch(event.request); // Fetch from network if not in cache
                })
        );
    } else {
         // For other requests (e.g., potential future API calls), just fetch from network
         // console.log('[Service Worker] Network request:', event.request.url);
         event.respondWith(fetch(event.request));
    }
}); 