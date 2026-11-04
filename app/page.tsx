"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import {
  FiMap, FiColumns, FiBarChart2, FiSettings, FiLogOut, FiSearch, FiVolume2, FiVolumeX, FiSend,
  FiEdit3, FiSlash, FiRotateCcw, FiInbox, FiAlertTriangle, FiCpu,
} from "react-icons/fi";

import Kanban from "../components/Kanban";
import Estadisticas from "../components/Estadisticas";
import AdminPanel from "../components/AdminPanel";
import DetalleTicket from "../components/DetalleTicket";
import { Logo, PantallaCarga, IndicadorConexion, InsigniaEstado, IndicadorSla, Esqueleto, Vacio, Modal, Kpi } from "../components/ui/Comunes";
import { Icono } from "../components/ui/Iconos";
import { useAvisos } from "../components/ui/Avisos";

import { useApi, mensajeError } from "../lib/useApi";
import { usePerfil } from "../lib/usePerfil";
import { useTiempoReal, useRefresco, useAgrupado } from "../lib/useTiempoReal";
import { useAhora, usePreferencia, sonarAlerta } from "../lib/hooks";
import type { Ticket, Prioridad, Estado } from "../lib/tipos";
import {
  ESTADOS, PRIORIDADES, ORDEN_PRIORIDADES, DEPARTAMENTOS, CATEGORIAS, ESTADOS_ACTIVOS, ORDEN_ESTADOS,
  categoriaInfo, departamentoInfo, prioridadDe, slaDe, tiempoRelativo, normalizar, resumenDescripcion, formatearTelefono,
} from "../lib/constantes";

const Mapa = dynamic(() => import("../components/Map"), {
  ssr: false,
  loading: () => <div className="esqueleto" style={{ width: "100%", height: "100%" }} />,
});

type Vista = "OPERACIONES" | "KANBAN" | "ESTADISTICAS" | "ADMINISTRACION";

const MOTIVOS_DESCARTE = [
  "Duplicado de otro reporte",
  "Fuera de la comuna de Buin",
  "No corresponde a la Municipalidad",
  "Información insuficiente para atender",
  "Reporte falso o de prueba",
];

