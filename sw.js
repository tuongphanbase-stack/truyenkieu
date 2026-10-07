// Service worker: makes the Truyện Kiều reader installable and readable offline.
//
// - The app shell (SHELL below) is precached and served cache-first.
//   Bump VERSION whenever any shell file changes, or visitors keep the old copy.
//   tests/pwa.test.js checks that every local file index.html loads is listed.
// - Other same-origin GETs: network first, falling back to the cache offline.
// - Cross-origin requests (the Wikisource API) are not touched: the reader
//   already keeps the poem text in localStorage after the first load.
//
// Every project on tuongphanbase-stack.github.io shares one CacheStorage, so
// this worker only ever creates or deletes caches whose names start with PREFIX.
'use strict';

const VERSION = '2026-10-07.1';
const PREFIX = 'truyenkieu-';
const SHELL_CACHE = `${PREFIX}shell-${VERSION}`;
const RUNTIME_CACHE = `${PREFIX}runtime-${VERSION}`;

// Paths are relative to this file, which sits at the root of the site.
const SHELL = [
  './',
  'manifest.webmanifest',
  'css/site.css?v=20261007-2',
  'css/reader.css?v=20261007-2',
  'css/narrative-layers.css?v=20260827-34',
  'css/cultural-layers.css?v=20260827-35',
  'js/site.js?v=20261007-2',
  'js/narrative-layers.js?v=20260827-34',
  'js/reader-insights.js?v=20260827-33',
  'js/text-source.js?v=20261007-1',
  'js/reader.js?v=20261007-2',
  'js/cultural-layers.js?v=20260827-35',
  'icons/favicon-32.png',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png'
];

const scopeUrl = () => self.registration.scope; // e.g. https://…/truyenkieu/
const absolute = path => new URL(path, self.location.href).href;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      // `reload` skips the HTTP cache so a new VERSION never precaches stale files.
      .then(cache => cache.addAll(SHELL.map(path => new Request(absolute(path), { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key.startsWith(PREFIX) && key !== SHELL_CACHE && key !== RUNTIME_CACHE)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Wikisource and other sites: browser default
  if (!request.url.startsWith(scopeUrl())) return;  // other projects on the same origin
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return;

  const scopePath = new URL(scopeUrl()).pathname;
  const isAppPage = request.mode === 'navigate' &&
    (url.pathname === scopePath || url.pathname === `${scopePath}index.html`);
  if (isAppPage) {
    // Any query string (?utm=…) still opens the cached page.
    event.respondWith(fromShell(scopeUrl()).then(hit => hit || networkFirst(event)));
  } else {
    event.respondWith(fromShell(request).then(hit => hit || networkFirst(event)));
  }
});

function fromShell(request) {
  return caches.open(SHELL_CACHE).then(cache => cache.match(request, { ignoreVary: true }));
}

async function networkFirst(event) {
  const request = event.request;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(caches.open(RUNTIME_CACHE).then(cache => cache.put(request, copy)));
    }
    return response;
  } catch (error) {
    const runtime = await caches.open(RUNTIME_CACHE);
    const shell = await caches.open(SHELL_CACHE);
    const hit = await runtime.match(request, { ignoreVary: true }) ||
      // An older page asking for an older ?v= of a shell file gets the current one.
      await shell.match(request, { ignoreSearch: true, ignoreVary: true }) ||
      (request.mode === 'navigate' ? await shell.match(scopeUrl()) : undefined);
    return hit || Response.error();
  }
}
