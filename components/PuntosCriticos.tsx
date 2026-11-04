"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { FiTarget, FiTrendingUp, FiTrendingDown, FiMinus, FiMapPin, FiZap } from "react-icons/fi";
import type { Ticket } from "../lib/tipos";
import { CATEGORIAS, ESTADOS_ACTIVOS, categoriaInfo, departamentoInfo, fechaHora } from "../lib/constantes";
import { unidadVecinalDe, distanciaKm } from "../lib/geo";
import { Icono } from "./ui/Iconos";
import { Kpi, Vacio } from "./ui/Comunes";

const Mapa = dynamic(() => import("./Map"), { ssr: false, loading: () => <div className="esqueleto" style={{ height: "100%" }} /> });

// Acción preventiva sugerida cuando un problema se repite en el mismo lugar
const RECOMENDACION: Record<string, string> = {
  "Bache / Vialidad": "Evaluar reparación integral del tramo (repavimentación) en lugar de bacheos puntuales.",
  "Basura / Microbasural": "Instalar contenedores y señalética de prohibición, y programar fiscalización con inspectores municipales.",
  "Alumbrado público": "Revisar el circuito eléctrico del sector: fallas repetidas suelen indicar un problema de red, no de luminaria.",
  "Vehículo abandonado": "Coordinar un operativo de retiro con Tránsito y Carabineros en el sector.",
  "Ruidos molestos": "Programar rondas preventivas de Seguridad Pública en horario nocturno y fines de semana.",
  "Señalética / Tránsito": "Inspeccionar la intersección y reponer con material antivandálico; evaluar medidas de calmado de tránsito.",
  "Áreas verdes": "Incorporar el lugar al plan de mantención y riego periódico.",
  "Animales": "Coordinar un operativo de tenencia responsable, esterilización y registro de mascotas en el sector.",
  "Otro": "Revisar los reportes para identificar una causa común.",
};

const RADIO_KM = 0.12;   // reportes a menos de 120 m se consideran el mismo lugar
const MINIMO = 3;        // desde 3 reportes en el periodo es un punto crítico

interface Punto {
  id: string;
  categoria: string;
  tickets: Ticket[];
  lat: number;
  lng: number;
  uv: string | null;
  activos: number;
  ultimo: string;
}

