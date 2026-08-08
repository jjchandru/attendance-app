const CACHE_NAME = 'attendance-app-v4';
const urlsToCache = [
  './',
  './index.html',
  './manage.html',
  './attendance.html',
  './select-date.html',
  './take-attendance.html',
  './css/style.css',
  './js/app.js',
  './js/storage.js',
  './js/manage.js',
  './js/attendance.js',
  './js/select-date.js',
  './js/take-attendance.js',
  'https://fonts.googleapis.com/css2?family=Ancizar+Sans:wght@400;700&display=swap',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css'
];

// Install event - cache all files immediately
self.addEventListener('install', event => {
  console.log('Service Worker installing and pre-caching all resources...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache, adding all resources...');
        // Cache all resources immediately, even if not visited yet
        return cache.addAll(urlsToCache).then(() => {
          console.log('All resources pre-cached successfully!');
        });
      })
      .catch(error => {
        console.error('Failed to cache resources:', error);
      })
      .then(() => self.skipWaiting()) // Activate immediately
  );
});

// Activate event - clean up old caches and take control immediately
self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('Service Worker activated and taking control');
      return self.clients.claim(); // Take control of all pages immediately
    })
    .then(() => {
      // Notify all clients that cache has been updated
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'CACHE_UPDATED',
            version: CACHE_NAME
          });
        });
      });
    })
  );
});

// Fetch event - cache-first strategy for better offline support
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Return cached version if available
        if (cachedResponse) {
          console.log('Serving from cache:', event.request.url);
          return cachedResponse;
        }

        // Not in cache, fetch from network
        console.log('Fetching from network:', event.request.url);
        return fetch(event.request).then(response => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone and cache the response
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });

          return response;
        });
      })
      .catch(error => {
        console.error('Fetch failed, serving offline page:', error);
        // If both cache and network fail, return the index page as fallback
        return caches.match('./index.html');
      })
  );
});
