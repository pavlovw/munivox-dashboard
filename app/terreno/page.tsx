"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { 
  FiNavigation, FiCheckCircle, FiXCircle, FiMapPin, FiClock, 
  FiPower, FiAlertTriangle, FiLogOut, FiTruck, FiChevronRight, FiArrowLeft 
} from 'react-icons/fi';

const API_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://nn4p1ybmu2.execute-api.us-east-2.amazonaws.com';

interface Ticket {
  id: string;
  codigoTicket: string;
  estado: string;
  latitud: number | null;
  longitud: number | null;
  direccion: string;
  descripcionUsuario: string;
  createdAt: string;
  categoria?: { nombre: string };
}

export default function TerrenoDashboard() {
  const { data: session } = useSession();
  
  const [tareas, setTareas] = useState<Ticket[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [ticketActivo, setTicketActivo] = useState<Ticket | null>(null);
  
  // Control de GPS del Funcionario
  const [gpsActivo, setGpsActivo] = useState<boolean>(false);
  const [ubicacionActual, setubicacionActual] = useState<{lat: number, lng: number} | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Estados para modal de rechazo
  const [mostrandoRechazo, setMostrandoRechazo] = useState<boolean>(false);
  const [appMapaElegida, setAppMapaElegida] = useState<string>('google');

  // Pestañas de historial
  const [pestana, setPestana] = useState<'PENDIENTES' | 'SEMANA' | 'HISTORIAL'>('PENDIENTES');

  // ID del operador logueado (puedes obtenerlo de la sesión o sincronización)
  const operadorId = (session?.user as any)?.id || session?.user?.email;

  // 1. CARGAR TAREAS DEL FUNCIONARIO
  const cargarTareas = async () => {
    if (!session?.user?.email) return;
    setCargando(true);
    try {
      const res = await fetch(`${API_URL}/tickets?operadorEmail=${session.user.email}`);
      if (res.ok) {
        const data = await res.json();
        setTareas(data);
      }
    } catch (error) {
      console.error('Error cargando tareas de terreno:', error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (session?.user) {
      cargarTareas();
    }
  }, [session]);

  // 2. GESTIÓN DEL GPS EN VIVO (Batería y rendimiento optimizados)
  useEffect(() => {
    if (gpsActivo) {
      if ('geolocation' in navigator) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          async (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            setubicacionActual({ lat, lng });

            // Enviar ubicación al backend para actualizar al C4
            try {
              await fetch(`${API_URL}/operadores/ubicacion`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: session?.user?.email, latitud: lat, longitud: lng, gpsActivo: true })
              });
            } catch (e) {
              console.error("Error sincronizando GPS:", e);
            }
          },
          (error) => console.error("Error de GPS:", error),
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
        );
      } else {
        alert("Tu dispositivo no soporta geolocalización.");
        setGpsActivo(false);
      }
    } else {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      // Notificar apagado de GPS al backend
      if (session?.user?.email) {
        fetch(`${API_URL}/operadores/ubicacion`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: session?.user?.email, gpsActivo: false })
        }).catch(() => {});
      }
    }

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [gpsActivo, session]);

  // 3. ACCIONES DE TAREA (Aceptar / Rechazar)
  const gestionarTicket = async (nuevoEstado: string, motivoRechazo?: string) => {
    if (!ticketActivo) return;

    try {
      const res = await fetch(`${API_URL}/tickets/${ticketActivo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nuevoEstado: nuevoEstado,
          operadorAsignadoId: nuevoEstado === 'DESPACHADO' ? operadorId : null, // Si rechaza, libera el operador
          comentario: motivoRechazo ? `Rechazado por funcionario: ${motivoRechazo}` : 'Aceptado y en camino'
        })
      });

      if (res.ok) {
        setTicketActivo(null);
        setMostrandoRechazo(false);
        cargarTareas();
      } else {
        alert("Error al actualizar la tarea.");
      }
    } catch (error) {
      console.error(error);
    }
  };

  // Abrir aplicación de mapa externa elegida
  const abrirNavegacion = (lat: number | null, lng: number | null) => {
    if (!lat || !lng) {
      alert("Este reporte no cuenta con coordenadas GPS válidas.");
      return;
    }

    let url = '';
    if (appMapaElegida === 'waze') {
      url = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
    } else if (appMapaElegida === 'google') {
      url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    } else {
      url = `https://maps.apple.com/?q=${lat},${lng}`;
    }

    window.open(url, '_blank');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#f1f5f9', fontFamily: 'system-ui, sans-serif', color: '#1e293b' }}>
      
      {/* HEADER MÓVIL OPTIMIZADO */}
      <header style={{ backgroundColor: '#1e293b', color: 'white', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ backgroundColor: '#3b82f6', padding: '8px', borderRadius: '10px' }}>
            <FiTruck size={20} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: '15px', fontWeight: 900, margin: 0 }}>MuniVox Terreno</h1>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>{session?.user?.name || 'Funcionario Móvil'}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            onClick={() => setGpsActivo(!gpsActivo)} 
            style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: gpsActivo ? '#10b981' : '#64748b', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
          >
            <FiPower size={14} /> {gpsActivo ? 'GPS ACTIVO' : 'GPS APAGADO'}
          </button>
          <button onClick={() => signOut({ callbackUrl: '/login' })} style={{ background: 'transparent', border: 'none', color: '#fca5a5', cursor: 'pointer' }}>
            <FiLogOut size={18} />
          </button>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL / VISTA DETALLE O LISTA */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '16px', maxWidth: '600px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        
        {ticketActivo ? (
          
          /* VISTA DE DETALLE DE TAREA ASIGNADA */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '30px' }}>
            <button 
              onClick={() => { setTicketActivo(null); setMostrandoRechazo(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', color: '#2563eb', fontWeight: 800, fontSize: '13px', cursor: 'pointer', padding: 0 }}
            >
              <FiArrowLeft size={16} /> Volver a mis tareas
            </button>

            <div style={{ backgroundColor: 'white', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
              
              {/* MINI MAPA SUPERIOR */}
              <div style={{ height: '180px', backgroundColor: '#e2e8f0', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '12px', fontWeight: 'bold' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><FiMapPin color="#ef4444" size={18} /> Coordenadas: {ticketActivo.latitud}, {ticketActivo.longitud}</span>
              </div>

              <div style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 900, color: '#0284c7' }}>{ticketActivo.codigoTicket}</span>
                  <span style={{ fontSize: '11px', fontWeight: 800, backgroundColor: '#fef3c7', color: '#d97706', padding: '4px 10px', borderRadius: '10px' }}>
                    {ticketActivo.estado}
                  </span>
                </div>

                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#1e293b', margin: '0 0 8px 0' }}>
                  {ticketActivo.categoria?.nombre || 'Incidente en vía pública'}
                </h3>
                
                <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5, margin: '0 0 16px 0' }}>
                  {ticketActivo.descripcionUsuario}
                </p>

                {/* BOTONES DE ACEPTAR / RECHAZAR */}
                {!mostrandoRechazo ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '20px' }}>
                    <button 
                      onClick={() => setMostrandoRechazo(true)}
                      style={{ padding: '14px', backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '14px', fontWeight: 900, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}
                    >
                      <FiXCircle size={16} /> RECHAZAR
                    </button>
                    <button 
                      onClick={() => gestionarTicket('DESPACHADO')}
                      style={{ padding: '14px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 900, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', boxShadow: '0 4px 10px rgba(16,185,129,0.3)' }}
                    >
                      <FiCheckCircle size={16} /> ACEPTAR
                    </button>
                  </div>
                ) : (
                  
                  /* OPCIONES DE RECHAZO */
                  <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '14px', border: '1px solid #cbd5e1', marginTop: '16px' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a', margin: '0 0 10px 0' }}>Seleccione el motivo del rechazo:</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <button 
                        onClick={() => gestionarTicket('PENDIENTE', 'Ocupado con otra tarea')}
                        style={{ padding: '12px', backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '12px', fontWeight: 700, textAlign: 'left', cursor: 'pointer' }}
                      >
                        1. Ocupado atendiendo otro procedimiento
                      </button>
                      <button 
                        onClick={() => gestionarTicket('PENDIENTE', 'Fuera de servicio / Colación')}
                        style={{ padding: '12px', backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '12px', fontWeight: 700, textAlign: 'left', cursor: 'pointer' }}
                      >
                        2. Fuera de servicio operativo
                      </button>
                      <button 
                        onClick={() => setMostrandoRechazo(false)}
                        style={{ padding: '8px', background: 'transparent', border: 'none', color: '#64748b', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* NAVEGADOR GPS (Se habilita si ya aceptó la tarea) */}
                {ticketActivo.estado === 'DESPACHADO' && (
                  <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
                    <label style={{ fontSize: '11px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>
                      Seleccionar Aplicación de Navegación:
                    </label>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                      {['google', 'waze', 'apple'].map((app) => (
                        <button
                          key={app}
                          onClick={() => setAppMapaElegida(app)}
                          style={{ flex: 1, padding: '8px', backgroundColor: appMapaElegida === app ? '#0284c7' : '#f1f5f9', color: appMapaElegida === app ? 'white' : '#475569', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer' }}
                        >
                          {app}
                        </button>
                      ))}
                    </div>

                    <button 
                      onClick={() => abrirNavegacion(ticketActivo.latitud, ticketActivo.longitud)}
                      style={{ width: '100%', padding: '16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 900, fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}
                    >
                      <FiNavigation size={18} /> ABRIR GPS PARA LLEGAR
                    </button>
                  </div>
                )}

              </div>
            </div>
          </div>
        ) : (
          
          /* VISTA DE LISTA DE TAREAS Y PESTAÑAS */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* PESTAÑAS */}
            <div style={{ display: 'flex', backgroundColor: '#e2e8f0', padding: '4px', borderRadius: '14px' }}>
              <button 
                onClick={() => setPestana('PENDIENTES')}
                style={{ flex: 1, padding: '10px', backgroundColor: pestana === 'PENDIENTES' ? 'white' : 'transparent', border: 'none', borderRadius: '10px', fontSize: '11px', fontWeight: 900, color: pestana === 'PENDIENTES' ? '#0f172a' : '#64748b', cursor: 'pointer', boxShadow: pestana === 'PENDIENTES' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}
              >
                ASIGNADAS
              </button>
              <button 
                onClick={() => setPestana('SEMANA')}
                style={{ flex: 1, padding: '10px', backgroundColor: pestana === 'SEMANA' ? 'white' : 'transparent', border: 'none', borderRadius: '10px', fontSize: '11px', fontWeight: 900, color: pestana === 'SEMANA' ? '#0f172a' : '#64748b', cursor: 'pointer', boxShadow: pestana === 'SEMANA' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}
              >
                ÚLTIMA SEMANA
              </button>
              <button 
                onClick={() => setPestana('HISTORIAL')}
                style={{ flex: 1, padding: '10px', backgroundColor: pestana === 'HISTORIAL' ? 'white' : 'transparent', border: 'none', borderRadius: '10px', fontSize: '11px', fontWeight: 900, color: pestana === 'HISTORIAL' ? '#0f172a' : '#64748b', cursor: 'pointer', boxShadow: pestana === 'HISTORIAL' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}
              >
                HISTORIAL
              </button>
            </div>

            {/* LISTADO */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {cargando ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontSize: '12px', fontWeight: 'bold' }}>
                  ACTUALIZANDO TAREAS...
                </div>
              ) : tareas.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                  <FiCheckCircle size={32} color="#10b981" style={{ marginBottom: '8px' }} />
                  <p style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b', margin: 0 }}>Sin tareas pendientes</p>
                  <p style={{ fontSize: '11px', color: '#64748b', margin: '4px 0 0 0' }}>Te avisaremos cuando el C4 te despache un procedimiento.</p>
                </div>
              ) : (
                tareas.map(t => (
                  <div 
                    key={t.id}
                    onClick={() => setTicketActivo(t)}
                    style={{ backgroundColor: 'white', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
                  >
                    <div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 900, color: '#0f172a' }}>{t.codigoTicket}</span>
                        <span style={{ fontSize: '9px', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', backgroundColor: t.estado === 'DESPACHADO' ? '#dbeafe' : '#fef3c7', color: t.estado === 'DESPACHADO' ? '#1d4ed8' : '#d97706' }}>
                          {t.estado}
                        </span>
                      </div>
                      <p style={{ fontSize: '12px', color: '#475569', margin: 0, fontWeight: 600 }}>{t.categoria?.nombre || 'Incidente'}</p>
                      <span style={{ fontSize: '10px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                        <FiClock size={10} /> {new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <FiChevronRight color="#94a3b8" size={20} />
                  </div>
                ))
              )}
            </div>

          </div>
        )}

      </main>
    </div>
  );
}