export default function PuntosCriticos({ tickets, ahora, onAbrirTicket }: { tickets: Ticket[]; ahora: number; onAbrirTicket: (id: string) => void }) {
  const [dias, setDias] = useState(90);
  const [seleccion, setSeleccion] = useState<string | null>(null);

  const desde = ahora - dias * 86400000;
  const enPeriodo = useMemo(() => tickets.filter(t => new Date(t.createdAt).getTime() >= desde), [tickets, desde]);

  // ---- Agrupación por lugar y categoría ----
  const puntos = useMemo(() => {
    const grupos: Punto[] = [];
    [...enPeriodo]
      .filter(t => t.latitud != null && t.longitud != null && t.estado !== "DESCARTADO")
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .forEach(t => {
        const cat = categoriaInfo(t.categoria?.nombre).nombre;
        const g = grupos.find(x => x.categoria === cat && distanciaKm(x.lat, x.lng, t.latitud!, t.longitud!) <= RADIO_KM);
        if (g) {
          g.tickets.push(t);
          g.lat = g.tickets.reduce((s, x) => s + x.latitud!, 0) / g.tickets.length;
          g.lng = g.tickets.reduce((s, x) => s + x.longitud!, 0) / g.tickets.length;
        } else {
          grupos.push({ id: t.id, categoria: cat, tickets: [t], lat: t.latitud!, lng: t.longitud!, uv: null, activos: 0, ultimo: t.createdAt });
        }
      });
    return grupos
      .filter(g => g.tickets.length >= MINIMO)
      .map(g => ({
        ...g,
        uv: unidadVecinalDe(g.lat, g.lng),
        activos: g.tickets.filter(t => ESTADOS_ACTIVOS.includes(t.estado)).length,
        ultimo: g.tickets[g.tickets.length - 1].createdAt,
      }))
      .sort((a, b) => b.tickets.length - a.tickets.length);
  }, [enPeriodo]);

  // ---- Comparación por unidad vecinal con el periodo anterior ----
  const porUV = useMemo(() => {
    const previoDesde = desde - dias * 86400000;
    const cuenta: Record<string, { actual: number; previo: number }> = {};
    tickets.forEach(t => {
      const f = new Date(t.createdAt).getTime();
      if (f < previoDesde) return;
      const uv = unidadVecinalDe(t.latitud, t.longitud);
      if (!uv) return;
      cuenta[uv] ||= { actual: 0, previo: 0 };
      if (f >= desde) cuenta[uv].actual++; else cuenta[uv].previo++;
    });
    return Object.entries(cuenta).map(([uv, c]) => ({ uv, ...c, cambio: c.previo ? (c.actual - c.previo) / c.previo : c.actual ? 1 : 0 }))
      .sort((a, b) => b.actual - a.actual).slice(0, 12);
  }, [tickets, desde, dias]);

  // ---- Proyección de la próxima semana por categoría (promedio de las últimas 4 semanas) ----
  const proyeccion = useMemo(() => {
    const semana = 7 * 86400000;
    return CATEGORIAS.map(c => {
      const semanas = [0, 1, 2, 3].map(i => tickets.filter(t => {
        const f = new Date(t.createdAt).getTime();
        return categoriaInfo(t.categoria?.nombre).nombre === c.nombre && f >= ahora - (i + 1) * semana && f < ahora - i * semana;
      }).length);
      const promedio = semanas.reduce((a, b) => a + b, 0) / 4;
      const previas = (semanas[1] + semanas[2] + semanas[3]) / 3;
      const tendencia = semanas[0] > previas * 1.25 + 0.5 ? "sube" : semanas[0] < previas * 0.75 - 0.5 ? "baja" : "estable";
      return { ...c, ultima: semanas[0], esperado: Math.round(promedio * 10) / 10, tendencia };
    }).filter(c => c.esperado > 0 || c.ultima > 0).sort((a, b) => b.esperado - a.esperado);
  }, [tickets, ahora]);

  const maxEsperado = Math.max(1, ...proyeccion.map(p => p.esperado));
  const puntoSel = puntos.find(p => p.id === seleccion) || null;
  const ticketsMapa = puntoSel ? puntoSel.tickets : puntos.flatMap(p => p.tickets);

  return (
    <div className="desplazable" style={{ height: "100%" }}>
      <div className="columna" style={{ gap: 12, paddingBottom: 12 }}>
        <div className="fila entre" style={{ flexWrap: "wrap", gap: 10 }}>
          <div className="segmentos">
            {[30, 90, 180, 365].map(d => <button key={d} className={`segmento${dias === d ? " activo" : ""}`} onClick={() => { setDias(d); setSeleccion(null); }}>{d === 365 ? "1 año" : `${d} días`}</button>)}
          </div>
          <span className="texto-3" style={{ fontSize: 11.5 }}>Un punto crítico son {MINIMO} o más reportes del mismo tipo a menos de {RADIO_KM * 1000} m entre sí.</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
          <Kpi i={0} titulo="Puntos críticos" valor={puntos.length} color="var(--peligro)" icono={<FiTarget size={14} />} detalle="Lugares con problemas repetidos" />
          <Kpi i={1} titulo="Reportes en esos puntos" valor={puntos.reduce((s, p) => s + p.tickets.length, 0)} color="var(--alerta)"
            detalle={enPeriodo.length ? `${Math.round((puntos.reduce((s, p) => s + p.tickets.length, 0) / enPeriodo.length) * 100)}% del periodo` : undefined} />
          <Kpi i={2} titulo="Aún activos" valor={puntos.reduce((s, p) => s + p.activos, 0)} color="var(--acento)" />
          <Kpi i={3} titulo="Esperados próxima semana" valor={proyeccion.reduce((s, p) => s + p.esperado, 0)} decimales={0} color="#7048E8" icono={<FiZap size={14} />} detalle="Promedio de las últimas 4 semanas" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.2fr)", gap: 12, height: 460 }}>
          <div className="panel" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div className="panel-cabecera"><span className="titulo-3">Lugares con problemas repetidos</span>{seleccion && <button className="btn btn-fantasma btn-sm" onClick={() => setSeleccion(null)}>Ver todos</button>}</div>
            <div className="desplazable" style={{ flex: 1, padding: 10, display: "flex", flexDirection: "column", gap: 6, background: "var(--superficie-2)" }}>
              {puntos.length === 0 ? <Vacio icono={<FiTarget size={20} />} titulo="Sin puntos críticos en el periodo" texto="No hay lugares con 3 o más reportes del mismo tipo." /> : puntos.map((p, i) => {
                const c = categoriaInfo(p.categoria);
                return (
                  <button key={p.id} onClick={() => setSeleccion(p.id === seleccion ? null : p.id)} className={`item-lista anim-arriba${seleccion === p.id ? " seleccionado" : ""}`} style={{ ["--color-item" as any]: c.color, ["--i" as any]: Math.min(i, 12) }}>
                    <div className="fila entre">
                      <span className="fila" style={{ gap: 8 }}>
                        <span style={{ width: 26, height: 26, background: c.color, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icono nombre={c.icono} size={15} /></span>
                        <span>
                          <span style={{ display: "block", fontWeight: 600, fontSize: 12.5 }}>{p.categoria}</span>
                          <span className="fila texto-3" style={{ fontSize: 11, gap: 4 }}><FiMapPin size={10} />{p.uv || "Sin unidad vecinal"}</span>
                        </span>
                      </span>
                      <span style={{ textAlign: "right" }}>
                        <span className="mono" style={{ display: "block", fontSize: 20, fontWeight: 600, color: "var(--peligro)" }}>{p.tickets.length}</span>
                        <span className="texto-3" style={{ fontSize: 10.5 }}>{p.activos} activos</span>
                      </span>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 11.5, background: "var(--superficie-2)", borderLeft: "3px solid var(--acento)", padding: "6px 8px", color: "var(--texto-2)" }}>
                      <strong style={{ color: "var(--texto)" }}>Sugerencia:</strong> {RECOMENDACION[p.categoria] || RECOMENDACION.Otro}
                    </div>
                    <div className="texto-3" style={{ fontSize: 10.5, marginTop: 6 }}>Último reporte {fechaHora(p.ultimo)} | {departamentoInfo(categoriaInfo(p.categoria).departamentoId)?.nombre || "Sin área"}</div>
                  </button>
                );
              })}
            </div>
            {puntoSel && (
              <div style={{ borderTop: "1px solid var(--borde)", padding: 10, display: "flex", flexWrap: "wrap", gap: 4 }}>
                {puntoSel.tickets.map(t => <button key={t.id} className="btn btn-sm btn-secundario mono" onClick={() => onAbrirTicket(t.id)}>{t.codigoTicket}</button>)}
              </div>
            )}
          </div>
          <div className="panel" style={{ position: "relative", overflow: "hidden" }}>
            <Mapa tickets={ticketsMapa} onSeleccionar={onAbrirTicket} enfoque={puntoSel ? [puntoSel.lat, puntoSel.lng] : null} zoomEnfoque={17} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 12 }}>
          <div className="panel">
            <div className="panel-cabecera"><span className="titulo-3">Unidades vecinales: este periodo frente al anterior</span></div>
            {porUV.length === 0 ? <div className="panel-cuerpo"><Vacio titulo="Sin datos" /></div> : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead><tr style={{ textAlign: "left" }}>{["Unidad vecinal", "Actual", "Anterior", "Cambio"].map(h => <th key={h} className="rotulo" style={{ padding: "8px 14px", borderBottom: "1px solid var(--borde)" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {porUV.map((u, i) => (
                    <tr key={u.uv} className="anim-arriba" style={{ ["--i" as any]: i }}>
                      <td style={{ padding: "8px 14px", borderBottom: "1px solid var(--borde)" }}>{u.uv}</td>
                      <td className="mono" style={{ padding: "8px 14px", borderBottom: "1px solid var(--borde)", fontWeight: 600 }}>{u.actual}</td>
                      <td className="mono texto-3" style={{ padding: "8px 14px", borderBottom: "1px solid var(--borde)" }}>{u.previo}</td>
                      <td className="mono" style={{ padding: "8px 14px", borderBottom: "1px solid var(--borde)", fontWeight: 600, color: u.cambio > 0.2 ? "var(--peligro)" : u.cambio < -0.2 ? "var(--ok)" : "var(--texto-3)" }}>
                        <span className="fila" style={{ gap: 4 }}>
                          {u.cambio > 0.2 ? <FiTrendingUp size={12} /> : u.cambio < -0.2 ? <FiTrendingDown size={12} /> : <FiMinus size={12} />}
                          {u.previo ? `${u.cambio > 0 ? "+" : ""}${Math.round(u.cambio * 100)}%` : u.actual ? "Nuevo" : "--"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="panel">
            <div className="panel-cabecera"><span className="titulo-3">Proyección para los próximos 7 días</span><span className="texto-3" style={{ fontSize: 11 }}>Sirve para planificar cuadrillas</span></div>
            <div className="panel-cuerpo columna" style={{ gap: 10 }}>
              {proyeccion.length === 0 ? <Vacio titulo="Sin datos suficientes" texto="Se necesitan reportes de las últimas 4 semanas." /> : proyeccion.map((p, i) => (
                <div key={p.nombre} className="anim-arriba" style={{ ["--i" as any]: i }}>
                  <div className="fila entre" style={{ fontSize: 12.5 }}>
                    <span className="fila" style={{ gap: 8 }}><span style={{ color: p.color, display: "inline-flex" }}><Icono nombre={p.icono} size={14} /></span>{p.nombre}</span>
                    <span className="fila mono" style={{ gap: 8, fontWeight: 600 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: p.tendencia === "sube" ? "var(--peligro)" : p.tendencia === "baja" ? "var(--ok)" : "var(--texto-3)" }}>
                        {p.tendencia === "sube" ? "En alza" : p.tendencia === "baja" ? "A la baja" : "Estable"}
                      </span>
                      ~{p.esperado}
                    </span>
                  </div>
                  <div className="barra" style={{ marginTop: 4, height: 8, ["--color-barra" as any]: p.color }}><span style={{ width: `${(p.esperado / maxEsperado) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
