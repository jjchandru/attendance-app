const CACHE_NAME = 'attendance-app-v11';
// All assets are same-origin now (see vendor/) so a poor/flaky network can't
// break precaching by failing to reach a third-party CDN mid-install.
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
  './js/status.js',
  './vendor/fonts/ancizar-sans.css',
  './vendor/fonts/files/ancizar-sans-greek.woff2',
  './vendor/fonts/files/ancizar-sans-latin-ext.woff2',
  './vendor/fonts/files/ancizar-sans-latin.woff2',
  './vendor/bootstrap/css/bootstrap.min.css',
  './vendor/bootstrap/js/bootstrap.bundle.min.js',
  './vendor/bootstrap-icons/font/bootstrap-icons.min.css',
  './vendor/bootstrap-icons/font/fonts/bootstrap-icons.woff2',
  './vendor/bootstrap-icons/font/fonts/bootstrap-icons.woff'
];

// Install event - cache all files immediately
self.addEventListener('install', event => {
  console.log('Service Worker installing and pre-caching all resources...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache, adding all resources...');
        // Cache all resources immediately, even if not visited yet.
        // Deliberately NOT catching errors here: if any resource fails to
        // download (e.g. flaky network mid-install), this install must fail
        // so the browser keeps the previous, still-working service worker
        // and cache instead of activating a worker backed by an empty/partial
        // cache. The browser will retry installation automatically later.
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('All resources pre-cached successfully!');
        return self.skipWaiting(); // Activate immediately, only on success
      })
      .catch(error => {
        console.error('Install failed, keeping previous service worker active:', error);
        throw error;
      })
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

// Lets a page ask the currently active worker what version it's running,
// for cases where this worker activated in a past session and the
// one-time CACHE_UPDATED broadcast below was never seen by this page load.
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'GET_VERSION' && event.ports && event.ports[0]) {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

// On a poor/congested network an uncached request can hang far longer than
// a user will wait. Give it a bounded window, then fall through to the
// catch handler below (which serves the offline fallback) instead of
// leaving the page stuck loading.
const NETWORK_TIMEOUT_MS = 8000;
function fetchWithTimeout(request) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Network request timed out')), NETWORK_TIMEOUT_MS);
    fetch(request).then(response => {
      clearTimeout(timer);
      resolve(response);
    }, error => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

// Fetch event - cache-first strategy for better offline support
self.addEventListener('fetch', event => {
  // Requests tagged swProbe are the app's own reachability check (see
  // js/status.js). Leave them alone entirely — no event.respondWith — so
  // the browser handles them directly. Otherwise the first successful probe
  // would get cached by the logic below, and every probe after that would
  // be served from that cache instead of ever touching the network again,
  // making the status indicator permanently stuck on its first result.
  if (new URL(event.request.url).searchParams.has('swProbe')) {
    return;
  }

  event.respondWith(
    // ignoreSearch matters here: real navigations carry ?classId=...&date=...
    // (see js/app.js, attendance.js, select-date.js) but the precached pages
    // were stored without a query string. Without ignoreSearch, every
    // navigation to a class/date the user hadn't already visited online was
    // a guaranteed cache miss offline — the page's HTML/CSS/JS is identical
    // regardless of which class or date is in the URL; only client-side JS
    // (reading localStorage) varies by it, so it's safe to match on path alone.
    caches.match(event.request, { ignoreSearch: true })
      .then(cachedResponse => {
        // Return cached version if available
        if (cachedResponse) {
          console.log('Serving from cache:', event.request.url);
          return cachedResponse;
        }

        // Not in cache, fetch from network
        console.log('Fetching from network:', event.request.url);
        return fetchWithTimeout(event.request).then(response => {
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
