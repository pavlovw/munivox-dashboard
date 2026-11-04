"use client";

import React, { useMemo, useState } from "react";
import { FiSearch, FiImage, FiUser } from "react-icons/fi";
import type { Ticket } from "../lib/tipos";
import { ESTADOS, ORDEN_ESTADOS, DEPARTAMENTOS, PRIORIDADES, categoriaInfo, departamentoInfo, prioridadDe, slaDe, tiempoRelativo, normalizar, resumenDescripcion } from "../lib/constantes";
import { Icono } from "./ui/Iconos";
import { IndicadorSla } from "./ui/Comunes";

interface Props {
  tickets: Ticket[];
  ahora: number;
  onSeleccionar: (id: string) => void;
}

export default function Kanban({ tickets, ahora, onSeleccionar }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [depto, setDepto] = useState<number | "TODOS">("TODOS");
  const [soloAtrasados, setSoloAtrasados] = useState(false);

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda);
    return tickets.filter(t => {
      if (depto !== "TODOS" && t.departamentoId !== depto) return false;
      if (soloAtrasados && (!slaDe(t, ahora).vencido || ["RESUELTO", "DESCARTADO"].includes(t.estado))) return false;
      if (!q) return true;
      return [t.codigoTicket, t.categoria?.nombre, t.analisisIA, t.descripcionUsuario, t.operadorAsignado?.nombre].some(v => normalizar(v).includes(q));
    });
  }, [tickets, busqueda, depto, soloAtrasados, ahora]);

  const columnas = useMemo(() => {
    const grupos: Record<string, Ticket[]> = {};
    ORDEN_ESTADOS.forEach(e => (grupos[e] = []));
    filtrados.forEach(t => grupos[t.estado]?.push(t));
    // Dentro de cada columna: primero lo más urgente, luego lo más antiguo
    Object.values(grupos).forEach(g => g.sort((a, b) => PRIORIDADES[prioridadDe(b)].peso - PRIORIDADES[prioridadDe(a)].peso || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    return grupos;
  }, [filtrados]);

  const total = filtrados.length || 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, gap: 12 }}>
      {/* Controles */}
      <div className="fila entre" style={{ flexWrap: "wrap", gap: 10 }}>
        <div className="fila" style={{ gap: 10, flexWrap: "wrap" }}>
          <div className="input-con-icono" style={{ width: 260 }}>
            <FiSearch size={14} />
            <input className="input" placeholder="Buscar código, texto o funcionario" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
          <div className="segmentos">
            <button className={`segmento${depto === "TODOS" ? " activo" : ""}`} onClick={() => setDepto("TODOS")}>Todos</button>
            {DEPARTAMENTOS.map(d => (
              <button key={d.id} className={`segmento${depto === d.id ? " activo" : ""}`} onClick={() => setDepto(d.id)}>{d.corto}</button>
            ))}
          </div>
          <label className="fila" style={{ gap: 8, fontSize: 12, cursor: "pointer" }}>
            <button className={`interruptor${soloAtrasados ? " activo" : ""}`} onClick={() => setSoloAtrasados(!soloAtrasados)} aria-label="Solo fuera de plazo" style={{ ["--ok" as any]: "var(--peligro)" }} />
            Solo fuera de plazo
          </label>
        </div>
        {/* Distribución del flujo */}
        <div style={{ display: "flex", width: 280, height: 8, background: "var(--superficie-3)" }} title="Distribución por estado">
          {ORDEN_ESTADOS.map(e => (
            <span key={e} style={{ width: `${(columnas[e].length / total) * 100}%`, background: ESTADOS[e].color, transition: "width 0.6s var(--curva)" }} />
          ))}
        </div>
      </div>

      {/* Tablero */}
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: `repeat(${ORDEN_ESTADOS.length}, minmax(240px, 1fr))`, gap: 10, overflowX: "auto" }}>
        {ORDEN_ESTADOS.map((estado, ci) => {
          const e = ESTADOS[estado];
          const lista = columnas[estado];
          return (
            <div key={estado} className="anim-arriba" style={{ display: "flex", flexDirection: "column", minHeight: 0, background: "var(--superficie-2)", border: "1px solid var(--borde)", ["--i" as any]: ci }}>
              <div style={{ padding: "10px 12px", borderTop: `3px solid ${e.color}`, background: "var(--superficie)", borderBottom: "1px solid var(--borde)" }}>
                <div className="fila entre">
                  <span style={{ fontWeight: 700, fontSize: 12.5 }}>{e.etiqueta}</span>
                  <span className="mono" style={{ fontWeight: 600, fontSize: 12, background: e.color, color: "#fff", padding: "1px 7px" }}>{lista.length}</span>
                </div>
                <div className="texto-3" style={{ fontSize: 11, marginTop: 2 }}>{e.descripcion}</div>
              </div>
              <div className="desplazable" style={{ flex: 1, padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                {lista.length === 0 && <div className="vacio" style={{ padding: 18, fontSize: 11.5 }}>Sin reportes</div>}
                {lista.slice(0, 80).map((t, i) => {
                  const cat = categoriaInfo(t.categoria?.nombre);
                  const p = PRIORIDADES[prioridadDe(t)];
                  const d = departamentoInfo(t.departamentoId);
                  return (
                    <button key={t.id} onClick={() => onSeleccionar(t.id)} className="item-lista anim-arriba"
                      style={{ ["--color-item" as any]: cat.color, ["--i" as any]: Math.min(i, 12), padding: "10px 10px 10px 14px" }}>
                      <div className="fila entre">
                        <span className="mono" style={{ fontWeight: 600, fontSize: 12 }}>{t.codigoTicket}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: p.color, textTransform: "uppercase", letterSpacing: "0.06em" }}>{p.etiqueta}</span>
                      </div>
                      <div className="fila" style={{ gap: 6, marginTop: 6 }}>
                        <span style={{ color: cat.color, display: "inline-flex" }}><Icono nombre={cat.icono} size={14} /></span>
                        <span className="truncar" style={{ fontSize: 12, fontWeight: 600 }}>{cat.nombre}</span>
                      </div>
                      <div className="dos-lineas texto-2" style={{ fontSize: 11.5, marginTop: 4 }}>{t.analisisIA || resumenDescripcion(t.descripcionUsuario)}</div>
                      <div className="fila entre" style={{ marginTop: 8, paddingTop: 6, borderTop: "1px solid var(--borde)" }}>
                        <span className="fila" style={{ gap: 6, fontSize: 10.5, color: "var(--texto-3)", minWidth: 0 }}>
                          {d && <span style={{ width: 8, height: 8, background: d.color, flexShrink: 0 }} />}
                          <span className="truncar">{t.operadorAsignado ? <><FiUser size={10} /> {t.operadorAsignado.nombre}</> : d?.corto || "Sin derivar"}</span>
                          {(t.evidencias?.length || 0) > 0 && <FiImage size={10} />}
                        </span>
                        {["RESUELTO", "DESCARTADO"].includes(t.estado)
                          ? <span className="mono texto-3" style={{ fontSize: 10.5 }}>{tiempoRelativo(t.updatedAt || t.createdAt, ahora)}</span>
                          : <IndicadorSla ticket={t} ahora={ahora} />}
                      </div>
                    </button>
                  );
                })}
                {lista.length > 80 && <div className="texto-3" style={{ fontSize: 11, textAlign: "center", padding: 6 }}>y {lista.length - 80} más. Usa los filtros.</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
