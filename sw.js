/* ─────────────────────────────────────────
   Study Hub — Service Worker
   Cache-first for page shell.
   Google Calendar and cross-origin requests
   always go to the network.
─────────────────────────────────────────── */
const CACHE = 'study-hub-v2';
const SHELL = [
  './index.html',
  './manifest.json',
  './logo.png'
];

/* ── Install: cache shell assets ── */
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) {
      // Cache what we can; ignore individual failures (e.g. logo not yet uploaded)
      return Promise.allSettled(SHELL.map(function(url) {
        return c.add(url).catch(function() {});
      }));
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

/* ── Activate: remove old caches ── */
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys
          .filter(function(k) { return k !== CACHE; })
          .map(function(k)    { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

/* ── Fetch: cache-first for shell, network-only for calendar ── */
self.addEventListener('fetch', function(e) {
  var req = e.request;

  // Only intercept GET requests
  if (req.method !== 'GET') return;

  var url = req.url;

  // Pass through: Google Calendar, Google APIs, Cloudinary, Supabase, CDNs
  // — these must always come from the network
  if (
    url.indexOf('calendar.google.com') !== -1 ||
    url.indexOf('googleapis.com')      !== -1 ||
    url.indexOf('cloudinary.com')      !== -1 ||
    url.indexOf('supabase.co')         !== -1 ||
    url.indexOf('cdn.jsdelivr.net')    !== -1 ||
    url.indexOf('fonts.googleapis.com')!== -1 ||
    url.indexOf('fonts.gstatic.com')   !== -1 ||
    url.indexOf('cdnjs.cloudflare.com')!== -1
  ) {
    return; // Let the browser handle it directly
  }

  // Cache-first for everything else within our scope
  e.respondWith(
    caches.match(req).then(function(cached) {
      if (cached) return cached;

      // Not in cache — fetch from network and cache the result
      return fetch(req).then(function(res) {
        if (res.ok) {
          var clone = res.clone();
          caches.open(CACHE).then(function(c) {
            c.put(req, clone);
          });
        }
        return res;
      }).catch(function() {
        // Network failed — serve index.html shell as fallback
        return caches.match('./index.html');
      });
    })
  );
});
