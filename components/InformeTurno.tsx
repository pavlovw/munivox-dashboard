"use client";

import { useEffect, useMemo, useState } from "react";
import { FiPrinter, FiAlertTriangle } from "react-icons/fi";
import type { Ticket } from "../lib/tipos";
import {
  DEPARTAMENTOS, ESTADOS, ESTADOS_ACTIVOS, PRIORIDADES, categoriaInfo, prioridadDe, slaDe, duracion,
  fechaHora, esCalificacion, esNotaInterna, esMensajeVecino,
} from "../lib/constantes";
import { Kpi, Vacio } from "./ui/Comunes";

const TURNOS = [
  { id: "MANANA", etiqueta: "Mañana", desde: 8, hasta: 16 },
  { id: "TARDE", etiqueta: "Tarde", desde: 16, hasta: 24 },
  { id: "NOCHE", etiqueta: "Noche", desde: 0, hasta: 8 },
  { id: "DIA", etiqueta: "Día completo", desde: 0, hasta: 24 },
];

const aFechaInput = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Resumen del turno para entregarlo al siguiente operador (se imprime o se guarda en PDF) */
export default function InformeTurno({ tickets, ahora, operador }: { tickets: Ticket[]; ahora: number; operador: string }) {
  const [fecha, setFecha] = useState(() => (ahora ? aFechaInput(ahora) : ""));
  const [turno, setTurno] = useState(() => {
    const h = new Date(ahora || 0).getHours();
    return h >= 16 ? "TARDE" : h >= 8 ? "MANANA" : "NOCHE";
  });
  const [notas, setNotas] = useState("");
  const claveNotas = `munivox_notas_turno_${fecha}_${turno}`;

  useEffect(() => { if (!fecha && ahora) setFecha(aFechaInput(ahora)); }, [ahora, fecha]);
  useEffect(() => { try { setNotas(localStorage.getItem(claveNotas) || ""); } catch {} }, [claveNotas]);
  const guardarNotas = (v: string) => { setNotas(v); try { localStorage.setItem(claveNotas, v); } catch {} };

  const t = TURNOS.find(x => x.id === turno)!;
  const [y, m, d] = (fecha || aFechaInput(ahora)).split("-").map(Number);
  const inicio = new Date(y, m - 1, d, t.desde).getTime();
  const fin = new Date(y, m - 1, d, t.hasta).getTime();
  const enVentana = (f: string | Date) => { const x = new Date(f).getTime(); return x >= inicio && x < fin; };

  const datos = useMemo(() => {
    const ingresados = tickets.filter(x => enVentana(x.createdAt));
    const eventos = tickets.flatMap(x => (x.historial || []).filter(h => enVentana(h.createdAt) && !esNotaInterna(h) && !esMensajeVecino(h) && !esCalificacion(h)).map(h => ({ t: x, h })));
    const contar = (fn: (h: { t: Ticket; h: any }) => boolean) => eventos.filter(fn).length;
    const resueltos = eventos.filter(e => e.h.estadoNuevo === "RESUELTO");
    const tiemposGestion = ingresados.map(x => {
      const primera = [...(x.historial || [])].reverse().find(h => h.operadorId && !esNotaInterna(h));
      return primera ? new Date(primera.createdAt).getTime() - new Date(x.createdAt).getTime() : null;
    }).filter((v): v is number => v != null && v > 0);
    const activos = tickets.filter(x => ESTADOS_ACTIVOS.includes(x.estado));
    const criticosAbiertos = activos.filter(x => ["CRITICA", "ALTA"].includes(prioridadDe(x))).sort((a, b) => PRIORIDADES[prioridadDe(b)].peso - PRIORIDADES[prioridadDe(a)].peso);
    const vencidos = activos.filter(x => slaDe(x, ahora).vencido);
    const evaluaciones = tickets.flatMap(x => (x.historial || []).filter(h => esCalificacion(h) && enVentana(h.createdAt)));
    return {
      ingresados: ingresados.length,
      derivados: contar(e => String(e.h.comentario || "").startsWith("Derivado")),
      asignados: contar(e => String(e.h.comentario || "").startsWith("Asignado")),
      despachados: contar(e => e.h.estadoNuevo === "DESPACHADO"),
      resueltos: resueltos.length,
      descartados: contar(e => e.h.estadoNuevo === "DESCARTADO"),
      rechazos: contar(e => String(e.h.comentario || "").startsWith("Rechazado")),
      gestionMedia: tiemposGestion.length ? tiemposGestion.reduce((a, b) => a + b, 0) / tiemposGestion.length : null,
      pendientesSinDerivar: activos.filter(x => x.estado === "PENDIENTE").length,
      activos: activos.length,
      criticosAbiertos,
      vencidos,
      evaluaciones: evaluaciones.length,
      noResueltos: evaluaciones.filter(h => /1\/5/.test(String(h.comentario))).length,
      porDepto: DEPARTAMENTOS.map(dep => ({
        ...dep,
        ingresados: ingresados.filter(x => x.departamentoId === dep.id).length,
        resueltos: resueltos.filter(e => e.t.departamentoId === dep.id).length,
        activos: activos.filter(x => x.departamentoId === dep.id).length,
        vencidos: vencidos.filter(x => x.departamentoId === dep.id).length,
      })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets, inicio, fin, ahora]);

  const celda = { padding: "8px 12px", borderBottom: "1px solid var(--borde)" } as const;

  return (
    <div className="desplazable imprimible" style={{ height: "100%" }}>
      <div className="fila entre no-imprimir" style={{ flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <div className="fila" style={{ gap: 10 }}>
          <input type="date" className="input" style={{ width: 170, height: 32 }} value={fecha} onChange={e => setFecha(e.target.value)} />
          <div className="segmentos">
            {TURNOS.map(x => <button key={x.id} className={`segmento${turno === x.id ? " activo" : ""}`} onClick={() => setTurno(x.id)}>{x.etiqueta}</button>)}
          </div>
        </div>
        <button className="btn btn-primario btn-sm" onClick={() => window.print()}><FiPrinter size={13} /> Imprimir o guardar PDF</button>
      </div>

      <div className="columna" style={{ gap: 12, paddingBottom: 12 }}>
        <div className="panel marco anim-arriba" style={{ padding: "14px 18px", borderTop: "3px solid var(--marino)" }}>
          <div className="fila entre" style={{ alignItems: "flex-end", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div className="rotulo">Municipalidad de Buin | Central C4</div>
              <h2 className="titulo-1" style={{ marginTop: 4 }}>Informe de turno: {t.etiqueta.toLowerCase()}</h2>
              <div className="texto-2" style={{ marginTop: 4 }}>{new Date(inicio).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}, {String(t.desde).padStart(2, "0")}:00 a {String(t.hasta % 24).padStart(2, "0")}:00</div>
            </div>
            <div style={{ textAlign: "right", fontSize: 12 }}>
              <div className="rotulo">Responsable</div>
              <div style={{ fontWeight: 600 }}>{operador}</div>
              <div className="texto-3">Generado {fechaHora(new Date(ahora))}</div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 10 }}>
          <Kpi i={0} titulo="Ingresados" valor={datos.ingresados} />
          <Kpi i={1} titulo="Derivados" valor={datos.derivados} color={ESTADOS.EN_REVISION.color} />
          <Kpi i={2} titulo="Despachados" valor={datos.despachados} color={ESTADOS.DESPACHADO.color} detalle={`${datos.asignados} asignaciones`} />
          <Kpi i={3} titulo="Resueltos" valor={datos.resueltos} color="var(--ok)" />
          <Kpi i={4} titulo="Descartados" valor={datos.descartados} color="var(--texto-3)" />
          <Kpi i={5} titulo="Primera gestión" valor={datos.gestionMedia != null ? datos.gestionMedia / 3600000 : NaN} decimales={1} sufijo="h" color="var(--acento)" detalle="Promedio de los ingresados" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 12 }}>
          <div className="panel">
            <div className="panel-cabecera"><span className="titulo-3">Situación al cierre del informe</span></div>
            <div className="panel-cuerpo columna" style={{ gap: 6, fontSize: 13 }}>
              {[
                ["Casos activos en la comuna", datos.activos, undefined],
                ["Nuevos sin derivar", datos.pendientesSinDerivar, datos.pendientesSinDerivar ? "var(--alerta)" : undefined],
                ["Críticos o de prioridad alta abiertos", datos.criticosAbiertos.length, datos.criticosAbiertos.length ? "var(--peligro)" : undefined],
                ["Fuera de plazo", datos.vencidos.length, datos.vencidos.length ? "var(--peligro)" : undefined],
                ["Tareas rechazadas en terreno (en el turno)", datos.rechazos, datos.rechazos ? "var(--alerta)" : undefined],
                ["Evaluaciones de vecinos (en el turno)", `${datos.evaluaciones}${datos.noResueltos ? ` (${datos.noResueltos} "no se resolvió")` : ""}`, datos.noResueltos ? "#C08A00" : undefined],
              ].map(([k, v, c]) => (
                <div key={k as string} className="fila entre" style={{ borderBottom: "1px solid var(--borde)", paddingBottom: 6 }}>
                  <span className="texto-2">{k}</span><span className="mono" style={{ fontWeight: 600, color: c as string | undefined }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <div className="panel-cabecera"><span className="titulo-3">Por departamento</span></div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead><tr style={{ textAlign: "left" }}>{["Departamento", "Ingresados", "Resueltos", "Activos", "Fuera de plazo"].map(h => <th key={h} className="rotulo" style={celda}>{h}</th>)}</tr></thead>
              <tbody>
                {datos.porDepto.map(dep => (
                  <tr key={dep.id}>
                    <td style={celda}><span className="fila" style={{ gap: 6 }}><span className="punto" style={{ background: dep.color }} />{dep.nombre}</span></td>
                    <td className="mono" style={celda}>{dep.ingresados}</td>
                    <td className="mono" style={celda}>{dep.resueltos}</td>
                    <td className="mono" style={celda}>{dep.activos}</td>
                    <td className="mono" style={{ ...celda, color: dep.vencidos ? "var(--peligro)" : undefined, fontWeight: dep.vencidos ? 600 : 400 }}>{dep.vencidos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-cabecera"><span className="titulo-3 fila" style={{ gap: 6 }}><FiAlertTriangle size={14} color="var(--peligro)" /> Casos que el siguiente turno debe seguir</span></div>
          {datos.criticosAbiertos.length + datos.vencidos.length === 0 ? <div className="panel-cuerpo"><Vacio titulo="No hay casos críticos ni fuera de plazo" /></div> : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead><tr style={{ textAlign: "left" }}>{["Código", "Categoría", "Prioridad", "Estado", "Departamento", "Plazo"].map(h => <th key={h} className="rotulo" style={celda}>{h}</th>)}</tr></thead>
              <tbody>
                {[...new Map([...datos.criticosAbiertos, ...datos.vencidos].map(x => [x.id, x])).values()].slice(0, 25).map(x => {
                  const s = slaDe(x, ahora);
                  return (
                    <tr key={x.id}>
                      <td className="mono" style={{ ...celda, fontWeight: 600 }}>{x.codigoTicket}</td>
                      <td style={celda}>{categoriaInfo(x.categoria?.nombre).nombre}</td>
                      <td style={{ ...celda, color: PRIORIDADES[prioridadDe(x)].color, fontWeight: 600 }}>{PRIORIDADES[prioridadDe(x)].etiqueta}</td>
                      <td style={celda}>{ESTADOS[x.estado].etiqueta}</td>
                      <td style={celda}>{x.departamento?.nombre || "Sin derivar"}</td>
                      <td className="mono" style={{ ...celda, color: s.vencido ? "var(--peligro)" : "var(--ok)" }}>{s.vencido ? `Atrasado ${duracion(s.restanteMs)}` : `Quedan ${duracion(s.restanteMs)}`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <div className="panel-cabecera"><span className="titulo-3">Novedades para el siguiente turno</span><span className="texto-3 no-imprimir" style={{ fontSize: 11 }}>Se guardan en este equipo y salen en la impresión</span></div>
          <div className="panel-cuerpo">
            <textarea className="textarea no-imprimir" style={{ minHeight: 110 }} value={notas} onChange={e => guardarNotas(e.target.value)} placeholder="Ej: corte de luz en Alto Jahuel, cuadrilla de Obras en terreno hasta las 18:00, coordinar con Carabineros el retiro del vehículo de calle San Martín." />
            <div className="solo-imprimir" style={{ whiteSpace: "pre-wrap", fontSize: 13, minHeight: 60 }}>{notas || "Sin novedades."}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
