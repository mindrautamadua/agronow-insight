/* Agronow L&D — service worker (installable PWA + offline fallback).
 *
 * Prinsip aman untuk app ber-auth + data MySQL:
 *  - /api/* TIDAK PERNAH di-cache (selalu jaringan) — auth & data harus segar.
 *  - Navigasi (HTML): network-first → fallback ke /offline.html saat offline.
 *  - Aset statis hashed (_next/static, ikon, gambar): cache-first (immutable).
 *  - Lainnya: lewat ke jaringan apa adanya.
 */
const VERSION = "agronow-v3";
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const OFFLINE_URL = "/offline.html";

// Di dev (localhost) URL chunk `_next` stabil tapi isinya berubah tiap edit,
// sehingga cache-first menyajikan bundle basi. Lewati caching aset sepenuhnya.
const IS_DEV = self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1";

const PRECACHE = [
  OFFLINE_URL,
  "/agronow-icon.png",
  "/icon-192x192.png",
  "/icon-512x512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Jangan sentuh API / auth — selalu jaringan langsung.
  if (sameOrigin && url.pathname.startsWith("/api/")) return;

  // Navigasi halaman → network-first, fallback offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL)),
      ),
    );
    return;
  }

  // Dev: jangan cache aset apa pun — selalu ambil versi terbaru dari dev server.
  if (IS_DEV) return;

  // Aset statis same-origin yang immutable → cache-first.
  if (sameOrigin && (url.pathname.startsWith("/_next/static/") || /\.(png|svg|jpg|jpeg|webp|ico|woff2?)$/i.test(url.pathname))) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        });
      }),
    );
  }
  // Selain itu: biarkan jaringan default menangani.
});
