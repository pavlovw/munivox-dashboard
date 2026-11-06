// MuniVox | Service worker de la app Terreno
// Permite abrir /terreno y mantener la sesión cuando no hay señal.
// Los datos de la API (tareas) los guarda la propia app; aquí solo van archivos y la sesión.

const VERSION = "munivox-v2";
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

// ============================================================================
// NOTIFICACIONES PUSH (las envía la Lambda o el worker)
// ============================================================================
self.addEventListener("push", (evento) => {
  let aviso = {};
  try { aviso = evento.data ? evento.data.json() : {}; } catch (e) { aviso = { cuerpo: evento.data && evento.data.text() }; }
  const titulo = aviso.titulo || "MuniVox";
  evento.waitUntil(self.registration.showNotification(titulo, {
    body: aviso.cuerpo || "Tienes una actualización en tus tareas.",
    icon: "/iconos/icono-192.png",       // logo de MuniVox
    badge: "/iconos/insignia-96.png",    // silueta para la barra de estado de Android
    tag: aviso.tag || undefined,         // una tarea = una notificación (se reemplaza, no se acumula)
    renotify: !!aviso.tag,
    requireInteraction: !!aviso.urgente, // las urgentes quedan visibles hasta que se tocan
    vibrate: aviso.urgente ? [300, 120, 300, 120, 300] : [180, 80, 180],
    data: { url: aviso.url || "/terreno" },
    lang: "es-CL",
  }));
});

// Al tocar la notificación se abre la app en la tarea correspondiente
self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = new URL((evento.notification.data && evento.notification.data.url) || "/terreno", self.location.origin).href;
  evento.waitUntil((async () => {
    const abiertas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const cliente of abiertas) {
      if (new URL(cliente.url).pathname.startsWith("/terreno")) {
        await cliente.focus();
        if ("navigate" in cliente) return cliente.navigate(destino);
        return;
      }
    }
    return self.clients.openWindow(destino);
  })());
});
