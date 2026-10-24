"use client";

import React, { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useSession, signOut } from 'next-auth/react';
import { 
  FiMap, FiTarget, FiUserCheck, FiArrowLeft, FiLogOut, 
  FiAlertCircle, FiClock, FiMapPin, FiTruck, FiCheckCircle, FiBell, FiX 
} from 'react-icons/fi';

const MapComponent = dynamic(() => import('@/components/Map'), { 
  ssr: false,
  loading: () => (
    <div style={{ display: 'flex', height: '100%', width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', color: '#0284c7', fontSize: '12px', fontWeight: 'bold' }}>
      CARGANDO CARTOGRAFÍA...
    </div>
  )
});

const API_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://nn4p1ybmu2.execute-api.us-east-2.amazonaws.com';

interface HistorialItem {
  id: string;
  comentario: string;
  createdAt: string;
  estadoNuevo: string;
}

interface Ticket {
  id: string;
  codigoTicket: string;
  estado: string;
  latitud: number | null;
  longitud: number | null;
  descripcionUsuario: string;
  createdAt: string;
  categoria?: { nombre: string };
  prioridadIA: string;
  operadorAsignadoId?: string | null;
  historial?: HistorialItem[];
}

interface Funcionario {
  id: string;
  nombre: string;
  latitud: number | null;
  longitud: number | null;
  gpsActivo: boolean;
  ultimaUbicacion: string;
}

export default function DepartamentoDashboard() {
  const { data: session } = useSession();
  
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  
  const [ticketSeleccionado, setTicketSeleccionado] = useState<Ticket | null>(null);
  const [modoDespacho, setModoDespacho] = useState<boolean>(false);
  const [procesandoAsignacion, setProcesandoAsignacion] = useState<boolean>(false);
  
  // Estado para el panel de notificaciones
  const [mostrarNotificaciones, setMostrarNotificaciones] = useState<boolean>(false);

  const infoDepartamento = useMemo(() => {
    const email = session?.user?.email || '';
    const prefix = email.split('@')[0].toLowerCase();
    
    switch(prefix) {
      case 'aseo': return { id: 1, nombre: 'Aseo y Ornato', color: '#10b981' };
      case 'transito': return { id: 2, nombre: 'Dirección de Tránsito', color: '#f59e0b' };
      case 'seguridad': return { id: 3, nombre: 'Seguridad Pública', color: '#3b82f6' };
      case 'obras': return { id: 4, nombre: 'Obras Municipales', color: '#8b5cf6' };
      default: return { id: 0, nombre: 'Departamento', color: '#64748b' };
    }
  }, [session]);

    // 1. Modificar cargarDatos para aceptar un modo silencioso
  const cargarDatos = async (silencioso = false) => {
    if (infoDepartamento.id === 0) return;
    
    // Solo muestra la pantalla de carga la primera vez
    if (!silencioso) setCargando(true); 
    
    try {
      const resTickets = await fetch(`${API_URL}/tickets?departamentoId=${infoDepartamento.id}`);
      if (resTickets.ok) {
        const dataTickets = await resTickets.json();
        setTickets(dataTickets.filter((t: Ticket) => t.estado !== 'RESUELTO' && t.estado !== 'DESCARTADO'));
      }

      const resFuncionarios = await fetch(`${API_URL}/operadores?departamentoId=${infoDepartamento.id}&rol=TERRENO`);
      if (resFuncionarios.ok) {
        const dataFuncionarios = await resFuncionarios.json();
        
        // Filtrar duplicados por ID para evitar que salgan repetidos por errores previos en la DB
        const funcionariosUnicos = Array.from(new Map(dataFuncionarios.map((f: any) => [f.id, f])).values());
        setFuncionarios(funcionariosUnicos as Funcionario[]);
      }
    } catch (error) {
      console.error('Error sincronizando datos:', error);
    } finally {
      if (!silencioso) setCargando(false);
    }
  };

  // 2. Actualizar el useEffect para usar el modo silencioso en el intervalo
  useEffect(() => {
    if (session?.user) {
      cargarDatos(); // Carga inicial con animación
      // Actualización en segundo plano cada 15s (sin interrumpir la interfaz)
      const interval = setInterval(() => cargarDatos(true), 15000);
      return () => clearInterval(interval);
    }
  }, [session, infoDepartamento.id]);

  // Extraer notificaciones de rechazo desde el historial de los tickets
  const notificacionesRechazo = useMemo(() => {
    const alertas: { id: string; ticketCodigo: string; mensaje: string; fecha: string }[] = [];
    tickets.forEach(ticket => {
      ticket.historial?.forEach(h => {
        if (h.comentario && h.comentario.includes('Rechazado por funcionario')) {
          alertas.push({
            id: h.id,
            ticketCodigo: ticket.codigoTicket,
            mensaje: h.comentario,
            fecha: h.createdAt
          });
        }
      });
    });
    return alertas.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [tickets]);

  const abrirTicket = (ticket: Ticket) => {
    setTicketSeleccionado(ticket);
    setModoDespacho(false);
  };

  const cerrarTicket = () => {
    setTicketSeleccionado(null);
    setModoDespacho(false);
  };

  const asignarFuncionario = async (funcionarioId: string) => {
    if (!ticketSeleccionado) return;
    setProcesandoAsignacion(true);

    try {
      const res = await fetch(`${API_URL}/tickets/${ticketSeleccionado.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          nuevoEstado: 'EN_REVISION',
          operadorAsignadoId: funcionarioId 
        })
      });

      if (res.ok) {
        await cargarDatos();
        cerrarTicket();
      } else {
        alert("Error al asignar el funcionario.");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setProcesandoAsignacion(false);
    }
  };

  const ticketsEnMapa = (ticketSeleccionado && modoDespacho) 
    ? tickets.filter(t => t.id === ticketSeleccionado.id) 
    : tickets;

  const calcularDistancia = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const funcionariosOrdenados = useMemo(() => {
    if (!ticketSeleccionado || !ticketSeleccionado.latitud || !ticketSeleccionado.longitud) return funcionarios;
    return [...funcionarios].sort((a, b) => {
      if (!a.latitud || !b.latitud) return 0;
      const distA = calcularDistancia(ticketSeleccionado.latitud!, ticketSeleccionado.longitud!, a.latitud, a.longitud!);
      const distB = calcularDistancia(ticketSeleccionado.latitud!, ticketSeleccionado.longitud!, b.latitud, b.longitud!);
      return distA - distB;
    });
  }, [funcionarios, ticketSeleccionado]);

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#f8fafc', overflow: 'hidden', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* PANEL LATERAL DEL DEPARTAMENTO */}
      <div style={{ width: '420px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', zIndex: 20, boxShadow: '4px 0 15px rgba(0,0,0,0.05)' }}>
        
        <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', backgroundColor: infoDepartamento.color, color: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.9 }}>
                Centro de Despacho
              </span>
              <h1 style={{ fontSize: '20px', fontWeight: 900, margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiTarget /> {infoDepartamento.nombre}
              </h1>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {/* BOTÓN DE NOTIFICACIONES */}
              <button 
                onClick={() => setMostrarNotificaciones(!mostrarNotificaciones)}
                style={{ position: 'relative', background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', cursor: 'pointer', padding: '8px', borderRadius: '8px', backdropFilter: 'blur(4px)' }}
                title="Notificaciones de rechazo"
              >
                <FiBell size={16} />
                {notificacionesRechazo.length > 0 && (
                  <span style={{ position: 'absolute', top: -4, right: -4, backgroundColor: '#ef4444', color: 'white', fontSize: '9px', fontWeight: 900, width: '16px', height: '16px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {notificacionesRechazo.length}
                  </span>
                )}
              </button>

              <button 
                onClick={() => signOut({ callbackUrl: '/' })} 
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', cursor: 'pointer', padding: '8px', borderRadius: '8px', backdropFilter: 'blur(4px)' }} 
                title="Cerrar Sesión"
              >
                <FiLogOut size={16} />
              </button>
            </div>
          </div>

          <div style={{ marginTop: '16px', display: 'flex', gap: '12px', fontSize: '12px', fontWeight: 600 }}>
            <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '999px' }}>
              {tickets.length} Casos Activos
            </div>
            <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '999px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', backgroundColor: '#4ade80', borderRadius: '50%' }}></span>
              {funcionarios.length} Funcionarios Totales
            </div>
          </div>
        </div>

        {/* PANEL DESPLEGABLE DE NOTIFICACIONES */}
        {mostrarNotificaciones && (
          <div style={{ backgroundColor: '#1e293b', color: 'white', padding: '16px', borderBottom: '1px solid #334155', maxHeight: '220px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', color: '#cbd5e1' }}>Alertas de Rechazo Operativo</span>
              <button onClick={() => setMostrarNotificaciones(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><FiX size={16} /></button>
            </div>
            {notificacionesRechazo.length === 0 ? (
              <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>No hay rechazos recientes de unidades.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {notificacionesRechazo.map((notif) => (
                  <div key={notif.id} style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '10px', borderRadius: '8px', fontSize: '11px' }}>
                    <div style={{ fontWeight: 900, color: '#fca5a5', marginBottom: '2px' }}>Ticket: {notif.ticketCodigo}</div>
                    <div style={{ color: '#f1f5f9' }}>{notif.mensaje}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#f8fafc' }}>
          {cargando ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ width: '24px', height: '24px', border: '3px solid #0284c7', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px auto' }}></div>
              <p style={{ fontSize: '12px', fontWeight: 700 }}>SINCRONIZANDO OPERACIONES...</p>
            </div>
          ) : !ticketSeleccionado ? (
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {tickets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                  <FiCheckCircle size={32} style={{ marginBottom: '12px' }} />
                  <h3 style={{ fontSize: '14px', margin: 0 }}>Bandeja al día</h3>
                  <p style={{ fontSize: '12px', margin: '4px 0 0 0' }}>No hay incidentes pendientes de despacho.</p>
                </div>
              ) : (
                tickets.map(ticket => (
                  <div 
                    key={ticket.id} 
                    onClick={() => abrirTicket(ticket)}
                    style={{ padding: '16px', backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', borderLeft: ticket.operadorAsignadoId ? '4px solid #10b981' : '4px solid #f59e0b' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a' }}>{ticket.codigoTicket}</span>
                      {/* LÓGICA DE ESTADOS EN EL LISTADO DEL DEPARTAMENTO */}
                      {ticket.operadorAsignadoId ? (
                        ticket.estado === 'DESPACHADO' ? (
                        <span style={{ fontSize: '10px', fontWeight: 800, padding: '4px 8px', borderRadius: '8px', backgroundColor: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <FiTruck /> MÓVIL EN RUTA
                        </span>
                      ) : (
                        <span style={{ fontSize: '10px', fontWeight: 800, padding: '4px 8px', borderRadius: '8px', backgroundColor: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <FiClock /> ESPERANDO CONFIRMACIÓN
                        </span>
                        )
                      ) : (
                        <span style={{ fontSize: '10px', fontWeight: 800, padding: '4px 8px', borderRadius: '8px', backgroundColor: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <FiAlertCircle /> PENDIENTE ASIGNAR
                        </span>
                       )}
                    </div>
                    <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#475569', margin: '0 0 6px 0' }}>
                      {ticket.categoria?.nombre || 'Clasificación Pendiente'}
                    </h3>
                    <p style={{ fontSize: '11px', color: '#64748b', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {ticket.descripcionUsuario}
                    </p>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ padding: '16px 20px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
                <button 
                  onClick={cerrarTicket} 
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', color: '#475569', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', padding: 0 }}
                >
                  <FiArrowLeft size={16} /> Volver a bandeja
                </button>
              </div>

              <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
                <div style={{ marginBottom: '24px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Detalle de Incidente</span>
                  <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', margin: '4px 0 12px 0' }}>{ticketSeleccionado.codigoTicket}</h2>
                  
                  <div style={{ backgroundColor: '#f1f5f9', padding: '12px', borderRadius: '12px', fontSize: '12px', color: '#334155', lineHeight: 1.5, marginBottom: '16px' }}>
                    <FiMapPin style={{ color: '#0284c7', marginRight: '6px' }} /> 
                    Coordenadas: {ticketSeleccionado.latitud?.toFixed(5)}, {ticketSeleccionado.longitud?.toFixed(5)}
                  </div>
                  
                  <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6, margin: 0 }}>
                    {ticketSeleccionado.descripcionUsuario}
                  </p>
                </div>

                <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                  {!modoDespacho ? (
                    <button 
                      onClick={() => setModoDespacho(true)}
                      style={{ width: '100%', backgroundColor: infoDepartamento.color, color: 'white', padding: '16px', borderRadius: '12px', border: 'none', fontWeight: 900, fontSize: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                    >
                      <FiTarget size={18} /> INICIAR PROTOCOLO DE DESPACHO
                    </button>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ fontSize: '12px', fontWeight: 900, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <FiTruck color="#0284c7" /> PERSONAL DISPONIBLE
                        </h3>
                        <span style={{ fontSize: '10px', backgroundColor: '#e0f2fe', color: '#0284c7', padding: '4px 8px', borderRadius: '8px', fontWeight: 800 }}>
                          LISTA GENERAL
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {funcionariosOrdenados.length === 0 ? (
                          <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                            <p style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, margin: 0 }}>No hay funcionarios registrados en {infoDepartamento.nombre}.</p>
                          </div>
                        ) : (
                          funcionariosOrdenados.map((func) => {
                            const dist = ticketSeleccionado.latitud && func.latitud 
                              ? calcularDistancia(ticketSeleccionado.latitud, ticketSeleccionado.longitud!, func.latitud, func.longitud!).toFixed(1) 
                              : '?';
                            
                            const esAsignado = ticketSeleccionado.operadorAsignadoId === func.id;

                            // Verificar si este funcionario rechazó este ticket en el historial
                            const rechazoHistorial = ticketSeleccionado.historial?.find(h => 
                              h.comentario?.includes('Rechazado por funcionario') && h.comentario.includes(func.nombre)
                            );

                            return (
                              <div key={func.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', backgroundColor: esAsignado ? '#ecfdf5' : '#f8fafc', border: esAsignado ? '1px solid #10b981' : '1px solid #e2e8f0', borderRadius: '12px' }}>
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>{func.nombre}</span>
                                    <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', backgroundColor: func.gpsActivo ? '#dcfce7' : '#f1f5f9', color: func.gpsActivo ? '#166534' : '#64748b', fontWeight: 800 }}>
                                      {func.gpsActivo ? 'GPS ON' : 'GPS OFF'}
                                    </span>
                                  </div>

                                  {/* ETIQUETA SI RECHAZÓ ESTE TICKET */}
                                  {rechazoHistorial ? (
                                    <span style={{ display: 'block', fontSize: '10px', color: '#dc2626', fontWeight: 800, marginTop: '2px' }}>
                                      ⚠️ Rechazado: {rechazoHistorial.comentario.split(':')[1] || 'Motivo no especificado'}
                                    </span>
                                  ) : (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#64748b', marginTop: '4px', fontWeight: 600 }}>
                                      <FiClock size={10} /> a {dist} km aprox.
                                    </span>
                                  )}
                                </div>

                                <button 
                                  onClick={() => asignarFuncionario(func.id)}
                                  disabled={procesandoAsignacion || esAsignado}
                                  style={{ backgroundColor: esAsignado ? '#10b981' : '#0284c7', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '11px', fontWeight: 800, cursor: (procesandoAsignacion || esAsignado) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: procesandoAsignacion ? 0.7 : 1 }}
                                >
                                  {esAsignado ? (
                                    <><FiCheckCircle /> ASIGNADO</>
                                  ) : (
                                    <><FiUserCheck /> {rechazoHistorial ? 'REASIGNAR' : 'ASIGNAR'}</>
                                  )}
                                </button>
                              </div>
                            )
                          })
                        )}
                      </div>
                      
                      <button 
                        onClick={() => setModoDespacho(false)}
                        style={{ width: '100%', marginTop: '16px', padding: '12px', background: 'transparent', border: '1px solid #cbd5e1', borderRadius: '12px', color: '#64748b', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Cancelar Despacho
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MAPA */}
      <div style={{ flex: 1, position: 'relative', backgroundColor: '#e2e8f0' }}>
        {modoDespacho && (
          <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 30, backgroundColor: 'rgba(15, 23, 42, 0.9)', color: 'white', padding: '12px 24px', borderRadius: '999px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', backdropFilter: 'blur(4px)' }}>
            <div style={{ width: '10px', height: '10px', backgroundColor: '#ef4444', borderRadius: '50%', animation: 'pulse 1.5s infinite' }}></div>
            <span style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '1px' }}>MODO DESPACHO ACTIVO • RASTREANDO UNIDADES</span>
          </div>
        )}

        <MapComponent 
          tickets={ticketsEnMapa} 
          fantasmas={modoDespacho ? funcionarios : []} // Solo muestra los móviles al iniciar despacho
          coordenadaSeleccionada={ticketSeleccionado && modoDespacho ? [ticketSeleccionado.latitud!, ticketSeleccionado.longitud!] : null} 
          onTicketSelect={(id) => {
            const t = tickets.find(x => x.id === id);
            if(t && !modoDespacho) abrirTicket(t);
          }} 
        />
      </div>
      
    </div>
  );
}