'use strict';
const CACHE = 'reptrail-pwa-v3';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './workout-data.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];
const EXERCISE_IMAGES = [
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/bench-press/frame-1.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/bench-press/frame-2.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/bench-press/frame-3.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/cable-crunch/frame-1.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/cable-crunch/frame-2.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/cable-crunch/frame-3.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/dumbbell-bench-press/frame-1.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/dumbbell-bench-press/frame-2.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/dumbbell-bench-press/frame-3.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/goblet-squat/frame-1.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/goblet-squat/frame-2.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/goblet-squat/frame-3.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/hanging-knee-raise/frame-1.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/hanging-knee-raise/frame-2.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/hanging-knee-raise/frame-3.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/incline-dumbbell-press/frame-1.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/incline-dumbbell-press/frame-2.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/incline-dumbbell-press/frame-3.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/lat-pulldown/frame-1.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/lat-pulldown/frame-2.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/lat-pulldown/frame-3.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/lateral-raise/frame-1.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/lateral-raise/frame-2.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/lateral-raise/frame-3.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/leg-curl/frame-1.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/leg-curl/frame-2.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/leg-curl/frame-3.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/leg-press/frame-1.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/leg-press/frame-2.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/leg-press/frame-3.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/machine-chest-press/frame-1.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/machine-chest-press/frame-2.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/machine-chest-press/frame-3.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/plank/frame-1.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/plank/frame-2.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/plank/frame-3.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/romanian-deadlift/frame-1.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/romanian-deadlift/frame-2.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/romanian-deadlift/frame-3.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/seated-row/frame-1.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/seated-row/frame-2.svg",
  "https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/seated-row/frame-3.svg"
].map(url => url.replace('https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/', './assets/'));

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);
    await Promise.allSettled(EXERCISE_IMAGES.map(async url => {
      try {
        const response = await fetch(url, {mode:'cors'});
        if (response.ok) await cache.put(url, response.clone());
      } catch (_) {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request);
        if (response.ok) {
          const cache = await caches.open(CACHE);
          cache.put(event.request, response.clone());
        }
        return response;
      } catch (_) {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === 'navigate') return caches.match('./index.html');
        return new Response('', {status:503, statusText:'Offline'});
      }
    })());
    return;
  }

});
