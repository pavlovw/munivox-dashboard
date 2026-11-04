"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FiRefreshCw, FiNavigation, FiUsers, FiRadio, FiWifiOff, FiClock } from "react-icons/fi";
import type { Operador, Ticket } from "../lib/tipos";
import { DEPARTAMENTOS, categoriaInfo, departamentoInfo, fechaCierre, tiempoRelativo, ESTADOS } from "../lib/constantes";
import { useApi, mensajeError } from "../lib/useApi";
import { Kpi, Vacio, Esqueleto } from "./ui/Comunes";
import { useAvisos } from "./ui/Avisos";

const Mapa = dynamic(() => import("./Map"), { ssr: false, loading: () => <div className="esqueleto" style={{ height: "100%" }} /> });

type Situacion = "EN_TAREA" | "POR_ACEPTAR" | "DISPONIBLE" | "SIN_SENAL" | "FUERA";

const SITUACIONES: Record<Situacion, { etiqueta: string; color: string; descripcion: string }> = {
  EN_TAREA:    { etiqueta: "En tarea",       color: "#7048E8", descripcion: "Va en camino o atiende un caso" },
  POR_ACEPTAR: { etiqueta: "Por aceptar",    color: "#1D4ED8", descripcion: "Tiene tareas asignadas sin aceptar" },
  DISPONIBLE:  { etiqueta: "Disponible",     color: "#2B8A3E", descripcion: "GPS activo y sin tareas" },
  SIN_SENAL:   { etiqueta: "Sin señal",      color: "#D9480F", descripcion: "GPS activo, sin posición hace más de 15 min" },
  FUERA:       { etiqueta: "Fuera de turno", color: "#6B7689", descripcion: "GPS apagado y sin tareas" },
};

interface Props {
  tickets: Ticket[];
  ahora: number;
  onAbrirTicket: (id: string) => void;
}

