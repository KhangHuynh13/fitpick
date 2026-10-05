/* =========================================================================
   sw.js — Service worker của Fitpick
   - Lưu sẵn các file của app để chạy offline.
   - File HTML: lấy từ mạng trước (network-first), mất mạng thì dùng bản đã lưu.
   - File khác (CSS, JS, font, icon): dùng bản đã lưu (cache-first).
   MỖI LẦN CẬP NHẬT APP: tăng CACHE_VERSION để bạn bè nhận bản mới.
   ========================================================================= */
'use strict';

const CACHE_VERSION = 'v1';
const CACHE_NAME = `fitpick-${CACHE_VERSION}`;

// Danh sách file cần lưu sẵn (đường dẫn tương đối với vị trí sw.js)
const APP_FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './db.js',
  './image.js',
  './backup.js',
  './suggest.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './fonts/be-vietnam-pro-400-vietnamese.woff2',
  './fonts/be-vietnam-pro-400-latin-ext.woff2',
  './fonts/be-vietnam-pro-400-latin.woff2',
  './fonts/be-vietnam-pro-500-vietnamese.woff2',
  './fonts/be-vietnam-pro-500-latin-ext.woff2',
  './fonts/be-vietnam-pro-500-latin.woff2',
  './fonts/be-vietnam-pro-600-vietnamese.woff2',
  './fonts/be-vietnam-pro-600-latin-ext.woff2',
  './fonts/be-vietnam-pro-600-latin.woff2',
  './fonts/cormorant-garamond-vietnamese.woff2',
  './fonts/cormorant-garamond-latin-ext.woff2',
  './fonts/cormorant-garamond-latin.woff2'
];

/** Cài đặt: tải và lưu toàn bộ file của bản mới (bỏ qua bộ nhớ đệm HTTP). */
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_FILES.map((url) => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

/** Kích hoạt: xóa cache của các phiên bản cũ, nhận quyền điều khiển các tab đang mở. */
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith('fitpick-') && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

/** HTML: thử mạng trước, lưu lại bản mới; mất mạng thì trả bản đã lưu. */
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request, { cache: 'no-cache' });
    if (response.ok) cache.put('./index.html', response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match('./index.html');
    if (cached) return cached;
    throw err;
  }
}

/** File tĩnh: dùng bản đã lưu; chưa có thì tải từ mạng và lưu lại. */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isHTML = request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html');
  event.respondWith(isHTML ? networkFirst(request) : cacheFirst(request));
});
