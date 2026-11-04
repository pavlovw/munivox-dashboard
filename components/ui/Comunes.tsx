"use client";
import { useEffect, useState } from "react";
import { FiX, FiMapPin, FiImage, FiList, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import {
  ESTADOS, PRIORIDADES, categoriaInfo, slaDe, duracion, leerConversacion, fechaHora,
  esNotaInterna, esCalificacion, esRechazo, esMensajeVecino,
} from "../../lib/constantes";
import type { Estado, Prioridad, Ticket, Historial, Evidencia } from "../../lib/tipos";
import { useCuentaAnimada } from "../../lib/hooks";
import { Icono } from "./Iconos";

// ============================================================================
// MARCA
// ============================================================================
export function Logo({ tamano = 30, claro = true, subtitulo }: { tamano?: number; claro?: boolean; subtitulo?: string }) {
  return (
    <div className="fila" style={{ gap: 10 }}>
      <div style={{ width: tamano, height: tamano, background: "#1D4ED8", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icono nombre="logo" size={tamano * 0.66} grosor={2.2} />
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: tamano * 0.5, letterSpacing: "0.08em", color: claro ? "#fff" : "var(--texto)", lineHeight: 1 }}>MUNIVOX</div>
        {subtitulo && <div className="rotulo" style={{ color: claro ? "var(--marino-texto)" : "var(--texto-3)", marginTop: 4, fontSize: 9 }}>{subtitulo}</div>}
      </div>
    </div>
  );
}

// ============================================================================
// INSIGNIAS
// ============================================================================
export function InsigniaEstado({ estado, solida = false }: { estado: Estado; solida?: boolean }) {
  const e = ESTADOS[estado] || { etiqueta: estado, color: "#6B7689" };
  return (
    <span className={`insignia${solida ? " insignia-solida" : ""}`} style={{ color: e.color, background: solida ? e.color : "transparent" }}>
      <span className="punto" style={{ background: solida ? "#fff" : e.color }} />
      {e.etiqueta}
    </span>
  );
}

export function InsigniaPrioridad({ prioridad, ajustada = false }: { prioridad: Prioridad; ajustada?: boolean }) {
  const p = PRIORIDADES[prioridad] || PRIORIDADES.MEDIA;
  const barras = p.peso;
  return (
    <span className="insignia" style={{ color: p.color }} title={ajustada ? "Prioridad ajustada por un operador" : "Prioridad estimada por la IA"}>
      <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 1.5, height: 10 }}>
        {[1, 2, 3, 4].map(n => (
          <span key={n} style={{ width: 3, height: 3 + n * 1.75, background: n <= barras ? p.color : "currentColor", opacity: n <= barras ? 1 : 0.2 }} />
        ))}
      </span>
      {p.etiqueta}
      {ajustada && <span style={{ fontWeight: 500, opacity: 0.7 }}>*</span>}
    </span>
  );
}

