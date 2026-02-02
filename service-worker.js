const CACHE_NAME = "portfolio-cache";

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./portfolio.html",
  "./curriculum.html",
  "./contacto.html",
  "./manifest.json",
  "./Assets/Icons/favicon-192.png",
  "./Assets/Icons/favicon-512.png",
  "./Assets/Icons/favicon.ico",
  "./Assets/Images/background.png",
  "./Assets/Images/me_coding_art.png",
  "./Assets/Fonts/Lato-Bold.ttf",
  "./Assets/Fonts/Lato-BoldItalic.ttf",
  "./Assets/Fonts/Lato-Italic.ttf",
  "./Assets/Fonts/Lato-Regular.ttf",
  "./Assets/Fonts/Agustina.otf",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
});

self.addEventListener("fetch", (event) => {
  event.respondWith(caches.match(event.request).then((resp) => resp || fetch(event.request)));
});
