"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiPlus, FiRefreshCw, FiFileText, FiAlertTriangle, FiExternalLink } from "react-icons/fi";
import { useApi, mensajeError } from "../lib/useApi";
import { fechaHora, formatearTelefono, normalizar } from "../lib/constantes";
import { Modal, Vacio, Esqueleto, Kpi } from "./ui/Comunes";
import { useAvisos } from "./ui/Avisos";

// ============================================================================
// SOLICITUDES SOBRE DATOS PERSONALES (derechos del titular, Ley 21.719)
// ============================================================================
type TipoSolicitud = "ACCESO" | "RECTIFICACION" | "SUPRESION" | "OPOSICION";

interface Solicitud {
  id: string;
  tipo: TipoSolicitud;
  estado: "PENDIENTE" | "RESUELTA" | "RECHAZADA";
  canal: string;
  detalle: string | null;
  respuesta: string | null;
  createdAt: string;
  resueltaEn: string | null;
  ciudadano: { id: string; telefono: string; createdAt: string; _count?: { reportes: number } };
  operador?: { nombre: string } | null;
}

const PLAZO_DIAS = 30; // días corridos para responder

const TIPOS: Record<TipoSolicitud, { etiqueta: string; descripcion: string; color: string; plantilla: string }> = {
  ACCESO: {
    etiqueta: "Acceso", color: "#1D4ED8", descripcion: "El vecino quiere saber qué datos suyos tenemos.",
    plantilla: "Te informamos que la Municipalidad de Buin mantiene tu número de teléfono y los mensajes, fotografías y ubicaciones de tus reportes, solo para atenderlos. Puedes escribir \"mis datos\" en este chat para recibir el detalle en cualquier momento.",
  },
  RECTIFICACION: {
    etiqueta: "Rectificación", color: "#B7791F", descripcion: "El vecino pide corregir un dato incorrecto.",
    plantilla: "Corregimos la información que nos indicaste. Gracias por avisarnos.",
  },
  SUPRESION: {
    etiqueta: "Supresión", color: "#C92A2A", descripcion: "El vecino pide eliminar sus datos.",
    plantilla: "Eliminamos tus datos personales de MuniVox: tu número, tus mensajes y tus fotografías. Solo conservamos información estadística que no permite identificarte. Desde ahora no recibirás más avisos de tus reportes anteriores.",
  },
  OPOSICION: {
    etiqueta: "Oposición", color: "#7048E8", descripcion: "El vecino se opone a un uso específico de sus datos.",
    plantilla: "Registramos tu oposición y dejaremos de usar tus datos para el fin que indicaste.",
  },
};

const diasRestantes = (creada: string, ahora: number) => PLAZO_DIAS - Math.floor((ahora - new Date(creada).getTime()) / 86400000);

