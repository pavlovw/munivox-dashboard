"use client";
import { useEffect, useState } from "react";

// ============================================================================
// Herramientas para trabajar con señal débil o sin conexión (app Terreno)
// - Copia local de datos (localStorage) para abrir al instante.
// - Cola de acciones pendientes (IndexedDB) que se envía al volver la señal.
// ============================================================================

export function guardarLocal<T>(clave: string, datos: T) {
  try { localStorage.setItem(clave, JSON.stringify({ guardado: Date.now(), datos })); } catch {}
}

export function leerLocal<T>(clave: string): { guardado: number; datos: T } | null {
  try {
    const v = localStorage.getItem(clave);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

/** true mientras el navegador cree tener conexión */
export function useEnLinea() {
  const [enLinea, setEnLinea] = useState(true);
  useEffect(() => {
    const actualizar = () => setEnLinea(navigator.onLine);
    actualizar();
    window.addEventListener("online", actualizar);
    window.addEventListener("offline", actualizar);
    return () => {
      window.removeEventListener("online", actualizar);
      window.removeEventListener("offline", actualizar);
    };
  }, []);
  return enLinea;
}

/** Señal de corte para fetch: evita esperas eternas con mala señal */
export function limiteDeTiempo(ms: number): AbortSignal {
  const anyAbort = AbortSignal as any;
  if (typeof anyAbort.timeout === "function") return anyAbort.timeout(ms);
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

/** Distingue "no hay red" (reintentar después) de un error de la API (no reintentar) */
export const esErrorDeRed = (e: unknown) => e instanceof TypeError || (e as any)?.name === "AbortError" || (e as any)?.name === "TimeoutError";

// ----------------------------------------------------------------------------
// Cola de acciones (IndexedDB: soporta fotos sin el límite de localStorage)
// ----------------------------------------------------------------------------
export interface AccionPendiente {
  id: string;
  ruta: string;              // ej. "/tickets/<id>" u "/operadores/ubicacion"
  cuerpo: Record<string, unknown>;
  descripcion: string;       // texto para el funcionario: "Aceptar MUN-123456"
  ticketId?: string;
  creada: number;
}

const BD = "munivox-terreno";
const ALMACEN = "pendientes";

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, falla) => {
    const req = indexedDB.open(BD, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(ALMACEN, { keyPath: "id" }); };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => falla(req.error);
  });
}

async function operar<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await abrir();
  return new Promise((ok, falla) => {
    const tx = db.transaction(ALMACEN, modo);
    const req = fn(tx.objectStore(ALMACEN));
    req.onsuccess = () => ok(req.result as T);
    req.onerror = () => falla(req.error);
    tx.oncomplete = () => db.close();
  });
}

export const encolar = (a: Omit<AccionPendiente, "id" | "creada">) =>
  operar<IDBValidKey>("readwrite", s => s.put({ ...a, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, creada: Date.now() }));

export const listarPendientes = async () =>
  (await operar<AccionPendiente[]>("readonly", s => s.getAll())).sort((a, b) => a.creada - b.creada);

export const quitarPendiente = (id: string) => operar<undefined>("readwrite", s => s.delete(id));

// ----------------------------------------------------------------------------
// Service worker: permite abrir la app y mantener la sesión sin conexión
// ----------------------------------------------------------------------------
export function registrarServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (process.env.NODE_ENV !== "production") return; // en desarrollo interfiere con la recarga automática
  navigator.serviceWorker.register("/sw.js").catch(e => console.warn("No se pudo registrar el modo sin conexión:", e));
}
