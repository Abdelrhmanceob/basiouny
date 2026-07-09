const CACHE_VERSION = 'dlel-pwa-v4-compressed-webapp';
const COMPRESSED_PAGE_COUNT = 241;
const COMPRESSED_PAGE_URLS = Array.from({ length: COMPRESSED_PAGE_COUNT }, (_, index) =>
  `/assets/images/quran-pages-jpg/quran-page-${String(index + 1).padStart(3, '0')}.jpg`
);
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/viewer.html',
  '/install.html',
  '/library.html',
  '/dashboard.html',
  '/manifest.webmanifest',
  '/assets/css/platform.css',
  '/assets/js/platform.js',
  '/assets/js/pwa.js',
  '/assets/js/pdf-bootstrap.mjs',
  '/assets/js/viewer.js',
  '/assets/vendor/pdfjs/pdf.min.mjs',
  '/assets/vendor/pdfjs/pdf.worker.min.mjs',
  '/assets/dlel.png',
  '/assets/content.json',
  '/dist/data/toc.json',
  '/assets/search_index.json',
  ...COMPRESSED_PAGE_URLS
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request)
          .then((cached) => cached || caches.match(url.pathname))
          .then((cached) => cached || caches.match('/viewer.html'))
          .then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type === 'opaque') {
            return response;
          }
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => cached);
    })
  );
});
