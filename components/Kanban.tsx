"use client";

import React, { useState, useMemo } from 'react';
import { 
  FiClock, 
  FiEye, 
  FiTruck, 
  FiCheckCircle, 
  FiMapPin, 
  FiCamera, 
  FiSearch, 
  FiFilter, 
  FiArrowRight,
  FiAlertOctagon
} from 'react-icons/fi';

export interface TicketKanban {
  id: string;
  codigoTicket: string;
  estado: string;
  prioridadIA: string;
  analisisIA: string;
  departamento?: string;
  categoria?: string;
  direccion?: string;
  createdAt?: string | Date;
  usuarioNombre?: string;
  tieneImagenes?: boolean;
  [key: string]: any;
}

interface KanbanProps {
  tickets: any[];
  onTicketSelect: (id: string) => void;
  onEstadoChange?: (ticketId: string, nuevoEstado: string) => void;
}

export default function Kanban({ tickets, onTicketSelect, onEstadoChange }: KanbanProps) {
  const [busqueda, setBusqueda] = useState('');
  const [deptoFiltro, setDeptoFiltro] = useState<string>('TODOS');
  const [draggedTicketId, setDraggedTicketId] = useState<string | null>(null);

  // Columnas del flujo de despacho C4
  const columnas = [
    { id: 'PENDIENTE', titulo: 'Pendientes', color: '#e11d48', bg: '#fff1f2', border: '#fecdd3', icon: <FiClock /> },
    { id: 'EN_REVISION', titulo: 'En Evaluación', color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd', icon: <FiEye /> },
    { id: 'DESPACHADO', titulo: 'En Terreno / Despachado', color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe', icon: <FiTruck /> },
    { id: 'RESUELTO', titulo: 'Resueltos / Cerrados', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', icon: <FiCheckCircle /> }
  ];

  // Estilos visuales por Departamento
  const getDeptoBadge = (depto?: string) => {
    switch (depto?.toUpperCase()) {
      case 'SEGURIDAD PÚBLICA':
      case 'SEGURIDAD':
        return { bg: '#1e3a8a', text: '#ffffff', label: 'Seguridad' };
      case 'DIMAO':
        return { bg: '#047857', text: '#ffffff', label: 'DIMAO' };
      case 'DOM':
        return { bg: '#c2410c', text: '#ffffff', label: 'DOM' };
      case 'TRÁNSITO':
      case 'TRANSITO':
        return { bg: '#6d28d9', text: '#ffffff', label: 'Tránsito' };
      case 'DIDECO':
        return { bg: '#be185d', text: '#ffffff', label: 'DIDECO' };
      default:
        return { bg: '#475569', text: '#ffffff', label: depto || 'Sin Asignar' };
    }
  };

  // Estilos visuales por Prioridad IA
  const getPrioridadStyle = (prioridad: string) => {
    switch (prioridad?.toUpperCase()) {
      case 'CRITICA':
      case 'CRÍTICA':
        return { bg: '#fef2f2', text: '#dc2626', border: '#fca5a5', isCritical: true };
      case 'ALTA':
        return { bg: '#fff1f2', text: '#e11d48', border: '#fecdd3', isCritical: false };
      case 'MEDIA':
        return { bg: '#fffbeb', text: '#d97706', border: '#fde68a', isCritical: false };
      default:
        return { bg: '#f8fafc', text: '#475569', border: '#e2e8f0', isCritical: false };
    }
  };

  // Formateador de tiempo relativo
  const getTiempoTranscurrido = (dateInput?: string | Date) => {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    const diffMin = Math.floor((new Date().getTime() - date.getTime()) / 60000);
    if (diffMin < 1) return 'Ahora';
    if (diffMin < 60) return `Hace ${diffMin}m`;
    const diffHoras = Math.floor(diffMin / 60);
    if (diffHoras < 24) return `Hace ${diffHoras}h`;
    return `Hace ${Math.floor(diffHoras / 24)}d`;
  };

  // Filtrado de tickets
  const ticketsFiltrados = useMemo(() => {
    return tickets.filter(t => {
      const cumpleBusqueda = 
        t.codigoTicket.toLowerCase().includes(busqueda.toLowerCase()) ||
        t.analisisIA.toLowerCase().includes(busqueda.toLowerCase()) ||
        (t.direccion && t.direccion.toLowerCase().includes(busqueda.toLowerCase()));

      const cumpleDepto = deptoFiltro === 'TODOS' || t.departamento?.toUpperCase() === deptoFiltro.toUpperCase();

      return cumpleBusqueda && cumpleDepto;
    });
  }, [tickets, busqueda, deptoFiltro]);

  // Manejo de Drag & Drop
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    setDraggedTicketId(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, nuevoEstado: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggedTicketId;
    if (id && onEstadoChange) {
      onEstadoChange(id, nuevoEstado);
    }
    setDraggedTicketId(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', width: '100%' }}>
      {/* BARRA SUPERIOR DE CONTROL DEL TABLERO KANBAN */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap',
        gap: '12px',
        backgroundColor: '#ffffff', 
        padding: '12px 20px', 
        borderRadius: '14px', 
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        {/* Buscador */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f8fafc', padding: '8px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', width: '280px' }}>
          <FiSearch style={{ color: '#64748b' }} />
          <input 
            type="text" 
            placeholder="Buscar por folio, resumen o calle..." 
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', width: '100%', color: '#0f172a' }}
          />
        </div>

        {/* Filtros de Departamento */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FiFilter style={{ color: '#64748b', fontSize: '14px' }} />
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Departamento:</span>
          {['TODOS', 'SEGURIDAD PÚBLICA', 'DIMAO', 'DOM', 'TRÁNSITO', 'DIDECO'].map(dept => (
            <button
              key={dept}
              onClick={() => setDeptoFiltro(dept)}
              style={{
                padding: '5px 10px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                border: '1px solid',
                borderColor: deptoFiltro === dept ? '#2563eb' : '#e2e8f0',
                backgroundColor: deptoFiltro === dept ? '#eff6ff' : '#ffffff',
                color: deptoFiltro === dept ? '#1d4ed8' : '#64748b',
                transition: 'all 0.15s ease'
              }}
            >
              {dept === 'TODOS' ? 'Todos' : dept.replace('SEGURIDAD PÚBLICA', 'Seguridad')}
            </button>
          ))}
        </div>
      </div>

      {/* ÁREA PRINCIPAL DE COLUMNAS KANBAN */}
      <div style={{ display: 'flex', gap: '16px', height: 'calc(100% - 60px)', width: '100%', overflowX: 'auto', paddingBottom: '8px' }}>
        {columnas.map(col => {
          const ticketsColumna = ticketsFiltrados.filter(t => t.estado === col.id);

          return (
            <div 
              key={col.id} 
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
              style={{ 
                minWidth: '320px', 
                maxWidth: '360px',
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                backgroundColor: '#F8FAFC', 
                borderRadius: '16px', 
                border: `1px solid ${col.border}`,
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
              }}
            >
              {/* Cabecera de Columna */}
              <div style={{ 
                padding: '14px 16px', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                backgroundColor: '#ffffff', 
                borderTopLeftRadius: '16px', 
                borderTopRightRadius: '16px',
                borderBottom: `2px solid ${col.color}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: col.color, fontWeight: 900, fontSize: '13px', letterSpacing: '0.3px' }}>
                  <span style={{ fontSize: '16px' }}>{col.icon}</span>
                  {col.titulo.toUpperCase()}
                </div>
                <span style={{ 
                  backgroundColor: col.bg, 
                  color: col.color, 
                  border: `1px solid ${col.border}`,
                  padding: '3px 10px', 
                  borderRadius: '20px', 
                  fontSize: '11px', 
                  fontWeight: 800 
                }}>
                  {ticketsColumna.length}
                </span>
              </div>

              {/* Lista de Tarjetas */}
              <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flex: 1 }}>
                {ticketsColumna.map(ticket => {
                  const prioStyle = getPrioridadStyle(ticket.prioridadIA);
                  const deptoBadge = getDeptoBadge(ticket.departamento);
                  const tiempoRelativo = getTiempoTranscurrido(ticket.createdAt);

                  return (
                    <div 
                      key={ticket.id} 
                      draggable
                      onDragStart={(e) => handleDragStart(e, ticket.id)}
                      onClick={() => onTicketSelect(ticket.id)}
                      style={{ 
                        backgroundColor: '#ffffff', 
                        padding: '14px', 
                        borderRadius: '12px', 
                        border: prioStyle.isCritical ? '2px solid #ef4444' : '1px solid #e2e8f0', 
                        cursor: 'grab', 
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.08)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                      }}
                    >
                      {/* Fila 1: Folio + Badges */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a' }}>{ticket.codigoTicket}</span>
                          {prioStyle.isCritical && (
                            <span title="Emergencia de alta prioridad" style={{ color: '#ef4444', animation: 'pulse 1.5s infinite' }}>
                              <FiAlertOctagon size={14} />
                            </span>
                          )}
                        </div>
                        
                        <span style={{ 
                          fontSize: '9px', 
                          fontWeight: 800, 
                          padding: '3px 7px', 
                          borderRadius: '6px', 
                          border: `1px solid ${prioStyle.border}`, 
                          backgroundColor: prioStyle.bg,
                          color: prioStyle.text
                        }}>
                          {ticket.prioridadIA}
                        </span>
                      </div>

                      {/* Fila 2: Resumen Dictamen IA */}
                      <p style={{ 
                        fontSize: '11px', 
                        color: '#334155', 
                        lineHeight: '1.4',
                        margin: '0 0 10px 0', 
                        display: '-webkit-box', 
                        WebkitLineClamp: 2, 
                        WebkitBoxOrient: 'vertical', 
                        overflow: 'hidden',
                        fontWeight: 500
                      }}>
                        {ticket.analisisIA}
                      </p>

                      {/* Fila 3: Metadata (Ubicación / Evidencia / Tiempo) */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px', fontSize: '10px', color: '#64748b' }}>
                        {ticket.direccion && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            <FiMapPin style={{ flexShrink: 0, color: '#94a3b8' }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ticket.direccion}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                          {ticket.tieneImagenes && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#2563eb', fontWeight: 700 }}>
                              <FiCamera /> Evidencia S3
                            </span>
                          )}
                          {tiempoRelativo && (
                            <span style={{ color: '#94a3b8', fontStyle: 'italic', marginLeft: 'auto' }}>
                              {tiempoRelativo}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Fila 4: Footer de Tarjeta con Departamento y Clic directo de Avance */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        paddingTop: '8px', 
                        borderTop: '1px solid #f1f5f9' 
                      }}>
                        <span style={{ 
                          backgroundColor: deptoBadge.bg, 
                          color: deptoBadge.text, 
                          padding: '2px 8px', 
                          borderRadius: '4px', 
                          fontSize: '9px', 
                          fontWeight: 800,
                          letterSpacing: '0.2px'
                        }}>
                          {deptoBadge.label}
                        </span>

                        {/* Botón rápido para mover de estado si se presiona */}
                        {onEstadoChange && col.id !== 'RESUELTO' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const siguienteEstado = 
                                col.id === 'PENDIENTE' ? 'EN_REVISION' :
                                col.id === 'EN_REVISION' ? 'DESPACHADO' : 'RESUELTO';
                              onEstadoChange(ticket.id, siguienteEstado);
                            }}
                            title="Avanzar de estado"
                            style={{
                              border: 'none',
                              background: '#f1f5f9',
                              color: '#334155',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '10px',
                              fontWeight: 700
                            }}
                          >
                            Avanzar <FiArrowRight size={10} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {ticketsColumna.length === 0 && (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '30px 10px', 
                    color: '#94a3b8', 
                    fontSize: '11px', 
                    fontWeight: 600,
                    border: '2px dashed #e2e8f0',
                    borderRadius: '12px',
                    backgroundColor: '#ffffff'
                  }}>
                    Sin denuncias en esta etapa
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}