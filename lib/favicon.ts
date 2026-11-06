"use client";
import { useEffect } from "react";
import type { Rol } from "./tipos";

// Ícono de la pestaña: el logo de MuniVox (M blanca) con un fondo distinto por rol y departamento.
// Las jefaturas usan el color de su departamento y los funcionarios de terreno un tono más oscuro.
export const COLOR_ICONO_C4 = "#1D4ED8";

const COLORES_DEPARTAMENTO: Record<number, { jefatura: string; terreno: string }> = {
  1: { jefatura: "#2B8A3E", terreno: "#1B5E2A" }, // Aseo y Ornato
  2: { jefatura: "#E8590C", terreno: "#A33D06" }, // Tránsito
  3: { jefatura: "#0C8599", terreno: "#08596A" }, // Seguridad Pública
  4: { jefatura: "#7048E8", terreno: "#4A2BB0" }, // Obras Municipales
};

const CLAVE_DEPARTAMENTO: Record<number, string> = { 1: "aseo", 2: "transito", 3: "seguridad", 4: "obras" };

/** Nombre del PNG en public/iconos para el acceso directo del celular */
export function claveIcono(rol: Rol, departamentoId?: number | null) {
  const d = departamentoId ? CLAVE_DEPARTAMENTO[departamentoId] : undefined;
  if (!d || (rol === "ADMINISTRADOR" && !departamentoId)) return "c4";
  return `${d}-${rol === "TERRENO" ? "terreno" : "jefatura"}`;
}

export function colorIcono(rol: Rol, departamentoId?: number | null) {
  if (rol === "ADMINISTRADOR" && !departamentoId) return COLOR_ICONO_C4;
  const c = departamentoId ? COLORES_DEPARTAMENTO[departamentoId] : undefined;
  if (!c) return COLOR_ICONO_C4;
  return rol === "TERRENO" ? c.terreno : c.jefatura;
}

/** SVG del logo (mismo dibujo que el componente Logo) con el fondo indicado */
export function svgFavicon(color: string) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" fill="${color}"/>` +
    `<g transform="translate(10.9 10.9) scale(1.76)" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="square" stroke-linejoin="miter">` +
    `<path d="M3 3h18v18H3z"/><path d="M7 16V8l5 5 5-5v8"/>` +
    `</g></svg>`
  );
}

/**
 * Cambia el ícono de la pestaña y el de "Añadir a pantalla de inicio" (apple-touch-icon).
 * El iPhone toma el segundo una sola vez, al crear el acceso directo.
 */
export function useFavicon(color?: string | null, clave?: string | null) {
  useEffect(() => {
    if (!clave) return;
    const href = `/iconos/apple-${clave}.png`;
    let enlaces = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-icon"]'));
    if (!enlaces.length) {
      const link = document.createElement("link");
      link.rel = "apple-touch-icon";
      document.head.appendChild(link);
      enlaces = [link];
    }
    enlaces.forEach(l => { l.href = href; l.setAttribute("sizes", "180x180"); });
  }, [clave]);

  useEffect(() => {
    if (!color) return;
    const href = `data:image/svg+xml,${encodeURIComponent(svgFavicon(color))}`;
    const existentes = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'));
    existentes.forEach(l => { l.href = href; l.type = "image/svg+xml"; });
    if (!existentes.length) {
      const link = document.createElement("link");
      link.rel = "icon";
      link.type = "image/svg+xml";
      link.href = href;
      document.head.appendChild(link);
    }
  }, [color]);
}
