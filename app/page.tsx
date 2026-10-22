"use client";

import dynamic from 'next/dynamic';
import { useEffect, useState, useMemo } from 'react';
import { io } from 'socket.io-client';
import { useSession, signOut } from 'next-auth/react';
import { 
  FiMap, FiGrid, FiActivity, FiSearch, FiShield, 
  FiClock, FiPhone, FiAlertTriangle, FiArrowLeft, FiRadio, FiCpu,
  FiSettings, FiLogOut, FiSend, FiMessageSquare, FiImage, FiCheckCircle
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
  categoria?: { nombre: string };
  departamento?: { nombre: string };
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

  // Estado de derivación con "SIN ASIGNAR" como valor inicial por defecto
  const [departamentoDerivacion, setDepartamentoDerivacion] = useState("SIN ASIGNAR");

  const API_GATEWAY_URL = "https://nn4p1ybmu2.execute-api.us-east-2.amazonaws.com";

  const fetchTickets = async () => {
    try {
      const res = await fetch(`${API_GATEWAY_URL}/tickets`);
      if (res.ok) setTickets(await res.json());
    } catch (error) { 
      console.error(error); 
    } finally { 
      setCargando(false); 
    }
  };

  useEffect(() => {
    fetchTickets();
    // El WebSocket se mantiene en Azure para recibir notificaciones en tiempo real
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

  // AL ABRIR UN TICKET PENDIENTE, PASA AUTOMÁTICAMENTE A EVALUACIÓN (EN_REVISION)
  const abrirDetalle = async (id: string, lat: number | null, lng: number | null) => {
    try {
      const res = await fetch(`${API_GATEWAY_URL}/tickets/${id}`);
      if (res.ok) {
        const detalle: Ticket = await res.json();
        
        // Regla C4: Si el caso estaba PENDIENTE, pasa inmediatamente a EN_REVISION al ser inspeccionado
        if (detalle.estado === 'PENDIENTE') {
          await cambiarEstado(detalle.id, 'EN_REVISION');
          detalle.estado = 'EN_REVISION';
        }

        setTicketSeleccionado(detalle);
        
        // Si el ticket ya posee departamento guardado se asigna, de lo contrario se inicia en "SIN ASIGNAR"
        setDepartamentoDerivacion(detalle.departamento?.nombre || "SIN ASIGNAR");
        
        if (lat && lng) {
          setCoordenadaEnfoque([lat, lng]);
          try {
            const resCercanos = await fetch(`${API_GATEWAY_URL}/tickets/cercanos?lat=${lat}&lng=${lng}`);
            if (resCercanos.ok) setTicketsCercanos(await resCercanos.json());
          } catch (e) {
            console.warn("Ruta de tickets cercanos no disponible en el API Gateway", e);
          }
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
      const res = await fetch(`${API_GATEWAY_URL}/tickets/${ticketId}`, {
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ nuevoEstado })
      });
      if (res.ok) {
        if (ticketSeleccionado && ticketSeleccionado.id === ticketId) {
          setTicketSeleccionado(prev => prev ? { ...prev, estado: nuevoEstado } : null);
        }
        fetchTickets(); 
      }
    } catch (error) { console.error(error); }
  };

  const derivarTicket = async (ticketId: string) => {
    if (departamentoDerivacion === "SIN ASIGNAR") {
      alert("⚠️ Debe seleccionar un departamento municipal válido antes de enviar a despacho.");
      return;
    }

    try {
      const res = await fetch(`${API_GATEWAY_URL}/tickets/${ticketId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ nuevoEstado: 'DESPACHADO', departamentoAsignado: departamentoDerivacion })
      });
      if (res.ok) {
        fetchTickets();
        if (ticketSeleccionado && ticketSeleccionado.id === ticketId) cerrarDetalle();
      }
    } catch (error) { console.error(error); }
  };

  const obtenerEstiloPrioridad = (prioridad: string) => {
    if (prioridad === 'ALTA' || prioridad === 'CRITICA') return { backgroundColor: '#fff1f2', color: '#e11d48', borderColor: '#fecdd3' };
    if (prioridad === 'MEDIA') return { backgroundColor: '#fffbeb', color: '#d97706', borderColor: '#fde68a' };
    return { backgroundColor: '#f1f5f9', color: '#475569', borderColor: '#e2e8f0' };
  };

  const obtenerEstadoVisual = (t: Ticket) => {
    if (t.estado === 'PENDIENTE') {
       const tieneGPS = t.latitud !== null;
       const tieneFoto = t.evidencias && t.evidencias.length > 0;
       
       if (!tieneGPS || !tieneFoto) {
         return { label: 'INCOMPLETO (GPS/FOTO)', bg: '#fef3c7', text: '#d97706', border: '#fde68a' }; 
       }
       return { label: 'NUEVO • PENDIENTE EVALUACIÓN', bg: '#fee2e2', text: '#dc2626', border: '#fecaca' }; 
    }
    if (t.estado === 'EN_REVISION') {
       if (!t.departamento || t.departamento.nombre === 'SIN ASIGNAR') {
         return { label: 'EN EVALUACIÓN (SIN ASIGNAR)', bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd' };
       }
       return { label: `EVALUADO • ${t.departamento.nombre}`, bg: '#f0f9ff', text: '#0284c7', border: '#bae6fd' };
    }
    if (t.estado === 'DERIVADO' || t.estado === 'DESPACHADO') {
      return { label: 'EN TERRENO (DESPACHADO)', bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' }; 
    }
    if (t.estado === 'RESUELTO') {
      return { label: 'RESUELTO', bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' }; 
    }
    return { label: t.estado, bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };
  };

  const renderizarChat = (texto: string) => {
    const partes = texto.split(/(\[Usuario\]:|\[Sistema\]:)/g).filter(Boolean);
    let mensajes = [];
    let autorActual = 'Ciudadano';

    for (let i = 0; i < partes.length; i++) {
      const parte = partes[i].trim();
      if (!parte) continue;
      if (parte === '[Usuario]:') autorActual = 'Ciudadano';
      else if (parte === '[Sistema]:') autorActual = 'MuniVox';
      else mensajes.push({ autor: autorActual, texto: parte });
    }

    return mensajes.map((m, idx) => (
      <div key={idx} style={{ 
        alignSelf: m.autor === 'Ciudadano' ? 'flex-end' : 'flex-start',
        backgroundColor: m.autor === 'Ciudadano' ? '#dcf8c6' : '#ffffff',
        border: '1px solid #e2e8f0',
        padding: '8px 12px',
        borderRadius: m.autor === 'Ciudadano' ? '12px 0px 12px 12px' : '0px 12px 12px 12px',
        maxWidth: '85%',
        fontSize: '11px',
        color: '#1e293b',
        marginBottom: '6px',
        boxShadow: '0 1px 1px rgba(0,0,0,0.05)'
      }}>
        <strong style={{ display: 'block', fontSize: '9px', color: '#64748b', marginBottom: '2px' }}>{m.autor}</strong>
        {m.texto}
      </div>
    ));
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
                            <option value="EN_REVISION">En Evaluación</option>
                            <option value="DESPACHADO">En Terreno / Despachados</option>
                            <option value="RESUELTO">Resueltos</option>
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
                        ticketsFiltrados.map((ticket) => {
                          const uiState = obtenerEstadoVisual(ticket);
                          return (
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
                              
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#0284c7' }}></div>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                                  {ticket.categoria?.nombre || 'Clasificación Pendiente'}
                                </span>
                              </div>
                              
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid #f8fafc', fontSize: '11px' }}>
                                <span style={{ padding: '4px 10px', borderRadius: '8px', border: `1px solid ${uiState.border}`, backgroundColor: uiState.bg, color: uiState.text, fontSize: '9px', fontWeight: 900, letterSpacing: '0.5px' }}>
                                  {uiState.label}
                                </span>
                                <span style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <FiPhone /> {ticket.ciudadano?.telefono?.replace('569', '+56 9 ')}
                                </span>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                  </>
                )}

                {ticketSeleccionado && (
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'white' }}>
                    
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
                      <div>
                        <span style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 900, display: 'block', marginBottom: '2px' }}>EXPEDIENTE OPERATIVO</span>
                        <h3 style={{ fontSize: '16px', fontWeight: 900, color: '#1e293b', margin: 0 }}>{ticketSeleccionado.codigoTicket}</h3>
                      </div>
                      <button 
                        onClick={cerrarDetalle} 
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', fontSize: '11px', fontWeight: 'bold', backgroundColor: 'white', border: '1px solid #e2e8f0', padding: '8px 14px', borderRadius: '12px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                      >
                        <FiArrowLeft size={14} /> Volver
                      </button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#ffffff' }}>
                      
                      {/* DICTAMEN DE INTELIGENCIA ARTIFICIAL */}
                      <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '16px', padding: '16px', boxShadow: '0 4px 6px -1px rgba(217,119,6,0.1)' }}>
                         <h4 style={{ fontSize: '10px', fontWeight: 900, color: '#d97706', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <FiCpu size={14} /> DICTAMEN DE INTELIGENCIA ARTIFICIAL
                        </h4>
                        <p style={{ fontSize: '12px', color: '#92400e', lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
                          {ticketSeleccionado.analisisIA}
                        </p>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div style={{ backgroundColor: '#F8FAFC', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <span style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 900, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><FiPhone size={10} color="#0ea5e9" /> CIUDADANO</span>
                          <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: '#1e293b' }}>{ticketSeleccionado.ciudadano.telefono.replace('569', '+56 9 ')}</span>
                        </div>
                        <div style={{ backgroundColor: '#F8FAFC', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <span style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 900, marginBottom: '4px' }}>PRIORIDAD</span>
                          <span style={{ fontSize: '10px', fontWeight: 900, padding: '3px 8px', borderRadius: '8px', border: '1px solid', width: 'fit-content', ...obtenerEstiloPrioridad(ticketSeleccionado.prioridadIA) }}>
                            {ticketSeleccionado.prioridadIA}
                          </span>
                        </div>
                      </div>

                      <div>
                        <h4 style={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <FiMessageSquare size={14} color="#10b981" /> HISTORIAL DE CONVERSACIÓN
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', backgroundColor: '#e2e8f0', padding: '16px', borderRadius: '16px', backgroundImage: 'url("https://www.transparenttextures.com/patterns/cubes.png")' }}>
                          {renderizarChat(ticketSeleccionado.descripcionUsuario)}
                        </div>
                      </div>

                      {ticketSeleccionado.evidencias && ticketSeleccionado.evidencias.length > 0 && (
                        <div>
                          <h4 style={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FiImage size={14} color="#6366f1" /> EVIDENCIA GRÁFICA
                          </h4>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            {ticketSeleccionado.evidencias.map((ev: any) => (
                              <img key={ev.id} src={ev.url} alt="Evidencia" style={{ height: '140px', width: '100%', objectFit: 'cover', borderRadius: '14px', border: '1px solid #e2e8f0' }} />
                            ))}
                          </div>
                        </div>
                      )}

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

                    {/* PANEL DE DESPACHO INTERACTIVO CON RECOMENDACIÓN DE LA IA */}
                    {ticketSeleccionado.estado !== 'RESUELTO' && (
                      <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                        <label style={{ fontSize: '10px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', display: 'block' }}>
                          PANEL DE DESPACHO MUNICIPAL
                        </label>

                        {/* BANNER DE RECOMENDACIÓN IA */}
                        <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', padding: '10px 14px', borderRadius: '12px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '10px', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>
                            🤖 RECOMENDACIÓN IA:
                          </span>
                          <span style={{ fontSize: '11px', fontWeight: 900, color: '#1d4ed8', backgroundColor: '#dbeafe', padding: '4px 10px', borderRadius: '8px' }}>
                            {ticketSeleccionado.departamento?.nombre || ticketSeleccionado.categoria?.nombre || "SEGURIDAD PÚBLICA"}
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <select 
                            value={departamentoDerivacion}
                            onChange={(e) => setDepartamentoDerivacion(e.target.value)}
                            style={{ width: '100%', padding: '14px', backgroundColor: 'white', color: departamentoDerivacion === "SIN ASIGNAR" ? '#dc2626' : '#1e293b', border: departamentoDerivacion === "SIN ASIGNAR" ? '1px solid #fca5a5' : '1px solid #cbd5e1', fontSize: '12px', fontWeight: 700, borderRadius: '12px', outline: 'none', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                          >
                            <option value="SIN ASIGNAR">-- SIN ASIGNAR DEPARTAMENTO --</option>
                            <option value="SEGURIDAD PÚBLICA">Derivar a: SEGURIDAD PÚBLICA</option>
                            <option value="DIMAO">Derivar a: DIMAO (Aseo y Ornato)</option>
                            <option value="TRÁNSITO">Derivar a: DIRECCIÓN DE TRÁNSITO</option>
                            <option value="DOM">Derivar a: OBRAS MUNICIPALES (DOM)</option>
                            <option value="DIDECO">Derivar a: DIDECO</option>
                          </select>
                          
                          <button 
                            onClick={() => derivarTicket(ticketSeleccionado.id)}
                            style={{ width: '100%', backgroundColor: departamentoDerivacion === "SIN ASIGNAR" ? '#94a3b8' : '#2563eb', color: 'white', padding: '14px', borderRadius: '12px', border: 'none', fontWeight: 900, fontSize: '13px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: departamentoDerivacion === "SIN ASIGNAR" ? 'not-allowed' : 'pointer', boxShadow: '0 4px 6px -1px rgba(37,99,235,0.3)', transition: 'background-color 0.2s' }}
                            onMouseOver={(e) => {
                              if (departamentoDerivacion !== "SIN ASIGNAR") e.currentTarget.style.backgroundColor = '#1d4ed8';
                            }}
                            onMouseOut={(e) => {
                              if (departamentoDerivacion !== "SIN ASIGNAR") e.currentTarget.style.backgroundColor = '#2563eb';
                            }}
                          >
                            <FiSend size={16} /> CONFIRMAR DESPACHO A TERRENO
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>
            </>
          )}

          {/* RENDERIZADO DEL TABLERO KANBAN */}
          {vistaActiva === 'KANBAN' && (
              <div style={{ flex: 1, backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '24px', padding: '24px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginBottom: '20px' }}>
                  <h2 style={{ fontSize: '16px', fontWeight: 900, color: '#1e293b', margin: '0 0 4px 0' }}>Flujo Operativo de Monitoreo</h2>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Haz clic en un ticket para ver su detalle e inspeccionarlo en el visor territorial.</p>
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