/** Vista en vivo del personal de terreno de todos los departamentos */
export default function EquiposTerreno({ tickets, ahora, onAbrirTicket }: Props) {
  const api = useApi();
  const avisar = useAvisos();
  const [funcionarios, setFuncionarios] = useState<Operador[] | null>(null);
  const [depto, setDepto] = useState<number | "TODOS">("TODOS");
  const [situacion, setSituacion] = useState<Situacion | "TODAS">("TODAS");
  const [seleccionado, setSeleccionado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const res = await api("/operadores?rol=TERRENO");
    if (res.ok) setFuncionarios(await res.json());
    else avisar({ titulo: "No se pudo cargar el personal", mensaje: await mensajeError(res), tipo: "error" });
  }, [api, avisar]);

  useEffect(() => {
    cargar();
    const id = setInterval(cargar, 20000); // las posiciones cambian seguido
    return () => clearInterval(id);
  }, [cargar]);

  const inicioDia = useMemo(() => { const d = new Date(ahora); d.setHours(0, 0, 0, 0); return d.getTime(); }, [ahora]);

  const fichas = useMemo(() => (funcionarios || []).map(f => {
    const tareas = tickets.filter(t => t.operadorAsignadoId === f.id && ["EN_REVISION", "DESPACHADO"].includes(t.estado));
    const enCamino = tareas.filter(t => t.estado === "DESPACHADO");
    const resueltosHoy = tickets.filter(t => t.operadorAsignadoId === f.id && t.estado === "RESUELTO" && (fechaCierre(t)?.getTime() || 0) >= inicioDia);
    const minutosSinPosicion = f.ultimaUbicacion ? (ahora - new Date(f.ultimaUbicacion).getTime()) / 60000 : Infinity;
    const sit: Situacion = enCamino.length ? "EN_TAREA" : tareas.length ? "POR_ACEPTAR" : f.gpsActivo ? (minutosSinPosicion > 15 ? "SIN_SENAL" : "DISPONIBLE") : "FUERA";
    return { f, tareas, enCamino, resueltosHoy: resueltosHoy.length, sit, minutosSinPosicion };
  }), [funcionarios, tickets, ahora, inicioDia]);

  const visibles = fichas
    .filter(x => (depto === "TODOS" || x.f.departamentoId === depto) && (situacion === "TODAS" || x.sit === situacion))
    .sort((a, b) => Object.keys(SITUACIONES).indexOf(a.sit) - Object.keys(SITUACIONES).indexOf(b.sit) || a.f.nombre.localeCompare(b.f.nombre));

  const conteo = (s: Situacion) => fichas.filter(x => (depto === "TODOS" || x.f.departamentoId === depto) && x.sit === s).length;
  const sel = fichas.find(x => x.f.id === seleccionado) || null;
  const tareaSel = sel?.enCamino[0] || sel?.tareas[0] || null;

  const ticketsMapa = useMemo(() => tickets.filter(t => t.operadorAsignadoId && ["EN_REVISION", "DESPACHADO"].includes(t.estado) && (depto === "TODOS" || t.departamentoId === depto)), [tickets, depto]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 10 }}>
        {(Object.keys(SITUACIONES) as Situacion[]).map((s, i) => (
          <button key={s} onClick={() => setSituacion(situacion === s ? "TODAS" : s)} style={{ padding: 0, border: 0, background: "none", textAlign: "left", outline: situacion === s ? `2px solid ${SITUACIONES[s].color}` : undefined }}>
            <Kpi i={i} titulo={SITUACIONES[s].etiqueta} valor={conteo(s)} color={SITUACIONES[s].color} detalle={SITUACIONES[s].descripcion} />
          </button>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12 }}>
        <div className="panel" style={{ width: 420, flexShrink: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div className="fila entre" style={{ padding: 10, borderBottom: "1px solid var(--borde)", gap: 8 }}>
            <select className="select" style={{ height: 32 }} value={depto} onChange={e => setDepto(e.target.value === "TODOS" ? "TODOS" : Number(e.target.value))}>
              <option value="TODOS">Todos los departamentos</option>
              {DEPARTAMENTOS.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
            <button className="btn-icono" onClick={cargar} title="Actualizar"><FiRefreshCw size={14} /></button>
          </div>
          <div className="desplazable" style={{ flex: 1, padding: 10, display: "flex", flexDirection: "column", gap: 6, background: "var(--superficie-2)" }}>
            {!funcionarios ? <Esqueleto alto={84} filas={5} /> : visibles.length === 0 ? (
              <Vacio icono={<FiUsers size={20} />} titulo="Sin funcionarios en esta selección" texto="Los funcionarios aparecen aquí cuando ingresan a /terreno por primera vez." />
            ) : visibles.map(({ f, tareas, enCamino, resueltosHoy, sit, minutosSinPosicion }, i) => {
              const d = departamentoInfo(f.departamentoId);
              const s = SITUACIONES[sit];
              return (
                <button key={f.id} onClick={() => setSeleccionado(seleccionado === f.id ? null : f.id)} className={`item-lista anim-arriba${seleccionado === f.id ? " seleccionado" : ""}`}
                  style={{ ["--color-item" as any]: s.color, ["--i" as any]: Math.min(i, 12) }}>
                  <div className="fila entre">
                    <span className="fila" style={{ gap: 10, minWidth: 0 }}>
                      <span className="mono" style={{ width: 32, height: 32, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: s.color, color: "#fff", fontWeight: 600, fontSize: 11 }}>
                        {f.nombre.split(/\s+/).map(p => p[0]).join("").slice(0, 2).toUpperCase()}
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <span className="truncar" style={{ display: "block", fontWeight: 600, fontSize: 12.5 }}>{f.nombre}</span>
                        <span className="fila texto-3" style={{ gap: 6, fontSize: 11 }}>{d && <span className="punto" style={{ background: d.color }} />}{d?.nombre || "Sin departamento"}</span>
                      </span>
                    </span>
                    <span className="insignia" style={{ color: s.color }}>{s.etiqueta}</span>
                  </div>
                  <div className="fila entre texto-2" style={{ marginTop: 8, fontSize: 11.5 }}>
                    <span className="fila" style={{ gap: 4 }}><FiClock size={11} />{f.ultimaUbicacion && Number.isFinite(minutosSinPosicion) ? `Posición ${tiempoRelativo(f.ultimaUbicacion, ahora)}` : "Sin posición registrada"}</span>
                    <span className="mono">{tareas.length} activa{tareas.length === 1 ? "" : "s"} | {resueltosHoy} hoy</span>
                  </div>
                  {enCamino[0] && (
                    <div className="truncar" style={{ marginTop: 6, fontSize: 11.5, color: s.color, fontWeight: 600 }}>
                      En camino a {enCamino[0].codigoTicket} | {categoriaInfo(enCamino[0].categoria?.nombre).nombre}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          {sel && (
            <div className="anim-arriba" style={{ borderTop: "1px solid var(--borde)", padding: 12, background: "var(--superficie)" }}>
              <div className="rotulo" style={{ marginBottom: 6 }}>Tareas de {sel.f.nombre}</div>
              {sel.tareas.length === 0 ? <div className="texto-3" style={{ fontSize: 12 }}>Sin tareas activas.</div> : (
                <div className="columna" style={{ gap: 4 }}>
                  {sel.tareas.map(t => (
                    <button key={t.id} onClick={() => onAbrirTicket(t.id)} className="fila entre" style={{ border: "1px solid var(--borde)", background: "var(--superficie-2)", padding: "6px 10px", fontSize: 12 }}>
                      <span className="mono" style={{ fontWeight: 600 }}>{t.codigoTicket}</span>
                      <span className="truncar texto-2" style={{ margin: "0 8px" }}>{categoriaInfo(t.categoria?.nombre).nombre}</span>
                      <span style={{ color: ESTADOS[t.estado].color, fontWeight: 600, fontSize: 11 }}>{t.estado === "DESPACHADO" ? "En camino" : "Por aceptar"}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="panel" style={{ flex: 1, minWidth: 0, position: "relative", overflow: "hidden" }}>
          <Mapa
            tickets={ticketsMapa}
            funcionarios={visibles.map(x => x.f)}
            onSeleccionar={onAbrirTicket}
            enfoque={sel?.f.latitud != null && !tareaSel ? [sel.f.latitud, sel.f.longitud!] : null}
            lineaDespacho={sel?.f.latitud != null && tareaSel?.latitud != null ? { desde: [sel.f.latitud, sel.f.longitud!], hasta: [tareaSel.latitud, tareaSel.longitud!] } : null}
          />
          <div className="fila" style={{ position: "absolute", right: 12, bottom: 40, zIndex: 5, gap: 10, background: "rgba(255,255,255,.96)", border: "1px solid var(--borde)", padding: "6px 10px", fontSize: 11 }}>
            <span className="fila" style={{ gap: 4 }}><FiRadio size={12} color="var(--ok)" /> Con GPS</span>
            <span className="fila" style={{ gap: 4 }}><FiWifiOff size={12} color="var(--texto-3)" /> Última posición conocida</span>
            <span className="fila" style={{ gap: 4 }}><FiNavigation size={12} color="var(--acento)" /> Ruta a su tarea</span>
          </div>
        </div>
      </div>
    </div>
  );
}
