"use client";

import React, { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useSession, signOut } from 'next-auth/react';
import { 
  FiMap, FiTarget, FiUserCheck, FiArrowLeft, FiLogOut, 
  FiAlertCircle, FiClock, FiMapPin, FiTruck, FiCheckCircle 
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

  // Mapeo automático de departamento según el correo de la sesión
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

  const cargarDatos = async () => {
    if (infoDepartamento.id === 0) return;
    setCargando(true);
    try {
      // 1. Cargar tickets del departamento
      const resTickets = await fetch(`${API_URL}/tickets?departamentoId=${infoDepartamento.id}`);
      if (resTickets.ok) {
        const dataTickets = await resTickets.json();
        // Filtrar solo los que están listos para despacho o ya despachados
        setTickets(dataTickets.filter((t: Ticket) => t.estado !== 'RESUELTO' && t.estado !== 'DESCARTADO'));
      }

      // 2. Cargar funcionarios en terreno de este departamento (con GPS activo)
      // Este endpoint debes crearlo en la Lambda (GET /operadores?departamentoId=X&rol=TERRENO)
      const resFuncionarios = await fetch(`${API_URL}/operadores?departamentoId=${infoDepartamento.id}&rol=TERRENO&gpsActivo=true`);
      if (resFuncionarios.ok) {
        setFuncionarios(await resFuncionarios.json());
      }
    } catch (error) {
      console.error('Error sincronizando datos:', error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (session?.user) {
      cargarDatos();
    }
  }, [session, infoDepartamento.id]);

  const abrirTicket = (ticket: Ticket) => {
    setTicketSeleccionado(ticket);
    setModoDespacho(false); // Por defecto muestra el detalle, el usuario debe activar el modo despacho
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
          nuevoEstado: 'DESPACHADO',
          operadorAsignadoId: funcionarioId 
        })
      });

      if (res.ok) {
        await cargarDatos(); // Recargar todo para actualizar estados
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

  // Filtrado de mapa: Si hay un ticket seleccionado y modo despacho activo, ocultar los demás
  const ticketsEnMapa = (ticketSeleccionado && modoDespacho) 
    ? tickets.filter(t => t.id === ticketSeleccionado.id) 
    : tickets;

  // Calculadora de distancia simple (Haversine básico) para ordenar funcionarios por cercanía
  const calcularDistancia = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
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
        
        {/* HEADER DEPARTAMENTO */}
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
            <button 
              onClick={() => signOut({ callbackUrl: '/' })} 
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', cursor: 'pointer', padding: '8px', borderRadius: '8px', backdropFilter: 'blur(4px)' }} 
              title="Cerrar Sesión"
            >
              <FiLogOut size={16} />
            </button>
          </div>
          <div style={{ marginTop: '16px', display: 'flex', gap: '12px', fontSize: '12px', fontWeight: 600 }}>
            <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '999px' }}>
              {tickets.length} Casos Activos
            </div>
            <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '999px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', backgroundColor: '#4ade80', borderRadius: '50%' }}></span>
              {funcionarios.length} Móviles en línea
            </div>
          </div>
        </div>

        {/* ÁREA DE CONTENIDO (LISTA O DETALLE) */}
        <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#f8fafc' }}>
          
          {cargando ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ width: '24px', height: '24px', border: '3px solid #0284c7', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px auto' }}></div>
              <p style={{ fontSize: '12px', fontWeight: 700 }}>SINCRONIZANDO OPERACIONES...</p>
            </div>
          ) : !ticketSeleccionado ? (
            
            // VISTA 1: LISTA DE TICKETS
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
                      {ticket.operadorAsignadoId ? (
                        <span style={{ fontSize: '10px', fontWeight: 800, padding: '4px 8px', borderRadius: '8px', backgroundColor: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <FiTruck /> EN RUTA
                        </span>
                      ) : (
                        <span style={{ fontSize: '10px', fontWeight: 800, padding: '4px 8px', borderRadius: '8px', backgroundColor: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <FiAlertCircle /> ESPERANDO MÓVIL
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
            
            // VISTA 2: DETALLE DEL TICKET Y DESPACHO
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

                {/* CONTROLES DE DESPACHO */}
                <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                  
                  {!modoDespacho ? (
                    <button 
                      onClick={() => setModoDespacho(true)}
                      style={{ width: '100%', backgroundColor: infoDepartamento.color, color: 'white', padding: '16px', borderRadius: '12px', border: 'none', fontWeight: 900, fontSize: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'transform 0.1s' }}
                      onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
                      onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      <FiTarget size={18} /> INICIAR PROTOCOLO DE DESPACHO
                    </button>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ fontSize: '12px', fontWeight: 900, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <FiTruck color="#0284c7" /> UNIDADES EN TERRENO
                        </h3>
                        <span style={{ fontSize: '10px', backgroundColor: '#e0f2fe', color: '#0284c7', padding: '4px 8px', borderRadius: '8px', fontWeight: 800 }}>
                          GPS ACTIVO
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {funcionariosOrdenados.length === 0 ? (
                          <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                            <p style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, margin: 0 }}>No hay unidades de {infoDepartamento.nombre} transmitiendo ubicación en este momento.</p>
                          </div>
                        ) : (
                          funcionariosOrdenados.map((func) => {
                            const dist = ticketSeleccionado.latitud && func.latitud 
                              ? calcularDistancia(ticketSeleccionado.latitud, ticketSeleccionado.longitud!, func.latitud, func.longitud!).toFixed(1) 
                              : '?';
                            
                            const esAsignado = ticketSeleccionado.operadorAsignadoId === func.id;

                            return (
                              <div key={func.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', backgroundColor: esAsignado ? '#ecfdf5' : '#f8fafc', border: esAsignado ? '1px solid #10b981' : '1px solid #e2e8f0', borderRadius: '12px' }}>
                                <div>
                                  <span style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>{func.nombre}</span>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#64748b', marginTop: '4px', fontWeight: 600 }}>
                                    <FiClock size={10} /> a {dist} km del incidente
                                  </span>
                                </div>
                                <button 
                                  onClick={() => asignarFuncionario(func.id)}
                                  disabled={procesandoAsignacion || esAsignado}
                                  style={{ backgroundColor: esAsignado ? '#10b981' : '#0284c7', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '11px', fontWeight: 800, cursor: (procesandoAsignacion || esAsignado) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: procesandoAsignacion ? 0.7 : 1 }}
                                >
                                  {esAsignado ? (
                                    <><FiCheckCircle /> ASIGNADO</>
                                  ) : (
                                    <><FiUserCheck /> ASIGNAR</>
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
      {/* Al activar modo despacho, el mapa recibirá solo el ticket seleccionado para enfocar la vista, y los funcionarios como "fantasmas" o flota */}
      <div style={{ flex: 1, position: 'relative', backgroundColor: '#e2e8f0' }}>
        
        {/* Overlay indicador de modo despacho en el mapa */}
        {modoDespacho && (
          <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 30, backgroundColor: 'rgba(15, 23, 42, 0.9)', color: 'white', padding: '12px 24px', borderRadius: '999px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', backdropFilter: 'blur(4px)' }}>
            <div style={{ width: '10px', height: '10px', backgroundColor: '#ef4444', borderRadius: '50%', animation: 'pulse 1.5s infinite' }}></div>
            <span style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '1px' }}>MODO DESPACHO ACTIVO • LOCALIZANDO UNIDADES</span>
          </div>
        )}

        <MapComponent 
          tickets={ticketsEnMapa} 
          fantasmas={modoDespacho ? funcionarios : []} // Pasamos los funcionarios al mapa cuando estamos en modo despacho
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