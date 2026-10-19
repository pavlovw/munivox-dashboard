"use client";

import { FiActivity, FiPieChart, FiTrendingUp, FiAlertTriangle } from 'react-icons/fi';
import { useMemo } from 'react';

interface Ticket {
  estado: string;
  prioridadIA: string;
  analisisIA: string;
}

export default function Estadisticas({ tickets }: { tickets: Ticket[] }) {
  // Cálculos en tiempo real
  const stats = useMemo(() => {
    const total = tickets.length;
    const resueltos = tickets.filter(t => t.estado === 'RESUELTO').length;
    const pendientes = tickets.filter(t => t.estado === 'PENDIENTE').length;
    const criticos = tickets.filter(t => t.prioridadIA === 'ALTA' || t.prioridadIA === 'CRITICA').length;
    
    const resolucionPorcentaje = total > 0 ? Math.round((resueltos / total) * 100) : 0;

    return { total, resueltos, pendientes, criticos, resolucionPorcentaje };
  }, [tickets]);

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* KPIs Principales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
        <KpiCard titulo="TOTAL REPORTES" valor={stats.total} icono={<FiActivity size={24} />} color="#0284c7" bg="#f0f9ff" />
        <KpiCard titulo="TASA DE RESOLUCIÓN" valor={`${stats.resolucionPorcentaje}%`} icono={<FiTrendingUp size={24} />} color="#059669" bg="#ecfdf5" />
        <KpiCard titulo="PENDIENTES (COLA)" valor={stats.pendientes} icono={<FiPieChart size={24} />} color="#d97706" bg="#fffbeb" />
        <KpiCard titulo="INCIDENTES CRÍTICOS" valor={stats.criticos} icono={<FiAlertTriangle size={24} />} color="#e11d48" bg="#fff1f2" />
      </div>

      {/* Área de Gráficos Simulados / Detalles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', flex: 1 }}>
        <div style={{ backgroundColor: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', padding: '24px' }}>
          <h3 style={{ fontSize: '12px', fontWeight: 900, color: '#1e293b', marginTop: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Progreso de la Jornada</h3>
          <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>Porcentaje de tickets resueltos vs ingresados hoy.</p>
          
          <div style={{ width: '100%', height: '24px', backgroundColor: '#f1f5f9', borderRadius: '12px', overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: `${stats.resolucionPorcentaje}%`, backgroundColor: '#10b981', height: '100%', transition: 'width 1s ease-in-out' }}></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px', fontWeight: 'bold', color: '#94a3b8' }}>
            <span>0%</span>
            <span>{stats.resolucionPorcentaje}% Completado</span>
            <span>100%</span>
          </div>
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', padding: '24px' }}>
          <h3 style={{ fontSize: '12px', fontWeight: 900, color: '#1e293b', marginTop: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Atención Requerida</h3>
          <p style={{ fontSize: '12px', color: '#64748b' }}>Actualmente hay <strong style={{ color: '#e11d48' }}>{stats.criticos} casos críticos</strong> que requieren despacho inmediato de móviles municipales. Revisa el tablero Kanban para reasignarlos.</p>
        </div>
      </div>
    </div>
  );
}

// Componente auxiliar para las tarjetas de KPI
function KpiCard({ titulo, valor, icono, color, bg }: any) {
  return (
    <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '24px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
      <div style={{ width: '56px', height: '56px', borderRadius: '16px', backgroundColor: bg, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icono}
      </div>
      <div>
        <h4 style={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '1px' }}>{titulo}</h4>
        <span style={{ fontSize: '28px', fontWeight: 900, color: '#1e293b', lineHeight: 1 }}>{valor}</span>
      </div>
    </div>
  );
}