export default function CentralC4() {
  const { perfil, error: errorPerfil } = usePerfil(["ADMINISTRADOR"]);
  const api = useApi();
  const avisar = useAvisos();
  const ahora = useAhora(30000);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState<Vista>("OPERACIONES");

  const [texto, setTexto] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"ACTIVOS" | "TODOS" | Estado>("ACTIVOS");
  const [filtroPrioridad, setFiltroPrioridad] = useState<"TODAS" | Prioridad>("TODAS");
  const [filtroCategoria, setFiltroCategoria] = useState("TODAS");
  const [filtroDepto, setFiltroDepto] = useState<"TODOS" | "SIN" | number>("TODOS");
  const [soloAtrasados, setSoloAtrasados] = useState(false);
  const [orden, setOrden] = useState<"URGENCIA" | "RECIENTES" | "ANTIGUOS">("URGENCIA");

  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<Ticket | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [cercanos, setCercanos] = useState<Ticket[]>([]);
  const [deptoDestino, setDeptoDestino] = useState<number | "">("");
  const [procesando, setProcesando] = useState(false);
  const [modal, setModal] = useState<null | "DESCARTAR" | "NOTA" | "REABRIR">(null);
  const [textoModal, setTextoModal] = useState("");

  const [nuevos, setNuevos] = useState<Set<string>>(new Set());
  const [sonido, setSonido] = usePreferencia("munivox_sonido", true);
  const busquedaRef = useRef<HTMLInputElement>(null);
  const seleccionRef = useRef<string | null>(null);

  // --------------------------------------------------------------------------
  // DATOS
  // --------------------------------------------------------------------------
  const cargarTickets = useCallback(async () => {
    try {
      const res = await api("/tickets");
      if (res.ok) {
        const data: Ticket[] = await res.json();
        setTickets(prev => (JSON.stringify(prev) === JSON.stringify(data) ? prev : data));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  }, [api]);

  const cargarDetalle = useCallback(async (id: string, conCercanos = false) => {
    setCargandoDetalle(true);
    try {
      const res = await api(`/tickets/${id}`);
      if (!res.ok) {
        avisar({ titulo: "No se pudo abrir el expediente", mensaje: await mensajeError(res), tipo: "error" });
        return;
      }
      const t: Ticket = await res.json();
      if (seleccionRef.current !== id) return;
      setDetalle(t);
      if (conCercanos) {
        setDeptoDestino(t.departamentoId ?? categoriaInfo(t.categoria?.nombre).departamentoId ?? "");
        setCercanos([]);
        if (t.latitud != null && t.longitud != null) {
          const rc = await api(`/tickets/cercanos?lat=${t.latitud}&lng=${t.longitud}&excluir=${t.id}`);
          if (rc.ok && seleccionRef.current === id) setCercanos(await rc.json());
        }
      }
    } finally {
      setCargandoDetalle(false);
    }
  }, [api, avisar]);

  const recargar = useAgrupado(() => {
    cargarTickets();
    if (seleccionRef.current) cargarDetalle(seleccionRef.current);
  }, 350);

  useEffect(() => { if (perfil) cargarTickets(); }, [perfil, cargarTickets]);

  const { conectado, avisarCambio } = useTiempoReal({
    activo: !!perfil,
    onTicketCambio: () => recargar(),
    onNuevoTicket: (t: any) => {
      recargar();
      if (!t?.id) return;
      setNuevos(s => new Set(s).add(t.id));
      setTimeout(() => setNuevos(s => { const n = new Set(s); n.delete(t.id); return n; }), 60000);
      if (sonido) sonarAlerta("nuevo");
      avisar({
        titulo: `Nuevo reporte ${t.codigoTicket || ""}`,
        mensaje: `${t.categoria?.nombre || "Sin clasificar"} | Prioridad ${String(t.prioridadIA || "media").toLowerCase()}`,
        tipo: "nuevo",
        duracion: 9000,
        accion: { etiqueta: "Abrir expediente", onClick: () => { setVista("OPERACIONES"); seleccionar(t.id); } },
      });
    },
  });
  useRefresco(cargarTickets, conectado, !!perfil);

  // --------------------------------------------------------------------------
  // SELECCIÓN
  // --------------------------------------------------------------------------
  const seleccionar = useCallback((id: string) => {
    setSeleccionadoId(id);
    seleccionRef.current = id;
    setDetalle(prev => (prev?.id === id ? prev : (tickets.find(t => t.id === id) as Ticket) || null));
    cargarDetalle(id, true);
  }, [tickets, cargarDetalle]);

  const cerrarDetalle = useCallback(() => {
    seleccionRef.current = null;
    setSeleccionadoId(null);
    setDetalle(null);
    setCercanos([]);
  }, []);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const escribiendo = ["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName);
      if (e.key === "Escape" && !modal) cerrarDetalle();
      if (e.key === "/" && !escribiendo) { e.preventDefault(); setVista("OPERACIONES"); setTimeout(() => busquedaRef.current?.focus(), 50); }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [modal, cerrarDetalle]);

  // --------------------------------------------------------------------------
  // ACCIONES
  // --------------------------------------------------------------------------
  const actualizar = async (cuerpo: Record<string, unknown>, exito: string) => {
    if (!detalle) return false;
    setProcesando(true);
    try {
      const res = await api(`/tickets/${detalle.id}`, { method: "PUT", body: JSON.stringify(cuerpo) });
      if (!res.ok) {
        avisar({ titulo: "No se pudo actualizar", mensaje: await mensajeError(res), tipo: "error" });
        return false;
      }
      const t: Ticket = await res.json();
      setDetalle(prev => (prev ? { ...prev, ...t } : t));
      avisar({ titulo: exito, mensaje: t.codigoTicket, tipo: "ok" });
      avisarCambio({ id: t.id, tipo: "c4", departamentoId: t.departamentoId ?? undefined });
      cargarTickets();
      return true;
    } catch {
      avisar({ titulo: "Sin conexión con la API", tipo: "error" });
      return false;
    } finally {
      setProcesando(false);
    }
  };

  const derivar = async () => {
    if (!deptoDestino) return;
    const d = departamentoInfo(Number(deptoDestino));
    await actualizar({ departamentoId: Number(deptoDestino) }, `Derivado a ${d?.nombre}`);
  };

  const confirmarModal = async () => {
    const motivo = textoModal.trim();
    let ok = false;
    if (modal === "DESCARTAR") ok = await actualizar({ nuevoEstado: "DESCARTADO", comentario: motivo }, "Reporte descartado");
    if (modal === "NOTA") ok = await actualizar({ notaInterna: true, comentario: motivo }, "Nota agregada");
    if (modal === "REABRIR") ok = await actualizar({ nuevoEstado: "EN_REVISION", operadorAsignadoId: null, comentario: motivo || "Reabierto por la central C4" }, "Reporte reabierto");
    if (ok) { setModal(null); setTextoModal(""); }
  };

  // --------------------------------------------------------------------------
  // FILTROS Y MÉTRICAS
  // --------------------------------------------------------------------------
  const filtrados = useMemo(() => {
    const q = normalizar(texto);
    const qTel = texto.replace(/\D/g, "");
    const lista = tickets.filter(t => {
      if (filtroEstado === "ACTIVOS" && !ESTADOS_ACTIVOS.includes(t.estado)) return false;
      if (filtroEstado !== "ACTIVOS" && filtroEstado !== "TODOS" && t.estado !== filtroEstado) return false;
      if (filtroPrioridad !== "TODAS" && prioridadDe(t) !== filtroPrioridad) return false;
      if (filtroCategoria !== "TODAS" && categoriaInfo(t.categoria?.nombre).nombre !== filtroCategoria) return false;
      if (filtroDepto === "SIN" && t.departamentoId) return false;
      if (typeof filtroDepto === "number" && t.departamentoId !== filtroDepto) return false;
      if (soloAtrasados && (!ESTADOS_ACTIVOS.includes(t.estado) || !slaDe(t, ahora).vencido)) return false;
      if (!q) return true;
      return normalizar(`${t.codigoTicket} ${t.categoria?.nombre} ${t.analisisIA} ${t.descripcionUsuario}`).includes(q) || (qTel.length >= 4 && (t.ciudadano?.telefono || "").includes(qTel));
    });
    return lista.sort((a, b) => {
      if (orden === "RECIENTES") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (orden === "ANTIGUOS") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      const pa = ESTADOS_ACTIVOS.includes(a.estado) ? 1 : 0, pb = ESTADOS_ACTIVOS.includes(b.estado) ? 1 : 0;
      return pb - pa || PRIORIDADES[prioridadDe(b)].peso - PRIORIDADES[prioridadDe(a)].peso || slaDe(a, ahora).restanteMs - slaDe(b, ahora).restanteMs;
    });
  }, [tickets, texto, filtroEstado, filtroPrioridad, filtroCategoria, filtroDepto, soloAtrasados, orden, ahora]);

  const metricas = useMemo(() => {
    const activos = tickets.filter(t => ESTADOS_ACTIVOS.includes(t.estado));
    const inicioDia = new Date(ahora); inicioDia.setHours(0, 0, 0, 0);
    return {
      pendientes: tickets.filter(t => t.estado === "PENDIENTE").length,
      revision: tickets.filter(t => t.estado === "EN_REVISION").length,
      terreno: tickets.filter(t => t.estado === "DESPACHADO").length,
      atrasados: activos.filter(t => slaDe(t, ahora).vencido).length,
      criticos: activos.filter(t => prioridadDe(t) === "CRITICA").length,
      hoy: tickets.filter(t => new Date(t.createdAt).getTime() >= inicioDia.getTime()).length,
      resueltosHoy: tickets.filter(t => t.estado === "RESUELTO" && new Date(t.updatedAt || 0).getTime() >= inicioDia.getTime()).length,
    };
  }, [tickets, ahora]);

  const hayFiltros = texto || filtroEstado !== "ACTIVOS" || filtroPrioridad !== "TODAS" || filtroCategoria !== "TODAS" || filtroDepto !== "TODOS" || soloAtrasados;
  const limpiarFiltros = () => { setTexto(""); setFiltroEstado("ACTIVOS"); setFiltroPrioridad("TODAS"); setFiltroCategoria("TODAS"); setFiltroDepto("TODOS"); setSoloAtrasados(false); };

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------
  if (errorPerfil) {
    return (
      <div className="fondo-rejilla" style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div className="modal marco" style={{ maxWidth: 420 }}>
          <div className="modal-cabecera"><h3 className="titulo-2">No se pudo validar tu acceso</h3></div>
          <div className="modal-cuerpo"><p style={{ margin: 0 }}>{errorPerfil}</p></div>
          <div className="modal-pie">
            <button className="btn btn-fantasma" onClick={() => signOut({ callbackUrl: "/login" })}>Cerrar sesión</button>
            <button className="btn btn-primario" onClick={() => location.reload()}>Reintentar</button>
          </div>
        </div>
      </div>
    );
  }
  if (!perfil) return <PantallaCarga />;

  const navegacion: { id: Vista; etiqueta: string; icono: React.ReactNode; contador?: number }[] = [
    { id: "OPERACIONES", etiqueta: "Operaciones", icono: <FiMap size={16} />, contador: metricas.pendientes },
    { id: "KANBAN", etiqueta: "Flujo de casos", icono: <FiColumns size={16} /> },
    { id: "ESTADISTICAS", etiqueta: "Estadísticas", icono: <FiBarChart2 size={16} /> },
    { id: "ADMINISTRACION", etiqueta: "Administración", icono: <FiSettings size={16} /> },
  ];
  const titulos: Record<Vista, [string, string]> = {
    OPERACIONES: ["Operaciones en tiempo real", "Mapa y bandeja de reportes de la comuna"],
    KANBAN: ["Flujo de casos", "Estado de todos los reportes, del ingreso al cierre"],
    ESTADISTICAS: ["Estadísticas e informes", "Indicadores de gestión, plazos y satisfacción"],
    ADMINISTRACION: ["Administración", "Personal, departamentos y vecinos"],
  };

  const recomendado = detalle ? categoriaInfo(detalle.categoria?.nombre).departamentoId : null;
  const cerrado = detalle && ["RESUELTO", "DESCARTADO"].includes(detalle.estado);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* =================== NAVEGACIÓN =================== */}
      <aside style={{ width: 236, background: "var(--marino)", color: "#fff", display: "flex", flexDirection: "column", flexShrink: 0, borderRight: "1px solid var(--marino-borde)" }}>
        <div style={{ padding: "18px 18px 16px", borderBottom: "1px solid var(--marino-borde)" }}>
          <Logo subtitulo="Central C4 | Buin" />
        </div>
        <nav style={{ padding: "12px 0", flex: 1 }}>
          <div className="rotulo" style={{ padding: "6px 18px 8px", color: "#5D6F92" }}>Centro de mando</div>
          {navegacion.map((n, i) => (
            <button key={n.id} className={`nav-item anim-izquierda${vista === n.id ? " activo" : ""}`} style={{ animationDelay: `${i * 50}ms` }} onClick={() => setVista(n.id)}>
              {n.icono}
              <span className="crece">{n.etiqueta}</span>
              {!!n.contador && <span className="mono" style={{ background: "var(--alerta)", color: "#fff", fontSize: 10.5, fontWeight: 600, padding: "1px 6px" }}>{n.contador}</span>}
            </button>
          ))}

          <div className="rotulo" style={{ padding: "22px 18px 8px", color: "#5D6F92" }}>Estado de la comuna</div>
          <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { e: "PENDIENTE" as Estado, n: metricas.pendientes },
              { e: "EN_REVISION" as Estado, n: metricas.revision },
              { e: "DESPACHADO" as Estado, n: metricas.terreno },
            ].map(x => {
              const max = Math.max(metricas.pendientes, metricas.revision, metricas.terreno, 1);
              return (
                <button key={x.e} onClick={() => { setVista("OPERACIONES"); setFiltroEstado(x.e); }} style={{ background: "none", border: 0, padding: 0, textAlign: "left", color: "inherit" }}>
                  <div className="fila entre" style={{ fontSize: 11.5, color: "var(--marino-texto)" }}>
                    <span>{ESTADOS[x.e].etiqueta}</span><span className="mono" style={{ color: "#fff", fontWeight: 600 }}>{x.n}</span>
                  </div>
                  <div style={{ height: 3, background: "var(--marino-3)", marginTop: 5 }}>
                    <div style={{ height: "100%", width: `${(x.n / max) * 100}%`, background: ESTADOS[x.e].color, transition: "width 0.8s var(--curva)" }} />
                  </div>
                </button>
              );
            })}
          </div>
        </nav>
        <div style={{ padding: 14, borderTop: "1px solid var(--marino-borde)", background: "var(--marino-2)" }}>
          <div className="fila entre">
            <div className="fila" style={{ gap: 10, minWidth: 0 }}>
              <span className="mono" style={{ width: 32, height: 32, background: "#7048E8", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 12, flexShrink: 0 }}>
                {perfil.nombre.split(/\s+/).map(p => p[0]).join("").slice(0, 2).toUpperCase()}
              </span>
              <div style={{ minWidth: 0 }}>
                <div className="truncar" style={{ fontWeight: 600, fontSize: 12.5 }}>{perfil.nombre}</div>
                <div className="rotulo" style={{ color: "var(--marino-texto)", fontSize: 9 }}>Operador C4</div>
              </div>
            </div>
            <button onClick={() => signOut({ callbackUrl: "/login" })} title="Cerrar sesión" style={{ background: "transparent", border: "1px solid var(--marino-borde)", color: "var(--marino-texto)", width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <FiLogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* =================== CONTENIDO =================== */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 60, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "0 20px", background: "var(--superficie)", borderBottom: "1px solid var(--borde)", position: "relative" }}>
          <div key={vista} className="anim-arriba" style={{ minWidth: 0 }}>
            <h1 className="titulo-2">{titulos[vista][0]}</h1>
            <div className="texto-3" style={{ fontSize: 11.5 }}>{titulos[vista][1]}</div>
          </div>
          <div className="fila" style={{ gap: 16 }}>
            <IndicadorConexion conectado={conectado} />
            <span className="mono texto-2 oculto-movil" style={{ fontSize: 12 }}>{new Date(ahora).toLocaleDateString("es-CL", { weekday: "short", day: "2-digit", month: "short" })} {new Date(ahora).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</span>
            <button className="btn-icono" onClick={() => setSonido(!sonido)} title={sonido ? "Silenciar alertas" : "Activar sonido de alertas"}>
              {sonido ? <FiVolume2 size={15} /> : <FiVolumeX size={15} />}
            </button>
          </div>
        </header>

        <div style={{ flex: 1, minHeight: 0, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {vista === "OPERACIONES" && (
            <>
              {/* KPIs operativos */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 10 }}>
                {[
                  { t: "Nuevos sin derivar", v: metricas.pendientes, c: ESTADOS.PENDIENTE.color, f: () => setFiltroEstado("PENDIENTE") },
                  { t: "En revisión", v: metricas.revision, c: ESTADOS.EN_REVISION.color, f: () => setFiltroEstado("EN_REVISION") },
                  { t: "En terreno", v: metricas.terreno, c: ESTADOS.DESPACHADO.color, f: () => setFiltroEstado("DESPACHADO") },
                  { t: "Fuera de plazo", v: metricas.atrasados, c: "var(--peligro)", f: () => { setFiltroEstado("ACTIVOS"); setSoloAtrasados(true); } },
                  { t: "Críticos activos", v: metricas.criticos, c: PRIORIDADES.CRITICA.color, f: () => { setFiltroEstado("ACTIVOS"); setFiltroPrioridad("CRITICA"); } },
                  { t: "Ingresados hoy", v: metricas.hoy, c: "var(--acento)", d: `${metricas.resueltosHoy} resueltos hoy`, f: () => { setFiltroEstado("TODOS"); setOrden("RECIENTES"); } },
                ].map((k, i) => (
                  <button key={k.t} onClick={k.f} style={{ padding: 0, border: 0, background: "none", textAlign: "left" }} title="Filtrar la bandeja">
                    <Kpi i={i} titulo={k.t} valor={k.v} color={k.c} detalle={k.d} />
                  </button>
                ))}
              </div>

              <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12 }}>
                {/* Mapa */}
                <div className="panel" style={{ flex: 1, minWidth: 0, position: "relative", overflow: "hidden" }}>
                  <Mapa
                    tickets={filtrados}
                    onSeleccionar={seleccionar}
                    seleccionadoId={seleccionadoId}
                    enfoque={detalle && detalle.latitud != null ? [detalle.latitud, detalle.longitud!] : null}
                    cercanos={cercanos}
                  />
                </div>

                {/* Bandeja / Expediente */}
                <div className="panel" style={{ width: 430, flexShrink: 0, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
                  {detalle ? (
                    <DetalleTicket
                      key={detalle.id}
                      ticket={detalle}
                      ahora={ahora}
                      onCerrar={cerrarDetalle}
                      cargando={cargandoDetalle}
                      cercanos={cercanos}
                      onVerCercano={seleccionar}
                      acciones={
                        <div className="columna" style={{ gap: 10 }}>
                          {!cerrado ? (
                            <>
                              <div>
                                <div className="fila entre" style={{ marginBottom: 6 }}>
                                  <span className="rotulo">Derivar a departamento</span>
                                  {recomendado && <span className="fila" style={{ gap: 4, fontSize: 10.5, color: "var(--acento)", fontWeight: 600 }}><FiCpu size={11} /> IA sugiere {departamentoInfo(recomendado)?.corto}</span>}
                                </div>
                                <div className="fila" style={{ gap: 6 }}>
                                  <select className="select" value={deptoDestino} onChange={e => setDeptoDestino(e.target.value ? Number(e.target.value) : "")} style={{ borderLeft: deptoDestino ? `4px solid ${departamentoInfo(Number(deptoDestino))?.color}` : undefined }}>
                                    <option value="">Seleccionar departamento</option>
                                    {DEPARTAMENTOS.map(d => <option key={d.id} value={d.id}>{d.nombre}{d.id === recomendado ? " (sugerido)" : ""}</option>)}
                                  </select>
                                  <button className="btn btn-primario" onClick={derivar} disabled={procesando || !deptoDestino || (deptoDestino === detalle.departamentoId && detalle.estado !== "PENDIENTE")}>
                                    <FiSend size={13} /> {detalle.estado === "PENDIENTE" ? "Derivar" : "Cambiar"}
                                  </button>
                                </div>
                              </div>
                              <div>
                                <span className="rotulo">Prioridad {detalle.prioridadFinal ? "(ajustada)" : "(sugerida por IA)"}</span>
                                <div className="segmentos" style={{ display: "flex", marginTop: 6 }}>
                                  {ORDEN_PRIORIDADES.map(p => (
                                    <button key={p} className={`segmento${prioridadDe(detalle) === p ? " activo" : ""}`} style={{ flex: 1, ...(prioridadDe(detalle) === p ? { background: PRIORIDADES[p].color } : {}) }}
                                      disabled={procesando} onClick={() => prioridadDe(detalle) !== p && actualizar({ prioridadFinal: p }, `Prioridad: ${PRIORIDADES[p].etiqueta}`)}>
                                      {PRIORIDADES[p].etiqueta}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="fila" style={{ gap: 6 }}>
                                <button className="btn btn-secundario btn-sm crece" onClick={() => { setTextoModal(""); setModal("NOTA"); }}><FiEdit3 size={12} /> Nota interna</button>
                                <button className="btn btn-peligro-borde btn-sm crece" onClick={() => { setTextoModal(""); setModal("DESCARTAR"); }}><FiSlash size={12} /> Descartar</button>
                              </div>
                            </>
                          ) : (
                            <div className="fila" style={{ gap: 6 }}>
                              <button className="btn btn-secundario btn-sm crece" onClick={() => { setTextoModal(""); setModal("NOTA"); }}><FiEdit3 size={12} /> Nota interna</button>
                              <button className="btn btn-oscuro btn-sm crece" onClick={() => { setTextoModal(""); setModal("REABRIR"); }}><FiRotateCcw size={12} /> Reabrir caso</button>
                            </div>
                          )}
                        </div>
                      }
                    />
                  ) : (
                    <>
                      <div style={{ padding: 12, borderBottom: "1px solid var(--borde)", display: "flex", flexDirection: "column", gap: 8 }}>
                        <div className="fila entre">
                          <span className="titulo-3">Bandeja de reportes</span>
                          <span className="mono texto-3" style={{ fontSize: 11 }}>{filtrados.length} de {tickets.length}</span>
                        </div>
                        <div className="input-con-icono">
                          <FiSearch size={14} />
                          <input ref={busquedaRef} className="input" placeholder="Código, teléfono o texto  ( / )" value={texto} onChange={e => setTexto(e.target.value)} />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                          <select className="select" style={{ height: 32 }} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as any)}>
                            <option value="ACTIVOS">Activos</option>
                            <option value="TODOS">Todos los estados</option>
                            {ORDEN_ESTADOS.map(e => <option key={e} value={e}>{ESTADOS[e].etiqueta}</option>)}
                          </select>
                          <select className="select" style={{ height: 32 }} value={filtroPrioridad} onChange={e => setFiltroPrioridad(e.target.value as any)}>
                            <option value="TODAS">Toda prioridad</option>
                            {ORDEN_PRIORIDADES.map(p => <option key={p} value={p}>{PRIORIDADES[p].etiqueta}</option>)}
                          </select>
                          <select className="select" style={{ height: 32 }} value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
                            <option value="TODAS">Toda categoría</option>
                            {CATEGORIAS.map(c => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}
                          </select>
                          <select className="select" style={{ height: 32 }} value={String(filtroDepto)} onChange={e => setFiltroDepto(e.target.value === "TODOS" || e.target.value === "SIN" ? (e.target.value as any) : Number(e.target.value))}>
                            <option value="TODOS">Todo departamento</option>
                            <option value="SIN">Sin departamento</option>
                            {DEPARTAMENTOS.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                          </select>
                        </div>
                        <div className="fila entre">
                          <div className="segmentos">
                            {([["URGENCIA", "Urgencia"], ["RECIENTES", "Recientes"], ["ANTIGUOS", "Antiguos"]] as const).map(([id, et]) => (
                              <button key={id} className={`segmento${orden === id ? " activo" : ""}`} style={{ height: 26, fontSize: 10.5 }} onClick={() => setOrden(id)}>{et}</button>
                            ))}
                          </div>
                          {hayFiltros ? <button className="btn btn-fantasma btn-sm" style={{ height: 26 }} onClick={limpiarFiltros}>Limpiar filtros</button>
                            : soloAtrasados ? null : <span className="texto-3" style={{ fontSize: 11 }}>Ordenado por {orden.toLowerCase()}</span>}
                        </div>
                        {soloAtrasados && <div className="fila" style={{ fontSize: 11, color: "var(--peligro)", gap: 6 }}><FiAlertTriangle size={12} /> Mostrando solo casos fuera de plazo</div>}
                      </div>

                      <div className="desplazable" style={{ flex: 1, padding: 10, display: "flex", flexDirection: "column", gap: 6, background: "var(--superficie-2)" }}>
                        {cargando ? <Esqueleto alto={92} filas={6} /> : filtrados.length === 0 ? (
                          <Vacio icono={<FiInbox size={22} />} titulo={tickets.length ? "Sin coincidencias" : "Sin reportes"} texto={tickets.length ? "Ajusta o limpia los filtros." : "Los reportes de WhatsApp aparecerán aquí al instante."}>
                            {hayFiltros && <button className="btn btn-secundario btn-sm" onClick={limpiarFiltros}>Limpiar filtros</button>}
                          </Vacio>
                        ) : filtrados.slice(0, 150).map((t, i) => {
                          const cat = categoriaInfo(t.categoria?.nombre);
                          const d = departamentoInfo(t.departamentoId);
                          const p = PRIORIDADES[prioridadDe(t)];
                          return (
                            <button key={t.id} onClick={() => seleccionar(t.id)}
                              className={`item-lista anim-arriba${nuevos.has(t.id) ? " anim-destello" : ""}`}
                              style={{ ["--color-item" as any]: cat.color, ["--i" as any]: Math.min(i, 14) }}>
                              <div className="fila entre">
                                <span className="fila" style={{ gap: 8 }}>
                                  <span className="mono" style={{ fontWeight: 600, fontSize: 12.5 }}>{t.codigoTicket}</span>
                                  {nuevos.has(t.id) && <span className="insignia insignia-solida" style={{ background: "var(--acento)", height: 18, fontSize: 9 }}>Nuevo</span>}
                                </span>
                                <span className="mono texto-3" style={{ fontSize: 10.5 }}>{tiempoRelativo(t.createdAt, ahora)}</span>
                              </div>
                              <div className="fila" style={{ gap: 6, marginTop: 6 }}>
                                <span style={{ color: cat.color, display: "inline-flex" }}><Icono nombre={cat.icono} size={14} /></span>
                                <span style={{ fontWeight: 600, fontSize: 12.5 }} className="truncar">{cat.nombre}</span>
                                <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: p.color }}>{p.etiqueta}</span>
                              </div>
                              <div className="dos-lineas texto-2" style={{ fontSize: 11.5, marginTop: 4 }}>{t.analisisIA || resumenDescripcion(t.descripcionUsuario)}</div>
                              <div className="fila entre" style={{ marginTop: 8, gap: 8 }}>
                                <span className="fila" style={{ gap: 6, minWidth: 0 }}>
                                  <InsigniaEstado estado={t.estado} />
                                  {d && <span className="truncar texto-3" style={{ fontSize: 10.5 }}><span className="punto" style={{ background: d.color, marginRight: 4 }} />{d.corto}</span>}
                                </span>
                                {ESTADOS_ACTIVOS.includes(t.estado) ? <IndicadorSla ticket={t} ahora={ahora} /> : <span className="mono texto-3" style={{ fontSize: 10.5 }}>{formatearTelefono(t.ciudadano?.telefono)}</span>}
                              </div>
                            </button>
                          );
                        })}
                        {filtrados.length > 150 && <div className="texto-3" style={{ textAlign: "center", fontSize: 11, padding: 8 }}>Mostrando 150 de {filtrados.length}. Usa los filtros para acotar.</div>}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {vista === "KANBAN" && (
            <div className="panel anim-aparecer" style={{ flex: 1, minHeight: 0, padding: 14 }}>
              <Kanban tickets={tickets} ahora={ahora} onSeleccionar={id => { setVista("OPERACIONES"); seleccionar(id); }} />
            </div>
          )}

          {vista === "ESTADISTICAS" && (
            <div className="anim-aparecer" style={{ flex: 1, minHeight: 0 }}>
              <Estadisticas tickets={tickets} ahora={ahora} />
            </div>
          )}

          {vista === "ADMINISTRACION" && (
            <div className="anim-aparecer" style={{ flex: 1, minHeight: 0 }}>
              <AdminPanel tickets={tickets} ahora={ahora} miId={perfil.id} />
            </div>
          )}
        </div>
      </main>

      {/* =================== MODALES =================== */}
      <Modal
        abierto={!!modal}
        onCerrar={() => setModal(null)}
        titulo={modal === "DESCARTAR" ? "Descartar reporte" : modal === "NOTA" ? "Agregar nota interna" : "Reabrir caso"}
        subtitulo={detalle?.codigoTicket}
        pie={
          <>
            <button className="btn btn-fantasma" onClick={() => setModal(null)}>Cancelar</button>
            <button className={`btn ${modal === "DESCARTAR" ? "btn-peligro" : "btn-primario"}`} onClick={confirmarModal}
              disabled={procesando || (modal !== "REABRIR" && textoModal.trim().length < 5)}>
              {modal === "DESCARTAR" ? "Descartar y avisar al vecino" : modal === "NOTA" ? "Guardar nota" : "Reabrir"}
            </button>
          </>
        }
      >
        {modal === "DESCARTAR" && (
          <>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--texto-2)" }}>El vecino recibirá el motivo por WhatsApp. Elige uno o escríbelo.</p>
            <div className="columna" style={{ gap: 4 }}>
              {MOTIVOS_DESCARTE.map(m => (
                <button key={m} className="item-lista" onClick={() => setTextoModal(m)} style={{ padding: "8px 12px 8px 16px", ["--color-item" as any]: textoModal === m ? "var(--peligro)" : "var(--borde)", borderColor: textoModal === m ? "var(--peligro)" : undefined, fontSize: 12.5 }}>{m}</button>
              ))}
            </div>
          </>
        )}
        {modal === "NOTA" && <p style={{ margin: 0, fontSize: 12.5, color: "var(--texto-2)" }}>Queda en la trazabilidad del caso. El vecino no la ve.</p>}
        {modal === "REABRIR" && <p style={{ margin: 0, fontSize: 12.5, color: "var(--texto-2)" }}>El caso vuelve a revisión en su departamento, sin funcionario asignado, y se avisa al vecino.</p>}
        <textarea className="textarea" autoFocus value={textoModal} onChange={e => setTextoModal(e.target.value)} maxLength={500}
          placeholder={modal === "DESCARTAR" ? "Motivo del descarte" : modal === "NOTA" ? "Escribe la nota" : "Motivo (opcional)"} />
        <div className="texto-3 mono" style={{ fontSize: 10.5, textAlign: "right", marginTop: -8 }}>{textoModal.length}/500</div>
      </Modal>
    </div>
  );
}
