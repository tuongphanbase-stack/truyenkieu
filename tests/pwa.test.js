// Installable app checks: manifest + icons, the service worker's precache list,
// and the service worker's caching behaviour (run in a sandbox with fake caches).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function pngSize(file) {
  const buf = fs.readFileSync(path.join(root, file));
  assert.strictEqual(buf.toString('ascii', 1, 4), 'PNG', `${file} must be a PNG`);
  return `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`;
}

// 1. Manifest: relative URLs (the site lives under /truyenkieu/), standalone, valid icons.
const manifest = JSON.parse(read('manifest.webmanifest'));
assert.strictEqual(manifest.start_url, './');
assert.strictEqual(manifest.scope, './');
assert.strictEqual(manifest.display, 'standalone');
assert.ok(manifest.name && manifest.short_name && manifest.description);
assert.match(manifest.theme_color, /^#[0-9a-f]{6}$/i);
assert.match(manifest.background_color, /^#[0-9a-f]{6}$/i);
for (const icon of manifest.icons) {
  assert.ok(!icon.src.startsWith('/') && !/^https?:/.test(icon.src), `icon path must be relative: ${icon.src}`);
  assert.strictEqual(pngSize(icon.src), icon.sizes, `${icon.src} size`);
}
for (const size of ['192x192', '512x512']) {
  assert.ok(manifest.icons.some(i => i.sizes === size && (i.purpose || 'any').includes('any')), `missing ${size} icon`);
}
assert.ok(manifest.icons.some(i => (i.purpose || '').includes('maskable')), 'missing maskable icon');

// 2. Page wiring and the precache list.
const html = read('index.html');
assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
assert.match(html, /<meta name="theme-color" content="#[0-9a-f]{6}">/i);
assert.match(html, /<link rel="apple-touch-icon" href="icons\/apple-touch-icon\.png">/);
assert.strictEqual(pngSize('icons/apple-touch-icon.png'), '180x180');
assert.match(html, /chinhphungam\//, 'cross-link to Chinh Phụ Ngâm');
assert.match(html, /emailer-dashboard\/projects\.html/, 'link to the project list');

const swSource = read('sw.js');
const shell = vm.runInNewContext(`${swSource.match(/const SHELL = (\[[\s\S]*?\]);/)[1]}`);
const pageAssets = [...html.matchAll(/<(?:link|script)\b[^>]*?\b(?:href|src)="([^"]+)"/g)]
  .map(m => m[1]).filter(u => !/^(https?:)?\/\//.test(u));
for (const asset of pageAssets) assert.ok(shell.includes(asset), `sw.js SHELL is missing ${asset}`);
for (const entry of shell) {
  if (entry === './') continue;
  assert.ok(fs.existsSync(path.join(root, entry.split('?')[0])), `SHELL lists a missing file: ${entry}`);
}

// 3. Service worker behaviour.
const ORIGIN = 'https://tuongphanbase.github.io';
const SCOPE = `${ORIGIN}/truyenkieu/`;
const net = { online: true, calls: [], files: new Map() };
for (const entry of shell) net.files.set(new URL(entry, SCOPE).pathname, `body of ${entry}`);
net.files.set('/truyenkieu/data/truyen-kieu.txt', 'local text');

function fakeFetch(request) {
  const url = new URL(typeof request === 'string' ? request : request.url);
  net.calls.push(url.href);
  if (!net.online) return Promise.reject(new TypeError('offline'));
  const body = url.origin === ORIGIN ? net.files.get(url.pathname) : 'remote';
  return Promise.resolve(new Response(body || 'not found', { status: body ? 200 : 404 }));
}

const stores = new Map();
const keyOf = (req, ignoreSearch) => {
  const u = new URL(typeof req === 'string' ? req : req.url);
  if (ignoreSearch) u.search = '';
  return u.href;
};
function openCache(name) {
  if (!stores.has(name)) stores.set(name, new Map());
  const entries = stores.get(name);
  return {
    async match(req, opts = {}) {
      for (const [url, res] of entries) if (keyOf(url, opts.ignoreSearch) === keyOf(req, opts.ignoreSearch)) return res.clone();
      return undefined;
    },
    async put(req, res) { entries.set(keyOf(req), res); },
    async addAll(reqs) {
      for (const req of reqs) {
        const res = await fakeFetch(req);
        if (!res.ok) throw new TypeError(`precache failed: ${req.url}`);
        entries.set(keyOf(req), res);
      }
    }
  };
}
const caches = {
  open: async name => openCache(name),
  keys: async () => [...stores.keys()],
  delete: async name => stores.delete(name)
};

const listeners = {};
const self = {
  location: new URL(`${SCOPE}sw.js`),
  registration: { scope: SCOPE },
  addEventListener: (type, fn) => { listeners[type] = fn; },
  skipWaiting: async () => {},
  clients: { claim: async () => {} }
};
vm.runInNewContext(swSource, { self, caches, fetch: fakeFetch, Request, Response, URL, console });

function dispatch(type, request) {
  const waits = [];
  const event = { request, responded: null, waitUntil: p => waits.push(p), respondWith: p => { event.responded = p; } };
  listeners[type](event);
  return { event, settle: () => Promise.all(waits) };
}
async function respond(request) {
  const { event, settle } = dispatch('fetch', request);
  if (!event.responded) return null;
  const res = await event.responded;
  await settle();
  return res;
}
const get = url => new Request(url);
const navigate = url => ({ url, method: 'GET', mode: 'navigate', cache: 'default' });

(async () => {
  // Leftovers from older versions of this site and caches of other projects on the origin.
  await caches.open('truyenkieu-shell-old');
  await caches.open('chinhphungam-shell-x');
  await caches.open('emailer-dashboard-v3');

  await dispatch('install').settle();
  const shellName = [...stores.keys()].find(k => /^truyenkieu-shell-(?!old)/.test(k));
  assert.ok(shellName, 'install creates a versioned shell cache');
  assert.strictEqual(stores.get(shellName).size, shell.length, 'install precaches the whole shell');

  await dispatch('activate').settle();
  assert.ok(!stores.has('truyenkieu-shell-old'), 'activate removes this site\'s old caches');
  assert.ok(stores.has('chinhphungam-shell-x') && stores.has('emailer-dashboard-v3'), 'activate keeps other projects\' caches');

  // Shell: cache first, no network.
  net.calls.length = 0;
  const css = await respond(get(`${SCOPE}css/reader.css?v=20261009-1`));
  assert.strictEqual(await css.text(), 'body of css/reader.css?v=20261009-1');
  const page = await respond(navigate(`${SCOPE}?utm_source=x`));
  assert.strictEqual(await page.text(), 'body of ./');
  assert.deepStrictEqual(net.calls, [], 'shell files come from the cache');

  // Cross-origin (Wikisource API), other paths on the origin and non-GET requests are left alone.
  assert.strictEqual(await respond(get('https://vi.wikisource.org/w/api.php?action=query')), null);
  assert.strictEqual(await respond(get(`${ORIGIN}/chinhphungam/css/style.css`)), null);
  assert.strictEqual(await respond(new Request(`${SCOPE}x`, { method: 'POST', body: 'x' })), null);

  // Other same-origin GETs: network first, cached copy when offline, errors never cached.
  const text = await respond(get(`${SCOPE}data/truyen-kieu.txt`));
  assert.strictEqual(await text.text(), 'local text');
  const missing = await respond(get(`${SCOPE}data/nothing.txt`));
  assert.strictEqual(missing.status, 404);
  net.online = false;
  const offlineText = await respond(get(`${SCOPE}data/truyen-kieu.txt`));
  assert.strictEqual(await offlineText.text(), 'local text');
  const offlineMissing = await respond(get(`${SCOPE}data/nothing.txt`));
  assert.strictEqual(offlineMissing.type, 'error');
  const oldAsset = await respond(get(`${SCOPE}css/reader.css?v=old`));
  assert.strictEqual(await oldAsset.text(), 'body of css/reader.css?v=20261009-1');

  console.log('pwa validation passed: manifest, icons,', shell.length, 'shell files, service worker caching');
})().catch(e => { console.error(e); process.exit(1); });
