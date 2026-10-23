"use client";

import React, { useEffect, useState } from 'react';
import Map from '@/components/Map';

// Reemplaza esto con la URL base real de tu API Gateway de AWS
const API_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://tu-api-gateway.execute-api.us-east-1.amazonaws.com';

export default function DepartamentoDashboard() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);

  // ID del departamento de prueba (ej: 1 para Aseo y Ornato)
  const miDepartamentoId = 1; 

  useEffect(() => {
    const cargarTicketsDepartamento = async () => {
      try {
        // Llamada directo a tu Lambda a través de API Gateway con el filtro de departamento
        const respuesta = await fetch(`${API_URL}/tickets?departamentoId=${miDepartamentoId}`);
        if (!respuesta.ok) throw new Error('Error al cargar tickets del departamento');
        
        const data = await respuesta.json();
        setTickets(data);
      } catch (error) {
        console.error('Error fetching department tickets:', error);
      } finally {
        setCargando(false);
      }
    };

    cargarTicketsDepartamento();
  }, []);

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#f8fafc' }}>
      
      {/* PANEL LATERAL DEL DEPARTAMENTO */}
      <div style={{ width: '380px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', zIndex: 20, boxShadow: '4px 0 15px rgba(0,0,0,0.05)' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            Panel Operativo
          </span>
          <h1 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', margin: '4px 0 0 0' }}>
            Aseo y Ornato
          </h1>
        </div>

        <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
          {cargando ? (
            <p style={{ fontSize: '14px', color: '#64748b', fontWeight: 600 }}>Sincronizando reportes...</p>
          ) : (
            <>
              <p style={{ fontSize: '14px', color: '#334155', fontWeight: 700, marginBottom: '16px' }}>
                {tickets.length} incidencias asignadas
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {tickets.map(ticket => (
                  <div key={ticket.id} style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#f8fafc', cursor: 'pointer' }} onClick={() => console.log('Seleccionado:', ticket.id)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 900, color: '#0284c7' }}>{ticket.codigoTicket}</span>
                      <span style={{ fontSize: '10px', fontWeight: 800, padding: '4px 8px', borderRadius: '999px', backgroundColor: '#e2e8f0', color: '#475569' }}>
                        {ticket.estado}
                      </span>
                    </div>
                    <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b', margin: '0 0 4px 0' }}>
                      {ticket.categoria?.nombre || 'Sin categoría'}
                    </h3>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {ticket.descripcionUsuario}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* MAPA REUTILIZADO */}
      <div style={{ flex: 1, position: 'relative' }}>
        <Map 
          tickets={tickets} 
          onTicketSelect={(id) => console.log('Centrar en ticket:', id)} 
        />
      </div>
      
    </div>
  );
}