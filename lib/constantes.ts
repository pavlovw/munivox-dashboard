import type { Estado, Prioridad, Ticket, Historial } from "./tipos";

// ============================================================================
// ESTADOS
// ============================================================================
export const ESTADOS: Record<Estado, { etiqueta: string; corta: string; color: string; descripcion: string }> = {
  PENDIENTE:   { etiqueta: "Pendiente",     corta: "Nuevo",       color: "#D9480F", descripcion: "Ingresado por WhatsApp, sin derivar" },
  EN_REVISION: { etiqueta: "En revisión",   corta: "Revisión",    color: "#1D4ED8", descripcion: "En el departamento, por asignar o por confirmar" },
  DESPACHADO:  { etiqueta: "Despachado",    corta: "En terreno",  color: "#7048E8", descripcion: "El funcionario aceptó y va en camino" },
  RESUELTO:    { etiqueta: "Resuelto",      corta: "Resuelto",    color: "#2B8A3E", descripcion: "Caso cerrado con solución" },
  DESCARTADO:  { etiqueta: "Descartado",    corta: "Descartado",  color: "#6B7689", descripcion: "Cerrado sin intervención" },
};
export const ORDEN_ESTADOS: Estado[] = ["PENDIENTE", "EN_REVISION", "DESPACHADO", "RESUELTO", "DESCARTADO"];
export const ESTADOS_ACTIVOS: Estado[] = ["PENDIENTE", "EN_REVISION", "DESPACHADO"];

// ============================================================================
// PRIORIDADES Y PLAZOS (SLA)
// ============================================================================
export const PRIORIDADES: Record<Prioridad, { etiqueta: string; color: string; slaHoras: number; peso: number }> = {
  CRITICA: { etiqueta: "Crítica", color: "#C92A2A", slaHoras: 4,   peso: 4 },
  ALTA:    { etiqueta: "Alta",    color: "#E8590C", slaHoras: 24,  peso: 3 },
  MEDIA:   { etiqueta: "Media",   color: "#B7791F", slaHoras: 72,  peso: 2 },
  BAJA:    { etiqueta: "Baja",    color: "#6B7689", slaHoras: 168, peso: 1 },
};
export const ORDEN_PRIORIDADES: Prioridad[] = ["CRITICA", "ALTA", "MEDIA", "BAJA"];

// ============================================================================
// DEPARTAMENTOS (ids fijos en la base de datos)
// ============================================================================
export const DEPARTAMENTOS = [
  { id: 1, nombre: "Aseo y Ornato",     corto: "Aseo",      sigla: "DIMAO", color: "#2B8A3E" },
  { id: 2, nombre: "Tránsito",          corto: "Tránsito",  sigla: "DT",    color: "#E8590C" },
  { id: 3, nombre: "Seguridad Pública", corto: "Seguridad", sigla: "DSP",   color: "#1D4ED8" },
  { id: 4, nombre: "Obras Municipales", corto: "Obras",     sigla: "DOM",   color: "#7048E8" },
];

export const normalizar = (s?: string | null) =>
  String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function departamentoInfo(ref?: number | string | null) {
  if (ref === null || ref === undefined || ref === "") return null;
  if (typeof ref === "number") return DEPARTAMENTOS.find(d => d.id === ref) || null;
  const n = normalizar(ref);
  if (n.includes("aseo") || n.includes("dimao")) return DEPARTAMENTOS[0];
  if (n.includes("transito")) return DEPARTAMENTOS[1];
  if (n.includes("seguridad")) return DEPARTAMENTOS[2];
  if (n.includes("obras")) return DEPARTAMENTOS[3];
  return null;
}

// ============================================================================
// CATEGORÍAS (mismos nombres que usa la IA en el worker)
// ============================================================================
export type IconoCategoria = "bache" | "basura" | "alumbrado" | "vehiculo" | "ruido" | "senaletica" | "verde" | "animal" | "otro";

export const CATEGORIAS: { nombre: string; icono: IconoCategoria; color: string; departamentoId: number | null }[] = [
  { nombre: "Bache / Vialidad",      icono: "bache",      color: "#7C5A3A", departamentoId: 4 },
  { nombre: "Basura / Microbasural", icono: "basura",     color: "#2F7D32", departamentoId: 1 },
  { nombre: "Alumbrado público",     icono: "alumbrado",  color: "#C08A00", departamentoId: 4 },
  { nombre: "Vehículo abandonado",   icono: "vehiculo",   color: "#3B5BDB", departamentoId: 2 },
  { nombre: "Ruidos molestos",       icono: "ruido",      color: "#9C36B5", departamentoId: 3 },
  { nombre: "Señalética / Tránsito", icono: "senaletica", color: "#E8590C", departamentoId: 2 },
  { nombre: "Áreas verdes",          icono: "verde",      color: "#0C8A68", departamentoId: 1 },
  { nombre: "Animales",              icono: "animal",     color: "#C2255C", departamentoId: 3 },
  { nombre: "Otro",                  icono: "otro",       color: "#5C677D", departamentoId: null },
];

// Para nombres antiguos guardados en la base (por ejemplo "Bache, socavón o daño vial")
const PALABRAS_CATEGORIA: [number, string[]][] = [
  [5, ["senal", "semaforo"]],
  [0, ["bache", "socavon", "vialidad"]],
  [1, ["basura", "microbasural", "escombro"]],
  [2, ["alumbrado", "luminaria"]],
  [3, ["vehiculo"]],
  [4, ["ruido", "fiesta"]],
  [6, ["area verde", "plaza", "riego", "arbol"]],
  [7, ["animal", "perro"]],
];

