"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { FiLayers, FiCrosshair, FiChevronDown, FiChevronUp } from "react-icons/fi";

import type { Ticket, Operador } from "../lib/tipos";
import { categoriaInfo, CATEGORIAS, ESTADOS, prioridadDe, slaDe, tiempoRelativo, ESTADOS_ACTIVOS } from "../lib/constantes";
import { LIMITE_BUIN, UNIDADES_VECINALES, CENTRO_BUIN } from "../lib/geo";
import { svgIcono } from "./ui/Iconos";
import { useUltimo } from "../lib/hooks";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

interface MapProps {
  tickets: Ticket[];
  onSeleccionar?: (id: string) => void;
  seleccionadoId?: string | null;
  enfoque?: [number, number] | null; // [lat, lng]
  cercanos?: Ticket[];
  funcionarios?: Operador[];
  lineaDespacho?: { desde: [number, number]; hasta: [number, number] } | null; // [lat, lng]
  compacto?: boolean;
  zoomEnfoque?: number;
}

/** Distancia aproximada en metros entre dos puntos [lng, lat] */
function distanciaM(a: [number, number], b: [number, number]) {
  const kx = 111320 * Math.cos((a[1] * Math.PI) / 180), ky = 110540;
  return Math.hypot((b[0] - a[0]) * kx, (b[1] - a[1]) * ky);
}

/** Rumbo en grados (0 = norte, sentido horario) para girar el camión hacia donde avanza */
function rumboGrados(a: [number, number], b: [number, number]) {
  const kx = 111320 * Math.cos((a[1] * Math.PI) / 180), ky = 110540;
  return ((Math.atan2((b[0] - a[0]) * kx, (b[1] - a[1]) * ky) * 180) / Math.PI + 360) % 360;
}

