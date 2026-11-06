"use client";

// Notificaciones push (Web Push) para la app Terreno.
// La clave pública VAPID va en NEXT_PUBLIC_VAPID_PUBLICA; la privada solo en la Lambda y el worker.
const VAPID_PUBLICA = process.env.NEXT_PUBLIC_VAPID_PUBLICA || "";

export type EstadoNotificaciones =
  | "cargando"
  | "activas"
  | "inactivas"
  | "bloqueadas"      // el funcionario negó el permiso: se reactiva desde la configuración del navegador
  | "instalar"        // iPhone: solo funcionan con MuniVox agregado a la pantalla de inicio
  | "no-soportadas"
  | "sin-configurar"; // falta la clave VAPID en el servidor

const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const instalada = () => (navigator as any).standalone === true || window.matchMedia("(display-mode: standalone)").matches;

function claveABytes(base64: string) {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const b = atob((base64 + relleno).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(b, c => c.charCodeAt(0));
}

async function registro() {
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

export async function estadoNotificaciones(): Promise<EstadoNotificaciones> {
  if (!VAPID_PUBLICA) return "sin-configurar";
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return "no-soportadas";
  if (esIOS() && !instalada()) return "instalar";
  if (!("PushManager" in window) || !("Notification" in window)) return "no-soportadas";
  if (Notification.permission === "denied") return "bloqueadas";
  if (Notification.permission !== "granted") return "inactivas";
  const reg = await navigator.serviceWorker.getRegistration();
  const sus = await reg?.pushManager.getSubscription();
  return sus ? "activas" : "inactivas";
}

type Api = (url: string, init?: RequestInit) => Promise<Response>;

/** Debe llamarse desde un toque del usuario (los navegadores lo exigen para pedir permiso) */
export async function activarNotificaciones(api: Api): Promise<{ ok: boolean; mensaje: string }> {
  const permiso = await Notification.requestPermission();
  if (permiso !== "granted") {
    return { ok: false, mensaje: "No diste permiso. Para activarlas después, habilita las notificaciones de este sitio en la configuración del navegador." };
  }
  const reg = await registro();
  const sus = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveABytes(VAPID_PUBLICA) }));
  const res = await api("/operadores/notificaciones", {
    method: "POST",
    body: JSON.stringify({ activar: true, suscripcion: sus.toJSON(), dispositivo: navigator.userAgent.slice(0, 120) }),
  });
  if (!res.ok) {
    let error = "No se pudieron activar en el servidor.";
    try { error = (await res.json()).error || error; } catch {}
    await sus.unsubscribe().catch(() => {});
    return { ok: false, mensaje: error };
  }
  return { ok: true, mensaje: "Te llegará una notificación de prueba en unos segundos." };
}

export async function desactivarNotificaciones(api: Api) {
  const reg = await navigator.serviceWorker.getRegistration();
  const sus = await reg?.pushManager.getSubscription();
  if (!sus) return;
  await api("/operadores/notificaciones", { method: "POST", body: JSON.stringify({ activar: false, suscripcion: { endpoint: sus.endpoint } }) }).catch(() => {});
  await sus.unsubscribe().catch(() => {});
}
