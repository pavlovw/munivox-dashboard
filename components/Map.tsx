"use client";

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Esto repara las rutas de los iconos por defecto de Leaflet en Next.js usando TypeScript
delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Controlador de Vuelo: Hace el efecto zoom animado al pinchar un ticket en la lista
function MapUpdater({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 18, { animate: true, duration: 1.5 });
    }
  }, [center, map]);
  return null;
}

// Creador de iconos tácticos C4 con colores específicos
const crearIcono = (colorBase: string, border: string) => {
  return L.divIcon({
    className: 'custom-pin-c4',
    html: `<div style="
      background-color: ${colorBase}; 
      width: 22px; 
      height: 22px; 
      border-radius: 50%; 
      border: 3px solid ${border}; 
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="width: 6px; height: 6px; background-color: white; border-radius: 50%;"></div>
    </div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });
};

// Paleta de Semáforo Operativo
const iconListoDespacho = crearIcono('#dc2626', '#fca5a5'); // Rojo (Listo para enviar móvil)
const iconIncompleto = crearIcono('#f59e0b', '#fde68a'); // Naranja (Falta Foto)
const iconTerreno = crearIcono('#2563eb', '#bfdbfe'); // Azul (Derivado a departamento)
const iconResuelto = crearIcono('#10b981', '#a7f3d0'); // Verde (Cerrado - desaparecerá a las 24h)

interface MapProps {
  tickets: any[];
  fantasmas: any[];
  coordenadaSeleccionada: [number, number] | null;
  onTicketSelect: (id: string) => void;
}

export default function Map({ tickets, fantasmas, coordenadaSeleccionada, onTicketSelect }: MapProps) {
  useEffect(() => { delete (L.Icon.Default.prototype as any)._getIconUrl; }, []);

  const centroBuin: [number, number] = [-33.732, -70.742];

  return (
    <MapContainer center={centroBuin} zoom={14} style={{ height: '100%', width: '100%' }}>
      <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      
      <MapUpdater center={coordenadaSeleccionada} />

      <Marker position={centroBuin}>
        <Popup><strong className="text-slate-800">C4 - MUNICIPALIDAD DE BUIN</strong></Popup>
      </Marker>

      {/* DIBUJAR INCIDENTES ACTIVOS (Los que ves en la lista) */}
      {tickets.map(ticket => {
        if (!ticket.latitud || !ticket.longitud) return null;
        
        // Lógica de semaforización
        let iconoUsar = iconListoDespacho;
        let estadoLabel = 'LISTO PARA DESPACHO';
        let labelColor = '#dc2626'; 

        if (ticket.estado === 'PENDIENTE') {
          const tieneFoto = ticket.evidencias && ticket.evidencias.length > 0;
          if (!tieneFoto) {
            iconoUsar = iconIncompleto;
            estadoLabel = 'INCOMPLETO (SIN FOTO)';
            labelColor = '#d97706'; 
          }
        } else if (ticket.estado === 'DERIVADO' || ticket.estado === 'DESPACHADO' || ticket.estado === 'EN_REVISION') {
          iconoUsar = iconTerreno;
          estadoLabel = 'EN TERRENO';
          labelColor = '#2563eb'; 
        } else if (ticket.estado === 'RESUELTO') {
          iconoUsar = iconResuelto;
          estadoLabel = 'RESUELTO';
          labelColor = '#059669'; 
        }

        return (
          <Marker 
            key={ticket.id} 
            position={[ticket.latitud, ticket.longitud]} 
            icon={iconoUsar}
            eventHandlers={{ click: () => onTicketSelect(ticket.id) }}
          >
            <Popup>
              <strong style={{ color: labelColor, fontSize: '14px', display: 'block' }}>{ticket.codigoTicket}</strong>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold', color: '#64748b' }}>
                {estadoLabel}
              </span>
              <br/>
              <span style={{ fontSize: '11px', color: '#475569', display: 'block', marginTop: '4px' }}>
                {ticket.categoria?.nombre || 'General'}
              </span>
            </Popup>
          </Marker>
        );
      })}

      {/* DIBUJAR FANTASMAS (Casos resueltos cercanos cuando haces clic en un reporte) */}
      {fantasmas.map(fantasma => {
        if (!fantasma.latitud || !fantasma.longitud) return null;
        return (
          <Marker 
            key={fantasma.id} 
            position={[fantasma.latitud, fantasma.longitud]} 
            icon={iconResuelto}
            eventHandlers={{ click: () => onTicketSelect(fantasma.id) }}
          >
            <Popup>
              <strong className="text-slate-500">{fantasma.codigoTicket}</strong><br/>
              <span className="text-[10px] uppercase font-bold text-slate-400">RESUELTO (Contexto Histórico)</span>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
