"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useApi, mensajeError } from "./useApi";
import type { Operador, Rol } from "./tipos";

// El perfil se pide una sola vez por correo mientras la pestaña esté abierta
const cache = new Map<string, Promise<Operador>>();

export const RUTA_POR_ROL: Record<Rol, string> = {
  ADMINISTRADOR: "/",
  OPERADOR: "/departamentos",
  TERRENO: "/terreno",
};

/**
 * Registra/sincroniza al usuario en la base (POST /operadores/sincronizar) y
 * devuelve su perfil real: rol y departamento salen de la base, no del correo.
 * Si se indican roles permitidos y el usuario no tiene uno, lo envía a su panel.
 */
export function usePerfil(rolesPermitidos?: Rol[]) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const api = useApi();
  const email = session?.user?.email?.toLowerCase();
  const hayToken = !!(session as any)?.idToken;

  const [perfil, setPerfil] = useState<Operador | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (!email || !hayToken) return;
    let vigente = true;
    if (!cache.has(email)) {
      cache.set(
        email,
        api("/operadores/sincronizar", { method: "POST", body: JSON.stringify({}) }).then(async res => {
          if (!res.ok) {
            cache.delete(email);
            throw new Error(await mensajeError(res, "No se pudo validar tu acceso"));
          }
          return res.json();
        })
      );
    }
    cache
      .get(email)!
      .then(p => {
        if (!vigente) return;
        if (rolesPermitidos && !rolesPermitidos.includes(p.rol)) {
          router.replace(RUTA_POR_ROL[p.rol] || "/login");
          return;
        }
        setPerfil(p);
      })
      .catch(e => vigente && setError(e.message));
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, hayToken]);

  return { perfil, error, cargando: !perfil && !error };
}
