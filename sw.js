/* ============================================================
   SERVICE WORKER — Meyer's Inmobiliaria (PWA)
   Permite INSTALAR la web como app y que cargue rápido/offline.
   Estrategia: "primero la red" (siempre trae lo último cuando hay
   internet) y si no hay conexión, usa lo guardado en caché.
   ============================================================ */
const CACHE = 'meyers-v1';

const CORE = [
    './',
    './index.html',
    './login.html',
    './registro.html',
    './cuenta.html',
    './styles.css',
    './app.css',
    './config.js',
    './supabase-client.js',
    './auth.js',
    './script.js',
    './img/logo-meyer.png',
    './img/favicon.png',
    './img/icon-192.png',
    './img/icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE)
            .then((cache) => cache.addAll(CORE).catch(() => {}))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;

    // Solo manejamos GET del mismo origen (no toca Supabase ni CDNs)
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        fetch(req)
            .then((res) => {
                const copia = res.clone();
                caches.open(CACHE).then((cache) => cache.put(req, copia)).catch(() => {});
                return res;
            })
            .catch(() => caches.match(req))
    );
});
