"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiUsers, FiGrid, FiShield, FiSearch, FiEdit2, FiRefreshCw, FiInfo, FiLock, FiUnlock } from "react-icons/fi";
import type { Operador, Ciudadano, Ticket, Rol } from "../lib/tipos";
import { DEPARTAMENTOS, ESTADOS_ACTIVOS, normalizar, tiempoRelativo, formatearTelefono, slaDe, fechaHora, ESTADOS } from "../lib/constantes";
import { useApi, mensajeError } from "../lib/useApi";
import { Modal, Vacio, Esqueleto } from "./ui/Comunes";
import { useAvisos } from "./ui/Avisos";

const ROLES: Record<Rol, { etiqueta: string; color: string; descripcion: string }> = {
  ADMINISTRADOR: { etiqueta: "Central C4", color: "#7048E8", descripcion: "Ve todo, deriva entre departamentos y administra" },
  OPERADOR: { etiqueta: "Jefatura", color: "#1D4ED8", descripcion: "Gestiona los reportes de su departamento" },
  TERRENO: { etiqueta: "Terreno", color: "#2B8A3E", descripcion: "Atiende las tareas que le asignan" },
};

type Pestana = "PERSONAL" | "DEPARTAMENTOS" | "VECINOS";

export default function AdminPanel({ tickets, ahora, miId }: { tickets: Ticket[]; ahora: number; miId?: string }) {
  const api = useApi();
  const avisar = useAvisos();
  const [pestana, setPestana] = useState<Pestana>("PERSONAL");
  const [operadores, setOperadores] = useState<Operador[] | null>(null);
  const [ciudadanos, setCiudadanos] = useState<Ciudadano[] | null>(null);
  const [errorCiudadanos, setErrorCiudadanos] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroRol, setFiltroRol] = useState<Rol | "TODOS">("TODOS");
  const [editando, setEditando] = useState<Operador | null>(null);
  const [form, setForm] = useState({ nombre: "", rol: "OPERADOR" as Rol, departamentoId: "" as string });
  const [guardando, setGuardando] = useState(false);
  const [bloqueando, setBloqueando] = useState<Ciudadano | null>(null);

  const cargarOperadores = useCallback(async () => {
    const res = await api("/operadores");
    if (res.ok) setOperadores(await res.json());
    else avisar({ titulo: "No se pudo cargar el personal", mensaje: await mensajeError(res), tipo: "error" });
  }, [api, avisar]);

  const cargarCiudadanos = useCallback(async () => {
    const res = await api("/ciudadanos");
    if (res.ok) { setCiudadanos(await res.json()); setErrorCiudadanos(null); }
    else setErrorCiudadanos(res.status === 404 ? "La ruta GET /ciudadanos aún no está creada en API Gateway." : await mensajeError(res));
  }, [api]);

  useEffect(() => { cargarOperadores(); }, [cargarOperadores]);
  useEffect(() => { if (pestana === "VECINOS" && !ciudadanos) cargarCiudadanos(); }, [pestana, ciudadanos, cargarCiudadanos]);

  const abrirEdicion = (o: Operador) => {
    setEditando(o);
    setForm({ nombre: o.nombre, rol: o.rol, departamentoId: o.departamentoId ? String(o.departamentoId) : "" });
  };

  const guardar = async () => {
    if (!editando) return;
    setGuardando(true);
    const res = await api(`/operadores/${editando.id}`, {
      method: "PUT",
      body: JSON.stringify({ nombre: form.nombre, rol: form.rol, departamentoId: form.departamentoId ? Number(form.departamentoId) : null }),
    });
    setGuardando(false);
    if (res.ok) {
      avisar({ titulo: "Cambios guardados", mensaje: `${form.nombre} | ${ROLES[form.rol].etiqueta}`, tipo: "ok" });
      setEditando(null);
      cargarOperadores();
    } else {
      avisar({ titulo: "No se guardó", mensaje: res.status === 404 ? "Falta crear la ruta PUT /operadores/{id} en API Gateway." : await mensajeError(res), tipo: "error" });
    }
  };

  const alternarBloqueo = async (c: Ciudadano) => {
    const res = await api(`/ciudadanos/${c.id}`, { method: "PUT", body: JSON.stringify({ baneado: !c.baneado }) });
    setBloqueando(null);
    if (res.ok) {
      avisar({ titulo: c.baneado ? "Número desbloqueado" : "Número bloqueado", mensaje: formatearTelefono(c.telefono), tipo: "ok" });
      cargarCiudadanos();
    } else {
      avisar({ titulo: "No se pudo actualizar", mensaje: res.status === 404 ? "Falta crear la ruta PUT /ciudadanos/{id} en API Gateway." : await mensajeError(res), tipo: "error" });
    }
  };

  const personal = useMemo(() => {
    const q = normalizar(busqueda);
    return (operadores || []).filter(o => (filtroRol === "TODOS" || o.rol === filtroRol) && (!q || normalizar(`${o.nombre} ${o.email} ${o.departamento?.nombre}`).includes(q)));
  }, [operadores, busqueda, filtroRol]);

  const vecinos = useMemo(() => {
    const q = busqueda.replace(/\D/g, "");
    return (ciudadanos || []).filter(c => !q || c.telefono.includes(q));
  }, [ciudadanos, busqueda]);

  const resumenDeptos = useMemo(() => DEPARTAMENTOS.map(d => {
    const del = tickets.filter(t => t.departamentoId === d.id);
    const activos = del.filter(t => ESTADOS_ACTIVOS.includes(t.estado));
    const personalD = (operadores || []).filter(o => o.departamentoId === d.id);
    return {
      ...d,
      activos: activos.length,
      porAsignar: activos.filter(t => !t.operadorAsignadoId).length,
      enTerreno: activos.filter(t => t.estado === "DESPACHADO").length,
      atrasados: activos.filter(t => slaDe(t, ahora).vencido).length,
      resueltos30: del.filter(t => t.estado === "RESUELTO" && ahora - new Date(t.updatedAt || t.createdAt).getTime() < 30 * 86400000).length,
      jefaturas: personalD.filter(o => o.rol === "OPERADOR").length,
      terreno: personalD.filter(o => o.rol === "TERRENO").length,
      gps: personalD.filter(o => o.rol === "TERRENO" && o.gpsActivo).length,
    };
  }), [tickets, operadores, ahora]);

  const pestanas: { id: Pestana; etiqueta: string; icono: React.ReactNode; n?: number }[] = [
    { id: "PERSONAL", etiqueta: "Personal", icono: <FiUsers size={14} />, n: operadores?.length },
    { id: "DEPARTAMENTOS", etiqueta: "Departamentos", icono: <FiGrid size={14} />, n: DEPARTAMENTOS.length },
    { id: "VECINOS", etiqueta: "Vecinos", icono: <FiShield size={14} />, n: ciudadanos?.length },
  ];

  return (
    <div className="panel" style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div className="fila entre" style={{ padding: "0 16px", borderBottom: "1px solid var(--borde)" }}>
        <div className="pestanas" style={{ borderBottom: 0 }}>
          {pestanas.map(p => (
            <button key={p.id} className={`pestana${pestana === p.id ? " activa" : ""}`} onClick={() => { setPestana(p.id); setBusqueda(""); }}>
              {p.icono}{p.etiqueta}{p.n != null && <span className="contador">{p.n}</span>}
            </button>
          ))}
        </div>
        <div className="fila">
          {pestana !== "DEPARTAMENTOS" && (
            <div className="input-con-icono" style={{ width: 240 }}>
              <FiSearch size={14} />
              <input className="input" style={{ height: 32 }} placeholder={pestana === "VECINOS" ? "Buscar teléfono" : "Buscar nombre, correo o área"} value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            </div>
          )}
          <button className="btn-icono" onClick={() => (pestana === "VECINOS" ? cargarCiudadanos() : cargarOperadores())} title="Actualizar"><FiRefreshCw size={14} /></button>
        </div>
      </div>

      <div className="desplazable" style={{ flex: 1, padding: 16 }}>
        {/* ================= PERSONAL ================= */}
        {pestana === "PERSONAL" && (
          <div className="columna" style={{ gap: 12 }}>
            <div className="fila entre" style={{ flexWrap: "wrap", gap: 10 }}>
              <div className="segmentos">
                <button className={`segmento${filtroRol === "TODOS" ? " activo" : ""}`} onClick={() => setFiltroRol("TODOS")}>Todos</button>
                {(Object.keys(ROLES) as Rol[]).map(r => (
                  <button key={r} className={`segmento${filtroRol === r ? " activo" : ""}`} onClick={() => setFiltroRol(r)}>{ROLES[r].etiqueta}</button>
                ))}
              </div>
              <div className="fila texto-3" style={{ fontSize: 11.5, gap: 6 }}>
                <FiInfo size={13} /> Las cuentas se crean en Cognito; aparecen aquí al primer ingreso y luego puedes ajustar su rol y área.
              </div>
            </div>
            {!operadores ? <Esqueleto alto={48} filas={6} /> : personal.length === 0 ? <Vacio titulo="Sin resultados" /> : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, background: "var(--superficie)", border: "1px solid var(--borde)" }}>
                <thead style={{ background: "var(--superficie-2)" }}>
                  <tr style={{ textAlign: "left" }}>
                    {["Nombre", "Rol", "Departamento", "GPS", "Tareas activas", "Última posición", ""].map(h => <th key={h} className="rotulo" style={{ padding: "10px 12px", borderBottom: "1px solid var(--borde)" }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {personal.map((o, i) => (
                    <tr key={o.id} className="anim-arriba" style={{ ["--i" as any]: Math.min(i, 15) }}>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--borde)" }}>
                        <div className="fila" style={{ gap: 10 }}>
                          <span className="mono" style={{ width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", background: ROLES[o.rol].color, color: "#fff", fontWeight: 600, fontSize: 11, flexShrink: 0 }}>
                            {o.nombre.split(/\s+/).map(p => p[0]).join("").slice(0, 2).toUpperCase()}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600 }}>{o.nombre}{o.id === miId && <span className="texto-3" style={{ fontWeight: 400 }}> (tú)</span>}</div>
                            <div className="texto-3 mono" style={{ fontSize: 11 }}>{o.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--borde)" }}><span className="insignia" style={{ color: ROLES[o.rol].color }}>{ROLES[o.rol].etiqueta}</span></td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--borde)" }}>
                        {o.departamento ? <span className="fila" style={{ gap: 6 }}><span className="punto" style={{ background: DEPARTAMENTOS.find(d => d.id === o.departamentoId)?.color }} />{o.departamento.nombre}</span> : <span className="texto-3">Sin área</span>}
                      </td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--borde)" }}>
                        {o.rol === "TERRENO" ? <span className="fila" style={{ gap: 6, fontSize: 11, fontWeight: 600, color: o.gpsActivo ? "var(--ok)" : "var(--texto-3)" }}><span className={o.gpsActivo ? "vivo" : "punto"} />{o.gpsActivo ? "Activo" : "Apagado"}</span> : <span className="texto-3">--</span>}
                      </td>
                      <td className="mono" style={{ padding: "10px 12px", borderBottom: "1px solid var(--borde)" }}>{o.rol === "TERRENO" ? o._count?.ticketsAsignados ?? 0 : "--"}</td>
                      <td className="texto-3" style={{ padding: "10px 12px", borderBottom: "1px solid var(--borde)", fontSize: 11.5 }}>{o.ultimaUbicacion ? tiempoRelativo(o.ultimaUbicacion, ahora) : "--"}</td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--borde)", textAlign: "right" }}>
                        <button className="btn btn-sm btn-secundario" onClick={() => abrirEdicion(o)}><FiEdit2 size={12} /> Editar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ================= DEPARTAMENTOS ================= */}
        {pestana === "DEPARTAMENTOS" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            {resumenDeptos.map((d, i) => (
              <div key={d.id} className="panel anim-arriba" style={{ ["--i" as any]: i, borderTop: `4px solid ${d.color}` }}>
                <div className="panel-cuerpo">
                  <div className="fila entre">
                    <div>
                      <div className="rotulo">{d.sigla}</div>
                      <div className="titulo-2" style={{ marginTop: 2 }}>{d.nombre}</div>
                    </div>
                    <span className="mono" style={{ fontSize: 28, fontWeight: 600, color: d.color }}>{d.activos}</span>
                  </div>
                  <div className="texto-3" style={{ fontSize: 11, textAlign: "right", marginTop: -4 }}>casos activos</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "var(--borde)", border: "1px solid var(--borde)", marginTop: 12 }}>
                    {[
                      ["Por asignar", d.porAsignar, d.porAsignar ? "var(--alerta)" : undefined],
                      ["En terreno", d.enTerreno, undefined],
                      ["Fuera de plazo", d.atrasados, d.atrasados ? "var(--peligro)" : undefined],
                      ["Resueltos 30 días", d.resueltos30, "var(--ok)"],
                      ["Jefaturas", d.jefaturas, undefined],
                      ["Funcionarios (GPS)", `${d.terreno} (${d.gps})`, undefined],
                    ].map(([r, v, c]) => (
                      <div key={r as string} style={{ background: "var(--superficie)", padding: "8px 10px" }}>
                        <div className="rotulo" style={{ fontSize: 9 }}>{r}</div>
                        <div className="mono" style={{ fontSize: 16, fontWeight: 600, color: c as string | undefined }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ================= VECINOS ================= */}
        {pestana === "VECINOS" && (
          errorCiudadanos ? <Vacio titulo="No se pudo cargar la lista" texto={errorCiudadanos} /> :
          !ciudadanos ? <Esqueleto alto={44} filas={6} /> :
          vecinos.length === 0 ? <Vacio titulo="Sin resultados" /> : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, background: "var(--superficie)", border: "1px solid var(--borde)" }}>
              <thead style={{ background: "var(--superficie-2)" }}>
                <tr style={{ textAlign: "left" }}>
                  {["Teléfono", "Reportes", "Último reporte", "Primer contacto", "Estado", ""].map(h => <th key={h} className="rotulo" style={{ padding: "10px 12px", borderBottom: "1px solid var(--borde)" }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {vecinos.map((c, i) => (
                  <tr key={c.id} className="anim-arriba" style={{ ["--i" as any]: Math.min(i, 15), background: c.baneado ? "var(--peligro-suave)" : undefined }}>
                    <td className="mono" style={{ padding: "10px 12px", borderBottom: "1px solid var(--borde)", fontWeight: 600 }}>{formatearTelefono(c.telefono)}</td>
                    <td className="mono" style={{ padding: "10px 12px", borderBottom: "1px solid var(--borde)" }}>{c._count?.reportes ?? 0}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--borde)" }}>
                      {c.reportes?.[0] ? <span>{tiempoRelativo(c.reportes[0].createdAt, ahora)} <span className="texto-3">| {ESTADOS[c.reportes[0].estado]?.etiqueta}</span></span> : <span className="texto-3">--</span>}
                    </td>
                    <td className="texto-3" style={{ padding: "10px 12px", borderBottom: "1px solid var(--borde)", fontSize: 11.5 }}>{fechaHora(c.createdAt)}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--borde)" }}>
                      <span className="insignia" style={{ color: c.baneado ? "var(--peligro)" : "var(--ok)" }}>{c.baneado ? "Bloqueado" : "Habilitado"}</span>
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--borde)", textAlign: "right" }}>
                      <button className={`btn btn-sm ${c.baneado ? "btn-secundario" : "btn-peligro-borde"}`} onClick={() => setBloqueando(c)}>
                        {c.baneado ? <><FiUnlock size={12} /> Desbloquear</> : <><FiLock size={12} /> Bloquear</>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>

      {/* Modal de edición */}
      <Modal abierto={!!editando} titulo="Editar integrante" subtitulo={editando?.email} onCerrar={() => setEditando(null)}
        pie={<><button className="btn btn-fantasma" onClick={() => setEditando(null)}>Cancelar</button><button className="btn btn-primario" onClick={guardar} disabled={guardando || !form.nombre.trim()}>{guardando ? "Guardando" : "Guardar cambios"}</button></>}>
        <label className="campo"><span className="rotulo">Nombre visible</span><input className="input" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} maxLength={80} /></label>
        <div className="campo">
          <span className="rotulo">Rol</span>
          <div className="columna" style={{ gap: 6 }}>
            {(Object.keys(ROLES) as Rol[]).map(r => (
              <button key={r} type="button" onClick={() => setForm({ ...form, rol: r })} disabled={editando?.id === miId && r !== "ADMINISTRADOR"}
                className="item-lista" style={{ ["--color-item" as any]: form.rol === r ? ROLES[r].color : "var(--borde)", borderColor: form.rol === r ? ROLES[r].color : undefined, padding: "8px 12px 8px 16px" }}>
                <div style={{ fontWeight: 600, color: form.rol === r ? ROLES[r].color : undefined }}>{ROLES[r].etiqueta}</div>
                <div className="texto-3" style={{ fontSize: 11.5 }}>{ROLES[r].descripcion}</div>
              </button>
            ))}
          </div>
        </div>
        <label className="campo">
          <span className="rotulo">Departamento</span>
          <select className="select" value={form.departamentoId} onChange={e => setForm({ ...form, departamentoId: e.target.value })}>
            <option value="">Sin departamento (Central C4)</option>
            {DEPARTAMENTOS.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </select>
        </label>
        {form.rol !== "ADMINISTRADOR" && !form.departamentoId && (
          <div style={{ fontSize: 11.5, color: "var(--alerta)" }}>Las jefaturas y los funcionarios de terreno necesitan un departamento para ver reportes.</div>
        )}
      </Modal>

      {/* Confirmación de bloqueo */}
      <Modal abierto={!!bloqueando} titulo={bloqueando?.baneado ? "Desbloquear número" : "Bloquear número"} subtitulo={formatearTelefono(bloqueando?.telefono)} onCerrar={() => setBloqueando(null)}
        pie={<><button className="btn btn-fantasma" onClick={() => setBloqueando(null)}>Cancelar</button>
          <button className={`btn ${bloqueando?.baneado ? "btn-primario" : "btn-peligro"}`} onClick={() => bloqueando && alternarBloqueo(bloqueando)}>{bloqueando?.baneado ? "Desbloquear" : "Bloquear"}</button></>}>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
          {bloqueando?.baneado
            ? "El vecino podrá volver a enviar reportes por WhatsApp."
            : "Los mensajes de este número dejarán de procesarse. El vecino recibirá un aviso como máximo una vez al día."}
        </p>
      </Modal>
    </div>
  );
}
