const CACHE_NAME = "breath-timer-v7";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./timeline.mjs",
  "./audio/ocean-breath-10min.wav",
  "./manifest.webmanifest",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const range = event.request.headers.get("range");
  if (range) {
    event.respondWith((async () => {
      const fullResponse = await caches.match(event.request.url) || await fetch(event.request.url);
      const match = /bytes=(\d+)-(\d*)/.exec(range);
      if (!match) return fullResponse;

      const buffer = await fullResponse.arrayBuffer();
      const start = Number(match[1]);
      if (start >= buffer.byteLength) {
        return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${buffer.byteLength}` } });
      }
      const requestedEnd = match[2] ? Number(match[2]) : buffer.byteLength - 1;
      const end = Math.min(requestedEnd, buffer.byteLength - 1);
      return new Response(buffer.slice(start, end + 1), {
        status: 206,
        headers: {
          "Content-Type": fullResponse.headers.get("Content-Type") || "audio/wav",
          "Content-Length": String(end - start + 1),
          "Content-Range": `bytes ${start}-${end}/${buffer.byteLength}`,
          "Accept-Ranges": "bytes",
        },
      });
    })());
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      return response;
    }))
  );
});