/** Camión visto desde arriba (cabina hacia el norte) en dos colores; se carga como imagen del mapa */
function cargarCamion(mapa: mapboxgl.Map, nombre: string, color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="84" viewBox="0 0 28 42">` +
    `<g stroke="#ffffff" stroke-width="3" stroke-linejoin="miter" fill="none"><rect x="6" y="15" width="16" height="23"/><rect x="7" y="4" width="14" height="10"/></g>` +
    `<rect x="6" y="15" width="16" height="23" fill="#ffffff" stroke="${color}" stroke-width="2"/>` +
    `<rect x="7" y="4" width="14" height="10" fill="${color}"/>` +
    `<rect x="9" y="6" width="10" height="3.5" fill="#ffffff" fill-opacity="0.85"/>` +
    `<rect x="9" y="19" width="10" height="2" fill="${color}" fill-opacity="0.35"/><rect x="9" y="24" width="10" height="2" fill="${color}" fill-opacity="0.35"/><rect x="9" y="29" width="10" height="2" fill="${color}" fill-opacity="0.35"/>` +
    `</svg>`;
  return new Promise<void>(resolver => {
    const img = new Image(56, 84);
    img.onload = () => { if (!mapa.hasImage(nombre)) mapa.addImage(nombre, img, { pixelRatio: 2 }); resolver(); };
    img.onerror = () => resolver();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

const escapar = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export default function Mapa({
  tickets, onSeleccionar, seleccionadoId, enfoque, cercanos = [], funcionarios = [], lineaDespacho, compacto = false, zoomEnfoque = 16,
}: MapProps) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<mapboxgl.Map | null>(null);
  const marcadores = useRef(new Map<string, { marker: mapboxgl.Marker; el: HTMLDivElement; firma: string }>());
  const primeraCarga = useRef(true);
  const onSeleccionarRef = useUltimo(onSeleccionar);

  // Posición dibujada de cada funcionario (para avanzar y girar suavemente) y cuadro de animación en curso
  const movimientoFunc = useRef(new Map<string, {
    pos: [number, number]; desde: [number, number]; hasta: [number, number];
    inicio: number; duracion: number; recibido: number; rumbo: number;
    props: { nombre: string; activo: boolean; detalle: string };
  }>());
  const cuadroFunc = useRef<number | null>(null);

  /** Escribe las posiciones actuales en la capa del mapa */
  const pintarFuncionarios = () => {
    const fuente = mapaRef.current?.getSource("funcionarios") as mapboxgl.GeoJSONSource | undefined;
    if (!fuente) return;
    const features = [...movimientoFunc.current.entries()].map(([id, m]) => ({
      type: "Feature" as const,
      properties: { id, rumbo: m.rumbo, ...m.props },
      geometry: { type: "Point" as const, coordinates: m.pos },
    }));
    fuente.setData({ type: "FeatureCollection", features });
  };
  const pintarFuncionariosRef = useUltimo(pintarFuncionarios);

  /** Avanza a todos los funcionarios hasta su destino, cuadro a cuadro, y se detiene al llegar */
  const animarFuncionarios = () => {
    if (cuadroFunc.current) return;
    const paso = () => {
      const t = performance.now();
      let enMovimiento = false;
      movimientoFunc.current.forEach(m => {
        const k = m.duracion > 0 ? Math.min((t - m.inicio) / m.duracion, 1) : 1;
        m.pos = [m.desde[0] + (m.hasta[0] - m.desde[0]) * k, m.desde[1] + (m.hasta[1] - m.desde[1]) * k];
        if (k < 1) enMovimiento = true;
      });
      pintarFuncionariosRef.current();
      cuadroFunc.current = enMovimiento ? requestAnimationFrame(paso) : null;
    };
    cuadroFunc.current = requestAnimationFrame(paso);
  };

  const [listo, setListo] = useState(false);
  const [uvId, setUvId] = useState("TODAS");
  const [bordesUV, setBordesUV] = useState(false);
  const [calor, setCalor] = useState(false);
  const [modo3D, setModo3D] = useState(false);
  const [leyendaAbierta, setLeyendaAbierta] = useState(!compacto);

  // --------------------------------------------------------------------------
  // INICIALIZACIÓN
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!contenedor.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;

    const mapa = new mapboxgl.Map({
      container: contenedor.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: CENTRO_BUIN,
      zoom: compacto ? 15 : 12.6,
      attributionControl: !compacto,
    });
    mapaRef.current = mapa;
    if (!compacto) mapa.addControl(new mapboxgl.NavigationControl({ showCompass: true }), "bottom-right");

    mapa.on("load", () => {
      const capas = mapa.getStyle().layers || [];
      const capaEtiquetas = capas.find(l => l.type === "symbol" && (l.layout as any)?.["text-field"])?.id;

      capas.forEach(l => {
        try {
          if (l.type === "background") mapa.setPaintProperty(l.id, "background-color", "#E4E8EE");
          if ((l.id.includes("landuse") || l.id.includes("landcover")) && l.type === "fill") mapa.setPaintProperty(l.id, "fill-color", "#DDE3EA");
          if (l.id.includes("water") && l.type === "fill") mapa.setPaintProperty(l.id, "fill-color", "#BFD3EA");
          if (l.id.includes("road") && l.type === "line") mapa.setPaintProperty(l.id, "line-color", "#FFFFFF");
        } catch {}
      });

      mapa.addLayer({
        id: "edificios-3d", source: "composite", "source-layer": "building", filter: ["==", "extrude", "true"], type: "fill-extrusion", minzoom: 14,
        paint: { "fill-extrusion-color": "#B9C6DA", "fill-extrusion-height": ["get", "height"], "fill-extrusion-base": ["get", "min_height"], "fill-extrusion-opacity": 0.75 },
      }, capaEtiquetas);

      // Máscara fuera de la comuna y límite comunal
      const mundo = [[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]];
      mapa.addSource("mascara", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [mundo, LIMITE_BUIN.geometry.coordinates[0]] } } as any });
      mapa.addLayer({ id: "mascara", type: "fill", source: "mascara", paint: { "fill-color": "#0A1222", "fill-opacity": 0.22 } }, capaEtiquetas);
      mapa.addSource("limite", { type: "geojson", data: LIMITE_BUIN });
      mapa.addLayer({ id: "limite", type: "line", source: "limite", paint: { "line-color": "#0A1222", "line-width": 2.2 } });

      // Unidades vecinales
      mapa.addSource("uv-sel", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      mapa.addLayer({ id: "uv-sel-fill", type: "fill", source: "uv-sel", paint: { "fill-color": "#1D4ED8", "fill-opacity": 0.12 } });
      mapa.addLayer({ id: "uv-sel-line", type: "line", source: "uv-sel", paint: { "line-color": "#1D4ED8", "line-width": 2.5 } });
      UNIDADES_VECINALES.forEach(uv => {
        mapa.addSource(`uv-${uv.id}`, { type: "geojson", data: uv.data });
        mapa.addLayer({ id: `uv-${uv.id}`, type: "line", source: `uv-${uv.id}`, layout: { visibility: "none" }, paint: { "line-color": "#0A1222", "line-width": 1, "line-dasharray": [3, 3], "line-opacity": 0.6 } });
      });

      // Mapa de calor de reportes
      mapa.addSource("calor", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      mapa.addLayer({
        id: "calor", type: "heatmap", source: "calor", layout: { visibility: "none" },
        paint: {
          "heatmap-weight": ["get", "peso"],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 10, 0.8, 16, 2.2],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 10, 16, 16, 40],
          "heatmap-opacity": 0.75,
          "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(29,78,216,0)", 0.25, "#4C7DFF", 0.5, "#F59F00", 0.8, "#E8590C", 1, "#C92A2A"],
        },
      }, capaEtiquetas);

      // Línea de despacho (funcionario -> reporte)
      mapa.addSource("despacho", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      mapa.addLayer({ id: "despacho-base", type: "line", source: "despacho", paint: { "line-color": "#0A1222", "line-width": 5, "line-opacity": 0.15 } });
      mapa.addLayer({ id: "despacho", type: "line", source: "despacho", paint: { "line-color": "#1D4ED8", "line-width": 2.5, "line-dasharray": [0, 4, 3] } });

      // Funcionarios en terreno: capa del mapa (como Uber), no elementos HTML encima.
      // Así quedan fijos en su coordenada en cualquier zoom, cambian de tamaño con el mapa
      // y el camión (visto desde arriba) gira según hacia dónde avanza.
      mapa.addSource("funcionarios", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      Promise.all([cargarCamion(mapa, "camion-activo", "#2B8A3E"), cargarCamion(mapa, "camion-inactivo", "#0F172A")]).then(() => {
        if (!mapa.getStyle() || mapa.getLayer("funcionarios")) return;
        mapa.addLayer({
          id: "funcionarios", type: "symbol", source: "funcionarios",
          layout: {
            "icon-image": ["case", ["get", "activo"], "camion-activo", "camion-inactivo"],
            "icon-size": ["interpolate", ["linear"], ["zoom"], 11, 0.5, 14, 0.75, 16, 1, 18, 1.35],
            "icon-rotate": ["get", "rumbo"],
            "icon-rotation-alignment": "map",
            "icon-pitch-alignment": "map",
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
          },
        });
        const popupNombre = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 16 });
        mapa.on("mouseenter", "funcionarios", e => {
          mapa.getCanvas().style.cursor = "pointer";
          const f = e.features?.[0];
          if (f) popupNombre.setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number]).setHTML(`<div style="padding:6px 10px;font-weight:600;font-size:12px">${escapar(String(f.properties?.nombre || ""))}</div>`).addTo(mapa);
        });
        mapa.on("mouseleave", "funcionarios", () => { mapa.getCanvas().style.cursor = ""; popupNombre.remove(); });
        mapa.on("click", "funcionarios", e => {
          const f = e.features?.[0];
          if (!f) return;
          popupNombre.remove();
          new mapboxgl.Popup({ offset: 16, maxWidth: "240px" }).setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number]).setHTML(String(f.properties?.detalle || "")).addTo(mapa);
        });
        pintarFuncionariosRef.current();
      });

      setListo(true);
    });

    // Línea de despacho animada
    const pasos = [[0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0], [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5]];
    let paso = 0;
    const animacion = setInterval(() => {
      if (!mapa.getLayer("despacho")) return;
      paso = (paso + 1) % pasos.length;
      mapa.setPaintProperty("despacho", "line-dasharray", pasos[paso]);
    }, 70);

    const actuales = marcadores.current;
    return () => {
      clearInterval(animacion);
      actuales.forEach(m => m.marker.remove());
      actuales.clear();
      mapa.remove();
      mapaRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --------------------------------------------------------------------------
  // MARCADORES DE REPORTES (se actualizan por diferencia: sin parpadeos)
  // --------------------------------------------------------------------------
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;
    const ahora = Date.now();
    const vigentes = new Set<string>();
    let indiceNuevo = 0;

    tickets.forEach(t => {
      if (t.latitud == null || t.longitud == null) return;
      vigentes.add(t.id);
      const cat = categoriaInfo(t.categoria?.nombre);
      const activo = ESTADOS_ACTIVOS.includes(t.estado);
      const prio = prioridadDe(t);
      const urgente = activo && (prio === "CRITICA" || slaDe(t, ahora).vencido);
      const firma = [t.estado, cat.nombre, prio, urgente, t.latitud, t.longitud].join("|");
      const existente = marcadores.current.get(t.id);

      if (existente && existente.firma === firma) return;
      if (existente) { existente.marker.remove(); marcadores.current.delete(t.id); }

      const el = document.createElement("div");
      el.className = `marcador${urgente ? " urgente" : ""}${activo ? "" : " apagado"}${primeraCarga.current || existente ? "" : " nuevo"}`;
      if (primeraCarga.current) { el.classList.add("nuevo"); el.style.setProperty("--i", String(Math.min(indiceNuevo++, 30))); }
      el.style.setProperty("--color-marcador", cat.color);
      el.style.setProperty("--color-urgente", prio === "CRITICA" ? "#C92A2A" : "#E8590C");
      el.innerHTML = `<div class="marcador-cuerpo">${svgIcono(cat.icono)}</div>`;
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", `${t.codigoTicket} ${cat.nombre}`);

      const popup = document.createElement("div");
      popup.style.minWidth = "210px";
      popup.innerHTML = `
        <div style="height:4px;background:${cat.color}"></div>
        <div style="padding:10px 12px">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:baseline">
            <span style="font-family:var(--mono);font-weight:600;font-size:13px">${escapar(t.codigoTicket)}</span>
            <span style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${ESTADOS[t.estado]?.color}">${ESTADOS[t.estado]?.etiqueta || t.estado}</span>
          </div>
          <div style="font-size:12px;font-weight:600;margin-top:4px">${escapar(cat.nombre)}</div>
          <div style="font-size:11px;color:var(--texto-3);margin-top:2px">${tiempoRelativo(t.createdAt)} | Prioridad ${prio.toLowerCase()}</div>
          ${onSeleccionarRef.current ? `<button data-abrir style="margin-top:10px;width:100%;height:30px;border:0;background:#0A1222;color:#fff;font-weight:600;font-size:11px;letter-spacing:.04em">ABRIR EXPEDIENTE</button>` : ""}
        </div>`;
      popup.querySelector("[data-abrir]")?.addEventListener("click", () => onSeleccionarRef.current?.(t.id));

      const marker = new mapboxgl.Marker({ element: el, anchor: "bottom", offset: [0, -7] })
        .setLngLat([t.longitud, t.latitud])
        .setPopup(new mapboxgl.Popup({ offset: 30, closeButton: true, maxWidth: "260px" }).setDOMContent(popup))
        .addTo(mapa);

      el.addEventListener("click", ev => {
        ev.stopPropagation();
        onSeleccionarRef.current?.(t.id);
      });
      el.addEventListener("mouseenter", () => { if (!marker.getPopup()?.isOpen()) marker.togglePopup(); });
      el.addEventListener("mouseleave", () => { if (marker.getPopup()?.isOpen()) marker.togglePopup(); });

      marcadores.current.set(t.id, { marker, el, firma });
    });

    marcadores.current.forEach((m, id) => {
      if (!vigentes.has(id)) { m.marker.remove(); marcadores.current.delete(id); }
    });
    if (tickets.length) primeraCarga.current = false;

    // Datos del mapa de calor (los activos pesan más)
    const fuente = listo ? (mapa.getSource("calor") as mapboxgl.GeoJSONSource | undefined) : undefined;
    fuente?.setData({
      type: "FeatureCollection",
      features: tickets.filter(t => t.latitud != null && t.longitud != null).map(t => ({
        type: "Feature", properties: { peso: ESTADOS_ACTIVOS.includes(t.estado) ? 1 : 0.4 },
        geometry: { type: "Point", coordinates: [t.longitud!, t.latitud!] },
      })),
    } as any);
  }, [tickets, listo, onSeleccionarRef]);

  // Resalta el seleccionado
  useEffect(() => {
    marcadores.current.forEach((m, id) => m.el.classList.toggle("activo", id === seleccionadoId));
  }, [seleccionadoId, tickets]);

  // --------------------------------------------------------------------------
  // REPORTES CERCANOS (posibles duplicados)
  // --------------------------------------------------------------------------
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !cercanos.length) return;
    const lista = cercanos.filter(c => c.latitud != null && !marcadores.current.has(c.id)).map(c => {
      const el = document.createElement("div");
      // Sin clases de animación en el elemento raíz: Mapbox controla su transform
      el.className = "marcador-cercano";
      el.title = `${c.codigoTicket} a ${c.distancia} m`;
      el.addEventListener("click", () => onSeleccionarRef.current?.(c.id));
      return new mapboxgl.Marker({ element: el }).setLngLat([c.longitud!, c.latitud!]).addTo(mapa);
    });
    return () => lista.forEach(m => m.remove());
  }, [cercanos, onSeleccionarRef]);

  // --------------------------------------------------------------------------
  // FUNCIONARIOS EN TERRENO (capa "funcionarios" del mapa, creada al cargar)
  // --------------------------------------------------------------------------
  // Cada funcionario guarda su posición dibujada y, al llegar una nueva, el camión avanza hasta
  // ella en el tiempo que pasó desde la anterior y gira hacia donde se mueve, como en Uber.
  // Moverse menos de 6 m no cambia el rumbo (el ruido del GPS lo haría girar en el lugar).
  useEffect(() => {
    const reducido = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ahoraMs = performance.now();
    const vigentes = new Set<string>();
    const registro = movimientoFunc.current;

    funcionarios.filter(f => f.latitud != null && f.longitud != null).forEach(f => {
      vigentes.add(f.id);
      const ultima = f.ultimaUbicacion ? `${tiempoRelativo(f.ultimaUbicacion)}` : "sin registro";
      const props = {
        nombre: f.nombre,
        activo: !!f.gpsActivo,
        detalle: `
          <div style="padding:10px 12px;min-width:180px">
            <div style="font-weight:600;font-size:12.5px">${escapar(f.nombre)}</div>
            <div style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-top:4px;color:${f.gpsActivo ? "#2B8A3E" : "#7C889B"}">${f.gpsActivo ? "GPS activo" : "GPS apagado"}</div>
            <div style="font-size:11px;color:#7C889B;margin-top:2px">Última posición ${ultima}</div>
            <div style="font-size:11px;color:#46536A;margin-top:2px">${f._count?.ticketsAsignados ?? 0} tarea(s) activa(s)</div>
          </div>`,
      };
      const destino: [number, number] = [f.longitud!, f.latitud!];
      const actual = registro.get(f.id);
      if (!actual) {
        registro.set(f.id, { pos: destino, desde: destino, hasta: destino, inicio: ahoraMs, duracion: 0, recibido: ahoraMs, rumbo: 0, props });
        return;
      }
      actual.props = props;
      const metros = distanciaM(actual.pos, destino);
      if (metros < 0.5) { actual.recibido = ahoraMs; return; }
      if (metros >= 6) actual.rumbo = rumboGrados(actual.pos, destino);
      // Saltos grandes (más de 1,5 km) o movimiento reducido: sin animación
      const duracion = reducido || metros > 1500 ? 0 : Math.min(Math.max(ahoraMs - actual.recibido, 600), 6000);
      Object.assign(actual, { desde: actual.pos, hasta: destino, inicio: ahoraMs, duracion, recibido: ahoraMs });
    });
    registro.forEach((_, id) => { if (!vigentes.has(id)) registro.delete(id); });
    animarFuncionarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funcionarios]);

  useEffect(() => () => { if (cuadroFunc.current) cancelAnimationFrame(cuadroFunc.current); }, []);

  // --------------------------------------------------------------------------
  // LÍNEA DE DESPACHO
  // --------------------------------------------------------------------------
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !listo) return;
    const fuente = mapa.getSource("despacho") as mapboxgl.GeoJSONSource | undefined;
    fuente?.setData(lineaDespacho ? {
      type: "Feature", properties: {},
      geometry: { type: "LineString", coordinates: [[lineaDespacho.desde[1], lineaDespacho.desde[0]], [lineaDespacho.hasta[1], lineaDespacho.hasta[0]]] },
    } as any : { type: "FeatureCollection", features: [] });
    if (lineaDespacho) {
      const b = new mapboxgl.LngLatBounds();
      b.extend([lineaDespacho.desde[1], lineaDespacho.desde[0]]);
      b.extend([lineaDespacho.hasta[1], lineaDespacho.hasta[0]]);
      mapa.fitBounds(b, { padding: 120, maxZoom: 16, duration: 900 });
    }
  }, [lineaDespacho, listo]);

  // --------------------------------------------------------------------------
  // ENFOQUE, CAPAS Y VISTA
  // --------------------------------------------------------------------------
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !enfoque || enfoque[0] == null || enfoque[1] == null) return;
    mapa.flyTo({ center: [enfoque[1], enfoque[0]], zoom: zoomEnfoque, essential: true, duration: 1400, curve: 1.6 });
  }, [enfoque?.[0], enfoque?.[1], zoomEnfoque]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !listo) return;
    const uv = UNIDADES_VECINALES.find(u => u.id === uvId);
    (mapa.getSource("uv-sel") as mapboxgl.GeoJSONSource)?.setData(uv ? uv.data : { type: "FeatureCollection", features: [] });
    if (uv) {
      const b = new mapboxgl.LngLatBounds();
      const geom = uv.data.geometry || uv.data.features?.[0]?.geometry;
      const anillos = geom?.type === "MultiPolygon" ? geom.coordinates.flat() : geom?.coordinates || [];
      anillos.forEach((a: [number, number][]) => a.forEach(p => b.extend(p)));
      if (!b.isEmpty()) mapa.fitBounds(b, { padding: 60, duration: 1000 });
    }
  }, [uvId, listo]);

  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !listo) return;
    UNIDADES_VECINALES.forEach(uv => mapa.getLayer(`uv-${uv.id}`) && mapa.setLayoutProperty(`uv-${uv.id}`, "visibility", bordesUV ? "visible" : "none"));
  }, [bordesUV, listo]);

  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !listo) return;
    mapa.setLayoutProperty("calor", "visibility", calor ? "visible" : "none");
    marcadores.current.forEach(m => (m.el.style.visibility = calor ? "hidden" : "visible"));
  }, [calor, listo, tickets]);

  const alternar3D = () => {
    const mapa = mapaRef.current;
    if (!mapa) return;
    mapa.easeTo({ pitch: modo3D ? 0 : 60, bearing: modo3D ? 0 : -18, duration: 1000 });
    setModo3D(!modo3D);
  };

  const recentrar = () => {
    setUvId("TODAS");
    mapaRef.current?.flyTo({ center: CENTRO_BUIN, zoom: 12.6, pitch: 0, bearing: 0, duration: 1200 });
    setModo3D(false);
  };

  const conteo = useMemo(() => {
    const c: Record<string, number> = {};
    tickets.forEach(t => {
      if (!ESTADOS_ACTIVOS.includes(t.estado)) return;
      const n = categoriaInfo(t.categoria?.nombre).nombre;
      c[n] = (c[n] || 0) + 1;
    });
    return c;
  }, [tickets]);

  const estiloFlotante: React.CSSProperties = { position: "absolute", zIndex: 5, background: "rgba(255,255,255,0.97)", border: "1px solid var(--borde)", boxShadow: "var(--sombra-2)" };

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div ref={contenedor} style={{ position: "absolute", inset: 0 }} />

      {!MAPBOX_TOKEN && (
        <div className="vacio" style={{ position: "absolute", inset: 0, zIndex: 6, background: "var(--superficie-2)" }}>
          Falta NEXT_PUBLIC_MAPBOX_TOKEN: el mapa no puede cargarse.
        </div>
      )}

      {!compacto && (
        <>
          {/* Controles superiores */}
          <div className="anim-arriba" style={{ ...estiloFlotante, top: 12, left: 12, display: "flex", alignItems: "stretch" }}>
            <select className="select" value={uvId} onChange={e => setUvId(e.target.value)} aria-label="Unidad vecinal"
              style={{ border: 0, height: 34, minWidth: 190, fontWeight: 600, fontSize: 12 }}>
              <option value="TODAS">Toda la comuna</option>
              {UNIDADES_VECINALES.map(uv => <option key={uv.id} value={uv.id}>UV {uv.id} | {uv.nombre}</option>)}
            </select>
            <button className="btn-icono" style={{ border: 0, borderLeft: "1px solid var(--borde)", height: 34 }} onClick={recentrar} title="Volver a la comuna"><FiCrosshair size={15} /></button>
          </div>

          <div className="anim-arriba" style={{ ...estiloFlotante, top: 12, right: 12, display: "flex", ["--i" as any]: 1 }}>
            <span className="fila" style={{ padding: "0 10px", gap: 6, color: "var(--texto-3)", borderRight: "1px solid var(--borde)" }}><FiLayers size={13} /></span>
            {[
              { id: "uv", etiqueta: "Límites UV", activo: bordesUV, accion: () => setBordesUV(!bordesUV) },
              { id: "calor", etiqueta: "Calor", activo: calor, accion: () => setCalor(!calor) },
              { id: "3d", etiqueta: "3D", activo: modo3D, accion: alternar3D },
            ].map(b => (
              <button key={b.id} onClick={b.accion} className={`segmento${b.activo ? " activo" : ""}`} style={{ height: 34 }}>{b.etiqueta}</button>
            ))}
          </div>

          {/* Leyenda */}
          <div className="anim-arriba" style={{ ...estiloFlotante, left: 12, bottom: 12, width: 220, ["--i" as any]: 2 }}>
            <button onClick={() => setLeyendaAbierta(!leyendaAbierta)} className="fila entre" style={{ width: "100%", padding: "8px 12px", background: "var(--marino)", color: "#fff", border: 0 }}>
              <span className="rotulo" style={{ color: "#fff" }}>Activos por categoría</span>
              {leyendaAbierta ? <FiChevronDown size={14} /> : <FiChevronUp size={14} />}
            </button>
            {leyendaAbierta && (
              <div style={{ padding: "6px 0" }}>
                {CATEGORIAS.map(c => (
                  <div key={c.nombre} className="fila entre" style={{ padding: "3px 12px", fontSize: 11.5, opacity: conteo[c.nombre] ? 1 : 0.45 }}>
                    <span className="fila" style={{ gap: 8 }}><span style={{ width: 10, height: 10, background: c.color }} />{c.nombre}</span>
                    <span className="mono" style={{ fontWeight: 600 }}>{conteo[c.nombre] || 0}</span>
                  </div>
                ))}
                <div className="fila" style={{ gap: 8, padding: "6px 12px 2px", borderTop: "1px solid var(--borde)", marginTop: 4, fontSize: 11, color: "var(--texto-3)" }}>
                  <span style={{ width: 10, height: 10, border: "2px solid var(--peligro)" }} /> Crítico o fuera de plazo
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
