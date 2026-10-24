/*
 * Service worker for the ComOt web build.
 *
 * Chrome only offers "Install app" for a page that keeps working offline, so
 * this exists as much to make the app installable as to make it fast.
 *
 * Every URL below is resolved relative to this file, which is what lets the
 * same worker run at the site root in development and under /ComotV2/app/ on
 * GitHub Pages. scripts/export-web.mjs replaces the two tokens with the real
 * build id and the hashed asset list before the file is deployed.
 */

const BUILD_ID = '__BUILD_ID__';
const PRECACHE_URLS = __PRECACHE_URLS__;

const CACHE_NAME = `comot-${BUILD_ID}`;
const SHELL_URL = new URL('./index.html', self.location).href;

/* Hashed bundles and images never change under the same name, so once one is
 * cached it can be served without ever revalidating. */
const IMMUTABLE_PATHS = ['/_expo/static/', '/assets/'];

const isImmutable = (url) => IMMUTABLE_PATHS.some((path) => url.pathname.includes(path));

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // One failed URL would reject addAll and leave the worker uninstalled,
      // which costs installability; a best-effort pass per URL does not.
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            await cache.add(new Request(new URL(url, self.location).href, { cache: 'reload' }));
          } catch {
            /* keep going: the fetch handler will fill this in later */
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name.startsWith('comot-') && name !== CACHE_NAME).map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Supabase, Google Fonts and anything else off-origin stays untouched: an
  // API response must never be served from a cache, and an opaque cross-origin
  // response is not worth storing.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (isImmutable(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

/* The app is a single-page build, so every route resolves to the same shell.
 * Network first keeps a returning user on the newest deploy; the cached shell
 * is what makes an offline launch — and the install prompt — work at all. */
async function handleNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(SHELL_URL, response.clone());
    }
    return response;
  } catch {
    return (await cache.match(SHELL_URL)) ?? (await cache.match(request)) ?? Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);

  return cached ?? (await network) ?? Response.error();
}
