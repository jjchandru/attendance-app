// Shared status widget: current app version + a live network-reachability
// dot. Included on every page.
//
// No "update available, tap to reload" prompt: the service worker's install
// handler calls skipWaiting() and its activate handler calls clients.claim()
// unconditionally, so a new version installs and takes over the open tab
// automatically — there's no waiting state for a button to resolve. The
// version badge below picks up the change on its own via the CACHE_UPDATED
// broadcast the worker sends once it activates.
//
// This app has no SPA router — each screen is its own full page load — so
// this script re-runs from scratch on every navigation. It seeds its
// display from localStorage so the version/dot never show blank, then a
// fresh probe brings them up to date.
//
// Network status is judged by a real, timed reachability probe rather than
// navigator.onLine: on a congested college network the device is usually
// still "connected" per the browser, just too slow to be usable, which
// onLine can't detect.
(function () {
  const VERSION_KEY = 'attendanceAppVersion';
  const NETWORK_KEY = 'attendanceAppNetworkGood';
  const PROBE_TIMEOUT_MS = 5000;
  const PROBE_INTERVAL_MS = 60000;

  window.AppStatus = {
    version: localStorage.getItem(VERSION_KEY) || '',
    networkGood: localStorage.getItem(NETWORK_KEY) === 'true'
  };

  let versionEl, dotEl;
  let swRegistration = null;
  let probeTimer = null;

  function shortVersion(fullVersion) {
    const match = fullVersion && fullVersion.match(/v\d+$/);
    return match ? match[0] : (fullVersion || '–');
  }

  function mount() {
    const host = document.getElementById('appStatusMount');
    if (!host) return;
    host.innerHTML =
      '<span class="d-inline-flex align-items-center gap-2">' +
        '<span id="appStatusVersion" class="badge bg-secondary"></span>' +
        '<span id="appStatusDot" class="app-status-dot"></span>' +
      '</span>';
    versionEl = document.getElementById('appStatusVersion');
    dotEl = document.getElementById('appStatusDot');
    renderVersion();
    renderNetwork();
  }

  function renderVersion() {
    if (versionEl) versionEl.textContent = shortVersion(window.AppStatus.version);
  }

  function renderNetwork() {
    if (!dotEl) return;
    dotEl.classList.toggle('app-status-dot-good', window.AppStatus.networkGood);
    dotEl.classList.toggle('app-status-dot-bad', !window.AppStatus.networkGood);
    dotEl.title = window.AppStatus.networkGood
      ? 'Network reachable'
      : 'Network slow or unreachable (last checked)';
  }

  function setVersion(fullVersion) {
    window.AppStatus.version = fullVersion;
    localStorage.setItem(VERSION_KEY, fullVersion);
    renderVersion();
  }

  function setNetworkGood(isGood) {
    window.AppStatus.networkGood = isGood;
    localStorage.setItem(NETWORK_KEY, String(isGood));
    renderNetwork();
  }

  // Bounded, cancelable reachability check. registration.update() can't be
  // reliably aborted across browsers, so this fetches service-worker.js
  // itself with a real AbortController timeout, and reads its own
  // CACHE_NAME back out as the "latest available" version.
  //
  // The swProbe param + cache:'no-store' both matter: this request is
  // same-origin and in the service worker's own scope, so without them it
  // would get intercepted by that worker's cache-first fetch handler —
  // the first successful probe would get cached, and every probe after
  // that would silently be served from that cache instead of ever
  // touching the network again. The unique query string also guarantees
  // the browser's own HTTP cache can't short-circuit it either.
  async function probe() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
      const probeUrl = './service-worker.js?swProbe=' + Date.now();
      const response = await fetch(probeUrl, { cache: 'no-store', signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) throw new Error('Bad response: ' + response.status);

      const text = await response.text();
      setNetworkGood(true);

      const match = text.match(/CACHE_NAME\s*=\s*'([^']+)'/);
      const latestVersion = match ? match[1] : null;
      if (latestVersion && latestVersion !== window.AppStatus.version && swRegistration) {
        swRegistration.update().catch(() => {});
      }
    } catch (error) {
      clearTimeout(timer);
      setNetworkGood(false);
    }
  }

  function startProbing() {
    if (probeTimer) return;
    probeTimer = setInterval(probe, PROBE_INTERVAL_MS);
  }

  function stopProbing() {
    if (probeTimer) {
      clearInterval(probeTimer);
      probeTimer = null;
    }
  }

  // Pause probing while the tab isn't actually being looked at (backgrounded
  // app, locked screen) instead of relying on the browser to throttle it —
  // that behavior varies across browsers and doesn't give an immediate
  // refresh the moment the tab is looked at again.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      probe();
      startProbing();
    } else {
      stopProbing();
    }
  });

  // Asks whichever worker is currently controlling this page what version
  // it's running. Needed because the CACHE_UPDATED broadcast below only
  // fires at the moment a worker activates — a repeat visit where the
  // worker is already active and controlling would otherwise never learn
  // the version at all.
  function requestActiveVersion() {
    if (!navigator.serviceWorker.controller) return;
    const channel = new MessageChannel();
    channel.port1.onmessage = event => {
      if (event.data && event.data.version) {
        setVersion(event.data.version);
      }
    };
    navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data && event.data.type === 'CACHE_UPDATED') {
        setVersion(event.data.version);
      }
    });

    // Fires whenever the controlling worker changes, including the
    // first time one takes control of an already-open page.
    navigator.serviceWorker.addEventListener('controllerchange', requestActiveVersion);

    // Registration is deferred to 'load' so it doesn't compete for
    // bandwidth with this page's own critical resources on a slow link.
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js')
        .then(registration => {
          swRegistration = registration;
        })
        .catch(error => {
          console.log('Service Worker registration failed:', error);
        });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    mount();
    probe();
    requestActiveVersion(); // covers the common case: worker already active from a past visit
    if (document.visibilityState === 'visible') {
      startProbing();
    }
  });
})();
