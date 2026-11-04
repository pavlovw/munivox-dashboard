"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { getSession, useSession } from "next-auth/react";
import { useUltimo } from "./hooks";

export const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || "https://socket-service.politeplant-263a4d5b.eastus.azurecontainerapps.io";

export interface EventoTicket {
  id?: string;
  tipo?: string;
  departamentoId?: number;
  operadorAsignadoId?: string;
  origen?: string;
}

interface Opciones {
  onTicketCambio?: (e: EventoTicket) => void;
  onNuevoTicket?: (ticket: any) => void;
  onOperadoresCambio?: (e: { departamentoId?: number }) => void;
  activo?: boolean;
}

/**
 * Conexión WebSocket con socket-service. Los avisos solo indican "algo cambió";
 * cada panel vuelve a pedir sus datos a la API (que aplica los permisos).
 */
export function useTiempoReal({ onTicketCambio, onNuevoTicket, onOperadoresCambio, activo = true }: Opciones) {
  const { data: session } = useSession();
  const idToken = (session as any)?.idToken as string | undefined;
  const [conectado, setConectado] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const tokenRef = useUltimo(idToken);
  const cb = useUltimo({ onTicketCambio, onNuevoTicket, onOperadoresCambio });

  const hayToken = !!idToken;
  useEffect(() => {
    if (!activo || !hayToken) return;
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      // Cada reconexión usa el token vigente (se renueva cada hora)
      auth: async (enviar: (d: object) => void) => {
        const s: any = tokenRef.current ? null : await getSession();
        enviar({ token: tokenRef.current || s?.idToken });
      },
      reconnectionDelay: 1500,
      reconnectionDelayMax: 10000,
    });
    socketRef.current = socket;

    socket.on("connect", () => setConectado(true));
    socket.on("disconnect", () => setConectado(false));
    socket.on("connect_error", err => {
      setConectado(false);
      console.warn("Tiempo real no disponible:", err.message);
    });
    socket.on("ticket-cambio", (e: EventoTicket) => cb.current.onTicketCambio?.(e));
    socket.on("ticket-actualizado", (t: any) => cb.current.onNuevoTicket?.(t));
    socket.on("operadores-cambio", (e: any) => cb.current.onOperadoresCambio?.(e));

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setConectado(false);
    };
  }, [activo, hayToken, tokenRef, cb]);

  const avisarCambio = useCallback((e: EventoTicket) => {
    socketRef.current?.emit("ticket-cambio", e);
  }, []);

  const avisarUbicacion = useCallback((e: { departamentoId?: number | null }) => {
    socketRef.current?.emit("ubicacion", { departamentoId: e.departamentoId ?? undefined });
  }, []);

  return { conectado, avisarCambio, avisarUbicacion };
}

/**
 * Refresco de respaldo: cada 60 s si hay WebSocket, cada 15 s si no lo hay,
 * y siempre al volver a la pestaña. Así ningún panel depende solo del sondeo.
 */
export function useRefresco(cargar: () => void, conectado: boolean, activo = true) {
  const ref = useUltimo(cargar);

  useEffect(() => {
    if (!activo) return;
    const ms = conectado ? 60000 : 15000;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") ref.current();
    }, ms);
    return () => clearInterval(id);
  }, [conectado, activo, ref]);

  useEffect(() => {
    if (!activo) return;
    const alVolver = () => document.visibilityState === "visible" && ref.current();
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("online", alVolver);
    return () => {
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("online", alVolver);
    };
  }, [activo, ref]);
}

/** Agrupa varias llamadas seguidas en una sola (por ejemplo, ráfagas de avisos) */
export function useAgrupado(fn: () => void, ms = 400) {
  const ref = useUltimo(fn);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => ref.current(), ms);
  }, [ms, ref]);
}