export function categoriaInfo(nombre?: string | null) {
  const n = normalizar(nombre);
  const exacta = CATEGORIAS.find(c => normalizar(c.nombre) === n);
  if (exacta) return exacta;
  const parecida = n ? PALABRAS_CATEGORIA.find(([, ps]) => ps.some(p => n.includes(p))) : undefined;
  if (parecida) return CATEGORIAS[parecida[0]];
  return { ...CATEGORIAS[8], nombre: nombre || "Sin clasificar" };
}

// ============================================================================
// AYUDAS DE FORMATO Y CÁLCULO
// ============================================================================
export const prioridadDe = (t: Pick<Ticket, "prioridadFinal" | "prioridadIA">): Prioridad =>
  (t.prioridadFinal || t.prioridadIA || "MEDIA") as Prioridad;

export function tiempoRelativo(fecha?: string | Date | null, ahora = Date.now()) {
  if (!fecha) return "";
  const diff = Math.floor((ahora - new Date(fecha).getTime()) / 60000);
  if (diff < 1) return "ahora";
  if (diff < 60) return `hace ${diff} min`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "hace 1 día" : `hace ${d} días`;
}

export function duracion(ms: number) {
  const abs = Math.abs(ms);
  const min = Math.round(abs / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} h ${min % 60 ? `${min % 60} min` : ""}`.trim();
  const d = Math.floor(h / 24);
  return `${d} d ${h % 24 ? `${h % 24} h` : ""}`.trim();
}

export const fechaHora = (f?: string | Date | null) =>
  f ? new Date(f).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

export const horaCorta = (f?: string | Date | null) =>
  f ? new Date(f).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) : "";

export function formatearTelefono(tel?: string | null) {
  const d = String(tel || "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("569")) return `+56 9 ${d.slice(3, 7)} ${d.slice(7)}`;
  if (d.length === 9 && d.startsWith("9")) return `+56 9 ${d.slice(1, 5)} ${d.slice(5)}`;
  return tel || "";
}

/** Fecha en que el reporte se resolvió o descartó (según el historial) */
export function fechaCierre(t: Ticket): Date | null {
  if (t.estado !== "RESUELTO" && t.estado !== "DESCARTADO") return null;
  const h = (t.historial || []).find(x => x.estadoNuevo === t.estado && !esCalificacion(x));
  return h ? new Date(h.createdAt) : t.updatedAt ? new Date(t.updatedAt) : null;
}

/** Plazo de atención según la prioridad */
export function slaDe(t: Ticket, ahora = Date.now()) {
  const p = PRIORIDADES[prioridadDe(t)];
  const inicio = new Date(t.createdAt).getTime();
  const limite = inicio + p.slaHoras * 3600000;
  const cierre = fechaCierre(t);
  const referencia = cierre ? cierre.getTime() : ahora;
  const usado = (referencia - inicio) / (limite - inicio);
  return {
    limite: new Date(limite),
    restanteMs: limite - referencia,
    vencido: referencia > limite,
    porcentaje: Math.max(0, Math.min(1, usado)),
    cerrado: !!cierre,
    horas: p.slaHoras,
  };
}

export const esNotaInterna = (h: Historial) => String(h.comentario || "").startsWith("[Nota interna]");
export const esCalificacion = (h: Historial) => String(h.comentario || "").startsWith("Calificación del ciudadano");
export const esRechazo = (h: Historial) => String(h.comentario || "").startsWith("Rechazado por funcionario");

/** Nota del ciudadano (1, 3 o 5) si respondió la encuesta de cierre */
export function calificacionDe(t: Ticket): number | null {
  const h = (t.historial || []).find(esCalificacion);
  const m = h?.comentario?.match(/(\d)\/5/);
  return m ? Number(m[1]) : null;
}

/** Fecha de la primera derivación o asignación (tiempo de respuesta del C4) */
export function fechaPrimeraGestion(t: Ticket): Date | null {
  const gestiones = (t.historial || []).filter(h => h.operadorId && !esNotaInterna(h));
  if (!gestiones.length) return null;
  return new Date(gestiones[gestiones.length - 1].createdAt);
}

// ============================================================================
// CONVERSACIÓN DE WHATSAPP (descripcionUsuario guarda el texto acumulado)
// ============================================================================
export interface MensajeConversacion {
  tipo: "texto" | "foto" | "ubicacion" | "seleccion";
  texto: string;
}

export function leerConversacion(descripcion?: string | null): MensajeConversacion[] {
  if (!descripcion) return [];
  return descripcion
    .split(/\n?\[Usuario\]:\s*/g)
    .map(s => s.trim())
    .filter(Boolean)
    .map(parte => {
      if (parte.includes("[Sistema: El usuario acaba de enviar su Ubicación GPS]")) return { tipo: "ubicacion" as const, texto: "Ubicación enviada" };
      if (parte.includes("[Sistema: El usuario acaba de adjuntar una Fotografía]")) {
        const leyenda = parte.split("]").slice(1).join("]").replace(/^:\s*"?|"$/g, "").trim();
        return { tipo: "foto" as const, texto: leyenda || "Fotografía adjunta" };
      }
      if (/^El usuario seleccion/i.test(parte)) {
        return { tipo: "seleccion" as const, texto: parte.replace(/^El usuario seleccion[oó][^:]*:\s*/i, "").replace(/\. Aún no describe el problema\.?$/, "") };
      }
      return { tipo: "texto" as const, texto: parte };
    });
}

/** Texto limpio para vistas previas (sin marcas del sistema) */
export function resumenDescripcion(descripcion?: string | null) {
  const mensajes = leerConversacion(descripcion).filter(m => m.tipo === "texto" || m.tipo === "foto");
  return mensajes.map(m => m.texto).join(" ").trim() || "Sin descripción";
}
