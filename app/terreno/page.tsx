"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { signOut } from "next-auth/react";
import { FiLogOut, FiArrowLeft, FiNavigation, FiMap, FiCheck, FiX, FiCrosshair, FiInbox, FiCpu, FiImage, FiMessageSquare, FiClock, FiAlertTriangle, FiCamera } from "react-icons/fi";

import { Logo, PantallaCarga, IndicadorConexion, IndicadorSla, InsigniaPrioridad, Conversacion, Galeria, LineaTiempo, Seccion, Esqueleto, Vacio, Modal } from "../../components/ui/Comunes";
import { Icono } from "../../components/ui/Iconos";
import { useAvisos } from "../../components/ui/Avisos";
import { useApi, mensajeError } from "../../lib/useApi";
import { usePerfil } from "../../lib/usePerfil";
import { useFavicon, colorIcono } from "../../lib/favicon";
import { useTiempoReal, useRefresco, useAgrupado } from "../../lib/useTiempoReal";
import { useAhora, sonarAlerta } from "../../lib/hooks";
import { distanciaKm, enlaceGoogleMaps, enlaceWaze, unidadVecinalDe } from "../../lib/geo";
import type { Ticket, Operador } from "../../lib/tipos";
import { PRIORIDADES, categoriaInfo, prioridadDe, slaDe, tiempoRelativo, resumenDescripcion, horaCorta } from "../../lib/constantes";

const MapaCompacto = dynamic(() => import("../../components/Map"), {
  ssr: false,
  loading: () => <div className="esqueleto" style={{ height: "100%" }} />,
});

const MOTIVOS_RECHAZO = ["Estoy atendiendo otra emergencia", "Fuera de mi zona de trabajo", "No tengo el equipamiento necesario", "Falla del vehículo", "Término de turno"];
const FRASES_CIERRE = ["Se reparó el problema en el lugar.", "Se retiraron los residuos del lugar.", "Se coordinó con la empresa responsable.", "Se instaló señalización provisoria."];

// Envío de posición: como máximo cada 20 s, o antes si se movió más de 30 m
const INTERVALO_GPS_MS = 20000;
const DISTANCIA_GPS_KM = 0.03;

type Grupo = "NUEVAS" | "EN_CURSO" | "CERRADAS";

