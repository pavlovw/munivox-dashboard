"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { signOut } from "next-auth/react";
import { FiBell, FiLogOut, FiSearch, FiUserCheck, FiCheck, FiNavigation, FiEdit3, FiSlash, FiInbox, FiUsers, FiX, FiAlertTriangle, FiStar } from "react-icons/fi";

import DetalleTicket from "../../components/DetalleTicket";
import MensajeVecino from "../../components/MensajeVecino";
import { Logo, PantallaCarga, IndicadorConexion, InsigniaEstado, IndicadorSla, Esqueleto, Vacio, Modal, Kpi } from "../../components/ui/Comunes";
import { Icono } from "../../components/ui/Iconos";
import { useAvisos } from "../../components/ui/Avisos";
import { useApi, mensajeError } from "../../lib/useApi";
import { usePerfil } from "../../lib/usePerfil";
import { useFavicon, colorIcono, claveIcono } from "../../lib/favicon";
import { useTiempoReal, useRefresco, useAgrupado } from "../../lib/useTiempoReal";
import { useAhora, usePreferencia, sonarAlerta } from "../../lib/hooks";
import { distanciaKm } from "../../lib/geo";
import type { Ticket, Operador } from "../../lib/tipos";
import {
  DEPARTAMENTOS, PRIORIDADES, ESTADOS_ACTIVOS, categoriaInfo, departamentoInfo, prioridadDe, slaDe, tiempoRelativo,
  normalizar, resumenDescripcion, esRechazo, esCalificacion, horaCorta,
} from "../../lib/constantes";

const Mapa = dynamic(() => import("../../components/Map"), {
  ssr: false,
  loading: () => <div className="esqueleto" style={{ width: "100%", height: "100%" }} />,
});

type Pestana = "POR_ASIGNAR" | "POR_CONFIRMAR" | "EN_TERRENO" | "CERRADOS";

const MOTIVOS_DESCARTE = ["Duplicado de otro reporte", "Ya estaba solucionado al llegar", "No corresponde a este departamento", "Información insuficiente para atender"];

