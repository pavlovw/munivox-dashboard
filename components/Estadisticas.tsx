"use client";

import React, { useState, useMemo, useRef } from 'react';
import { 
  FiActivity, 
  FiPieChart, 
  FiTrendingUp, 
  FiAlertTriangle, 
  FiDownload, 
  FiCalendar,
  FiClock,
  FiTarget,
  FiShield
} from 'react-icons/fi';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend 
} from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Paleta de colores institucionales
const COLORES = ['#0284c7', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b', '#14b8a6', '#f43f5e'];

interface Ticket {
  id: string;
  codigoTicket: string;
  estado: string;
  prioridadIA: string;
  analisisIA: string;
  createdAt?: string | Date;
  departamento?: { nombre: string };
  categoria?: { nombre: string };
  historial?: any[];
}

export default function Estadisticas({ tickets }: { tickets: Ticket[] }) {
  const [filtroTiempo, setFiltroTiempo] = useState<string>('ESTA_SEMANA');
  const [isExporting, setIsExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // 1. LÓGICA DE FILTRADO TEMPORAL
  const ticketsFiltrados = useMemo(() => {
    const ahora = new Date();
    const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    
    return tickets.filter(t => {
      if (!t.createdAt) return true;
      const fechaTicket = new Date(t.createdAt);
      const diffDias = Math.floor((hoy.getTime() - fechaTicket.getTime()) / (1000 * 60 * 60 * 24));

      switch (filtroTiempo) {
        case 'HOY': return diffDias === 0;
        case 'ESTA_SEMANA': {
          const diaSemana = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1; // Lunes a Domingo
          return diffDias <= diaSemana;
        }
        case 'ULTIMA_SEMANA': return diffDias <= 7;
        case 'ULTIMO_MES': return diffDias <= 30;
        case 'ULTIMOS_3_MESES': return diffDias <= 90;
        case 'ULTIMOS_6_MESES': return diffDias <= 180;
        case 'ULTIMOS_9_MESES': return diffDias <= 270;
        case 'ULTIMO_ANO': return diffDias <= 365;
        default: return true;
      }
    });
  }, [tickets, filtroTiempo]);

  // 2. CÁLCULO DE KPIs PRINCIPALES
  const stats = useMemo(() => {
    const total = ticketsFiltrados.length;
    const resueltos = ticketsFiltrados.filter(t => t.estado === 'RESUELTO').length;
    const pendientes = ticketsFiltrados.filter(t => t.estado === 'PENDIENTE').length;
    const criticos = ticketsFiltrados.filter(t => t.prioridadIA === 'ALTA' || t.prioridadIA === 'CRITICA').length;
    
    const resolucionPorcentaje = total > 0 ? Math.round((resueltos / total) * 100) : 0;

    // Calcular departamento más demandado
    const deptosCount: Record<string, number> = {};
    ticketsFiltrados.forEach(t => {
      const depto = t.departamento?.nombre || 'Sin Asignar';
      deptosCount[depto] = (deptosCount[depto] || 0) + 1;
    });
    
    let topDepto = 'N/A';
    let maxDepto = 0;
    Object.entries(deptosCount).forEach(([depto, count]) => {
      if (depto !== 'Sin Asignar' && count > maxDepto) {
        maxDepto = count;
        topDepto = depto;
      }
    });

    return { total, resueltos, pendientes, criticos, resolucionPorcentaje, topDepto };
  }, [ticketsFiltrados]);

  // 3. PROCESAMIENTO DE DATOS PARA GRÁFICOS
  const dataGraficos = useMemo(() => {
    const tendenciaDiaria: Record<string, any> = {};
    const deptos: Record<string, number> = {};
    const categorias: Record<string, number> = {};
    const horas: Record<string, number> = {};

    ticketsFiltrados.forEach(t => {
      // Tendencia Temporal (Por Día)
      const fecha = t.createdAt ? new Date(t.createdAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }) : 'Sin Fecha';
      if (!tendenciaDiaria[fecha]) tendenciaDiaria[fecha] = { fecha, Ingresos: 0, Resueltos: 0 };
      tendenciaDiaria[fecha].Ingresos += 1;
      if (t.estado === 'RESUELTO') tendenciaDiaria[fecha].Resueltos += 1;

      // Departamentos
      const depto = t.departamento?.nombre || 'Sin Asignar';
      deptos[depto] = (deptos[depto] || 0) + 1;

      // Categorías
      const cat = t.categoria?.nombre || 'Sin Clasificar';
      categorias[cat] = (categorias[cat] || 0) + 1;

      // Horas del día (0-23)
      if (t.createdAt) {
        const hora = new Date(t.createdAt).getHours();
        const horaFormato = `${hora.toString().padStart(2, '0')}:00`;
        horas[horaFormato] = (horas[horaFormato] || 0) + 1;
      }
    });

    // Formatear Arrays para Recharts
    const dataTendencia = Object.values(tendenciaDiaria).sort((a, b) => a.fecha.localeCompare(b.fecha));
    
    const dataDeptos = Object.entries(deptos).map(([name, value]) => ({ name, value }));
    
    const dataCategorias = Object.entries(categorias)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7); // Top 7

    const dataHoras = Object.entries(horas)
      .map(([hora, cantidad]) => ({ hora, cantidad }))
      .sort((a, b) => a.hora.localeCompare(b.hora));

    return { dataTendencia, dataDeptos, dataCategorias, dataHoras };
  }, [ticketsFiltrados]);

  // 4. GENERADOR DE REPORTE PDF
  const generarPDF = async () => {
    if (!printRef.current) return;
    setIsExporting(true);
    
    try {
      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, backgroundColor: '#F8FAFC' });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Reporte_MuniVox_C4_${new Date().toLocaleDateString('es-CL')}.pdf`);
    } catch (error) {
      console.error("Error al generar PDF:", error);
      alert("Hubo un error al generar el PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', backgroundColor: '#F4F7FE' }}>
      
      {/* BARRA DE FILTROS SUPERIOR (Fija en el componente) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: '16px 24px', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <FiCalendar size={18} color="#64748b" />
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#334155' }}>PERIODO DE ANÁLISIS:</span>
          <select 
            value={filtroTiempo}
            onChange={(e) => setFiltroTiempo(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '12px', fontWeight: 700, color: '#0f172a', outline: 'none', cursor: 'pointer' }}
          >
            <option value="HOY">Hoy</option>
            <option value="ESTA_SEMANA">Esta Semana (Lun-Dom)</option>
            <option value="ULTIMA_SEMANA">Últimos 7 días</option>
            <option value="ULTIMO_MES">Último Mes</option>
            <option value="ULTIMOS_3_MESES">Últimos 3 Meses</option>
            <option value="ULTIMOS_6_MESES">Últimos 6 Meses</option>
            <option value="ULTIMOS_9_MESES">Últimos 9 Meses</option>
            <option value="ULTIMO_ANO">Último Año</option>
            <option value="TODOS">Histórico Completo</option>
          </select>
        </div>

        <button 
          onClick={generarPDF}
          disabled={isExporting}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: isExporting ? '#94a3b8' : '#ef4444', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '10px', fontSize: '12px', fontWeight: 800, cursor: isExporting ? 'not-allowed' : 'pointer', transition: 'background 0.2s', boxShadow: '0 2px 4px rgba(239,68,68,0.2)' }}
        >
          <FiDownload size={16} /> 
          {isExporting ? 'GENERANDO INFORME...' : 'DESCARGAR INFORME PDF'}
        </button>
      </div>

      {/* ÁREA DEL REPORTE (Contenedor que se exporta a PDF) */}
      <div ref={printRef} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', backgroundColor: '#F4F7FE', flex: 1 }}>
        
        {/* Cabecera del PDF (Solo visible claro en el diseño) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: '#0f172a', letterSpacing: '1px' }}>REPORTE DE INCIVILIDADES Y EMERGENCIAS</h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Municipalidad de Buin • Central C4 MuniVox</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ display: 'block', fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Periodo Evaluado</span>
            <span style={{ fontSize: '14px', fontWeight: 900, color: '#0284c7' }}>{filtroTiempo.replace(/_/g, ' ')}</span>
          </div>
        </div>

        {/* 1. KPIs EJECUTIVOS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
          <KpiCard titulo="TOTAL INGRESOS" valor={stats.total} icono={<FiActivity size={22} />} color="#0284c7" bg="#f0f9ff" />
          <KpiCard titulo="TASA DE CIERRE" valor={`${stats.resolucionPorcentaje}%`} icono={<FiTrendingUp size={22} />} color="#059669" bg="#ecfdf5" />
          <KpiCard titulo="PENDIENTES (COLA)" valor={stats.pendientes} icono={<FiClock size={22} />} color="#d97706" bg="#fffbeb" />
          <KpiCard titulo="CASOS CRÍTICOS" valor={stats.criticos} icono={<FiAlertTriangle size={22} />} color="#e11d48" bg="#fff1f2" />
          <KpiCard titulo="MÁS DEMANDADO" valor={stats.topDepto} icono={<FiShield size={22} />} color="#6366f1" bg="#eef2ff" textSize="14px" />
        </div>

        {/* 2. GRÁFICOS PRIMARIOS (Tendencia y Departamentos) */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 900, color: '#1e293b', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiTrendingUp color="#0284c7" /> TENDENCIA TEMPORAL DE INGRESOS VS RESOLUCIONES
            </h3>
            <div style={{ width: '100%', height: '300px', marginTop: '16px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dataGraficos.dataTendencia} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                  <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 600 }} />
                  <Line type="monotone" dataKey="Ingresos" stroke="#0284c7" strokeWidth={3} dot={{ r: 4, fill: '#0284c7', strokeWidth: 0 }} />
                  <Line type="monotone" dataKey="Resueltos" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 900, color: '#1e293b', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiPieChart color="#8b5cf6" /> DISTRIBUCIÓN POR DEPARTAMENTO
            </h3>
            <div style={{ width: '100%', height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dataGraficos.dataDeptos} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value">
                    {dataGraficos.dataDeptos.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORES[index % COLORES.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                  <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* 3. GRÁFICOS SECUNDARIOS (Top Categorías y Mapa de Calor Horario) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 900, color: '#1e293b', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiTarget color="#f59e0b" /> TOP 7 CATEGORÍAS MÁS REPORTADAS
            </h3>
            <div style={{ width: '100%', height: '280px', marginTop: '16px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataGraficos.dataCategorias} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#475569', fontWeight: 600 }} width={120} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[0, 6, 6, 0]}>
                    {dataGraficos.dataCategorias.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORES[index % COLORES.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 900, color: '#1e293b', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiClock color="#10b981" /> VOLUMEN DE INGRESOS POR HORA DEL DÍA
            </h3>
            <div style={{ width: '100%', height: '280px', marginTop: '16px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataGraficos.dataHoras} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="hora" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="cantidad" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

// Componente auxiliar para las tarjetas de KPI
function KpiCard({ titulo, valor, icono, color, bg, textSize = "24px" }: any) {
  return (
    <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
      <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: bg, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icono}
      </div>
      <div style={{ overflow: 'hidden' }}>
        <h4 style={{ fontSize: '9px', fontWeight: 900, color: '#94a3b8', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{titulo}</h4>
        <span style={{ fontSize: textSize, fontWeight: 900, color: '#1e293b', lineHeight: 1.1, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {valor}
        </span>
      </div>
    </div>
  );
}