export default function AppTerreno() {
  const { perfil, error: errorPerfil } = usePerfil(["TERRENO"]);
  useFavicon(perfil ? colorIcono("TERRENO", perfil.departamentoId) : null);
  const api = useApi();
  const avisar = useAvisos();
  const ahora = useAhora(30000);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [cargando, setCargando] = useState(true);
  const [grupo, setGrupo] = useState<Grupo>("NUEVAS");
  const [activoId, setActivoId] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [modal, setModal] = useState<null | "ACEPTAR" | "RECHAZAR" | "RESOLVER">(null);
  const [textoModal, setTextoModal] = useState("");
  const [fotoCierre, setFotoCierre] = useState<string | null>(null);
  const [preparandoFoto, setPreparandoFoto] = useState(false);
  const [ordenCercania, setOrdenCercania] = useState(false);

  const [gpsActivo, setGpsActivo] = useState(false);
  const [posicion, setPosicion] = useState<{ lat: number; lng: number; precision: number } | null>(null);
  const [ultimoEnvio, setUltimoEnvio] = useState<number | null>(null);
  const [errorGps, setErrorGps] = useState<string | null>(null);
  const envioRef = useRef<{ t: number; lat: number; lng: number } | null>(null);

  // --------------------------------------------------------------------------
  // TAREAS
  // --------------------------------------------------------------------------
  const cargar = useCallback(async () => {
    try {
      const res = await api("/tickets");
      if (res.ok) {
        const data: Ticket[] = await res.json();
        setTickets(prev => (JSON.stringify(prev) === JSON.stringify(data) ? prev : data));
      }
    } catch {} finally {
      setCargando(false);
    }
  }, [api]);

  const recargar = useAgrupado(cargar, 300);
  useEffect(() => { if (perfil) cargar(); }, [perfil, cargar]);

  const { conectado, avisarCambio, avisarUbicacion } = useTiempoReal({
    activo: !!perfil,
    onTicketCambio: e => { if (!e.operadorAsignadoId || e.operadorAsignadoId === perfil?.id || e.tipo === "departamento") recargar(); },
  });
  useRefresco(cargar, conectado, !!perfil);

  // Aviso con vibración cuando llega una tarea nueva
  const conocidas = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (cargando) return;
    const pendientes = tickets.filter(t => t.estado === "EN_REVISION");
    if (conocidas.current) {
      const nuevas = pendientes.filter(t => !conocidas.current!.has(t.id));
      if (nuevas.length) {
        try { navigator.vibrate?.([180, 80, 180]); } catch {}
        sonarAlerta("nuevo");
        avisar({ titulo: nuevas.length === 1 ? "Nueva tarea asignada" : `${nuevas.length} tareas nuevas`, mensaje: nuevas[0].categoria?.nombre || nuevas[0].codigoTicket, tipo: "nuevo", accion: { etiqueta: "Ver tarea", onClick: () => setActivoId(nuevas[0].id) } });
      }
    }
    conocidas.current = new Set(pendientes.map(t => t.id));
  }, [tickets, cargando, avisar]);

  // --------------------------------------------------------------------------
  // GPS
  // --------------------------------------------------------------------------
  useEffect(() => {
    try { if (localStorage.getItem("munivox_gps_activo") === "true") setGpsActivo(true); } catch {}
  }, []);

  useEffect(() => {
    if (!perfil) return;
    try { localStorage.setItem("munivox_gps_activo", String(gpsActivo)); } catch {}

    if (!gpsActivo) {
      setPosicion(null);
      api("/operadores/ubicacion", { method: "PUT", body: JSON.stringify({ gpsActivo: false }) })
        .then(() => avisarUbicacion({ departamentoId: perfil.departamentoId })).catch(() => {});
      return;
    }
    if (!("geolocation" in navigator)) { setErrorGps("Este dispositivo no tiene GPS disponible."); setGpsActivo(false); return; }

    setErrorGps(null);
    const id = navigator.geolocation.watchPosition(
      pos => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        setPosicion({ lat, lng, precision: accuracy });
        const previo = envioRef.current;
        const ahoraMs = Date.now();
        const movido = previo ? distanciaKm(previo.lat, previo.lng, lat, lng) : Infinity;
        if (previo && ahoraMs - previo.t < INTERVALO_GPS_MS && movido < DISTANCIA_GPS_KM) return;
        envioRef.current = { t: ahoraMs, lat, lng };
        api("/operadores/ubicacion", { method: "PUT", body: JSON.stringify({ latitud: lat, longitud: lng, gpsActivo: true }) })
          .then(r => { if (r.ok) { setUltimoEnvio(Date.now()); avisarUbicacion({ departamentoId: perfil.departamentoId }); } })
          .catch(() => {});
      },
      err => {
        setErrorGps(err.code === err.PERMISSION_DENIED ? "Permiso de ubicación denegado. Actívalo en la configuración del navegador." : "No se pudo obtener la posición. Reintentando.");
        if (err.code === err.PERMISSION_DENIED) setGpsActivo(false);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsActivo, perfil?.id]);

  // --------------------------------------------------------------------------
  // GRUPOS Y ACCIONES
  // --------------------------------------------------------------------------
  const grupos = useMemo(() => {
    const inicio = new Date(ahora); inicio.setHours(0, 0, 0, 0);
    const g: Record<Grupo, Ticket[]> = { NUEVAS: [], EN_CURSO: [], CERRADAS: [] };
    tickets.forEach(t => {
      if (t.estado === "EN_REVISION" || t.estado === "PENDIENTE") g.NUEVAS.push(t);
      else if (t.estado === "DESPACHADO") g.EN_CURSO.push(t);
      else if (t.estado === "RESUELTO" && new Date(t.updatedAt || 0).getTime() >= inicio.getTime() - 86400000) g.CERRADAS.push(t);
    });
    const urg = (a: Ticket, b: Ticket) => PRIORIDADES[prioridadDe(b)].peso - PRIORIDADES[prioridadDe(a)].peso || slaDe(a, ahora).restanteMs - slaDe(b, ahora).restanteMs;
    g.NUEVAS.sort(urg); g.EN_CURSO.sort(urg);
    return g;
  }, [tickets, ahora]);

  useEffect(() => {
    if (!cargando && grupo === "NUEVAS" && grupos.NUEVAS.length === 0 && grupos.EN_CURSO.length > 0) setGrupo("EN_CURSO");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargando]);

  const activo = tickets.find(t => t.id === activoId) || null;

  const actualizar = async (cuerpo: Record<string, unknown>, exito: string) => {
    if (!activo) return false;
    setProcesando(true);
    try {
      const res = await api(`/tickets/${activo.id}`, { method: "PUT", body: JSON.stringify(cuerpo) });
      if (!res.ok) {
        avisar({ titulo: "No se pudo completar", mensaje: await mensajeError(res), tipo: "error" });
        return false;
      }
      const respuesta = await res.json().catch(() => ({}));
      if (respuesta?.advertencia) avisar({ titulo: "Atención", mensaje: respuesta.advertencia, tipo: "alerta", duracion: 8000 });
      avisar({ titulo: exito, mensaje: activo.codigoTicket, tipo: "ok" });
      try { navigator.vibrate?.(60); } catch {}
      avisarCambio({ id: activo.id, tipo: "terreno", departamentoId: activo.departamentoId ?? undefined });
      await cargar();
      return true;
    } catch {
      avisar({ titulo: "Sin conexión", mensaje: "Revisa tu señal e intenta de nuevo.", tipo: "error" });
      return false;
    } finally {
      setProcesando(false);
    }
  };

  const confirmar = async () => {
    const texto = textoModal.trim();
    let ok = false;
    if (modal === "ACEPTAR") {
      ok = await actualizar({ nuevoEstado: "DESPACHADO", comentario: "El funcionario aceptó la tarea y va en camino." }, "Tarea aceptada");
      if (ok) setGrupo("EN_CURSO");
    }
    if (modal === "RECHAZAR") {
      ok = await actualizar({ operadorAsignadoId: null, nuevoEstado: "EN_REVISION", comentario: `Rechazado por funcionario: ${texto}` }, "Tarea devuelta a la jefatura");
      if (ok) setActivoId(null);
    }
    if (modal === "RESOLVER") {
      ok = await actualizar({ nuevoEstado: "RESUELTO", comentario: texto, ...(fotoCierre && { fotoCierre }) }, "Caso cerrado");
      if (ok) { setActivoId(null); setGrupo("CERRADAS"); setFotoCierre(null); }
    }
    if (ok) { setModal(null); setTextoModal(""); }
  };

  // Reduce la foto antes de enviarla (máximo 1280 px, JPEG): sube rápido con poca señal
  const prepararFoto = async (archivo?: File) => {
    if (!archivo) return;
    setPreparandoFoto(true);
    try {
      const url = URL.createObjectURL(archivo);
      const img = new Image();
      await new Promise((ok, falla) => { img.onload = ok; img.onerror = falla; img.src = url; });
      const escala = Math.min(1, 1280 / Math.max(img.width, img.height));
      const lienzo = document.createElement("canvas");
      lienzo.width = Math.round(img.width * escala);
      lienzo.height = Math.round(img.height * escala);
      lienzo.getContext("2d")!.drawImage(img, 0, 0, lienzo.width, lienzo.height);
      URL.revokeObjectURL(url);
      setFotoCierre(lienzo.toDataURL("image/jpeg", 0.72));
    } catch {
      avisar({ titulo: "No se pudo leer la foto", tipo: "error" });
    } finally {
      setPreparandoFoto(false);
    }
  };

  const distanciaA = (t: Ticket) => posicion && t.latitud != null ? distanciaKm(posicion.lat, posicion.lng, t.latitud, t.longitud!) : null;

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------
  if (errorPerfil) return <PantallaCarga texto={errorPerfil} />;
  if (!perfil) return <PantallaCarga />;

  const yoEnMapa: Operador[] = posicion ? [{ ...perfil, latitud: posicion.lat, longitud: posicion.lng, gpsActivo: true, ultimaUbicacion: new Date(ultimoEnvio || ahora).toISOString() }] : [];

  const contenedor: React.CSSProperties = { maxWidth: 620, margin: "0 auto", width: "100%" };

  // ============================ DETALLE ============================
  if (activo) {
    const cat = categoriaInfo(activo.categoria?.nombre);
    const km = distanciaA(activo);
    return (
      <div style={{ minHeight: "100vh", background: "var(--fondo)", display: "flex", flexDirection: "column" }}>
        <header style={{ position: "sticky", top: 0, zIndex: 20, background: "var(--marino)", color: "#fff", borderBottom: `3px solid ${cat.color}` }}>
          <div className="fila" style={{ ...contenedor, padding: "10px 14px", gap: 12 }}>
            <button onClick={() => setActivoId(null)} aria-label="Volver" style={{ width: 38, height: 38, background: "transparent", border: "1px solid var(--marino-borde)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><FiArrowLeft size={18} /></button>
            <div className="crece">
              <div className="mono" style={{ fontWeight: 600, fontSize: 16 }}>{activo.codigoTicket}</div>
              <div style={{ fontSize: 12, color: "var(--marino-texto)" }}>{cat.nombre}</div>
            </div>
            <span style={{ width: 36, height: 36, background: cat.color, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icono nombre={cat.icono} size={20} /></span>
          </div>
        </header>

        <div style={{ height: 230, position: "relative", borderBottom: "1px solid var(--borde)" }}>
          <MapaCompacto compacto tickets={[activo]} enfoque={activo.latitud != null ? [activo.latitud, activo.longitud!] : null} funcionarios={yoEnMapa}
            lineaDespacho={posicion && activo.latitud != null && activo.estado === "DESPACHADO" ? { desde: [posicion.lat, posicion.lng], hasta: [activo.latitud, activo.longitud!] } : null} zoomEnfoque={15.5} />
          <div style={{ position: "absolute", left: 10, bottom: 10, zIndex: 5, background: "var(--marino)", color: "#fff", padding: "6px 10px", fontSize: 12 }}>
            <span className="mono" style={{ fontWeight: 600 }}>{km != null ? `${km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`}` : "Activa tu GPS para ver la distancia"}</span>
            {km != null && <span style={{ color: "var(--marino-texto)" }}> hasta el lugar</span>}
          </div>
        </div>

        <div style={{ ...contenedor, padding: 14, display: "flex", flexDirection: "column", gap: 18, paddingBottom: 130 }}>
          <div className="panel anim-arriba" style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
            <div style={{ padding: 12, borderRight: "1px solid var(--borde)" }}>
              <div className="rotulo" style={{ marginBottom: 6 }}>Prioridad</div>
              <InsigniaPrioridad prioridad={prioridadDe(activo)} />
            </div>
            <div style={{ padding: 12 }}>
              <div className="rotulo" style={{ marginBottom: 6 }}>Plazo</div>
              <IndicadorSla ticket={activo} ahora={ahora} barra />
            </div>
            <div style={{ padding: 12, borderTop: "1px solid var(--borde)", gridColumn: "1 / 3" }}>
              <div className="rotulo" style={{ marginBottom: 4 }}>Lugar</div>
              <div style={{ fontWeight: 600 }}>{unidadVecinalDe(activo.latitud, activo.longitud) || "Sin ubicación"}</div>
              {activo.latitud != null && <div className="mono texto-3" style={{ fontSize: 11 }}>{activo.latitud.toFixed(5)}, {activo.longitud!.toFixed(5)}</div>}
            </div>
          </div>

          <Seccion titulo="Qué encontrarás" icono={<FiCpu size={12} />}>
            <div className="panel" style={{ padding: 12, fontSize: 13.5, lineHeight: 1.6, borderLeft: "3px solid var(--acento)" }}>{activo.analisisIA || resumenDescripcion(activo.descripcionUsuario)}</div>
          </Seccion>
          <Seccion titulo="Relato del vecino" icono={<FiMessageSquare size={12} />}>
            <Conversacion descripcion={activo.descripcionUsuario} />
          </Seccion>
          <Seccion titulo={`Fotografías (${activo.evidencias?.length || 0})`} icono={<FiImage size={12} />}>
            <Galeria evidencias={activo.evidencias} alto={140} />
          </Seccion>
          <Seccion titulo="Historial" icono={<FiClock size={12} />}>
            <LineaTiempo historial={activo.historial?.filter(h => !String(h.comentario || "").startsWith("[Nota interna]"))} creado={activo.createdAt} />
          </Seccion>
        </div>

        {/* Barra de acciones fija */}
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 30, background: "var(--superficie)", borderTop: "1px solid var(--borde)", boxShadow: "0 -8px 24px -12px rgba(10,18,34,.3)" }}>
          <div className="anim-arriba" style={{ ...contenedor, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {(activo.estado === "EN_REVISION" || activo.estado === "PENDIENTE") && (
              <div className="fila" style={{ gap: 8 }}>
                <button className="btn btn-lg btn-peligro-borde" style={{ flex: 1 }} onClick={() => { setTextoModal(""); setModal("RECHAZAR"); }}><FiX size={16} /> Rechazar</button>
                <button className="btn btn-lg btn-ok" style={{ flex: 2 }} onClick={() => setModal("ACEPTAR")}><FiCheck size={16} /> Aceptar tarea</button>
              </div>
            )}
            {activo.estado === "DESPACHADO" && activo.latitud != null && (
              <>
                <div className="fila" style={{ gap: 8 }}>
                  <a className="btn btn-secundario" style={{ flex: 1 }} href={enlaceWaze(activo.latitud, activo.longitud!)} target="_blank" rel="noreferrer"><FiNavigation size={14} /> Waze</a>
                  <a className="btn btn-secundario" style={{ flex: 1 }} href={enlaceGoogleMaps(activo.latitud, activo.longitud!)} target="_blank" rel="noreferrer"><FiMap size={14} /> Google Maps</a>
                </div>
                <button className="btn btn-lg btn-ok btn-bloque" onClick={() => { setTextoModal(""); setModal("RESOLVER"); }}><FiCheck size={16} /> Marcar como resuelto</button>
              </>
            )}
            {activo.estado === "RESUELTO" && <div className="fila" style={{ justifyContent: "center", color: "var(--ok)", fontWeight: 600, gap: 8, padding: 8 }}><FiCheck /> Caso cerrado {tiempoRelativo(activo.updatedAt, ahora)}</div>}
          </div>
        </div>

        <Modal abierto={!!modal} onCerrar={() => setModal(null)}
          titulo={modal === "ACEPTAR" ? "Aceptar tarea" : modal === "RECHAZAR" ? "Rechazar tarea" : "Cerrar caso"}
          subtitulo={`${activo.codigoTicket} | ${cat.nombre}`}
          pie={<>
            <button className="btn btn-fantasma" onClick={() => setModal(null)}>Volver</button>
            <button className={`btn ${modal === "RECHAZAR" ? "btn-peligro" : "btn-ok"}`} onClick={confirmar} disabled={procesando || (modal !== "ACEPTAR" && textoModal.trim().length < 5)}>
              {procesando ? <span className="girador" style={{ width: 12, height: 12 }} /> : <FiCheck size={14} />}
              {modal === "ACEPTAR" ? "Sí, voy en camino" : modal === "RECHAZAR" ? "Rechazar" : "Cerrar y avisar al vecino"}
            </button>
          </>}>
          {modal === "ACEPTAR" && <p style={{ margin: 0, lineHeight: 1.6 }}>El vecino recibirá un aviso por WhatsApp indicando que un funcionario va en camino.{!gpsActivo && <><br /><strong style={{ color: "var(--alerta)" }}>Te recomendamos activar el GPS para que la jefatura vea tu avance.</strong></>}</p>}
          {modal === "RECHAZAR" && (
            <>
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--texto-2)" }}>La tarea vuelve a tu jefatura para reasignarla.</p>
              <div className="columna" style={{ gap: 4 }}>
                {MOTIVOS_RECHAZO.map(m => (
                  <button key={m} className="item-lista" onClick={() => setTextoModal(m)} style={{ padding: "10px 12px 10px 16px", ["--color-item" as any]: textoModal === m ? "var(--peligro)" : "var(--borde)", borderColor: textoModal === m ? "var(--peligro)" : undefined }}>{m}</button>
                ))}
              </div>
              <textarea className="textarea" value={textoModal} onChange={e => setTextoModal(e.target.value)} placeholder="Otro motivo" maxLength={300} />
            </>
          )}
          {modal === "RESOLVER" && (
            <>
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--texto-2)" }}>Describe qué se hizo. El vecino recibirá este informe y podrá evaluar la atención.</p>
              <div className="fila" style={{ flexWrap: "wrap", gap: 6 }}>
                {FRASES_CIERRE.map(f => <button key={f} className="btn btn-sm btn-secundario" onClick={() => setTextoModal(f)}>{f}</button>)}
              </div>
              <textarea className="textarea" autoFocus value={textoModal} onChange={e => setTextoModal(e.target.value)} placeholder="Informe de cierre" maxLength={500} />
              <div className="campo">
                <span className="rotulo">Foto del trabajo terminado (opcional)</span>
                {fotoCierre ? (
                  <div style={{ position: "relative", border: "1px solid var(--borde)" }} className="anim-escalar">
                    <img src={fotoCierre} alt="Vista previa de la foto de cierre" style={{ width: "100%", maxHeight: 220, objectFit: "cover" }} />
                    <button className="btn btn-sm btn-secundario" style={{ position: "absolute", top: 8, right: 8 }} onClick={() => setFotoCierre(null)}><FiX size={12} /> Quitar</button>
                  </div>
                ) : (
                  <label className="btn btn-secundario btn-lg" style={{ cursor: "pointer" }}>
                    {preparandoFoto ? <span className="girador" style={{ width: 14, height: 14 }} /> : <FiCamera size={16} />}
                    {preparandoFoto ? "Preparando foto" : "Tomar o elegir foto"}
                    <input type="file" accept="image/*" capture="environment" hidden onChange={e => prepararFoto(e.target.files?.[0])} />
                  </label>
                )}
                <span className="texto-3" style={{ fontSize: 11 }}>El vecino verá esta foto junto al informe. Evita que aparezcan personas o patentes.</span>
              </div>
            </>
          )}
        </Modal>
      </div>
    );
  }

  // ============================ LISTA ============================
  const pestanas: { id: Grupo; etiqueta: string }[] = [
    { id: "NUEVAS", etiqueta: "Por aceptar" },
    { id: "EN_CURSO", etiqueta: "En curso" },
    { id: "CERRADAS", etiqueta: "Cerradas" },
  ];
  const lista = ordenCercania && posicion
    ? [...grupos[grupo]].sort((a, b) => (distanciaA(a) ?? 999) - (distanciaA(b) ?? 999))
    : grupos[grupo];

  return (
    <div style={{ minHeight: "100vh", background: "var(--fondo)" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 20, background: "var(--marino)", color: "#fff" }}>
        <div className="fila entre" style={{ ...contenedor, padding: "12px 14px" }}>
          <Logo tamano={28} subtitulo="Terreno" />
          <div className="fila" style={{ gap: 12 }}>
            <IndicadorConexion conectado={conectado} claro />
            <button onClick={() => signOut({ callbackUrl: "/login" })} aria-label="Cerrar sesión" style={{ width: 36, height: 36, background: "transparent", border: "1px solid var(--marino-borde)", color: "var(--marino-texto)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><FiLogOut size={15} /></button>
          </div>
        </div>
      </header>

      <div style={{ ...contenedor, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Identidad y GPS */}
        <div className="panel marco anim-arriba">
          <div className="fila entre" style={{ padding: 14 }}>
            <div>
              <div className="rotulo">Funcionario en terreno</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginTop: 2 }}>{perfil.nombre}</div>
              <div className="texto-3" style={{ fontSize: 12 }}>{perfil.departamento?.nombre || "Sin departamento"}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <button className={`interruptor${gpsActivo ? " activo" : ""}`} onClick={() => setGpsActivo(!gpsActivo)} aria-label="Transmitir ubicación" style={{ width: 56, height: 30 }} />
              <div className="rotulo" style={{ marginTop: 6, color: gpsActivo ? "var(--ok)" : "var(--texto-3)" }}>{gpsActivo ? "GPS activo" : "GPS apagado"}</div>
            </div>
          </div>
          <div className="fila" style={{ borderTop: "1px solid var(--borde)", padding: "8px 14px", gap: 8, fontSize: 11.5, background: gpsActivo ? "var(--ok-suave)" : "var(--superficie-2)" }}>
            <FiCrosshair size={13} color={gpsActivo ? "var(--ok)" : "var(--texto-3)"} />
            {errorGps ? <span style={{ color: "var(--peligro)" }}>{errorGps}</span>
              : gpsActivo ? (posicion ? <span>Precisión {Math.round(posicion.precision)} m | Enviado {ultimoEnvio ? horaCorta(new Date(ultimoEnvio)) : "--"}</span> : <span>Buscando señal GPS<span style={{ animation: "parpadeo 1s infinite" }}>...</span></span>)
              : <span className="texto-3">Actívalo para que tu jefatura te asigne las tareas más cercanas.</span>}
          </div>
        </div>

        {/* Resumen */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {pestanas.map((p, i) => (
            <button key={p.id} onClick={() => setGrupo(p.id)} className="anim-arriba"
              style={{ ["--i" as any]: i, textAlign: "left", padding: "10px 12px", background: grupo === p.id ? "var(--marino)" : "var(--superficie)", color: grupo === p.id ? "#fff" : "var(--texto)", border: `1px solid ${grupo === p.id ? "var(--marino)" : "var(--borde)"}`, transition: "all 0.2s" }}>
              <div className="rotulo" style={{ color: grupo === p.id ? "var(--marino-texto)" : undefined }}>{p.etiqueta}</div>
              <div className="mono" style={{ fontSize: 24, fontWeight: 600, marginTop: 2, color: p.id === "NUEVAS" && grupos.NUEVAS.length && grupo !== p.id ? "var(--alerta)" : undefined }}>{grupos[p.id].length}</div>
            </button>
          ))}
        </div>

        {posicion && grupo !== "CERRADAS" && grupos[grupo].length > 1 && (
          <div className="segmentos anim-aparecer" style={{ alignSelf: "flex-start" }}>
            <button className={`segmento${!ordenCercania ? " activo" : ""}`} onClick={() => setOrdenCercania(false)}>Más urgentes</button>
            <button className={`segmento${ordenCercania ? " activo" : ""}`} onClick={() => setOrdenCercania(true)}>Más cercanas</button>
          </div>
        )}

        {/* Tareas */}
        <div key={grupo} className="columna" style={{ gap: 8 }}>
          {cargando ? <Esqueleto alto={110} filas={3} /> : lista.length === 0 ? (
            <Vacio icono={<FiInbox size={22} />} titulo={grupo === "NUEVAS" ? "Sin tareas por aceptar" : grupo === "EN_CURSO" ? "Sin tareas en curso" : "Sin casos cerrados recientes"} texto={grupo === "NUEVAS" ? "Te avisaremos con una vibración cuando te asignen una tarea." : undefined} />
          ) : lista.map((t, i) => {
            const cat = categoriaInfo(t.categoria?.nombre);
            const km = distanciaA(t);
            const urgente = prioridadDe(t) === "CRITICA" || slaDe(t, ahora).vencido;
            return (
              <button key={t.id} onClick={() => setActivoId(t.id)} className="item-lista anim-arriba" style={{ ["--color-item" as any]: cat.color, ["--i" as any]: i, padding: "14px 14px 14px 18px" }}>
                <div className="fila entre">
                  <span className="fila" style={{ gap: 10, minWidth: 0 }}>
                    <span style={{ width: 34, height: 34, background: cat.color, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icono nombre={cat.icono} size={18} /></span>
                    <span style={{ minWidth: 0 }}>
                      <span className="truncar" style={{ display: "block", fontWeight: 700, fontSize: 14 }}>{cat.nombre}</span>
                      <span className="mono texto-3" style={{ fontSize: 11.5 }}>{t.codigoTicket} | {tiempoRelativo(t.createdAt, ahora)}</span>
                    </span>
                  </span>
                  <span className="mono" style={{ fontWeight: 600, fontSize: 14, flexShrink: 0 }}>{km != null ? (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`) : ""}</span>
                </div>
                <div className="dos-lineas texto-2" style={{ fontSize: 12.5, marginTop: 8 }}>{t.analisisIA || resumenDescripcion(t.descripcionUsuario)}</div>
                <div className="fila entre" style={{ marginTop: 10 }}>
                  <InsigniaPrioridad prioridad={prioridadDe(t)} />
                  {urgente && t.estado !== "RESUELTO" ? <span className="fila" style={{ gap: 4, color: "var(--peligro)", fontSize: 11, fontWeight: 600 }}><FiAlertTriangle size={12} /> Urgente</span> : t.estado !== "RESUELTO" ? <IndicadorSla ticket={t} ahora={ahora} /> : <span className="texto-3" style={{ fontSize: 11 }}>Cerrado {horaCorta(t.updatedAt)}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
