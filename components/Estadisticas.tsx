"use client";

import React, { useMemo, useRef, useState } from "react";
import { FiDownload, FiFileText, FiTrendingUp, FiClock, FiCheckSquare, FiStar, FiAlertTriangle, FiInbox } from "react-icons/fi";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, ComposedChart, Line,
} from "recharts";
import type { Ticket } from "../lib/tipos";
import {
  ESTADOS, ORDEN_ESTADOS, PRIORIDADES, ORDEN_PRIORIDADES, DEPARTAMENTOS, CATEGORIAS, ESTADOS_ACTIVOS,
  categoriaInfo, prioridadDe, slaDe, fechaCierre, fechaPrimeraGestion, calificacionDe, formatearTelefono, fechaHora,
} from "../lib/constantes";
import { unidadVecinalDe } from "../lib/geo";
import { Kpi, Vacio } from "./ui/Comunes";
import { useAvisos } from "./ui/Avisos";

const PERIODOS = [
  { id: "HOY", etiqueta: "Hoy", dias: 0 },
  { id: "7D", etiqueta: "7 días", dias: 7 },
  { id: "30D", etiqueta: "30 días", dias: 30 },
  { id: "90D", etiqueta: "90 días", dias: 90 },
  { id: "365D", etiqueta: "1 año", dias: 365 },
  { id: "TODO", etiqueta: "Todo", dias: -1 },
];

const EJE = { fontSize: 10.5, fill: "#7C889B", fontFamily: "var(--mono)" };
const TOOLTIP = { contentStyle: { border: "1px solid #D8DEE6", boxShadow: "0 6px 18px -6px rgba(13,21,37,.18)", fontSize: 12, padding: "6px 10px" }, cursor: { fill: "rgba(29,78,216,0.06)" } };
const ANIM = { isAnimationActive: true, animationDuration: 900, animationEasing: "ease-out" as const };
const horas = (ms: number) => ms / 3600000;

