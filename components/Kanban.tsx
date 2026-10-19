"use client";

import { FiClock, FiEye, FiTruck, FiCheckCircle, FiXCircle } from 'react-icons/fi';

interface Ticket {
  id: string;
  codigoTicket: string;
  estado: string;
  prioridadIA: string;
  analisisIA: string;
}

interface KanbanProps {
  tickets: Ticket[];
  onTicketSelect: (id: string) => void;
}

export default function Kanban({ tickets, onTicketSelect }: KanbanProps) {
  const columnas = [
    { id: 'PENDIENTE', titulo: 'Pendientes', color: '#e11d48', bg: '#fff1f2', icon: <FiClock /> },
    { id: 'EN_REVISION', titulo: 'En Revisión', color: '#0284c7', bg: '#f0f9ff', icon: <FiEye /> },
    { id: 'DESPACHADO', titulo: 'Despachados', color: '#4f46e5', bg: '#eef2ff', icon: <FiTruck /> },
    { id: 'RESUELTO', titulo: 'Resueltos', color: '#059669', bg: '#ecfdf5', icon: <FiCheckCircle /> }
  ];

  const obtenerEstiloPrioridad = (prioridad: string) => {
    if (prioridad === 'ALTA' || prioridad === 'CRITICA') return { backgroundColor: '#fff1f2', color: '#e11d48', borderColor: '#fecdd3' };
    if (prioridad === 'MEDIA') return { backgroundColor: '#fffbeb', color: '#d97706', borderColor: '#fde68a' };
    return { backgroundColor: '#f1f5f9', color: '#475569', borderColor: '#e2e8f0' };
  };

  return (
    <div style={{ display: 'flex', gap: '20px', height: '100%', width: '100%', overflowX: 'auto', paddingBottom: '10px' }}>
      {columnas.map(col => {
        const ticketsColumna = tickets.filter(t => t.estado === col.id);
        
        return (
          <div key={col.id} style={{ minWidth: '300px', flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#F4F7FE', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            {/* Cabecera de Columna */}
            <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid', borderColor: col.bg, backgroundColor: 'white', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: col.color, fontWeight: 900, fontSize: '12px', textTransform: 'uppercase' }}>
                {col.icon} {col.titulo}
              </div>
              <span style={{ backgroundColor: col.bg, color: col.color, padding: '4px 10px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold' }}>
                {ticketsColumna.length}
              </span>
            </div>

            {/* Tarjetas */}
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: 1 }}>
              {ticketsColumna.map(ticket => (
                <div 
                  key={ticket.id} 
                  onClick={() => onTicketSelect(ticket.id)}
                  style={{ backgroundColor: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', transition: 'transform 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 900, color: '#1e293b' }}>{ticket.codigoTicket}</span>
                    <span style={{ fontSize: '9px', fontWeight: 900, padding: '4px 8px', borderRadius: '8px', border: '1px solid', ...obtenerEstiloPrioridad(ticket.prioridadIA) }}>
                      {ticket.prioridadIA}
                    </span>
                  </div>
                  <p style={{ fontSize: '11px', color: '#475569', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {ticket.analisisIA}
                  </p>
                </div>
              ))}
              {ticketsColumna.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '11px', fontWeight: 'bold', fontStyle: 'italic' }}>
                  No hay tickets
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}