/* Service worker — lets the site open without internet.
   Pages, styles, scripts and data: network first (always fresh when online), cached copy when offline.
   Fonts and libraries from CDNs: cache first. Songs are NOT handled here — the player keeps the songs
   you save for offline in its own cache ("kb-music-audio") and on-device songs in IndexedDB. */
const SHELL = 'kb-shell-v2';
const KEEP = [SHELL, 'kb-music-audio', 'pkb1954-v1'];
const CORE = ['./', 'index.html', 'today.html', 'read.html', 'qa.html', 'prayer.html', 'music.html', 'videos.html', 'maps.html', 'words.html',
  'style.css', 'read.css', 'today.css', 'qa.css', 'prayer.css', 'maps.css', 'words.css', 'music.css',
  'common.js', 'music.js', 'app.js', 'read.js', 'today.js', 'qa.js', 'prayer.js', 'maps.js', 'places.js', 'words.js',
  'data/meta.json', 'data/chapter_links.json', 'data/devotionals.json', 'data/prayers.json', 'data/evening.json', 'data/qa.json', 'data/videos.json',
  'music/playlist.json', 'privacy.html', 'manifest.json', 'assets/icon.svg', 'assets/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => Promise.all(CORE.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => !KEEP.includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const AUDIO = /\.(mp3|m4a|aac|ogg|opus|wav|flac)$/i;
const CDN = /^(fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com)$/;

self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || r.headers.has('range') || AUDIO.test(u.pathname)) return;
  if (u.origin === location.origin) {
    if (u.pathname.endsWith('/sw.js')) return;
    e.respondWith(networkFirst(r));
  } else if (CDN.test(u.hostname) && !/Holy-Bible-XML-Format/.test(u.pathname)) {
    e.respondWith(cacheFirst(r));
  }
});

async function networkFirst(r) {
  const c = await caches.open(SHELL);
  try {
    const res = await fetch(r);
    if (res.ok && res.type === 'basic') c.put(r, res.clone());
    return res;
  } catch (err) {
    const hit = await caches.match(r) || await c.match(r, { ignoreSearch: true });
    if (hit) return hit;
    if (r.mode === 'navigate') return (await c.match('index.html')) || Response.error();
    throw err;
  }
}
async function cacheFirst(r) {
  const c = await caches.open(SHELL), hit = await c.match(r);
  if (hit) return hit;
  const res = await fetch(r);
  if (res.ok || res.type === 'opaque') c.put(r, res.clone());
  return res;
}
