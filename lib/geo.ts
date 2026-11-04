import buinBoundary from "../data/buin-boundary.json";

import uv1 from "../data/unidades-vecinales/unidad-vecinal-1.json";
import uv2 from "../data/unidades-vecinales/unidad-vecinal-2.json";
import uv3 from "../data/unidades-vecinales/unidad-vecinal-3.json";
import uv4 from "../data/unidades-vecinales/unidad-vecinal-4.json";
import uv5 from "../data/unidades-vecinales/unidad-vecinal-5.json";
import uv6 from "../data/unidades-vecinales/unidad-vecinal-6.json";
import uv7 from "../data/unidades-vecinales/unidad-vecinal-7.json";
import uv8 from "../data/unidades-vecinales/unidad-vecinal-8.json";
import uv9 from "../data/unidades-vecinales/unidad-vecinal-9.json";
import uv10 from "../data/unidades-vecinales/unidad-vecinal-10.json";
import uv11 from "../data/unidades-vecinales/unidad-vecinal-11.json";
import uv12 from "../data/unidades-vecinales/unidad-vecinal-12.json";
import uv13 from "../data/unidades-vecinales/unidad-vecinal-13.json";
import uv14 from "../data/unidades-vecinales/unidad-vecinal-14.json";
import uv15 from "../data/unidades-vecinales/unidad-vecinal-15.json";
import uv16 from "../data/unidades-vecinales/unidad-vecinal-16.json";
import uv17 from "../data/unidades-vecinales/unidad-vecinal-17.json";
import uv18 from "../data/unidades-vecinales/unidad-vecinal-18.json";
import uv19 from "../data/unidades-vecinales/unidad-vecinal-19.json";

export const LIMITE_BUIN = buinBoundary as any;
export const CENTRO_BUIN: [number, number] = [-70.7415, -33.7312]; // [lng, lat]

// Nombre de cada unidad vecinal y el archivo GeoJSON que la dibuja
export const UNIDADES_VECINALES: { id: string; nombre: string; data: any }[] = [
  { id: "1", nombre: "Buin Centro", data: uv3 },
  { id: "2", nombre: "Buin Poniente", data: uv1 },
  { id: "3", nombre: "Buin Norte", data: uv16 },
  { id: "4", nombre: "Buin Oriente", data: uv12 },
  { id: "5", nombre: "Buin Sur", data: uv9 },
  { id: "6", nombre: "Nuevo Buin", data: uv19 },
  { id: "7", nombre: "Maipo", data: uv5 },
  { id: "8", nombre: "Alto Jahuel", data: uv10 },
  { id: "9", nombre: "Linderos", data: uv7 },
  { id: "10", nombre: "Viluco", data: uv17 },
  { id: "11", nombre: "Valdivia de Paine", data: uv18 },
  { id: "12", nombre: "Cervera", data: uv15 },
  { id: "13", nombre: "La Estancilla", data: uv14 },
  { id: "14", nombre: "Nuevo Linderos", data: uv2 },
  { id: "15", nombre: "Flor de Maipo", data: uv13 },
  { id: "16", nombre: "Los Guindos", data: uv8 },
  { id: "17", nombre: "El Recurso", data: uv11 },
  { id: "18", nombre: "Rural Norte", data: uv6 },
  { id: "19", nombre: "El Cerrillo", data: uv4 },
];

function anillos(geojson: any): [number, number][][][] {
  const g = geojson?.geometry || geojson?.features?.[0]?.geometry;
  if (!g) return [];
  if (g.type === "Polygon") return [g.coordinates];
  if (g.type === "MultiPolygon") return g.coordinates;
  return [];
}

function dentroDeAnillo(lng: number, lat: number, anillo: [number, number][]) {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i];
    const [xj, yj] = anillo[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

function dentroDe(lng: number, lat: number, geojson: any) {
  return anillos(geojson).some(poligono => {
    if (!poligono.length || !dentroDeAnillo(lng, lat, poligono[0])) return false;
    return !poligono.slice(1).some(hueco => dentroDeAnillo(lng, lat, hueco));
  });
}

const cache = new Map<string, string | null>();

/** Unidad vecinal que contiene el punto (o null si está fuera de todas) */
export function unidadVecinalDe(lat?: number | null, lng?: number | null): string | null {
  if (lat == null || lng == null) return null;
  const clave = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  if (cache.has(clave)) return cache.get(clave)!;
  const uv = UNIDADES_VECINALES.find(u => dentroDe(lng, lat, u.data));
  const nombre = uv ? `UV ${uv.id} ${uv.nombre}` : dentroDe(lng, lat, LIMITE_BUIN) ? "Buin (sin UV)" : "Fuera de la comuna";
  cache.set(clave, nombre);
  return nombre;
}

export function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const enlaceGoogleMaps = (lat: number, lng: number) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
export const enlaceWaze = (lat: number, lng: number) => `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
