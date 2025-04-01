const CACHE_NAME = 'shopping-list-cache-v2'; // Increment cache name
// Define core app files to cache
const CORE_FILES = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json',
    '/defaultItems.json',
    // Add paths to your icons if they are static files
    // e.g., '/icons/icon-192x192.png' 
];

// Install event: Cache core application files
self.addEventListener('install', event => {
    console.log('[SW] Install event');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Caching core files:', CORE_FILES);
                return cache.addAll(CORE_FILES);
            })
            .then(() => self.skipWaiting()) // Activate worker immediately
    );
});

// Activate event: Clean up old caches
self.addEventListener('activate', event => {
    console.log('[SW] Activate event');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Take control immediately
    );
});

// Fetch event: Network first, then cache for core files. Ignore others.
self.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);

    // --- IMPORTANT: Only handle requests for CORE app files --- 
    // Check if the requested path (ignoring query params) is in our CORE_FILES list
    const requestedPath = requestUrl.origin === self.location.origin ? requestUrl.pathname : null;
    const isCoreFileRequest = requestedPath && CORE_FILES.includes(requestedPath);

    if (!isCoreFileRequest) {
        // If it's not a core file (e.g., favicon.ico not in list, external request, etc.)
        // let the browser handle it normally. DO NOT INTERCEPT.
        // console.log(`[SW] Ignoring fetch for non-core file: ${event.request.url}`);
        return; 
    }

    // --- Network First Strategy for Core Files ---
    console.log(`[SW] Handling fetch for core file: ${event.request.url}`);
    event.respondWith(
        fetch(event.request)
            .then(networkResponse => {
                 console.log(`[SW] Fetched from network: ${event.request.url}`);
                // Check if we received a valid response from the network
                if (networkResponse && networkResponse.ok) {
                    // Clone the response as it can only be consumed once
                    const responseToCache = networkResponse.clone();
                    // Open the cache and save the network response
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            console.log(`[SW] Caching network response for: ${event.request.url}`);
                            cache.put(event.request, responseToCache);
                        });
                } else {
                    // Log potentially bad responses but still return them
                    console.log(`[SW] Network response not OK for ${event.request.url}: Status ${networkResponse.status}`);
                }
                return networkResponse; // Return the network response
            })
            .catch(error => {
                // Network request failed, try to serve from cache
                console.warn(`[SW] Network fetch failed for ${event.request.url}, trying cache. Error:`, error);
                return caches.match(event.request)
                    .then(cachedResponse => {
                        if (cachedResponse) {
                            console.log(`[SW] Serving from cache: ${event.request.url}`);
                            return cachedResponse;
                        } else {
                            // Critical error: Network failed AND not in cache
                             console.error(`[SW] CRITICAL: Network failed and ${event.request.url} not found in cache.`);
                            // Optionally return a fallback offline page or a specific error response
                            // For simplicity, just let the browser error show
                            return new Response(`Network error and ${event.request.url} not in cache.`, { status: 503, statusText: 'Service Unavailable' });
                        }
                    });
            })
    );
}); 