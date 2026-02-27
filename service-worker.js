self.addEventListener('install', () => {
  console.log('Service Worker instalado');
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
