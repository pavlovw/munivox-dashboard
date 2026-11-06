// MuniVox | Service worker de la app Terreno
// Permite abrir /terreno y mantener la sesión cuando no hay señal.
// Los datos de la API (tareas) los guarda la propia app; aquí solo van archivos y la sesión.

const VERSION = "munivox-v1";
const ESTATICOS = `${VERSION}-estaticos`;
const PAGINAS = `${VERSION}-paginas`;
const SESION = `${VERSION}-sesion`;
const MAPAS = `${VERSION}-mapas`;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (evento) => {
  evento.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(nombres.filter(n => !n.startsWith(VERSION)).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

// Primero la red; si falla, la copia guardada
async function redPrimero(request, cache) {
  try {
    const respuesta = await fetch(request);
    if (respuesta.ok && !respuesta.redirected) (await caches.open(cache)).put(request, respuesta.clone());
    return respuesta;
  } catch (e) {
    const guardada = await caches.match(request, { cacheName: cache });
    if (guardada) return guardada;
    throw e;
  }
}

// Primero la copia guardada (archivos que nunca cambian de contenido)
async function cachePrimero(request, cache) {
  const guardada = await caches.match(request, { cacheName: cache });
  if (guardada) return guardada;
  const respuesta = await fetch(request);
  if (respuesta.ok) (await caches.open(cache)).put(request, respuesta.clone());
  return respuesta;
}

self.addEventListener("fetch", (evento) => {
  const { request } = evento;
  const url = new URL(request.url);

  // Al cerrar sesión se borra la sesión guardada
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/auth/signout")) {
    evento.respondWith((async () => { await caches.delete(SESION); return fetch(request); })());
    return;
  }

  if (request.method !== "GET") return;

  // Imágenes estáticas de mapa (Mapbox): se guardan para verlas sin señal
  if (url.hostname === "api.mapbox.com" && url.pathname.includes("/static/")) {
    evento.respondWith(cachePrimero(request, MAPAS));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Sesión de NextAuth: sin señal se usa la última conocida (si no, la app cerraría sesión)
  if (url.pathname === "/api/auth/session") {
    evento.respondWith(redPrimero(request, SESION));
    return;
  }

  // Archivos de la aplicación con nombre único (JS, CSS, fuentes) e íconos
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/iconos/") || url.pathname === "/manifest.webmanifest") {
    evento.respondWith(cachePrimero(request, ESTATICOS));
    return;
  }

  // Página de la app Terreno
  if (request.mode === "navigate" && url.pathname.startsWith("/terreno")) {
    evento.respondWith(redPrimero(request, PAGINAS));
  }
});