export default function ConsolaDepartamento() {
  const { perfil, error: errorPerfil } = usePerfil(["OPERADOR", "ADMINISTRADOR"]);
  const api = useApi();
  const avisar = useAvisos();
  const ahora = useAhora(30000);

  const [deptoAdmin, setDeptoAdmin] = useState(1);
  const deptoId = perfil?.rol === "ADMINISTRADOR" ? deptoAdmin : perfil?.departamentoId ?? null;
  const depto = departamentoInfo(deptoId ?? undefined);
  useFavicon(perfil && deptoId ? colorIcono("OPERADOR", deptoId) : null, perfil && deptoId ? claveIcono("OPERADOR", deptoId) : null);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [funcionarios, setFuncionarios] = useState<Operador[]>([]);
  const [cargando, setCargando] = useState(true);
  const [pestana, setPestana] = useState<Pestana>("POR_ASIGNAR");
  const [texto, setTexto] = useState("");
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<Ticket | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [resaltado, setResaltado] = useState<string | null>(null);
  const [mostrarPersonal, setMostrarPersonal] = useState(true);
  const [panelAlertas, setPanelAlertas] = useState(false);
  const [alertasVistas, setAlertasVistas] = usePreferencia<string[]>("munivox_alertas_vistas", []);
  const [modal, setModal] = useState<null | "DESCARTAR" | "NOTA">(null);
  const [mensajeAbierto, setMensajeAbierto] = useState(false);
  const [textoModal, setTextoModal] = useState("");
  const seleccionRef = useRef<string | null>(null);
  const conocidos = useRef<Set<string> | null>(null);

  // --------------------------------------------------------------------------
  // DATOS
  // --------------------------------------------------------------------------
  const cargar = useCallback(async () => {
    if (!deptoId) return;
    try {
      const [rt, rf] = await Promise.all([
        api(`/tickets?departamentoId=${deptoId}`),
        api(`/operadores?departamentoId=${deptoId}&rol=TERRENO`),
      ]);
      if (rt.ok) {
        const data: Ticket[] = await rt.json();
        setTickets(prev => (JSON.stringify(prev) === JSON.stringify(data) ? prev : data));
      }
      if (rf.ok) {
        const data: Operador[] = await rf.json();
        setFuncionarios(prev => (JSON.stringify(prev) === JSON.stringify(data) ? prev : data));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  }, [api, deptoId]);

  const cargarDetalle = useCallback(async (id: string) => {
    setCargandoDetalle(true);
    try {
      const res = await api(`/tickets/${id}`);
      if (res.ok && seleccionRef.current === id) setDetalle(await res.json());
    } finally {
      setCargandoDetalle(false);
    }
  }, [api]);

  const recargar = useAgrupado(() => {
    cargar();
    if (seleccionRef.current) cargarDetalle(seleccionRef.current);
  }, 350);

  // Al cambiar de departamento (solo la central puede) se parte de cero
  useEffect(() => {
    if (!deptoId) return;
    setCargando(true); setTickets([]); setDetalle(null); setSeleccionadoId(null);
    conocidos.current = null;
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deptoId, !!perfil]);

  const { conectado, avisarCambio } = useTiempoReal({
    activo: !!perfil,
    onTicketCambio: e => { if (!e.departamentoId || e.departamentoId === deptoId) recargar(); },
    onOperadoresCambio: e => { if (!e.departamentoId || e.departamentoId === deptoId) recargar(); },
  });
  useRefresco(cargar, conectado, !!perfil);

  // Aviso cuando llega un caso nuevo al departamento
  useEffect(() => {
    if (cargando) return;
    const ids = new Set(tickets.map(t => t.id));
    if (conocidos.current) {
      const nuevos = tickets.filter(t => !conocidos.current!.has(t.id) && ESTADOS_ACTIVOS.includes(t.estado));
      if (nuevos.length) {
        sonarAlerta("nuevo");
        avisar({
          titulo: nuevos.length === 1 ? `Nuevo caso ${nuevos[0].codigoTicket}` : `${nuevos.length} casos nuevos`,
          mensaje: nuevos.length === 1 ? nuevos[0].categoria?.nombre || undefined : "Revisa la bandeja Por asignar",
          tipo: "nuevo",
          accion: nuevos.length === 1 ? { etiqueta: "Abrir", onClick: () => seleccionar(nuevos[0].id) } : undefined,
        });
      }
    }
    conocidos.current = ids;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets, cargando]);

  // --------------------------------------------------------------------------
  // CLASIFICACIÓN DE LA BANDEJA
  // --------------------------------------------------------------------------
  const grupos = useMemo(() => {
    const g: Record<Pestana, Ticket[]> = { POR_ASIGNAR: [], POR_CONFIRMAR: [], EN_TERRENO: [], CERRADOS: [] };
    tickets.forEach(t => {
      if (t.estado === "DESPACHADO") g.EN_TERRENO.push(t);
      else if (["PENDIENTE", "EN_REVISION"].includes(t.estado)) (t.operadorAsignadoId ? g.POR_CONFIRMAR : g.POR_ASIGNAR).push(t);
      else if (ahora - new Date(t.updatedAt || t.createdAt).getTime() < 7 * 86400000) g.CERRADOS.push(t);
    });
    const urgencia = (a: Ticket, b: Ticket) => PRIORIDADES[prioridadDe(b)].peso - PRIORIDADES[prioridadDe(a)].peso || slaDe(a, ahora).restanteMs - slaDe(b, ahora).restanteMs;
    g.POR_ASIGNAR.sort(urgencia); g.POR_CONFIRMAR.sort(urgencia); g.EN_TERRENO.sort(urgencia);
    g.CERRADOS.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
    return g;
  }, [tickets, ahora]);

  const lista = useMemo(() => {
    const q = normalizar(texto);
    return grupos[pestana].filter(t => !q || normalizar(`${t.codigoTicket} ${t.categoria?.nombre} ${t.analisisIA} ${t.descripcionUsuario} ${t.operadorAsignado?.nombre}`).includes(q));
  }, [grupos, pestana, texto]);

  const alertas = useMemo(() => {
    const a: { id: string; ticketId: string; codigo: string; tipo: "rechazo" | "reclamo"; texto: string; quien?: string; fecha: string }[] = [];
    tickets.forEach(t => (t.historial || []).forEach(h => {
      if (esRechazo(h)) a.push({ id: h.id, ticketId: t.id, codigo: t.codigoTicket, tipo: "rechazo", texto: String(h.comentario).replace(/^Rechazado por funcionario:\s*/, ""), quien: h.operador?.nombre, fecha: h.createdAt });
      if (esCalificacion(h) && /1\/5/.test(String(h.comentario))) a.push({ id: h.id, ticketId: t.id, codigo: t.codigoTicket, tipo: "reclamo", texto: "El vecino indica que el problema no se resolvió", fecha: h.createdAt });
    }));
    return a.filter(x => ahora - new Date(x.fecha).getTime() < 7 * 86400000).sort((x, y) => new Date(y.fecha).getTime() - new Date(x.fecha).getTime());
  }, [tickets, ahora]);
  const alertasNuevas = alertas.filter(a => !alertasVistas.includes(a.id)).length;

  // --------------------------------------------------------------------------
  // ACCIONES
  // --------------------------------------------------------------------------
  const seleccionar = useCallback((id: string) => {
    setSeleccionadoId(id);
    seleccionRef.current = id;
    setDetalle(tickets.find(t => t.id === id) || null);
    cargarDetalle(id);
  }, [tickets, cargarDetalle]);

  const cerrarDetalle = () => { seleccionRef.current = null; setSeleccionadoId(null); setDetalle(null); setResaltado(null); };

  const actualizar = async (cuerpo: Record<string, unknown>, exito: string, clave = "general") => {
    if (!detalle) return false;
    setProcesando(clave);
    try {
      const res = await api(`/tickets/${detalle.id}`, { method: "PUT", body: JSON.stringify(cuerpo) });
      if (!res.ok) {
        avisar({ titulo: "No se pudo actualizar", mensaje: await mensajeError(res), tipo: "error" });
        return false;
      }
      const t: Ticket = await res.json();
      setDetalle(t);
      avisar({ titulo: exito, mensaje: t.codigoTicket, tipo: "ok" });
      avisarCambio({ id: t.id, tipo: "departamento", departamentoId: t.departamentoId ?? undefined, operadorAsignadoId: t.operadorAsignadoId ?? undefined });
      cargar();
      return true;
    } finally {
      setProcesando(null);
    }
  };

  const asignar = async (f: Operador) => {
    const ok = await actualizar({ nuevoEstado: "EN_REVISION", operadorAsignadoId: f.id }, `Asignado a ${f.nombre}`, f.id);
    if (ok) { setResaltado(null); setPestana("POR_CONFIRMAR"); }
  };

  const confirmarModal = async () => {
    const motivo = textoModal.trim();
    const ok = modal === "DESCARTAR"
      ? await actualizar({ nuevoEstado: "DESCARTADO", comentario: motivo }, "Reporte descartado")
      : await actualizar({ notaInterna: true, comentario: motivo }, "Nota agregada");
    if (ok) { setModal(null); setTextoModal(""); }
  };

  const funcionariosOrdenados = useMemo(() => {
    const t = detalle;
    return funcionarios.map(f => {
      const km = t?.latitud != null && f.latitud != null ? distanciaKm(t.latitud, t.longitud!, f.latitud, f.longitud!) : null;
      const rechazo = t?.historial?.find(h => esRechazo(h) && h.operadorId === f.id);
      return { f, km, rechazo };
    }).sort((a, b) => Number(b.f.gpsActivo) - Number(a.f.gpsActivo) || (a.km ?? 999) - (b.km ?? 999));
  }, [funcionarios, detalle]);

  const lineaDespacho = useMemo(() => {
    if (!detalle || detalle.latitud == null) return null;
    const f = funcionarios.find(x => x.id === (resaltado || (detalle.estado === "DESPACHADO" ? detalle.operadorAsignadoId : null)));
    if (!f || f.latitud == null) return null;
    return { desde: [f.latitud, f.longitud!] as [number, number], hasta: [detalle.latitud, detalle.longitud!] as [number, number] };
  }, [detalle, funcionarios, resaltado]);

  const metricas = useMemo(() => {
    const inicio = new Date(ahora); inicio.setHours(0, 0, 0, 0);
    const activos = tickets.filter(t => ESTADOS_ACTIVOS.includes(t.estado));
    return {
      atrasados: activos.filter(t => slaDe(t, ahora).vencido).length,
      resueltosHoy: tickets.filter(t => t.estado === "RESUELTO" && new Date(t.updatedAt || 0).getTime() >= inicio.getTime()).length,
      gps: funcionarios.filter(f => f.gpsActivo).length,
    };
  }, [tickets, funcionarios, ahora]);

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------
  if (errorPerfil) return <PantallaCarga texto={errorPerfil} />;
  if (!perfil) return <PantallaCarga />;
  if (!deptoId || !depto) {
    return (
      <div className="fondo-rejilla" style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div className="modal marco"><div className="modal-cabecera"><h3 className="titulo-2">Sin departamento asignado</h3></div>
          <div className="modal-cuerpo"><p style={{ margin: 0 }}>Tu cuenta no tiene un departamento. Pide a la central C4 que te lo asigne desde Administración.</p></div>
          <div className="modal-pie"><button className="btn btn-primario" onClick={() => signOut({ callbackUrl: "/login" })}>Cerrar sesión</button></div>
        </div>
      </div>
    );
  }

  const pestanas: { id: Pestana; etiqueta: string }[] = [
    { id: "POR_ASIGNAR", etiqueta: "Por asignar" },
    { id: "POR_CONFIRMAR", etiqueta: "Por confirmar" },
    { id: "EN_TERRENO", etiqueta: "En terreno" },
    { id: "CERRADOS", etiqueta: "Cerrados 7 d" },
  ];
  const ticketsMapa = pestana === "CERRADOS" ? grupos.CERRADOS : tickets.filter(t => ESTADOS_ACTIVOS.includes(t.estado));
  const cerrado = detalle && ["RESUELTO", "DESCARTADO"].includes(detalle.estado);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* =================== CABECERA =================== */}
      <header style={{ height: 58, flexShrink: 0, background: "var(--marino)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", borderBottom: `3px solid ${depto.color}` }}>
        <div className="fila" style={{ gap: 18 }}>
          <Logo tamano={28} />
          <span style={{ width: 1, height: 28, background: "var(--marino-borde)" }} />
          <div className="anim-izquierda">
            <div className="rotulo" style={{ color: "var(--marino-texto)", fontSize: 9 }}>Centro de despacho</div>
            {perfil.rol === "ADMINISTRADOR" ? (
              <select value={deptoAdmin} onChange={e => setDeptoAdmin(Number(e.target.value))} style={{ background: "transparent", border: 0, color: "#fff", fontWeight: 700, fontSize: 15, padding: 0 }}>
                {DEPARTAMENTOS.map(d => <option key={d.id} value={d.id} style={{ color: "#000" }}>{d.nombre} (supervisión)</option>)}
              </select>
            ) : <div style={{ fontWeight: 700, fontSize: 15 }}>{depto.nombre}</div>}
          </div>
        </div>
        <div className="fila" style={{ gap: 14 }}>
          <IndicadorConexion conectado={conectado} claro />
          <div style={{ position: "relative" }}>
            <button onClick={() => { setPanelAlertas(!panelAlertas); }} title="Alertas" style={{ position: "relative", width: 34, height: 34, background: panelAlertas ? "var(--marino-3)" : "transparent", border: "1px solid var(--marino-borde)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <FiBell size={15} style={{ animation: alertasNuevas ? "sacudir 0.6s ease 2" : undefined }} />
              {alertasNuevas > 0 && <span className="mono" style={{ position: "absolute", top: -6, right: -6, background: "var(--peligro)", color: "#fff", fontSize: 10, fontWeight: 600, minWidth: 18, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{alertasNuevas}</span>}
            </button>
            {panelAlertas && (
              <div className="anim-escalar" style={{ position: "absolute", right: 0, top: 42, width: 360, maxHeight: 420, overflow: "auto", background: "var(--superficie)", color: "var(--texto)", border: "1px solid var(--borde)", boxShadow: "var(--sombra-3)", zIndex: 40 }}>
                <div className="fila entre" style={{ padding: "10px 12px", borderBottom: "1px solid var(--borde)" }}>
                  <span className="titulo-3">Alertas de los últimos 7 días</span>
                  <div className="fila" style={{ gap: 4 }}>
                    {alertasNuevas > 0 && <button className="btn btn-fantasma btn-sm" onClick={() => setAlertasVistas(alertas.map(a => a.id))}>Marcar leídas</button>}
                    <button className="btn-icono" style={{ width: 28, height: 28 }} onClick={() => setPanelAlertas(false)}><FiX size={14} /></button>
                  </div>
                </div>
                {alertas.length === 0 ? <div style={{ padding: 16 }} className="texto-3">Sin rechazos ni reclamos recientes.</div> : alertas.map((a, i) => (
                  <button key={a.id} className="anim-arriba" onClick={() => { seleccionar(a.ticketId); setPanelAlertas(false); setAlertasVistas([...new Set([...alertasVistas, a.id])]); }}
                    style={{ ["--i" as any]: i, display: "block", width: "100%", textAlign: "left", padding: "10px 12px", border: 0, borderBottom: "1px solid var(--borde)", borderLeft: `3px solid ${a.tipo === "rechazo" ? "var(--peligro)" : "#C08A00"}`, background: alertasVistas.includes(a.id) ? "var(--superficie)" : "var(--peligro-suave)" }}>
                    <div className="fila entre">
                      <span className="fila" style={{ gap: 6, fontWeight: 600, fontSize: 12 }}>{a.tipo === "rechazo" ? <FiAlertTriangle size={12} color="var(--peligro)" /> : <FiStar size={12} color="#C08A00" />}{a.tipo === "rechazo" ? "Tarea rechazada" : "Reclamo del vecino"}</span>
                      <span className="mono texto-3" style={{ fontSize: 10.5 }}>{tiempoRelativo(a.fecha, ahora)}</span>
                    </div>
                    <div className="mono" style={{ fontSize: 11.5, marginTop: 2 }}>{a.codigo}{a.quien ? ` | ${a.quien}` : ""}</div>
                    <div className="texto-2" style={{ fontSize: 12, marginTop: 2 }}>{a.texto}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <span style={{ width: 1, height: 28, background: "var(--marino-borde)" }} />
          <div className="oculto-movil" style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 600, fontSize: 12.5 }}>{perfil.nombre}</div>
            <div className="rotulo" style={{ color: "var(--marino-texto)", fontSize: 9 }}>{perfil.rol === "ADMINISTRADOR" ? "Central C4" : "Jefatura"}</div>
          </div>
          <button onClick={() => signOut({ callbackUrl: "/login" })} title="Cerrar sesión" style={{ width: 34, height: 34, background: "transparent", border: "1px solid var(--marino-borde)", color: "var(--marino-texto)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <FiLogOut size={14} />
          </button>
        </div>
      </header>

      <div style={{ flex: 1, minHeight: 0, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 10 }}>
          {[
            { t: "Por asignar", v: grupos.POR_ASIGNAR.length, c: "var(--alerta)", p: "POR_ASIGNAR" as Pestana },
            { t: "Esperando confirmación", v: grupos.POR_CONFIRMAR.length, c: "var(--acento)", p: "POR_CONFIRMAR" as Pestana },
            { t: "En terreno", v: grupos.EN_TERRENO.length, c: "#7048E8", p: "EN_TERRENO" as Pestana },
            { t: "Fuera de plazo", v: metricas.atrasados, c: "var(--peligro)" },
            { t: "Resueltos hoy", v: metricas.resueltosHoy, c: "var(--ok)", p: "CERRADOS" as Pestana },
            { t: "Funcionarios con GPS", v: metricas.gps, c: "var(--ok)", d: `de ${funcionarios.length} en el equipo` },
          ].map((k, i) => (
            <button key={k.t} onClick={() => k.p && (setPestana(k.p), cerrarDetalle())} style={{ padding: 0, border: 0, background: "none", textAlign: "left" }}>
              <Kpi i={i} titulo={k.t} valor={k.v} color={k.c} detalle={k.d} />
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12 }}>
          {/* =================== BANDEJA / DETALLE =================== */}
          <div className="panel" style={{ width: 450, flexShrink: 0, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
            {detalle ? (
              <DetalleTicket
                key={detalle.id}
                ticket={detalle}
                ahora={ahora}
                onCerrar={cerrarDetalle}
                cargando={cargandoDetalle}
                onMensaje={() => setMensajeAbierto(true)}
                acciones={
                  cerrado ? (
                    <button className="btn btn-secundario btn-sm btn-bloque" onClick={() => { setTextoModal(""); setModal("NOTA"); }}><FiEdit3 size={12} /> Nota interna</button>
                  ) : (
                    <div className="columna" style={{ gap: 10 }}>
                      <div className="fila entre">
                        <span className="rotulo fila" style={{ gap: 6 }}><FiUsers size={12} /> {detalle.operadorAsignadoId ? "Reasignar funcionario" : "Asignar funcionario"}</span>
                        <span className="texto-3" style={{ fontSize: 10.5 }}>Ordenados por GPS y distancia</span>
                      </div>
                      <div className="desplazable columna" style={{ gap: 4, maxHeight: 230 }}>
                        {funcionariosOrdenados.length === 0 && <div className="vacio" style={{ padding: 14 }}>No hay funcionarios de terreno en {depto.nombre}.</div>}
                        {funcionariosOrdenados.map(({ f, km, rechazo }, i) => {
                          const asignado = detalle.operadorAsignadoId === f.id;
                          const carga = f._count?.ticketsAsignados ?? 0;
                          return (
                            <div key={f.id} className="anim-arriba" onMouseEnter={() => setResaltado(f.id)} onMouseLeave={() => setResaltado(null)}
                              style={{ ["--i" as any]: i, display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: `1px solid ${asignado ? "var(--ok)" : resaltado === f.id ? "var(--acento)" : "var(--borde)"}`, background: asignado ? "var(--ok-suave)" : "var(--superficie)", transition: "border-color 0.15s" }}>
                              <span className="mono" style={{ width: 30, height: 30, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: f.gpsActivo ? "var(--ok)" : "var(--superficie-3)", color: f.gpsActivo ? "#fff" : "var(--texto-2)", fontSize: 11, fontWeight: 600 }}>
                                {f.nombre.split(/\s+/).map(p => p[0]).join("").slice(0, 2).toUpperCase()}
                              </span>
                              <div className="crece">
                                <div className="truncar" style={{ fontWeight: 600, fontSize: 12.5 }}>{f.nombre}</div>
                                {rechazo ? (
                                  <div className="truncar" style={{ fontSize: 11, color: "var(--peligro)", fontWeight: 600 }}>Rechazó: {String(rechazo.comentario).replace(/^Rechazado por funcionario:\s*/, "")}</div>
                                ) : (
                                  <div className="fila texto-3" style={{ fontSize: 11, gap: 8 }}>
                                    <span style={{ color: f.gpsActivo ? "var(--ok)" : undefined, fontWeight: 600 }}>{f.gpsActivo ? "GPS activo" : "GPS apagado"}</span>
                                    <span className="mono">{km != null ? `${km.toFixed(1)} km` : "--"}</span>
                                    <span>{carga} tarea{carga === 1 ? "" : "s"}</span>
                                  </div>
                                )}
                              </div>
                              <button className={`btn btn-sm ${asignado ? "btn-ok" : "btn-primario"}`} disabled={!!procesando || asignado} onClick={() => asignar(f)}>
                                {procesando === f.id ? <span className="girador" style={{ width: 12, height: 12 }} /> : asignado ? <FiCheck size={12} /> : <FiUserCheck size={12} />}
                                {asignado ? "Asignado" : rechazo ? "Reintentar" : "Asignar"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      <div className="fila" style={{ gap: 6 }}>
                        <button className="btn btn-secundario btn-sm crece" onClick={() => { setTextoModal(""); setModal("NOTA"); }}><FiEdit3 size={12} /> Nota interna</button>
                        <button className="btn btn-peligro-borde btn-sm crece" onClick={() => { setTextoModal(""); setModal("DESCARTAR"); }}><FiSlash size={12} /> Descartar</button>
                      </div>
                    </div>
                  )
                }
              />
            ) : (
              <>
                <div className="pestanas" style={{ padding: "0 8px" }}>
                  {pestanas.map(p => (
                    <button key={p.id} className={`pestana${pestana === p.id ? " activa" : ""}`} onClick={() => setPestana(p.id)}>
                      {p.etiqueta}<span className="contador">{grupos[p.id].length}</span>
                    </button>
                  ))}
                </div>
                <div style={{ padding: 10, borderBottom: "1px solid var(--borde)" }}>
                  <div className="input-con-icono">
                    <FiSearch size={14} />
                    <input className="input" placeholder="Buscar código, texto o funcionario" value={texto} onChange={e => setTexto(e.target.value)} />
                  </div>
                </div>
                <div key={pestana} className="desplazable" style={{ flex: 1, padding: 10, display: "flex", flexDirection: "column", gap: 6, background: "var(--superficie-2)" }}>
                  {cargando ? <Esqueleto alto={96} filas={5} /> : lista.length === 0 ? (
                    <Vacio icono={<FiInbox size={22} />} titulo={pestana === "POR_ASIGNAR" ? "Bandeja al día" : "Sin casos en esta etapa"} texto={pestana === "POR_ASIGNAR" ? "No hay reportes esperando un funcionario." : undefined} />
                  ) : lista.map((t, i) => {
                    const cat = categoriaInfo(t.categoria?.nombre);
                    const p = PRIORIDADES[prioridadDe(t)];
                    const rechazado = t.historial?.[0] && esRechazo(t.historial[0]);
                    return (
                      <button key={t.id} className="item-lista anim-arriba" onClick={() => seleccionar(t.id)} style={{ ["--color-item" as any]: cat.color, ["--i" as any]: Math.min(i, 14) }}>
                        <div className="fila entre">
                          <span className="mono" style={{ fontWeight: 600, fontSize: 12.5 }}>{t.codigoTicket}</span>
                          <span className="mono texto-3" style={{ fontSize: 10.5 }}>{tiempoRelativo(t.createdAt, ahora)}</span>
                        </div>
                        <div className="fila" style={{ gap: 6, marginTop: 6 }}>
                          <span style={{ color: cat.color, display: "inline-flex" }}><Icono nombre={cat.icono} size={14} /></span>
                          <span className="truncar" style={{ fontWeight: 600, fontSize: 12.5 }}>{cat.nombre}</span>
                          <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: p.color }}>{p.etiqueta}</span>
                        </div>
                        <div className="dos-lineas texto-2" style={{ fontSize: 11.5, marginTop: 4 }}>{t.analisisIA || resumenDescripcion(t.descripcionUsuario)}</div>
                        <div className="fila entre" style={{ marginTop: 8, gap: 8 }}>
                          <span className="fila" style={{ gap: 6, minWidth: 0 }}>
                            {rechazado ? <span className="insignia" style={{ color: "var(--peligro)" }}>Rechazado</span>
                              : t.estado === "PENDIENTE" ? <span className="insignia" style={{ color: "var(--alerta)" }} title="La IA lo envió aquí; la central C4 aún no lo valida">Sugerido por IA</span>
                              : <InsigniaEstado estado={t.estado} />}
                            {t.operadorAsignado && <span className="truncar texto-3" style={{ fontSize: 11 }}>{t.operadorAsignado.nombre}</span>}
                          </span>
                          {ESTADOS_ACTIVOS.includes(t.estado) ? <IndicadorSla ticket={t} ahora={ahora} /> : <span className="mono texto-3" style={{ fontSize: 10.5 }}>{horaCorta(t.updatedAt)}</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* =================== MAPA =================== */}
          <div className="panel" style={{ flex: 1, minWidth: 0, position: "relative", overflow: "hidden" }}>
            <Mapa
              tickets={detalle ? ticketsMapa.filter(t => t.id === detalle.id).concat(ticketsMapa.some(t => t.id === detalle.id) ? [] : [detalle]) : ticketsMapa}
              onSeleccionar={seleccionar}
              seleccionadoId={seleccionadoId}
              enfoque={detalle && detalle.latitud != null && !lineaDespacho ? [detalle.latitud, detalle.longitud!] : null}
              funcionarios={mostrarPersonal ? funcionarios : []}
              lineaDespacho={lineaDespacho}
            />
            <div style={{ position: "absolute", right: 12, bottom: 40, zIndex: 5 }}>
              <button className={`btn btn-sm ${mostrarPersonal ? "btn-oscuro" : "btn-secundario"}`} onClick={() => setMostrarPersonal(!mostrarPersonal)}>
                <FiNavigation size={12} /> {mostrarPersonal ? "Ocultar personal" : "Mostrar personal"} ({metricas.gps} con GPS)
              </button>
            </div>
          </div>
        </div>
      </div>

      <MensajeVecino ticket={detalle} abierto={mensajeAbierto} onCerrar={() => setMensajeAbierto(false)}
        onEnviado={t => { setDetalle(t); avisarCambio({ id: t.id, tipo: "mensaje", departamentoId: t.departamentoId ?? undefined }); }} />

      <Modal abierto={!!modal} onCerrar={() => setModal(null)} titulo={modal === "DESCARTAR" ? "Descartar reporte" : "Agregar nota interna"} subtitulo={detalle?.codigoTicket}
        pie={<>
          <button className="btn btn-fantasma" onClick={() => setModal(null)}>Cancelar</button>
          <button className={`btn ${modal === "DESCARTAR" ? "btn-peligro" : "btn-primario"}`} disabled={!!procesando || textoModal.trim().length < 5} onClick={confirmarModal}>
            {modal === "DESCARTAR" ? "Descartar y avisar al vecino" : "Guardar nota"}
          </button>
        </>}>
        {modal === "DESCARTAR" && (
          <div className="columna" style={{ gap: 4 }}>
            {MOTIVOS_DESCARTE.map(m => (
              <button key={m} className="item-lista" onClick={() => setTextoModal(m)} style={{ padding: "8px 12px 8px 16px", ["--color-item" as any]: textoModal === m ? "var(--peligro)" : "var(--borde)", borderColor: textoModal === m ? "var(--peligro)" : undefined, fontSize: 12.5 }}>{m}</button>
            ))}
          </div>
        )}
        <textarea className="textarea" autoFocus value={textoModal} onChange={e => setTextoModal(e.target.value)} maxLength={500} placeholder={modal === "DESCARTAR" ? "Motivo (lo recibe el vecino)" : "Nota visible solo para el personal"} />
      </Modal>
    </div>
  );
}