export function EtiquetaCategoria({ nombre, compacta = false }: { nombre?: string | null; compacta?: boolean }) {
  const c = categoriaInfo(nombre);
  return (
    <span className="fila" style={{ gap: 8, minWidth: 0 }}>
      <span style={{ width: compacta ? 22 : 26, height: compacta ? 22 : 26, background: c.color, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icono nombre={c.icono} size={compacta ? 13 : 15} />
      </span>
      <span className="truncar" style={{ fontWeight: 600, fontSize: compacta ? 12 : 12.5 }}>{nombre || "Sin clasificar"}</span>
    </span>
  );
}

/** Plazo de atención: muestra el tiempo restante o el atraso */
export function IndicadorSla({ ticket, ahora, barra = false }: { ticket: Ticket; ahora: number; barra?: boolean }) {
  if (ticket.estado === "DESCARTADO") return null;
  const s = slaDe(ticket, ahora);
  const color = s.vencido ? "var(--peligro)" : s.porcentaje > 0.75 ? "var(--alerta)" : "var(--ok)";
  const texto = s.cerrado
    ? s.vencido ? `Cerrado fuera de plazo` : `Cerrado en plazo`
    : s.vencido ? `Atrasado ${duracion(s.restanteMs)}` : `Quedan ${duracion(s.restanteMs)}`;
  return (
    <div style={{ minWidth: 0 }}>
      <span className="mono" style={{ fontSize: 10.5, fontWeight: 600, color, whiteSpace: "nowrap", animation: s.vencido && !s.cerrado ? "parpadeo 2s ease-in-out infinite" : undefined }}>
        {texto}
      </span>
      {barra && (
        <div className="barra" style={{ marginTop: 4, ["--color-barra" as any]: color }}>
          <span style={{ width: `${Math.round(s.porcentaje * 100)}%` }} />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// KPI CON NÚMERO ANIMADO
// ============================================================================
export function Kpi({ titulo, valor, sufijo = "", detalle, color, decimales = 0, i = 0, icono }: {
  titulo: string; valor: number; sufijo?: string; detalle?: React.ReactNode; color?: string; decimales?: number; i?: number; icono?: React.ReactNode;
}) {
  const v = useCuentaAnimada(Number.isFinite(valor) ? valor : 0);
  return (
    <div className="kpi anim-arriba" style={{ ["--color-kpi" as any]: color, ["--i" as any]: i }}>
      <div className="fila entre">
        <span className="rotulo">{titulo}</span>
        {icono && <span style={{ color: color || "var(--texto-3)" }}>{icono}</span>}
      </div>
      <div className="kpi-valor" style={{ color: color && color !== "var(--acento)" ? color : undefined }}>
        {Number.isFinite(valor) ? v.toFixed(decimales) : "--"}
        <span style={{ fontSize: 14, marginLeft: 2, color: "var(--texto-3)" }}>{sufijo}</span>
      </div>
      {detalle && <div className="kpi-detalle">{detalle}</div>}
    </div>
  );
}

// ============================================================================
// ESTADOS DE CARGA Y VACÍO
// ============================================================================
export function Esqueleto({ alto = 76, filas = 4 }: { alto?: number; filas?: number }) {
  return (
    <div className="columna" style={{ gap: 8 }}>
      {Array.from({ length: filas }).map((_, i) => (
        <div key={i} className="esqueleto" style={{ height: alto, border: "1px solid var(--borde)", opacity: 1 - i * 0.18 }} />
      ))}
    </div>
  );
}

export function Vacio({ icono, titulo, texto, children }: { icono?: React.ReactNode; titulo: string; texto?: string; children?: React.ReactNode }) {
  return (
    <div className="vacio anim-aparecer">
      {icono}
      <div style={{ fontWeight: 600, color: "var(--texto-2)", fontSize: 13 }}>{titulo}</div>
      {texto && <div style={{ fontSize: 12, maxWidth: 300 }}>{texto}</div>}
      {children}
    </div>
  );
}

export function PantallaCarga({ texto = "Verificando acceso" }: { texto?: string }) {
  return (
    <div className="fondo-rejilla" style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 20, color: "#fff" }}>
      <Logo tamano={40} subtitulo="Central C4 | Buin" />
      <div style={{ width: 220, height: 2, background: "rgba(255,255,255,0.12)", position: "relative", overflow: "hidden" }}>
        <span style={{ position: "absolute", inset: 0, background: "#4C7DFF", animation: "barrido 1.1s ease-in-out infinite" }} />
      </div>
      <span className="rotulo" style={{ color: "var(--marino-texto)" }}>{texto}</span>
    </div>
  );
}

export function IndicadorConexion({ conectado, claro = false }: { conectado: boolean; claro?: boolean }) {
  return (
    <span className="fila" style={{ gap: 8 }} title={conectado ? "Recibiendo cambios al instante por WebSocket" : "Sin WebSocket: se actualiza cada 15 segundos"}>
      <span className={`vivo${conectado ? "" : " desconectado"}`} />
      <span className="rotulo" style={{ color: claro ? "var(--marino-texto)" : conectado ? "var(--ok)" : "var(--alerta)" }}>
        {conectado ? "En vivo" : "Sondeo 15 s"}
      </span>
    </span>
  );
}

// ============================================================================
// MODAL
// ============================================================================
export function Modal({ abierto, titulo, subtitulo, onCerrar, children, pie, ancho = 480 }: {
  abierto: boolean; titulo: string; subtitulo?: string; onCerrar: () => void; children: React.ReactNode; pie?: React.ReactNode; ancho?: number;
}) {
  useEffect(() => {
    if (!abierto) return;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [abierto, onCerrar]);

  if (!abierto) return null;
  return (
    <div className="velo" onMouseDown={e => e.target === e.currentTarget && onCerrar()}>
      <div className="modal marco" style={{ maxWidth: ancho }} role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="modal-cabecera">
          <div>
            <h3 className="titulo-2">{titulo}</h3>
            {subtitulo && <p className="texto-3" style={{ margin: "4px 0 0", fontSize: 12 }}>{subtitulo}</p>}
          </div>
          <button className="btn-icono" onClick={onCerrar} aria-label="Cerrar"><FiX size={16} /></button>
        </div>
        <div className="modal-cuerpo">{children}</div>
        {pie && <div className="modal-pie">{pie}</div>}
      </div>
    </div>
  );
}

// ============================================================================
// EVIDENCIAS CON VISOR
// ============================================================================
export function Galeria({ evidencias, alto = 120 }: { evidencias?: Evidencia[]; alto?: number }) {
  const [indice, setIndice] = useState<number | null>(null);
  const lista = evidencias || [];

  useEffect(() => {
    if (indice === null) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIndice(null);
      if (e.key === "ArrowRight") setIndice(i => (i === null ? i : (i + 1) % lista.length));
      if (e.key === "ArrowLeft") setIndice(i => (i === null ? i : (i - 1 + lista.length) % lista.length));
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [indice, lista.length]);

  if (!lista.length) {
    return <div className="vacio" style={{ padding: 18 }}><FiImage size={18} /><span style={{ fontSize: 12 }}>El vecino no adjuntó fotografías</span></div>;
  }
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 6 }}>
        {lista.map((ev, i) => (
          <button key={ev.id || i} onClick={() => setIndice(i)} className="anim-escalar" style={{ padding: 0, border: "1px solid var(--borde)", background: "var(--superficie-3)", height: alto, overflow: "hidden", ["--i" as any]: i }}>
            <img src={ev.url} alt={`Evidencia ${i + 1}`} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.4s var(--curva)" }}
              onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.06)")} onMouseLeave={e => (e.currentTarget.style.transform = "none")} />
          </button>
        ))}
      </div>
      {indice !== null && (
        <div className="visor" onClick={() => setIndice(null)}>
          <img src={lista[indice].url} alt="Evidencia ampliada" onClick={e => e.stopPropagation()} />
          <button className="btn-icono" style={{ position: "absolute", top: 16, right: 16 }} onClick={() => setIndice(null)} aria-label="Cerrar"><FiX /></button>
          {lista.length > 1 && (
            <>
              <button className="btn-icono" style={{ position: "absolute", left: 16, top: "50%" }} onClick={e => { e.stopPropagation(); setIndice((indice - 1 + lista.length) % lista.length); }} aria-label="Anterior"><FiChevronLeft /></button>
              <button className="btn-icono" style={{ position: "absolute", right: 16, top: "50%" }} onClick={e => { e.stopPropagation(); setIndice((indice + 1) % lista.length); }} aria-label="Siguiente"><FiChevronRight /></button>
            </>
          )}
          <span className="mono" style={{ position: "absolute", bottom: 16, color: "#9FB0CC", fontSize: 12 }}>{indice + 1} / {lista.length}</span>
        </div>
      )}
    </>
  );
}

// ============================================================================
// CONVERSACIÓN DE WHATSAPP
// ============================================================================
export function Conversacion({ descripcion }: { descripcion?: string | null }) {
  const mensajes = leerConversacion(descripcion);
  if (!mensajes.length) return <div className="texto-3" style={{ fontSize: 12 }}>Sin mensajes registrados.</div>;
  return (
    <div className="columna" style={{ gap: 6, background: "var(--superficie-2)", border: "1px solid var(--borde)", padding: 12 }}>
      {mensajes.map((m, i) => {
        const sistema = m.tipo !== "texto";
        return (
          <div key={i} className="anim-arriba" style={{ ["--i" as any]: i, alignSelf: "flex-start", maxWidth: "92%" }}>
            {sistema ? (
              <span className="fila" style={{ gap: 6, fontSize: 11, color: "var(--texto-2)", border: "1px solid var(--borde-fuerte)", padding: "4px 8px", background: "var(--superficie)" }}>
                {m.tipo === "ubicacion" ? <FiMapPin size={12} /> : m.tipo === "foto" ? <FiImage size={12} /> : <FiList size={12} />}
                {m.tipo === "seleccion" ? `Eligió en el menú: ${m.texto}` : m.texto}
              </span>
            ) : (
              <div style={{ background: "var(--superficie)", border: "1px solid var(--borde)", borderLeft: "3px solid #2B8A3E", padding: "7px 10px", fontSize: 12.5, lineHeight: 1.5 }}>
                {m.texto}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// TRAZABILIDAD
// ============================================================================
export function LineaTiempo({ historial, creado }: { historial?: Historial[]; creado: string }) {
  const lista = historial || [];
  return (
    <div className="linea-tiempo">
      {lista.map((h, i) => {
        const nota = esNotaInterna(h);
        const calif = esCalificacion(h);
        const rechazo = esRechazo(h);
        const mensaje = esMensajeVecino(h);
        const color = calif ? "#C08A00" : rechazo ? "var(--peligro)" : mensaje ? "#0C8A68" : nota ? "var(--texto-3)" : ESTADOS[h.estadoNuevo]?.color;
        const titulo = calif ? "Evaluación del vecino" : rechazo ? "Rechazado por funcionario" : mensaje ? "Mensaje enviado al vecino" : nota ? "Nota interna" : ESTADOS[h.estadoNuevo]?.etiqueta || h.estadoNuevo;
        const comentario = String(h.comentario || "").replace(/^\[Nota interna\]\s*/, "").replace(/^\[Mensaje al vecino\]\s*/, "").replace(/^Rechazado por funcionario:\s*/, "Motivo: ");
        return (
          <div key={h.id} className={`hito anim-arriba${i === 0 ? " actual" : ""}`} style={{ ["--color-hito" as any]: color, ["--i" as any]: i }}>
            <div className="fila entre" style={{ alignItems: "baseline" }}>
              <span style={{ fontWeight: 600, fontSize: 12, color }}>{titulo}</span>
              <span className="mono texto-3" style={{ fontSize: 10.5 }}>{fechaHora(h.createdAt)}</span>
            </div>
            {comentario && <div style={{ fontSize: 12, color: "var(--texto-2)", marginTop: 2 }}>{comentario}</div>}
            {h.operador?.nombre && <div className="texto-3" style={{ fontSize: 11, marginTop: 2 }}>Por {h.operador.nombre}</div>}
          </div>
        );
      })}
      <div className="hito" style={{ ["--color-hito" as any]: "#2B8A3E" }}>
        <div className="fila entre" style={{ alignItems: "baseline" }}>
          <span style={{ fontWeight: 600, fontSize: 12 }}>Ingresado por WhatsApp</span>
          <span className="mono texto-3" style={{ fontSize: 10.5 }}>{fechaHora(creado)}</span>
        </div>
        <div className="texto-3" style={{ fontSize: 11, marginTop: 2 }}>Clasificado por la IA</div>
      </div>
    </div>
  );
}

// ============================================================================
// SECCIÓN CON TÍTULO
// ============================================================================
export function Seccion({ titulo, icono, children, accion }: { titulo: string; icono?: React.ReactNode; children: React.ReactNode; accion?: React.ReactNode }) {
  return (
    <section className="anim-arriba">
      <div className="fila entre" style={{ marginBottom: 8 }}>
        <span className="rotulo fila" style={{ gap: 6 }}>{icono}{titulo}</span>
        {accion}
      </div>
      {children}
    </section>
  );
}
