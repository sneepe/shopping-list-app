const CACHE_NAME = 'shopping-list-cache-v3';

// Paths relative to this service worker file (works on GitHub Pages project sites, e.g. /repo-name/)
const BASE = self.location.pathname.replace(/[^/]+$/, '');
const CORE_FILES = [
    BASE,
    BASE + 'index.html',
    BASE + 'style.css',
    BASE + 'script.js',
    BASE + 'manifest.json',
    BASE + 'defaultItems.json',
];

function coreUrlsToCache() {
    return CORE_FILES.map((pathname) => self.location.origin + pathname);
}

function normalizePathname(pathname) {
    if (!pathname || pathname === '/') return pathname;
    return pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname;
}

function isCorePath(requestedPath) {
    if (!requestedPath) return false;
    const n = normalizePathname(requestedPath);
    return CORE_FILES.some((f) => normalizePathname(f) === n);
}

self.addEventListener('install', (event) => {
    console.log('[SW] Install event');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            const urls = coreUrlsToCache();
            console.log('[SW] Caching core files:', urls);
            return cache.addAll(urls);
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activate event');
    event.waitUntil(
        caches.keys().then((cacheNames) =>
            Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);
    const requestedPath =
        requestUrl.origin === self.location.origin ? requestUrl.pathname : null;

    if (!isCorePath(requestedPath)) {
        return;
    }

    console.log(`[SW] Handling fetch for core file: ${event.request.url}`);
    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                console.log(`[SW] Fetched from network: ${event.request.url}`);
                if (networkResponse && networkResponse.ok) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        console.log(`[SW] Caching network response for: ${event.request.url}`);
                        cache.put(event.request, responseToCache);
                    });
                } else if (networkResponse) {
                    console.log(
                        `[SW] Network response not OK for ${event.request.url}: Status ${networkResponse.status}`
                    );
                }
                return networkResponse;
            })
            .catch((error) => {
                console.warn(`[SW] Network fetch failed for ${event.request.url}, trying cache. Error:`, error);
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        console.log(`[SW] Serving from cache: ${event.request.url}`);
                        return cachedResponse;
                    }
                    console.error(`[SW] CRITICAL: Network failed and ${event.request.url} not found in cache.`);
                    return new Response(`Network error and ${event.request.url} not in cache.`, {
                        status: 503,
                        statusText: 'Service Unavailable',
                    });
                });
            })
    );
});
