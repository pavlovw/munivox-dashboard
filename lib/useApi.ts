"use client";
import { useCallback } from "react";
import { getSession, signOut, useSession } from "next-auth/react";

export const API_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || "https://nn4p1ybmu2.execute-api.us-east-2.amazonaws.com";

/**
 * fetch con el idToken de Cognito. Si la API responde 401 (token vencido),
 * pide una sesión nueva (NextAuth renueva el token) y reintenta una vez.
 * Las rutas pueden ser relativas a la API ("/tickets") o URLs completas.
 */
export function useApi() {
  const { data: session } = useSession();
  const idToken = (session as any)?.idToken as string | undefined;

  return useCallback(
    async (url: string, init: RequestInit = {}) => {
      const destino = url.startsWith("http") ? url : `${API_URL}${url}`;
      const pedir = (token?: string) =>
        fetch(destino, {
          ...init,
          headers: {
            ...((init.headers as Record<string, string>) || {}),
            ...(init.body ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

      let res = await pedir(idToken);
      if (res.status === 401) {
        const nueva: any = await getSession();
        if (nueva?.error === "RenovacionFallida") {
          signOut({ callbackUrl: "/login" });
          return res;
        }
        if (nueva?.idToken && nueva.idToken !== idToken) res = await pedir(nueva.idToken);
      }
      return res;
    },
    [idToken]
  );
}

/** Lee el mensaje de error de una respuesta de la API */
export async function mensajeError(res: Response, porDefecto = "No se pudo completar la acción") {
  try {
    const data = await res.json();
    return data?.error || porDefecto;
  } catch {
    return porDefecto;
  }
}