export function SolicitudesDatos({ ahora }: { ahora: number }) {
  const api = useApi();
  const avisar = useAvisos();
  const [lista, setLista] = useState<Solicitud[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<"PENDIENTE" | "TODAS">("PENDIENTE");
  const [respondiendo, setRespondiendo] = useState<Solicitud | null>(null);
  const [form, setForm] = useState({ estado: "RESUELTA" as "RESUELTA" | "RECHAZADA", respuesta: "", anonimizar: true, notificar: true });
  const [nueva, setNueva] = useState(false);
  const [formNueva, setFormNueva] = useState({ telefono: "", tipo: "ACCESO" as TipoSolicitud, canal: "CORREO", detalle: "" });
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    const res = await api("/solicitudes");
    if (res.ok) { setLista(await res.json()); setError(null); }
    else setError(res.status === 404 ? "Falta crear la ruta GET /solicitudes en API Gateway." : await mensajeError(res));
  }, [api]);
  useEffect(() => { cargar(); }, [cargar]);

  const visibles = useMemo(() => (lista || []).filter(s => filtro === "TODAS" || s.estado === "PENDIENTE"), [lista, filtro]);
  const resumen = useMemo(() => {
    const p = (lista || []).filter(s => s.estado === "PENDIENTE");
    return {
      pendientes: p.length,
      porVencer: p.filter(s => { const d = diasRestantes(s.createdAt, ahora); return d >= 0 && d <= 5; }).length,
      vencidas: p.filter(s => diasRestantes(s.createdAt, ahora) < 0).length,
      resueltas: (lista || []).filter(s => s.estado !== "PENDIENTE" && s.resueltaEn && ahora - new Date(s.resueltaEn).getTime() < 30 * 86400000).length,
    };
  }, [lista, ahora]);

  const abrir = (s: Solicitud) => {
    setRespondiendo(s);
    setForm({ estado: "RESUELTA", respuesta: TIPOS[s.tipo].plantilla, anonimizar: s.tipo === "SUPRESION", notificar: true });
  };

  const responder = async () => {
    if (!respondiendo) return;
    setGuardando(true);
    const res = await api(`/solicitudes/${respondiendo.id}`, { method: "PUT", body: JSON.stringify(form) });
    setGuardando(false);
    if (!res.ok) { avisar({ titulo: "No se guardó la respuesta", mensaje: await mensajeError(res), tipo: "error" }); return; }
    const r = await res.json();
    avisar({
      titulo: form.estado === "RESUELTA" ? "Solicitud resuelta" : "Solicitud rechazada",
      mensaje: [r.anonimizado ? "Datos del vecino anonimizados." : "", form.notificar ? (r.avisado ? "Respuesta enviada por WhatsApp." : "No se pudo enviar por WhatsApp: responde por otro medio.") : ""].join(" ").trim() || undefined,
      tipo: form.notificar && !r.avisado ? "alerta" : "ok", duracion: 7000,
    });
    setRespondiendo(null);
    cargar();
  };

  const registrar = async () => {
    setGuardando(true);
    const res = await api("/solicitudes", { method: "POST", body: JSON.stringify(formNueva) });
    setGuardando(false);
    if (!res.ok) {
      avisar({ titulo: "No se registró", mensaje: await mensajeError(res, res.status === 404 ? "Falta crear la ruta POST /solicitudes en API Gateway." : undefined), tipo: "error" });
      return;
    }
    avisar({ titulo: "Solicitud registrada", mensaje: `Plazo de respuesta: ${PLAZO_DIAS} días corridos`, tipo: "ok" });
    setNueva(false);
    setFormNueva({ telefono: "", tipo: "ACCESO", canal: "CORREO", detalle: "" });
    cargar();
  };

  if (error) return <Vacio icono={<FiAlertTriangle size={20} />} titulo="No se pudieron cargar las solicitudes" texto={error} />;

  return (
    <div className="columna" style={{ gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
        <Kpi i={0} titulo="Pendientes" valor={resumen.pendientes} color="var(--acento)" />
        <Kpi i={1} titulo="Vencen en 5 días o menos" valor={resumen.porVencer} color="var(--alerta)" />
        <Kpi i={2} titulo="Fuera de plazo" valor={resumen.vencidas} color="var(--peligro)" detalle={`Plazo legal: ${PLAZO_DIAS} días corridos`} />
        <Kpi i={3} titulo="Respondidas (30 días)" valor={resumen.resueltas} color="var(--ok)" />
      </div>

      <div className="fila entre" style={{ flexWrap: "wrap", gap: 10 }}>
        <div className="segmentos">
          <button className={`segmento${filtro === "PENDIENTE" ? " activo" : ""}`} onClick={() => setFiltro("PENDIENTE")}>Pendientes</button>
          <button className={`segmento${filtro === "TODAS" ? " activo" : ""}`} onClick={() => setFiltro("TODAS")}>Todas</button>
        </div>
        <div className="fila">
          <a className="btn btn-fantasma btn-sm" href="/privacidad" target="_blank" rel="noreferrer"><FiExternalLink size={12} /> Política publicada</a>
          <button className="btn-icono" onClick={cargar} title="Actualizar"><FiRefreshCw size={14} /></button>
          <button className="btn btn-primario btn-sm" onClick={() => setNueva(true)}><FiPlus size={13} /> Registrar solicitud</button>
        </div>
      </div>

      <div className="texto-3" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
        Los vecinos pueden pedir por WhatsApp ver sus datos (se responde solo) o eliminarlos (llega aquí). Registra aquí las solicitudes que lleguen por correo o en persona.
      </div>

      {!lista ? <Esqueleto alto={48} filas={4} /> : visibles.length === 0 ? (
        <Vacio titulo={filtro === "PENDIENTE" ? "No hay solicitudes pendientes" : "Aún no hay solicitudes"} />
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, background: "var(--superficie)", border: "1px solid var(--borde)" }}>
          <thead style={{ background: "var(--superficie-2)" }}>
            <tr style={{ textAlign: "left" }}>
              {["Recibida", "Tipo", "Vecino", "Canal", "Plazo", "Estado", ""].map(h => <th key={h} className="rotulo" style={{ padding: "10px 12px", borderBottom: "1px solid var(--borde)" }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {visibles.map((s, i) => {
              const dias = diasRestantes(s.createdAt, ahora);
              const pendiente = s.estado === "PENDIENTE";
              return (
                <tr key={s.id} className="anim-arriba" style={{ ["--i" as any]: Math.min(i, 12) }}>
                  <td className="mono" style={{ padding: "10px 12px", borderBottom: "1px solid var(--borde)", fontSize: 11.5 }}>{fechaHora(s.createdAt)}</td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--borde)" }}><span className="insignia" style={{ color: TIPOS[s.tipo]?.color }}>{TIPOS[s.tipo]?.etiqueta || s.tipo}</span></td>
                  <td className="mono" style={{ padding: "10px 12px", borderBottom: "1px solid var(--borde)" }}>{s.ciudadano.telefono.startsWith("anonimo-") ? "Anónimo" : formatearTelefono(s.ciudadano.telefono)}</td>
                  <td className="texto-2" style={{ padding: "10px 12px", borderBottom: "1px solid var(--borde)", fontSize: 11.5 }}>{s.canal}</td>
                  <td className="mono" style={{ padding: "10px 12px", borderBottom: "1px solid var(--borde)", fontWeight: 600, color: !pendiente ? "var(--texto-3)" : dias < 0 ? "var(--peligro)" : dias <= 5 ? "var(--alerta)" : "var(--ok)" }}>
                    {!pendiente ? "--" : dias < 0 ? `Vencida hace ${-dias} d` : `${dias} d`}
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--borde)" }}>
                    <span className="insignia" style={{ color: s.estado === "PENDIENTE" ? "var(--acento)" : s.estado === "RESUELTA" ? "var(--ok)" : "var(--texto-3)" }}>{s.estado === "PENDIENTE" ? "Pendiente" : s.estado === "RESUELTA" ? "Resuelta" : "Rechazada"}</span>
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--borde)", textAlign: "right" }}>
                    {pendiente
                      ? <button className="btn btn-sm btn-primario" onClick={() => abrir(s)}>Responder</button>
                      : <span className="texto-3" style={{ fontSize: 11 }} title={s.respuesta || ""}>{s.operador?.nombre || "Automática"}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Responder */}
      <Modal abierto={!!respondiendo} onCerrar={() => setRespondiendo(null)} ancho={560}
        titulo={`Responder solicitud de ${respondiendo ? TIPOS[respondiendo.tipo].etiqueta.toLowerCase() : ""}`}
        subtitulo={respondiendo ? `${formatearTelefono(respondiendo.ciudadano.telefono)} | ${respondiendo.ciudadano._count?.reportes ?? 0} reportes | recibida ${fechaHora(respondiendo.createdAt)}` : ""}
        pie={<>
          <button className="btn btn-fantasma" onClick={() => setRespondiendo(null)}>Cancelar</button>
          <button className={`btn ${form.anonimizar && form.estado === "RESUELTA" ? "btn-peligro" : "btn-primario"}`} onClick={responder} disabled={guardando || form.respuesta.trim().length < 5}>
            {guardando ? "Guardando" : form.anonimizar && form.estado === "RESUELTA" ? "Responder y anonimizar" : "Guardar respuesta"}
          </button>
        </>}>
        {respondiendo && (
          <>
            <div style={{ background: "var(--superficie-2)", border: "1px solid var(--borde)", padding: "10px 12px", fontSize: 12.5 }}>
              <strong>{TIPOS[respondiendo.tipo].descripcion}</strong>
              {respondiendo.detalle && <div className="texto-2" style={{ marginTop: 4 }}>{respondiendo.detalle}</div>}
            </div>
            <div className="segmentos" style={{ display: "flex" }}>
              <button className={`segmento${form.estado === "RESUELTA" ? " activo" : ""}`} style={{ flex: 1 }} onClick={() => setForm({ ...form, estado: "RESUELTA" })}>Acoger</button>
              <button className={`segmento${form.estado === "RECHAZADA" ? " activo" : ""}`} style={{ flex: 1 }} onClick={() => setForm({ ...form, estado: "RECHAZADA", anonimizar: false, respuesta: "" })}>Rechazar con fundamento</button>
            </div>
            <label className="campo">
              <span className="rotulo">Respuesta para el vecino</span>
              <textarea className="textarea" style={{ minHeight: 120 }} value={form.respuesta} onChange={e => setForm({ ...form, respuesta: e.target.value })} maxLength={1500}
                placeholder={form.estado === "RECHAZADA" ? "Explica el fundamento legal del rechazo. El vecino puede reclamar ante la Agencia de Protección de Datos Personales." : ""} />
            </label>
            {respondiendo.tipo === "SUPRESION" && form.estado === "RESUELTA" && (
              <label className="fila" style={{ gap: 10, alignItems: "flex-start", cursor: "pointer", padding: 10, border: "1px solid var(--peligro)", background: "var(--peligro-suave)" }}>
                <input type="checkbox" checked={form.anonimizar} onChange={e => setForm({ ...form, anonimizar: e.target.checked })} style={{ marginTop: 3 }} />
                <span style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                  <strong>Anonimizar ahora:</strong> se reemplaza el teléfono, se borran los relatos y las fotos de todos sus reportes. Los reportes quedan para estadística. <strong>No se puede deshacer.</strong>
                </span>
              </label>
            )}
            <label className="fila" style={{ gap: 10, cursor: "pointer", fontSize: 12.5 }}>
              <input type="checkbox" checked={form.notificar} onChange={e => setForm({ ...form, notificar: e.target.checked })} />
              Enviar la respuesta al vecino por WhatsApp
            </label>
          </>
        )}
      </Modal>

      {/* Registrar */}
      <Modal abierto={nueva} onCerrar={() => setNueva(false)} titulo="Registrar solicitud" subtitulo="Para solicitudes recibidas por correo, en la OIRS o en persona"
        pie={<>
          <button className="btn btn-fantasma" onClick={() => setNueva(false)}>Cancelar</button>
          <button className="btn btn-primario" onClick={registrar} disabled={guardando || formNueva.telefono.replace(/\D/g, "").length < 8}>Registrar</button>
        </>}>
        <label className="campo"><span className="rotulo">Teléfono del vecino (el que usa en WhatsApp)</span>
          <input className="input mono" inputMode="numeric" placeholder="9 1234 5678" value={formNueva.telefono} onChange={e => setFormNueva({ ...formNueva, telefono: e.target.value })} />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label className="campo"><span className="rotulo">Tipo</span>
            <select className="select" value={formNueva.tipo} onChange={e => setFormNueva({ ...formNueva, tipo: e.target.value as TipoSolicitud })}>
              {(Object.keys(TIPOS) as TipoSolicitud[]).map(t => <option key={t} value={t}>{TIPOS[t].etiqueta}</option>)}
            </select>
          </label>
          <label className="campo"><span className="rotulo">Canal</span>
            <select className="select" value={formNueva.canal} onChange={e => setFormNueva({ ...formNueva, canal: e.target.value })}>
              <option value="CORREO">Correo electrónico</option>
              <option value="PRESENCIAL">Presencial / OIRS</option>
              <option value="CARTA">Carta</option>
            </select>
          </label>
        </div>
        <label className="campo"><span className="rotulo">Qué solicita</span>
          <textarea className="textarea" value={formNueva.detalle} onChange={e => setFormNueva({ ...formNueva, detalle: e.target.value })} maxLength={2000} />
        </label>
      </Modal>
    </div>
  );
}

// ============================================================================
// BITÁCORA DE AUDITORÍA
// ============================================================================
interface RegistroAuditoria {
  id: string;
  accion: string;
  entidad: string;
  entidadId: string | null;
  detalle: string | null;
  createdAt: string;
  operador?: { nombre: string; email: string } | null;
}

const ACCIONES: Record<string, string> = {
  REGISTRO_PERSONAL: "Primer ingreso de personal",
  EDITAR_PERSONAL: "Edición de personal",
  CONSULTA_VECINOS: "Consulta del listado de vecinos",
  BLOQUEAR_VECINO: "Bloqueo de vecino",
  DESBLOQUEAR_VECINO: "Desbloqueo de vecino",
  ANONIMIZAR_VECINO: "Anonimización de vecino",
  REGISTRAR_SOLICITUD: "Registro de solicitud de datos",
  RESOLVER_SOLICITUD: "Respuesta a solicitud de datos",
  RETENCION_AUTOMATICA: "Depuración automática por plazo",
};

export function Auditoria() {
  const api = useApi();
  const [lista, setLista] = useState<RegistroAuditoria[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accion, setAccion] = useState("TODAS");
  const [busqueda, setBusqueda] = useState("");

  const cargar = useCallback(async () => {
    const res = await api("/auditoria");
    if (res.ok) { setLista(await res.json()); setError(null); }
    else setError(res.status === 404 ? "Falta crear la ruta GET /auditoria en API Gateway." : await mensajeError(res));
  }, [api]);
  useEffect(() => { cargar(); }, [cargar]);

  const visibles = useMemo(() => {
    const q = normalizar(busqueda);
    return (lista || []).filter(r => (accion === "TODAS" || r.accion === accion) && (!q || normalizar(`${r.detalle} ${r.operador?.nombre} ${r.operador?.email}`).includes(q)));
  }, [lista, accion, busqueda]);

  const exportar = () => {
    const filas = [["fecha", "persona", "correo", "accion", "entidad", "detalle"], ...visibles.map(r => [fechaHora(r.createdAt), r.operador?.nombre || "Sistema", r.operador?.email || "", ACCIONES[r.accion] || r.accion, r.entidad, r.detalle || ""])];
    const csv = "﻿" + filas.map(f => f.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `MuniVox_Auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (error) return <Vacio icono={<FiAlertTriangle size={20} />} titulo="No se pudo cargar la bitácora" texto={error} />;

  return (
    <div className="columna" style={{ gap: 12 }}>
      <div className="fila entre" style={{ flexWrap: "wrap", gap: 10 }}>
        <div className="fila" style={{ gap: 8 }}>
          <select className="select" style={{ width: 260, height: 32 }} value={accion} onChange={e => setAccion(e.target.value)}>
            <option value="TODAS">Todas las acciones</option>
            {Object.entries(ACCIONES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input className="input" style={{ width: 240, height: 32 }} placeholder="Buscar persona o detalle" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <div className="fila">
          <button className="btn-icono" onClick={cargar} title="Actualizar"><FiRefreshCw size={14} /></button>
          <button className="btn btn-secundario btn-sm" onClick={exportar} disabled={!visibles.length}><FiFileText size={12} /> Exportar CSV</button>
        </div>
      </div>
      <div className="texto-3" style={{ fontSize: 11.5 }}>Registro de acciones sensibles sobre datos personales y permisos (últimos 500). Sirve para acreditar el cumplimiento ante la Agencia de Protección de Datos Personales.</div>
      {!lista ? <Esqueleto alto={40} filas={6} /> : visibles.length === 0 ? <Vacio titulo="Sin registros" /> : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, background: "var(--superficie)", border: "1px solid var(--borde)" }}>
          <thead style={{ background: "var(--superficie-2)" }}>
            <tr style={{ textAlign: "left" }}>
              {["Fecha", "Persona", "Acción", "Detalle"].map(h => <th key={h} className="rotulo" style={{ padding: "10px 12px", borderBottom: "1px solid var(--borde)" }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {visibles.map((r, i) => (
              <tr key={r.id} className="anim-arriba" style={{ ["--i" as any]: Math.min(i, 12) }}>
                <td className="mono" style={{ padding: "9px 12px", borderBottom: "1px solid var(--borde)", fontSize: 11.5, whiteSpace: "nowrap" }}>{fechaHora(r.createdAt)}</td>
                <td style={{ padding: "9px 12px", borderBottom: "1px solid var(--borde)" }}>
                  <div style={{ fontWeight: 600 }}>{r.operador?.nombre || "Sistema"}</div>
                  {r.operador?.email && <div className="texto-3 mono" style={{ fontSize: 10.5 }}>{r.operador.email}</div>}
                </td>
                <td style={{ padding: "9px 12px", borderBottom: "1px solid var(--borde)" }}>{ACCIONES[r.accion] || r.accion}</td>
                <td className="texto-2" style={{ padding: "9px 12px", borderBottom: "1px solid var(--borde)", fontSize: 12 }}>{r.detalle}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
