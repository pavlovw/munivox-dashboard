"use client";

import React, { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import dynamic from 'next/dynamic';
import { FiLogOut, FiCheckCircle, FiXCircle, FiNavigation, FiMap, FiArrowLeft, FiCamera } from 'react-icons/fi';

// Importamos el mismo mapa ligero y optimizado que usa el Departamento
const MapComponentSimple = dynamic(() => import('@/components/Map'), { 
  ssr: false, 
  loading: () => <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#e2e8f0' }}>Cargando mapa...</div> 
});

const API_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://nn4p1ybmu2.execute-api.us-east-2.amazonaws.com';

interface Ticket {
  id: string;
  codigoTicket: string;
  estado: string;
  latitud: number;
  longitud: number;
  descripcionUsuario: string;
  categoria?: { nombre: string };
  evidencias?: { url: string; tipo: string }[];
}

export default function TerrenoDashboard() {
  const { data: session } = useSession();
  const emailUsuario = session?.user?.email || '';

  const [gpsActivo, setGpsActivo] = useState<boolean>(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  
  // Estado para la navegación entre Vistas (Lista vs Detalle)
  const [ticketActivo, setTicketActivo] = useState<Ticket | null>(null);
  
  // Estados para las acciones del caso
  const [confirmarAsignacion, setConfirmarAsignacion] = useState<boolean>(false);
  const [textoConfirmacion, setTextoConfirmacion] = useState('');
  const [procesando, setProcesando] = useState<boolean>(false);

  // 1. PERSISTENCIA DE GPS
  useEffect(() => {
    const gpsGuardado = localStorage.getItem('munivox_gps_activo');
    if (gpsGuardado === 'true') setGpsActivo(true);
  }, []);

  useEffect(() => {
    let watchId: number;
    if (gpsActivo && emailUsuario) {
      localStorage.setItem('munivox_gps_activo', 'true');
      watchId = navigator.geolocation.watchPosition(
        async (position) => {
          try {
            await fetch(`${API_URL}/operadores/ubicacion`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: emailUsuario, latitud: position.coords.latitude, longitud: position.coords.longitude, gpsActivo: true })
            });
          } catch (e) {}
        },
        (error) => console.warn(error),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      );
    } else {
      localStorage.setItem('munivox_gps_activo', 'false');
      if (emailUsuario) {
        fetch(`${API_URL}/operadores/ubicacion`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailUsuario, gpsActivo: false })
        }).catch(console.error);
      }
    }
    return () => { if (watchId) navigator.geolocation.clearWatch(watchId); };
  }, [gpsActivo, emailUsuario]);

  // 2. CARGA DE TAREAS
  const cargarTareas = async (silencioso = false) => {
    if (!emailUsuario) return;
    if (!silencioso) setCargando(true);
    try {
      const res = await fetch(`${API_URL}/tickets?operadorEmail=${emailUsuario}`);
      if (res.ok) {
        const data = await res.json();
        const activos = data.filter((t: Ticket) => t.estado !== 'RESUELTO' && t.estado !== 'DESCARTADO');
        setTickets(activos);
        
        // Actualizar el ticket activo si hubo cambios desde el servidor
        if (ticketActivo) {
          const actualizado = activos.find((t: Ticket) => t.id === ticketActivo.id);
          if (actualizado) setTicketActivo(actualizado);
          else setTicketActivo(null); // Si ya no está en la lista, volvemos al inicio
        }
      }
    } catch (error) {} finally {
      if (!silencioso) setCargando(false);
    }
  };

  useEffect(() => {
    cargarTareas();
    const interval = setInterval(() => cargarTareas(true), 15000);
    return () => clearInterval(interval);
  }, [emailUsuario, ticketActivo]);

  // 3. FUNCIONES DE BOTONES
  const aceptarTarea = async () => {
    if (!ticketActivo) return;
    setProcesando(true);
    try {
      const res = await fetch(`${API_URL}/tickets/${ticketActivo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nuevoEstado: 'DESPACHADO', comentario: 'Unidad móvil aceptó la tarea y va en camino.' })
      });
      if (res.ok) {
        setConfirmarAsignacion(false);
        await cargarTareas();
      }
    } catch (e) {} finally { setProcesando(false); }
  };

  const rechazarTarea = async () => {
    if (!ticketActivo) return;
    const motivo = prompt("Motivo del rechazo (ej: En colación, falla mecánica):");
    if (!motivo) return;

    setProcesando(true);
    try {
      const res = await fetch(`${API_URL}/tickets/${ticketActivo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operadorAsignadoId: null, nuevoEstado: 'EN_REVISION', comentario: `Rechazado por funcionario: ${motivo}` })
      });
      if (res.ok) {
        setTicketActivo(null); // Lo sacamos de la vista
        await cargarTareas();
      }
    } catch (e) {} finally { setProcesando(false); }
  };

  const resolverTarea = async () => {
    if (textoConfirmacion !== 'confirmar' || !ticketActivo) {
      alert('Escribe "confirmar" en minúsculas.');
      return;
    }
    setProcesando(true);
    try {
      const res = await fetch(`${API_URL}/tickets/${ticketActivo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nuevoEstado: 'RESUELTO', comentario: 'El funcionario ha resuelto el problema.' })
      });
      if (res.ok) {
        setTextoConfirmacion('');
        setTicketActivo(null);
        await cargarTareas();
      }
    } catch (e) {} finally { setProcesando(false); }
  };

  const abrirNavegador = (lat: number, lng: number, tipo: 'maps' | 'waze') => {
    if (tipo === 'maps') window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
    if (tipo === 'waze') window.open(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`, '_blank');
  };

  // ==========================================
  // RENDERIZADO VISTA DETALLE DE TICKET
  // ==========================================
  if (ticketActivo) {
    const estado = ticketActivo.estado;
    return (
      <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>
        
        {/* HEADER DETALLE */}
        <div style={{ backgroundColor: 'white', padding: '16px', display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 50 }}>
          <button onClick={() => { setTicketActivo(null); setConfirmarAsignacion(false); }} style={{ background: 'none', border: 'none', padding: 0, color: '#334155' }}>
            <FiArrowLeft size={24} />
          </button>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '16px', margin: 0, fontWeight: 900, color: '#0f172a' }}>{ticketActivo.codigoTicket}</h2>
            <span style={{ fontSize: '11px', color: '#64748b' }}>{ticketActivo.categoria?.nombre}</span>
          </div>
        </div>

        {/* MAPA LIGERO VISUAL (Fijo arriba) */}
        <div style={{ height: '200px', width: '100%', backgroundColor: '#cbd5e1', position: 'relative' }}>
          <MapComponentSimple tickets={[ticketActivo]} coordenadaSeleccionada={[ticketActivo.latitud, ticketActivo.longitud]} onTicketSelect={() => {}} />
          <div style={{ position: 'absolute', bottom: 10, left: 10, zIndex: 10, backgroundColor: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            Navegación Táctil
          </div>
        </div>

        <div style={{ padding: '20px', paddingBottom: '100px' }}>
          
          {/* DESCRIPCIÓN */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '12px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Reporte del Ciudadano</h3>
            <p style={{ fontSize: '14px', color: '#334155', lineHeight: 1.6, margin: 0 }}>{ticketActivo.descripcionUsuario}</p>
          </div>

          {/* EVIDENCIA FOTOGRÁFICA */}
          {ticketActivo.evidencias && ticketActivo.evidencias.length > 0 && (
            <div style={{ marginBottom: '30px' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FiCamera /> Evidencia Adjunta
              </h3>
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
                {ticketActivo.evidencias.map((ev, i) => (
                  <img key={i} src={ev.url} alt="Evidencia" style={{ height: '120px', width: 'auto', borderRadius: '12px', objectFit: 'cover', border: '1px solid #e2e8f0' }} />
                ))}
              </div>
            </div>
          )}

          <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '20px 0' }} />

          {/* ACCIONES: ESPERANDO CONFIRMACIÓN */}
          {estado === 'EN_REVISION' && !confirmarAsignacion && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={rechazarTarea} style={{ flex: 1, padding: '16px', borderRadius: '16px', backgroundColor: 'white', color: '#ef4444', border: '1px solid #ef4444', fontSize: '14px', fontWeight: 900 }}>
                RECHAZAR
              </button>
              <button onClick={() => setConfirmarAsignacion(true)} style={{ flex: 1, padding: '16px', borderRadius: '16px', backgroundColor: '#10b981', color: 'white', border: 'none', fontSize: '14px', fontWeight: 900, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                <FiCheckCircle size={18} /> ACEPTAR
              </button>
            </div>
          )}

          {/* ACCIONES: CONFIRMAR SÍ O NO */}
          {estado === 'EN_REVISION' && confirmarAsignacion && (
            <div style={{ backgroundColor: '#ecfdf5', padding: '20px', borderRadius: '16px', border: '1px solid #10b981', textAlign: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 900, color: '#065f46', margin: '0 0 16px 0' }}>¿Confirmas asignación de ruta?</h3>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setConfirmarAsignacion(false)} disabled={procesando} style={{ flex: 1, padding: '14px', borderRadius: '12px', backgroundColor: 'white', color: '#64748b', border: '1px solid #cbd5e1', fontWeight: 900 }}>
                  NO
                </button>
                <button onClick={aceptarTarea} disabled={procesando} style={{ flex: 2, padding: '14px', borderRadius: '12px', backgroundColor: '#10b981', color: 'white', border: 'none', fontWeight: 900, fontSize: '16px' }}>
                  {procesando ? 'Procesando...' : 'SÍ, CONFIRMAR'}
                </button>
              </div>
            </div>
          )}

          {/* ACCIONES: DESPACHADO (EN CAMINO / RESOLVER) */}
          {estado === 'DESPACHADO' && (
            <div>
              <h3 style={{ fontSize: '12px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>CÓMO LLEGAR</h3>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
                <button onClick={() => abrirNavegador(ticketActivo.latitud, ticketActivo.longitud, 'waze')} style={{ flex: 1, padding: '16px', borderRadius: '16px', backgroundColor: '#e0f2fe', color: '#0284c7', border: 'none', fontWeight: 900, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <FiNavigation size={24} /> WAZE
                </button>
                <button onClick={() => abrirNavegador(ticketActivo.latitud, ticketActivo.longitud, 'maps')} style={{ flex: 1, padding: '16px', borderRadius: '16px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', fontWeight: 900, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <FiMap size={24} /> MAPS
                </button>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '16px', border: '2px dashed #cbd5e1' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 900, color: '#475569', marginBottom: '12px', textAlign: 'center' }}>
                  MARCAR COMO YA RESUELTO
                </label>
                <p style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', margin: '0 0 12px 0' }}>Escribe <strong>confirmar</strong> para cerrar el caso oficial.</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" placeholder="confirmar" value={textoConfirmacion} onChange={(e) => setTextoConfirmacion(e.target.value)}
                    style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '16px', textAlign: 'center', fontWeight: 'bold' }}
                  />
                  <button 
                    onClick={resolverTarea} disabled={textoConfirmacion !== 'confirmar' || procesando}
                    style={{ padding: '0 24px', backgroundColor: textoConfirmacion === 'confirmar' ? '#10b981' : '#cbd5e1', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 900, transition: 'background 0.3s' }}
                  >
                    LISTO
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    );
  }

  // ==========================================
  // RENDERIZADO VISTA RESUMEN (LISTA PRINCIPAL)
  // ==========================================
  return (
    <div style={{ backgroundColor: '#f1f5f9', minHeight: '100vh', paddingBottom: '40px', fontFamily: 'system-ui, sans-serif' }}>
      {/* HEADER */}
      <div style={{ backgroundColor: '#0f172a', color: 'white', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 50 }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 900, margin: 0 }}>Móvil Terreno</h1>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 0 0' }}>{session?.user?.name || emailUsuario}</p>
        </div>
        <button onClick={() => signOut({ callbackUrl: '/' })} style={{ background: 'transparent', border: 'none', color: '#ef4444', padding: '8px' }}>
          <FiLogOut size={20} />
        </button>
      </div>

      {/* CONTROL GPS */}
      <div style={{ backgroundColor: 'white', padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ display: 'block', fontSize: '14px', fontWeight: 800, color: '#1e293b' }}>Señal GPS C4</span>
          <span style={{ fontSize: '11px', color: gpsActivo ? '#10b981' : '#64748b', fontWeight: 600 }}>{gpsActivo ? '🟢 Transmitiendo' : '⚪ Apagado'}</span>
        </div>
        <div onClick={() => setGpsActivo(!gpsActivo)} style={{ width: '50px', height: '28px', backgroundColor: gpsActivo ? '#10b981' : '#cbd5e1', borderRadius: '999px', position: 'relative', cursor: 'pointer', transition: '0.3s' }}>
          <div style={{ width: '22px', height: '22px', backgroundColor: 'white', borderRadius: '50%', position: 'absolute', top: '3px', left: gpsActivo ? '25px' : '3px', transition: 'left 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
        </div>
      </div>

      {/* LISTADO RESUMIDO */}
      <div style={{ padding: '20px' }}>
        <h2 style={{ fontSize: '12px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '16px' }}>
          Tus Tareas ({tickets.length})
        </h2>

        {cargando ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Cargando asignaciones...</div>
        ) : tickets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', backgroundColor: 'white', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
            <FiCheckCircle size={40} color="#10b981" style={{ marginBottom: '16px' }} />
            <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>Sin tareas pendientes</h3>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {tickets.map(ticket => (
              <div 
                key={ticket.id} 
                onClick={() => setTicketActivo(ticket)}
                style={{ backgroundColor: 'white', borderRadius: '16px', padding: '16px', borderLeft: ticket.estado === 'DESPACHADO' ? '4px solid #3b82f6' : '4px solid #f59e0b', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 900, color: '#0f172a' }}>{ticket.codigoTicket}</span>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: ticket.estado === 'DESPACHADO' ? '#2563eb' : '#d97706' }}>
                    {ticket.estado === 'DESPACHADO' ? 'MÓVIL EN RUTA' : 'CONFIRMAR'}
                  </span>
                </div>
                <h3 style={{ fontSize: '12px', fontWeight: 700, margin: '0 0 4px 0', color: '#475569' }}>{ticket.categoria?.nombre}</h3>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {ticket.descripcionUsuario}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}