export default function Estadisticas({ tickets, ahora }: { tickets: Ticket[]; ahora: number }) {
  const avisar = useAvisos();
  const [periodo, setPeriodo] = useState("30D");
  const [depto, setDepto] = useState<number | "TODOS">("TODOS");
  const [exportando, setExportando] = useState(false);
  const informe = useRef<HTMLDivElement>(null);

  const p = PERIODOS.find(x => x.id === periodo)!;

  const filtrados = useMemo(() => {
    const hoy = new Date(ahora); hoy.setHours(0, 0, 0, 0);
    const desde = p.dias === 0 ? hoy.getTime() : p.dias > 0 ? ahora - p.dias * 86400000 : 0;
    return tickets.filter(t => new Date(t.createdAt).getTime() >= desde && (depto === "TODOS" || t.departamentoId === depto));
  }, [tickets, p.dias, depto, ahora]);

  const d = useMemo(() => {
    const total = filtrados.length;
    const resueltos = filtrados.filter(t => t.estado === "RESUELTO");
    const descartados = filtrados.filter(t => t.estado === "DESCARTADO").length;
    const activos = filtrados.filter(t => ESTADOS_ACTIVOS.includes(t.estado));
    const atrasados = activos.filter(t => slaDe(t, ahora).vencido).length;
    const criticos = activos.filter(t => prioridadDe(t) === "CRITICA").length;

    const tiemposCierre = resueltos.map(t => (fechaCierre(t)?.getTime() || 0) - new Date(t.createdAt).getTime()).filter(x => x > 0);
    const tiempoCierre = tiemposCierre.length ? horas(tiemposCierre.reduce((a, b) => a + b, 0) / tiemposCierre.length) : NaN;
    const enPlazo = resueltos.filter(t => !slaDe(t, ahora).vencido).length;
    const cumplimiento = resueltos.length ? (enPlazo / resueltos.length) * 100 : NaN;

    const tiemposRespuesta = filtrados.map(t => { const f = fechaPrimeraGestion(t); return f ? f.getTime() - new Date(t.createdAt).getTime() : null; }).filter((x): x is number => x != null && x > 0);
    const respuesta = tiemposRespuesta.length ? horas(tiemposRespuesta.reduce((a, b) => a + b, 0) / tiemposRespuesta.length) : NaN;

    const notas = filtrados.map(calificacionDe).filter((x): x is number => x != null);
    const satisfaccion = notas.length ? (notas.filter(n => n >= 5).length / notas.length) * 100 : NaN;

    // Tendencia (por hora si es "Hoy", por día en otro caso)
    const porHora = p.dias === 0;
    const cubos = new Map<string, { clave: string; etiqueta: string; Ingresos: number; Cierres: number }>();
    const claveDe = (f: Date) => porHora ? `${f.getHours()}`.padStart(2, "0") : f.toISOString().slice(0, 10);
    const etiquetaDe = (f: Date) => porHora ? `${String(f.getHours()).padStart(2, "0")}:00` : f.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" });
    if (porHora) for (let h = 0; h < 24; h++) { const f = new Date(ahora); f.setHours(h); cubos.set(claveDe(f), { clave: claveDe(f), etiqueta: etiquetaDe(f), Ingresos: 0, Cierres: 0 }); }
    else {
      const dias = p.dias > 0 ? Math.min(p.dias, 120) : Math.min(120, Math.ceil((ahora - Math.min(...filtrados.map(t => new Date(t.createdAt).getTime()), ahora)) / 86400000) + 1);
      for (let i = dias - 1; i >= 0; i--) { const f = new Date(ahora - i * 86400000); cubos.set(claveDe(f), { clave: claveDe(f), etiqueta: etiquetaDe(f), Ingresos: 0, Cierres: 0 }); }
    }
    filtrados.forEach(t => {
      const c = cubos.get(claveDe(new Date(t.createdAt))); if (c) c.Ingresos++;
      const fc = fechaCierre(t); if (fc && t.estado === "RESUELTO") { const c2 = cubos.get(claveDe(fc)); if (c2) c2.Cierres++; }
    });

    const porEstado = ORDEN_ESTADOS.map(e => ({ nombre: ESTADOS[e].etiqueta, valor: filtrados.filter(t => t.estado === e).length, color: ESTADOS[e].color }));
    const porPrioridad = ORDEN_PRIORIDADES.map(pr => ({ nombre: PRIORIDADES[pr].etiqueta, valor: filtrados.filter(t => prioridadDe(t) === pr).length, color: PRIORIDADES[pr].color }));

    const porDepto = DEPARTAMENTOS.map(dep => {
      const del = filtrados.filter(t => t.departamentoId === dep.id);
      const res = del.filter(t => t.estado === "RESUELTO");
      const ts = res.map(t => (fechaCierre(t)?.getTime() || 0) - new Date(t.createdAt).getTime()).filter(x => x > 0);
      return {
        nombre: dep.corto, color: dep.color,
        Activos: del.filter(t => ESTADOS_ACTIVOS.includes(t.estado)).length,
        Resueltos: res.length,
        Atrasados: del.filter(t => ESTADOS_ACTIVOS.includes(t.estado) && slaDe(t, ahora).vencido).length,
        "Horas promedio": ts.length ? Math.round(horas(ts.reduce((a, b) => a + b, 0) / ts.length) * 10) / 10 : 0,
      };
    });

    const porCategoria = CATEGORIAS.map(c => ({ nombre: c.nombre, valor: filtrados.filter(t => categoriaInfo(t.categoria?.nombre).nombre === c.nombre).length, color: c.color }))
      .filter(c => c.valor > 0).sort((a, b) => b.valor - a.valor);

    const horasDia = Array.from({ length: 24 }, (_, h) => ({ hora: String(h).padStart(2, "0"), valor: 0 }));
    const diasSemana = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(n => ({ dia: n, valor: 0 }));
    const uvs: Record<string, number> = {};
    filtrados.forEach(t => {
      const f = new Date(t.createdAt);
      horasDia[f.getHours()].valor++;
      diasSemana[(f.getDay() + 6) % 7].valor++;
      const uv = unidadVecinalDe(t.latitud, t.longitud);
      if (uv) uvs[uv] = (uvs[uv] || 0) + 1;
    });
    const porUV = Object.entries(uvs).map(([nombre, valor]) => ({ nombre, valor })).sort((a, b) => b.valor - a.valor).slice(0, 10);

    // Ranking de funcionarios en terreno (según quién tenía el caso al resolverse)
    const ranking: Record<string, { nombre: string; resueltos: number; ms: number; notas: number[] }> = {};
    resueltos.forEach(t => {
      const f = t.operadorAsignado; if (!f) return;
      const r = (ranking[f.id] ||= { nombre: f.nombre, resueltos: 0, ms: 0, notas: [] });
      r.resueltos++;
      r.ms += Math.max(0, (fechaCierre(t)?.getTime() || 0) - new Date(t.createdAt).getTime());
      const n = calificacionDe(t); if (n) r.notas.push(n);
    });
    const funcionarios = Object.values(ranking).sort((a, b) => b.resueltos - a.resueltos).slice(0, 8);

    const satisf = [
      { nombre: "Bien resuelto", valor: notas.filter(n => n === 5).length, color: "#2B8A3E" },
      { nombre: "Regular", valor: notas.filter(n => n === 3).length, color: "#B7791F" },
      { nombre: "No resuelto", valor: notas.filter(n => n === 1).length, color: "#C92A2A" },
    ];

    return {
      total, resueltos: resueltos.length, descartados, activos: activos.length, atrasados, criticos,
      tiempoCierre, cumplimiento, respuesta, satisfaccion, notas: notas.length,
      tendencia: [...cubos.values()], porEstado, porPrioridad, porDepto, porCategoria, horasDia, diasSemana, porUV, funcionarios, satisf,
    };
  }, [filtrados, ahora, p.dias]);

  // ------------------------------------------------------------------------
  // EXPORTACIONES
  // ------------------------------------------------------------------------
  const exportarPDF = async () => {
    if (!informe.current) return;
    setExportando(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
      const canvas = await html2canvas(informe.current, { scale: 2, useCORS: true, backgroundColor: "#ECEFF3" });
      const pdf = new jsPDF("p", "mm", "a4");
      const ancho = pdf.internal.pageSize.getWidth();
      const altoPagina = pdf.internal.pageSize.getHeight();
      const pxPorPagina = Math.floor((canvas.width * altoPagina) / ancho);
      let y = 0, pagina = 0;
      while (y < canvas.height) {
        const trozo = document.createElement("canvas");
        trozo.width = canvas.width;
        trozo.height = Math.min(pxPorPagina, canvas.height - y);
        trozo.getContext("2d")!.drawImage(canvas, 0, y, canvas.width, trozo.height, 0, 0, canvas.width, trozo.height);
        if (pagina > 0) pdf.addPage();
        pdf.addImage(trozo.toDataURL("image/png"), "PNG", 0, 0, ancho, (trozo.height * ancho) / canvas.width);
        pdf.setFontSize(8); pdf.setTextColor(120);
        pdf.text(`MuniVox | Central C4 Buin | Página ${pagina + 1}`, 10, altoPagina - 5);
        y += pxPorPagina; pagina++;
      }
      pdf.save(`MuniVox_Informe_${new Date().toISOString().slice(0, 10)}.pdf`);
      avisar({ titulo: "Informe PDF generado", tipo: "ok" });
    } catch (e) {
      console.error(e);
      avisar({ titulo: "No se pudo generar el PDF", tipo: "error" });
    } finally {
      setExportando(false);
    }
  };

  const exportarCSV = () => {
    const filas = [["codigo", "fecha_ingreso", "estado", "categoria", "departamento", "prioridad", "funcionario", "unidad_vecinal", "latitud", "longitud", "fecha_cierre", "horas_cierre", "dentro_de_plazo", "calificacion", "telefono"]];
    filtrados.forEach(t => {
      const fc = fechaCierre(t);
      filas.push([
        t.codigoTicket, fechaHora(t.createdAt), ESTADOS[t.estado]?.etiqueta || t.estado, t.categoria?.nombre || "", t.departamento?.nombre || "",
        PRIORIDADES[prioridadDe(t)].etiqueta, t.operadorAsignado?.nombre || "", unidadVecinalDe(t.latitud, t.longitud) || "",
        String(t.latitud ?? ""), String(t.longitud ?? ""), fc ? fechaHora(fc) : "",
        fc ? (horas(fc.getTime() - new Date(t.createdAt).getTime())).toFixed(1) : "",
        fc ? (slaDe(t, ahora).vencido ? "no" : "si") : "", String(calificacionDe(t) ?? ""), formatearTelefono(t.ciudadano?.telefono),
      ]);
    });
    const csv = "﻿" + filas.map(f => f.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `MuniVox_Reportes_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const fmtHoras = (h: number) => (!Number.isFinite(h) ? NaN : h);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Controles */}
      <div className="fila entre" style={{ flexWrap: "wrap", gap: 10, paddingBottom: 12 }}>
        <div className="fila" style={{ gap: 10, flexWrap: "wrap" }}>
          <div className="segmentos">
            {PERIODOS.map(x => <button key={x.id} className={`segmento${periodo === x.id ? " activo" : ""}`} onClick={() => setPeriodo(x.id)}>{x.etiqueta}</button>)}
          </div>
          <select className="select" style={{ width: 200, height: 32 }} value={depto} onChange={e => setDepto(e.target.value === "TODOS" ? "TODOS" : Number(e.target.value))}>
            <option value="TODOS">Todos los departamentos</option>
            {DEPARTAMENTOS.map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </select>
        </div>
        <div className="fila">
          <button className="btn btn-secundario btn-sm" onClick={exportarCSV} disabled={!filtrados.length}><FiFileText size={13} /> Exportar CSV</button>
          <button className="btn btn-primario btn-sm" onClick={exportarPDF} disabled={exportando || !filtrados.length}>
            {exportando ? <span className="girador" style={{ width: 12, height: 12 }} /> : <FiDownload size={13} />} Informe PDF
          </button>
        </div>
      </div>

      <div className="desplazable" style={{ flex: 1 }}>
        <div ref={informe} style={{ display: "flex", flexDirection: "column", gap: 12, background: "var(--fondo)", paddingBottom: 12 }}>
          {/* Membrete */}
          <div className="panel marco fila entre anim-arriba" style={{ padding: "14px 18px", borderTop: "3px solid var(--marino)" }}>
            <div>
              <div className="rotulo">Municipalidad de Buin | Central de Operaciones C4</div>
              <h2 className="titulo-1" style={{ marginTop: 4 }}>Informe de gestión de reportes ciudadanos</h2>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="rotulo">Periodo</div>
              <div className="mono" style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{p.etiqueta}{depto !== "TODOS" ? ` | ${DEPARTAMENTOS.find(x => x.id === depto)?.corto}` : ""}</div>
              <div className="texto-3" style={{ fontSize: 11 }}>Generado {fechaHora(new Date(ahora))}</div>
            </div>
          </div>

          {!filtrados.length ? (
            <Vacio icono={<FiInbox size={22} />} titulo="Sin reportes en este periodo" texto="Prueba con un periodo más amplio o con otro departamento." />
          ) : (
            <>
              {/* KPIs */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
                <Kpi i={0} titulo="Reportes ingresados" valor={d.total} detalle={`${d.activos} activos | ${d.descartados} descartados`} icono={<FiInbox size={14} />} />
                <Kpi i={1} titulo="Resueltos" valor={d.total ? (d.resueltos / d.total) * 100 : 0} sufijo="%" detalle={`${d.resueltos} casos cerrados`} color="var(--ok)" icono={<FiCheckSquare size={14} />} />
                <Kpi i={2} titulo="Tiempo de cierre" valor={fmtHoras(d.tiempoCierre)} decimales={1} sufijo="h" detalle="Promedio desde el ingreso" color="#7048E8" icono={<FiClock size={14} />} />
                <Kpi i={3} titulo="Primera gestión" valor={fmtHoras(d.respuesta)} decimales={1} sufijo="h" detalle="Hasta la derivación o asignación" color="var(--acento)" icono={<FiTrendingUp size={14} />} />
                <Kpi i={4} titulo="Cierre en plazo" valor={d.cumplimiento} sufijo="%" detalle="Según prioridad (4 h a 7 días)" color={d.cumplimiento >= 80 ? "var(--ok)" : "var(--alerta)"} icono={<FiCheckSquare size={14} />} />
                <Kpi i={5} titulo="Fuera de plazo" valor={d.atrasados} detalle={`${d.criticos} críticos activos`} color="var(--peligro)" icono={<FiAlertTriangle size={14} />} />
                <Kpi i={6} titulo="Satisfacción" valor={d.satisfaccion} sufijo="%" detalle={d.notas ? `${d.notas} evaluaciones de vecinos` : "Sin evaluaciones aún"} color="#C08A00" icono={<FiStar size={14} />} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: 12 }}>
                <Grafico titulo={p.dias === 0 ? "Ingresos y cierres por hora" : "Ingresos y cierres por día"} i={0}>
                  <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart data={d.tendencia} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#D8DEE6" />
                      <XAxis dataKey="etiqueta" tick={EJE} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
                      <YAxis tick={EJE} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip {...TOOLTIP} />
                      <Legend wrapperStyle={{ fontSize: 11 }} iconType="square" />
                      <Bar dataKey="Ingresos" fill="#1D4ED8" maxBarSize={22} {...ANIM} />
                      <Line dataKey="Cierres" type="linear" stroke="#2B8A3E" strokeWidth={2.5} dot={{ r: 0 }} {...ANIM} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </Grafico>
                <Grafico titulo="Embudo por estado" i={1}>
                  <BarrasHorizontales datos={d.porEstado} alto={260} ancho={86} />
                </Grafico>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr)", gap: 12 }}>
                <Grafico titulo="Carga y rendimiento por departamento" i={2}>
                  <ResponsiveContainer width="100%" height={250}>
                    <ComposedChart data={d.porDepto} margin={{ top: 8, right: 0, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#D8DEE6" />
                      <XAxis dataKey="nombre" tick={EJE} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="n" tick={EJE} axisLine={false} tickLine={false} allowDecimals={false} />
                      <YAxis yAxisId="h" orientation="right" tick={EJE} axisLine={false} tickLine={false} width={34} />
                      <Tooltip {...TOOLTIP} />
                      <Legend wrapperStyle={{ fontSize: 11 }} iconType="square" />
                      <Bar yAxisId="n" dataKey="Resueltos" stackId="a" fill="#2B8A3E" maxBarSize={36} {...ANIM} />
                      <Bar yAxisId="n" dataKey="Activos" stackId="a" fill="#AEB8C5" maxBarSize={36} {...ANIM} />
                      <Bar yAxisId="n" dataKey="Atrasados" fill="#C92A2A" maxBarSize={12} {...ANIM} />
                      <Line yAxisId="h" dataKey="Horas promedio" type="linear" stroke="#7048E8" strokeWidth={2} {...ANIM} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </Grafico>
                <Grafico titulo="Categorías más reportadas" i={3}>
                  <BarrasHorizontales datos={d.porCategoria} alto={250} ancho={128} />
                </Grafico>
                <Grafico titulo="Prioridad asignada" i={4}>
                  <BarrasHorizontales datos={d.porPrioridad} alto={250} ancho={60} />
                </Grafico>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr)", gap: 12 }}>
                <Grafico titulo="Concentración horaria" i={5}>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={d.horasDia} margin={{ top: 8, right: 0, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#D8DEE6" />
                      <XAxis dataKey="hora" tick={EJE} axisLine={false} tickLine={false} interval={2} />
                      <YAxis tick={EJE} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip {...TOOLTIP} formatter={(v: any) => [v, "Reportes"]} labelFormatter={l => `${l}:00`} />
                      <Bar dataKey="valor" {...ANIM}>
                        {d.horasDia.map((h, i) => {
                          const max = Math.max(...d.horasDia.map(x => x.valor), 1);
                          return <Cell key={i} fill={h.valor / max > 0.7 ? "#C92A2A" : h.valor / max > 0.4 ? "#E8590C" : "#1D4ED8"} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Grafico>
                <Grafico titulo="Día de la semana" i={6}>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={d.diasSemana} margin={{ top: 8, right: 0, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#D8DEE6" />
                      <XAxis dataKey="dia" tick={EJE} axisLine={false} tickLine={false} />
                      <YAxis tick={EJE} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip {...TOOLTIP} formatter={(v: any) => [v, "Reportes"]} />
                      <Bar dataKey="valor" fill="#0A1222" maxBarSize={30} {...ANIM} />
                    </BarChart>
                  </ResponsiveContainer>
                </Grafico>
                <Grafico titulo="Evaluación de los vecinos" i={7}>
                  {d.notas ? <BarrasHorizontales datos={d.satisf} alto={220} ancho={90} /> : <Vacio titulo="Sin evaluaciones" texto="Al resolver un caso, el vecino recibe una encuesta por WhatsApp." />}
                </Grafico>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 12 }}>
                <Grafico titulo="Unidades vecinales con más reportes" i={8}>
                  {d.porUV.length ? <BarrasHorizontales datos={d.porUV.map(x => ({ ...x, color: "#1D4ED8" }))} alto={Math.max(180, d.porUV.length * 28)} ancho={170} /> : <Vacio titulo="Sin ubicaciones" />}
                </Grafico>
                <Grafico titulo="Funcionarios con más casos resueltos" i={9}>
                  {d.funcionarios.length ? (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ textAlign: "left" }}>
                          {["#", "Funcionario", "Resueltos", "Tiempo medio", "Satisfacción"].map(h => <th key={h} className="rotulo" style={{ padding: "6px 8px", borderBottom: "1px solid var(--borde)" }}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {d.funcionarios.map((f, i) => (
                          <tr key={f.nombre} className="anim-arriba" style={{ ["--i" as any]: i }}>
                            <td className="mono" style={{ padding: "8px", borderBottom: "1px solid var(--borde)", color: "var(--texto-3)" }}>{String(i + 1).padStart(2, "0")}</td>
                            <td style={{ padding: "8px", borderBottom: "1px solid var(--borde)", fontWeight: 600 }}>{f.nombre}</td>
                            <td className="mono" style={{ padding: "8px", borderBottom: "1px solid var(--borde)" }}>
                              <div className="fila"><span style={{ width: 60 }} className="barra"><span style={{ width: `${(f.resueltos / d.funcionarios[0].resueltos) * 100}%` }} /></span>{f.resueltos}</div>
                            </td>
                            <td className="mono" style={{ padding: "8px", borderBottom: "1px solid var(--borde)" }}>{horas(f.ms / f.resueltos).toFixed(1)} h</td>
                            <td className="mono" style={{ padding: "8px", borderBottom: "1px solid var(--borde)" }}>{f.notas.length ? `${Math.round((f.notas.filter(n => n >= 5).length / f.notas.length) * 100)}%` : "--"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : <Vacio titulo="Sin casos resueltos en el periodo" />}
                </Grafico>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Grafico({ titulo, children, i = 0 }: { titulo: string; children: React.ReactNode; i?: number }) {
  return (
    <div className="panel anim-arriba" style={{ ["--i" as any]: i, minWidth: 0 }}>
      <div className="panel-cabecera" style={{ padding: "10px 14px" }}>
        <span className="titulo-3">{titulo}</span>
      </div>
      <div style={{ padding: "12px 14px" }}>{children}</div>
    </div>
  );
}

function BarrasHorizontales({ datos, alto, ancho }: { datos: { nombre: string; valor: number; color: string }[]; alto: number; ancho: number }) {
  return (
    <ResponsiveContainer width="100%" height={alto}>
      <BarChart data={datos} layout="vertical" margin={{ top: 0, right: 28, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="2 4" horizontal={false} stroke="#D8DEE6" />
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis dataKey="nombre" type="category" width={ancho} tick={{ ...EJE, fontFamily: "var(--fuente)", fill: "#46536A" }} axisLine={false} tickLine={false} />
        <Tooltip {...TOOLTIP} formatter={(v: any) => [v, "Reportes"]} />
        <Bar dataKey="valor" maxBarSize={22} label={{ position: "right", fontSize: 11, fill: "#46536A", fontFamily: "var(--mono)" }} {...ANIM}>
          {datos.map((x, i) => <Cell key={i} fill={x.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
