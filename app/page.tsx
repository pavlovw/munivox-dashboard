"use client";

import dynamic from 'next/dynamic';
import { useEffect, useState, useMemo } from 'react';
import { io } from 'socket.io-client';
import { useSession, signOut } from 'next-auth/react';
import { 
  FiMap, FiGrid, FiActivity, FiSearch, FiShield, 
  FiClock, FiPhone, FiAlertTriangle, FiArrowLeft, FiRadio, FiCpu,
  FiSettings, FiLogOut
} from 'react-icons/fi';

import Kanban from '../components/Kanban';
import Estadisticas from '../components/Estadisticas';
import AdminPanel from '../components/AdminPanel';

const MapComponent = dynamic(() => import('../components/Map'), { 
  ssr: false,
  loading: () => (
    <div style={{ display: 'flex', height: '100%', width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', color: '#0284c7', fontSize: '12px', fontWeight: 'bold' }}>
      CARGANDO CARTOGRAFÍA...
    </div>
  )
});

interface Ticket {
  id: string;
  codigoTicket: string;
  estado: string;
  analisisIA: string;
  prioridadIA: string;
  latitud: number | null;
  longitud: number | null;
  descripcionUsuario: string;
  createdAt: string;
  ciudadano: { telefono: string };
  evidencias?: any[];
  historial?: any[];
}

export default function Dashboard() {
  const { data: session } = useSession(); 
  
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [cargando, setCargando] = useState(true);
  
  type Vista = 'MAPA' | 'KANBAN' | 'ESTADISTICA' | 'ADMINISTRACION';
  const [vistaActiva, setVistaActiva] = useState<Vista>('MAPA');
  
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("TODOS");
  const [filtroPrioridad, setFiltroPrioridad] = useState("TODAS");

  const [ticketSeleccionado, setTicketSeleccionado] = useState<Ticket | null>(null);
  const [ticketsCercanos, setTicketsCercanos] = useState<any[]>([]);
  const [coordenadaEnfoque, setCoordenadaEnfoque] = useState<[number, number] | null>(null);

  const fetchTickets = async () => {
    try {
      const res = await fetch('/api/tickets');
      if (res.ok) setTickets(await res.json());
    } catch (error) { 
      console.error(error); 
    } finally { 
      setCargando(false); 
    }
  };

  useEffect(() => {
    fetchTickets();
    const socket = io("https://socket-service.politeplant-263a4d5b.eastus.azurecontainerapps.io", { transports: ['websocket', 'polling'] });
    socket.on('actualizar_dashboard', () => fetchTickets());
    return () => { socket.disconnect(); };
  }, []);

  const ticketsFiltrados = useMemo(() => {
    return tickets.filter(t => {
      const matchTexto = t.codigoTicket.toLowerCase().includes(filtroTexto.toLowerCase()) || 
                         (t.ciudadano?.telefono || '').includes(filtroTexto);
      const matchEstado = filtroEstado === "TODOS" || t.estado === filtroEstado;
      const matchPrioridad = filtroPrioridad === "TODAS" || t.prioridadIA === filtroPrioridad;
      return matchTexto && matchEstado && matchPrioridad;
    });
  }, [tickets, filtroTexto, filtroEstado, filtroPrioridad]);

  const abrirDetalle = async (id: string, lat: number | null, lng: number | null) => {
    try {
      const res = await fetch(`/api/tickets/${id}`);
      if (res.ok) {
        const detalle = await res.json();
        setTicketSeleccionado(detalle);
        
        if (lat && lng) {
          setCoordenadaEnfoque([lat, lng]);
          const resCercanos = await fetch(`/api/tickets/cercanos?lat=${lat}&lng=${lng}`);
          if (resCercanos.ok) setTicketsCercanos(await resCercanos.json());
        } else {
          setCoordenadaEnfoque(null);
          setTicketsCercanos([]);
        }
      }
    } catch (error) { console.error(error); }
  };

  const cerrarDetalle = () => {
    setTicketSeleccionado(null);
    setTicketsCercanos([]);
    setCoordenadaEnfoque(null);
  };

  const cambiarEstado = async (ticketId: string, nuevoEstado: string) => {
    try {
      await fetch(`https://socket-service.politeplant-263a4d5b.eastus.azurecontainerapps.io/api/tickets/${ticketId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nuevoEstado })
      });
      if (ticketSeleccionado && ticketSeleccionado.id === ticketId) cerrarDetalle();
    } catch (error) { console.error(error); }
  };

  const obtenerEstiloPrioridad = (prioridad: string) => {
    if (prioridad === 'ALTA' || prioridad === 'CRITICA') return { backgroundColor: '#fff1f2', color: '#e11d48', borderColor: '#fecdd3' };
    if (prioridad === 'MEDIA') return { backgroundColor: '#fffbeb', color: '#d97706', borderColor: '#fde68a' };
    return { backgroundColor: '#f1f5f9', color: '#475569', borderColor: '#e2e8f0' };
  };

  const obtenerEstiloEstado = (estado: string) => {
    switch (estado) {
      case 'PENDIENTE': return { backgroundColor: '#fff1f2', color: '#e11d48', borderColor: '#fecdd3' };
      case 'EN_REVISION': return { backgroundColor: '#f0f9ff', color: '#0284c7', borderColor: '#bae6fd' };
      case 'DESPACHADO': return { backgroundColor: '#eef2ff', color: '#4f46e5', borderColor: '#c7d2fe' };
      case 'RESUELTO': return { backgroundColor: '#ecfdf5', color: '#059669', borderColor: '#a7f3d0' };
      default: return { backgroundColor: '#f1f5f9', color: '#475569', borderColor: '#e2e8f0' };
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#F4F7FE', fontFamily: 'system-ui, sans-serif', color: '#334155', overflow: 'hidden' }}>
      
      {/* BARRA LATERAL */}
      <aside style={{ width: '260px', background: 'linear-gradient(to bottom, #2563EB, #1D4ED8)', color: 'white', display: 'flex', flexDirection: 'column', boxShadow: '4px 0 15px rgba(0,0,0,0.05)', zIndex: 20 }}>
        <div style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '10px', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '12px', backdropFilter: 'blur(4px)' }}>
            <FiShield size={22} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 900, letterSpacing: '1px', margin: 0 }}>MUNIVOX</h1>
            <span style={{ fontSize: '9px', color: '#bae6fd', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase' }}>C4 • MONITOREO</span>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
          <div 
            onClick={() => setVistaActiva('MAPA')}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', color: vistaActiva === 'MAPA' ? 'white' : '#e0f2fe', backgroundColor: vistaActiva === 'MAPA' ? 'rgba(255,255,255,0.2)' : 'transparent', fontSize: '12px', fontWeight: vistaActiva === 'MAPA' ? 'bold' : 500, borderRadius: '16px', backdropFilter: vistaActiva === 'MAPA' ? 'blur(4px)' : 'none', cursor: 'pointer' }}>
            <FiMap size={16} /> Visor Territorial
          </div>
          <div 
            onClick={() => setVistaActiva('KANBAN')}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', color: vistaActiva === 'KANBAN' ? 'white' : '#e0f2fe', backgroundColor: vistaActiva === 'KANBAN' ? 'rgba(255,255,255,0.2)' : 'transparent', fontSize: '12px', fontWeight: vistaActiva === 'KANBAN' ? 'bold' : 500, borderRadius: '16px', backdropFilter: vistaActiva === 'KANBAN' ? 'blur(4px)' : 'none', cursor: 'pointer' }}>
            <FiGrid size={16} /> Tablero Kanban
          </div>
          <div 
            onClick={() => setVistaActiva('ESTADISTICA')}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', color: vistaActiva === 'ESTADISTICA' ? 'white' : '#e0f2fe', backgroundColor: vistaActiva === 'ESTADISTICA' ? 'rgba(255,255,255,0.2)' : 'transparent', fontSize: '12px', fontWeight: vistaActiva === 'ESTADISTICA' ? 'bold' : 500, borderRadius: '16px', backdropFilter: vistaActiva === 'ESTADISTICA' ? 'blur(4px)' : 'none', cursor: 'pointer' }}>
            <FiActivity size={16} /> Estadística
          </div>

          {/* MENÚ ADMINISTRATIVO (Solo visible para Jefaturas) */}
          {(session?.user as any)?.role === 'ADMINISTRADOR' && (
            <div 
              onClick={() => setVistaActiva('ADMINISTRACION')}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', marginTop: '16px', color: vistaActiva === 'ADMINISTRACION' ? 'white' : '#cbd5e1', backgroundColor: vistaActiva === 'ADMINISTRACION' ? 'rgba(255,255,255,0.2)' : 'transparent', fontSize: '12px', fontWeight: vistaActiva === 'ADMINISTRACION' ? 'bold' : 500, borderRadius: '16px', cursor: 'pointer', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <FiSettings size={16} /> Panel Administrativo
            </div>
          )}
        </nav>

        {/* INFO DEL OPERADOR Y BOTÓN CERRAR SESIÓN */}
        <div style={{ margin: '16px', padding: '16px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '16px', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ display: 'block', fontSize: '9px', color: '#bae6fd', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '1px' }}>{(session?.user as any)?.role || 'Operador'} Activo</span>
            <span style={{ display: 'block', fontSize: '12px', color: 'white', fontWeight: 'bold', marginTop: '4px' }}>{session?.user?.name || 'Usuario'}</span>
          </div>
          <button 
            onClick={() => signOut()} 
            style={{ background: 'transparent', border: 'none', color: '#fca5a5', cursor: 'pointer', padding: '4px' }} 
            title="Cerrar Sesión"
          >
            <FiLogOut size={18} />
          </button>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        
        {/* CABECERA SUPERIOR */}
        <header style={{ backgroundColor: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #e2e8f0', padding: '16px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10, height: '70px', boxSizing: 'border-box' }}>
          <div>
            <h2 style={{ fontSize: '12px', fontWeight: 900, color: '#1e293b', letterSpacing: '1px', textTransform: 'uppercase', margin: 0 }}>PANEL DE CONTROL GEOESPACIAL</h2>
            <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0 0', fontWeight: 500 }}>Gestión integral de reportes ciudadanos</p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', padding: '6px 14px', borderRadius: '9999px' }}>
              <span style={{ width: '8px', height: '8px', backgroundColor: '#10b981', borderRadius: '50%', display: 'inline-block' }}></span>
              <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#059669', letterSpacing: '0.5px' }}>SISTEMA EN LÍNEA</span>
            </div>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px' }}>
              {session?.user?.name ? session.user.name.charAt(0).toUpperCase() : 'OP'}
            </div>
          </div>
        </header>
        
        {/* ÁREA DE TRABAJO */}
        <div style={{ flex: 1, display: 'flex', padding: '24px', gap: '24px', overflow: 'hidden', boxSizing: 'border-box' }}>
          
          {/* RENDERIZADO DEL MAPA Y PANEL LATERAL (Vista por Defecto) */}
          {vistaActiva === 'MAPA' && (
            <>
              {/* MAPA */}
              <div style={{ flex: 2, backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '24px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                <div style={{ backgroundColor: 'white', padding: '14px 20px', borderBottom: '1px solid #f1f5f9', fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><FiRadio color="#0ea5e9" /> CARTOGRAFÍA EN TIEMPO REAL</span>
                  <span style={{ color: '#0284c7', fontFamily: 'monospace', fontSize: '10px', backgroundColor: '#f0f9ff', padding: '4px 10px', borderRadius: '8px', border: '1px solid #bae6fd' }}>WGS 84</span>
                </div>
                <div style={{ flex: 1, position: 'relative' }}>
                  <MapComponent 
                    tickets={ticketsFiltrados} 
                    fantasmas={ticketsCercanos} 
                    coordenadaSeleccionada={coordenadaEnfoque} 
                    onTicketSelect={(id) => {
                      const t = ticketsFiltrados.find(x => x.id === id);
                      if(t) abrirDetalle(t.id, t.latitud, t.longitud);
                    }} 
                  />
                </div>
              </div>

              {/* PANEL LATERAL DERECHO */}
              <div style={{ width: '440px', backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                
                {!ticketSeleccionado && (
                  <>
                    <div style={{ padding: '20px', borderBottom: '1px solid #f1f5f9', backgroundColor: 'white' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <h3 style={{ fontSize: '12px', fontWeight: 900, color: '#1e293b', margin: 0, letterSpacing: '0.5px' }}>BANDEJA DE INCIDENTES</h3>
                        <span style={{ fontSize: '10px', fontWeight: 'bold', backgroundColor: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd', padding: '4px 10px', borderRadius: '12px' }}>
                          {ticketsFiltrados.length} Registros
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ position: 'relative' }}>
                          <FiSearch style={{ position: 'absolute', left: '14px', top: '14px', color: '#94a3b8' }} size={16} />
                          <input 
                            type="text" 
                            placeholder="Buscar ID o teléfono..." 
                            value={filtroTexto}
                            onChange={(e) => setFiltroTexto(e.target.value)}
                            style={{ width: '100%', fontSize: '12px', fontWeight: 500, padding: '12px 14px 12px 40px', backgroundColor: '#F4F7FE', border: '1px solid transparent', borderRadius: '16px', outline: 'none', boxSizing: 'border-box' }} 
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <select 
                            value={filtroEstado}
                            onChange={(e) => setFiltroEstado(e.target.value)}
                            style={{ flex: 1, fontSize: '11px', fontWeight: 600, padding: '10px', backgroundColor: '#F4F7FE', border: '1px solid transparent', borderRadius: '14px', outline: 'none', color: '#475569', cursor: 'pointer' }}
                          >
                            <option value="TODOS">Estado: Todos</option>
                            <option value="PENDIENTE">Pendientes</option>
                            <option value="EN_REVISION">En Revisión</option>
                            <option value="DESPACHADO">Despachados</option>
                          </select>
                          <select 
                            value={filtroPrioridad}
                            onChange={(e) => setFiltroPrioridad(e.target.value)}
                            style={{ flex: 1, fontSize: '11px', fontWeight: 600, padding: '10px', backgroundColor: '#F4F7FE', border: '1px solid transparent', borderRadius: '14px', outline: 'none', color: '#475569', cursor: 'pointer' }}
                          >
                            <option value="TODAS">Prioridad: Todas</option>
                            <option value="ALTA">Crítica / Alta</option>
                            <option value="MEDIA">Media</option>
                            <option value="BAJA">Baja</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: '#F9FAFC' }}>
                      {cargando ? (
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', gap: '8px' }}>
                          <div style={{ width: '20px', height: '20px', border: '2px solid #0284c7', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                          <p style={{ fontSize: '11px', fontWeight: 'bold', color: '#94a3b8' }}>SINCRONIZANDO...</p>
                        </div>
                      ) : ticketsFiltrados.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', border: '2px dashed #e2e8f0', borderRadius: '16px', padding: '24px', textAlign: 'center' }}>
                          <FiAlertTriangle size={28} color="#cbd5e1" style={{ marginBottom: '8px' }} />
                          <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', margin: 0 }}>Sin coincidencias</p>
                          <p style={{ fontSize: '10px', color: '#94a3b8', margin: '4px 0 0 0' }}>Prueba ajustando los filtros</p>
                        </div>
                      ) : (
                        ticketsFiltrados.map((ticket) => (
                          <div 
                            key={ticket.id} 
                            onClick={() => abrirDetalle(ticket.id, ticket.latitud, ticket.longitud)} 
                            style={{ backgroundColor: 'white', border: '1px solid #f1f5f9', padding: '16px', borderRadius: '16px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 900, color: '#1e293b' }}>{ticket.codigoTicket}</span>
                              <span style={{ fontSize: '9px', fontWeight: 900, padding: '4px 10px', borderRadius: '10px', border: '1px solid', ...obtenerEstiloPrioridad(ticket.prioridadIA) }}>
                                {ticket.prioridadIA}
                              </span>
                            </div>
                            
                            <p style={{ fontSize: '11px', color: '#475569', margin: '0 0 12px 0', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {ticket.analisisIA}
                            </p>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid #f8fafc', fontSize: '11px' }}>
                              <span style={{ padding: '3px 8px', borderRadius: '8px', border: '1px solid', fontSize: '10px', fontWeight: 'bold', ...obtenerEstiloEstado(ticket.estado) }}>
                                {ticket.estado.replace('_', ' ')}
                              </span>
                              <span style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: '10px' }}>
                                {ticket.ciudadano?.telefono?.replace('569', '+56 9 ')}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}

                {ticketSeleccionado && (
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'white' }}>
                    
                    <div style={{ padding: '20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '9px', color: '#0284c7', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 900, display: 'block', marginBottom: '2px' }}>EXPEDIENTE OPERATIVO</span>
                        <h3 style={{ fontSize: '14px', fontWeight: 900, color: '#1e293b', margin: 0 }}>{ticketSeleccionado.codigoTicket}</h3>
                      </div>
                      <button 
                        onClick={cerrarDetalle} 
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', fontSize: '11px', fontWeight: 'bold', backgroundColor: '#F4F7FE', border: 'none', padding: '8px 14px', borderRadius: '12px', cursor: 'pointer' }}
                      >
                        <FiArrowLeft size={14} /> Volver
                      </button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#F9FAFC' }}>
                      
                      {ticketSeleccionado.evidencias && ticketSeleccionado.evidencias.length > 0 && (
                        <div>
                          <h4 style={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 8px 0' }}>EVIDENCIA GRÁFICA</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            {ticketSeleccionado.evidencias.map((ev: any) => (
                              <img key={ev.id} src={ev.url} alt="Evidencia" style={{ height: '110px', width: '100%', objectFit: 'cover', borderRadius: '14px', border: '1px solid #e2e8f0' }} />
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <h4 style={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 8px 0' }}>DECLARACIÓN DEL CIUDADANO</h4>
                        <div style={{ backgroundColor: 'white', padding: '14px', border: '1px solid #e2e8f0', borderRadius: '14px', fontSize: '11px', color: '#475569', fontStyle: 'italic', boxShadow: '0 1px 2px rgba(0,0,0,0.01)' }}>
                          "{ticketSeleccionado.descripcionUsuario}"
                        </div>
                      </div>

                      <div>
                        <h4 style={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <FiCpu size={14} color="#d97706" /> DICTAMEN DE INTELIGENCIA ARTIFICIAL
                        </h4>
                        <div style={{ backgroundColor: '#fffbeb', padding: '14px', border: '1px solid #fde68a', borderRadius: '14px', fontSize: '11px', color: '#92400e', lineHeight: 1.5, fontWeight: 500 }}>
                          {ticketSeleccionado.analisisIA}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div style={{ backgroundColor: 'white', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <span style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 900, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><FiPhone size={10} color="#0ea5e9" /> TELÉFONO</span>
                          <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold', color: '#1e293b' }}>{ticketSeleccionado.ciudadano.telefono.replace('569', '+56 9 ')}</span>
                        </div>
                        <div style={{ backgroundColor: 'white', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <span style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 900, marginBottom: '4px' }}>PRIORIDAD</span>
                          <span style={{ fontSize: '10px', fontWeight: 900, padding: '3px 8px', borderRadius: '8px', border: '1px solid', width: 'fit-content', ...obtenerEstiloPrioridad(ticketSeleccionado.prioridadIA) }}>
                            {ticketSeleccionado.prioridadIA}
                          </span>
                        </div>
                      </div>

                      <div>
                        <h4 style={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <FiClock size={14} color="#0ea5e9" /> TRAZABILIDAD
                        </h4>
                        <div style={{ borderLeft: '2px solid #e2e8f0', marginLeft: '8px', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {ticketSeleccionado.historial?.map((h: any) => (
                            <div key={h.id} style={{ position: 'relative' }}>
                              <div style={{ position: 'absolute', left: '-23px', top: '2px', width: '8px', height: '8px', backgroundColor: '#94a3b8', borderRadius: '50%', border: '2px solid white' }}></div>
                              <p style={{ fontSize: '11px', fontWeight: 900, color: '#1e293b', margin: 0 }}>{h.estadoNuevo.replace('_', ' ')}</p>
                              <p style={{ fontSize: '9px', color: '#94a3b8', fontFamily: 'monospace', margin: '2px 0 0 0' }}>{new Date(h.createdAt).toLocaleString()}</p>
                            </div>
                          ))}
                          <div style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', left: '-23px', top: '2px', width: '8px', height: '8px', backgroundColor: '#0ea5e9', borderRadius: '50%', border: '2px solid white', boxShadow: '0 0 6px rgba(14,165,233,0.5)' }}></div>
                            <p style={{ fontSize: '11px', fontWeight: 900, color: '#1e293b', margin: 0 }}>Ingresado vía WhatsApp (IA)</p>
                            <p style={{ fontSize: '9px', color: '#94a3b8', fontFamily: 'monospace', margin: '2px 0 0 0' }}>{new Date(ticketSeleccionado.createdAt).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ padding: '16px 20px', backgroundColor: 'white', borderTop: '1px solid #f1f5f9' }}>
                      <label style={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>EJECUTAR ORDEN OPERATIVA:</label>
                      <select 
                        value={ticketSeleccionado.estado}
                        onChange={(e) => cambiarEstado(ticketSeleccionado.id, e.target.value)}
                        style={{ width: '100%', padding: '12px', backgroundColor: '#F4F7FE', color: '#1e293b', border: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', borderRadius: '14px', outline: 'none', cursor: 'pointer' }}
                      >
                        <option value="PENDIENTE">Estado: Pendiente</option>
                        <option value="EN_REVISION">Estado: En Revisión</option>
                        <option value="DESPACHADO">Orden: Despachar Móvil</option>
                        <option value="RESUELTO">Cerrar Caso: Resuelto</option>
                        <option value="DESCARTADO">Anular: Descartar Caso</option>
                      </select>
                    </div>

                  </div>
                )}
              </div>
            </>
          )}

          {/* RENDERIZADO DEL TABLERO KANBAN */}
          {vistaActiva === 'KANBAN' && (
            <div style={{ flex: 1, backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '24px', padding: '24px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ marginBottom: '20px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 900, color: '#1e293b', margin: '0 0 4px 0' }}>Flujo Operativo</h2>
                <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Haz clic en un ticket para ver su detalle en el visor territorial.</p>
              </div>
              <Kanban 
                tickets={ticketsFiltrados} 
                onTicketSelect={(id) => {
                  const t = ticketsFiltrados.find(x => x.id === id);
                  if(t) {
                    abrirDetalle(t.id, t.latitud, t.longitud);
                    setVistaActiva('MAPA');
                  }
                }} 
              />
            </div>
          )}

          {/* RENDERIZADO DE ESTADÍSTICAS */}
          {vistaActiva === 'ESTADISTICA' && (
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <Estadisticas tickets={ticketsFiltrados} />
            </div>
          )}

          {/* RENDERIZADO DEL PANEL DE ADMINISTRACIÓN (Solo si eres admin) */}
          {vistaActiva === 'ADMINISTRACION' && (session?.user as any)?.role === 'ADMINISTRADOR' && (
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <AdminPanel />
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
