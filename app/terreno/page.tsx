"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { signOut } from "next-auth/react";
import {
  FiLogOut, FiArrowLeft, FiNavigation, FiMap, FiCheck, FiX, FiCrosshair, FiInbox, FiCpu, FiImage, FiMessageSquare,
  FiClock, FiAlertTriangle, FiCamera, FiTruck, FiWifiOff, FiUploadCloud, FiBriefcase, FiBell,
} from "react-icons/fi";

import { Logo, PantallaCarga, IndicadorConexion, IndicadorSla, InsigniaPrioridad, Conversacion, Galeria, LineaTiempo, Seccion, Esqueleto, Vacio, Modal } from "../../components/ui/Comunes";
import { Icono } from "../../components/ui/Iconos";
import { useAvisos } from "../../components/ui/Avisos";
import { useApi, mensajeError } from "../../lib/useApi";
import { usePerfil } from "../../lib/usePerfil";
import { useFavicon, colorIcono, claveIcono } from "../../lib/favicon";
import { useTiempoReal, useRefresco, useAgrupado } from "../../lib/useTiempoReal";
import { useAhora, sonarAlerta } from "../../lib/hooks";
import { distanciaKm, enlaceGoogleMaps, enlaceWaze, unidadVecinalDe } from "../../lib/geo";
import {
  guardarLocal, leerLocal, useEnLinea, limiteDeTiempo, esErrorDeRed,
  encolar, listarPendientes, quitarPendiente, registrarServiceWorker, type AccionPendiente,
} from "../../lib/sinConexion";
import { estadoNotificaciones, activarNotificaciones, desactivarNotificaciones, type EstadoNotificaciones } from "../../lib/notificaciones";
import type { Ticket, Operador } from "../../lib/tipos";
import { PRIORIDADES, categoriaInfo, prioridadDe, slaDe, tiempoRelativo, resumenDescripcion, horaCorta } from "../../lib/constantes";

// El mapa interactivo es pesado: solo se descarga si el funcionario lo pide
const MapaCompacto = dynamic(() => import("../../components/Map"), {
  ssr: false,
  loading: () => <div className="esqueleto" style={{ height: "100%" }} />,
});

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
const MOTIVOS_RECHAZO = ["Estoy atendiendo otra emergencia", "Fuera de mi zona de trabajo", "No tengo el equipamiento necesario", "Falla del vehículo", "Término de turno"];
const FRASES_CIERRE = ["Se reparó el problema en el lugar.", "Se retiraron los residuos del lugar.", "Se coordinó con la empresa responsable.", "Se instaló señalización provisoria."];

// Envío de posición: como máximo cada 20 s, o antes si se movió más de 30 m
const INTERVALO_GPS_MS = 20000;
const DISTANCIA_GPS_KM = 0.03;
const LIMITE_RED_MS = 15000; // con mala señal no se espera indefinidamente

type Grupo = "NUEVAS" | "EN_CURSO" | "CERRADAS";

const enCaminoDesde = (t: Ticket) => (t.historial || []).find(h => String(h.comentario || "").startsWith("En camino"))?.createdAt || null;

/** Aplica sobre los datos las acciones que aún no se envían, para que la pantalla refleje lo que hizo el funcionario */
function aplicarPendientes(tickets: Ticket[], pendientes: AccionPendiente[]) {
  if (!pendientes.length) return tickets;
  return tickets.flatMap(t => {
    const mias = pendientes.filter(p => p.ticketId === t.id);
    if (!mias.length) return [t];
    let x: Ticket = { ...t };
    for (const p of mias) {
      const c = p.cuerpo as any;
      if (c.operadorAsignadoId === null) return []; // rechazada: deja de ser suya
      if (c.nuevoEstado) x = { ...x, estado: c.nuevoEstado, updatedAt: new Date(p.creada).toISOString() };
      if (c.enCamino) x = { ...x, historial: [{ id: p.id, estadoNuevo: x.estado, comentario: "En camino al lugar", createdAt: new Date(p.creada).toISOString() }, ...(x.historial || [])] };
    }
    return [x];
  });
}

