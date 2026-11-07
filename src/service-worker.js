/* LOVEOPOLY — service worker: aplikasi bisa dipasang & mode lokal tetap jalan tanpa internet.
   Disusun saat build oleh plugin di vite.config.js: penanda versi & daftar precache diisi dari berkas hasil build,
   jadi tiap deploy = versi baru, cache lama dibersihkan saat aktif. Firebase (online) selalu lewat jaringan. */
const VERSION = '__VERSION__';
const CACHE = 'loveopoly-' + VERSION;
const PRECACHE = JSON.parse('__PRECACHE__');

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('loveopoly-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const put = (req, res) => {
  if (res && res.ok && res.type === 'basic') {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(req, copy));
  }
  return res;
};

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Firebase, gstatic: jaringan biasa
  // halaman: jaringan dulu supaya update langsung sampai; offline → halaman tersimpan
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => put('/', res))
        .catch(() => caches.match('/', { ignoreSearch: true }))
    );
    return;
  }
  // aset bernama hash tidak pernah berubah isinya: cache dulu
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => put(req, res))));
    return;
  }
  // lainnya (ikon, manifest, gambar pratinjau): jaringan dulu, cadangan cache
  event.respondWith(
    fetch(req)
      .then(res => put(req, res))
      .catch(() => caches.match(req))
  );
});
