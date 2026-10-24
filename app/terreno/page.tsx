"use client";

import React, { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { FiLogOut, FiMapPin, FiCheckCircle, FiXCircle, FiNavigation, FiInfo, FiTruck } from 'react-icons/fi';

const API_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://nn4p1ybmu2.execute-api.us-east-2.amazonaws.com';

interface Ticket {
  id: string;
  codigoTicket: string;
  estado: string;
  latitud: number;
  longitud: number;
  descripcionUsuario: string;
  categoria?: { nombre: string };
  direccion?: string;
}

export default function TerrenoDashboard() {
  const { data: session } = useSession();
  
  const [gpsActivo, setGpsActivo] = useState<boolean>(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  
  const [textoConfirmacion, setTextoConfirmacion] = useState('');
  const [procesando, setProcesando] = useState<boolean>(false);

  const emailUsuario = session?.user?.email || '';

  // 1. PERSISTENCIA DE GPS: Recuperar estado guardado al iniciar
  useEffect(() => {
    const gpsGuardado = localStorage.getItem('munivox_gps_activo');
    if (gpsGuardado === 'true') {
      setGpsActivo(true);
    }
  }, []);

  // 2. CICLO DE GPS: Envía la posición inteligentemente solo si se mueven
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
              body: JSON.stringify({ 
                email: emailUsuario, 
                latitud: position.coords.latitude, 
                longitud: position.coords.longitude, 
                gpsActivo: true 
              })
            });
          } catch (e) {
            console.error("Error transmitiendo GPS", e);
          }
        },
        (error) => {
          console.warn("GPS pausado o sin señal:", error.message);
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      );
    } else {
      localStorage.setItem('munivox_gps_activo', 'false');
      // Avisar al servidor que se apagó el GPS
      if (emailUsuario) {
        fetch(`${API_URL}/operadores/ubicacion`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailUsuario, gpsActivo: false })
        }).catch(console.error);
      }
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [gpsActivo, emailUsuario]);

  // 3. CARGA DE TAREAS ASIGNADAS AL FUNCIONARIO
  const cargarTareas = async (silencioso = false) => {
    if (!emailUsuario) return;
    if (!silencioso) setCargando(true);
    
    try {
      const res = await fetch(`${API_URL}/tickets?operadorEmail=${emailUsuario}`);
      if (res.ok) {
        const data = await res.json();
        // Filtramos solo las que están en curso (descartamos resueltas)
        setTickets(data.filter((t: Ticket) => t.estado !== 'RESUELTO' && t.estado !== 'DESCARTADO'));
      }
    } catch (error) {
      console.error('Error al cargar tareas:', error);
    } finally {
      if (!silencioso) setCargando(false);
    }
  };

  useEffect(() => {
    cargarTareas();
    const interval = setInterval(() => cargarTareas(true), 15000); // Autorefresco silencioso
    return () => clearInterval(interval);
  }, [emailUsuario]);

  // 4. LÓGICA DE ACEPTAR / RECHAZAR / RESOLVER TAREAS
  const aceptarTarea = async (id: string) => {
    setProcesando(true);
    try {
      const res = await fetch(`${API_URL}/tickets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nuevoEstado: 'DESPACHADO', comentario: 'Unidad móvil aceptó la tarea y va en camino.' })
      });
      if (res.ok) await cargarTareas();
      else alert("Error al aceptar la tarea. Revisa tu conexión.");
    } catch (e) {
      console.error(e);
    } finally {
      setProcesando(false);
    }
  };

  const rechazarTarea = async (id: string) => {
    const motivo = prompt("Indique brevemente el motivo del rechazo (ej: En colación, falla mecánica):");
    if (!motivo) return; // Si cancela, no hace nada

    setProcesando(true);
    try {
      const res = await fetch(`${API_URL}/tickets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          operadorAsignadoId: null, // Desasignamos al operador
          nuevoEstado: 'EN_REVISION', // Vuelve a la bandeja del departamento
          comentario: `Rechazado por funcionario. Motivo: ${motivo}`
        })
      });
      if (res.ok) await cargarTareas();
    } catch (e) {
      console.error(e);
    } finally {
      setProcesando(false);
    }
  };

  const resolverTarea = async (id: string) => {
    if (textoConfirmacion !== 'confirmar') {
      alert('Debes escribir "confirmar" en minúsculas para finalizar el caso.');
      return;
    }
    
    setProcesando(true);
    try {
      const res = await fetch(`${API_URL}/tickets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nuevoEstado: 'RESUELTO', comentario: 'El funcionario en terreno ha resuelto el problema exitosamente.' })
      });
      
      if (res.ok) {
        setTextoConfirmacion('');
        await cargarTareas();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setProcesando(false);
    }
  };

  const abrirNavegador = (lat: number, lng: number, tipo: 'maps' | 'waze') => {
    if (tipo === 'maps') window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
    if (tipo === 'waze') window.open(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`, '_blank');
  };

  return (
    <div style={{ backgroundColor: '#f1f5f9', minHeight: '100vh', paddingBottom: '40px', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* HEADER MÓVIL */}
      <div style={{ backgroundColor: '#0f172a', color: 'white', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 900, margin: 0 }}>Móvil Terreno</h1>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 0 0' }}>{session?.user?.name || emailUsuario}</p>
        </div>
        <button onClick={() => signOut({ callbackUrl: '/' })} style={{ background: 'transparent', border: 'none', color: '#ef4444', padding: '8px' }}>
          <FiLogOut size={20} />
        </button>
      </div>

      {/* CONTROL DE GPS */}
      <div style={{ backgroundColor: 'white', padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ display: 'block', fontSize: '14px', fontWeight: 800, color: '#1e293b' }}>Señal GPS y Rastreo</span>
          <span style={{ fontSize: '11px', color: gpsActivo ? '#10b981' : '#64748b', fontWeight: 600 }}>
            {gpsActivo ? '🟢 Transmitiendo a Central C4' : '⚪ Apagado (Modo Privado)'}
          </span>
        </div>
        
        {/* Toggle Switch */}
        <div 
          onClick={() => setGpsActivo(!gpsActivo)}
          style={{ width: '50px', height: '28px', backgroundColor: gpsActivo ? '#10b981' : '#cbd5e1', borderRadius: '999px', position: 'relative', cursor: 'pointer', transition: 'background-color 0.3s' }}
        >
          <div style={{ width: '22px', height: '22px', backgroundColor: 'white', borderRadius: '50%', position: 'absolute', top: '3px', left: gpsActivo ? '25px' : '3px', transition: 'left 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
        </div>
      </div>

      {/* LISTA DE TAREAS */}
      <div style={{ padding: '20px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', marginBottom: '12px' }}>
          Tus Tareas ({tickets.length})
        </h2>

        {cargando ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Actualizando operaciones...</div>
        ) : tickets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: 'white', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
            <FiCheckCircle size={40} color="#10b981" style={{ marginBottom: '16px' }} />
            <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>Sin tareas pendientes</h3>
            <p style={{ fontSize: '13px', color: '#64748b' }}>Puedes descansar o mantener patrullaje preventivo.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {tickets.map(ticket => {
              
              const esperandoConfirmacion = ticket.estado === 'EN_REVISION';
              const tareaActiva = ticket.estado === 'DESPACHADO';

              return (
                <div key={ticket.id} style={{ backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden', border: `1px solid ${esperandoConfirmacion ? '#f59e0b' : '#3b82f6'}`, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                  
                  {/* Etiqueta de Estado */}
                  <div style={{ backgroundColor: esperandoConfirmacion ? '#fffbeb' : '#eff6ff', padding: '10px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a' }}>{ticket.codigoTicket}</span>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: esperandoConfirmacion ? '#d97706' : '#2563eb' }}>
                      {esperandoConfirmacion ? '🚨 NUEVA ASIGNACIÓN' : '🚙 EN CAMINO'}
                    </span>
                  </div>

                  <div style={{ padding: '16px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 8px 0', color: '#1e293b' }}>
                      {ticket.categoria?.nombre || 'Solicitud'}
                    </h3>
                    <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                      {ticket.descripcionUsuario}
                    </p>

                    {/* BOTONES DE NAVEGACIÓN DIRECTA */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                      <button onClick={() => abrirNavegador(ticket.latitud, ticket.longitud, 'waze')} style={{ flex: 1, padding: '10px', backgroundColor: '#e0f2fe', color: '#0284c7', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 800, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
                        <FiNavigation /> WAZE
                      </button>
                      <button onClick={() => abrirNavegador(ticket.latitud, ticket.longitud, 'maps')} style={{ flex: 1, padding: '10px', backgroundColor: '#f1f5f9', color: '#334155', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 800, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
                        <FiMapPin /> MAPS
                      </button>
                    </div>

                    {/* ACCIONES SEGÚN ESTADO */}
                    {esperandoConfirmacion && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => rechazarTarea(ticket.id)} disabled={procesando} style={{ flex: 1, padding: '12px', backgroundColor: 'white', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '12px', fontSize: '13px', fontWeight: 800, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
                          <FiXCircle /> RECHAZAR
                        </button>
                        <button onClick={() => aceptarTarea(ticket.id)} disabled={procesando} style={{ flex: 2, padding: '12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '12px', fontSize: '13px', fontWeight: 800, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
                          <FiTruck /> ACEPTAR E IR
                        </button>
                      </div>
                    )}

                    {tareaActiva && (
                      <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#64748b', marginBottom: '8px' }}>
                          ESCRIBE "confirmar" PARA FINALIZAR
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input 
                            type="text" 
                            placeholder="confirmar" 
                            value={textoConfirmacion}
                            onChange={(e) => setTextoConfirmacion(e.target.value)}
                            style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px' }}
                          />
                          <button 
                            onClick={() => resolverTarea(ticket.id)}
                            disabled={textoConfirmacion !== 'confirmar' || procesando}
                            style={{ padding: '12px 20px', backgroundColor: textoConfirmacion === 'confirmar' ? '#10b981' : '#cbd5e1', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 800, transition: 'background 0.3s' }}
                          >
                            LISTO
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}