function MapaEstatico({ ticket, posicion }: { ticket: Ticket; posicion: { lat: number; lng: number } | null }) {
  const [fallo, setFallo] = useState(false);
  if (ticket.latitud == null || !MAPBOX_TOKEN || fallo) {
    return <div className="vacio" style={{ height: "100%", border: 0 }}><FiMap size={20} />{ticket.latitud == null ? "Sin ubicación" : "Mapa no disponible sin conexión"}</div>;
  }
  const color = categoriaInfo(ticket.categoria?.nombre).color.replace("#", "");
  const pines = [`pin-l+${color}(${ticket.longitud},${ticket.latitud})`, ...(posicion ? [`pin-s+0A1222(${posicion.lng.toFixed(5)},${posicion.lat.toFixed(5)})`] : [])].join(",");
  const vista = posicion ? "auto" : `${ticket.longitud},${ticket.latitud},15.5`;
  const src = `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${pines}/${vista}/600x300@2x?padding=50&access_token=${MAPBOX_TOKEN}`;
  return <img src={src} alt="Ubicación del problema" decoding="async" onError={() => setFallo(true)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
}

export default function AppTerreno() {
  const { perfil, error: errorPerfil } = usePerfil(["TERRENO"]);
  useFavicon(perfil ? colorIcono("TERRENO", perfil.departamentoId) : null, perfil ? claveIcono("TERRENO", perfil.departamentoId) : null);
  const api = useApi();
  const avisar = useAvisos();
  const ahora = useAhora(30000);
  const enLinea = useEnLinea();

  const [ticketsServidor, setTicketsServidor] = useState<Ticket[]>([]);
  const [pendientes, setPendientes] = useState<AccionPendiente[]>([]);
  const [guardadoEn, setGuardadoEn] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [grupo, setGrupo] = useState<Grupo>("NUEVAS");
  const [activoId, setActivoId] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [modal, setModal] = useState<null | "ACEPTAR" | "RECHAZAR" | "RESOLVER">(null);
  const [textoModal, setTextoModal] = useState("");
  const [fotoCierre, setFotoCierre] = useState<string | null>(null);
  const [preparandoFoto, setPreparandoFoto] = useState(false);
  const [ordenCercania, setOrdenCercania] = useState(false);
  const [mapaInteractivo, setMapaInteractivo] = useState(false);
  const [notificaciones, setNotificaciones] = useState<EstadoNotificaciones>("cargando");
  const [cambiandoNotif, setCambiandoNotif] = useState(false);
  const [datosFrescos, setDatosFrescos] = useState(false); // ya se consultó al servidor (o no hay señal)

  const [enTurno, setEnTurno] = useState(false);
  const [gpsActivo, setGpsActivo] = useState(false);
  const [posicion, setPosicion] = useState<{ lat: number; lng: number; precision: number } | null>(null);
  const [ultimoEnvio, setUltimoEnvio] = useState<number | null>(null);
  const [errorGps, setErrorGps] = useState<string | null>(null);
  const envioRef = useRef<{ t: number; lat: number; lng: number } | null>(null);

  const claveCache = perfil ? `munivox_terreno_tareas_${perfil.id}` : null;
  const tickets = useMemo(() => aplicarPendientes(ticketsServidor, pendientes), [ticketsServidor, pendientes]);

  useEffect(() => {
    registrarServiceWorker();
    estadoNotificaciones().then(setNotificaciones).catch(() => setNotificaciones("no-soportadas"));
  }, []);

  // Al tocar una notificación se abre la app en /terreno?tarea=<id>
  const tareaPedida = useRef<string | null>(null);
  useEffect(() => {
    tareaPedida.current = new URLSearchParams(window.location.search).get("tarea");
    if (tareaPedida.current) window.history.replaceState(null, "", "/terreno");
  }, []);

  // --------------------------------------------------------------------------
  // TAREAS (copia local para abrir al instante y funcionar sin señal)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!claveCache) return;
    const local = leerLocal<Ticket[]>(claveCache);
    if (local) { setTicketsServidor(local.datos); setGuardadoEn(local.guardado); setCargando(false); }
    listarPendientes().then(setPendientes).catch(() => {});
  }, [claveCache]);

  const cargar = useCallback(async () => {
    if (!claveCache || (typeof navigator !== "undefined" && !navigator.onLine)) { setCargando(false); setDatosFrescos(true); return; }
    try {
      const res = await api("/tickets", { signal: limiteDeTiempo(LIMITE_RED_MS) });
      if (res.ok) {
        const data: Ticket[] = await res.json();
        setTicketsServidor(prev => (JSON.stringify(prev) === JSON.stringify(data) ? prev : data));
        guardarLocal(claveCache, data);
        setGuardadoEn(Date.now());
      }
    } catch {} finally {
      setCargando(false);
      setDatosFrescos(true);
    }
  }, [api, claveCache]);

  const recargar = useAgrupado(cargar, 300);
  useEffect(() => { if (perfil) cargar(); }, [perfil, cargar]);

  const { conectado, avisarCambio, avisarUbicacion } = useTiempoReal({
    activo: !!perfil,
    onTicketCambio: e => { if (!e.operadorAsignadoId || e.operadorAsignadoId === perfil?.id || e.tipo === "departamento") recargar(); },
  });
  useRefresco(cargar, conectado, !!perfil && enLinea);

  // --------------------------------------------------------------------------
  // COLA DE ACCIONES: se envían en orden apenas hay señal
  // --------------------------------------------------------------------------
  const enviandoRef = useRef(false);
  const enviarPendientes = useCallback(async () => {
    if (enviandoRef.current || !navigator.onLine) return;
    enviandoRef.current = true;
    setSincronizando(true);
    let enviadas = 0;
    try {
      for (const p of await listarPendientes()) {
        try {
          const res = await api(p.ruta, { method: "PUT", body: JSON.stringify(p.cuerpo), signal: limiteDeTiempo(30000) });
          if (!res.ok) avisar({ titulo: `No se pudo: ${p.descripcion}`, mensaje: await mensajeError(res), tipo: "error", duracion: 9000 });
          else enviadas++;
          await quitarPendiente(p.id); // con error de la API no se reintenta: se avisa al funcionario
        } catch (e) {
          if (esErrorDeRed(e)) break; // sin señal: se reintenta después
          await quitarPendiente(p.id);
        }
      }
    } finally {
      enviandoRef.current = false;
      setSincronizando(false);
      setPendientes(await listarPendientes().catch(() => []));
      if (enviadas) {
        avisar({ titulo: enviadas === 1 ? "Se envió 1 acción pendiente" : `Se enviaron ${enviadas} acciones pendientes`, tipo: "ok" });
        avisarCambio({ tipo: "terreno", departamentoId: perfil?.departamentoId ?? undefined });
        cargar();
      }
    }
  }, [api, avisar, avisarCambio, cargar, perfil?.departamentoId]);

  useEffect(() => { if (enLinea && perfil) enviarPendientes(); }, [enLinea, perfil, enviarPendientes]);
  useEffect(() => {
    if (!pendientes.length) return;
    const id = setInterval(enviarPendientes, 30000);
    return () => clearInterval(id);
  }, [pendientes.length, enviarPendientes]);

  // Aviso con vibración cuando llega una tarea nueva
  const conocidas = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (cargando) return;
    const nuevasIds = tickets.filter(t => t.estado === "EN_REVISION");
    if (conocidas.current) {
      const nuevas = nuevasIds.filter(t => !conocidas.current!.has(t.id));
      if (nuevas.length) {
        try { navigator.vibrate?.([180, 80, 180]); } catch {}
        sonarAlerta("nuevo");
        avisar({ titulo: nuevas.length === 1 ? "Nueva tarea asignada" : `${nuevas.length} tareas nuevas`, mensaje: nuevas[0].categoria?.nombre || nuevas[0].codigoTicket, tipo: "nuevo", accion: { etiqueta: "Ver tarea", onClick: () => setActivoId(nuevas[0].id) } });
      }
    }
    conocidas.current = new Set(nuevasIds.map(t => t.id));
  }, [tickets, cargando, avisar]);

  // --------------------------------------------------------------------------
  // TURNO Y UBICACIÓN (independientes; la ubicación solo durante el turno)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!perfil) return;
    setEnTurno(!!perfil.enTurno);
    try { if (perfil.enTurno && localStorage.getItem("munivox_gps_activo") === "true") setGpsActivo(true); } catch {}
  }, [perfil]);

  const enviarEstadoTrabajo = async (cuerpo: Record<string, unknown>, descripcion: string) => {
    try {
      const res = await api("/operadores/ubicacion", { method: "PUT", body: JSON.stringify(cuerpo), signal: limiteDeTiempo(LIMITE_RED_MS) });
      if (res.ok) avisarUbicacion({ departamentoId: perfil?.departamentoId });
    } catch (e) {
      if (esErrorDeRed(e)) {
        await encolar({ ruta: "/operadores/ubicacion", cuerpo, descripcion });
        setPendientes(await listarPendientes());
      }
    }
  };

  const cambiarTurno = async (valor: boolean) => {
    setEnTurno(valor);
    if (!valor) setGpsActivo(false);
    avisar({ titulo: valor ? "Turno iniciado" : "Turno terminado", mensaje: valor ? "Tu jefatura te ve disponible." : "Dejaste de compartir tu ubicación.", tipo: "ok", duracion: 3000 });
    await enviarEstadoTrabajo({ enTurno: valor, ...(valor ? {} : { gpsActivo: false }) }, valor ? "Iniciar turno" : "Terminar turno");
  };

  useEffect(() => {
    if (!perfil) return;
    try { localStorage.setItem("munivox_gps_activo", String(gpsActivo)); } catch {}

    if (!gpsActivo) {
      setPosicion(null);
      envioRef.current = null;
      if (enTurno) enviarEstadoTrabajo({ gpsActivo: false }, "Dejar de compartir ubicación");
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
        if (!navigator.onLine) return; // sin señal no se acumulan posiciones viejas
        envioRef.current = { t: ahoraMs, lat, lng };
        api("/operadores/ubicacion", { method: "PUT", body: JSON.stringify({ latitud: lat, longitud: lng, gpsActivo: true }), signal: limiteDeTiempo(LIMITE_RED_MS) })
          .then(r => { if (r.ok) { setUltimoEnvio(Date.now()); avisarUbicacion({ departamentoId: perfil.departamentoId }); } })
          .catch(() => { envioRef.current = null; });
      },
      err => {
        setErrorGps(err.code === err.PERMISSION_DENIED ? "Permiso de ubicación denegado. Actívalo en la configuración del navegador." : "No se pudo obtener la posición. Reintentando.");
        if (err.code === err.PERMISSION_DENIED) setGpsActivo(false);
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
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

  useEffect(() => { setMapaInteractivo(false); }, [activoId]);

  useEffect(() => {
    const id = tareaPedida.current;
    if (!id || !datosFrescos) return;
    if (tickets.some(t => t.id === id)) setActivoId(id);
    else avisar({ titulo: "Esa tarea ya no está a tu cargo", mensaje: "Puede haber sido reasignada o cerrada.", tipo: "info" });
    tareaPedida.current = null;
  }, [tickets, datosFrescos, avisar]);

  const alternarNotificaciones = async () => {
    if (cambiandoNotif) return;
    if (!navigator.onLine) { avisar({ titulo: "Necesitas conexión para cambiar las notificaciones", tipo: "alerta" }); return; }
    setCambiandoNotif(true);
    try {
      if (notificaciones === "activas") {
        await desactivarNotificaciones(api);
        avisar({ titulo: "Notificaciones desactivadas", tipo: "ok", duracion: 3000 });
      } else {
        const r = await activarNotificaciones(api);
        avisar({ titulo: r.ok ? "Notificaciones activadas" : "No se activaron", mensaje: r.mensaje, tipo: r.ok ? "ok" : "error", duracion: 7000 });
      }
    } catch {
      avisar({ titulo: "No se pudieron cambiar las notificaciones", tipo: "error" });
    } finally {
      setNotificaciones(await estadoNotificaciones().catch(() => "no-soportadas" as EstadoNotificaciones));
      setCambiandoNotif(false);
    }
  };

  const activo = tickets.find(t => t.id === activoId) || null;

  /** Envía la acción; si no hay señal, la deja en cola y la pantalla avanza igual */
  const actualizar = async (cuerpo: Record<string, unknown>, exito: string, descripcion: string) => {
    if (!activo) return false;
    setProcesando(true);
    const ponerEnCola = async () => {
      await encolar({ ruta: `/tickets/${activo.id}`, cuerpo, descripcion: `${descripcion} ${activo.codigoTicket}`, ticketId: activo.id });
      setPendientes(await listarPendientes());
      avisar({ titulo: "Guardado sin conexión", mensaje: "Se enviará automáticamente cuando vuelva la señal.", tipo: "alerta", duracion: 6000 });
      try { navigator.vibrate?.(60); } catch {}
      return true;
    };
    try {
      if (!navigator.onLine) return await ponerEnCola();
      const res = await api(`/tickets/${activo.id}`, { method: "PUT", body: JSON.stringify(cuerpo), signal: limiteDeTiempo(cuerpo.fotoCierre ? 45000 : LIMITE_RED_MS) });
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
    } catch (e) {
      if (esErrorDeRed(e)) return await ponerEnCola();
      avisar({ titulo: "No se pudo completar", tipo: "error" });
      return false;
    } finally {
      setProcesando(false);
    }
  };

  const confirmar = async () => {
    const texto = textoModal.trim();
    let ok = false;
    if (modal === "ACEPTAR") {
      ok = await actualizar({ nuevoEstado: "DESPACHADO", comentario: "El funcionario tomó el caso." }, "Caso tomado", "Tomar");
      if (ok) setGrupo("EN_CURSO");
    }
    if (modal === "RECHAZAR") {
      ok = await actualizar({ operadorAsignadoId: null, nuevoEstado: "EN_REVISION", comentario: `Rechazado por funcionario: ${texto}` }, "Tarea devuelta a la jefatura", "Rechazar");
      if (ok) setActivoId(null);
    }
    if (modal === "RESOLVER") {
      ok = await actualizar({ nuevoEstado: "RESUELTO", comentario: texto, ...(fotoCierre && { fotoCierre }) }, "Caso cerrado", "Cerrar");
      if (ok) { setActivoId(null); setGrupo("CERRADAS"); setFotoCierre(null); }
    }
    if (ok) { setModal(null); setTextoModal(""); }
  };

  const voyEnCamino = () => actualizar({ enCamino: true }, "Avisamos al vecino que vas en camino", "En camino a");

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

  // Aviso de conexión (sin señal o con acciones por enviar)
  const barraConexion = (!enLinea || pendientes.length > 0) && (
    <div className="anim-aparecer" style={{ background: enLinea ? "var(--aviso-suave)" : "var(--marino-2)", color: enLinea ? "#7A4A00" : "#fff", borderBottom: "1px solid var(--borde)" }}>
      <div className="fila" style={{ ...contenedor, padding: "8px 14px", gap: 10, fontSize: 12.5 }}>
        {enLinea ? <FiUploadCloud size={15} /> : <FiWifiOff size={15} />}
        <span className="crece">
          {!enLinea ? <>Sin conexión. {guardadoEn ? `Tareas guardadas a las ${horaCorta(new Date(guardadoEn))}.` : ""}</> : null}
          {pendientes.length > 0 && <> {pendientes.length} acción{pendientes.length === 1 ? "" : "es"} por enviar{enLinea ? "." : " cuando vuelva la señal."}</>}
        </span>
        {enLinea && pendientes.length > 0 && (
          <button className="btn btn-sm btn-secundario" onClick={enviarPendientes} disabled={sincronizando}>
            {sincronizando ? <span className="girador" style={{ width: 12, height: 12 }} /> : null}{sincronizando ? "Enviando" : "Enviar ahora"}
          </button>
        )}
      </div>
    </div>
  );

  // ============================ DETALLE ============================
  if (activo) {
    const cat = categoriaInfo(activo.categoria?.nombre);
    const km = distanciaA(activo);
    const enCamino = enCaminoDesde(activo);
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
        {barraConexion}

        <div style={{ height: 230, position: "relative", borderBottom: "1px solid var(--borde)", background: "var(--superficie-3)" }}>
          {mapaInteractivo ? (
            <MapaCompacto compacto tickets={[activo]} enfoque={activo.latitud != null ? [activo.latitud, activo.longitud!] : null} funcionarios={yoEnMapa}
              lineaDespacho={posicion && activo.latitud != null && activo.estado === "DESPACHADO" ? { desde: [posicion.lat, posicion.lng], hasta: [activo.latitud, activo.longitud!] } : null} zoomEnfoque={15.5} />
          ) : (
            <MapaEstatico ticket={activo} posicion={posicion} />
          )}
          <div style={{ position: "absolute", left: 10, bottom: 10, zIndex: 5, background: "var(--marino)", color: "#fff", padding: "6px 10px", fontSize: 12 }}>
            <span className="mono" style={{ fontWeight: 600 }}>{km != null ? `${km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`}` : "Comparte tu ubicación para ver la distancia"}</span>
            {km != null && <span style={{ color: "var(--marino-texto)" }}> hasta el lugar</span>}
          </div>
          {!mapaInteractivo && activo.latitud != null && enLinea && (
            <button className="btn btn-sm btn-secundario" style={{ position: "absolute", right: 10, bottom: 10, zIndex: 5 }} onClick={() => setMapaInteractivo(true)}>
              <FiMap size={12} /> Mapa interactivo
            </button>
          )}
        </div>

        <div style={{ ...contenedor, padding: 14, display: "flex", flexDirection: "column", gap: 18, paddingBottom: 170 }}>
          <div className="panel" style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
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
          <div style={{ ...contenedor, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {(activo.estado === "EN_REVISION" || activo.estado === "PENDIENTE") && (
              <div className="fila" style={{ gap: 8 }}>
                <button className="btn btn-lg btn-peligro-borde" style={{ flex: 1 }} onClick={() => { setTextoModal(""); setModal("RECHAZAR"); }}><FiX size={16} /> Rechazar</button>
                <button className="btn btn-lg btn-ok" style={{ flex: 2 }} onClick={() => setModal("ACEPTAR")}><FiCheck size={16} /> Tomar el caso</button>
              </div>
            )}
            {activo.estado === "DESPACHADO" && (
              <>
                {activo.latitud != null && (
                  <div className="fila" style={{ gap: 8 }}>
                    <a className="btn btn-secundario" style={{ flex: 1 }} href={enlaceWaze(activo.latitud, activo.longitud!)} target="_blank" rel="noreferrer"><FiNavigation size={14} /> Waze</a>
                    <a className="btn btn-secundario" style={{ flex: 1 }} href={enlaceGoogleMaps(activo.latitud, activo.longitud!)} target="_blank" rel="noreferrer"><FiMap size={14} /> Google Maps</a>
                  </div>
                )}
                <div className="fila" style={{ gap: 8 }}>
                  <button className="btn btn-lg btn-oscuro" style={{ flex: 1 }} onClick={voyEnCamino} disabled={procesando}
                    title="Avisa al vecino que vas al lugar">
                    <FiTruck size={16} /> {enCamino ? `En camino ${horaCorta(enCamino)}` : "Voy en camino"}
                  </button>
                  <button className="btn btn-lg btn-ok" style={{ flex: 1 }} onClick={() => { setTextoModal(""); setModal("RESOLVER"); }}><FiCheck size={16} /> Resuelto</button>
                </div>
              </>
            )}
            {activo.estado === "RESUELTO" && <div className="fila" style={{ justifyContent: "center", color: "var(--ok)", fontWeight: 600, gap: 8, padding: 8 }}><FiCheck /> Caso cerrado {tiempoRelativo(activo.updatedAt, ahora)}</div>}
          </div>
        </div>

        <Modal abierto={!!modal} onCerrar={() => setModal(null)}
          titulo={modal === "ACEPTAR" ? "Tomar el caso" : modal === "RECHAZAR" ? "Rechazar tarea" : "Cerrar caso"}
          subtitulo={`${activo.codigoTicket} | ${cat.nombre}`}
          pie={<>
            <button className="btn btn-fantasma" onClick={() => setModal(null)}>Volver</button>
            <button className={`btn ${modal === "RECHAZAR" ? "btn-peligro" : "btn-ok"}`} onClick={confirmar} disabled={procesando || (modal !== "ACEPTAR" && textoModal.trim().length < 5)}>
              {procesando ? <span className="girador" style={{ width: 12, height: 12 }} /> : <FiCheck size={14} />}
              {modal === "ACEPTAR" ? "Sí, tomar el caso" : modal === "RECHAZAR" ? "Rechazar" : "Cerrar y avisar al vecino"}
            </button>
          </>}>
          {modal === "ACEPTAR" && (
            <p style={{ margin: 0, lineHeight: 1.6 }}>
              El vecino recibirá un aviso indicando que un funcionario tomó su caso y lo atenderá en los próximos días.
              Cuando vayas al lugar, toca <strong>Voy en camino</strong> para avisarle.
            </p>
          )}
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
              <textarea className="textarea" value={textoModal} onChange={e => setTextoModal(e.target.value)} placeholder="Informe de cierre" maxLength={500} />
              <div className="campo">
                <span className="rotulo">Foto del trabajo terminado (opcional)</span>
                {fotoCierre ? (
                  <div style={{ position: "relative", border: "1px solid var(--borde)" }}>
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
                <span className="texto-3" style={{ fontSize: 11 }}>
                  El vecino verá esta foto junto al informe. Evita que aparezcan personas o patentes.
                  {!enLinea && " Sin señal: la foto se guardará y se enviará después."}
                </span>
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
    <div className="app-liviana" style={{ minHeight: "100vh", background: "var(--fondo)" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 20, background: "var(--marino)", color: "#fff" }}>
        <div className="fila entre" style={{ ...contenedor, padding: "12px 14px" }}>
          <Logo tamano={28} subtitulo="Terreno" />
          <div className="fila" style={{ gap: 12 }}>
            {enLinea ? <IndicadorConexion conectado={conectado} claro /> : <span className="fila rotulo" style={{ gap: 6, color: "#FFB27A" }}><FiWifiOff size={12} /> Sin señal</span>}
            <button onClick={() => signOut({ callbackUrl: "/login" })} aria-label="Cerrar sesión" style={{ width: 36, height: 36, background: "transparent", border: "1px solid var(--marino-borde)", color: "var(--marino-texto)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><FiLogOut size={15} /></button>
          </div>
        </div>
      </header>
      {barraConexion}

      <div style={{ ...contenedor, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Identidad, turno y ubicación */}
        <div className="panel marco anim-arriba">
          <div style={{ padding: 14 }}>
            <div className="rotulo">Funcionario en terreno</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginTop: 2 }}>{perfil.nombre}</div>
            <div className="texto-3" style={{ fontSize: 12 }}>{perfil.departamento?.nombre || "Sin departamento"}</div>
          </div>
          <div className="fila entre" style={{ borderTop: "1px solid var(--borde)", padding: "10px 14px", background: enTurno ? "var(--ok-suave)" : "var(--superficie-2)" }}>
            <span className="fila" style={{ gap: 10 }}>
              <FiBriefcase size={16} color={enTurno ? "var(--ok)" : "var(--texto-3)"} />
              <span>
                <span style={{ display: "block", fontWeight: 600, fontSize: 13 }}>{enTurno ? "En turno" : "Fuera de turno"}</span>
                <span className="texto-3" style={{ fontSize: 11.5 }}>{enTurno ? "Tu jefatura te ve disponible" : "Inicia tu turno para figurar como disponible"}</span>
              </span>
            </span>
            <button className={`interruptor${enTurno ? " activo" : ""}`} onClick={() => cambiarTurno(!enTurno)} aria-label="En turno" style={{ width: 56, height: 30 }} />
          </div>
          <div className="fila entre" style={{ borderTop: "1px solid var(--borde)", padding: "10px 14px", opacity: enTurno ? 1 : 0.55 }}>
            <span className="fila" style={{ gap: 10, minWidth: 0 }}>
              <FiCrosshair size={16} color={gpsActivo ? "var(--ok)" : "var(--texto-3)"} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 600, fontSize: 13 }}>Compartir ubicación</span>
                <span className="texto-3" style={{ fontSize: 11.5 }}>
                  {!enTurno ? "Solo durante el turno. Es opcional."
                    : errorGps ? <span style={{ color: "var(--peligro)" }}>{errorGps}</span>
                    : gpsActivo ? (posicion ? `Precisión ${Math.round(posicion.precision)} m | Enviado ${ultimoEnvio ? horaCorta(new Date(ultimoEnvio)) : "--"}` : "Buscando señal GPS...")
                    : "Opcional: ayuda a asignarte casos cercanos"}
                </span>
              </span>
            </span>
            <button className={`interruptor${gpsActivo ? " activo" : ""}`} onClick={() => enTurno && setGpsActivo(!gpsActivo)} disabled={!enTurno} aria-label="Compartir ubicación" style={{ width: 56, height: 30 }} />
          </div>
          <div className="fila entre" style={{ borderTop: "1px solid var(--borde)", padding: "10px 14px" }}>
            <span className="fila" style={{ gap: 10, minWidth: 0 }}>
              <FiBell size={16} color={notificaciones === "activas" ? "var(--ok)" : "var(--texto-3)"} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 600, fontSize: 13 }}>Notificaciones</span>
                <span className="texto-3" style={{ fontSize: 11.5 }}>
                  {notificaciones === "activas" ? "Te avisamos aunque la app esté cerrada"
                    : notificaciones === "instalar" ? "Primero agrega MuniVox a la pantalla de inicio (Compartir, Agregar a inicio)"
                    : notificaciones === "bloqueadas" ? "Bloqueadas: actívalas en la configuración del navegador"
                    : notificaciones === "no-soportadas" ? "Este navegador no permite notificaciones"
                    : notificaciones === "sin-configurar" ? "Aún no disponibles: falta configurarlas en el servidor"
                    : "Recibe un aviso cuando te asignen una tarea"}
                </span>
              </span>
            </span>
            {["activas", "inactivas"].includes(notificaciones) && (
              <button className={`interruptor${notificaciones === "activas" ? " activo" : ""}`} onClick={alternarNotificaciones} disabled={cambiandoNotif} aria-label="Notificaciones" style={{ width: 56, height: 30, opacity: cambiandoNotif ? 0.6 : 1 }} />
            )}
          </div>
        </div>

        {/* Resumen */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {pestanas.map((p, i) => (
            <button key={p.id} onClick={() => setGrupo(p.id)} className="anim-arriba"
              style={{ ["--i" as any]: i, textAlign: "left", padding: "10px 12px", background: grupo === p.id ? "var(--marino)" : "var(--superficie)", color: grupo === p.id ? "#fff" : "var(--texto)", border: `1px solid ${grupo === p.id ? "var(--marino)" : "var(--borde)"}`, transition: "background-color 0.2s, color 0.2s" }}>
              <div className="rotulo" style={{ color: grupo === p.id ? "var(--marino-texto)" : undefined }}>{p.etiqueta}</div>
              <div className="mono" style={{ fontSize: 24, fontWeight: 600, marginTop: 2, color: p.id === "NUEVAS" && grupos.NUEVAS.length && grupo !== p.id ? "var(--alerta)" : undefined }}>{grupos[p.id].length}</div>
            </button>
          ))}
        </div>

        {posicion && grupo !== "CERRADAS" && grupos[grupo].length > 1 && (
          <div className="segmentos" style={{ alignSelf: "flex-start" }}>
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
            const pendiente = pendientes.some(p => p.ticketId === t.id);
            return (
              <button key={t.id} onClick={() => setActivoId(t.id)} className="item-lista anim-arriba" style={{ ["--color-item" as any]: cat.color, ["--i" as any]: Math.min(i, 5), padding: "14px 14px 14px 18px" }}>
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
                  {pendiente ? <span className="fila" style={{ gap: 4, color: "var(--aviso)", fontSize: 11, fontWeight: 600 }}><FiUploadCloud size={12} /> Por enviar</span>
                    : urgente && t.estado !== "RESUELTO" ? <span className="fila" style={{ gap: 4, color: "var(--peligro)", fontSize: 11, fontWeight: 600 }}><FiAlertTriangle size={12} /> Urgente</span>
                    : t.estado !== "RESUELTO" ? <IndicadorSla ticket={t} ahora={ahora} />
                    : <span className="texto-3" style={{ fontSize: 11 }}>Cerrado {horaCorta(t.updatedAt)}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
