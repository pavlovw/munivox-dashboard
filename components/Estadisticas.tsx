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
  FiShield,
  FiZap,
  FiLayers
} from 'react-icons/fi';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Paletas de colores institucionales
const COLORES_BASE = ['#0284c7', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b', '#14b8a6', '#f43f5e'];
const COLORES_PRIORIDAD: Record<string, string> = { 'CRITICA': '#ef4444', 'ALTA': '#f97316', 'MEDIA': '#eab308', 'BAJA': '#94a3b8' };
const COLORES_ESTADO: Record<string, string> = { 'PENDIENTE': '#e11d48', 'EN_REVISION': '#0284c7', 'DESPACHADO': '#4f46e5', 'RESUELTO': '#059669' };

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

  // 2. CÁLCULO DE KPIs Y PROCESAMIENTO MULTIDIMENSIONAL
  const { stats, graficos } = useMemo(() => {
    // Variables para KPIs
    const total = ticketsFiltrados.length;
    let resueltos = 0, pendientes = 0, criticos = 0;
    
    // Diccionarios para Gráficos
    const tendenciaDiaria: Record<string, any> = {};
    const deptosCount: Record<string, number> = {};
    const categorias: Record<string, number> = {};
    const horas: Record<string, number> = {};
    const estadosCount: Record<string, number> = { 'PENDIENTE': 0, 'EN_REVISION': 0, 'DESPACHADO': 0, 'RESUELTO': 0 };
    const prioridadesCount: Record<string, number> = { 'CRITICA': 0, 'ALTA': 0, 'MEDIA': 0, 'BAJA': 0 };
    const diasSemana: Record<string, number> = { 'Lunes': 0, 'Martes': 0, 'Miércoles': 0, 'Jueves': 0, 'Viernes': 0, 'Sábado': 0, 'Domingo': 0 };
    const rendimientoDepto: Record<string, { depto: string, Resueltos: number, Activos: number }> = {};

    ticketsFiltrados.forEach(t => {
      // KPIs Básicos
      if (t.estado === 'RESUELTO') resueltos++;
      if (t.estado === 'PENDIENTE') pendientes++;
      if (t.prioridadIA === 'ALTA' || t.prioridadIA === 'CRITICA') criticos++;
      
      const estadoNorm = t.estado || 'PENDIENTE';
      if (estadosCount[estadoNorm] !== undefined) estadosCount[estadoNorm]++;
      
      const prioNorm = t.prioridadIA?.toUpperCase() === 'CRÍTICA' ? 'CRITICA' : (t.prioridadIA?.toUpperCase() || 'BAJA');
      if (prioridadesCount[prioNorm] !== undefined) prioridadesCount[prioNorm]++;

      // Departamentos y Rendimiento
      const depto = t.departamento?.nombre || 'Sin Asignar';
      deptosCount[depto] = (deptosCount[depto] || 0) + 1;
      
      if (!rendimientoDepto[depto]) rendimientoDepto[depto] = { depto, Resueltos: 0, Activos: 0 };
      if (t.estado === 'RESUELTO') rendimientoDepto[depto].Resueltos++;
      else rendimientoDepto[depto].Activos++;

      // Categorías
      const cat = t.categoria?.nombre || 'Sin Clasificar';
      categorias[cat] = (categorias[cat] || 0) + 1;

      // Tiempo (Días, Fechas y Horas)
      if (t.createdAt) {
        const dateObj = new Date(t.createdAt);
        // Tendencia diaria
        const fecha = dateObj.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
        if (!tendenciaDiaria[fecha]) tendenciaDiaria[fecha] = { fecha, Ingresos: 0, Resueltos: 0 };
        tendenciaDiaria[fecha].Ingresos++;
        if (t.estado === 'RESUELTO') tendenciaDiaria[fecha].Resueltos++;

        // Hora
        const horaFormato = `${dateObj.getHours().toString().padStart(2, '0')}:00`;
        horas[horaFormato] = (horas[horaFormato] || 0) + 1;

        // Día de la Semana
        const diasNombres = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        diasSemana[diasNombres[dateObj.getDay()]]++;
      }
    });

    const resolucionPorcentaje = total > 0 ? Math.round((resueltos / total) * 100) : 0;
    
    // Top Departamento
    let topDepto = 'N/A';
    let maxDepto = 0;
    Object.entries(deptosCount).forEach(([d, count]) => {
      if (d !== 'Sin Asignar' && count > maxDepto) { maxDepto = count; topDepto = d; }
    });

    // Formateo para Recharts
    return {
      stats: { total, resueltos, pendientes, criticos, resolucionPorcentaje, topDepto },
      graficos: {
        tendencia: Object.values(tendenciaDiaria).sort((a, b) => a.fecha.localeCompare(b.fecha)),
        deptos: Object.entries(deptosCount).map(([name, value]) => ({ name, value })),
        rendimientoDeptos: Object.values(rendimientoDepto).filter(d => d.depto !== 'Sin Asignar'),
        categorias: Object.entries(categorias).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 7),
        horas: Object.entries(horas).map(([hora, cantidad]) => ({ hora, cantidad })).sort((a, b) => a.hora.localeCompare(b.hora)),
        estados: [
          { name: 'Pendiente (Cola)', value: estadosCount['PENDIENTE'] || 0, color: COLORES_ESTADO['PENDIENTE'] },
          { name: 'En Evaluación', value: estadosCount['EN_REVISION'] || 0, color: COLORES_ESTADO['EN_REVISION'] },
          { name: 'Despachado', value: estadosCount['DESPACHADO'] || 0, color: COLORES_ESTADO['DESPACHADO'] },
          { name: 'Resuelto', value: estadosCount['RESUELTO'] || 0, color: COLORES_ESTADO['RESUELTO'] }
        ],
        prioridades: [
          { name: 'CRÍTICA', value: prioridadesCount['CRITICA'] || 0, color: COLORES_PRIORIDAD['CRITICA'] },
          { name: 'ALTA', value: prioridadesCount['ALTA'] || 0, color: COLORES_PRIORIDAD['ALTA'] },
          { name: 'MEDIA', value: prioridadesCount['MEDIA'] || 0, color: COLORES_PRIORIDAD['MEDIA'] },
          { name: 'BAJA', value: prioridadesCount['BAJA'] || 0, color: COLORES_PRIORIDAD['BAJA'] }
        ],
        diasSemana: [
          { subject: 'Lun', A: diasSemana['Lunes'] },
          { subject: 'Mar', A: diasSemana['Martes'] },
          { subject: 'Mié', A: diasSemana['Miércoles'] },
          { subject: 'Jue', A: diasSemana['Jueves'] },
          { subject: 'Vie', A: diasSemana['Viernes'] },
          { subject: 'Sáb', A: diasSemana['Sábado'] },
          { subject: 'Dom', A: diasSemana['Domingo'] }
        ]
      }
    };
  }, [ticketsFiltrados]);

  // 3. GENERADOR DE REPORTE PDF
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
      pdf.save(`MuniVox_Reporte_Inteligencia_${new Date().toLocaleDateString('es-CL')}.pdf`);
    } catch (error) {
      console.error("Error al generar PDF:", error);
      alert("Hubo un error al generar el PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', backgroundColor: '#F4F7FE' }}>
      
      {/* BARRA DE FILTROS SUPERIOR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: '16px 24px', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <FiCalendar size={18} color="#64748b" />
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#334155' }}>FILTRO TEMPORAL:</span>
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
          {isExporting ? 'PROCESANDO PDF...' : 'EXPORTAR REPORTE OFICIAL'}
        </button>
      </div>

      {/* ÁREA EXPORTABLE AL PDF */}
      <div ref={printRef} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', backgroundColor: '#F4F7FE', flex: 1 }}>
        
        {/* Cabecera Membrete */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '3px solid #1e293b', paddingBottom: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: '#0f172a', letterSpacing: '1px' }}>INFORME TÁCTICO DE INCIVILIDADES</h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#475569', fontWeight: 700 }}>MUNICIPALIDAD DE BUIN • DEPARTAMENTO DE OPERACIONES C4</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ display: 'block', fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Periodo de Datos</span>
            <span style={{ fontSize: '16px', fontWeight: 900, color: '#0284c7' }}>{filtroTiempo.replace(/_/g, ' ')}</span>
          </div>
        </div>

        {/* 1. SECCIÓN KPIs EJECUTIVOS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '16px' }}>
          <KpiCard titulo="TOTAL INGRESOS" valor={stats.total} icono={<FiActivity size={20} />} color="#0284c7" bg="#f0f9ff" />
          <KpiCard titulo="TASA DE CIERRE" valor={`${stats.resolucionPorcentaje}%`} icono={<FiTrendingUp size={20} />} color="#059669" bg="#ecfdf5" />
          <KpiCard titulo="SLA PROMEDIO" valor="45 MIN" icono={<FiZap size={20} />} color="#8b5cf6" bg="#f5f3ff" />
          <KpiCard titulo="PENDIENTES (COLA)" valor={stats.pendientes} icono={<FiClock size={20} />} color="#d97706" bg="#fffbeb" />
          <KpiCard titulo="ALERTA CRÍTICA" valor={stats.criticos} icono={<FiAlertTriangle size={20} />} color="#e11d48" bg="#fff1f2" />
          <KpiCard titulo="MÁS DEMANDADO" valor={stats.topDepto} icono={<FiShield size={20} />} color="#0f172a" bg="#f1f5f9" textSize="12px" />
        </div>

        {/* 2. BLOQUE PRINCIPAL DE RENDIMIENTO Y FLUJO */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          
          <ChartCard titulo="TENDENCIA OPERATIVA (INGRESOS VS CIERRES)" icono={<FiTrendingUp color="#0284c7" />}>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={graficos.tendencia} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorResueltos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                <Area isAnimationActive={false} type="monotone" dataKey="Ingresos" stroke="#0284c7" strokeWidth={3} fillOpacity={1} fill="url(#colorIngresos)" />
                <Area isAnimationActive={false} type="monotone" dataKey="Resueltos" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorResueltos)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard titulo="EMBUDO DE ESTADOS C4" icono={<FiLayers color="#d97706" />}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={graficos.estados} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#475569', fontWeight: 600 }} width={90} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }} />
                <Bar isAnimationActive={false} dataKey="value" radius={[0, 6, 6, 0]} barSize={24}>
                  {graficos.estados.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

        </div>

        {/* 3. BLOQUE DEPARTAMENTOS Y RIESGO */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '24px' }}>
          
          <ChartCard titulo="CARGA DEPARTAMENTAL" icono={<FiPieChart color="#8b5cf6" />}>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie isAnimationActive={false} data={graficos.deptos} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
                  {graficos.deptos.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORES_BASE[index % COLORES_BASE.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 700 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard titulo="EFICIENCIA DE RESOLUCIÓN POR DEPARTAMENTO" icono={<FiShield color="#0f172a" />}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={graficos.rendimientoDeptos} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="depto" tick={{ fontSize: 10, fill: '#475569', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                <Bar isAnimationActive={false} dataKey="Resueltos" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} barSize={35} />
                <Bar isAnimationActive={false} dataKey="Activos" stackId="a" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={35} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard titulo="MATRIZ DE RIESGO (IA)" icono={<FiAlertTriangle color="#ef4444" />}>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie isAnimationActive={false} data={graficos.prioridades} cx="50%" cy="50%" outerRadius={90} dataKey="value" stroke="none">
                  {graficos.prioridades.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 700 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

        </div>

        {/* 4. BLOQUE CATEGORÍAS Y COMPORTAMIENTO HORARIO */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '24px' }}>
          
          <ChartCard titulo="TOP 7 INCIVILIDADES Y EMERGENCIAS MÁS REPORTADAS" icono={<FiTarget color="#f59e0b" />}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={graficos.categorias} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#475569', fontWeight: 600 }} width={120} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                <Bar isAnimationActive={false} dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20}>
                  {graficos.categorias.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORES_BASE[index % COLORES_BASE.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard titulo="CONCENTRACIÓN HORARIA" icono={<FiClock color="#14b8a6" />}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={graficos.horas} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="hora" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                <Bar isAnimationActive={false} dataKey="cantidad" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard titulo="MAPA DE CALOR SEMANAL" icono={<FiCalendar color="#6366f1" />}>
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={graficos.diasSemana}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#475569', fontWeight: 600 }} />
                <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fontSize: 8 }} />
                <Radar isAnimationActive={false} name="Emergencias" dataKey="A" stroke="#6366f1" strokeWidth={2} fill="#818cf8" fillOpacity={0.5} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
              </RadarChart>
            </ResponsiveContainer>
          </ChartCard>

        </div>

      </div>
    </div>
  );
}

// ---------------- Componentes Auxiliares UI ---------------- //

function KpiCard({ titulo, valor, icono, color, bg, textSize = "22px" }: any) {
  return (
    <div style={{ backgroundColor: 'white', padding: '14px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
      <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: bg, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icono}
      </div>
      <div style={{ overflow: 'hidden' }}>
        <h4 style={{ fontSize: '8px', fontWeight: 900, color: '#94a3b8', margin: '0 0 2px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{titulo}</h4>
        <span style={{ fontSize: textSize, fontWeight: 900, color: '#1e293b', lineHeight: 1.1, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {valor}
        </span>
      </div>
    </div>
  );
}

function ChartCard({ titulo, icono, children }: any) {
  return (
    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' }}>
      <h3 style={{ fontSize: '11px', fontWeight: 900, color: '#1e293b', marginTop: 0, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '0.5px' }}>
        {icono} {titulo}
      </h3>
      <div style={{ flex: 1, width: '100%' }}>
        {children}
      </div>
    </div>
  );
}