// Goal Rush offline support. Keep this file next to index.html.
const V = 'goalrush-v2';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];
const EXTRA = /^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|www\.gstatic\.com\/firebasejs|cdn\.jsdelivr\.net\/npm\/peerjs)/;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Game files: try the network first (so updates arrive), fall back to the saved copy offline.
function netFirst(req) {
  const t = new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 4000));
  return Promise.race([fetch(req), t])
    .then(res => {
      if (res && res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(req, cp)); }
      return res;
    })
    .catch(() =>
      caches.match(req, { ignoreSearch: true })
        .then(r => r || caches.match('./index.html'))
        .then(r => r || caches.match('./'))
    );
}

// Fonts, Firebase and PeerJS scripts: use the saved copy, refresh it in the background.
function swr(req) {
  return caches.open(V).then(c =>
    c.match(req).then(hit => {
      const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })
  );
}

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin === location.origin) { e.respondWith(netFirst(r)); return; }
  if (EXTRA.test(r.url)) e.respondWith(swr(r));
});
